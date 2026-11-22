/**
 * Basit küfür / hakaret filtresi.
 * Metin normalize edilir (küçük harf, Türkçe karakterler sadeleşir, leet rakamları
 * harfe çevrilir, tekrar eden harfler kısaltılır) ve kelime kökleriyle karşılaştırılır.
 */

export const PROFANITY_MESSAGE = "Uygunsuz ifade kullanılamaz. Lütfen yazdıklarını düzelt.";

/** Tam kelime olarak aranacak kökler */
const STEMS = [
  // Türkçe
  "amk",
  "amq",
  "aq",
  "amcik",
  "amina",
  "amini",
  "aminakoyim",
  "anani",
  "ananisikiyim",
  "orospu",
  "oruspu",
  "orospucocugu",
  "pezevenk",
  "gavat",
  "kaltak",
  "surtuk",
  "fahise",
  "ibne",
  "pust",
  "pic",
  "pici",
  "pictir",
  "kahpe",
  "kancik",
  "yavsak",
  "serefsiz",
  "haysiyetsiz",
  "namussuz",
  "gerizekali",
  "gotveren",
  "godos",
  "sik",
  "sikeyim",
  "sikerim",
  "sikiyim",
  "siktir",
  "sikik",
  "sikis",
  "yarrak",
  "yarak",
  "tasak",
  "dalyarak",
  "bok",
  "boktan",
  "sictim",
  "sicarim",
  "dangalak",
  "oc",
  // İngilizce (sık kullanılanlar)
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "whore",
  "slut",
  "pussy",
  "dickhead",
];

/** Kısa kökler (3 harf ve altı) yalnızca tam kelime olarak eşleşir */
const EXACT_ONLY = new Set(["amk", "amq", "aq", "oc", "pic", "pici", "sik", "bok"]);

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[âÂ]/g, "a")
    .replace(/[îÎ]/g, "i")
    .replace(/[ûÛ]/g, "u")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseRepeats(value: string): string {
  return value.replace(/(.)\1+/g, "$1");
}

function tokenMatches(token: string, stem: string): boolean {
  if (token === stem) return true;
  if (EXACT_ONLY.has(stem)) return false;
  if (stem.length >= 4 && token.startsWith(stem)) return true;
  return false;
}

export function hasProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  if (!normalized) return false;

  const tokens = normalized.split(" ");
  for (const token of tokens) {
    const plain = collapseRepeats(token);
    for (const stem of STEMS) {
      if (tokenMatches(token, stem) || tokenMatches(plain, stem)) return true;
    }
  }
  return false;
}

/** Uygunsuz ifade varsa gösterilecek mesajı, yoksa null döndürür */
export function profanityError(text: string | null | undefined): string | null {
  return hasProfanity(text) ? PROFANITY_MESSAGE : null;
}
