/**
 * Shared list helper for the ops contract (docs/OPS_API_CONTRACT.md):
 *   ?cursor=<opaque>&limit=<1..100, default 25>&sort=<field>|-<field>&q=<text>
 * returns { items, nextCursor, total }.
 *
 * The cursor is an opaque base64url offset. Collections here are in-memory
 * arrays, so an offset cursor is exact; clients must treat it as opaque so
 * this can become a keyset cursor without a contract change.
 */

export interface ListParams {
  offset: number;
  limit: number;
  sort?: { field: string; desc: boolean };
  q?: string;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

const LIST_KEYS = ['cursor', 'limit', 'sort', 'q'];

export function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: unknown): number {
  if (typeof cursor !== 'string' || !cursor) return 0;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const m = /^o:(\d+)$/.exec(raw);
    return m ? Math.max(0, Number(m[1])) : 0;
  } catch {
    return 0;
  }
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/** True when the query carries any list param (or one of `extraKeys`). */
export function hasListParams(query: Record<string, unknown>, extraKeys: string[] = []): boolean {
  return [...LIST_KEYS, ...extraKeys].some(k => query[k] !== undefined && query[k] !== '');
}

export function parseListParams(query: Record<string, unknown>, sortable?: string[]): ListParams {
  const rawLimit = Number(first(query.limit));
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = decodeCursor(first(query.cursor));
  const sortRaw = first(query.sort);
  let sort: ListParams['sort'];
  if (typeof sortRaw === 'string' && sortRaw) {
    const desc = sortRaw.startsWith('-');
    const field = desc ? sortRaw.slice(1) : sortRaw;
    if (!sortable || sortable.includes(field)) sort = { field, desc };
  }
  const qRaw = first(query.q);
  const q = typeof qRaw === 'string' && qRaw.trim() ? qRaw.trim().toLowerCase().slice(0, 200) : undefined;
  return { offset, limit, sort, q };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function applyList<T>(
  rows: T[],
  params: ListParams,
  opts: { searchFields?: (keyof T | ((row: T) => unknown))[] } = {}
): ListResult<T> {
  let out = rows;
  if (params.q && opts.searchFields?.length) {
    const needle = params.q;
    out = out.filter(row =>
      opts.searchFields!.some(f => {
        const v = typeof f === 'function' ? f(row) : (row as any)[f];
        return v !== undefined && v !== null && String(v).toLowerCase().includes(needle);
      })
    );
  }
  if (params.sort) {
    const { field, desc } = params.sort;
    out = [...out].sort((a, b) => {
      const c = compare((a as any)[field], (b as any)[field]);
      return desc ? -c : c;
    });
  }
  const total = out.length;
  const items = out.slice(params.offset, params.offset + params.limit);
  const next = params.offset + items.length;
  return { items, nextCursor: next < total ? encodeCursor(next) : null, total };
}

/** One-call convenience: parse the request query and apply it. */
export function listFromQuery<T>(
  rows: T[],
  query: Record<string, unknown>,
  opts: { sortable?: string[]; searchFields?: (keyof T | ((row: T) => unknown))[] } = {}
): ListResult<T> {
  return applyList(rows, parseListParams(query, opts.sortable), opts);
}
