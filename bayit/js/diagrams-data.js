/* Interactive diagrams: hand-drawn SVG scenes + clickable parts.
 * Each svg(P) gets a unique id prefix P so several copies can live on one page.
 * Hotspot: x,y in viewBox units; lp = label side (e/w/n/s); diff 1–3; tree = diagnosis tree id. */
(() => {
  'use strict';
  const HB = window.HB;

  const hatch = (P) => `<pattern id="${P}h" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" class="s-hatch"/></pattern>`;

  HB.DIAGRAMS = [
    /* ------------------------------------------------------------------ */
    {
      id: 'sink',
      title: 'מערכת כיור',
      sub: 'הזנת מים, ברז, סיפון וניקוז — חתך צד',
      icon: 'droplet',
      cat: 'אינסטלציה',
      viewBox: '0 0 640 520',
      legend: [['p-hot', 'מים חמים'], ['p-cold', 'מים קרים'], ['p-drain', 'ניקוז ואוורור']],
      svg: (P) => `
        <defs>${hatch(P)}</defs>
        <rect x="0" y="470" width="640" height="50" fill="url(#${P}h)"/>
        <rect x="530" y="0" width="110" height="470" class="s-wall"/>
        <rect x="530" y="0" width="110" height="470" fill="url(#${P}h)" opacity=".55"/>
        <line x1="0" y1="470" x2="640" y2="470" class="s-edge"/>
        <line x1="530" y1="0" x2="530" y2="470" class="s-edge"/>
        <!-- in-wall pipes -->
        <path d="M548 0V230H520" class="pipe p-hot" stroke-width="9"/>
        <path d="M566 0V270H520" class="pipe p-cold" stroke-width="9"/>
        <path d="M604 0V520" class="pipe p-drain" stroke-width="26" stroke-linecap="butt"/>
        <path d="M604 0V120" class="pipe p-vent" stroke-width="10" stroke-linecap="butt"/>
        <!-- cabinet -->
        <rect x="70" y="168" width="460" height="302" class="s-cab"/>
        <rect x="50" y="146" width="490" height="22" rx="3" class="s-counter"/>
        <!-- basin -->
        <path d="M112 140h316v8H112z" class="s-fixture"/>
        <path d="M120 148 138 262q4 16 22 16h220q18 0 22-16l18-114z" class="s-fixture"/>
        <path d="M131 222 140 262q3 10 20 10h220q17 0 20-10l9-40z" class="s-water"/>
        <line x1="131" y1="222" x2="409" y2="222" class="s-waterline"/>
        <rect x="250" y="272" width="40" height="8" rx="2" class="s-metal"/>
        <!-- silicone beads -->
        <path d="M108 146q4-7 9 0M423 146q4-7 9 0" class="s-bead"/>
        <!-- tailpiece + P-trap -->
        <path d="M270 282V352" class="pipe p-drain" stroke-width="18" stroke-linecap="butt"/>
        <path d="M270 350V396a40 40 0 0 0 80 0v-34h254" class="pipe p-drain" stroke-width="18" stroke-linecap="butt"/>
        <path d="M270 380v16a40 40 0 0 0 80 0v-16" class="pipe s-trapwater" stroke-width="8"/>
        <rect x="257" y="300" width="26" height="11" rx="2" class="s-nut"/>
        <rect x="257" y="345" width="26" height="12" rx="2" class="s-nut"/>
        <rect x="337" y="355" width="26" height="14" rx="2" class="s-nut"/>
        <rect x="514" y="351" width="14" height="22" rx="2" class="s-metal"/>
        <path d="M380 382 500 388" class="s-dim-line"/>
        <text x="440" y="404" class="s-dim rtl" text-anchor="middle">שיפוע ‎2%</text>
        <!-- faucet -->
        <rect x="452" y="130" width="36" height="16" rx="4" class="s-metal"/>
        <path d="M470 132V80q0-28-28-28h-92q-18 0-18 18v22" class="pipe s-chrome" stroke-width="14"/>
        <rect x="323" y="90" width="18" height="12" rx="3" class="s-metal-dark"/>
        <path d="M332 106V220" class="s-stream"/>
        <circle cx="470" cy="104" r="12" class="s-metal"/>
        <path d="M470 100 512 84" class="pipe s-chrome" stroke-width="8"/>
        <!-- supply lines + angle stops -->
        <path d="M464 168v8c0 40 26 54 50 54" class="pipe p-hot s-braid" stroke-width="7"/>
        <path d="M478 168v8c0 60 18 94 36 94" class="pipe p-cold s-braid" stroke-width="7"/>
        <g><rect x="508" y="222" width="22" height="16" rx="3" class="s-metal"/><circle cx="506" cy="230" r="8" class="s-handle-hot"/></g>
        <g><rect x="508" y="262" width="22" height="16" rx="3" class="s-metal"/><circle cx="506" cy="270" r="8" class="s-handle-cold"/></g>
        <text x="604" y="150" class="s-dim s-vert" text-anchor="middle" transform="rotate(-90 604 150)">אוורור ↑</text>
        <text x="604" y="440" class="s-dim s-vert" text-anchor="middle" transform="rotate(-90 604 440)">לביוב ↓</text>`,
      parts: [
        { id: 'aerator', x: 332, y: 96, lp: 'w', title: 'חסכם (מאוורר)', sum: 'רשת קטנה בקצה הפייה שמערבבת אוויר בזרם — חוסכת מים ומונעת התזות.', issues: ['זרם חלש או מתיז לצדדים — אבנית או חול ברשת', 'טפטוף מסביב לחסכם — אטם פנימי בלוי'], tip: 'השרייה של שעה בחומץ לבן ממיסה אבנית. הברג חזרה ביד בלבד — כלי עלול לשרוט את הציפוי.', diff: 1, tree: 'faucet', task: { title: 'הסרת אבנית מחסכמים', recur: 'm3', cat: 'אינסטלציה' } },
        { id: 'cartridge', x: 470, y: 104, lp: 'e', title: 'מחסנית וידית הברז', sum: 'מחסנית קרמית (35/40 מ״מ) בתוך גוף הברז מווסתת זרם וטמפרטורה. הידית רק מזיזה אותה.', issues: ['טפטוף מהפייה כשהברז סגור', 'ידית קשה, חורקת או לא חוזרת למקום', 'קשה לכוון טמפרטורה'], tip: 'קח את המחסנית הישנה לחנות. קוטר, גובה ומספר השיניים בציר חייבים להתאים בדיוק.', diff: 2, tree: 'faucet' },
        { id: 'supply', x: 487, y: 205, lp: 'w', title: 'צינורות הזנה גמישים', sum: 'צינורות קלועים (רקורדים) שמחברים את ברזי הניל לברז. נמצאים תחת לחץ מים קבוע, 24/7.', issues: ['חלודה או קרע בקליעה — סכנת פיצוץ', 'טפטוף באום החיבור'], tip: 'מומלץ להחליף כל 5–7 שנים גם בלי סימני בלאי. הצפה מרקורד שהתפוצץ היא נזק מים נפוץ מאוד.', diff: 1, tree: 'faucet', task: { title: 'בדיקת צינורות הזנה גמישים', recur: 'y1', cat: 'אינסטלציה' } },
        { id: 'stops', x: 514, y: 250, lp: 'w', title: 'ברזי ניל (ברזי זווית)', sum: 'ברזים קטנים ביציאה מהקיר. מאפשרים לנתק את המים לכיור בלבד בלי לסגור את הבית.', issues: ['הברז תקוע ולא מסתובב', 'טפטוף מציר הידית'], tip: 'פתח וסגור אותם פעם בחצי שנה — כך לא ייתקעו ביום שבאמת תצטרך אותם.', diff: 1, task: { title: 'הפעלת ברזי ניל (פתיחה/סגירה)', recur: 'm6', cat: 'אינסטלציה' } },
        { id: 'strainer', x: 270, y: 266, lp: 'e', title: 'פקק ניקוז ומסננת', sum: 'הפתח בתחתית הכיור. אטום לכיור בעזרת אטם גומי ואום הידוק מלמטה.', issues: ['דליפה בתחתית הכיור סביב הפקק', 'שאריות ושיער שמאטים את הניקוז'], tip: 'אם האטם נשחק — הסר, נקה היטב את הסיליקון הישן ואטום מחדש. אל תדלג על הניקוי.', diff: 2, tree: 'drain' },
        { id: 'tailpiece', x: 270, y: 326, lp: 'e', title: 'צינור יציאה ואומי הידוק', sum: 'צינור אנכי קצר בין הפקק לסיפון. מחובר באומים עם אטמים חרוטיים — בלי הדבקה.', issues: ['טפטוף באום — אטם חרוטי שזז או נסדק'], tip: 'הדק ביד ועוד רבע סיבוב. הידוק־יתר סודק את האום הפלסטי.', diff: 1, tree: 'faucet' },
        { id: 'trap', x: 310, y: 450, lp: 'e', title: 'סיפון (מלכודת מים)', sum: 'הקשת בצורת U שומרת תמיד מעט מים — "פקק מים" שחוסם ריחות ביוב מלעלות לבית.', issues: ['סתימה — רוב הסתימות בכיור נתקעות כאן', 'ריח ביוב — המים בסיפון התאדו או נשאבו'], tip: 'הנח דלי מתחת לפני פתיחה. ניקוי סיפון לוקח 10 דקות ופותר את רוב הסתימות בלי כימיקלים.', diff: 1, tree: 'drain' },
        { id: 'arm', x: 450, y: 362, lp: 'n', title: 'זרוע הסיפון ושיפוע', sum: 'הקטע האופקי עד הקיר. צריך שיפוע קל (כ־2%) לכיוון הקיר כדי שהמים יזרמו.', issues: ['ניקוז איטי — שיפוע הפוך או צינור שנפל', 'שומן מצטבר בקטע אופקי ארוך'], tip: 'כסיפון מפלסטיק "שוקע" עם הזמן — תמוך בו או קצר את הזרוע.', diff: 2 },
        { id: 'vent', x: 604, y: 54, lp: 'w', title: 'צינור אוורור', sum: 'מכניס אוויר למערכת הביוב כך שזרימה במעלה הקו לא "תשאב" את המים מהסיפון.', issues: ['גרגור בניקוז וריח ביוב — אוורור חסום'], tip: 'גרגור אחרי הדחת אסלה בכיור סמוך הוא סימן קלאסי לבעיית אוורור. זו עבודה לאינסטלטור.', diff: 3 },
        { id: 'seal', x: 112, y: 140, lp: 'n', title: 'איטום סיליקון', sum: 'פס סיליקון סניטרי בין שפת הכיור למשטח — מונע חדירת מים לארון ולשיש.', issues: ['פס מושחר, סדוק או מתקלף', 'נפיחות בתחתית הארון מתחת לשפת הכיור'], tip: 'סיליקון חדש מעל ישן לא נדבק. חתוך הכול, נקה באלכוהול, הדבק מסקינטייפ משני הצדדים ומרח.', diff: 1, task: { title: 'בדיקת איטום סיליקון בכיורים', recur: 'm6', cat: 'איטום' } },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'toilet',
      title: 'מיכל הדחה',
      sub: 'מנגנון מילוי, מנגנון הדחה ואטמים — מבט חתך',
      icon: 'toilet',
      cat: 'אינסטלציה',
      viewBox: '0 0 640 520',
      legend: [['p-cold', 'הזנת מים'], ['s-water', 'מים במיכל']],
      svg: (P) => `
        <defs>${hatch(P)}</defs>
        <rect x="0" y="0" width="68" height="480" class="s-wall"/>
        <rect x="0" y="0" width="68" height="480" fill="url(#${P}h)" opacity=".55"/>
        <rect x="0" y="480" width="640" height="40" fill="url(#${P}h)"/>
        <line x1="68" y1="0" x2="68" y2="480" class="s-edge"/><line x1="0" y1="480" x2="640" y2="480" class="s-edge"/>
        <!-- supply -->
        <path d="M30 0V380H66" class="pipe p-cold" stroke-width="9"/>
        <rect x="66" y="371" width="26" height="18" rx="3" class="s-metal"/>
        <rect x="74" y="352" width="10" height="22" rx="3" class="s-handle-cold"/>
        <path d="M92 380c60 0 112-6 112-40" class="pipe p-cold s-braid" stroke-width="7"/>
        <!-- bowl -->
        <path d="M180 338h300q22 0 18 24l-28 58q-15 50-70 56H260q-55-6-70-56l-28-58q-4-24 18-24z" class="s-fixture"/>
        <path d="M206 360h248l-22 44q-12 34-56 38h-92q-44-4-56-38z" class="s-water" opacity=".7"/>
        <rect x="272" y="470" width="116" height="10" rx="2" class="s-fixture"/>
        <!-- tank -->
        <rect x="150" y="70" width="360" height="252" rx="14" class="s-fixture s-glass"/>
        <rect x="158" y="128" width="344" height="186" rx="8" class="s-water"/>
        <line x1="158" y1="128" x2="502" y2="128" class="s-waterline"/>
        <path d="M150 112h12M498 112h12" class="s-dim-line"/>
        <text x="490" y="106" class="s-dim" text-anchor="end">MAX</text>
        <rect x="140" y="52" width="380" height="20" rx="6" class="s-counter"/>
        <!-- dual flush button -->
        <rect x="326" y="38" width="68" height="16" rx="8" class="s-chrome-fill"/>
        <line x1="360" y1="39" x2="360" y2="53" class="s-edge"/>
        <path d="M350 72V108M370 72V108" class="s-rod"/>
        <!-- fill valve -->
        <rect x="196" y="108" width="16" height="210" rx="4" class="s-plastic"/>
        <rect x="184" y="90" width="40" height="22" rx="5" class="s-plastic"/>
        <rect x="182" y="150" width="44" height="48" rx="8" class="s-float"/>
        <path d="M224 98q40-12 136-6" class="s-tube"/>
        <rect x="194" y="318" width="20" height="22" rx="3" class="s-metal"/>
        <!-- flush valve -->
        <rect x="330" y="108" width="60" height="190" rx="8" class="s-plastic"/>
        <rect x="352" y="86" width="16" height="26" rx="3" class="s-plastic"/>
        <rect x="322" y="294" width="76" height="10" rx="3" class="s-rubber"/>
        <rect x="340" y="322" width="40" height="18" rx="3" class="s-plastic"/>
        <!-- tank bolts -->
        <g class="s-metal-dark"><rect x="244" y="310" width="8" height="40" rx="2"/><rect x="238" y="340" width="20" height="8" rx="2"/>
        <rect x="468" y="310" width="8" height="40" rx="2"/><rect x="462" y="340" width="20" height="8" rx="2"/></g>`,
      parts: [
        { id: 'button', x: 360, y: 32, lp: 'e', title: 'לחצן הדחה כפול', sum: 'לחצן קטן = הדחה חסכונית (~3 ל׳), לחצן גדול = הדחה מלאה (~6 ל׳). מוטות מחברים אותו למנגנון ההדחה.', issues: ['הלחצן שוקע בלי התנגדות — מוט התנתק או נשבר', 'הלחצן נתקע למטה והמים זורמים'], tip: 'בדרך כלל מספיק לכוונן את אורך המוטות (מסתובבים או נחתכים) — אין צורך להחליף את כל המנגנון.', diff: 1, tree: 'toilet' },
        { id: 'fill', x: 204, y: 96, lp: 'w', title: 'מנגנון מילוי (ברז מצוף)', sum: 'נפתח כשמפלס המים יורד ונסגר כשהמצוף עולה. מכיל ממברנה קטנה ומסננת.', issues: ['המיכל מתמלא לאט — מסננת סתומה באבנית', 'רעש שריקה בזמן מילוי', 'לא נסגר — המים ממשיכים לגלוש'], tip: 'ניקוי המסננת בכניסה (אחרי סגירת ברז הניל) פותר הרבה מבעיות המילוי האיטי.', diff: 2, tree: 'toilet' },
        { id: 'float', x: 204, y: 174, lp: 'w', title: 'מצוף', sum: 'עולה עם המים וסוגר את מנגנון המילוי. גובה המצוף קובע את קו המים.', issues: ['המים עולים עד צינור הגלישה — המצוף גבוה מדי', 'הדחה חלשה — המצוף נמוך מדי'], tip: 'קו המים האידיאלי: כ־2 ס״מ מתחת לראש צינור הגלישה.', diff: 1, tree: 'toilet' },
        { id: 'overflow', x: 360, y: 90, lp: 'e', title: 'צינור גלישה', sum: 'צינור בטיחות: אם מנגנון המילוי לא נסגר, המים זורמים לאסלה במקום לגלוש לרצפה.', issues: ['מים זורמים ללא הפסקה לתוך הצינור'], tip: 'אם רואים מים נכנסים לצינור הגלישה — הבעיה במילוי/מצוף, לא במנגנון ההדחה.', diff: 1, tree: 'toilet' },
        { id: 'flush', x: 360, y: 200, lp: 'e', title: 'מנגנון הדחה (פעמון)', sum: 'כשלוחצים — המנגנון מתרומם ומשחרר את המים מהמיכל לאסלה, ואז יורד ואוטם.', issues: ['זרזיף קבוע בקערה', 'המנגנון לא מתרומם עד הסוף'], tip: 'רוב המנגנונים בישראל נשלפים בסיבוב רבע — אפשר לנקות ולהחליף אטם בלי לפרק את המיכל.', diff: 2, tree: 'toilet' },
        { id: 'gasket', x: 360, y: 299, lp: 'e', title: 'אטם תחתון', sum: 'טבעת גומי בבסיס מנגנון ההדחה. אחראית לכך שהמים יישארו במיכל.', issues: ['אטם שהתקשה או התעוות — דליפה שקטה ובזבוז מים'], tip: 'בדיקת צבע: טפטף צבע מאכל למיכל. אם אחרי 15 דק׳ יש צבע בקערה — האטם דולף.', diff: 2, tree: 'toilet' },
        { id: 'level', x: 470, y: 128, lp: 'e', title: 'קו המים', sum: 'מפלס המים המלא. מסומן לרוב בפנים המיכל (MAX).', issues: ['גבוה מדי = גלישה מתמדת', 'נמוך מדי = הדחה חלשה'], tip: 'סימון בטוש על דופן המיכל עוזר לראות אם המפלס יורד בלילה (דליפה).', diff: 1, tree: 'toilet' },
        { id: 'angle', x: 79, y: 362, lp: 's', title: 'ברז ניל וצינור הזנה', sum: 'ברז הניתוק של האסלה והצינור הגמיש למנגנון המילוי.', issues: ['טפטוף מהאום', 'צינור קלוע חלוד'], tip: 'לפני כל עבודה במיכל — סגור את ברז הניל והדח כדי לרוקן.', diff: 1, tree: 'toilet' },
        { id: 'bolts', x: 472, y: 332, lp: 'e', title: 'ברגי חיבור מיכל־אסלה', sum: 'שני ברגים עם אטמי גומי שמחזיקים את המיכל על האסלה (במיכל חיצוני).', issues: ['טפטוף מאחורי האסלה אחרי כל הדחה'], tip: 'הדק לסירוגין, חצי סיבוב בכל צד. הידוק־יתר עלול לסדוק את הקרמיקה!', diff: 2, tree: 'toilet' },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'heater',
      title: 'דוד חשמל / שמש',
      sub: 'גוף חימום, תרמוסטט, אנודה ושסתום ביטחון',
      icon: 'flame',
      cat: 'אינסטלציה',
      viewBox: '0 0 640 540',
      legend: [['p-hot', 'מים חמים'], ['p-cold', 'מים קרים'], ['p-wire', 'חשמל']],
      svg: (P) => `
        <defs>
          <linearGradient id="${P}g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color:var(--d-hot);stop-opacity:.5"/>
            <stop offset=".55" style="stop-color:var(--d-hot);stop-opacity:.18"/>
            <stop offset="1" style="stop-color:var(--d-cold);stop-opacity:.4"/>
          </linearGradient>
          <pattern id="${P}f" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" class="s-foam-dot"/><circle cx="9" cy="9" r="1.2" class="s-foam-dot"/></pattern>
          ${hatch(P)}
        </defs>
        <rect x="0" y="508" width="640" height="32" fill="url(#${P}h)"/>
        <line x1="0" y1="508" x2="640" y2="508" class="s-edge"/>
        <!-- pipes -->
        <path d="M380 86V30H640" class="pipe p-hot" stroke-width="10"/>
        <path d="M640 150H414" class="pipe p-hot" stroke-width="7" stroke-dasharray="2 0"/>
        <path d="M414 400H640" class="pipe p-cold" stroke-width="7"/>
        <path d="M0 420H226" class="pipe p-cold" stroke-width="10"/>
        <path d="M226 420h30V140" class="pipe p-cold" stroke-width="5" opacity=".6"/>
        <!-- shutoff + safety valve -->
        <rect x="44" y="408" width="30" height="24" rx="4" class="s-metal"/>
        <rect x="52" y="386" width="14" height="24" rx="3" class="s-handle-cold"/>
        <rect x="96" y="404" width="40" height="32" rx="5" class="s-metal-dark"/>
        <path d="M116 436V476" class="pipe p-drain" stroke-width="6"/>
        <path d="M116 482v8M116 496v4" class="s-stream"/>
        <!-- tank -->
        <rect x="200" y="60" width="240" height="410" rx="40" class="s-shell"/>
        <rect x="210" y="70" width="220" height="390" rx="34" fill="url(#${P}f)"/>
        <rect x="226" y="86" width="188" height="358" rx="28" class="s-tank"/>
        <rect x="226" y="86" width="188" height="358" rx="28" fill="url(#${P}g)"/>
        <text x="320" y="130" class="s-dim" text-anchor="middle">‎~60°C</text>
        <text x="320" y="262" class="s-dim" text-anchor="middle">‎~25°C</text>
        <!-- anode / element / thermostat -->
        <rect x="273" y="290" width="12" height="154" rx="6" class="s-anode"/>
        <path d="M300 444V336q0-20 20-20t20 20v108" class="pipe s-element" stroke-width="7"/>
        <rect x="353" y="376" width="9" height="68" rx="4" class="s-metal"/>
        <rect x="256" y="440" width="128" height="12" rx="4" class="s-metal-dark"/>
        <rect x="266" y="470" width="108" height="32" rx="6" class="s-plastic"/>
        <!-- switch + timer -->
        <path d="M100 196V250q0 230 186 230" class="pipe p-wire" stroke-width="3" stroke-dasharray="6 5"/>
        <rect x="36" y="128" width="88" height="70" rx="10" class="s-fixture"/>
        <rect x="46" y="138" width="44" height="20" rx="3" class="s-lcd"/>
        <text x="68" y="153" class="s-lcd-t" text-anchor="middle">00:45</text>
        <circle cx="106" cy="148" r="6" class="s-led"/>
        <rect x="48" y="168" width="64" height="20" rx="4" class="s-metal"/>`,
      parts: [
        { id: 'switch', x: 80, y: 163, lp: 's', title: 'מפסק דוד וטיימר', sum: 'מפסק דו־קוטבי עם נורית, לרוב עם שעון שבת/טיימר. מנתק את גוף החימום מהחשמל.', issues: ['הנורית לא נדלקת — מא״ז הדוד בלוח למטה', 'הטיימר מאופס אחרי הפסקת חשמל'], tip: 'דוד 150 ל׳ צריך כ־45–60 דק׳ חימום לכמות של 2 מקלחות. טיימר חכם חוסך מאות ₪ בשנה.', diff: 1, tree: 'heater' },
        { id: 'hotout', x: 380, y: 40, lp: 'e', title: 'יציאת מים חמים', sum: 'המים החמים עולים למעלה (חום עולה), ולכן היציאה לבית תמיד בראש הדוד.', issues: ['טפטוף בחיבור — אום או רקורד רופף'], tip: 'בידוד צינור היציאה בשרוול ספוג מקטין איבוד חום בדרך למקלחת.', diff: 1, tree: 'heater' },
        { id: 'solar', x: 528, y: 150, lp: 's', title: 'חיבור לקולטים (דוד שמש)', sum: 'מים קרים יורדים לקולטים בגג, מתחממים ועולים חזרה לחלק העליון של הדוד (תרמוסיפון).', issues: ['אין מים חמים ביום שמשי — אוויר בקולטים או קולטים מלוכלכים', 'דליפה מצינורות הגג'], tip: 'ניקוי זכוכית הקולטים פעם בשנה (בעיקר אחרי אובך) משפר משמעותית את החימום.', diff: 2, tree: 'heater', task: { title: 'ניקוי קולטי דוד השמש', recur: 'y1', cat: 'חוץ ומרפסות' } },
        { id: 'insul', x: 216, y: 230, lp: 'w', title: 'בידוד', sum: 'שכבת קצף פוליאוריטן בין המעטפת למיכל — שומרת על חום המים במשך שעות.', issues: ['מעטפת חלודה או חמה למגע — בידוד שנפגע'], tip: 'דוד שהמעטפת שלו חמה במיוחד מבזבז חשמל — שווה לשקול החלפה.', diff: 3, tree: 'heater' },
        { id: 'anode', x: 279, y: 320, lp: 'w', title: 'אנודת מגנזיום', sum: 'מוט "מתקרבן": הוא מחליד במקום המיכל, וכך מאריך את חיי הדוד בשנים.', issues: ['ריח ביצים סרוחות מהמים החמים', 'מים חומים/חלודים — האנודה נאכלה'], tip: 'במים הקשים בישראל, בדוק כל 2–3 שנים. אנודה ב־₪60 יכולה לחסוך דוד ב־₪2,500.', diff: 3, task: { title: 'בדיקת/החלפת אנודה בדוד', recur: 'y2', cat: 'אינסטלציה' } },
        { id: 'element', x: 320, y: 312, lp: 'n', title: 'גוף חימום', sum: 'סליל חשמלי (לרוב 2.5 קילוואט) שמחמם את המים. מותקן על פלאנג׳ בתחתית הדוד.', issues: ['אבנית עבה — חימום איטי ורעשי רתיחה', 'גוף חימום שרוף — מים קרים לגמרי', 'הפחת קופץ כשמדליקים את הדוד'], tip: 'ההחלפה מחייבת ריקון הדוד וניתוק חשמל. מומלץ להיעזר באיש מקצוע.', diff: 3, tree: 'heater' },
        { id: 'thermo', x: 358, y: 400, lp: 'e', title: 'תרמוסטט', sum: 'חיישן בתוך שרוול שמנתק את גוף החימום כשהמים מגיעים לטמפרטורה (כ־60°C).', issues: ['מים רותחים / אדים מהברז — תרמוסטט תקוע (מסוכן!)', 'מים פושרים בלבד — תרמוסטט מכוון נמוך'], tip: 'אל תכוון מתחת ל־55°C — טמפרטורה נמוכה מעודדת התפתחות חיידקי לגיונלה.', diff: 3, tree: 'heater' },
        { id: 'safety', x: 116, y: 420, lp: 'n', title: 'שסתום ביטחון ואל־חוזר', sum: 'משחרר לחץ עודף כשהמים מתחממים ומתפשטים, ומונע ממים חמים לחזור לרשת.', issues: ['טפטוף קל בזמן חימום — תקין', 'זרם קבוע — השסתום תקול או לחץ רשת גבוה'], tip: 'לעולם אל תחסום את יציאת השסתום! דוד בלי שחרור לחץ הוא סכנה ממשית.', diff: 3, tree: 'heater' },
        { id: 'inlet', x: 59, y: 420, lp: 's', title: 'ברז ניתוק מים קרים', sum: 'הברז הראשי של הדוד. סוגרים אותו לפני כל טיפול.', issues: ['ברז תקוע שלא נסגר עד הסוף'], tip: 'סמן את הברז בתווית — במקרה חירום לא תרצה לחפש איזה ברז שייך לדוד.', diff: 1, tree: 'heater' },
        { id: 'cover', x: 320, y: 486, lp: 'e', title: 'מכסה חשמל ופלאנג׳', sum: 'מכסה מגן מעל חיבורי החשמל של גוף החימום והתרמוסטט.', issues: ['סימני פיח או ריח שרוף — לנתק מיד ולהזמין חשמלאי'], tip: 'לעולם אל תפתח את המכסה כשהמפסק דלוק. מתח 230V על מתכת רטובה.', diff: 3, tree: 'heater' },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'panel',
      title: 'לוח חשמל ביתי',
      sub: 'מפסק ראשי, ממסר פחת ומא״זים',
      icon: 'zap',
      cat: 'חשמל',
      viewBox: '0 0 640 520',
      legend: [['p-wire-l', 'פאזה'], ['p-wire-n', 'אפס'], ['p-wire-g', 'הארקה']],
      svg: () => {
        const brk = [];
        const names = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
        for (let i = 0; i < 12; i++) {
          const x = 96 + i * 37; const off = i === 7;
          brk.push(`<g><rect x="${x}" y="206" width="33" height="92" rx="4" class="s-module"/>
            <rect x="${x + 10}" y="${off ? 254 : 222}" width="13" height="26" rx="3" class="${off ? 's-lever-off' : 's-lever'}"/>
            <rect x="${x + 6}" y="284" width="21" height="7" rx="2" class="${off ? 's-flag-off' : 's-flag-on'}"/>
            <text x="${x + 16.5}" y="320" class="s-dim" text-anchor="middle">${names[i]}</text></g>`);
        }
        const wires = [];
        for (let i = 0; i < 12; i++) {
          const x = 112 + i * 37;
          wires.push(`<path d="M${x} 298V330q0 40 ${-x + 140 + i * 12} 70V412" class="pipe p-wire-n" stroke-width="2.4" opacity=".75"/>`);
        }
        return `
        <rect x="60" y="24" width="520" height="472" rx="16" class="s-panel"/>
        <rect x="76" y="40" width="488" height="440" rx="10" class="s-panel-in"/>
        <rect x="82" y="98" width="476" height="12" class="s-rail"/><rect x="82" y="246" width="476" height="12" class="s-rail"/>
        <!-- row 1 -->
        <rect x="96" y="58" width="96" height="92" rx="5" class="s-module s-main"/>
        <rect x="132" y="70" width="24" height="34" rx="4" class="s-lever"/>
        <text x="144" y="138" class="s-dim rtl" text-anchor="middle">ראשי 40A</text>
        <rect x="200" y="58" width="96" height="92" rx="5" class="s-module"/>
        <rect x="236" y="70" width="24" height="34" rx="4" class="s-lever"/>
        <circle cx="280" cy="118" r="8" class="s-test"/><text x="280" y="122" class="s-test-t" text-anchor="middle">T</text>
        <text x="238" y="138" class="s-dim rtl" text-anchor="middle">פחת 30mA</text>
        <rect x="304" y="58" width="48" height="92" rx="5" class="s-module"/>
        <rect x="316" y="76" width="24" height="12" rx="3" class="s-ok-window"/>
        <text x="328" y="138" class="s-dim" text-anchor="middle">SPD</text>
        <rect x="370" y="58" width="176" height="92" rx="8" class="s-blank"/>
        <text x="458" y="108" class="s-dim rtl" text-anchor="middle">מקום שמור להרחבה</text>
        <!-- row 2 breakers -->
        ${brk.join('')}
        <!-- wires to bars (behind the label strip) -->
        ${wires.join('')}
        <!-- map label strip -->
        <rect x="96" y="330" width="448" height="40" rx="5" class="s-label-strip"/>
        <text x="320" y="355" class="s-dim rtl" text-anchor="middle">1-2 תאורה · 3-5 שקעים · 6 מטבח · 7 תנור · 8 מזגן · 9 דוד · 10 מדיח · 11-12 רזרבה</text>
        <path d="M144 150V180H120V412" class="pipe p-wire-l" stroke-width="4"/>
        <path d="M248 150V176" class="pipe p-wire-l" stroke-width="4"/>
        <path d="M520 400V440" class="pipe p-wire-g" stroke-width="4"/>
        <!-- bars -->
        <rect x="110" y="412" width="250" height="18" rx="4" class="s-bar-n"/>
        ${Array.from({ length: 11 }, (_, i) => `<circle cx="${124 + i * 22}" cy="421" r="4.5" class="s-screw"/>`).join('')}
        <rect x="390" y="412" width="150" height="18" rx="4" class="s-bar-g"/>
        ${Array.from({ length: 6 }, (_, i) => `<circle cx="${404 + i * 24}" cy="421" r="4.5" class="s-screw"/>`).join('')}
        <path d="M430 412V380M460 412V384M490 412V378" class="pipe p-wire-g" stroke-width="2.4" opacity=".8"/>`;
      },
      parts: [
        { id: 'main', x: 144, y: 87, lp: 's', title: 'מפסק ראשי', sum: 'מנתק את כל הבית בבת אחת. חוסם זרם יתר של הדירה כולה.', issues: ['קופץ כשהרבה מכשירים פועלים — עומס על החיבור'], tip: 'הכר את המיקום שלו לפני שיש חירום. בהצפה או ריח שרוף — מורידים אותו קודם כל.', diff: 1, tree: 'electric' },
        { id: 'rcd', x: 248, y: 87, lp: 's', title: 'ממסר פחת', sum: 'מזהה זליגת זרם (למשל דרך גוף אדם) ומנתק תוך 30 מילישניות. מציל חיים.', issues: ['קופץ מיד — תקלה באחד המעגלים או מכשיר', 'קופץ בגשם — רטיבות בשקע/גוף תאורה חיצוני'], tip: 'לעולם אל תעקוף פחת. אם הוא קופץ — יש סיבה.', diff: 1, tree: 'electric' },
        { id: 'test', x: 280, y: 118, lp: 'e', title: 'לחצן בדיקה (T)', sum: 'מדמה זליגה. לחיצה צריכה להפיל את הפחת מיד.', issues: ['לחיצה לא מפילה — הפחת תקול ואינו מגן!'], tip: 'בדוק פעם בחודש. זו אחת המשימות החשובות ביותר בבית.', diff: 1, task: { title: 'בדיקת ממסר פחת (לחיצה על TEST)', recur: 'm1', cat: 'חשמל' } },
        { id: 'spd', x: 328, y: 82, lp: 'n', title: 'מגן נחשולי מתח (SPD)', sum: 'סופג קפיצות מתח מברקים ומהרשת, ומגן על מכשירים רגישים.', issues: ['חלון החיווי אדום — המגן מיצה את עצמו וצריך החלפה'], tip: 'אחרי סופת ברקים — הצץ בחלון החיווי.', diff: 3 },
        { id: 'breakers', x: 186, y: 236, lp: 'n', title: 'מא״זים (מפסקים אוטומטיים)', sum: 'כל מא״ז מגן על מעגל אחד (תאורה, שקעים, מזגן) מפני עומס וקצר.', issues: ['מא״ז שקופץ שוב ושוב — עומס או קצר במעגל'], tip: '10A לתאורה, 16A לשקעים, 20–25A למזגנים ולתנור. אסור להחליף למא״ז גדול יותר "כדי שלא יקפוץ".', diff: 1, tree: 'electric' },
        { id: 'tripped', x: 371, y: 267, lp: 'e', title: 'מא״ז שנפל', sum: 'הידית למטה והחלון אדום — המעגל מנותק. כאן: מעגל 8 (מזגן).', issues: ['נופל מיד לאחר הרמה — קצר; אל תתעקש'], tip: 'נתק את המכשירים במעגל, הרם את המא״ז, וחבר אחד־אחד כדי לאתר את האשם.', diff: 1, tree: 'electric' },
        { id: 'map', x: 120, y: 350, lp: 'n', title: 'מפת מעגלים', sum: 'תווית שמפרטת איזה מא״ז שייך לאיזה אזור בבית.', issues: ['לוח בלי סימון = ניחושים בזמן תקלה'], tip: 'בצע "מיפוי": הורד מא״ז אחד בכל פעם ובדוק מה כבה. 20 דקות שחוסכות שעות.', diff: 1, task: { title: 'מיפוי ושילוט מעגלים בלוח החשמל', recur: '', cat: 'חשמל' } },
        { id: 'neutral', x: 230, y: 421, lp: 's', title: 'פס אפס', sum: 'פס מתכת שאליו מתחברים כל מוליכי האפס (כחולים) של המעגלים.', issues: ['ברג רופף — הבהובים, חימום וריח'], tip: 'עבודה בתוך הלוח מותרת לחשמלאי מוסמך בלבד.', diff: 3 },
        { id: 'ground', x: 465, y: 421, lp: 's', title: 'פס הארקה', sum: 'מחבר את כל מוליכי ההארקה (צהוב־ירוק) לאלקטרודת ההארקה של המבנה.', issues: ['הארקה חסרה — הפחת לא יכול להגן כמו שצריך'], tip: 'חשמלאי יכול למדוד את לולאת התקלה ולוודא שההארקה תקינה. מומלץ כל 5 שנים.', diff: 3, task: { title: 'בדיקת מתקן חשמל ע״י חשמלאי', recur: 'y3', cat: 'חשמל' } },
      ],
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'wall',
      title: 'שלד קיר גבס',
      sub: 'מסלולים, ניצבים, חיזוקים ופתח — מבט חזית',
      icon: 'wall',
      cat: 'נגרות ומבנה',
      viewBox: '0 0 640 480',
      legend: [['s-steel', 'פרופיל פח'], ['s-wood', 'עץ'], ['s-board', 'לוח גבס']],
      svg: (P) => {
        const studs = [40, 150, 260, 410, 520, 598];
        const studSvg = studs.map((x) => `<rect x="${x}" y="52" width="12" height="376" class="s-steel"/>
          <ellipse cx="${x + 6}" cy="160" rx="3" ry="8" class="s-hole"/><ellipse cx="${x + 6}" cy="310" rx="3" ry="8" class="s-hole"/>`).join('');
        const screws = [];
        for (let y = 70; y < 420; y += 34) { screws.push(`<circle cx="526" cy="${y}" r="2.6" class="s-screw"/><circle cx="604" cy="${y}" r="2.6" class="s-screw"/><circle cx="416" cy="${y + 17}" r="2.6" class="s-screw"/>`); }
        return `
        <defs>${hatch(P)}
          <pattern id="${P}w" width="24" height="14" patternUnits="userSpaceOnUse"><path d="M0 7q6-7 12 0t12 0" class="s-wool"/></pattern>
        </defs>
        <rect x="0" y="0" width="640" height="40" fill="url(#${P}h)"/>
        <rect x="0" y="440" width="640" height="40" fill="url(#${P}h)"/>
        <line x1="0" y1="40" x2="640" y2="40" class="s-edge"/><line x1="0" y1="440" x2="640" y2="440" class="s-edge"/>
        <rect x="52" y="52" width="98" height="376" class="s-ins"/>
        <rect x="52" y="52" width="98" height="376" fill="url(#${P}w)"/>
        <rect x="30" y="40" width="580" height="12" class="s-steel s-track"/>
        <rect x="30" y="428" width="580" height="12" class="s-steel s-track"/>
        ${studSvg}
        <!-- opening -->
        <rect x="272" y="150" width="138" height="12" class="s-steel"/>
        <rect x="335" y="52" width="12" height="98" class="s-steel"/>
        <path d="M284 428V172h114v256" class="s-frame"/>
        <!-- blocking -->
        <rect x="162" y="218" width="98" height="34" rx="2" class="s-wood"/>
        <path d="M170 228h82M170 240h82" class="s-grain"/>
        <!-- electrical box + conduit -->
        <path d="M210 320q-14-40 8-80t-6-90q-12-50 4-98" class="pipe s-conduit" stroke-width="7"/>
        <rect x="194" y="318" width="34" height="34" rx="4" class="s-ebox"/>
        <circle cx="211" cy="335" r="7" class="s-hole"/>
        <!-- board -->
        <rect x="410" y="52" width="110" height="376" class="s-board"/>
        <rect x="520" y="52" width="90" height="376" class="s-board"/>
        <rect x="514" y="52" width="12" height="376" class="s-tape"/>
        ${screws.join('')}
        <!-- dimension -->
        <path d="M156 462H266M156 456v12M266 456v12" class="s-dim-line s-dim-strong"/>
        <text x="211" y="458" class="s-dim rtl" text-anchor="middle">40–60 ס״מ</text>`;
      },
      parts: [
        { id: 'top', x: 100, y: 46, lp: 's', title: 'מסלול עליון', sum: 'פרופיל U מפח מגולוון שמעוגן לתקרה. הניצבים "יושבים" בתוכו.', issues: ['סדק לאורך התקרה — המסלול לא עוגן מספיק או חסר סרט אקוסטי'], tip: 'עגן כל 60 ס״מ לפחות, והדבק סרט ספוג מתחת לפרופיל להפחתת רעשים וסדקים.', diff: 2 },
        { id: 'bottom', x: 100, y: 434, lp: 'n', title: 'מסלול תחתון', sum: 'פרופיל U מעוגן לרצפה. הבסיס של כל הקיר.', issues: ['רטיבות בתחתית הקיר — חסר איטום מתחת למסלול בחדרים רטובים'], tip: 'בחדר רטוב — השתמש בלוח ירוק (עמיד מים) ובאיטום מתחת למסלול.', diff: 2, tree: 'damp' },
        { id: 'stud', x: 156, y: 290, lp: 'e', title: 'ניצב (סטאד)', sum: 'פרופיל C אנכי. המרווח הסטנדרטי בין ניצבים: 40–60 ס״מ.', issues: ['קיר "רועד" כשנוגעים — מרווח גדול מדי בין ניצבים'], tip: 'מצא ניצב עם מגנט: הוא נמשך לראשי הברגים שבלוח הגבס.', diff: 2 },
        { id: 'ins', x: 100, y: 170, lp: 's', title: 'בידוד צמר סלעים', sum: 'ממלא את החלל שבין הניצבים — מבודד רעש וחום ומשפר עמידות באש.', issues: ['שומעים כל מילה מהחדר הסמוך — חלל ריק בלי בידוד'], tip: 'צמר סלעים בצפיפות 40 ק״ג/מ״ק הוא הסטנדרט לבידוד אקוסטי בין חדרים.', diff: 1 },
        { id: 'blocking', x: 211, y: 235, lp: 'n', title: 'חיזוק עץ לתלייה', sum: 'קורת עץ שמותקנת בין ניצבים לפני סגירת הקיר — נקודת עיגון חזקה לטלוויזיה, ארון או מדף.', issues: ['מדף כבד שנתלה על דיבל בגבס בלבד — נשלף עם הזמן'], tip: 'צלם את הקיר לפני הסגירה, עם מטר מתקפל בתמונה. תודה לעצמך בעוד 5 שנים.', diff: 2 },
        { id: 'ebox', x: 211, y: 335, lp: 's', title: 'קופסת חשמל וצנרת', sum: 'קופסה לשקע/מפסק בתוך הקיר, עם צינור שרשורי שעובר דרך החורים בניצבים.', issues: ['קופסה שמתנדנדת — לא קובעה ללוח'], tip: 'קדיחה בקיר גבס? הימנע מקווים אנכיים מעל/מתחת לשקעים — שם עוברים הכבלים.', diff: 2 },
        { id: 'header', x: 376, y: 156, lp: 'n', title: 'משקוף עליון לפתח', sum: 'פרופיל אופקי מעל פתח הדלת, עם ניצב קצר שממשיך עד התקרה.', issues: ['סדקים אלכסוניים מפינות הדלת — פתח שלא חוזק'], tip: 'בפתח לדלת כבדה — הכנס פרופיל עץ בתוך הניצבים שבצדי הפתח.', diff: 2, tree: 'door' },
        { id: 'frame', x: 300, y: 300, lp: 'e', title: 'משקוף דלת', sum: 'המסגרת שאליה מחוברים צירי הדלת והנגדית של המנעול.', issues: ['הדלת משתפשפת — המשקוף זז או הצירים רפויים'], tip: 'ברג ארוך (70 מ״מ) בציר העליון, שנכנס עד הניצב, מיישר דלת "צונחת".', diff: 2, tree: 'door' },
        { id: 'board', x: 466, y: 270, lp: 'e', title: 'לוח גבס וברגים', sum: 'לוח 12.5 מ״מ שמוברג לניצבים כל 25–30 ס״מ. ראש הבורג צריך לשקוע מעט, בלי לקרוע את הנייר.', issues: ['"פטריות" — ראשי ברגים בולטים דרך הצבע', 'חור מידית דלת'], tip: 'לתלייה בגבס: דיבל פרפר/מתכת מחזיק עד ~15 ק״ג. מעבר לזה — רק לניצב או לחיזוק.', diff: 1 },
        { id: 'joint', x: 520, y: 200, lp: 'e', title: 'מישק ונייר שריון', sum: 'התפר בין שני לוחות: ממלאים מרק, מטביעים סרט (נייר/רשת) ומחליקים בשתי שכבות.', issues: ['סדק ישר לאורך התפר — סרט חסר או מרק דק מדי'], tip: 'שלוש שכבות דקות עדיפות על שכבה עבה אחת. ליטוש קל בנייר 120 בין שכבות.', diff: 2 },
      ],
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'water',
      title: 'מערכת מים ראשית',
      sub: 'ברז ראשי, שעון מים, מסנן, מקטין לחץ ומחלק — ארון המים',
      icon: 'gauge',
      cat: 'אינסטלציה',
      viewBox: '0 0 640 420',
      legend: [['p-cold', 'מים קרים']],
      svg: (P) => {
        const outs = [['מטבח', 130], ['אמבטיה', 175], ['שירותים', 220], ['דוד', 265], ['מרפסת', 310]];
        return `
        <defs>${hatch(P)}</defs>
        <rect x="0" y="380" width="640" height="40" fill="url(#${P}h)"/>
        <line x1="0" y1="380" x2="640" y2="380" class="s-edge"/>
        <rect x="16" y="40" width="608" height="334" rx="8" class="s-cab"/>
        <text x="320" y="64" class="s-dim rtl" text-anchor="middle">ארון המים — בדרך כלל בחדר המדרגות</text>
        <!-- main line -->
        <path d="M0 230H470" class="pipe p-cold" stroke-width="12"/>
        <!-- main valve -->
        <rect x="74" y="216" width="34" height="28" rx="5" class="s-metal"/>
        <rect x="64" y="196" width="54" height="12" rx="4" class="s-handle-cold"/>
        <rect x="88" y="206" width="6" height="12" class="s-metal-dark"/>
        <!-- meter -->
        <circle cx="175" cy="230" r="36" class="s-fixture"/>
        <circle cx="175" cy="230" r="27" class="s-plastic"/>
        <rect x="152" y="214" width="46" height="14" rx="2" class="s-lcd"/>
        <text x="175" y="225" class="s-lcd-t" text-anchor="middle">00412</text>
        <path d="M175 244 l8 -6" stroke="var(--d-hot)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="175" cy="244" r="3" class="s-metal-dark"/>
        <!-- Y strainer -->
        <rect x="244" y="216" width="40" height="28" rx="5" class="s-metal"/>
        <path d="M266 240 284 274" class="pipe s-metal-stroke" stroke-width="16"/>
        <rect x="278" y="268" width="16" height="12" rx="2" transform="rotate(-30 286 274)" class="s-metal-dark"/>
        <!-- pressure reducer + gauge -->
        <path d="M330 244V214q0-26 24-26t24 26v30z" class="s-metal"/>
        <rect x="350" y="150" width="8" height="40" class="s-metal-dark"/>
        <circle cx="354" cy="138" r="22" class="s-fixture"/>
        <path d="M340 146a16 16 0 0 1 28 0" class="s-dim-line s-dim-strong"/>
        <path d="M354 138 364 128" stroke="var(--d-hot)" stroke-width="2.5" stroke-linecap="round"/>
        <text x="354" y="155" class="s-dim" text-anchor="middle" style="font-size:9px">bar</text>
        <!-- manifold -->
        <rect x="470" y="110" width="24" height="220" rx="6" class="s-metal"/>
        ${outs.map(([n, y]) => `<path d="M494 ${y}H640" class="pipe p-cold" stroke-width="7"/>
          <rect x="520" y="${y - 9}" width="20" height="18" rx="3" class="s-metal-dark"/>
          <rect x="526" y="${y - 20}" width="8" height="12" rx="2" class="s-handle-cold"/>
          <text x="612" y="${y - 10}" class="s-dim rtl" text-anchor="middle">${n}</text>`).join('')}
`;
      },
      parts: [
        { id: 'city', x: 44, y: 230, lp: 's', title: 'כניסה מהרשת', sum: 'צינור האספקה של תאגיד המים. עד שעון המים, האחריות היא של התאגיד.', issues: ['דליפה לפני השעון — לדווח לתאגיד, לא לתקן לבד', 'לחץ חלש בכל הבניין — תקלה ברשת'], tip: 'שמור את מספר המוקד של תאגיד המים בכרטיס החירום שבלוח הבקרה.', diff: 3, tree: 'pressure' },
        { id: 'main', x: 91, y: 202, lp: 'n', title: 'ברז ראשי לדירה', sum: 'סוגר את המים לכל הדירה. זה הדבר הראשון שעושים בהצפה.', issues: ['ברז תקוע שלא הוזז שנים', 'טפטוף מציר הידית'], tip: 'סגור ופתח אותו פעם בחצי שנה כדי שלא ייתקע. הדבק עליו תווית עם מספר הדירה.', diff: 1, task: { title: 'בדיקת ברז מים ראשי (סגירה ופתיחה)', recur: 'm6', cat: 'אינסטלציה' } },
        { id: 'meter', x: 175, y: 268, lp: 's', title: 'שעון מים', sum: 'מודד את צריכת המים. הוא גם גלאי הדליפות הזול ביותר שיש.', issues: ['חשבון מים גבוה בלי הסבר — דליפה סמויה'], tip: 'סגור את כל הברזים בבית ורשום את הקריאה. אחרי שעה בלי שימוש — אם המספר השתנה, יש דליפה.', diff: 1, tree: 'damp', task: { title: 'בדיקת דליפה סמויה בשעון המים', recur: 'm3', cat: 'אינסטלציה' } },
        { id: 'filter', x: 264, y: 230, lp: 'n', title: 'מסנן ראשי (פילטר Y)', sum: 'רשת שעוצרת חול וחלודה מהרשת לפני שהם מגיעים לברזים ולדוד.', issues: ['לחץ חלש בכל הבית — מסנן סתום'], tip: 'ניקוי פעם בשנה: סגור את הברז הראשי, פתח את הפקק בתחתית המסנן ושטוף את הרשת.', diff: 2, tree: 'pressure', task: { title: 'ניקוי מסנן מים ראשי', recur: 'y1', cat: 'אינסטלציה' } },
        { id: 'prv', x: 354, y: 228, lp: 's', title: 'מקטין לחץ', sum: 'מוריד לחץ רשת גבוה ללחץ בטוח לדירה (3–4 בר). מגן על הברזים, הצנרת והדוד.', issues: ['רעשי דפיקה בצנרת כשסוגרים ברז', 'שסתום הביטחון של הדוד מטפטף כל הזמן'], tip: 'לחץ מעל 6 בר מקצר את חיי הדוד והמערבלים. מקטין לחץ חוסך תיקונים יקרים.', diff: 3, tree: 'pressure' },
        { id: 'gauge', x: 354, y: 138, lp: 'w', title: 'מד לחץ', sum: 'מציג את הלחץ אחרי המקטין.', issues: ['מחוג מעל 5 בר — המקטין לא עובד', 'מתחת ל־2 בר — מקטין או מסנן חוסמים'], tip: 'בדירה, הטווח האידיאלי הוא 3–4 בר.', diff: 1, tree: 'pressure' },
        { id: 'manifold', x: 482, y: 352, lp: 'w', title: 'מחלק מים (קולקטור)', sum: 'מחלק את המים לקו נפרד לכל אזור בדירה. נפוץ בבנייה חדשה עם צנרת פקסגול.', issues: ['טפטוף מחיבור של אחת היציאות'], tip: 'קו לכל אזור: אפשר לסגור רק את האמבטיה בזמן תקלה ולהשאיר מים במטבח.', diff: 2 },
        { id: 'branches', x: 530, y: 220, lp: 'w', title: 'ברזי ניתוק לפי אזור', sum: 'ברז קטן לכל קו, כדי לנתק אזור אחד בלבד.', issues: ['ברזים בלי סימון — לא יודעים מה סוגרים'], tip: 'סמן כל ברז בשם האזור. עשר דקות עם מדבקות חוסכות בלבול בזמן הצפה.', diff: 1, task: { title: 'סימון ברזי הניתוק במחלק המים', recur: '', cat: 'אינסטלציה' } },
      ],
    },
  ];

  HB.diagram = (id) => HB.DIAGRAMS.find((d) => d.id === id);
})();
