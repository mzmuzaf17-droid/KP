// Omon CRM belgisi: markazdagi halqa va 6 ta kapsula. Rang currentColor’dan olinadi,
// shuning uchun oq (to’q fonda) va ko’k (oq fonda) variantlar bitta SVG’dan chiqadi.
const PETALS = [0, 60, 120, 180, 240, 300]
  .map((deg) => `<rect x="-6.25" y="-46" width="12.5" height="30" rx="6.25" transform="rotate(${deg})"/>`)
  .join('');

export function logoMark({ size = 28, cls = '', label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="logo-mark ${cls}" ${a11y} width="${size}" height="${size}" viewBox="-50 -50 100 100" fill="none" stroke="currentColor" stroke-width="4.5" focusable="false"><circle r="8.5"/>${PETALS}</svg>`;
}

/** Belgi + “Omon CRM” yozuvi. */
export function logoLockup({ size = 28, cls = '' } = {}) {
  return `<span class="logo-lockup ${cls}">${logoMark({ size })}<span class="logo-word">Omon CRM</span></span>`;
}
