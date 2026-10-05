(function(){
  const flags = {
    de:"flag-de", en:"flag-gb", es:"flag-es", fr:"flag-fr",
    it:"flag-it", pl:"flag-pl", ru:"flag-ru", th:"flag-th", ar:"flag-sa"
  };

  const langFiles = {};

  async function loadLang(lang){
    if(!langFiles[lang]){
      const r = await fetch("../lang/" + lang + ".json?v=" + Date.now(), {cache:"no-store"});
      langFiles[lang] = await r.json();
    }
    return langFiles[lang];
  }

  function greetingKey(){
    const h = new Date().getHours();
    if(h < 5) return "goodNight";
    if(h < 11) return "goodMorning";
    if(h < 17) return "goodDay";
    return "goodEvening";
  }

  function q(sel){ return document.querySelector(sel); }
  function qa(sel){ return Array.from(document.querySelectorAll(sel)); }

  async function applyLanguage(lang){
    const t = await loadLang(lang);
    localStorage.setItem("phoenix_language", lang);

    window.phoenixLanguage = lang;
    window.phoenixTranslations = t;

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    const flag = q("#currentLangFlag");
    if(flag) flag.className = "flag " + (flags[lang] || "flag-de");

    const title = q(".topbar h2");
    if(title) title.textContent = t.overview;

    const dash = q(".topbar .kicker");
    if(dash) dash.textContent = t.dashboard;

    const search = q(".top-actions button span");
    if(search) search.textContent = t.search;

    const greeting = q("#phoenixGreeting");
    const weatherIcon = q("#weatherHeroIcon")?.textContent || "";
    if(greeting){
      greeting.innerHTML = (t[greetingKey()] || t.goodDay || "Hallo Ronny") + ' <span id="weatherHeroIcon">' + weatherIcon + '</span>';
    }

    const heroText = q(".hero p:not(.kicker)");
    if(heroText) heroText.textContent = t.heroText;

    const factLabels = qa(".fact b");
    if(factLabels[0]) factLabels[0].textContent = t.time;
    if(factLabels[1]) factLabels[1].textContent = t.today;
    if(factLabels[2]) factLabels[2].textContent = t.weather;

    const nav = qa(".nav button");
    const navTexts = [
      t.overview,
      t.ronnyAi,
      t.homeAssistant || "Home Assistant",
      t.devices,
      t.labels,
      t.areas,
      t.automations,
      t.scripts,
      t.settings || "Settings"
    ];
    nav.forEach((btn,i)=>{
      if(navTexts[i]) {
        const icon = btn.textContent.trim().split(" ")[0];
        btn.textContent = icon + " " + navTexts[i].replace(/^.*?\s/, "");
      }
    });

    const inventoryLabels = qa(".inventory-grid button span");
    const inv = [t.entities,t.automations,t.areas,t.labels,t.devices,t.integrations,t.scripts,t.scenes];
    inventoryLabels.forEach((el,i)=>{
      if(inv[i]) el.textContent = inv[i];
    });

    qa(".panel h3").forEach(h=>{
      const text = h.textContent;
      if(text.includes("Phoenix Core")) h.textContent = "🧠 Phoenix Core";
      if(text.includes("Aktiv") || text.includes("Activity") || text.includes("Actividad") || text.includes("Attività") || text.includes("Aktywność") || text.includes("Актив") || text.includes("กิจกรรม") || text.includes("النشاط")) h.textContent = t.activity;
      if(text.includes("System Health") || text.includes("Estado") || text.includes("Santé") || text.includes("Stato") || text.includes("Stan") || text.includes("Состояние") || text.includes("สถานะ") || text.includes("صحة")) h.textContent = t.systemHealth;
      if(text.includes("Ronny AI")) h.textContent = t.ronnyAi;
    });

    const coreSub = q(".inventory-grid")?.closest(".panel")?.querySelector("p");
    if(coreSub) coreSub.textContent = t.coreSub;

    const events = qa(".event span");
    if(events[0]) events[0].textContent = t.activity1;
    if(events[1]) events[1].textContent = t.activity2;
    if(events[2]) events[2].textContent = t.activity3;

    const aiBubble = q(".ai-bubble");
    if(aiBubble) aiBubble.textContent = t.aiText || "";

    const askBtn = q(".ai button");
    if(askBtn) askBtn.textContent = t.ask + " ✨";

    if(typeof window.renderPhoenixOrderCenterLanguage === "function"){
      window.renderPhoenixOrderCenterLanguage(t, lang);
    }

    const date = q("#phoenixDate");
    if(date){
      const locale = lang === "de" ? "de-DE" : lang;
      date.textContent = new Date().toLocaleDateString(locale,{
        weekday:"long",
        day:"2-digit",
        month:"long"
      });
    }
  }

  function bindLanguageMenu(){
    const toggle = q("#languageToggle");
    const menu = q("#languageDropdown");

    if(!toggle || !menu) return;

    toggle.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      menu.classList.toggle("open");
    };

    menu.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();

      const btn = e.target.closest("[data-lang]");
      if(!btn) return;

      applyLanguage(btn.dataset.lang);
      menu.classList.remove("open");
    };

    document.addEventListener("click",function(){
      menu.classList.remove("open");
    });
  }

  function updateClock(){
    const now = new Date();
    const time = q("#phoenixTime");
    if(time){
      time.textContent = String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
    }
  }

  async function boot(){
    bindLanguageMenu();
    updateClock();

    const saved = localStorage.getItem("phoenix_language") || "de";
    await applyLanguage(saved);

    setInterval(updateClock,30000);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",boot);
  } else {
    boot();
  }
})();
