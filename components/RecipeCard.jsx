import Link from "next/link";

export default function RecipeCard({ recipe }) {
  const isActive = Boolean(recipe.video);

  const innerContent = (
    <div
      className={`h-full rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition ${
        isActive ? "hover:shadow-md hover:border-orange-300" : "opacity-60"
      }`}
    >
      <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-neutral-100 text-3xl">
        {isActive ? "▶" : "🔒"}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-neutral-900">{recipe.title}</h3>
        {recipe.premium && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Premium
          </span>
        )}
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-orange-600">
        {recipe.category}
      </p>
      <p className="mt-2 text-sm text-neutral-600">
        {isActive
          ? `${recipe.steps.length} step${recipe.steps.length === 1 ? "" : "s"}`
          : recipe.description}
      </p>
    </div>
  );

  // Note: there's no login system yet, so this edit shortcut is visible to
  // anyone using the app, not just an "admin" — fine while it's just you
  // testing locally, but this should sit behind real auth before real
  // users see it.
  return (
    <div className="group relative h-full">
      {isActive ? (
        <Link href={`/recipe/${recipe.slug}`} className="block h-full">
          {innerContent}
        </Link>
      ) : (
        innerContent
      )}
      <Link
        href={`/admin/edit/${recipe.slug}`}
        title="Edit chapters"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm shadow opacity-0 transition group-hover:opacity-100 hover:bg-orange-100"
      >
        ✏️
      </Link>
    </div>
  );
}
