import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getRecipesData, saveRecipesData } from "@/lib/recipesStore";

export async function POST(request) {
  const { recipe, originalSlug } = await request.json();

  if (!recipe?.slug || !recipe?.title) {
    return NextResponse.json(
      { error: "Recipe needs at least a 'slug' and 'title' field." },
      { status: 400 }
    );
  }

  const db = await getRecipesData();

  // A rename: drop the old slug's entry as part of this same update, rather
  // than leaving it behind as an orphaned duplicate alongside the new one.
  if (originalSlug && originalSlug !== recipe.slug) {
    db.recipes = db.recipes.filter((r) => r.slug !== originalSlug);
  }

  const existingIndex = db.recipes.findIndex((r) => r.slug === recipe.slug);
  if (existingIndex >= 0) {
    // Backstop, not the primary source: the editor already carries this
    // through, but a client that omits it shouldn't be able to silently
    // wipe an existing recipe's owner on republish.
    recipe.ownerId = recipe.ownerId || db.recipes[existingIndex].ownerId || "joe";
    db.recipes[existingIndex] = recipe;
  } else {
    // No multi-chef support yet — every recipe is "joe"'s until that lands.
    recipe.ownerId = recipe.ownerId || "joe";
    db.recipes.push(recipe);
  }

  if (recipe.category && !db.categories.includes(recipe.category)) {
    db.categories.push(recipe.category);
  }

  await saveRecipesData(db);

  return NextResponse.json(recipe);
}

export async function DELETE(request) {
  const { slug } = await request.json();

  if (!slug) {
    return NextResponse.json({ error: "A recipe slug is required." }, { status: 400 });
  }

  const db = await getRecipesData();
  const recipe = db.recipes.find((r) => r.slug === slug);

  if (!recipe) {
    return NextResponse.json({ error: "No recipe found with that slug." }, { status: 404 });
  }

  // Remove from the data list first — that's the part that actually needs to
  // succeed. Blob asset cleanup below is best-effort and shouldn't undo it.
  db.recipes = db.recipes.filter((r) => r.slug !== slug);
  await saveRecipesData(db);

  // Only Blob-hosted assets (absolute URLs) are deletable this way — a
  // recipe using a bundled /public/videos/ file (a relative path) or with no
  // video/thumbnail at all has nothing to clean up here.
  const blobAssets = [recipe.video, recipe.thumbnail].filter(
    (assetUrl) => typeof assetUrl === "string" && assetUrl.startsWith("http")
  );
  await Promise.all(blobAssets.map((assetUrl) => del(assetUrl).catch(() => {})));

  return NextResponse.json({ slug });
}
