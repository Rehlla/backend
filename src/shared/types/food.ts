/**
 * The shape the Food view renders.
 *
 * Declared here rather than in the component because `diningMapper` builds
 * these from the destination corpus, and a service importing a component
 * creates an import cycle — which is exactly what broke the module graph and
 * dropped the whole app into its ErrorBoundary.
 */
export type FoodCategory = 'breakfast' | 'quick' | 'local' | 'datenight' | 'delivery';

export interface FoodOption {
  id: string;
  name: string;
  nameAr: string;
  category: FoodCategory;
  categoryTag: string;
  categoryTagAr: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  distance: string;
  distanceAr: string;
  distanceKm: string;
  estimatedTime: string;
  estimatedTimeAr: string;
  priceLevel: 'Low' | 'Low–Moderate' | 'Moderate';
  priceEstimate: string;
  priceEstimateAr: string;
  /**
   * Only where it is measured — which today is nowhere.
   *
   * These were required, and the three curated venues carried invented values
   * (4.7–4.9) rendered beside a star. Nothing in this platform collects a
   * review, and the destination corpus does not carry one either.
   */
  rating?: number;
  reviewCount?: number;
  badge: 'Best fit' | 'Quick' | 'Relaxed';
  badgeAr: 'أنسب اختيار' | 'سريع وخفيف' | 'روقان ع البحر';
  cuisine: string;
  cuisineAr: string;
  openingStatus: string;
  openingStatusAr: string;
  diningDuration: string;
  diningDurationAr: string;
  deliveryTime: string;
  deliveryTimeAr: string;
  imageUrl: string;
  popularDishes: {
    id: string;
    name: string;
    nameAr: string;
    description: string;
    descriptionAr: string;
    price: number;
  }[];
}
