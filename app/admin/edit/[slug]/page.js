import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/lib/recipes";
import ChapterEditor from "@/components/ChapterEditor";

export default async function EditRecipePage({ params }) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">
        Edit chapters — {recipe.title}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Existing step data has been loaded below. Reload the source video
        file to scrub and fine-tune timestamps, then click{" "}
        <strong>Publish to site</strong> to save your changes live.
      </p>
      <div className="mt-6">
        <ChapterEditor initialRecipe={recipe} />
      </div>
    </div>
  );
}
