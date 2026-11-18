import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useSettings } from "../lib/settings";
import { cs } from "./cs";
import { en } from "./en";

void i18n.use(initReactI18next).init({
  resources: { cs: { translation: cs }, en: { translation: en } },
  lng: useSettings.getState().lang,
  fallbackLng: "cs",
  interpolation: { escapeValue: false },
});
useSettings.subscribe((s) => { if (i18n.language !== s.lang) void i18n.changeLanguage(s.lang); });
export default i18n;
