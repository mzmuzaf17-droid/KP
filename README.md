# Omon CRM · Tijorat taklifi (KP) konstruktori

Turagentliklar uchun Omon CRM tijorat taklifini tuzadigan statik sayt. Chapda forma, o’ngda jonli KP;
“PDF chiqarish” 3 betlik A4 fayl beradi. Server yo’q: hamma hisob brauzerda, takliflar localStorage’da.

- TZ: “Toursales Insight saytida to’liq KP”
- Mavjud sayt tahlili: [docs/01-repo-tahlili.md](docs/01-repo-tahlili.md)
- Qabul mezonlari tekshiruvi: [docs/02-qabul-tekshiruvi.md](docs/02-qabul-tekshiruvi.md)

## Ishga tushirish

Build kerak emas — istalgan statik server yetadi (ES modullar `file://` da ishlamaydi):

```bash
python3 -m http.server 4173   # yoki: npm start
# http://localhost:4173
```

Testlar (Node 20+): `npm test`

## Tuzilma

| Fayl | Vazifasi |
|---|---|
| `js/pricing.js` | **Barcha narxlar.** Narx o’zgarsa, faqat shu fayl tahrirlanadi |
| `js/quote.js` | `calculateQuote(input)` — toza hisob (DOM’siz); `leadForecast(state)` — sotuv prognozi |
| `js/kp.js` | `renderKp()` — 3 betlik KP HTML’i, faqat hisob natijasidan |
| `js/storage.js` | localStorage, eski yozuvlar migratsiyasi (`schemaVersion: 2`), JSON zaxira |
| `js/app.js` | Forma, USD kursi (Markaziy bank), PDF, “Mijozga ko’rsatish” |
| `js/logo.js` | Logotipni siqish va chekka fonni olib tashlash |
| `css/tokens.css` | Rang, shrift va o’lcham tokenlari (komponentlarda xom hex yo’q) |
| `css/kp.css` | KP uslubi va chop etish (`@page A4`, `break-after: page`) |
| `assets/fonts/` | Plus Jakarta Sans 400–800 (OFL), sayt ichida |

## Narx qoidalari

| Element | Narx |
|---|---|
| CRM obunasi | 189 000 so’m / agent / oy × 6 yoki 12 oy |
| Bonus | 6 oy → +1 oy, 12 oy → +3 oy (faqat CRM obunasiga) |
| O’rnatish va integratsiya | $200 (1–3 agent), $300 (4–5), $400 (6+), bir martalik, avtomatik |
| AI chatbot | 399 000 (500 mijoz) yoki 499 000 (1 000 mijoz) so’m / oy — obuna jamiga kirmaydi; birinchi oy to’lovi umumiy to’lovga qo’shiladi, keyin oyma-oy |
| IP-telefoniya UTEL (paket) | Start AI 3 xodim — 330 000, Optima AI 7 xodim — 665 000, Profi AI 15 xodim — 1 200 000 so’m/oy. Chatbot kabi oyma-oy: obuna jamiga kirmaydi, birinchi oy to’lovi umumiy to’lovga qo’shiladi |
| MyZvanki (Android, qo’ng’iroq yozuvi) | 49 000 so’m / raqam / oy |

## KP tarkibi

- To’ldirilmagan ko’rsatkichlar KP’ga chiqmaydi. “Agentlik holati” va “Qo’shimcha sotuv” bo’sh bo’lsa, bu bo’limlar
  tushib qoladi va KP “01 Nima olasiz” dan boshlanadi (raqamlash avtomatik).
- Ijrochi (ism, telefon) formada tahrirlanadi; standart — Muzaffar Mirkhamidov. “Yangi” taklifda ijrochi saqlanib qoladi.
- Agentlik logotipi KP tepasida, Omon CRM yonida kichik oq plashkada chiqadi.

## Ish oqimi (interfeys)

- **Takliflar** tugmasi o’ng tomondan panel ochadi: qidiruv, ochish, nusxa yaratish, o’chirish (qatorning o’zida
  nomi bilan tasdiqlanadi), JSON zaxira yuklab olish va tiklash.
- Yuqori panelda saqlash holati: “Yangi taklif” / “Saqlanmagan o’zgarishlar” / “Saqlangan · vaqt”. Ctrl+S (Mac’da ⌘S) saqlaydi.
- Saqlanmagan o’zgarish bor paytda yangi yoki boshqa taklif ochilsa, avval so’raladi.
- Maydon xatosi maydondan chiqqanda ko’rsatiladi va yozish boshlanishi bilan yo’qoladi; turagentlik nomi faqat saqlashda talab qilinadi.
- Telefon va planshetda “Forma / KP ko’rinishi” almashtirgichi; PDF har qanday holatda KP’ni chop etadi.
- Tugmalar kamida 44 px, kiritish maydonlari 16 px (iPhone’da sahifa kattalashmaydi), `prefers-reduced-motion` hurmat qilinadi.

## Saqlangan takliflar

localStorage kalitlari eski sayt bilan bir xil (`omon-kp-v1`, `omon-kp-draft-v1`), shuning uchun shu domendagi
avvalgi takliflar yangi saytda ham ko’rinadi. Ochilganda ular yangi formatga o’tkaziladi: `phoneType` → `telephony`,
`phones` → `lines`, `chatbot: 'none'`. JSON zaxira eski sayt eksportini ham qabul qiladi.

## Vercel

Repo ildizi — sayt ildizi (Framework: Other, build buyrug’i va output papkasi bo’sh). Hozirgi
toursales-insight loyihasini shu repoga ulash yoki yangi loyiha ochish kifoya.
