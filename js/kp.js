// KP: vaqtinchalik qisqa ko’rinish (3-bosqich). To’liq 3 betlik tuzilma keyingi bosqichda.
import { esc, fmtUzs, fmtUsd } from './format.js';

export function renderKp({ state, quote: q }) {
  const rows = [
    ['CRM obunasi', fmtUzs(q.crm)],
    q.telephonyType !== 'none' ? ['Telefoniya', fmtUzs(q.telephony)] : null,
    q.chatbotType !== 'none' ? ['AI chatbot', fmtUzs(q.chatbot)] : null,
    ['Obuna jami', fmtUzs(q.subscriptionTotal)],
    ['O’rnatish', fmtUsd(q.setupUsd)],
    ['Umumiy', fmtUzs(q.grandTotal)],
  ].filter(Boolean);
  return `<section class="kp-page"><h2>${esc(state.agency.trim() || 'Agentligingiz')} uchun Omon CRM</h2>
  <table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table></section>`;
}
