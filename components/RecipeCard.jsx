import Link from "next/link";

export default function RecipeCard({ recipe }) {
  const isActive = Boolean(recipe.video);

  const innerContent = (
    <div
      className={`h-full rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition ${
        isActive ? "hover:shadow-md hover:border-brand/40" : "opacity-60"
      }`}
    >
      <div className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-cream text-3xl">
        {recipe.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- plain <img>, no next/image config for Blob's dynamic subdomain
          <img
            src={recipe.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className={recipe.thumbnail ? "relative text-white drop-shadow" : "relative"}>
          {isActive ? "▶" : "🔒"}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{recipe.title}</h3>
        {recipe.premium && (
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            Premium
          </span>
        )}
      </div>
      <p className="eyebrow mt-1 text-[11px]">
        {recipe.category}
      </p>
      <p className="mt-2 text-sm text-muted">
        {isActive
          ? `${recipe.steps.length} step${recipe.steps.length === 1 ? "" : "s"}`
          : recipe.description}
      </p>
    </div>
  );

  // The edit link itself is visible to anyone browsing the home page, but
  // /admin/:path* is gated by Basic Auth (see proxy.js), so following it
  // prompts for credentials before anything editable loads.
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
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm shadow opacity-0 transition group-hover:opacity-100 hover:bg-brand/10"
      >
        ✏️
      </Link>
    </div>
  );
}
