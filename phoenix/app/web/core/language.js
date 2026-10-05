class PhoenixLanguage {
  constructor(){
    this.current = localStorage.getItem("phoenix_language") || "de";
    this.languages = {};
    this.flags = {
      de:"flag-de", en:"flag-gb", es:"flag-es", fr:"flag-fr",
      it:"flag-it", pl:"flag-pl", ru:"flag-ru", th:"flag-th", ar:"flag-sa"
    };
  }

  async load(lang){
    if(!this.languages[lang]){
      const res = await fetch("lang/" + lang + ".json?v=" + Date.now(), {cache:"no-store"});
      this.languages[lang] = await res.json();
    }
    this.current = lang;
    localStorage.setItem("phoenix_language", lang);
  }

  t(key){
    const data = this.languages[this.current] || {};
    const de = this.languages.de || {};
    return data[key] || de[key] || key;
  }

  greetingKey(){
    const h = new Date().getHours();
    if(h < 5) return "goodNight";
    if(h < 11) return "goodMorning";
    if(h < 17) return "goodDay";
    return "goodEvening";
  }

  apply(){
    document.documentElement.lang = this.current;
    document.documentElement.dir = this.current === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(el=>{
      el.textContent = this.t(el.dataset.i18n);
    });

    document.querySelectorAll("[data-nav-i18n]").forEach(el=>{
      el.textContent = this.t(el.dataset.navI18n);
    });

    const flag = document.getElementById("currentLangFlag");
    if(flag){
      flag.className = "flag " + (this.flags[this.current] || "flag-de");
    }

    const greeting = document.getElementById("phoenixGreeting");
    const weatherIcon = document.getElementById("weatherHeroIcon")?.textContent || "";
    if(greeting){
      greeting.innerHTML = this.t(this.greetingKey()) + ' <span id="weatherHeroIcon">' + weatherIcon + '</span>';
    }

    const date = document.getElementById("phoenixDate");
    if(date){
      const locale = this.current === "de" ? "de-DE" : this.current;
      date.textContent = new Date().toLocaleDateString(locale,{
        weekday:"long",
        day:"2-digit",
        month:"long"
      });
    }
  }

  async init(){
    await this.load(this.current);
    if(!this.languages.de) await this.load("de");
    await this.load(this.current);
    this.apply();
  }

  async change(lang){
    await this.load(lang);
    this.apply();
  }
}

window.PhoenixLanguage = new PhoenixLanguage();

document.addEventListener("DOMContentLoaded", ()=>{
  window.PhoenixLanguage.init();
});
