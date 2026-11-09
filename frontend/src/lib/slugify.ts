/** "Cakes & Bakery!" → "cakes-bakery". Matches the backend's slug rule. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD') // split accents from letters: "é" → "e" + accent
    .replace(/[̀-ͯ]/g, '') // drop the accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // anything else becomes a hyphen
    .replace(/^-+|-+$/g, '') // no hyphens at the start or end
}
