// Saqlash: localStorage kalitlari eski sayt bilan bir xil, shuning uchun avval saqlangan
// takliflar yangi saytda ham ko’rinadi. Har qanday yozuv o’qilganda migrateState() dan o’tadi.
import { FALLBACK_USD_RATE, CRM_SEARCH_MINUTES, SELLER } from './pricing.js';
import { normalizeLogo } from './logo.js';
import { defaultContract, normalizeContract } from './contract.js';

export const SCHEMA_VERSION = 2;
export const KEYS = Object.freeze({
  saved: 'omon-kp-v1',
  draft: 'omon-kp-draft-v1',
  present: 'omon-kp-present',
});
export const MAX_SAVED = 80;

const TELEPHONY = ['none', 'myzvanki', 'utel_start', 'utel_optima', 'utel_profi'];
// Eski yozuvlar: UzTel (110 000 / raqam) o’rniga UTEL paketlari keldi — eng yaqini Start AI (1 xodim 110 000).
const LEGACY_TELEPHONY = { uztel: 'utel_start' };
const CHATBOT = ['none', 'c500', 'c1000'];
const LEGACY_PHONE = { personal: 'myzvanki', company: 'utel_start', none: 'none' };

const TEXT_FIELDS = [
  'agency', 'owner', 'contact', 'city', 'date', 'validDays', 'sellerName', 'sellerPhone',
  'employees', 'workDays', 'leads', 'missed', 'recovery', 'conversion', 'profit',
  'responseNow', 'responseAfter', 'searchNow', 'searchAfter', 'searches',
  'agents', 'lines', 'fx',
];

export function todayIso(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function defaultState(today = todayIso()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    agency: '', agencyImage: '', logoRemoveBackground: false, logo: normalizeLogo(),
    owner: '', contact: '', city: '',
    date: today, validDays: '7',
    sellerName: SELLER.name, sellerPhone: SELLER.phone,
    employees: '', workDays: '26', leads: '', missed: '', recovery: '', conversion: '', profit: '',
    responseNow: '', responseAfter: '', searchNow: '', searchAfter: String(CRM_SEARCH_MINUTES), searches: '',
    agents: '3', months: '6', telephony: 'none', lines: '1', chatbot: 'none',
    fx: String(FALLBACK_USD_RATE.rate),
    contract: defaultContract(),
  };
}

const str = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * Har qanday (eski yoki yangi) yozuvni 2-sxemaga keltiradi. Xato bermaydi.
 * Eski format: phoneType ('none'|'personal'|'company'), phones, manager, bonus …
 */
export function migrateState(raw, today = todayIso()) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = defaultState(today);

  for (const key of TEXT_FIELDS) {
    if (src[key] !== undefined) out[key] = str(src[key]);
  }

  // Eski sayt ijrochini manager/managerPhone maydonlarida saqlagan.
  if (src.sellerName === undefined && src.manager !== undefined) out.sellerName = str(src.manager);
  if (src.sellerPhone === undefined && src.managerPhone !== undefined) out.sellerPhone = str(src.managerPhone);

  if (TELEPHONY.includes(src.telephony)) out.telephony = src.telephony;
  else if (Object.hasOwn(LEGACY_TELEPHONY, src.telephony)) out.telephony = LEGACY_TELEPHONY[src.telephony];
  else if (Object.hasOwn(LEGACY_PHONE, src.phoneType)) out.telephony = LEGACY_PHONE[src.phoneType];

  if (src.lines === undefined && src.phones !== undefined) out.lines = str(src.phones);

  out.chatbot = CHATBOT.includes(src.chatbot) ? src.chatbot : 'none';
  out.months = String(src.months) === '12' ? '12' : '6';

  const img = src.agencyImage;
  out.agencyImage = typeof img === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img) ? img : '';
  out.logoRemoveBackground = src.logoRemoveBackground === true;
  out.logo = normalizeLogo(src.logo);
  out.schemaVersion = SCHEMA_VERSION;
  out.contract = normalizeContract(src.contract);
  return out;
}

export function migrateRateMeta(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const kind = ['official', 'fallback', 'manual'].includes(r.kind) ? r.kind : 'manual';
  return { kind, date: str(r.date), manual: kind === 'manual' || r.manual === true };
}

function migrateRecord(rec) {
  if (!rec || typeof rec !== 'object' || !rec.id) return null;
  const data = migrateState(rec.data);
  return {
    id: String(rec.id),
    agency: data.agency.trim() || str(rec.agency),
    updated: str(rec.updated) || new Date(0).toISOString(),
    schemaVersion: SCHEMA_VERSION,
    data,
    rateMeta: migrateRateMeta(rec.rateMeta),
  };
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function readSaved(storage) {
  const v = readJson(storage, KEYS.saved, {});
  const items = Array.isArray(v?.saved) ? v.saved : [];
  return items.map(migrateRecord).filter(Boolean).sort((a, b) => b.updated.localeCompare(a.updated));
}

/** @returns {boolean} yozildimi (xotira to’lgan bo’lsa false) */
export function writeSaved(storage, items) {
  try {
    storage.setItem(KEYS.saved, JSON.stringify({ schemaVersion: SCHEMA_VERSION, saved: items.slice(0, MAX_SAVED) }));
    return true;
  } catch {
    return false;
  }
}

export function upsertRecord(items, { id, state, rateMeta, now = new Date() }) {
  const record = {
    id: id || `kp-${now.getTime()}`,
    agency: state.agency.trim(),
    updated: now.toISOString(),
    schemaVersion: SCHEMA_VERSION,
    data: { ...state, schemaVersion: SCHEMA_VERSION },
    rateMeta: { ...rateMeta },
  };
  const rest = items.filter((x) => x.id !== record.id);
  return { record, items: [record, ...rest] };
}

export function readDraft(storage) {
  const v = readJson(storage, KEYS.draft, null);
  if (!v || typeof v !== 'object' || !v.state) return null;
  return { state: migrateState(v.state), selectedId: v.selectedId ? String(v.selectedId) : null, rateMeta: migrateRateMeta(v.rateMeta) };
}

export function writeDraft(storage, draft) {
  try {
    storage.setItem(KEYS.draft, JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...draft }));
    return true;
  } catch {
    return false;
  }
}

/** JSON zaxira: joriy KP va barcha saqlangan takliflar. */
export function buildBackup({ state, rateMeta, saved, now = new Date() }) {
  return {
    kind: 'omon-kp-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    current: { data: { ...state, schemaVersion: SCHEMA_VERSION }, rateMeta: { ...rateMeta } },
    saved,
  };
}

/**
 * Zaxira faylini o’qiydi. Qabul qiladi:
 *  - yangi zaxira: { kind:'omon-kp-backup', current, saved }
 *  - eski sayt eksporti: { version: 2, exportedAt, ...state }
 *  - localStorage nusxasi: { saved: [...] } yoki bitta yozuv { id, data }
 * @returns {{ current: {state, rateMeta} | null, saved: object[] }}
 */
export function parseBackup(json) {
  const v = typeof json === 'string' ? JSON.parse(json) : json;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Fayl formati noto’g’ri');

  const saved = Array.isArray(v.saved) ? v.saved.map(migrateRecord).filter(Boolean) : [];
  let current = null;
  if (v.current && typeof v.current === 'object') {
    current = { state: migrateState(v.current.data ?? v.current.state), rateMeta: migrateRateMeta(v.current.rateMeta) };
  } else if (v.data && typeof v.data === 'object') {
    current = { state: migrateState(v.data), rateMeta: migrateRateMeta(v.rateMeta) };
  } else if (!Array.isArray(v.saved)) {
    const looksLikeState = ['agency', 'agents', 'months', 'phoneType', 'telephony'].some((k) => k in v);
    if (!looksLikeState) throw new Error('Faylda KP ma’lumoti topilmadi');
    current = { state: migrateState(v), rateMeta: migrateRateMeta({ kind: 'manual', manual: true }) };
  }
  if (!current && saved.length === 0) throw new Error('Faylda KP ma’lumoti topilmadi');
  return { current, saved };
}

/** Import qilingan yozuvlarni mavjudlari bilan birlashtiradi (bir xil id → yangirog’i qoladi). */
export function mergeSaved(existing, incoming) {
  const map = new Map(existing.map((x) => [x.id, x]));
  for (const rec of incoming) {
    const prev = map.get(rec.id);
    if (!prev || rec.updated > prev.updated) map.set(rec.id, rec);
  }
  return [...map.values()].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, MAX_SAVED);
}
