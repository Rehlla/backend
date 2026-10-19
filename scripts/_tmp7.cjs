const fs = require('fs');
const p = 'src/i18n/translations.ts';
let s = fs.readFileSync(p, 'utf8');
const anchor = '"experiences.addToDay":';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
const added = [
  '// P0-06/P1-19: this meta line was hardcoded English inside the Arabic sticky bar,',
  '// and on 375px it squeezed the name and price until every word wrapped alone.',
  '"experiences.meta.rating": { en: "4.9 (127 reviews)", ar: "4.9 (127 تقييم)" },',
  '"experiences.meta.hours": { en: "6 hours", ar: "6 ساعات" },',
  '"experiences.meta.beginner": { en: "Beginner friendly", ar: "مناسبة للمبتدئين" },',
  '"experiences.meta.certified": { en: "Certified guide", ar: "مرشد معتمد" },',
  '"experiences.meta.freeCancel": { en: "Free cancellation", ar: "إلغاء مجاني" },',
].join('\n  ');
s = s.replace(anchor, added + '\n  ' + anchor);
fs.writeFileSync(p, s);
console.log('inserted experience meta keys');