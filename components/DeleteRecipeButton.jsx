"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteRecipeButton({ slug, title }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState("idle"); // idle | deleting | error
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    setDeleteState("deleting");
    setDeleteError("");

    try {
      const res = await fetch("/api/admin/recipes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Delete failed (${res.status})`);
      }

      router.push("/");
    } catch (err) {
      setDeleteState("error");
      setDeleteError(err.message || "Something went wrong while deleting.");
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete recipe
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-medium text-ink">Delete this recipe?</h2>
            <p className="mt-2 text-sm text-muted">
              &ldquo;{title}&rdquo; will be permanently removed, along with its
              video and thumbnail if any were uploaded. This can&apos;t be
              undone.
            </p>
            {deleteState === "error" && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleteState === "deleting"}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-muted hover:border-brand/40 hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteState === "deleting"}
                className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteState === "deleting" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
