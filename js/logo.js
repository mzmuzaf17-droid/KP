// Turagentlik logotipini yuklash: brauzerda siqish va (ixtiyoriy) qora/ko’k chekka fonni olib tashlash.
// Algoritm mavjud saytdagidan olingan: faqat rasm chetiga tutashgan bir xil fon piksellari shaffof bo’ladi.

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];
export const LOGO_MAX_BYTES = 20 * 1024 * 1024;
export const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bu rasmni brauzer ocholmadi. PNG yoki JPG qilib ko’ring'));
    img.src = src;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Rasm faylini o’qib bo’lmadi'));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

/** Faylni localStorage’ga sig’adigan WebP/PNG data-URL’ga siqadi. */
export async function compressLogo(file) {
  if (!LOGO_TYPES.includes(file.type)) throw new Error('PNG, JPG, WebP, AVIF yoki GIF yuklang');
  if (file.size > LOGO_MAX_BYTES) throw new Error('20 MB dan kichik rasm tanlang');
  const img = await loadImage(await readFile(file));
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new Error('Rasm o’lchami noto’g’ri');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Brauzerda rasmni tayyorlab bo’lmadi');
  const maxChars = 190_000;
  let smallest = null;
  for (const side of [900, 720, 560, 440, 340, 260]) {
    const scale = Math.min(1, side / Math.max(w0, h0));
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.9, 0.8, 0.68, 0.55]) {
      let url = canvas.toDataURL('image/webp', q);
      if (!url.startsWith('data:image/webp;')) url = canvas.toDataURL('image/png');
      if (!smallest || url.length < smallest.length) smallest = url;
      if (url.length <= maxChars) return url;
    }
  }
  if (smallest && smallest.length <= 350_000) return smallest;
  throw new Error('Rasmni siqib bo’lmadi. PNG yoki JPG formatini sinab ko’ring');
}

/** Chetga tutashgan fon piksellarini (BFS) shaffof qiladi. predicate(i) — pikselni olib tashlash mumkinmi. */
function floodClear(data, width, height, predicate) {
  const count = width * height;
  const seen = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const add = (i) => {
    if (!seen[i] && predicate(i)) {
      seen[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    data[i * 4 + 3] = 0;
    const x = i % width;
    if (x > 0) add(i - 1);
    if (x + 1 < width) add(i + 1);
    if (i >= width) add(i - width);
    if (i + width < count) add(i + width);
  }
  return tail;
}

function clearDarkEdge(data, width, height) {
  const corners = [0, width - 1, (height - 1) * width, width * height - 1];
  const dark = (i) => {
    const p = i * 4;
    const hi = Math.max(data[p], data[p + 1], data[p + 2]);
    const lo = Math.min(data[p], data[p + 1], data[p + 2]);
    return data[p + 3] >= 120 && hi <= 128 && hi - lo <= 55;
  };
  const refCorners = corners.filter(dark);
  if (refCorners.length < 3) return false;
  const ref = [0, 1, 2].map((c) => refCorners.reduce((s, i) => s + data[i * 4 + c], 0) / refCorners.length);
  const similar = (i) => dark(i) && Math.abs(data[i * 4] - ref[0]) + Math.abs(data[i * 4 + 1] - ref[1]) + Math.abs(data[i * 4 + 2] - ref[2]) < 165;
  const removed = floodClear(data, width, height, similar);
  return removed >= Math.max(12, width * height * 0.012);
}

function clearBlueEdge(data, width, height) {
  const corners = [0, width - 1, (height - 1) * width, width * height - 1];
  const blue = (i) => {
    const p = i * 4;
    const [r, g, b, a] = [data[p], data[p + 1], data[p + 2], data[p + 3]];
    return a > 130 && b > 62 && b - r > 17 && b - g > 4 && b / Math.max(1, r + g) > 0.52;
  };
  if (corners.filter(blue).length < 3) return false;
  const removed = floodClear(data, width, height, blue);
  return removed >= Math.max(12, width * height * 0.03) && removed < width * height * 0.97;
}

const cache = new Map();

/** Fonni olib tashlangan nusxa (yoki o’zgarish bo’lmasa asl rasm). Natija keshlanadi. */
export async function logoWithoutBackdrop(src) {
  if (!SAFE_IMAGE.test(src)) return '';
  if (cache.has(src)) return cache.get(src);
  let result = src;
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, 650 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      if (clearDarkEdge(pixels.data, w, h) || clearBlueEdge(pixels.data, w, h)) {
        ctx.putImageData(pixels, 0, 0);
        result = canvas.toDataURL('image/png');
      }
    }
  } catch {
    result = src;
  }
  cache.set(src, result);
  return result;
}
