import WatchReadToggle from "@/components/WatchReadToggle";

export default function RecipeReadView({ recipe, onWatch }) {
  const chronologicalSteps = [...recipe.steps].sort((a, b) => a.start - b.start);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-[11px]">{recipe.category}</p>
          <h1 className="text-2xl font-medium text-ink">{recipe.title}</h1>
        </div>
        <WatchReadToggle mode="read" onWatch={onWatch} onRead={() => {}} />
      </div>

      {recipe.intro && (
        <p className="mb-6 text-sm leading-relaxed text-muted">{recipe.intro}</p>
      )}

      {recipe.ingredients?.length > 0 && (
        <div className="mb-6">
          <h2 className="eyebrow heading-rule mb-3 inline-block text-[11px]">
            Ingredients
          </h2>
          <ul className="space-y-1.5 text-sm text-ink">
            {recipe.ingredients.map((ingredient, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand" aria-hidden="true">
                  •
                </span>
                {ingredient}
              </li>
            ))}
          </ul>
        </div>
      )}

      {chronologicalSteps.length > 0 && (
        <div className="mb-6">
          <h2 className="eyebrow heading-rule mb-3 inline-block text-[11px]">
            Directions
          </h2>
          <ol className="space-y-3 text-sm text-ink">
            {chronologicalSteps.map((step, i) => (
              <li key={step.id} className="flex gap-3">
                <span className="shrink-0 font-medium text-brand">{i + 1}.</span>
                <span>{step.direction || step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {recipe.tips?.length > 0 && (
        <div className="mb-2">
          <h2 className="eyebrow heading-rule mb-3 inline-block text-[11px]">
            Tips
          </h2>
          <ul className="space-y-1.5 text-sm text-muted">
            {recipe.tips.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand" aria-hidden="true">
                  ✓
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
