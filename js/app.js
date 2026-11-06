// Forma, saqlash, kurs va PDF. Hisob calculateQuote() da, KP renderKp() da.
import { setupTierLabel, FALLBACK_USD_RATE, SELLER, TELEPHONY_LABELS, CHATBOT_LABELS } from './pricing.js';
import { calculateQuote, quoteInputFromState, leadForecast } from './quote.js';
import { fmtUzs, fmtUsd, fmtDecimal, fmtDate, pdfFileName, DASH } from './format.js';
import {
  KEYS, defaultState, migrateState, readSaved, writeSaved, upsertRecord, readDraft, writeDraft,
  buildBackup, parseBackup, mergeSaved,
} from './storage.js';
import { compressLogo, logoWithoutBackdrop, SAFE_IMAGE } from './logo.js';
import { icon } from './icons.js';
import { logoMark } from './brand.js';
import { renderKp } from './kp.js';

const $ = (id) => document.getElementById(id);
const store = (() => {
  try {
    const k = '__omon_kp_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
})();

let state = defaultState();
let selectedId = null;
let rateMeta = { kind: 'fallback', date: FALLBACK_USD_RATE.date, manual: false };
let logoSrc = '';
let logoToken = 0;

/* ---------- yordamchi ---------- */
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2800);
}

function persistDraft() {
  return writeDraft(store, { state, selectedId, rateMeta });
}

function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    el.outerHTML = icon(el.dataset.icon, { size: 18 });
  }
  for (const el of root.querySelectorAll('[data-logo]')) el.innerHTML = logoMark({ size: 30 });
}

/* ---------- logotip ---------- */
async function refreshLogo() {
  const raw = SAFE_IMAGE.test(state.agencyImage) ? state.agencyImage : '';
  const token = ++logoToken;
  $('logoThumb').hidden = !raw;
  $('logoRemove').hidden = !raw;
  $('logoRemoveBackground').checked = state.logoRemoveBackground !== false;
  if (raw) $('logoThumbImg').src = raw; else $('logoThumbImg').removeAttribute('src');
  logoSrc = raw;
  if (raw && state.logoRemoveBackground !== false) {
    const clean = await logoWithoutBackdrop(raw);
    if (token !== logoToken) return;
    logoSrc = clean || raw;
  }
  render();
}

/* ---------- forma ↔ holat ---------- */
function fillForm() {
  for (const el of document.querySelectorAll('[data-key]')) el.value = state[el.dataset.key] ?? '';
  render();
  refreshLogo();
}

function readForm() {
  for (const el of document.querySelectorAll('[data-key]')) state[el.dataset.key] = el.value;
  state = migrateState(state);
  render();
  persistDraft();
}

/* ---------- ko’rsatish ---------- */
function render() {
  const q = calculateQuote(quoteInputFromState(state));
  const f = leadForecast(state);

  $('lines').disabled = q.telephonyType === 'none';
  $('setupOut').textContent = q.setupUsd === null
    ? 'Agentlar sonini kiriting'
    : `${fmtUsd(q.setupUsd)} · ${setupTierLabel(q.agents)}${q.setupUzs !== null ? ` · ${fmtUzs(q.setupUzs)}` : ''}`;

  $('leadWarning').hidden = !f.invalid;
  $('leadWarning').textContent = f.invalid ? 'Ishlanmay qoladigan lidlar kunlik lidlardan ko’p bo’lishi mumkin emas — prognoz KP’ga chiqmaydi.' : '';

  const rows = [
    [`CRM · ${q.months} oy`, fmtUzs(q.crm)],
    q.telephonyType !== 'none' ? [`${TELEPHONY_LABELS[q.telephonyType]} · ${q.lines} raqam`, fmtUzs(q.telephony)] : null,
    q.chatbotType !== 'none' ? [`AI chatbot · ${CHATBOT_LABELS[q.chatbotType]}`, fmtUzs(q.chatbot)] : null,
    ['Obuna jami', fmtUzs(q.subscriptionTotal)],
    ['O’rtacha oyiga', fmtUzs(q.avgMonthly)],
    [`O’rnatish (${fmtUsd(q.setupUsd)})`, q.setupUzs === null ? (q.setupUsd === null ? DASH : 'kurs kiritilmagan') : fmtUzs(q.setupUzs)],
    ['Umumiy', fmtUzs(q.grandTotal), 'grand'],
  ].filter(Boolean);
  $('summary').innerHTML = rows.map(([k, v, c = '']) => `<dt class="${c}">${k}</dt><dd class="${c}">${v}</dd>`).join('');

  $('kp').innerHTML = renderKp({ state, quote: q, forecast: f, rateMeta, logoSrc });
}

/* ---------- saqlash ---------- */
function refreshSavedList() {
  const sel = $('savedSelect');
  sel.replaceChildren(new Option('— Taklif tanlang —', ''));
  for (const item of readSaved(store)) {
    sel.add(new Option(`${item.agency || 'Nomsiz turagentlik'} · ${fmtDate(item.updated.slice(0, 10))}`, item.id));
  }
  sel.value = selectedId || '';
}

function saveQuote() {
  if (!state.agency.trim()) {
    toast('Avval turagentlik nomini kiriting');
    $('agency').focus();
    return;
  }
  const { record, items } = upsertRecord(readSaved(store), { id: selectedId, state, rateMeta });
  if (!writeSaved(store, items)) {
    toast('Brauzer xotirasi to’lgan. JSON zaxirani yuklab oling yoki eski takliflarni o’chiring');
    return;
  }
  selectedId = record.id;
  persistDraft();
  refreshSavedList();
  toast('Taklif saqlandi');
}

function newQuote() {
  if (!confirm('Yangi taklif ochilsinmi? Saqlanmagan o’zgarishlar yo’qoladi.')) return;
  state = defaultState();
  selectedId = null;
  fillForm();
  refreshSavedList();
  persistDraft();
  toast('Yangi taklif ochildi');
}

function deleteQuote() {
  if (!selectedId) {
    toast('Saqlangan taklif tanlanmagan');
    return;
  }
  if (!confirm('Tanlangan taklif o’chirilsinmi?')) return;
  writeSaved(store, readSaved(store).filter((x) => x.id !== selectedId));
  selectedId = null;
  persistDraft();
  refreshSavedList();
  toast('Taklif o’chirildi');
}

function openSaved(id) {
  const item = readSaved(store).find((x) => x.id === id);
  if (!item) return;
  selectedId = item.id;
  state = item.data;
  rateMeta = item.rateMeta;
  fillForm();
  setFxStatus();
  persistDraft();
  toast('Taklif ochildi');
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportJson() {
  const backup = buildBackup({ state, rateMeta, saved: readSaved(store) });
  download(`${pdfFileName(state.agency, state.date)}.json`, JSON.stringify(backup, null, 2));
}

async function importJson(file) {
  try {
    const { current, saved } = parseBackup(await file.text());
    if (saved.length && !writeSaved(store, mergeSaved(readSaved(store), saved))) {
      toast('Brauzer xotirasi to’lgan — takliflar ro’yxatga qo’shilmadi');
    }
    if (current) {
      state = current.state;
      rateMeta = current.rateMeta;
      selectedId = null;
      fillForm();
      setFxStatus();
      persistDraft();
    }
    refreshSavedList();
    toast(`Zaxira tiklandi${saved.length ? ` · ${saved.length} ta taklif` : ''}`);
  } catch (err) {
    toast(err instanceof SyntaxError ? 'JSON fayl o’qilmadi' : err.message || 'Import xatosi');
  }
}

/* ---------- USD kursi ---------- */
function setFxStatus(text) {
  if (text) {
    $('fxStatus').textContent = text;
    return;
  }
  const rate = fmtDecimal(Number(state.fx));
  $('fxStatus').textContent = rateMeta.kind === 'official'
    ? `Markaziy bank kursi, ${rateMeta.date}: ${rate} so’m`
    : rateMeta.kind === 'manual'
      ? (Number(state.fx) > 0 ? `Qo’lda kiritilgan kurs: ${rate} so’m` : 'Kursni kiriting — o’rnatish narxi so’mda hisoblanadi')
      : `Markaziy bankka ulanib bo’lmadi. Namunaviy kurs (${rateMeta.date}): ${rate} so’m — kerak bo’lsa qo’lda o’zgartiring`;
}

let loadingRate = false;
async function updateRate() {
  if (loadingRate) return;
  loadingRate = true;
  setFxStatus('Markaziy bank kursi olinmoqda…');
  try {
    const res = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    const raw = await res.json();
    const row = Array.isArray(raw) ? raw[0] : raw;
    const rate = Number(String(row?.Rate ?? '').replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) throw new Error('bad rate');
    if (!rateMeta.manual) {
      state.fx = String(rate);
      rateMeta = { kind: 'official', date: String(row.Date || ''), manual: false };
      $('fx').value = state.fx;
      render();
      persistDraft();
    }
    setFxStatus();
  } catch {
    if (!rateMeta.manual && rateMeta.kind !== 'official') {
      rateMeta = { kind: 'fallback', date: FALLBACK_USD_RATE.date, manual: false };
    }
    setFxStatus();
  } finally {
    loadingRate = false;
  }
}

/* ---------- PDF, ko’rsatish, nusxalash ---------- */
function printPdf() {
  const original = document.title;
  document.title = pdfFileName(state.agency, state.date);
  const restore = () => { document.title = original; };
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
  setTimeout(restore, 1000);
}

function setPresenting(on) {
  document.body.classList.toggle('presenting', on);
  const btn = $('viewToggle');
  btn.setAttribute('aria-pressed', String(on));
  btn.innerHTML = `${icon(on ? 'pencil' : 'eye', { size: 18 })}<span class="btn-label">${on ? 'Tahrirga qaytish' : 'Mijozga ko’rsatish'}</span>`;
  try { sessionStorage.setItem(KEYS.present, on ? '1' : '0'); } catch { /* yo’q */ }
}

function quoteText() {
  const q = calculateQuote(quoteInputFromState(state));
  const lines = [`Omon CRM — tijorat taklifi${state.agency.trim() ? ` · ${state.agency.trim()}` : ''}`];
  if (state.owner.trim()) lines.push(`Kimga: ${state.owner.trim()}`);
  lines.push(`Kimdan: ${SELLER.name}, ${SELLER.phone}`, '');
  lines.push(`CRM: 189 000 × ${q.agents ?? DASH} agent × ${q.months} oy = ${fmtUzs(q.crm)} (+${q.bonusMonths} oy bepul, ${q.usageMonths} oy foydalanish)`);
  if (q.telephonyType !== 'none') lines.push(`${TELEPHONY_LABELS[q.telephonyType]}: ${q.lines} raqam × ${q.months} oy = ${fmtUzs(q.telephony)}`);
  if (q.chatbotType !== 'none') lines.push(`AI chatbot (${CHATBOT_LABELS[q.chatbotType]}): ${q.months} oy = ${fmtUzs(q.chatbot)}`);
  lines.push(`Obuna jami: ${fmtUzs(q.subscriptionTotal)} · o’rtacha oyiga ${fmtUzs(q.avgMonthly)}`);
  lines.push(`O’rnatish va integratsiya (bir martalik): ${fmtUsd(q.setupUsd)}${q.setupUzs !== null ? ` = ${fmtUzs(q.setupUzs)}` : ''}`);
  lines.push(`Umumiy: ${fmtUzs(q.grandTotal)}`);
  return lines.join('\n');
}

async function copyText() {
  const text = quoteText();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(box);
    box.select();
    document.execCommand('copy');
    box.remove();
  }
  toast('Taklif matni nusxalandi');
}

/* ---------- ishga tushirish ---------- */
function bind() {
  for (const el of document.querySelectorAll('[data-key]')) {
    el.addEventListener('input', () => {
      if (el.id === 'fx') {
        rateMeta = { kind: 'manual', date: '', manual: true };
        readForm();
        setFxStatus();
        return;
      }
      readForm();
    });
  }
  $('editor').addEventListener('submit', (e) => e.preventDefault());
  $('refreshRate').addEventListener('click', () => {
    rateMeta = { ...rateMeta, manual: false };
    updateRate();
  });
  $('logoFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      state.agencyImage = await compressLogo(file);
      await refreshLogo();
      toast(persistDraft() ? 'Logotip qo’shildi' : 'Logotip ko’rinmoqda, lekin xotira to’lgan — JSON zaxira oling');
    } catch (err) {
      toast(err.message || 'Rasm yuklashda xatolik');
    }
  });
  $('logoRemove').addEventListener('click', () => {
    state.agencyImage = '';
    refreshLogo();
    persistDraft();
    toast('Logotip olib tashlandi');
  });
  $('logoRemoveBackground').addEventListener('change', (e) => {
    state.logoRemoveBackground = e.target.checked;
    refreshLogo();
    persistDraft();
  });
  $('saveQuote').addEventListener('click', saveQuote);
  $('saveTop').addEventListener('click', saveQuote);
  $('newQuote').addEventListener('click', newQuote);
  $('deleteQuote').addEventListener('click', deleteQuote);
  $('savedSelect').addEventListener('change', (e) => e.target.value && openSaved(e.target.value));
  $('exportJson').addEventListener('click', exportJson);
  $('importJson').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) importJson(file);
  });
  $('printPdf').addEventListener('click', printPdf);
  $('copyText').addEventListener('click', copyText);
  $('viewToggle').addEventListener('click', () => {
    setPresenting(!document.body.classList.contains('presenting'));
    window.scrollTo({ top: 0 });
  });
}

function init() {
  hydrateIcons();
  const draft = readDraft(store);
  if (draft) {
    state = draft.state;
    selectedId = draft.selectedId;
    rateMeta = draft.rateMeta;
  }
  bind();
  fillForm();
  refreshSavedList();
  try { if (sessionStorage.getItem(KEYS.present) === '1') setPresenting(true); } catch { /* yo’q */ }
  setFxStatus();
  if (!rateMeta.manual) updateRate();
}

init();
