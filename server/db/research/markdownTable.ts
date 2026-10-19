/**
 * Reads the markdown tables in docs/research.
 *
 * The research corpus is prose with tables, not a dataset, so this is
 * deliberately strict: it returns rows keyed by their header text, and refuses
 * a table whose row width does not match its header rather than silently
 * shifting every column by one.
 */

export interface ParsedTable {
  headers: string[];
  rows: Array<Record<string, string>>;
  /** 1-based line where the header row was found, for error messages. */
  line: number;
}

const isSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
const isRow = (line: string) => line.trim().startsWith('|');

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  // Cells never contain an escaped pipe anywhere in this corpus; if that
  // changes this is the place that has to learn about it.
  return trimmed.split('|').map(c => c.trim());
}

/** Strips the markdown a cell may carry: bold, code ticks, links. */
export function cleanCell(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .trim();
}

export function parseTables(markdown: string): ParsedTable[] {
  const lines = markdown.split('\n');
  const tables: ParsedTable[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    if (!isRow(lines[i]) || !isSeparator(lines[i + 1])) continue;

    const headers = splitRow(lines[i]).map(cleanCell);
    const rows: Array<Record<string, string>> = [];
    let j = i + 2;

    for (; j < lines.length && isRow(lines[j]) && !isSeparator(lines[j]); j++) {
      const cells = splitRow(lines[j]).map(cleanCell);
      // A width mismatch means the table is malformed or a cell contains a
      // pipe. Either way, mapping it onto the headers would produce plausible
      // nonsense, so skip the row and let the caller's report show the gap.
      if (cells.length !== headers.length) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, k) => (row[h] = cells[k]));
      rows.push(row);
    }

    if (rows.length) tables.push({ headers, rows, line: i + 1 });
    i = j - 1;
  }

  return tables;
}

/** Finds the first table containing all of the given header fragments. */
export function findTable(tables: ParsedTable[], ...required: string[]): ParsedTable | null {
  const wanted = required.map(r => r.toLowerCase());
  return (
    tables.find(t => {
      const headers = t.headers.map(h => h.toLowerCase());
      return wanted.every(w => headers.some(h => h.includes(w)));
    }) || null
  );
}

/** Reads a cell by a case-insensitive, partial header match. */
export function cell(row: Record<string, string>, ...fragments: string[]): string {
  for (const fragment of fragments) {
    const key = Object.keys(row).find(k => k.toLowerCase().includes(fragment.toLowerCase()));
    if (key && row[key]) return row[key];
  }
  return '';
}

/**
 * Normalises a name for matching across the two vocabularies.
 *
 * The research documents and the seeded database name the same places
 * differently — "Eel Garden (Ras El-Kora)" against "Eel Garden Marine Reserve",
 * "Ali Baba Restaurant" against "Ali Baba Waterfront Seafood". Matching strips
 * punctuation, parenthetical asides and the generic nouns that only one side
 * uses, so the comparison is on the distinctive words.
 */
const NOISE = new Set([
  'the', 'and', 'of', 'at', 'in', 'a',
  'restaurant', 'cafe', 'bakery', 'kitchen', 'grill', 'bistro', 'trattoria',
  'bay', 'reef', 'beach', 'zone', 'area', 'strip', 'waterfront', 'promenade',
  'marine', 'reserve', 'protected', 'national', 'park', 'sanctuary', 'wilderness',
  'guided', 'session', 'tour', 'trip', 'experience', 'dahab', 'seafront'
]);

export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !NOISE.has(w))
    .sort()
    .join(' ');
}

export function nameTokens(value: string): string[] {
  return normaliseName(value).split(' ').filter(Boolean);
}

export interface NameMatch<T> {
  candidate: T;
  score: number;
}

/**
 * Matches a research name against existing records by token containment.
 *
 * Exact normalised equality is not enough, because the two vocabularies
 * describe the same thing at different lengths: "Ali Baba Restaurant" against
 * "Ali Baba Waterfront Seafood", "Lighthouse Bay & Reef" against "Lighthouse
 * Coral Bay". One side's distinctive tokens are a subset of the other's.
 *
 * **Only full token containment counts as a match.** Partial overlap was tried
 * and produced a silent corruption: "Guided Try Scuba Dive (First-Timer)" and
 * "The Canyon Scuba Adventure" share {scuba, dive}, which was enough to clear a
 * two-token bar — so a beginner try-dive would have been enriched with the
 * pricing and skill level of an advanced 52 m chasm dive. In this domain the
 * shared words are exactly the generic ones ("dive", "snorkel", "guided"), and
 * a wrong enrichment corrupts product data invisibly, while an unmatched row is
 * merely visible work. The bar is set so the failure mode is the visible one.
 *
 * A near-miss is still returned as `suggestion` so the report can show what a
 * human would probably map it to, without acting on it.
 */
export interface MatchResult<T> {
  match: T | null;
  suggestion: T | null;
  ambiguous: boolean;
}

export function bestMatch<T>(researchName: string, candidates: T[], nameOf: (c: T) => string): MatchResult<T> {
  const a = new Set(nameTokens(researchName));
  const empty: MatchResult<T> = { match: null, suggestion: null, ambiguous: false };
  if (a.size === 0) return empty;

  const contained: Array<NameMatch<T>> = [];
  const partial: Array<NameMatch<T>> = [];

  for (const candidate of candidates) {
    const b = new Set(nameTokens(nameOf(candidate)));
    if (b.size === 0) continue;
    const shared = [...a].filter(t => b.has(t)).length;
    if (shared === 0) continue;

    if (shared === a.size || shared === b.size) {
      // Prefer the tightest containment: fewer unmatched tokens on either side.
      contained.push({ candidate, score: shared / Math.max(a.size, b.size) });
    } else {
      partial.push({ candidate, score: shared / Math.max(a.size, b.size) });
    }
  }

  if (!contained.length) {
    partial.sort((x, y) => y.score - x.score);
    return { match: null, suggestion: partial.length ? partial[0].candidate : null, ambiguous: false };
  }

  contained.sort((x, y) => y.score - x.score);
  const top = contained[0];
  const ambiguous = contained.length > 1 && contained[1].score === top.score;
  return {
    match: ambiguous ? null : top.candidate,
    suggestion: top.candidate,
    ambiguous
  };
}

/** Pulls the first number out of a cell like "1,200 - 1,600 EGP". */
export function firstNumber(value: string): number | null {
  const match = value.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Pulls a numeric range out of a cell like "350 - 750 EGP". */
export function numberRange(value: string): { min: number; max: number } | null {
  const nums = (value.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Parses "28.5042° N, 34.5208° E" into a coordinate pair. */
export function coordinates(value: string): { lat: number; lng: number } | null {
  const nums = (value.match(/-?\d+\.\d+/g) || []).map(Number);
  if (nums.length < 2) return null;
  return { lat: nums[0], lng: nums[1] };
}
