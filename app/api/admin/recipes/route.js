import { NextResponse } from "next/server";
import { getRecipesData, saveRecipesData } from "@/lib/recipesStore";

export async function POST(request) {
  const recipe = await request.json();

  if (!recipe?.slug || !recipe?.title) {
    return NextResponse.json(
      { error: "Recipe needs at least a 'slug' and 'title' field." },
      { status: 400 }
    );
  }

  const db = await getRecipesData();

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
