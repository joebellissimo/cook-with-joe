import { notFound } from "next/navigation";
import Link from "next/link";
import { getRecipeBySlug } from "@/lib/recipes";
import RecipePlayer from "@/components/RecipePlayer";

// Recipes are published live via Blob storage and can change at any time,
// so slugs aren't known at build time — every request renders on demand
// instead of pre-rendering a fixed set of slugs.

export default async function RecipePage({ params }) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) notFound();

  if (!recipe.video) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">
          {recipe.title}
        </h1>
        <p className="mt-2 text-muted">
          This recipe doesn&apos;t have a video yet.{" "}
          <Link
            href={`/admin/edit/${recipe.slug}`}
            className="text-brand underline"
          >
            Add one
          </Link>{" "}
          to activate it.
        </p>
      </div>
    );
  }

  return <RecipePlayer recipe={recipe} />;
}
