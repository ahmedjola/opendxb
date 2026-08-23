/**
 * One language at a time.
 *
 * The site used to print English and Arabic stacked on top of each other on
 * every line. That is not bilingual, it is two documents interleaved: it
 * doubles the length of the page, halves the reading speed in both languages,
 * and reads as unfinished to anyone who speaks either one.
 *
 * So: a toggle, a full switch, and the whole document flips direction with it.
 * The chosen language is remembered, and it is the same key the game reads.
 *
 * What deliberately does NOT switch: the source links and the names of the
 * bodies that publish them, because they are cited exactly as published; and
 * digits, dates and licence numbers, which stay Western Arabic numerals in both
 * directions — that is how they are written on the documents themselves.
 */

export type Lang = 'en' | 'ar';

export const STORAGE_KEY = 'landing-in-dubai.lang.v1';

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'ar';
}

/** Arabic is right-to-left; English is not. Nothing else depends on this. */
export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Every string of page furniture, in both languages.
 *
 * Content — the answers, the step titles — is NOT here. That lives in
 * `answers.json` and `journey.ts`, which already carry both languages per
 * entry, and is picked from there at render time.
 */
export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'doc.title': 'Landing in Dubai — an unofficial guide for people who just arrived',
    'skip': 'Skip to content',
    'lang.switch': 'العربية',
    'lang.switchLabel': 'Switch to Arabic',

    'notice.title': 'Unofficial guide — always confirm with the official source.',
    'notice.body': 'An independent community project, not affiliated with any Dubai government body.',

    'hero.greeting': 'Welcome to Dubai',
    'hero.title.pre': 'You’ve just ',
    'hero.title.strong': 'landed',
    'hero.title.post': '.',
    'hero.body':
      'Now come the forms, the queues and the eight government departments nobody warned you about. Let’s get you through them.',
    'hero.cta.paperwork': 'Sort my paperwork',
    'hero.cta.city': 'Walk the city instead',

    'fork.label': 'Step one',
    'fork.heading.pre': 'Which one are ',
    'fork.heading.strong': 'you',
    'fork.heading.post': '?',
    'fork.intro':
      'The paperwork is completely different depending on why you are here. Pick the one that fits and the rest of this page rearranges itself around it.',
    'fork.noscript':
      'This page needs JavaScript to sort the steps for you. The full text of every answer, with its source, is on the plain HTML guide — no JavaScript required.',
    'fork.noscript.link': 'plain HTML guide',

    'fork.visiting.title': 'Just visiting',
    'fork.visiting.a': 'Getting in',
    'fork.visiting.b': 'Driving while you are here',
    'fork.visiting.c': 'Health cover',
    'fork.visiting.go': 'Show my list →',

    'fork.moving.tag': 'Most people',
    'fork.moving.title': 'Moving here',
    'fork.moving.a': 'Medical test and residence visa',
    'fork.moving.b': 'Emirates ID',
    'fork.moving.c': 'Ejari, DEWA, bank, licence',
    'fork.moving.go': 'Show my 9 steps →',

    'fork.resident.title': 'Already living here',
    'fork.resident.a': 'Emirates ID and proof of residency',
    'fork.resident.b': 'Ejari, DEWA and insurance',
    'fork.resident.c': 'Schools and KHDA',
    'fork.resident.go': 'Show my list →',

    'city.label': 'Or don’t read at all',
    'city.title': 'Walk into the offices yourself',
    'city.body':
      'A small top-down pixel city, right here on this page. Knock on a door, ask your question, get the same answer with the same source and the same checked date.',
    'city.cta': 'Enter the city →',

    'storage.note':
      'Your browser is blocking site storage, so anything you tick off will be forgotten when you close this tab. Everything still works — it just will not be remembered.',

    'more.label': 'Everything else',
    'more.heading': 'Other questions people ask',
    'more.intro':
      'These are in the same content file, they just are not on the path you picked. Same rule applies: every one of them shows the source it came from and the date it was checked.',

    'elsewhere.label': 'The same content, two other ways',
    'elsewhere.heading': 'Read it however suits you',
    'elsewhere.game.label': 'The game',
    'elsewhere.game.title': 'Walk the district →',
    'elsewhere.game.body':
      'A small top-down pixel city, opened right over this page. Knock on a door, read the same answer, same source, same date. Keyboard or touch.',
    'elsewhere.guide.label': 'The guarantee',
    'elsewhere.guide.title': 'Plain HTML guide →',
    'elsewhere.guide.body':
      'Every answer as semantic HTML: headings, real links, screen-reader friendly, no canvas and nothing clever.',

    'footer.disclaimer':
      'An independent community project, not affiliated with any Dubai government body. No government logo, crest, seal or official colour scheme appears anywhere on this site.',
    'footer.verbatim':
      'Answers are stored as data and shown verbatim. Nothing on this page is generated, summarised or paraphrased at runtime, and no fee, timeline or document list is stated that the linked source does not state itself.',
    'footer.storage':
      'Your progress is kept in this browser only. There is no account, no server and nothing is sent anywhere.',
    'footer.clear': 'Clear my progress',

    /* journey chrome */
    'journey.path': 'Your path',
    'journey.heading.sequential': 'The nine steps, in order',
    'journey.heading.list': 'Your short list',
    'journey.changeStatus': 'Change who I am',
    'journey.resetPath': 'Start this path over',
    'journey.done': '{done} of {total} done',
    'journey.stepOf': 'Step {n} of {total}: ',
    'journey.expand': 'What this involves',
    'journey.expandLocked': 'Read ahead anyway',
    'journey.collapse': 'Hide',
    'journey.markComplete': 'Mark complete',
    'journey.markIncomplete': 'Mark not done',
    'journey.badge.current': 'You are here',
    'journey.badge.complete': 'Done',
    'journey.badge.locked': 'Locked',
    'journey.note.next': 'This is the next thing to deal with.',
    'journey.note.blocksOne': 'Blocks step {from}.',
    'journey.note.blocksRange': 'Blocks steps {from}–{to}.',
    'journey.note.locked': 'Locked — you cannot start this until step {n}, {title}, is done.',
    'journey.note.plane': 'You did this one by getting on the plane.',
    'journey.empty':
      'No sourced answer has been written for this step yet. Rather than guess, this page says nothing.',

    'answer.source': 'Source: ',
    'answer.noSource': 'No source link attached yet — do not rely on this',
    'answer.checked': 'Checked {date}',

    /* the game */
    'hud.player': 'NEW ARRIVAL',
    'hud.unofficial': 'UNOFFICIAL GUIDE',
    'hud.fictional': 'every office here is fictional',
    'hud.nextStep': 'NEXT STEP',
    'hud.allDone': 'All done — that is the whole path.',
    'hud.pickPath': 'Pick who you are on the page first.',
    'city.noEntries': 'no entries yet',
    'city.oneQuestion': '1 question',
    'city.questions': '{n} questions',
    'city.enterPrompt': 'E / Enter to go in',
    'guide.offices': 'Offices',
    'guide.title': 'Plain text guide',
  },

  ar: {
    'doc.title': 'الوصول إلى دبي — دليل غير رسمي لمن وصل للتو',
    'skip': 'تخطَّ إلى المحتوى',
    'lang.switch': 'English',
    'lang.switchLabel': 'التبديل إلى الإنجليزية',

    'notice.title': 'دليل غير رسمي — تحقّق دائمًا من المصدر الرسمي.',
    'notice.body': 'مشروع مجتمعي مستقل، غير تابع لأي جهة حكومية في دبي.',

    'hero.greeting': 'أهلاً بك في دبي',
    'hero.title.pre': 'لقد ',
    'hero.title.strong': 'وصلت',
    'hero.title.post': ' للتو.',
    'hero.body':
      'الآن تبدأ المعاملات والطوابير والدوائر الحكومية الثماني التي لم يحذّرك منها أحد. لنجتَزْها معًا.',
    'hero.cta.paperwork': 'ابدأ بالمعاملات',
    'hero.cta.city': 'تجوّل في المدينة',

    'fork.label': 'الخطوة الأولى',
    'fork.heading.pre': 'أنت من أي ',
    'fork.heading.strong': 'فئة',
    'fork.heading.post': '؟',
    'fork.intro':
      'تختلف المعاملات تمامًا حسب سبب وجودك هنا. اختر ما ينطبق عليك وستُرتَّب بقية الصفحة حوله.',
    'fork.noscript':
      'تحتاج هذه الصفحة إلى جافاسكربت لترتيب الخطوات. نص كل إجابة كاملًا، مع مصدرها، متاح في الدليل النصي البسيط دون الحاجة إلى جافاسكربت.',
    'fork.noscript.link': 'الدليل النصي البسيط',

    'fork.visiting.title': 'زائر',
    'fork.visiting.a': 'الدخول إلى الدولة',
    'fork.visiting.b': 'القيادة أثناء الزيارة',
    'fork.visiting.c': 'التغطية الصحية',
    'fork.visiting.go': 'اعرض قائمتي ←',

    'fork.moving.tag': 'الأكثر شيوعًا',
    'fork.moving.title': 'أنتقل للعيش هنا',
    'fork.moving.a': 'الفحص الطبي وتأشيرة الإقامة',
    'fork.moving.b': 'الهوية الإماراتية',
    'fork.moving.c': 'إيجاري، ديوا، البنك، الرخصة',
    'fork.moving.go': 'اعرض خطواتي التسع ←',

    'fork.resident.title': 'مقيم',
    'fork.resident.a': 'الهوية الإماراتية وإثبات الإقامة',
    'fork.resident.b': 'إيجاري وديوا والتأمين',
    'fork.resident.c': 'المدارس وهيئة المعرفة',
    'fork.resident.go': 'اعرض قائمتي ←',

    'city.label': 'أو لا تقرأ إطلاقًا',
    'city.title': 'ادخل إلى المكاتب بنفسك',
    'city.body':
      'مدينة صغيرة برسوم البكسل، هنا في هذه الصفحة. اطرق بابًا، اسأل سؤالك، واحصل على الإجابة نفسها بالمصدر نفسه وتاريخ التحقق نفسه.',
    'city.cta': 'ادخل المدينة ←',

    'storage.note':
      'متصفحك يمنع التخزين المحلي، لذا سيُنسى كل ما تضع عليه علامة عند إغلاق التبويب. كل شيء يعمل — لكنه لن يُحفظ.',

    'more.label': 'كل ما تبقّى',
    'more.heading': 'أسئلة أخرى يطرحها الناس',
    'more.intro':
      'هذه في ملف المحتوى نفسه، لكنها ليست ضمن المسار الذي اخترته. القاعدة نفسها تنطبق: كل إجابة تعرض مصدرها وتاريخ التحقق منها.',

    'elsewhere.label': 'المحتوى نفسه بطريقتين أخريين',
    'elsewhere.heading': 'اقرأه بالطريقة التي تناسبك',
    'elsewhere.game.label': 'اللعبة',
    'elsewhere.game.title': 'تجوّل في الحي ←',
    'elsewhere.game.body':
      'مدينة صغيرة برسوم البكسل تُفتح فوق هذه الصفحة. اطرق بابًا واقرأ الإجابة نفسها، بالمصدر نفسه والتاريخ نفسه. بلوحة المفاتيح أو باللمس.',
    'elsewhere.guide.label': 'الضمان',
    'elsewhere.guide.title': 'الدليل النصي البسيط ←',
    'elsewhere.guide.body':
      'كل إجابة بصيغة HTML دلالية: عناوين وروابط حقيقية، متوافقة مع قارئات الشاشة، بلا رسوم وبلا تعقيد.',

    'footer.disclaimer':
      'مشروع مجتمعي مستقل، غير تابع لأي جهة حكومية في دبي. لا يظهر في هذا الموقع أي شعار أو رمز أو ختم حكومي ولا أي هوية لونية رسمية.',
    'footer.verbatim':
      'الإجابات مخزّنة كبيانات وتُعرض حرفيًا. لا شيء في هذه الصفحة يُولَّد أو يُلخَّص أو يُعاد صياغته وقت التشغيل، ولا يُذكر أي رسم أو مدة أو قائمة مستندات لا يذكرها المصدر نفسه.',
    'footer.storage':
      'يُحفظ تقدّمك في هذا المتصفح فقط. لا يوجد حساب ولا خادم ولا يُرسَل أي شيء إلى أي جهة.',
    'footer.clear': 'امسح تقدّمي',

    /* journey chrome */
    'journey.path': 'مسارك',
    'journey.heading.sequential': 'الخطوات التسع بالترتيب',
    'journey.heading.list': 'قائمتك المختصرة',
    'journey.changeStatus': 'غيّر فئتي',
    'journey.resetPath': 'ابدأ هذا المسار من جديد',
    'journey.done': 'أنجزت {done} من {total}',
    'journey.stepOf': 'الخطوة {n} من {total}: ',
    'journey.expand': 'ما الذي تتطلبه',
    'journey.expandLocked': 'اقرأ عنها مسبقًا',
    'journey.collapse': 'إخفاء',
    'journey.markComplete': 'وضع علامة كمنجَزة',
    'journey.markIncomplete': 'إلغاء علامة الإنجاز',
    'journey.badge.current': 'أنت هنا',
    'journey.badge.complete': 'منجَزة',
    'journey.badge.locked': 'مقفلة',
    'journey.note.next': 'هذه هي الخطوة التالية التي عليك إنجازها.',
    'journey.note.blocksOne': 'تعطّل الخطوة {from}.',
    'journey.note.blocksRange': 'تعطّل الخطوات {from}–{to}.',
    'journey.note.locked': 'مقفلة — لا يمكنك البدء بها قبل إنجاز الخطوة {n}: {title}.',
    'journey.note.plane': 'أنجزت هذه بمجرد ركوبك الطائرة.',
    'journey.empty':
      'لم تُكتب بعد إجابة موثّقة لهذه الخطوة. بدلًا من التخمين، لا تقول هذه الصفحة شيئًا.',

    'answer.source': 'المصدر: ',
    'answer.noSource': 'لا يوجد رابط مصدر بعد — لا تعتمد على هذه الإجابة',
    'answer.checked': 'تاريخ التحقق {date}',

    /* the game */
    'hud.player': 'وافد جديد',
    'hud.unofficial': 'دليل غير رسمي',
    'hud.fictional': 'كل مكتب هنا خيالي',
    'hud.nextStep': 'الخطوة التالية',
    'hud.allDone': 'اكتمل المسار بالكامل.',
    'hud.pickPath': 'اختر فئتك في الصفحة أولًا.',
    'city.noEntries': 'لا توجد إجابات بعد',
    'city.oneQuestion': 'سؤال واحد',
    'city.questions': '{n} أسئلة',
    'city.enterPrompt': 'اضغط E أو Enter للدخول',
    'guide.offices': 'المكاتب',
    'guide.title': 'الدليل النصي البسيط',
  },
};

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/**
 * Look up a string, filling `{placeholders}` from `values`.
 *
 * A missing key returns the key itself rather than an empty string: a visible
 * `journey.badge.locked` on the page is a bug someone fixes, while a blank
 * space is a bug nobody notices.
 */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const table = STRINGS[current];
  const template = table[key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined ? whole : String(value);
  });
}

/** Read the stored language, falling back to the browser's own preference. */
export function readLang(storage: Pick<Storage, 'getItem'> | null): Lang {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage can throw outright in a locked-down browser; that is not an error.
  }
  const navLang = typeof navigator !== 'undefined' ? navigator.language : '';
  return navLang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function writeLang(storage: Pick<Storage, 'setItem'> | null, lang: Lang): void {
  try {
    storage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Same as progress: a browser blocking storage is a supported state.
  }
}
