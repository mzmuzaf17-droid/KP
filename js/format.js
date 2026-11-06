// Ko’rsatish uchun formatlash. Bo’sh yoki noto’g’ri son hech qachon NaN/undefined bo’lib chiqmaydi.

export const DASH = '—';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** 19068000 → "19 068 000" (minglar oddiy bo’sh joy bilan). */
export function fmtInt(n) {
  if (!isNum(n)) return DASH;
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 19068000 → "19 068 000 so’m". */
export function fmtUzs(n) {
  return isNum(n) ? `${fmtInt(n)} so’m` : DASH;
}

/** 11941.65 → "11 941,65" (kasr vergul bilan). */
export function fmtDecimal(n, digits = 2) {
  if (!isNum(n)) return DASH;
  const fixed = Math.abs(n).toFixed(digits).replace(/\.?0+$/, '');
  const [int, frac] = fixed.split('.');
  const sign = n < 0 ? '-' : '';
  return sign + fmtInt(Number(int)) + (frac ? `,${frac}` : '');
}

export function fmtUsd(n) {
  return isNum(n) ? `$${fmtInt(n)}` : DASH;
}

/** Daqiqani o’qiladigan ko’rinishga: 0.5 → "30 soniya", 15 → "15 daqiqa". */
export function fmtMinutes(n) {
  if (!isNum(n)) return DASH;
  if (n > 0 && n < 1) return `${Math.round(n * 60)} soniya`;
  return `${fmtDecimal(n, 1)} daqiqa`;
}

/** "2026-11-06" → "06.11.2026". Noto’g’ri sana → "—". */
export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : DASH;
}

/** Sana + N kun → ISO sana yoki null. */
export function addDays(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m || !isNum(days)) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return d.toISOString().slice(0, 10);
}

/** HTML ichiga qo’yiladigan foydalanuvchi matni uchun. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** PDF fayl nomi: OmonCRM_KP_<agentlik-nomi>_<YYYY-MM-DD> */
export function pdfFileName(agency, isoDate) {
  const slug = String(agency ?? '')
    .normalize('NFC')
    .trim()
    .replace(/[‘’ʻʼ'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(isoDate ?? '')) ? isoDate : new Date().toISOString().slice(0, 10);
  return `OmonCRM_KP_${slug || 'turagentlik'}_${date}`;
}
