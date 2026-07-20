import { head, put, BlobNotFoundError } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";

const BLOB_PATHNAME = "data/recipes.json";

function readLocalSeed() {
  const localPath = path.join(process.cwd(), "data", "recipes.json");
  return JSON.parse(fs.readFileSync(localPath, "utf8"));
}

export async function getRecipesData() {
  let blob;
  try {
    blob = await head(BLOB_PATHNAME);
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      const seed = readLocalSeed();
      await saveRecipesData(seed);
      return seed;
    }
    throw err;
  }

  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch recipes data from Blob: ${res.status}`);
  }
  return res.json();
}

export async function saveRecipesData(data) {
  await put(BLOB_PATHNAME, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return data;
}
