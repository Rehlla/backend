import type { ProductSkuEntity, SupplierEntity } from '../schema';

/**
 * Real inventory for the eight in-destination services in the Book Now
 * catalogue.
 *
 * Those eight cards lived entirely in the frontend. Checkout accepted a card's
 * own `id` as a skuId and the server silently substituted the first SKU of the
 * same service type, so booking a 180 EGP gear delivery created a real booking
 * dispatched to a real dive centre for a service it does not sell. The server
 * now refuses inventory it does not hold; this is that inventory.
 *
 * Everything below — the business names, phone numbers, areas and prices — is
 * copied verbatim from the catalogue entries the cards already displayed to
 * travelers, so nothing new is invented here. What changes is that the same
 * facts now exist as records the commerce engine can enforce capacity against
 * and route a payout to.
 *
 * Capacities are the only new numbers. They are set to what each service can
 * plausibly run in one slot and are the value the platform will refuse to
 * oversell — deliberately conservative, because an under-stated capacity turns
 * a booking away while an over-stated one strands a traveler.
 */

export const IN_DESTINATION_SUPPLIERS: SupplierEntity[] = [
  {
    id: 'SUP-BLUEDIVERS-01',
    businessName: 'Dahab Blue Divers Hub',
    businessNameAr: 'مركز غواصي دهب الأزرق',
    category: 'diving',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Dahab Blue Divers Hub',
    phone: '+20 100 234 8899',
    email: 'hub@dahabbluedivers.example',
    area: 'Lighthouse / Mashraba / Eel Garden',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-REDSEAMASTERS-01',
    businessName: 'Sinai Red Sea Dive Masters',
    businessNameAr: 'أساتذة الغطس بالبحر الأحمر - سيناء',
    category: 'diving',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Sinai Red Sea Dive Masters',
    phone: '+20 100 345 6789',
    email: 'dive@sinairedsea.example',
    area: 'Lighthouse Promenade Base',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-LAGUNAKITE-01',
    businessName: 'Laguna Wind & Kite Center',
    businessNameAr: 'مركز لاجونا للرياح والكايت',
    category: 'diving',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Laguna Wind & Kite Center',
    phone: '+20 100 567 1234',
    email: 'kite@lagunadahab.example',
    area: 'Laguna Beach Kite Spit',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-BEDOUINDRIVERS-01',
    businessName: 'Sinai Bedouin Drivers Cooperative',
    businessNameAr: 'تعاونية سائقي بدو سيناء',
    category: 'transfer',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Sinai Bedouin Drivers Cooperative',
    phone: '+20 100 789 4455',
    email: 'drivers@sinaibedouin.example',
    area: 'Pickup anywhere in Dahab',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-MOTORSAFARI-01',
    businessName: 'Sinai Desert Motor Safari',
    businessNameAr: 'سفاري سيناء الصحراوي بالمركبات',
    category: 'safari',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Sinai Desert Motor Safari',
    phone: '+20 100 901 2345',
    email: 'safari@sinaimotor.example',
    area: 'Wadi Gnai Desert Trails',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-SHEIKHSALEM-01',
    businessName: 'Sheikh Salem Bedouin Heritage Council',
    businessNameAr: 'مجلس الشيخ سالم للتراث البدوي',
    category: 'safari',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Sheikh Salem Bedouin Heritage Council',
    // No phone: this reused the invented '+20 100 876 5432' (see migrations.ts).
    email: 'heritage@wadignai.example',
    area: 'Wadi Gnai Granite Amphitheatre',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-HOLISTIC-01',
    businessName: 'Dahab Holistic Healing Oasis',
    businessNameAr: 'واحة دهب للعلاج الشامل',
    category: 'logistics',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Dahab Holistic Healing Oasis',
    phone: '+20 100 444 3322',
    email: 'care@dahabholistic.example',
    area: 'Assalah Wellness Palapa & Lighthouse Studio',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  },
  {
    id: 'SUP-ALIBABA-REST-01',
    businessName: 'Ali Baba Seafront Restaurant & Lounge',
    businessNameAr: 'مطعم ولاونج علي بابا على البحر',
    category: 'restaurant',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Ali Baba Seafront Restaurant & Lounge',
    phone: '+20 69 364 0055',
    email: 'table@alibabadahab.example',
    area: 'Lighthouse Promenade Center',
    onboardedAt: '2026-08-30',
    approvedBy: 'Catalogue import'
  }
];

export const IN_DESTINATION_SKUS: ProductSkuEntity[] = [
  {
    id: 'SKU-NOW-GEAR-01',
    supplierId: 'SUP-BLUEDIVERS-01',
    serviceType: 'diving',
    title: 'Snorkel & Dive Gear Delivered to Your Spot',
    titleAr: 'توصيل معدات السنوركل والغطس لمكانك',
    description: 'Mask, snorkel, fins and a wetsuit brought to your beach spot within about 15 minutes.',
    durationMinutes: 180,
    basePriceEGP: 180,
    currency: 'EGP',
    maxCapacityPerSlot: 12,
    active: true,
    cancellationPolicyHours: 1
  },
  {
    id: 'SKU-NOW-AFTDIVE-01',
    supplierId: 'SUP-REDSEAMASTERS-01',
    serviceType: 'diving',
    title: 'Afternoon Guided Shore Dive',
    titleAr: 'غطسة إرشادية من الشاطئ بعد الظهر',
    description: 'One guided shore dive with a local instructor, tanks and weights included.',
    durationMinutes: 120,
    basePriceEGP: 1200,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    cancellationPolicyHours: 6
  },
  {
    id: 'SKU-NOW-KITE-01',
    supplierId: 'SUP-LAGUNAKITE-01',
    serviceType: 'diving',
    title: 'Laguna Kitesurf Session & Gear Hire',
    titleAr: 'جلسة كايت سيرف وتأجير معدات في اللاجونا',
    description: 'Board, kite and harness hire on the Laguna flats, with a spotter on the water.',
    durationMinutes: 120,
    basePriceEGP: 950,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    cancellationPolicyHours: 6
  },
  {
    id: 'SKU-NOW-JEEP-BH-01',
    supplierId: 'SUP-BEDOUINDRIVERS-01',
    serviceType: 'transfer',
    title: 'Jeep Ride to the Blue Hole',
    titleAr: 'توصيلة جيب للبلو هول',
    description: 'Pickup anywhere in Dahab and a return run up the coast road to the Blue Hole.',
    routeFrom: 'Dahab',
    routeTo: 'Blue Hole',
    durationMinutes: 90,
    basePriceEGP: 400,
    currency: 'EGP',
    maxCapacityPerSlot: 7,
    active: true,
    cancellationPolicyHours: 2
  },
  {
    id: 'SKU-NOW-QUAD-01',
    supplierId: 'SUP-MOTORSAFARI-01',
    serviceType: 'safari',
    title: 'Wadi Gnai Quad Safari',
    titleAr: 'سفاري الكواد في وادي قني',
    description: 'Guided quad run through the Wadi Gnai trails with a briefing and helmets.',
    durationMinutes: 120,
    basePriceEGP: 850,
    currency: 'EGP',
    maxCapacityPerSlot: 8,
    active: true,
    cancellationPolicyHours: 4
  },
  {
    id: 'SKU-NOW-ZARB-01',
    supplierId: 'SUP-SHEIKHSALEM-01',
    serviceType: 'safari',
    title: 'Wadi Gnai Bedouin Dinner & Stargazing',
    titleAr: 'عشاء بدوي وسهرة نجوم في وادي قني',
    description: 'Zarb dinner cooked in the sand, tea by the fire and stargazing in the granite amphitheatre.',
    durationMinutes: 240,
    basePriceEGP: 750,
    currency: 'EGP',
    maxCapacityPerSlot: 20,
    active: true,
    cancellationPolicyHours: 6
  },
  {
    id: 'SKU-NOW-MASSAGE-01',
    supplierId: 'SUP-HOLISTIC-01',
    serviceType: 'wellness',
    title: 'Deep Tissue Massage',
    titleAr: 'مساج عميق للأنسجة',
    description: 'One-hour deep tissue massage at the Assalah palapa or the Lighthouse studio.',
    durationMinutes: 60,
    basePriceEGP: 650,
    currency: 'EGP',
    maxCapacityPerSlot: 3,
    active: true,
    cancellationPolicyHours: 3
  },
  {
    id: 'SKU-NOW-CATCH-01',
    supplierId: 'SUP-ALIBABA-REST-01',
    serviceType: 'dining',
    title: "Fresh Catch Table at Ali Baba Seafront",
    titleAr: 'ترابيزة سمك اليوم في علي بابا على البحر',
    description: 'A reserved seafront table with the day\'s catch, grilled to order.',
    durationMinutes: 120,
    basePriceEGP: 350,
    currency: 'EGP',
    maxCapacityPerSlot: 24,
    active: true,
    cancellationPolicyHours: 2
  }
];
