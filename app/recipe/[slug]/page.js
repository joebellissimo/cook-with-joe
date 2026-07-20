import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllRecipes, getRecipeBySlug } from "@/lib/recipes";
import RecipePlayer from "@/components/RecipePlayer";

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.slug }));
}

export default async function RecipePage({ params }) {
  const { slug } = await params;
  const recipe = getRecipeBySlug(slug);

  if (!recipe) notFound();

  if (!recipe.video) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          {recipe.title}
        </h1>
        <p className="mt-2 text-neutral-600">
          This recipe doesn&apos;t have a video yet.{" "}
          <Link
            href={`/admin/edit/${recipe.slug}`}
            className="text-orange-600 underline"
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
