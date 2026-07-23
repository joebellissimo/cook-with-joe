// Best-effort shortening of a full ingredient line (as the publisher wrote
// it, e.g. "1/2 cup of finely chopped fresh mint") down to just the core
// ingredient name ("Fresh Mint"), for display on the "need to get" list.
// Not guaranteed correct on every phrasing — see the fallback at the end.

const NUMBER_TOKEN = /^(?:\d+[\d/.\-–]*|[¼½¾⅓⅔⅛⅜⅝⅞]|a|an)$/i;

const SIZE_WORDS = new Set(["small", "medium", "large", "extra-large", "extra"]);

const UNIT_WORDS = new Set([
  "cup", "cups", "tsp", "tsps", "teaspoon", "teaspoons", "tbsp", "tbsps",
  "tablespoon", "tablespoons", "clove", "cloves", "pinch", "pinches",
  "dash", "dashes", "can", "cans", "jar", "jars", "package", "packages",
  "pkg", "pkgs", "slice", "slices", "piece", "pieces", "sprig", "sprigs",
  "stalk", "stalks", "head", "heads", "bunch", "bunches", "lb", "lbs",
  "pound", "pounds", "oz", "ounce", "ounces", "g", "gram", "grams",
  "kg", "ml", "l", "liter", "liters", "quart", "quarts", "qt", "qts",
  "pint", "pints", "pt", "pts", "handful", "handfuls",
]);

// Deliberately conservative — only prep-method words, not descriptive
// adjectives (e.g. "fresh," "ground," "ripe" stay, since those are often
// part of the actual product name, not an instruction on a raw ingredient).
const PREP_WORDS = new Set([
  "chopped", "diced", "minced", "sliced", "grated", "shredded", "crushed",
  "peeled", "finely", "coarsely", "roughly", "thinly", "julienned",
  "cubed", "quartered", "halved",
]);

// Lowercased when NOT the first word, for conventional title casing
// ("Salt and Pepper to Taste" rather than "Salt And Pepper To Taste").
const MINOR_WORDS = new Set([
  "and", "or", "to", "of", "the", "a", "an", "in", "for", "with", "on",
]);

function stripTrailingPunctuation(word) {
  return word.replace(/[.,]$/, "");
}

function titleCase(text) {
  return text
    .split(" ")
    .map((w, index) => {
      if (!w.length) return w;
      const lower = w.toLowerCase();
      if (index !== 0 && MINOR_WORDS.has(lower)) return lower;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function shortenIngredientText(raw) {
  const original = (raw ?? "").trim();
  if (!original) return original;

  // Comma-separated prep notes ("garlic, minced" / "onion, finely diced")
  // are almost always trailing instructions, not part of the name itself.
  const beforeComma = original.split(",")[0];

  // Parenthetical asides ("1 (14.5 oz) can diced tomatoes") are almost
  // always measurement clarifications, not part of the name either.
  const withoutParens = beforeComma.replace(/\([^)]*\)/g, " ");

  let words = withoutParens.trim().split(/\s+/).filter(Boolean);

  // Consume leading number/size/unit/"of" tokens, in that rough order, as
  // long as they keep matching — handles "1/2 cup of", "2 cloves",
  // "3 large", "a pinch of," etc.
  let i = 0;
  while (i < words.length && NUMBER_TOKEN.test(stripTrailingPunctuation(words[i]))) i++;
  while (i < words.length && SIZE_WORDS.has(stripTrailingPunctuation(words[i]).toLowerCase())) i++;
  while (i < words.length && UNIT_WORDS.has(stripTrailingPunctuation(words[i]).toLowerCase())) i++;
  if (i < words.length && stripTrailingPunctuation(words[i]).toLowerCase() === "of") i++;
  words = words.slice(i);

  // Drop known prep-instruction words wherever they appear (leading
  // adjectives like "finely chopped fresh mint," not just trailing).
  words = words.filter((w) => !PREP_WORDS.has(stripTrailingPunctuation(w).toLowerCase()));

  const core = words.join(" ").trim();

  // Best-effort only — if stripping left nothing usable (empty, or just
  // stray punctuation/numbers), fall back to the original full text
  // rather than showing something empty or garbled.
  if (!core || !/[a-zA-Z]/.test(core)) return original;

  return titleCase(core);
}
