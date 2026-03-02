import { CATEGORIES, CATEGORY_ALIASES, type Category } from "../config/categories.js";

export function normalizeCategory(input: string | null): Category | null {
  if (!input) {
    return null;
  }

  const normalized = input.toLowerCase().trim();

  // Direct match with canonical categories (case-insensitive)
  const directMatch = CATEGORIES.find(
    (cat) => cat.toLowerCase() === normalized
  );
  if (directMatch) {
    return directMatch;
  }

  // Check aliases
  if (normalized in CATEGORY_ALIASES) {
    return CATEGORY_ALIASES[normalized];
  }

  // Fuzzy match: check if any alias is contained in the input
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return category;
    }
  }

  // Fuzzy match: check if any category name is contained in the input
  for (const category of CATEGORIES) {
    if (normalized.includes(category.toLowerCase())) {
      return category;
    }
  }

  return null;
}

export function getSuggestedCategories(): string {
  return CATEGORIES.slice(0, -1).join(", ");
}
