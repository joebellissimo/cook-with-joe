import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const RECIPE_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: { type: "string" },
    intro: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    tips: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          direction: { type: "string" },
        },
        required: ["label", "direction"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "category", "intro", "ingredients", "tips", "steps"],
  additionalProperties: false,
};

// Find a schema.org Recipe node in a page's JSON-LD blocks — handles a bare
// Recipe object, an array of nodes, or nodes nested under "@graph".
function extractLdJsonRecipe(html) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ].map((m) => m[1]);

  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue;
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      const nodes = candidate?.["@graph"] || [candidate];
      for (const node of nodes) {
        const type = node?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
          return node;
        }
      }
    }
  }

  return null;
}

// schema.org recipeInstructions comes in several shapes: a plain string, an
// array of strings, an array of HowToStep objects, or HowToSection groups
// nesting HowToSteps. Flatten all of them into { label, direction } pairs.
function instructionsToSteps(instructions) {
  const texts = [];

  const collect = (item) => {
    if (!item) return;
    if (typeof item === "string") {
      texts.push(item);
    } else if (item["@type"] === "HowToSection" && Array.isArray(item.itemListElement)) {
      item.itemListElement.forEach(collect);
    } else if (item.text) {
      texts.push(item.text);
    }
  };

  if (typeof instructions === "string") {
    instructions.split(/\n+/).forEach(collect);
  } else if (Array.isArray(instructions)) {
    instructions.forEach(collect);
  }

  return texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({
      label: text.length > 60 ? `${text.slice(0, 57)}...` : text,
      direction: text,
    }));
}

function draftFromJsonLd(recipe) {
  const category = Array.isArray(recipe.recipeCategory)
    ? recipe.recipeCategory[0]
    : recipe.recipeCategory || recipe.recipeCuisine || "";

  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient
    : Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : [];

  return {
    title: recipe.name || "",
    category: category || "",
    intro: typeof recipe.description === "string" ? recipe.description : "",
    ingredients,
    tips: [],
    steps: instructionsToSteps(recipe.recipeInstructions),
  };
}

function htmlToReadableText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "A recipe URL is required." }, { status: 400 });
  }

  let html;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CookWithJoeImporter/1.0)" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `That page returned a ${res.status} — check the URL and try again.` },
        { status: 400 }
      );
    }
    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Couldn't fetch that URL. Check it's correct and publicly accessible." },
      { status: 400 }
    );
  }

  const ldJsonRecipe = extractLdJsonRecipe(html);
  if (ldJsonRecipe) {
    return NextResponse.json(draftFromJsonLd(ldJsonRecipe));
  }

  const text = htmlToReadableText(html).slice(0, 20000);
  if (!text) {
    return NextResponse.json(
      { error: "Couldn't find any readable content on that page." },
      { status: 422 }
    );
  }

  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system:
        "You extract recipe content from messy webpage text. Ignore navigation, ads, comments, and unrelated content, and find the actual recipe. Guess a sensible category (e.g. Meats, Appetizers, Cocktails, Desserts, Vegetarian) from context if none is explicit. Split the directions into individual steps: label is a short few-word summary, direction is the full instruction sentence.",
      messages: [
        {
          role: "user",
          content: `Extract the recipe from this page text:\n\n${text}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RECIPE_DRAFT_SCHEMA },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Recipe extraction failed." },
      { status: 502 }
    );
  }

  if (response.stop_reason === "refusal") {
    return NextResponse.json(
      { error: "The extraction was declined for this page's content." },
      { status: 422 }
    );
  }
  if (response.stop_reason === "max_tokens") {
    return NextResponse.json(
      { error: "That recipe was too long to extract in one pass." },
      { status: 422 }
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    return NextResponse.json(
      { error: "The extraction came back empty — try a different page." },
      { status: 502 }
    );
  }

  let draft;
  try {
    draft = JSON.parse(textBlock.text);
  } catch {
    return NextResponse.json(
      { error: "The extraction came back incomplete — try again or a different page." },
      { status: 502 }
    );
  }

  return NextResponse.json(draft);
}
