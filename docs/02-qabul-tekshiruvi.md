# Qabul mezonlari bo’yicha tekshiruv

Tekshiruv: 2026-11-06. Avtomatik testlar `npm test` (Node, 24 ta), brauzer tekshiruvi Playwright + Chromium
(kompyuter 1400 px, planshet 1000 px, telefon 375 px) va Chromium’da yasalgan PDF (`pdfinfo`, `pdffonts`, `pdftotext`).

## Hisob-kitob — `tests/quote.test.js`

| Mezon | Natija |
|---|---|
| 3 agent, 6 oy, telefoniya va chatbot yo’q, kurs 11 941,65 → CRM 3 402 000, o’rnatish $200 = 2 388 330, umumiy 5 790 330, foydalanish 7 oy | ✅ |
| 5 agent, 12 oy, MyZvanki 5 raqam, chatbot 500 → obuna 19 068 000, oyiga 1 589 000, $300, 15 oy, bonus bilan CRM 756 000 | ✅ |
| O’rnatish: 1 va 3 → $200, 4 va 5 → $300, 6 → $400 | ✅ |
| Chatbot 1 000 mijoz, 6 oy → 2 994 000 | ✅ |
| UzTel 2 raqam, 6 oy → 1 320 000 | ✅ |
| Bo’sh maydon KP’da “—”, NaN/undefined/0 so’m chiqmaydi | ✅ (`tests/kp.test.js` ham) |

## KP va PDF

| Mezon | Natija |
|---|---|
| 12 oy tanlanganda “6 oy” yoki “+1 oy” yo’q | ✅ `tests/kp.test.js` + brauzerda |
| Tanlanmagan telefoniya/chatbot narx jadvalida yo’q | ✅ `tests/kp.test.js` |
| Tur qidirish: “14 ta operator, 30 soniya, bron”, Turvisor yo’q | ✅ `tests/kp.test.js` |
| PDF A4, 3 bet, bloklar kesilmaydi, matn belgilanadi | ✅ Chromium: 595×842 pt, 3 bet, har bet kontenti 1123 px ichida; Plus Jakarta Sans 5 vazni PDF ichiga joylangan; `pdftotext` matnni o’qiydi |
| PDF fayl nomi agentlik va sana bilan | ✅ `OmonCRM_KP_<agentlik>_<YYYY-MM-DD>` (print vaqtida sahifa sarlavhasi) |
| Chrome va Safari’da (kompyuter va telefon) bir xil | ⚠️ Faqat Chromium’da tekshirildi. Safari’da qo’lda ko’rish kerak (pastga qarang) |

## Saqlash va moslik

| Mezon | Natija |
|---|---|
| Eski saytda saqlangan KP xatosiz ochiladi, chatbot “yo’q” | ✅ `tests/storage.test.js` + brauzerda (eski `phoneType: company` → UzTel) |
| JSON zaxira yangi maydonlar bilan yuklanadi va qayta import qilinadi | ✅ eski sayt eksporti ham import bo’ladi |
| Forma 375 px’da gorizontal aylantirishsiz | ✅ `scrollWidth = 375` |
| USD kursi kelmasa qo’lda kiritib hisoblash mumkin | ✅ (bu muhitda cbu.uz yopiq edi — aynan shu holat sinaldi) |

## Safari’da qo’lda tekshirish

1. iPhone va Mac Safari’da saytni ochib, nazorat misolini kiriting (5 agent, 12 oy, MyZvanki 5 raqam, chatbot 500).
2. “PDF chiqarish” → chop etish oynasida qog’oz **A4**, chegaralar **yo’q / minimal**, “Fon grafikasi” yoqilgan bo’lsin.
3. PDF 3 bet bo’lishi va 3-betning pastidagi “Keyingi qadam” bloki va sahifa raqami “3 / 3” sig’ishi kerak.

Eski Safari versiyalari `@page { margin: 0 }` ni e’tiborsiz qoldirishi mumkin; shunda chegaralarni chop etish oynasida qo’lda “Yo’q” qilish kerak.

## 2026-11-09 o’zgarishlari (buyurtmachi talabi bilan, TZ’dan farqli)

| O’zgarish | Tekshiruv |
|---|---|
| AI chatbot oyma-oy: obuna jamiga va “O’rtacha oyiga”ga kirmaydi, KP’da alohida “399 000 so’m / oy” qatori. Nazorat misoli endi: obuna 14 280 000, oyiga 1 190 000 | ✅ `tests/quote.test.js`, `tests/kp.test.js` |
| Bo’sh ko’rsatkich “—” emas, butunlay chiqmaydi; bo’sh 01/02 bo’limlar tushib qoladi, raqamlash 01 dan; bo’limlar uzluksiz oqimda, PDF’da betlarni brauzer taqsimlaydi | ✅ `tests/kp.test.js`; Chromium’da 4 xil holat — har biri 3 bet, bloklar kesilmaydi |
| PDF’da oxirgi bet pastidagi qator alohida 4-betga tushib qolardi — chop etishda yashirildi (kontaktlar “Keyingi qadam”da) | ✅ Chromium PDF |
| Ijrochi tahrirlanadi, “Yangi” taklifda saqlanadi; eski yozuvlardagi `manager` ijrochiga o’tadi | ✅ `tests/storage.test.js`, brauzerda |
| Agentlik logotipi tepada Omon CRM yonida | ✅ `tests/kp.test.js`, brauzerda |
| Taqqoslash (Bitrix24 / amoCRM) bo’limi olib tashlandi; to’liq KP endi 01–06 bo’lim | ✅ `tests/kp.test.js`; Chromium PDF: to’liq 3 bet, bo’sh bo’limlarsiz 2 bet |

## 2026-11-09: interfeys (UX) yangilanishi

| O’zgarish | Tekshiruv |
|---|---|
| Takliflar paneli (qidiruv, ochish, nusxa, nomi bilan o’chirishni tasdiqlash, zaxira), saqlash holati, Ctrl+S | ✅ Chromium: panel fokusni ushlaydi, Esc yopadi, fokus tugmaga qaytadi |
| Saqlanmagan o’zgarishlarni yo’qotishdan oldin so’rash (yangi taklif, boshqa taklifni ochish) | ✅ Chromium |
| Maydon xatolari blur’da, yozganda yo’qoladi; xabarlar ayblamaydi va yo’l ko’rsatadi | ✅ `tests/validate.test.js`, Chromium |
| 375 px: Forma / KP almashtirgichi, gorizontal aylantirish yo’q; telefondan PDF KP’ni chop etadi | ✅ Chromium |
| Tugmalar ≥ 44 px, kiritish matni 16 px, interfeysda 3 ta qalinlik, reduced-motion | ✅ Chromium o’lchovi |

## 2026-11-09: narx hisobi ixchamlashtirildi

| O’zgarish | Tekshiruv |
|---|---|
| Jadval ostidagi 3 ta katta kartochka olib tashlandi (raqamlar jadvalda bor); “O’rtacha oyiga” ko’k “Jami” qatorida; bonus oylar bloki qisqardi | ✅ `tests/kp.test.js` |
| To’liq KP: “Nima olasiz” va butun narx hisobi 2-betda, bo’sh joy qolmaydi; prognozsiz KP 2 bet | ✅ Chromium PDF: 3 / 2 / 3 / 3 bet |

## 2026-11-10: chatbot 1-oyi umumiy to’lovda, dizayn

| O’zgarish | Tekshiruv |
|---|---|
| AI chatbotning birinchi oy to’lovi “Umumiy to’lov”ga qo’shiladi; oyma-oy qatori va shartlardagi izoh saqlanadi. Nazorat misoli: 14 280 000 + 3 582 495 + 399 000 = 18 261 495 | ✅ `tests/quote.test.js`, `tests/kp.test.js` |
| Forma ustuni telefoniya tanlanganda kengayib, o’ng cheti kesilardi — tuzatildi | ✅ Chromium o’lchovi |
| KP: asosiy raqamlar ikonkalar bilan sarlavha ustiga chiqib turadi; “Joriy etish” va “Shartlar”ga sarlavha; shartlar belgili ikki ustunda; preview’da varaq aniq qog’oz kengligida | ✅ Chromium PDF: 3 / 2 / 3 / 3 bet |
| IP-telefoniya (UTEL) paketlari | ⏳ utel.uz tarmoqda ochilmadi — paket ma’lumotlari kutilmoqda |
