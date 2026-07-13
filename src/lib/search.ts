import fuzzysort from "fuzzysort";

/** Map common Bengali letters to Latin for phonetic matching (e.g. "রহিম" ↔ "rahim"). */
const bengaliToLatin: Record<string, string> = {
  অ: "o",
  আ: "a",
  ই: "i",
  ঈ: "i",
  উ: "u",
  ঊ: "u",
  ঋ: "ri",
  এ: "e",
  ঐ: "oi",
  ও: "o",
  ঔ: "ou",
  ক: "k",
  খ: "kh",
  গ: "g",
  ঘ: "gh",
  ঙ: "ng",
  চ: "ch",
  ছ: "chh",
  জ: "j",
  ঝ: "jh",
  ঞ: "n",
  ট: "t",
  ঠ: "th",
  ড: "d",
  ঢ: "dh",
  ণ: "n",
  ত: "t",
  থ: "th",
  দ: "d",
  ধ: "dh",
  ন: "n",
  প: "p",
  ফ: "ph",
  ব: "b",
  ভ: "bh",
  ম: "m",
  য: "y",
  র: "r",
  ল: "l",
  শ: "sh",
  ষ: "sh",
  স: "s",
  হ: "h",
  ড়: "r",
  ঢ়: "rh",
  য়: "y",
  ৎ: "t",
  "ং": "ng",
  "ঃ": "",
  "ঁ": "",
  "া": "a",
  "ি": "i",
  "ী": "i",
  "ু": "u",
  "ূ": "u",
  "ৃ": "ri",
  "ে": "e",
  "ৈ": "oi",
  "ো": "o",
  "ৌ": "ou",
  "্": "",
};

const bengaliDigits: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

/** Consonants that carry an inherent vowel when not followed by a vowel sign. */
const BENGALI_CONSONANTS = new Set([
  "ক",
  "খ",
  "গ",
  "ঘ",
  "ঙ",
  "চ",
  "ছ",
  "জ",
  "ঝ",
  "ঞ",
  "ট",
  "ঠ",
  "ড",
  "ঢ",
  "ণ",
  "ত",
  "থ",
  "দ",
  "ধ",
  "ন",
  "প",
  "ফ",
  "ব",
  "ভ",
  "ম",
  "য",
  "র",
  "ল",
  "শ",
  "ষ",
  "স",
  "হ",
  "ড়",
  "ঢ়",
  "য়",
  "ৎ",
]);

/** Dependent vowel signs that replace a consonant's inherent vowel. */
const BENGALI_VOWEL_SIGNS = new Set([
  "া",
  "ি",
  "ী",
  "ু",
  "ূ",
  "ৃ",
  "ে",
  "ৈ",
  "ো",
  "ৌ",
]);

/**
 * Transliterate Bengali script to Latin, inserting inherent vowels so
 * "রহিম" becomes "rahim" (not "rhim") and Latin queries match phonetically.
 */
function transliterateBengaliToLatin(value: string): string {
  const chars = [...value];
  let out = "";

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === "্") continue;

    const latin = bengaliDigits[char] ?? bengaliToLatin[char];
    if (latin === undefined) {
      out += char;
      continue;
    }
    if (latin === "") continue;

    out += latin;

    if (!BENGALI_CONSONANTS.has(char)) continue;

    const next = chars[i + 1];
    if (!next || next === "্" || BENGALI_VOWEL_SIGNS.has(next)) continue;
    if (BENGALI_CONSONANTS.has(next)) out += "a";
  }

  return out;
}

/**
 * Transliterate Bengali script + digits to a Latin/ASCII form for search.
 * Keeps English letters/digits; strips other punctuation.
 */
export function normalizeForSearch(value: string | null | undefined): string {
  if (!value) return "";

  return transliterateBengaliToLatin(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Case-fold and collapse whitespace without dropping Bengali characters. */
function prepareRaw(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Fold romanized text into a canonical phonetic key so alternate spellings
 * (rohim/rahim, shamim/samim, babul/vabul, sumon/suman, etc.) match.
 */
function phoneticKey(value: string): string {
  let s = value.toLowerCase();

  s = s
    .replace(/sch/g, "s")
    .replace(/sh/g, "s")
    .replace(/ph/g, "f")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/bh/g, "b")
    .replace(/dh/g, "d")
    .replace(/th/g, "t")
    .replace(/ch/g, "c")
    .replace(/ng/g, "n")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u");

  s = s.replace(/[ao]/g, "a").replace(/[eiy]/g, "i").replace(/[uw]/g, "u");

  s = s.replace(/[zfvq]/g, (char) => {
    if (char === "z") return "j";
    if (char === "v" || char === "f") return "b";
    return "k";
  });

  return s.replace(/(.)\1+/g, "$1");
}

/** Vowel-stripped phonetic form for very loose matching (e.g. "rhm" → রহিম). */
function consonantSkeleton(value: string): string {
  return phoneticKey(value)
    .replace(/[aeiouh]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function fuzzyMatches(query: string, targets: string[]): boolean {
  if (!query || targets.length === 0) return false;
  return (
    fuzzysort.go(query, prepareTargets(targets), { threshold: -10000 }).length >
    0
  );
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function prepareTargets(targets: string[]): Fuzzysort.Prepared[] {
  return targets.map((target) => fuzzysort.prepare(target));
}

function matchesPhoneticLatin(
  normalizedQuery: string,
  normalizedTargets: string[],
): boolean {
  const phoneticQuery = phoneticKey(normalizedQuery);
  const phoneticTargets = uniqueNonEmpty(
    normalizedTargets.map((target) => phoneticKey(target)),
  );
  if (fuzzyMatches(phoneticQuery, phoneticTargets)) return true;

  const skeletonQuery = consonantSkeleton(normalizedQuery);
  if (skeletonQuery.length < 2) return false;

  const skeletonTargets = uniqueNonEmpty(
    normalizedTargets.map((target) => consonantSkeleton(target)),
  );
  return fuzzyMatches(skeletonQuery, skeletonTargets);
}

function fieldTargets(field: string | null | undefined): {
  raw: string;
  normalized: string;
} {
  return {
    raw: prepareRaw(field),
    normalized: normalizeForSearch(field),
  };
}

/**
 * Fuzzy-match a search query against one or more text fields (name, phone, etc.).
 * Supports Bengali via transliteration + fuzzysort on both original and normalized forms.
 */
export function matchesSearch(
  query: string,
  fields: (string | null | undefined)[],
): boolean {
  const rawQuery = prepareRaw(query);
  const normalizedQuery = normalizeForSearch(query);
  if (!rawQuery && !normalizedQuery) return true;

  const rawTargets: string[] = [];
  const normalizedTargets: string[] = [];
  for (const field of fields) {
    const { raw, normalized } = fieldTargets(field);
    if (raw) rawTargets.push(raw);
    if (normalized) normalizedTargets.push(normalized);
  }
  if (rawTargets.length === 0 && normalizedTargets.length === 0) return false;

  // Original script (Bengali→Bengali, English→English).
  if (
    rawQuery &&
    rawTargets.length > 0 &&
    fuzzysort.go(rawQuery, prepareTargets(rawTargets), { threshold: -10000 })
      .length > 0
  ) {
    return true;
  }

  // Phonetic Latin (rohim/rahim, samim/shamim, rhm/রহিম, etc.).
  if (
    normalizedQuery &&
    normalizedTargets.length > 0 &&
    matchesPhoneticLatin(normalizedQuery, normalizedTargets)
  ) {
    return true;
  }

  return false;
}

/**
 * Rank items by fuzzy score (Bengali-aware). Empty query → original order.
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  keys: (item: T) => (string | null | undefined)[],
): T[] {
  const rawQuery = prepareRaw(query);
  const normalizedQuery = normalizeForSearch(query);
  if (!rawQuery && !normalizedQuery) return items;

  const prepared = items.map((item) => {
    const rawParts: string[] = [];
    const normalizedParts: string[] = [];
    for (const field of keys(item)) {
      const { raw, normalized } = fieldTargets(field);
      if (raw) rawParts.push(raw);
      if (normalized) normalizedParts.push(normalized);
    }
    return {
      item,
      rawHaystack: fuzzysort.prepare(rawParts.join(" ")),
      phoneticHaystack: fuzzysort.prepare(
        normalizedParts.map((part) => phoneticKey(part)).join(" "),
      ),
      skeletonHaystack: fuzzysort.prepare(
        normalizedParts.map((part) => consonantSkeleton(part)).join(" "),
      ),
    };
  });

  const seen = new Set<T>();
  const ranked: T[] = [];

  const pushResults = (
    q: string,
    haystackKey: "rawHaystack" | "phoneticHaystack" | "skeletonHaystack",
  ) => {
    if (!q) return;
    const results = fuzzysort.go(q, prepared, {
      key: haystackKey,
      threshold: -10000,
    });
    for (const r of results) {
      if (!seen.has(r.obj.item)) {
        seen.add(r.obj.item);
        ranked.push(r.obj.item);
      }
    }
  };

  pushResults(rawQuery, "rawHaystack");
  pushResults(phoneticKey(normalizedQuery), "phoneticHaystack");

  const skeletonQuery = consonantSkeleton(normalizedQuery);
  if (skeletonQuery.length >= 2) {
    pushResults(skeletonQuery, "skeletonHaystack");
  }

  return ranked;
}
