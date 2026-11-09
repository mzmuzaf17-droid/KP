// Forma maydonlari tekshiruvi (toza funksiya, DOM’siz). Xabarlar foydalanuvchini ayblamaydi va
// nima qilish kerakligini aytadi. Xato maydondan chiqqanda (blur) ko’rsatiladi, yozish boshlanganda yo’qoladi.
import { toNumber } from './quote.js';

const range = (min, max, int = false) => ({ min, max, int });

/** Har bir maydon uchun qoida. required — bo’sh bo’lsa ham xato; requiredWhen — shart bajarilganda. */
export const FIELD_RULES = Object.freeze({
  agency: { requiredOnSave: 'Taklifni saqlash uchun turagentlik nomini kiriting.' },
  validDays: range(1, 90, true),
  employees: range(1, 999, true),
  workDays: range(1, 31, true),
  leads: range(0, 9999, true),
  missed: range(0, 9999, true),
  recovery: range(0, 100),
  conversion: range(0, 100),
  profit: range(0, 1e12),
  responseNow: range(0, 1440),
  responseAfter: range(0, 1440),
  searchNow: range(0, 1440),
  searchAfter: range(0, 1440),
  searches: range(0, 9999, true),
  agents: { ...range(1, 999, true), required: 'Narx hisoblanishi uchun agentlar sonini kiriting.' },
  lines: { ...range(1, 999, true), requiredWhen: (s) => s.telephony !== 'none', required: 'Telefoniya narxi hisoblanishi uchun raqamlar sonini kiriting.' },
  fx: { ...range(1000, 100000), required: 'O’rnatish narxini so’mda ko’rsatish uchun kursni kiriting yoki “Kursni yangilash”ni bosing.' },
});

function rangeMessage({ min, max, int }) {
  if (min === 0 && max === 100 && !int) return '0 dan 100 gacha son kiriting.';
  if (max >= 1e6) return `${min} yoki undan katta son kiriting.`;
  return `${min} dan ${max} gacha ${int ? 'butun ' : ''}son kiriting.`;
}

/**
 * @param {string} key  maydon kaliti (state dagi)
 * @param {object} state  forma holati
 * @param {{ onSave?: boolean }} [opts]
 * @returns {string|null} xato matni yoki null
 */
export function validateField(key, state, { onSave = false } = {}) {
  const rule = FIELD_RULES[key];
  if (!rule) return null;
  const raw = String(state[key] ?? '').trim();

  if (!raw) {
    if (rule.requiredOnSave && onSave) return rule.requiredOnSave;
    if (rule.required && (!rule.requiredWhen || rule.requiredWhen(state))) return rule.required;
    return null;
  }
  if (rule.requiredOnSave) return null;
  if (rule.requiredWhen && !rule.requiredWhen(state)) return null;

  const n = toNumber(raw);
  if (n === null || n < rule.min || n > rule.max || (rule.int && !Number.isInteger(n))) return rangeMessage(rule);

  if (key === 'missed') {
    const leads = toNumber(state.leads);
    if (leads !== null && n > leads) return 'Bu son kunlik lidlardan oshmasligi kerak — aks holda lidlar prognozi KP’ga chiqmaydi.';
  }
  return null;
}
