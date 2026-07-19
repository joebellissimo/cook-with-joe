import data from "@/data/recipes.json";

export function getCategories() {
  return data.categories;
}

export function getAllRecipes() {
  return data.recipes;
}

export function getRecipeBySlug(slug) {
  return data.recipes.find((r) => r.slug === slug) || null;
}

export function getRecipesByCategory(category) {
  if (!category || category === "All") return data.recipes;
  return data.recipes.filter((r) => r.category === category);
}
