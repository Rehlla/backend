export type CmsTab = 'overview' | 'pages' | 'media' | 'homepage' | 'navigation' | 'revisions' | 'catalog' | 'strings' | 'info' | 'theme';

export interface CmsPage {
  id: string;
  slug: string;
  type: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  hero_image_url: string;
  status: string;
  sort_order: number;
  featured: number;
  created_at: string;
  updated_at: string;
  published_at: string;
  version: number;
}

export interface CmsHomepageSection {
  id: string;
  section_key: string;
  title_en: string;
  title_ar: string;
  visible: number;
  sort_order: number;
  config: Record<string, any>;
  updated_at: string;
}

export interface MediaUsageRef {
  kind: 'binding' | 'page';
  entityType?: string;
  entityId?: string;
  label?: string;
  field?: string;
  status?: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  original_url: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  aspect_ratio: string;
  alt_en: string;
  alt_ar: string;
  caption_en: string;
  caption_ar: string;
  credit: string;
  category: string;
  tags: string;
  usage_count: number;
  focal_x: number;
  focal_y: number;
  variants: { width: number; url: string; bytes: number }[];
  usedCount?: number;
  usedIn?: MediaUsageRef[];
  created_at: string;
  updated_at: string;
}

export interface NavItem {
  id: string;
  menu_key: string;
  item_order: number;
  label_en: string;
  label_ar: string;
  route: string;
  external_url: string;
  visible: number;
  open_in_new: number;
  icon: string;
  group_label_en: string;
  group_label_ar: string;
  created_at: string;
  updated_at: string;
}

export interface Revision {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  payload: Record<string, any>;
  created_at: string;
}

export type CatalogEntityType =
  | 'accommodation'
  | 'rental'
  | 'activity'
  | 'place'
  | 'area'
  | 'dining_venue'
  | 'supplier'
  | 'sku'
  | 'offer';

export interface CatalogFieldSpec {
  labelEn: string;
  labelAr: string;
  textFields: string[];
  mediaFields: string[];
}

export interface CatalogBinding {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  value_text: string;
  media_id: string;
  status: 'draft' | 'published' | 'archived';
  scheduled_at: string;
  published_at: string;
  version: number;
  updated_at: string;
}

export interface CatalogItemSummary {
  entityType: string;
  entityId: string;
  label: string;
  labelAr: string;
  resolved: boolean;
  bindingCount: number;
  counts: { draft: number; published: number; archived: number };
  fields: Record<string, { status: string; hasValue: boolean }>;
  updatedAt: string;
}

export interface SiteStringItem {
  key: string;
  group: string;
  code_en: string;
  code_ar: string;
  override_en: string;
  override_ar: string;
  value_en: string;
  value_ar: string;
  customized: boolean;
  updated_at: string;
  updated_by: string;
}

export interface SiteStringGroup {
  group: string;
  count: number;
  customized: number;
}
