export interface Translations {
  welcome: {
    chooseLanguage: string;
    languageSet: string;
    greeting: string;
    roleBuyer: string;
    roleRegisterPharmacy: string;
    openCatalog: string;
    openRegistration: string;
    openCatalogPrompt: string;
    openRegistrationPrompt: string;
  };
  language: {
    russian: string;
    uzbek: string;
    chooseToSwitch: string;
  };
  help: {
    title: string;
    start: string;
    language: string;
    helpCmd: string;
    footer: string;
  };
}

/** Russian translations. Source of truth for keys via `Translations`. */
export const ru: Translations = {
  welcome: {
    chooseLanguage: 'Выберите язык / Tilni tanlang:',
    languageSet: '✓ Русский выбран',
    greeting: 'Добро пожаловать в Dorify, {{name}}!\n\nАптечный маркетплейс — лекарства с доставкой из ближайших аптек.\n\nЧто вы хотите сделать?',
    roleBuyer: '🛒 Купить лекарства',
    roleRegisterPharmacy: '🏪 Зарегистрировать аптеку',
    openCatalog: 'Открыть каталог',
    openRegistration: 'Открыть форму',
    openCatalogPrompt: 'Откройте каталог Dorify:',
    openRegistrationPrompt: 'Заполните форму регистрации аптеки:',
  },
  language: {
    russian: 'Русский',
    uzbek: "O'zbek",
    chooseToSwitch: 'Выберите язык:',
  },
  help: {
    title: '📋 Команды:',
    start: '/start — Главное меню',
    language: '/language — Сменить язык',
    helpCmd: '/help — Справка',
    footer: 'Для покупки лекарств откройте каталог в главном меню.',
  },
};
