(function () {
  "use strict";

  const SUPPORTED_LANGUAGES = [
    "de", "en", "es", "fr", "it", "pl", "ru", "th", "ar"
  ];

  function normalizeLanguage(lang) {
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : "de";
  }

  function getSavedLanguage() {
    return normalizeLanguage(
      localStorage.getItem("phoenix_language") ||
      localStorage.getItem("phoenixLang") ||
      document.documentElement.lang ||
      "de"
    );
  }

  function getPhoenixBaseUrl() {
    const base = new URL(window.location.href);

    base.search = "";
    base.hash = "";

    base.pathname = base.pathname.replace(/\/+$/, "") + "/";

    return base;
  }

  async function loadTranslations(lang) {
    const base = getPhoenixBaseUrl();
    const url = new URL(`lang/${lang}.json`, base);

    const response = await fetch(url.href, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Sprachdatei ${lang}.json konnte nicht geladen werden: ${response.status}`
      );
    }

    return response.json();
  }

  async function setLanguage(requestedLanguage) {
    const lang = normalizeLanguage(requestedLanguage);

    
localStorage.setItem("phoenix_language", lang);

document.dispatchEvent(new CustomEvent("phoenix:language-changed",{
    detail:{
        lang:lang,
        translations:translations
    }
}));

    localStorage.setItem("phoenixLang", lang);

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    try {
      const translations = await loadTranslations(lang);

      window.phoenixLanguage = lang;
      window.phoenixTranslations = translations;

      document.dispatchEvent(
        new CustomEvent("phoenix:language-changed", {
          detail: {
            lang,
            translations
          }
        })
      );

      return translations;
    } catch (error) {
      console.error("Phoenix Sprachsystem:", error);
      throw error;
    }
  }

  function bindLanguageButtons() {
    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-lang]");
      if (!button) return;

      const lang = button.dataset.lang;
      if (!lang) return;

      setLanguage(lang).catch(function () {
        /* Fehler wurde bereits protokolliert */
      });
    });
  }

  window.PhoenixI18n = {
    getLanguage: getSavedLanguage,
    setLanguage,
    loadTranslations
  };

  async function boot() {
    bindLanguageButtons();

    try {
      await setLanguage(getSavedLanguage());
    } catch (error) {
      console.error("Phoenix Sprachstart fehlgeschlagen:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
