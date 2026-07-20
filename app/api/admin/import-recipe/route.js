import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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

function slugify(text) {
  const slug = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "import";
}

function resolveUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).href;
  } catch {
    return null;
  }
}

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

// schema.org Recipe.video: a VideoObject (or array of them), or occasionally
// a bare URL string. VideoObject exposes the actual file at contentUrl, or a
// player page at embedUrl.
function videoUrlFromRecipeNode(recipe) {
  const video = recipe?.video;
  if (!video) return null;
  const node = Array.isArray(video) ? video[0] : video;
  if (typeof node === "string") return node;
  return node?.contentUrl || node?.embedUrl || null;
}

// schema.org Recipe.image: a URL string, an ImageObject (or array of either).
function imageUrlFromRecipeNode(recipe) {
  const image = recipe?.image;
  if (!image) return null;
  const node = Array.isArray(image) ? image[0] : image;
  if (typeof node === "string") return node;
  return node?.url || null;
}

// Fallback for pages with no usable JSON-LD Recipe: read the raw <video>
// element's src, or its first <source src="...">.
function findVideoElementSrc(html) {
  const directSrc = html.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (directSrc) return directSrc[1];

  const videoBlock = html.match(/<video\b[^>]*>([\s\S]*?)<\/video>/i);
  if (videoBlock) {
    const sourceSrc = videoBlock[1].match(/<source\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (sourceSrc) return sourceSrc[1];
  }

  return null;
}

function findVideoPoster(html) {
  const match = html.match(/<video\b[^>]*\bposter=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function findOgImage(html) {
  let match = html.match(
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i
  );
  if (match) return match[1];
  match = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  );
  return match ? match[1] : null;
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

// Fetches a discovered asset and uploads it to Blob. Never throws — instead
// returns { url, error } so a missing or broken video/thumbnail never fails
// the whole import; the caller decides whether a non-null error is worth
// surfacing (e.g. as a warning) or safe to ignore (nothing was found at all).
async function uploadAssetToBlob({ sourceUrl, pathname, fallbackContentType }) {
  if (!sourceUrl) return { url: null, error: null };
  try {
    const res = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        // Some image CDNs reject requests with no User-Agent, or one that
        // self-identifies as a bot/importer — a realistic browser UA (plus
        // an Accept header some CDNs also check for) avoids that.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/*,video/*,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return { url: null, error: `Fetch failed with status ${res.status}` };
    }
    const contentType = res.headers.get("content-type") || fallbackContentType;
    const buffer = Buffer.from(await res.arrayBuffer());
    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return { url: blob.url, error: null };
  } catch (err) {
    return { url: null, error: err.message || "Unknown fetch error" };
  }
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

  let draft;
  let videoSourceUrl = null;
  let thumbnailSourceUrl = null;

  const ldJsonRecipe = extractLdJsonRecipe(html);
  if (ldJsonRecipe) {
    draft = draftFromJsonLd(ldJsonRecipe);
    videoSourceUrl = resolveUrl(videoUrlFromRecipeNode(ldJsonRecipe), url);
    thumbnailSourceUrl =
      resolveUrl(imageUrlFromRecipeNode(ldJsonRecipe), url) ||
      resolveUrl(findVideoPoster(html), url) ||
      resolveUrl(findOgImage(html), url);
  } else {
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

    try {
      draft = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "The extraction came back incomplete — try again or a different page." },
        { status: 502 }
      );
    }

    videoSourceUrl = resolveUrl(findVideoElementSrc(html), url);
    thumbnailSourceUrl =
      resolveUrl(findVideoPoster(html), url) || resolveUrl(findOgImage(html), url);
  }

  const slug = slugify(draft.title);
  const timestamp = Date.now();

  const [videoResult, thumbnailResult] = await Promise.all([
    uploadAssetToBlob({
      sourceUrl: videoSourceUrl,
      pathname: `videos/${slug}-${timestamp}.mp4`,
      fallbackContentType: "video/mp4",
    }),
    uploadAssetToBlob({
      sourceUrl: thumbnailSourceUrl,
      pathname: `thumbnails/${slug}-${timestamp}.jpg`,
      fallbackContentType: "image/jpeg",
    }),
  ]);

  // Only warn when a thumbnail was actually found but couldn't be fetched —
  // "nothing found on the page" is a normal, silent no-op, not a failure.
  const thumbnailWarning =
    thumbnailSourceUrl && !thumbnailResult.url
      ? `Found a thumbnail image but couldn't fetch it (${thumbnailResult.error}) — add one manually if you'd like.`
      : null;

  return NextResponse.json({
    ...draft,
    slug,
    ...(videoResult.url ? { video: videoResult.url } : {}),
    ...(thumbnailResult.url ? { thumbnail: thumbnailResult.url } : {}),
    ...(thumbnailWarning ? { thumbnailWarning } : {}),
  });
}
