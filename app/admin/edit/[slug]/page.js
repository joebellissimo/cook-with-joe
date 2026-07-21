import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/lib/recipes";
import ChapterEditor from "@/components/ChapterEditor";
import DeleteRecipeButton from "@/components/DeleteRecipeButton";

export default async function EditRecipePage({ params }) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Edit chapters — {recipe.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Existing step data and video have been loaded below — scrub and
            fine-tune timestamps, then click <strong>Publish to site</strong>{" "}
            to save your changes live.
          </p>
        </div>
        <DeleteRecipeButton slug={recipe.slug} title={recipe.title} />
      </div>
      <div className="mt-6">
        <ChapterEditor initialRecipe={recipe} />
      </div>
    </div>
  );
}
