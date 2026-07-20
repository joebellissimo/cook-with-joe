"use client";

import { useEffect, useMemo, useState } from "react";
import RecipeCard from "@/components/RecipeCard";

export default function HomePage() {
  const [selected, setSelected] = useState("All");
  const [recipeData, setRecipeData] = useState({ categories: [], recipes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recipes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRecipeData(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = ["All", ...recipeData.categories];

  const filtered = useMemo(() => {
    if (selected === "All") return recipeData.recipes;
    return recipeData.recipes.filter((r) => r.category === selected);
  }, [selected, recipeData]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-10">
        <p className="eyebrow mb-2 text-[11px]">Cook With Joe</p>
        <h1 className="heading-rule inline-block text-3xl font-medium text-ink sm:text-4xl">
          Cook along, hands-free.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-muted sm:text-base">
          Tap any step to jump straight to it, loop a tricky technique, or just
          say &ldquo;next step&rdquo; when your hands are covered in flour.
        </p>
      </div>

      <p className="eyebrow heading-rule mb-4 inline-block text-[11px]">Browse</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              selected === cat
                ? "bg-brand text-white"
                : "bg-white text-muted border border-ink/10 hover:border-brand/40 hover:text-ink"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Loading recipes…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted">No recipes in this category yet.</p>
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
