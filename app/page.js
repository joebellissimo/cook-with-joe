"use client";

import { useMemo, useState } from "react";
import recipeData from "@/data/recipes.json";
import RecipeCard from "@/components/RecipeCard";

export default function HomePage() {
  const [selected, setSelected] = useState("All");
  const categories = ["All", ...recipeData.categories];

  const filtered = useMemo(() => {
    if (selected === "All") return recipeData.recipes;
    return recipeData.recipes.filter((r) => r.category === selected);
  }, [selected]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 text-white shadow">
        <h1 className="text-2xl font-bold sm:text-3xl">Cook along, hands-free.</h1>
        <p className="mt-2 max-w-2xl text-sm text-orange-50 sm:text-base">
          Tap any step to jump straight to it, loop a tricky technique, or just
          say &ldquo;next step&rdquo; when your hands are covered in flour.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selected === cat
                ? "bg-orange-600 text-white"
                : "bg-white text-neutral-700 border border-neutral-200 hover:border-orange-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-neutral-500">No recipes in this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
