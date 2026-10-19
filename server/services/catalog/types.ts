import type { CatalogStatus } from '../../db/schema';

/**
 * Types shared by the catalogue surface (docs/CATALOG_API_CONTRACT.md).
 *
 * One adapter per catalogue type maps an existing collection onto the
 * uniform envelope. Adapters are declarative: a list of field bindings
 * (schema + get/set over the backing entity) plus a handful of lifecycle
 * hooks. Validation, completeness, envelopes and the HTTP surface are
 * generic (fields.ts, catalogService.ts).
 */

export type CatalogType =
  | 'activity'
  | 'package'
  | 'transfer-zone'
  | 'transfer-bus'
  | 'transfer-driver'
  | 'hotel'
  | 'restaurant';

/** The permission area a type belongs to: catalog.<area>.view|manage|publish. */
export type CatalogArea = 'activities' | 'packages' | 'transfers' | 'hotels' | 'restaurants';

export type FieldKind =
  | 'text'
  | 'i18nText'
  | 'i18nTextarea'
  | 'number'
  | 'money'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'time'
  | 'timeList'
  | 'duration'
  | 'geo'
  | 'gallery'
  | 'supplier'
  | 'dayPlan'
  | 'json';

export interface I18n {
  en: string;
  ar: string;
}

export interface FieldOption {
  value: string;
  label: I18n;
}

/** What GET /schema publishes for one field. */
export interface FieldSchema {
  key: string;
  kind: FieldKind;
  label: I18n;
  required?: boolean;
  /** Max length (text kinds), max items (lists, gallery) or max value (numbers). */
  max?: number;
  /** Min items (gallery, lists) or min value (numbers). */
  min?: number;
  options?: FieldOption[];
  suggestions?: string[];
  help?: I18n;
  readOnly?: boolean;
}

export interface SectionSchema {
  key: string;
  label: I18n;
  fields: FieldSchema[];
}

export interface ChildRef {
  key: string;
  label: I18n;
  itemType?: string;
  kind?: 'list' | 'rateCalendar' | 'slotCalendar';
}

export interface TypeSchema {
  type: string;
  label: I18n;
  icon: string;
  sections: SectionSchema[];
  children: ChildRef[];
  listColumns: string[];
  filters: string[];
}

/** Catalogue-side storage for values the entity has no column for. */
export interface MetaView {
  images?: string[];
  extra: Record<string, unknown>;
}

/** A field binding: its schema plus how it reads/writes the backing entity. */
export interface FieldDef<E> extends FieldSchema {
  get: (e: E, meta: MetaView) => unknown;
  /** Absent: read-only. Receives an already-validated, normalised value. */
  set?: (e: E, value: any, meta: MetaView) => void;
}

export interface SectionDef<E> {
  key: string;
  label: I18n;
  fields: FieldDef<E>[];
}

export interface Envelope {
  id: string;
  type: string;
  status: CatalogStatus;
  supplierId: string | null;
  supplierName: string | null;
  title: I18n;
  summary: I18n;
  coverImage: string | null;
  images: string[];
  priceFromEGP: number;
  fields: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string | null;
  completeness: number;
  missing: string[];
}

export interface Actor {
  userId: string;
  role: string;
}

/** Who is calling and in which capacity. supplierScope set = supplier portal. */
export interface CatalogCtx {
  actor: Actor;
  supplierScope: string | null;
  correlationId?: string;
}

/** A thrown error the routes turn into an RFC7807 problem. */
export class CatalogError extends Error {
  constructor(
    public status: number,
    message: string,
    public slug: string = status === 404 ? 'not-found' : 'bad-request',
    public extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export interface ChildAdapter<P, C> {
  key: string;
  itemType: string;
  label: I18n;
  sections: () => SectionDef<C>[];
  /** The field whose change counts as a price change (30% rule). */
  priceKey?: string;
  list: (parent: P, query: Record<string, unknown>) => C[];
  find: (parent: P, childId: string) => C | undefined;
  idOf: (c: C) => string;
  statusOf?: (c: C) => CatalogStatus;
  /** A blank child with fresh ids, before input is applied. Not yet stored. */
  blank: (parent: P, input: Record<string, unknown>) => C;
  insert: (parent: P, c: C) => void;
  /** Runs after every create/update (derived rows, timestamps, validation). */
  afterWrite?: (parent: P, c: C) => void;
  /** Why it cannot be hard-deleted, or null. */
  inUse: (parent: P, c: C) => string | null;
  remove: (parent: P, c: C) => void;
}

export interface CatalogAdapter<E> {
  type: CatalogType;
  area: CatalogArea;
  label: I18n;
  icon: string;
  /** Whether the supplier portal may use this type (it needs an owner). */
  supplierOwned: boolean;
  /** True when the entity carries its own on/off switch (`active`), which then wins over a stale meta status. */
  hasNativeActive: (e: E) => boolean;
  sections: () => SectionDef<E>[];
  children: ChildAdapter<E, any>[];
  /** Non-list children advertised in the schema (rate calendar, slots). */
  extraChildren?: ChildRef[];
  listColumns: string[];
  filters: string[];
  /** Field key whose value is the envelope's priceFromEGP. */
  priceKey: string;
  rows: () => E[];
  idOf: (e: E) => string;
  supplierOf: (e: E) => string | null;
  /** Status implied by the entity alone (no catalogue meta row yet). */
  nativeStatus: (e: E) => CatalogStatus;
  /** Mirrors a status change onto the entity (active flags, own status). */
  applyStatus: (e: E, status: CatalogStatus) => void;
  /** The entity's own timestamp, used as version before any catalogue edit. */
  entityUpdatedAt?: (e: E) => string | undefined;
  /** Stamps the entity's own updatedAt/updatedBy, when it has them. */
  touchEntity?: (e: E, at: string, userId: string) => void;
  /** A blank entity with fresh ids and the given owner. Not yet stored. */
  blank: (supplierId: string | null, input: Record<string, unknown>) => E;
  /** Stores a blank or duplicate (and any rows it needs, e.g. its SKU). */
  insert: (e: E, meta: MetaView) => void;
  /** Runs after every create/update (derived rows such as SKUs). */
  afterWrite?: (e: E, meta: MetaView) => void;
  /** Why it cannot be hard-deleted (booked / referenced), or null. */
  inUse: (e: E) => string | null;
  remove: (e: E) => void;
  /** A deep copy with fresh ids, not yet stored. */
  duplicate: (e: E) => E;
  /** Assigns the owner (staff only; suppliers are pinned). */
  setSupplier: (e: E, supplierId: string | null) => void;
}
