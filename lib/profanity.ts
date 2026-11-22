/**
 * Küfür / hakaret filtresi.
 *
 * Mesaj, ilan, değerlendirme gibi metinlerde uygunsuz kelimeler ENGELLENMEZ;
 * ilk harfi kalacak şekilde (ör. "y*****") SANSÜRLENİR.
 * Kullanıcı adı gibi sansürlenemeyecek alanlarda `hasProfanity` ile reddedilir.
 */

export const PROFANITY_MESSAGE = "Bu metin uygun değil. Lütfen düzelterek tekrar dene.";

/** Normalize edilmiş (küçük harf, Türkçe karakterler sadeleşmiş) tam kelimeler */
const BAD_WORDS = [
  // --- kısa / kısaltmalar ---
  "amk", "amq", "aq", "mk", "mq", "oc", "occo", "ooc", "sik", "s1k", "bok", "pic", "pit",
  // --- am / amcık ailesi ---
  "amcik", "amciklar", "amcigi", "amcigim", "amcig", "amcikli", "amciktan", "amcikkafa",
  "amciklandin", "amck", "amcklar", "amjik", "amjk", "amik", "amcuk", "amcikoglu",
  "amina", "aminakoyim", "aminakoyayim", "aminakoyarim", "aminakoyum", "aminakoy",
  "aminasokayim", "aminasikim", "aminasokim", "aminizi", "aminiz", "aminoglu",
  "amini", "aminisikeyim", "aminisikim", "aminisikerim", "aminisikiyim",
  "anan", "anani", "ananin", "ananisikeyim", "ananisikim", "ananisikerim",
  "ananisikiyim", "ananizi", "ananizin", "ananiz", "ananiyim", "anansikim",
  "avradini", "avradin", "avradinisikeyim", "avrat", "avradini",
  // --- sik ailesi ---
  "sikeyim", "sikerim", "sikiyim", "sikim", "sikimde", "sikimden", "sikime",
  "sikimi", "sikimin", "sikimle", "sikimtrak", "sikik", "siktir", "siktirgit",
  "siktirim", "siktirler", "siktirsin", "sikis", "sikisen", "sikisme", "sikismis",
  "sikmek", "sikmem", "sikti", "siktim", "siktigim", "siktigimin", "siktiin",
  "sikil", "sikilmis", "sikilsin", "sikiyorum", "sikiyom", "sikmis", "siksin",
  "siksinler", "sikle", "sikler", "sikleri", "sikli", "sikce", "sikcegim",
  "sikiyim", "sikyim", "sikerm", "sikerdim", "sikertmek", "sikilmie",
  "sicayim", "sicarim", "sicmak", "sictim", "sictigim", "sictim", "sicik",
  // --- yarrak ailesi ---
  "yarak", "yarrak", "yarrrak", "yarraaak", "yarragi", "yarragim", "yarragimi",
  "yarragin", "yarragina", "yarrag", "yarram", "yarrami", "yarramin", "yarraminbasi",
  "yarran", "yarrana", "yarr", "yrrk", "yrrak", "yaraq", "yaraksiz", "yarrakli",
  "dalyarak", "dalyarrak", "dalyarrag",
  // --- taşak ---
  "tasak", "tassak", "tasag", "tasagi", "tasaklar", "tasakli", "tasakli",
  "dasak", "dassak", "dasagi", "dasaklar", "dasakli",
  // --- göt ailesi ---
  "got", "gotu", "gotun", "gotune", "gotunu", "gotunden", "gotundeki", "gotveren",
  "gotlek", "gotlalesi", "gotelek", "gotos", "godos", "gotlalesi", "gotune",
  // --- orospu ailesi ---
  "orospu", "oruspu", "orosbu", "orospuluk", "orospucocugu", "orospucocuk",
  "orospunun", "orospular", "orospuya", "orospuu", "orospuuu", "orosb", "orosbi",
  "orsp", "orspu", "orspcocugu", "orosp", "orrospu", "orusbu", "orrospu",
  // --- pezevenk ---
  "pezevenk", "pezeveng", "pezevengi", "pezevenkler", "pezo", "pzvnk", "pzvng",
  "pezevek", "pezeven",
  // --- gavat ---
  "gavat", "gavatlar", "gavatlik", "gavatoglu", "gavatlar1", "kavat", "kavt",
  "qavat", "gavad", "g4vat",
  // --- kahpe / kaltak / kancık ---
  "kahpe", "kahbe", "kahpeler", "kahpeoglu", "kaltak", "kaltaklar", "kaltaklik",
  "kancik", "kanciklar", "kancigin", "kaltak1",
  // --- sürtük / fahişe ---
  "surtuk", "surtukler", "surtukluk", "fahise", "fahiseler", "fahiselik",
  // --- ibne / puşt ---
  "ibne", "ibneler", "ibnelik", "ibneoglu", "ipne", "ipneler", "pust", "pustlar",
  "pustun", "pustluk", "pusttur", "pustt",
  // --- yavşak / şerefsiz ---
  "yavsak", "yavsaklar", "yavsaklik", "yavsak1", "yavs", "yavsakca",
  "serefsiz", "serefsz", "serefsizler", "serefsizlik", "srfz", "srfsz",
  "haysiyetsiz", "haysiyetsizler", "namussuz", "namussuzlar", "iffetsiz",
  // --- hakaretler ---
  "gerizekali", "gerizekalilar", "gerizekaliyim", "gerzek", "gerzekler",
  "aptal", "aptallar", "aptalca", "salak", "salaklar", "salaklik", "dangalak",
  "dangalaklar", "angut", "angutlar", "embesil", "embesiller", "ahmak", "budala",
  "ezik", "ezikler", "beyinsiz", "beyinsizler", "kafasiz", "dusuncesiz",
  "deyyus", "dürzü", "durzu", "hokkabaz", "sarlatan", "sahtekar", "sahtekarlar",
  "kalleş", "kalles", "dönek", "donek", "karaktersiz", "şerefsiz",
  // --- cinsel / müstehcen ---
  "sakso", "saksofon", "otuzbir", "osbir", "masturbasyon", "mastürbasyon",
  "porno", "porn", "pornografi", "seks", "sex", "sikis", "sikismek", "dildo",
  "escort", "eskort", "travesti", "jigolo", "vajina", "penis", "orgazm",
  "bosalmak", "azdirici", "azgin", "azginlar",
  // --- ek varyantlar ---
  "sikecem", "sikecegim", "sikecez", "sikicek", "sikebilir", "siktigimiz",
  "sicacam", "sicagim", "sicayim", "sicarim", "sictim", "sicmak", "sictigim",
  "osuruk", "osuruklar", "oskurdun", "yirtik", "yirtiklar",
  "koduğum", "kodugum", "koduğumun", "kodugumun", "koduğmun", "kodumun",
  "kevase", "kevaşe", "kevaseler", "kaltağ", "kaltag", "kaltaklar",
  "hirt", "hirtlar", "alcak", "alcaklar",
  "godos", "godoş", "godoşlar", "pezvenk", "pzvenk", "pzvnc",
  "gavatcocugu", "gavatlık", "kahpelik", "ibnelikler", "pustluklar",
  "amcikli", "amciksiz", "aminakoyimlar", "ananisikm", "ananiskm",
  "sikikler", "siktirler", "siktirsinler", "sikeyimler",
  "hassiktir", "hasiktir", "hasiktirgit", "hassiktirgit", "hastir", "hsktr",
  "sktir", "sktr", "sktirgit", "sktrgit", "siktirgit",
  // --- İngilizce ---
  "fuck", "fucking", "fucker", "fuckers", "motherfucker", "motherfucking",
  "shit", "shitty", "bullshit", "bitch", "bitches", "asshole", "assholes",
  "bastard", "bastards", "whore", "whores", "slut", "sluts", "pussy", "dick",
  "dickhead", "cunt", "cock", "suckmydick", "blowjob", "handjob", "nigger",
  "niggers", "nigga", "faggot", "fag", "retard", "retarded", "wanker",
  "bollocks", "prick", "douche", "douchebag", "twat", "skank",
];

/**
 * Kelime başlangıcı eşleşmesi yapılan kökler.
 * Türkçede ekler kelimenin sonuna geldiği için bu köklerle başlayan kelimeler de sansürlenir.
 * (Kısa/sıradan kelimelerle çakışabilecek kökler burada YOK.)
 */
const BAD_PREFIXES = [
  "siktir", "sikeyim", "sikerim", "sikiyim", "sikik", "sikim", "sikis",
  "orospu", "orospu", "orosp", "orospul", "orospuc",
  "yarrak", "yarrag", "yarra", "yarak",
  "pezevenk", "pezeveng", "gavat", "kahpe", "kahbe",
  "kaltak", "kancik", "surtuk", "fahise",
  "yavsak", "serefsiz", "haysiyetsiz", "namussuz", "gerizekali",
  "amcik", "aminakoy", "gotveren", "ibne", "pust", "dalyarak",
  "tassak", "tasak", "boktan", "siktirgit", "siker", "sike",
  "salak", "aptal", "dangalak", "angut", "embesil", "ahmak", "budala",
];

/** Yalnızca tam kelime olarak eşleşen kısa/riskli kökler */
const EXACT_ONLY = new Set([
  "amk", "amq", "aq", "mk", "mq", "oc", "sik", "bok", "pic", "got", "fag",
  "sex", "yrr", "yarak", "tasak", "gavat", "ibne", "pust", "aptal",
]);

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
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function collapseRepeats(value: string): string {
  return value.replace(/(.)\1+/g, "$1");
}

/** Sadece masum anlamıyla kullanılan, sansürlenmemesi gereken kelimeler */
const SAFE_RAW = new Set([
  "sık", "sikke", "siklet", "siklon", "siklamen", "bokser", "gotik",
  "amazon", "amsterdam", "ocak", "ocakta", "pikap", "pikachu", "picasso",
]);

function isBadToken(raw: string): boolean {
  if (!raw) return false;
  if (SAFE_RAW.has(raw.toLocaleLowerCase("tr"))) return false;

  const flat = normalize(raw);
  if (flat.length < 2) return false;
  const squeezed = collapseRepeats(flat);

  // Tam kelime eşleşmesi (tekrar eden harfler kısaltılmış hâliyle de)
  if (BAD_WORDS.includes(flat) || BAD_WORDS.includes(squeezed)) return true;

  // Kök eşleşmesi: yalnızca normal hâl üzerinden (kısaltılmış hâl yanlış yakalayabilir)
  for (const prefix of BAD_PREFIXES) {
    if (EXACT_ONLY.has(prefix)) continue;
    if (flat.startsWith(prefix)) return true;
  }

  return false;
}

const TOKEN_PATTERN = /[\p{L}\p{N}@$!*._-]+/gu;

/** Kelimenin ilk harfini bırakıp gerisini yıldızlar */
function maskWord(word: string): string {
  const letters = Array.from(word);
  if (letters.length <= 1) return "*";
  return letters[0] + "*".repeat(letters.length - 1);
}

/** Harfleri araya boşluk/nokta koyarak yazılan küfürler ("a m k", "s.i.k.t.i.r" gibi) */
function maskSpacedLetters(text: string): string {
  const runPattern =
    /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}][\s._*·\-]{0,3}){1,}[\p{L}\p{N}](?![\p{L}\p{N}])/gu;

  return text.replace(runPattern, (match) => {
    const letters = match.replace(/[^\p{L}\p{N}]/gu, "");
    if (letters.length < 3) return match;

    const tokens = match.split(/[\s._*·\-]+/).filter(Boolean);
    // Sadece harf harf yazılmışsa (her parça tek karakter) kontrol et
    if (tokens.length !== letters.length) return match;
    if (!isBadToken(letters)) return match;

    return maskWord(match);
  });
}

/** Metindeki uygunsuz kelimeleri sansürler. */
export function censorProfanity(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const withSpaced = maskSpacedLetters(text);
  return withSpaced.replace(TOKEN_PATTERN, (word) => {
    const core = word.replace(/^[._-]+|[._-]+$/g, "");
    if (!isBadToken(core)) return word;
    return maskWord(core);
  });
}

/** Metinde sansürlenecek ifade var mı? (kullanıcı adı gibi alanlar için) */
export function hasProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  return censorProfanity(text) !== text;
}
