/**
 * Sanitization + light content moderation for community-publish inputs
 * (name, author_name, description).
 *
 * What this does:
 *  - Strips zero-width / bidi / C0 control characters that can be used to
 *    smuggle slurs past visual review or break the layout.
 *  - NFKC-normalises so fullwidth / mathematical / lookalike glyphs collapse
 *    to their ASCII forms before any matching.
 *  - Strips `<` `>` so no HTML markup ends up stored (React escapes on
 *    output, but defence-in-depth: keep the DB clean).
 *  - Collapses runs of whitespace.
 *  - Enforces per-field length caps.
 *  - Rejects strings containing entries from the slur/profanity denylist,
 *    matched against a leet-substituted + punctuation-stripped form so
 *    "n!gger" / "n.i.g.g.e.r" / fullwidth-glyph "ｎｉｇｇｅｒ" all hit.
 *
 * SQL injection is NOT handled here — it's already covered upstream by the
 * parameterised query usage in worker/src/designs.ts (no SQL is ever built
 * by string concatenation on these values).
 *
 * Limitations: a static denylist will always have false positives
 * (Scunthorpe problem) and false negatives (creative obfuscation). The list
 * is deliberately small + focused on slurs and unambiguous profanity. Tune
 * BANNED_WORDS below as needed.
 */

export const LIMITS = {
  name: 60,
  author: 40,
  description: 200,
} as const;

export type SanitizeResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export interface SanitizeOptions {
  maxLength: number;
  /** Allow newlines (textarea fields). Default false. */
  multiline?: boolean;
  /** If true, an empty result after sanitisation is allowed. Default false. */
  allowEmpty?: boolean;
}

// ---------------------------------------------------------------------------
// Denylist
// ---------------------------------------------------------------------------
// Slurs and clear profanity. Stored lowercase, alphanumerics only — matching
// happens after the same normalisation. Each base word becomes a regex that
// allows each letter to repeat (catches "niiiger", "ffuuck"). Substring
// matching is intentional — hostile content frequently wraps slurs in
// benign-looking padding. Scunthorpe-style false positives are accepted as
// the cost of doing business here; iterate the list if a real false positive
// surfaces.
const BANNED_WORDS = [
  // Racial / ethnic slurs (English-language).
  "nigger",
  "nigga",
  "chink",
  "gook",
  "kike",
  "spic",
  "wetback",
  "beaner",
  "raghead",
  "towelhead",
  "sandnigger",
  "coon",
  "jigaboo",
  "porchmonkey",
  "tarbaby",
  // Sexual-orientation / gender slurs.
  "faggot",
  "tranny",
  "dyke",
  // Sexist / misogynist.
  "cunt",
  "whore",
  // General profanity.
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dickhead",
  "motherfucker",
];

// ---------------------------------------------------------------------------
// Step 1: kill dangerous code points.
// ---------------------------------------------------------------------------
// Range refs:
//  U+0000..U+001F  ASCII C0 controls
//  U+007F          DEL
//  U+200B..U+200F  zero-width space / joiner / non-joiner / LTR / RTL marks
//  U+202A..U+202E  bidi formatting (LRE/RLE/PDF/LRO/RLO)
//  U+2060..U+206F  word-joiner, invisible operators, etc.
//  U+FEFF          BOM / zero-width no-break space
//
// Defined via `new RegExp` so the source file contains no literal control
// characters — those break editors, diffs, and grep.
const ZERO_WIDTH_AND_BIDI = new RegExp(
  "[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFEFF]",
  "g",
);
// Multiline: keep \n (U+000A) and \t (U+0009); strip the rest of C0 + DEL.
const C0_AND_DEL_KEEP_NEWLINE = new RegExp(
  "[\\u0000-\\u0008\\u000B-\\u001F\\u007F]",
  "g",
);
// Single-line: strip all C0 + DEL, including newline and tab.
const C0_AND_DEL_ALL = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function stripDangerousChars(s: string, multiline: boolean): string {
  let out = s.replace(ZERO_WIDTH_AND_BIDI, "");
  out = multiline
    ? out.replace(C0_AND_DEL_KEEP_NEWLINE, "")
    : out.replace(C0_AND_DEL_ALL, " ");
  return out;
}

// ---------------------------------------------------------------------------
// Step 2: collapse whitespace.
// ---------------------------------------------------------------------------
function collapseWhitespace(s: string, multiline: boolean): string {
  if (!multiline) return s.replace(/\s+/g, " ").trim();
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Step 3: profanity / slur detection.
// ---------------------------------------------------------------------------
// Leet table — only digits/punctuation that unambiguously stand in for a
// letter. Conservative on purpose; "1" is more often the digit one than an
// "l" / "i", so we only fold the common cases.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "+": "t",
};

function normaliseForMatch(s: string): string {
  const nfkc = s.normalize("NFKC").toLowerCase();
  let out = "";
  for (const ch of nfkc) {
    out += LEET[ch] ?? ch;
  }
  return out.replace(/[^a-z]/g, "");
}

function escapeRegex(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-compile patterns at module load: each base word gets `c+` per char so
// repeated-letter obfuscation matches.
const BANNED_PATTERNS: RegExp[] = BANNED_WORDS.map((w) => {
  const pattern = w
    .split("")
    .map((c) => `${escapeRegex(c)}+`)
    .join("");
  return new RegExp(pattern);
});

function containsBannedWord(value: string): boolean {
  const haystack = normaliseForMatch(value);
  if (!haystack) return false;
  return BANNED_PATTERNS.some((re) => re.test(haystack));
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------
export function sanitizePublishField(
  raw: string,
  opts: SanitizeOptions,
): SanitizeResult {
  let v = raw.normalize("NFKC");
  v = stripDangerousChars(v, opts.multiline ?? false);
  v = v.replace(/[<>]/g, "");
  v = collapseWhitespace(v, opts.multiline ?? false);

  if (v.length === 0) {
    if (opts.allowEmpty) return { ok: true, value: "" };
    return { ok: false, reason: "must not be empty" };
  }
  if (v.length > opts.maxLength) {
    v = v.slice(0, opts.maxLength).trim();
  }
  if (containsBannedWord(v)) {
    return {
      ok: false,
      reason: "contains language we don't allow on the community page",
    };
  }
  return { ok: true, value: v };
}
