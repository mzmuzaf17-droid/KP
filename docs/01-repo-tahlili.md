# 0-qadam: mavjud sayt kodining tahlili

Manba: `Mz-mirkhamidov/crm-system`, `feature/turagent-spin-audit` branchi,
`tools/turagent-spin-audit/` papkasi (production: toursales-insight.vercel.app).
Bu kod faqat ma’lumot sifatida o’qildi; yangi sayt shu repoda noldan yozildi.

| Savol (TZ, 0-qadam) | Javob |
|---|---|
| Framework | Yo’q. Bitta `index.html` (962 qator, ~176 KB): CSS, HTML va JS bitta faylda, build bosqichi yo’q. Logotiplar base64 PNG bo’lib HTML ichiga joylangan |
| KP’ni chizadigan qism | `<article id="proposal">` ichidagi statik HTML. `display()` funksiyasi har bir elementni `put(id, text)` orqali `textContent` bilan to’ldiradi. Bo’sh bloklar `renderOptionalKp()` bilan yashiriladi va bo’limlar qayta raqamlanadi |
| PDF qanday yasaladi | `window.print()` + `@media print` qoidalari, `@page{size:A4;margin:10mm}`. html2canvas/jsPDF yo’q, ya’ni matn PDF’da belgilanadi. Lekin sahifalar alohida bloklar emas: KP bitta uzun maqola, bet chegarasi brauzer xohlagan joyda tushadi |
| localStorage | `omon-kp-v1` → `{ saved: [{ id, agency, updated, data, rateMeta }] }` (80 tagacha). `omon-kp-draft-v1` → `{ state, selectedId, rateMeta }` (oxirgi qoralama). `sessionStorage['omon-kp-present']` — “Mijozga ko’rsatish” rejimi |
| Saqlangan KP formati (`data`) | `agency, agencyImage, logoRemoveBackground, owner, contact, city, manager, managerPhone, date, validDays, employees, workDays, leads, missed, recovery, conversion, profit, responseNow, responseAfter, searchNow, searchAfter, searches, agents, months, phoneType ('none' \| 'personal' \| 'company'), phones, fx, bonus`. Hamma qiymat string |
| Narxlar qayerda | Skript boshida: `PRICE = {agent:189000, personal:49000, company:110000}`, `getSupport(a)` ($200/$300/$400), `extraMonths(m)` (6→1, 12→3), `fallbackRate = 11941.65` |
| JSON zaxira | Faqat eksport: `{ version: 2, exportedAt, ...state }`. Import yo’q |
| USD kursi | `https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/`; olinmasa namunaviy kurs yoki qo’lda kiritilgan kurs |
| Shrift | Inter / system-ui (sayt ichida joylanmagan) |

## Topilgan muammolar (TZ bilan solishtirib)

- “Tur qidirish” kartasida “Turvisor orqali … integratsiya ulanish shartlariga muvofiq” matni qolgan.
- Statik HTML’da `CRM obunasi 6 oyga hisoblangan`, `6 + 1 oy` kabi boshlang’ich matnlar bor; JS yuklanmaguncha yoki xatoda shular ko’rinadi. Narx bloki 6 va 12 oylik paketlarni yonma-yon ko’rsatadi, shuning uchun 12 oy tanlanganda ham “6 OY + 1 OY BONUS” qoladi.
- Bonus oylar matnda telefoniyaga ham tatbiq etilgan; TZ formulalarida bonus faqat CRM obunasiga.
- AI chatbot narxi, “20+ turagent”, 14 operator, taqqoslash, joriy etish va “Keyingi qadam” bloklari yo’q.
- Narx hisobi `display()` ichida DOM bilan aralash; alohida toza funksiya va test yo’q.
- Ranglar komponentlar ichida xom hex bilan yozilgan, CSS bir necha marta ustma-ust qayta yozilgan (`/* 2026-11-03 … */` qatlamlari).

## Yangi saytda qaror

- Serversiz statik sayt qoladi (Vercel), lekin kod modullarga bo’linadi: `js/pricing.js` (narxlar), `js/quote.js` (`calculateQuote`, prognoz), `js/storage.js` (saqlash va migratsiya), `js/kp.js` (KP’ni chizish), `js/app.js` (forma).
- localStorage kalitlari o’zgarmaydi (`omon-kp-v1`, `omon-kp-draft-v1`), shuning uchun eski saqlangan takliflar yangi saytda ham ko’rinadi va ochilganda migratsiya qilinadi.
- PDF yana `window.print()` orqali, lekin har bir bet alohida `210×297 mm` blok va `break-after: page`.
