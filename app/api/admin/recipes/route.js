import { NextResponse } from "next/server";
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
    db.recipes[existingIndex] = recipe;
  } else {
    db.recipes.push(recipe);
  }

  if (recipe.category && !db.categories.includes(recipe.category)) {
    db.categories.push(recipe.category);
  }

  await saveRecipesData(db);

  return NextResponse.json(recipe);
}
