/**
 * Catalogue CRUD shapes — docs/CATALOG_API_CONTRACT.md.
 *
 * One uniform envelope and one schema format over every sellable collection
 * (activities, packages, transfers, hotels, restaurants), so the staff command
 * center, the supplier portal and the ops app share one form engine. The
 * server owns the schema: the UI renders whatever `GET .../catalog/schema`
 * returns and never hardcodes a form.
 */

export type CatalogScope = 'staff' | 'supplier';

export type CatalogTypeKey =
  | 'activity'
  | 'package'
  | 'transfer-zone'
  | 'transfer-bus'
  | 'transfer-driver'
  | 'hotel'
  | 'restaurant';

/** `review` is what a supplier's "publish" becomes until staff approve it. */
export type CatalogStatus = 'draft' | 'published' | 'hidden' | 'archived' | 'review';

export interface I18nString {
  en: string;
  ar: string;
}

export interface CatalogEnvelope {
  id: string;
  /** A top-level type, or a child item type such as `hotel-room`. */
  type: string;
  status: CatalogStatus;
  supplierId: string | null;
  supplierName: string | null;
  title: I18nString;
  summary: I18nString;
  coverImage: string | null;
  images: string[];
  priceFromEGP: number;
  fields: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string | null;
  /** 0..1: filled required fields plus photos. */
  completeness: number;
  /** Server-computed empty required fields, when sent. */
  missing?: string[];
  /** Set on a write the server queued for staff approval (202) instead of applying. */
  approvalId?: string;
  /** True when the write was queued for staff approval (202); `item` is then the unchanged record. */
  queuedForApproval?: boolean;
}

/** One row of `GET {base}/summary`. `total` excludes archived records. */
export interface CatalogSummaryType {
  type: string;
  label: I18nString;
  icon?: string;
  total: number;
  draft: number;
  published: number;
  hidden: number;
  archived: number;
  review: number;
}

export interface CatalogSummaryResponse {
  types: CatalogSummaryType[];
}

/** `PUT /hotel/:id/rates`: 202 with `queuedForApproval` when a supplier's change waits for staff. */
export interface CatalogRatesPutResult {
  applied: number;
  queuedForApproval: boolean;
  approvalId?: string;
}

export type CatalogFieldKind =
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

export interface CatalogFieldOption {
  value: string;
  label?: I18nString;
}

export interface CatalogField {
  key: string;
  kind: CatalogFieldKind;
  label?: I18nString;
  help?: I18nString;
  required?: boolean;
  /** Max length for text kinds, max count for gallery/tags, max value for numbers. */
  max?: number;
  /** Min count for gallery/tags, min value for numbers. */
  min?: number;
  options?: CatalogFieldOption[];
  suggestions?: string[];
  placeholder?: I18nString;
}

export interface CatalogSectionSchema {
  key: string;
  label?: I18nString;
  fields: CatalogField[];
}

export interface CatalogChildSchema {
  key: string;
  label?: I18nString;
  /** The schema type of each child row (`hotel-room`, `restaurant-menu-item`). */
  itemType?: string;
  /** `list` (default), `rateCalendar` or `slotCalendar`. */
  kind?: string;
}

export interface CatalogTypeSchema {
  type: string;
  label: I18nString;
  icon?: string;
  sections: CatalogSectionSchema[];
  children?: CatalogChildSchema[];
  listColumns?: string[];
  filters?: string[];
}

export interface CatalogSchemaResponse {
  types: CatalogTypeSchema[];
  /** Schemas of child rows (`hotel-room`, `restaurant-menu-item`, …). */
  itemTypes?: CatalogTypeSchema[];
}

export interface CatalogListResponse {
  items: CatalogEnvelope[];
  nextCursor: string | null;
  total: number;
}

export interface CatalogDetailResponse {
  item: CatalogEnvelope;
  children: Record<string, CatalogEnvelope[]>;
}

export interface CatalogListQuery {
  status?: CatalogStatus | '';
  supplierId?: string;
  q?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
  /** Any schema `filters` key (e.g. `area`). */
  [filter: string]: string | number | undefined;
}

export interface CatalogWriteBody {
  title?: I18nString;
  summary?: I18nString;
  fields?: Record<string, unknown>;
  supplierId?: string | null;
  images?: string[];
  status?: CatalogStatus;
  /** Required by the server for price changes larger than 30%. */
  reason?: string;
}

export type CatalogBulkAction = 'publish' | 'hide' | 'archive' | 'price';

export interface CatalogBulkBody {
  ids: string[];
  action: CatalogBulkAction;
  value?: number;
  reason: string;
}

export interface CatalogBulkResult {
  updated?: number;
  failed?: { id: string; error: string }[];
  items?: CatalogEnvelope[];
}

export interface CatalogRateNight {
  date: string;
  roomId: string;
  nightlyEGP: number | null;
  closed: boolean;
}

export interface CatalogRatesQuery {
  roomId?: string;
  from: string;
  to: string;
}

export interface CatalogRatesPutBody {
  roomId: string;
  from: string;
  to: string;
  nightlyEGP?: number;
  closed?: boolean;
  /** 0 = Sunday .. 6 = Saturday. Omitted means every day of the range. */
  weekdays?: number[];
  reason?: string;
}

export interface CatalogSlot {
  id?: string;
  date: string;
  time: string;
  capacity: number;
  booked?: number;
  closed?: boolean;
}

export interface CatalogSlotsPutBody {
  from: string;
  to: string;
  times: string[];
  capacity: number;
  weekdays?: number[];
  closed?: boolean;
}

/** One day of a package's `dayPlan` field. */
export interface CatalogPlanDay {
  day: number;
  title: I18nString;
  description: I18nString;
  activityIds?: string[];
}

export interface CatalogGeo {
  lat: number | null;
  lng: number | null;
}
