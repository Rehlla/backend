/**
 * Content Templates — pre-built page layouts for common content types.
 * Each template defines a set of blocks that are pre-populated when
 * creating a new page, saving content editors from building from scratch.
 */

export interface ContentTemplate {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  type: string;
  blocks: Array<{
    type: string;
    title_en: string;
    title_ar: string;
    body_en: string;
    body_ar: string;
    config?: Record<string, any>;
  }>;
}

export const CMS_TEMPLATES: ContentTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Page',
    nameAr: 'صفحة فارغة',
    description: 'Start with an empty page',
    descriptionAr: 'ابدأ بصفحة فارغة',
    type: 'static_page',
    blocks: [],
  },
  {
    id: 'about',
    name: 'About Page',
    nameAr: 'صفحة تعريفية',
    description: 'Company or destination introduction with rich text and stats',
    descriptionAr: 'تعريف بالشركة أو الوجهة مع نص غني وإحصائيات',
    type: 'static_page',
    blocks: [
      {
        type: 'rich_text',
        title_en: 'Introduction',
        title_ar: 'مقدمة',
        body_en: 'Write your introduction here...',
        body_ar: 'اكتب مقدمتك هنا...',
      },
      {
        type: 'stats',
        title_en: 'Key Numbers',
        title_ar: 'الأرقام الرئيسية',
        body_en: '',
        body_ar: '',
        config: {
          items: [
            { value: '500+', label_en: 'Travelers', label_ar: 'مسافر' },
            { value: '50+', label_en: 'Experiences', label_ar: 'تجربة' },
            { value: '4.9', label_en: 'Rating', label_ar: 'تقييم' },
            { value: '24/7', label_en: 'Support', label_ar: 'دعم' },
          ],
        },
      },
      {
        type: 'cta',
        title_en: 'Ready to explore?',
        title_ar: 'مستعد للاستكشاف؟',
        body_en: 'Start planning your trip to Dahab today.',
        body_ar: 'ابدأ في تخطيط رحلتك إلى دهب اليوم.',
        config: { cta_label: 'Plan My Trip', cta_label_ar: 'خطط رحلتي', cta_route: '/trip-builder' },
      },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ Page',
    nameAr: 'صفحة أسئلة شائعة',
    description: 'Frequently asked questions with accordion blocks',
    descriptionAr: 'أسئلة شائعة مع كتل مطوية',
    type: 'static_page',
    blocks: [
      {
        type: 'rich_text',
        title_en: 'Common Questions',
        title_ar: 'الأسئلة الشائعة',
        body_en: 'Find answers to the most common questions about our platform.',
        body_ar: 'اعثر على إجابات للأسئلة الأكثر شيوعاً حول منصتنا.',
      },
      {
        type: 'faq',
        title_en: 'FAQ',
        title_ar: 'الأسئلة الشائعة',
        body_en: '',
        body_ar: '',
        config: {
          items: [
            { question_en: 'How do I plan a trip?', question_ar: 'كيف أخطط رحلة؟', answer_en: 'Use our AI-powered Trip Builder.', answer_ar: 'استخدم منشئ الرحلات المدعوم بالذكاء الاصطناعي.' },
            { question_en: 'Can I cancel my booking?', question_ar: 'هل يمكنني إلغاء حجزي؟', answer_en: 'Yes, check the cancellation policy for each item.', answer_ar: 'نعم، تحقق من سياسة الإلغاء لكل عنصر.' },
          ],
        },
      },
    ],
  },
  {
    id: 'destination',
    name: 'Destination Guide',
    nameAr: 'دليل الوجهة',
    description: 'Destination page with hero, overview, and highlights',
    descriptionAr: 'صفحة وجهة مع غلاف ونظرة عامة وأبرز المعالم',
    type: 'static_page',
    blocks: [
      {
        type: 'rich_text',
        title_en: 'Overview',
        title_ar: 'نظرة عامة',
        body_en: 'Describe this destination...',
        body_ar: 'صف هذه الوجهة...',
      },
      {
        type: 'image_text',
        title_en: 'Highlights',
        title_ar: 'أبرز المعالم',
        body_en: 'Describe the main attractions and experiences...',
        body_ar: 'صف المعالم الرئيسية والتجارب...',
        config: { image_url: '' },
      },
      {
        type: 'quote',
        title_en: '',
        title_ar: '',
        body_en: 'Add a testimonial or memorable quote...',
        body_ar: 'أضف شهادة أو اقتباساً لا يُنسى...',
        config: { attribution: '' },
      },
      {
        type: 'cta',
        title_en: 'Explore this destination',
        title_ar: 'استكشف هذه الوجهة',
        body_en: 'Discover activities, restaurants, and experiences.',
        body_ar: 'اكتشف الأنشطة والمطاعم والتجارب.',
        config: { cta_label: 'Explore', cta_label_ar: 'استكشف', cta_route: '/explore' },
      },
    ],
  },
  {
    id: 'travel_guide',
    name: 'Travel Guide',
    nameAr: 'دليل سفر',
    description: 'Comprehensive guide with multiple sections',
    descriptionAr: 'دليل شامل مع أقسام متعددة',
    type: 'static_page',
    blocks: [
      {
        type: 'rich_text',
        title_en: 'Introduction',
        title_ar: 'مقدمة',
        body_en: 'Welcome to this travel guide...',
        body_ar: 'مرحباً بك في دليل السفر هذا...',
      },
      {
        type: 'rich_text',
        title_en: 'What to Know Before You Go',
        title_ar: 'ما يجب معرفته قبل السفر',
        body_en: 'Essential information for travelers...',
        body_ar: 'معلومات أساسية للمسافرين...',
      },
      {
        type: 'rich_text',
        title_en: 'Top Experiences',
        title_ar: 'أفضل التجارب',
        body_en: 'Must-do activities and experiences...',
        body_ar: 'الأنشطة والتجارب التي يجب عدم تفويتها...',
      },
      {
        type: 'divider',
        title_en: '',
        title_ar: '',
        body_en: '',
        body_ar: '',
      },
      {
        type: 'faq',
        title_en: 'Travel Tips',
        title_ar: 'نصائح السفر',
        body_en: '',
        body_ar: '',
        config: { items: [] },
      },
    ],
  },
];

export function getTemplateById(id: string): ContentTemplate | undefined {
  return CMS_TEMPLATES.find(t => t.id === id);
}
