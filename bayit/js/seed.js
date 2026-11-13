/* Demo data, generated relative to today so the dashboard always looks alive. */
(() => {
  'use strict';
  const HB = window.HB;
  const d = (n) => HB.iso(HB.addDays(HB.today(), n));

  /** Spread `count` charge dates over the last `days` days, newest last. */
  const chargeLog = (count, days, lastAgo) => {
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(d(-(lastAgo + Math.round((i / Math.max(1, count - 1)) * days * (0.85 + ((i * 37) % 10) / 70)))));
    return out.sort();
  };

  HB.CATS = ['אינסטלציה', 'חשמל', 'מיזוג', 'מכשירי חשמל', 'חלונות ותריסים', 'נגרות', 'צבע וגבס', 'איטום', 'בטיחות', 'חוץ ומרפסות', 'כללי'];
  HB.UNITS = ['יח׳', 'שפופרת', 'גליל', 'ליטר', 'ק״ג', 'מטר', 'זוג', 'חבילה', 'דלי', 'ערכה'];

  HB.seed = () => ({
    v: 1,
    settings: { theme: 'system' },
    checks: {},
    tasks: [
      { id: 't1', title: 'בדיקת ממסר פחת (לחיצה על TEST)', cat: 'חשמל', due: d(-2), recur: 'm1', prio: 'high', notes: 'הפחת אמור לקפוץ מיד. אם לא — להזמין חשמלאי.', history: [d(-32), d(-63)] },
      { id: 't2', title: 'שימון צירי דלתות וחלונות', cat: 'נגרות', due: d(-5), recur: 'm6', prio: 'low', notes: '', history: [] },
      { id: 't3', title: 'ניקוי מסנן מדיח כלים', cat: 'אינסטלציה', due: d(1), recur: 'm1', prio: 'mid', notes: '', history: [d(-29)] },
      { id: 't4', title: 'ניקוי פילטרים במזגנים', cat: 'מיזוג', due: d(4), recur: 'm1', prio: 'mid', notes: 'סלון, חדר שינה, חדר ילדים', history: [d(-26)] },
      { id: 't5', title: 'ניקוי מרזבים ונקזי מרפסת לפני הגשמים', cat: 'חוץ ומרפסות', due: d(6), recur: 'y1', prio: 'high', notes: '', history: [] },
      { id: 't6', title: 'הסרת אבנית מחסכמים ומראש המקלחת', cat: 'אינסטלציה', due: d(12), recur: 'm3', prio: 'low', notes: 'השרייה בחומץ לבן', history: [] },
      { id: 't7', title: 'בדיקת איטום סיליקון באמבטיה ובכיורים', cat: 'איטום', due: d(20), recur: 'm6', prio: 'mid', notes: '', history: [] },
      { id: 't8', title: 'החלפת סוללות בגלאי העשן', cat: 'בטיחות', due: d(45), recur: 'y1', prio: 'high', notes: 'סוללת 9V', history: [] },
      { id: 't9', title: 'בדיקת מד לחץ במטף הכיבוי', cat: 'בטיחות', due: d(90), recur: 'y1', prio: 'mid', notes: 'המחוג צריך להיות באזור הירוק', history: [] },
      { id: 't10', title: 'בדיקת אנודת מגנזיום בדוד', cat: 'אינסטלציה', due: d(150), recur: 'y2', prio: 'mid', notes: 'במים קשים — להחליף כל 2–3 שנים', history: [] },
      { id: 't11', title: 'החלפת נורה במסדרון', cat: 'חשמל', due: d(-9), recur: '', prio: 'low', notes: '', done: true, doneAt: d(-8), history: [] },
    ],
    inventory: [
      { id: 'i1', name: 'סרט טפלון', cat: 'אינסטלציה', qty: 3, unit: 'גליל', min: 2, loc: 'ארגז כלים' },
      { id: 'i2', name: 'סיליקון סניטרי שקוף', cat: 'איטום', qty: 1, unit: 'שפופרת', min: 2, loc: 'מחסן — מדף עליון' },
      { id: 'i3', name: 'גריז סיליקון', cat: 'אינסטלציה', qty: 0, unit: 'שפופרת', min: 1, loc: 'ארגז כלים' },
      { id: 'i4', name: 'ערכת אטמי O-ring', cat: 'אינסטלציה', qty: 1, unit: 'ערכה', min: 1, loc: 'ארגז כלים' },
      { id: 'i5', name: 'ברגי גבס 3.5×25', cat: 'צבע וגבס', qty: 180, unit: 'יח׳', min: 100, loc: 'מגירת ברגים' },
      { id: 'i6', name: 'דיבלים 6 מ״מ', cat: 'כללי', qty: 35, unit: 'יח׳', min: 50, loc: 'מגירת ברגים' },
      { id: 'i7', name: 'נורות LED E27', cat: 'חשמל', qty: 4, unit: 'יח׳', min: 3, loc: 'ארון שירות' },
      { id: 'i8', name: 'סוללות 9V לגלאי עשן', cat: 'בטיחות', qty: 1, unit: 'יח׳', min: 2, loc: 'ארון שירות' },
      { id: 'i9', name: 'שמן סיכה רב־תכליתי', cat: 'כללי', qty: 1, unit: 'יח׳', min: 1, loc: 'מחסן' },
      { id: 'i10', name: 'חומץ לבן', cat: 'כללי', qty: 2, unit: 'ליטר', min: 1, loc: 'מטבח' },
      { id: 'i11', name: 'דבק נגרים', cat: 'נגרות', qty: 1, unit: 'יח׳', min: 1, loc: 'מחסן' },
      { id: 'i12', name: 'נייר לטש 120', cat: 'נגרות', qty: 8, unit: 'יח׳', min: 5, loc: 'מחסן' },
      { id: 'i13', name: 'מרק (שפכטל) לגבס', cat: 'צבע וגבס', qty: 1, unit: 'דלי', min: 1, loc: 'מחסן' },
      { id: 'i14', name: 'כפפות עבודה', cat: 'בטיחות', qty: 2, unit: 'זוג', min: 1, loc: 'ארגז כלים' },
      { id: 'i15', name: 'אטם חרוטי לסיפון 1½״', cat: 'אינסטלציה', qty: 2, unit: 'יח׳', min: 1, loc: 'ארגז כלים' },
      { id: 'i16', name: 'מלח למדיח', cat: 'כללי', qty: 1, unit: 'ק״ג', min: 1, loc: 'מתחת לכיור' },
      { id: 'i17', name: 'סיליקון ספריי', cat: 'חלונות ותריסים', qty: 0, unit: 'יח׳', min: 1, loc: 'מחסן' },
    ],
    tools: [
      { id: 'k1', name: 'מברגה/מקדחה רוטטת', kind: 'כלי סוללה', v18: true, service: 'ניקוי פתחי אוורור ובדיקת פחמים', every: 'y1', last: d(-300), notes: '' },
      { id: 'k2', name: 'מסור עגול', kind: 'כלי סוללה', v18: true, service: 'השחזה/החלפת להב וניקוי שבבים', every: 'm6', last: d(-205), notes: 'להב 165 מ״מ, 24 שיניים' },
      { id: 'k3', name: 'משחזת זווית', kind: 'כלי סוללה', v18: true, service: 'בדיקת מגן, ידית ודיסק', every: 'm3', last: d(-30), notes: '' },
      { id: 'k4', name: 'שואב אבק תעשייתי', kind: 'כלי חשמלי', v18: false, service: 'ניקוי/החלפת פילטר', every: 'm1', last: d(-38), notes: '' },
      { id: 'k5', name: 'סולם אלומיניום 6 שלבים', kind: 'ציוד', v18: false, service: 'בדיקת רגליות, נעילה ושלבים', every: 'y1', last: d(-110), notes: '' },
      { id: 'k6', name: 'מטען מהיר 18V', kind: 'מטען', v18: true, service: 'ניקוי מגעים ואבק', every: 'm6', last: d(-60), notes: '' },
    ],
    batteries: [
      { id: 'b1', label: 'סוללה A', brand: '', ah: 2.0, rated: 500, cycles: 312, bought: d(-930), log: chargeLog(26, 80, 3), notes: 'קומפקטית — למברגה' },
      { id: 'b2', label: 'סוללה B', brand: '', ah: 4.0, rated: 500, cycles: 461, bought: d(-1460), log: chargeLog(18, 80, 1), notes: '' },
      { id: 'b3', label: 'סוללה C', brand: '', ah: 5.0, rated: 1000, cycles: 148, bought: d(-380), log: chargeLog(6, 70, 74), notes: 'למסור העגול' },
      { id: 'b4', label: 'סוללה D', brand: '', ah: 2.0, rated: 500, cycles: 61, bought: d(-120), log: chargeLog(14, 80, 9), notes: '' },
    ],
  });
})();
