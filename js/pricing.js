// Barcha narxlar shu yerda. Narx o’zgarsa, faqat shu fayl tahrirlanadi.
// Summalar so’mda, o’rnatish dollarda (USD kursi bo’yicha so’mga o’giriladi).

export const PRICING = Object.freeze({
  crmPerAgentMonth: 189_000, // so’m / agent / oy
  bonusMonths: Object.freeze({ 6: 1, 12: 3 }), // faqat CRM obunasiga
  setupUsd: (agents) => (agents <= 3 ? 200 : agents <= 5 ? 300 : 400),
  chatbot: Object.freeze({ none: 0, c500: 399_000, c1000: 499_000 }), // so’m / oy, oyma-oy to’lanadi (obuna jamiga kirmaydi)
  telephony: Object.freeze({ none: 0, myzvanki: 49_000, uztel: 110_000 }), // so’m / raqam / oy
});

export const TERMS = Object.freeze([6, 12]);

export const TELEPHONY_LABELS = Object.freeze({
  none: 'Kerak emas',
  myzvanki: 'MyZvanki',
  uztel: 'UzTel',
});

export const CHATBOT_LABELS = Object.freeze({
  none: 'Kerak emas',
  c500: '500 ta mijoz',
  c1000: '1 000 ta mijoz',
});

/** O’rnatish narxi qaysi agentlar oralig’iga tushishini matn bilan. */
export function setupTierLabel(agents) {
  if (agents <= 3) return '1–3 agent';
  if (agents <= 5) return '4–5 agent';
  return '6 va undan ko’p agent';
}

/** Standart ijrochi (formada o’zgartirish mumkin) va kompaniya sayti. */
export const SELLER = Object.freeze({
  name: 'Muzaffar Mirkhamidov',
  shortName: 'Muzaffar',
  phone: '+998 77 177 13 19',
  phoneHref: 'tel:+998771771319',
  site: 'omoncrm.uz',
});

/** CBU kursi olinmasa ishlatiladigan namunaviy kurs (sahifada aniq ko’rsatiladi). */
export const FALLBACK_USD_RATE = Object.freeze({ rate: 11_941.65, date: '03.11.2026' });

/** CRM bilan tur qidirish vaqti (daqiqa): 30 soniya. */
export const CRM_SEARCH_MINUTES = 0.5;
