# خطة تحديث الصفحة الرئيسية — 2026 (المعتمدة)

> مصدر هذا الملف: نص الخطة التي اعتمدها المستخدم كمهمة في محادثة الـagent.
> مُستخرَج من سجل المحادثة وحُفظ هنا حتى لا يضيع. الحالة مُضافة أسفل كل مرحلة.

## المرحلة 0 — خط أساس قبل أي تغيير

1. `PORT=3100 npm run dev` (بورت 3000 تطبيق آخر) والتأكد من HTTP 200 على `/home`.
2. جلسة/تبويب bsk جديدان (`bsk tab create` + `--tab-id` على كل نداء) — الجلسة القديمة ماتت بعد إعادة تشغيل Freebuff.
3. `bash .freebuff/run-matrix.sh` لتسجيل **BEFORE**: المتوقع 0/38 + 0/6 + 0/2 في كل الثيمات (نتيجة العمل السابق).
4. تسجيل حجم/زمن تحميل صورة الهيرو كرقم مرجعي (336KB لـ `coral-reef-split.jpg`).

**معيار النجاح:** سجل BEFORE محفوظ؛ أي رقم يسوء لاحقاً يُنسب للتغيير لا للنظام.

**الحالة:** ✅ سُجِّل BEFORE؛ والأرقام المكافئة بعد التنفيذ (0/43 + 0/6 + 0/2) لم تتدهور.

---

## المرحلة 1 — تنظيف الكود الميت

قبل كل حذف: إعادة `grep -rl "<name>" src tests` للتأكد من الصفر مستهلكين (الشجرة قد تتغير).

**تُحذف:**
- `src/components/home/`: `DahabLandmarksBento`, `HomeEssenceBento`, `HomeLiveTicker`, `HomeMarquee`, `HomePracticalServices`, `HomeSectionNav`, `HomeStatsBand`, `PlanWithAiWidget`, `TripEntrySection`, `ReadyMadeTripsCarousel`, `ReadyTripCompareModal`, `SmartTripMatchQuizModal`
- `src/components/home/concierge/`: `GalleryStrip`, `ConciergeJourneyRail`, `MobileServiceDashboard`
- `src/components/mobile/` بالكامل (5 ملفات بما فيها `mobile.css`)

**تبقى:** `PlanForMeView` (مستخدم في `App.tsx` و`TripPlanner`)، `HomepageEditor` (تصبح حقيقية في المرحلة 3)، وثوابت `IMG_CONC_HERO_*` في [dahabImagery.ts](../../src/shared/dahabImagery.ts) (مؤجَّلة لمحور الأداء).

**ملاحظة معلنة:** حذف `PlanWithAiWidget` يزيل واجهة توليد رحلة بالذكاء الاصطناعي غير القابلة للوصول (المسار ما زال متاحاً عبر `TripPlanner`)؛ قابل للاستعادة من git.

**معيار النجاح:** `node ./node_modules/typescript/lib/tsc.js --noEmit` = 0؛ `npm test` = 1208/5/1 بلا تغيير؛ السيرفر يقلع والصفحة تُرسم.

**الحالة:** ✅ منفَّذة. حُذف 20 ملفًا. أُضيف لاحقًا حذف CSS ميت: `.dahab-marquee*`, `.dahab-spotlight`, `.dahab-aurora-wash`.

---

## المرحلة 2 — المحور A: بوابة «الخطوة التالية» الواعية بالرحلة

**الملفات:**
- جديد: [src/services/homeNextStepResolver.ts](../../src/services/homeNextStepResolver.ts) — دالة نقية `resolveHomeNextStep(lifecycle, ctx)` تُعيد `{ mode, eyebrowKey, titleKey, bodyKey, primaryKey, primaryRoute, secondaryKey?, secondaryRoute?, liveValue? }`. لا JSX ولا DOM → قابلة للاختبار الكامل في Vitest.
- جديد: `src/components/home/concierge/ConciergeNextStep.tsx` — العرض فقط؛ تقرأ `useTrip()` وتركّب أعلاه.
- تعديل: [ConciergeHome.tsx](../../src/components/home/concierge/ConciergeHome.tsx) — إدراج البوابة بين `ConciergeHero` و`#concierge-main` (قبل `ServiceExplorer`).
- تعديل: [translations.ts](../../src/i18n/translations.ts) بمفاتيح `home.nextStep.*` (en+ar) ثم `npm run i18n:emit`.

**السلوك حسب `lifecycle.lifecyclePhase`:**

| الطور | المحتوى | إجراء رئيسي |
|---|---|---|
| DISCOVERY / BOOKING | **لا يُرسم شيء** (الصفحة كما هي — يحمي الانطباع الأول والهارنس) | — |
| PRE_TRIP | عدّاد أيام من `activeTrip.startDate` + `timeContext` | `/my-trip` |
| IN_TRANSIT / ARRIVAL | وصول + أول ساعتين | `/first-two-hours` |
| IN_DAHAB / ACTIVE_TRIP | اليوم الحالي + النشاط القادم (`activeActivityTitle`) + `freeWindowMinutes` | `/my-trip` |
| DISRUPTED | تعديل وحل | `/change-recovery` |
| DEPARTURE | يوم المغادرة | `/departure` |
| POST_TRIP | ذكريات وتقييم | `/post-trip` |

**قواعد التصميم:** هوية النظام البصرية فقط — لوح `bg-[var(--surface-container)]` + `text-[var(--text-primary)]`، وحبر الأكسنت عبر `--text-accent-strong` / `--accent-primary-ink`؛ لا توكن جديد؛ خصائص منطقية (`ms-`/`me-`/`start`/`end`) لـRTL؛ `prefers-reduced-motion` محترم (الهارنس يجمّد الحركة أصلاً).

**قياس إلزامي للواجهة الجديدة (لا افتراض):** إضافة 2–4 أهداف إلى `.freebuff/contrast-probe.js` في حالة `base` (نص البطاقة + التشيب) وتحديث `EXPECT.base` في `.freebuff/audit-cycle.sh`، ثم إعادة المصفوفة — المتوقع 0 فشل في الأهداف الجديدة والقديمة.

**التحقق من الأطوار الستة:** اختبارات وحدة لدالة `resolveHomeNextStep` تغطي كل طور (النسخ + المسار الصحيح من قائمة `AppRoute` الحقيقية)، لأن كل الأطوار لا يمكن إنتاجها بجلسة واحدة. ثم فحص حيّ لأي طور يحلّه حساب العرض التجريبي، وتوثيق ما لم يُختبر حيّاً.

**الحالة:** ✅ منفَّذة مع تعليم صريح لاحق بأن **DISCOVERY يرسم بوابة أيضًا** (تجاوز لسطر «لا يُرسم شيء» أعلاه) — لذا الأهداف الخمسة `nextstep.*` موجودة في الحالة الافتراضية. 51 مفتاحًا في القاموسين، و7+2 اختبارًا أخضر.

---

## المرحلة 3 — المحور C: الـCMS يقود الصفحة فعلاً

**الخادم:**
- [cmsSeed.ts](../../server/db/sqlite/cmsSeed.ts): استبدال بذرة الأقسام بالمفاتيح الحقيقية السبعة — `hero`, `services`, `experiences`, `intent`, `itineraries`, `stories`, `final_cta` — بنصوص تطابق النسخ المترجمة الحالية في `ConciergeHome`.
- إضافة `backfillHomepageSections(conn)` يُنادى من `seedCmsContent`: `INSERT OR IGNORE` للمفاتيح الناقصة فقط، **دون حذف صفوف المشرف** (البذرة الكتلية تعمل فقط حين الجدول فارغ، فلن تصل لقواعد قائمة بدون هذا).
- لا مساس بباقي جداول CMS؛ `cmsHomepage.upsert` + سجل المراجعات المُمتحن يبقيان كما هما.

**العميل:**
- جديد: `src/components/home/concierge/homeLayout.ts` — دالة نقية `resolveHomeLayout(sections, {...})`.
- [ConciergeHome.tsx](../../src/components/home/concierge/ConciergeHome.tsx): نداء واحد لـ `useHomepageContent()` وتمرير النتيجة؛ **السلوك الافتراضي عند غياب الـCMS أو فشله = النسخة المترجمة كما هي الآن**.
- `ConciergeHero.tsx` و`StoriesMasonry.tsx`: props اختيارية للتجاوز.
- [HomepageEditor.tsx](../../src/components/admin/HomepageEditor.tsx): تحديث القائمة إلى المفاتيح الحقيقية (en+ar) مع حقول `visible`/`sort_order`/النسخ.
- تصحيح التعليق القديم في `useCMSContent.ts` الذي يقول «hero config in V2HomeCockpit».

**اختبارات مانعة للانحراف:**
- اختبارات `resolveHomeLayout`: غياب صفوف → كل الأقسام مرئية بالترتيب المترجم؛ `visible=0` يخفي؛ `sort_order` يرتّب؛ الهيرو مثبّت أولاً.
- حارس يمنع تباعد المصدرين: تأكيد أن مفاتيح البذرة **تساوي بالضبط** الأقسام التي يرسمها العميل.

**معيار النجاح:** إخفاء قسم من لوحة المشرف يخفيه فعلاً في الصفحة؛ إعادة الترتيب تُعيد الترتيب؛ إخفاء الهيرو يجعل `GET /api/content/homepage` يُعيد `hero: null`.

**الحالة:** ✅ منفَّذة. القائمة النهائية **تسعة** أقسام لا سبعة (أُضيف `next_step` للبوابة و`footer`)، والحارس في [homeSections.test.ts](../../tests/domain/homeSections.test.ts) (16 اختبارًا) بدل توسيع `cmsWorkflowIntegrity.test.ts`، والترتيب في الصفحة مُثبَت حيًّا عبر الـAPI (visible / sort_order / صورة الهيرو / ارتداد الصورة).

---

## المرحلة 4 (مؤجَّلة، غير مشمولة) — الأداء والـSEO

مكتشَف ومُوثَّق للجلسة القادمة: `conc-hero-*.webp` (5 صور، ~150KB) موجودة ولا يستعملها أي مكوّن، وثوابت `IMG_CONC_HERO_*` بلا مستهلكين؛ لا `srcset` ولا `preload` ولا JSON-LD. تبقى خارج هذه الخطة.

**الحالة:** ⏸️ مؤجَّلة كما هي — لم تُلمس.

---

## بُنودٌ أُعلن رفضها/تأجيلها في مهمة المرحلة 3

- توحيد الموبايل (المحور B) — مرفوض كمحور مستقل (لكن مجلد `src/components/mobile/` حُذف ضمن المرحلة 1).
- المحور F: صور الهيرو وLCP — مؤجَّل.
- إصلاح فشل اختبارات الإيجار الزمني — خارج النطاق (قائم مسبقًا).

---

## التحقق النهائي (إلزامي قبل التسليم)

1. `node ./node_modules/typescript/lib/tsc.js --noEmit` → exit 0.
2. `npm test` → بلا فشل جديد (الفشل القائم في اختبارات الإيجار يُذكَر كقيد لا كناجح).
3. إقلاع نظيف بقاعدة بيانات جديدة في مجلد مؤقت (`DAHAB_DATA_DIR` مؤقت + `DAHAB_SEED_DIR` الحقيقي) → يثبت مفاتيح البذرة الجديدة وأن البذور مُبقاة؛ واختبار ثانٍ بجدول أقسام فارغ → الصفحة تُرسم بالنسخة المترجمة.
4. `npm run i18n:emit` ثم تشغيل `tests/domain/i18nDictionarySync.test.ts`.
5. مصفوفة الهارنس (`.freebuff/run-matrix.sh`: 10 تشغيلات 1514px + تشغيل موبايل 390px) → 0 فشل **بما فيها الأهداف الجديدة للبطاقة**؛ ومقارنة كل رقم مع BEFORE من المرحلة 0.
6. RTL: دورتا `ar` بلا فشل، وبطاقة البوابة تتبع الاتجاه المنطقي (فحص `dir` + موضع التشيب).
7. `git status` نظيف من الملفات غير المقصودة؛ صفر كتابة في `data/`؛ لا commit.
8. كل تقرير يُسلَّم يبدأ بسطر `GRADES ...` مع رقم «قبل/بعد» لكل تغيير وعدد الفشل لكل تشغيل.

**المخاطر المُعلنة:** (أ) البوابة تصبح طفلاً إضافيًا في `ConciergeHome` — يجب ألّا تكسر `#concierge-main` (تعتمد عليه e2e الخاص بـsplash-gate)؛ (ب) `PreArrivalBriefing` بلا مسار — يُربط `/my-trip` ولا يُخترع مسار، وتُوثَّق الفجوة؛ (ج) ترتيب الأقسام يصير معتمداً على CMS — لذلك الافتراضي المترجم يبقى هو الضمان.
