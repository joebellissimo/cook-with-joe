import { getRecipesData } from "@/lib/recipesStore";

export async function getCategories() {
  const data = await getRecipesData();
  return data.categories;
}

export async function getAllRecipes() {
  const data = await getRecipesData();
  return data.recipes;
}

export async function getRecipeBySlug(slug) {
  const data = await getRecipesData();
  return data.recipes.find((r) => r.slug === slug) || null;
}

export async function getRecipesByCategory(category) {
  const data = await getRecipesData();
  if (!category || category === "All") return data.recipes;
  return data.recipes.filter((r) => r.category === category);
}
