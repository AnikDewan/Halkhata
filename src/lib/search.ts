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
  "ৎ": "t",
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

export function normalizeForSearch(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const transliterated = Array.from(value)
    .map((char) => bengaliDigits[char] ?? bengaliToLatin[char] ?? char)
    .join("");

  return transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function fuzzyIncludes(haystack: string, needle: string) {
  if (!needle) {
    return true;
  }
  let needleIndex = 0;
  for (const char of haystack) {
    if (char === needle[needleIndex]) {
      needleIndex += 1;
      if (needleIndex === needle.length) {
        return true;
      }
    }
  }
  return false;
}

export function matchesSearch(query: string, fields: (string | null | undefined)[]) {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) => {
    const normalizedField = normalizeForSearch(field);
    return (
      normalizedField.includes(normalizedQuery) ||
      fuzzyIncludes(normalizedField, normalizedQuery)
    );
  });
}
