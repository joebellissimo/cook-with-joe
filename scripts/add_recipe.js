#!/usr/bin/env node
/**
 * Merge a single recipe JSON file (exported from the chapter editor at
 * /admin/upload or /admin/edit/[slug]) into data/recipes.json.
 *
 * Usage:
 *   node scripts/add_recipe.js ~/Downloads/my-recipe.json
 *
 * - If a recipe with the same slug already exists, it's replaced (so you
 *   can re-run this after fixing up a recipe in the editor).
 * - If the recipe's category isn't already in the top-level categories
 *   list, it's added so it shows up as a filter chip on the home page.
 * - Writes data/recipes.json back out with the same 2-space formatting.
 */

const fs = require("fs");
const path = require("path");

const RECIPES_PATH = path.join(__dirname, "..", "data", "recipes.json");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const inputArg = process.argv[2];
if (!inputArg) {
  fail(
    "Usage: node scripts/add_recipe.js path/to/recipe.json\n" +
      "  (this is the file 'Download JSON' saves in the chapter editor)"
  );
}

const inputPath = path.resolve(
  inputArg.replace(/^~(?=$|\/|\\)/, process.env.HOME || "")
);

if (!fs.existsSync(inputPath)) {
  fail(`Couldn't find that file: ${inputPath}`);
}

let recipe;
try {
  recipe = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (e) {
  fail(`That file isn't valid JSON: ${e.message}`);
}

if (!recipe.slug || !recipe.title) {
  fail("The recipe JSON needs at least a 'slug' and 'title' field.");
}
if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
  console.warn(
    "⚠ This recipe has no steps yet — it'll be added, but the player won't have any chapters to show until you add some."
  );
}

let db;
try {
  db = JSON.parse(fs.readFileSync(RECIPES_PATH, "utf8"));
} catch (e) {
  fail(`Couldn't read data/recipes.json: ${e.message}`);
}

const existingIndex = db.recipes.findIndex((r) => r.slug === recipe.slug);
if (existingIndex >= 0) {
  db.recipes[existingIndex] = recipe;
  console.log(`Updated existing recipe "${recipe.slug}".`);
} else {
  db.recipes.push(recipe);
  console.log(`Added new recipe "${recipe.slug}".`);
}

if (recipe.category && !db.categories.includes(recipe.category)) {
  db.categories.push(recipe.category);
  console.log(`Added new category "${recipe.category}" to the filter bar.`);
}

fs.writeFileSync(RECIPES_PATH, JSON.stringify(db, null, 2) + "\n");

console.log(
  `\n✓ data/recipes.json now has ${db.recipes.length} recipe(s).\n` +
    `Make sure the video file is in public/videos/ (path: ${recipe.video || "(none set)"}), ` +
    `then refresh the app — no restart needed.\n`
);
