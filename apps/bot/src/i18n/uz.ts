import type { Translations } from './ru';

/** Uzbek translations. Mirrors ru.ts keys structurally. */
export const uz: Translations = {
  welcome: {
    chooseLanguage: 'Выберите язык / Tilni tanlang:',
    languageSet: "✓ O'zbek tanlandi",
    greeting:
      "Dorify'ga xush kelibsiz, {{name}}!\n\nDori-darmonlar marketplace'i — yaqin atrofdagi dorixonalardan yetkazib berish.\n\nNima qilmoqchisiz?",
    roleBuyer: "🛒 Dori-darmon sotib olish",
    roleRegisterPharmacy: "🏪 Dorixonani ro'yxatdan o'tkazish",
    openCatalog: "Katalogni ochish",
    openRegistration: "Anketani ochish",
    openCatalogPrompt: "Dorify katalogini oching:",
    openRegistrationPrompt: "Dorixonani ro'yxatdan o'tkazish anketasini to'ldiring:",
  },
  language: {
    russian: 'Русский',
    uzbek: "O'zbek",
    chooseToSwitch: "Tilni tanlang:",
  },
  help: {
    title: "📋 Buyruqlar:",
    start: "/start — Asosiy menyu",
    language: "/language — Tilni o'zgartirish",
    helpCmd: "/help — Yordam",
    footer: "Dori-darmon sotib olish uchun asosiy menyudan katalogni oching.",
  },
};
