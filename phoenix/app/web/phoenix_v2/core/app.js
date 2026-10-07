import {
  getLanguage,
  getLanguageInformation,
  getTranslationCount,
  initializeLanguage,
  setLanguage,
  t
} from "./i18n.js?v=20260928-1050";

import {
  getCurrentRoute,
  initializeRouter,
  navigate,
  registerRoute
} from "./router.js?v=20260928-1050";

import {
  renderOverview
} from "../modules/overview.js?v=20260928-1050";

import {
  renderLabels
} from "../modules/labels.js?v=20260928-1050";

import {
  renderRonnyAI
} from "../modules/ronny_ai.js?v=20261003-0751";

import {
  renderAutomations
} from "../modules/automations.js?v=20260929-0635";

import {
  renderScripts
} from "../modules/scripts.js?v=20261001-1105";

import {
  renderSettings
} from "../modules/settings.js?v=20260928-1050";

import {
  renderHelp
} from "../modules/help.js?v=20261006-help";

import {
  renderHomeAssistant
} from "../modules/home_assistant.js?v=20260928-1050";

import {
  renderAreas
} from "../modules/areas.js?v=20260928-1050";

import {
  renderDevices
} from "../modules/devices.js?v=20260928-1050";

import {
  renderEntities
} from "../modules/entities.js?v=20260928-1050";

const navigationItems = [
  {
    route: "overview",
    icon: "🏠",
    key: "navigation.overview"
  },
  {
    route: "home-assistant",
    icon: "🏡",
    key: "navigation.homeAssistant"
  },
  {
    route: "ai",
    icon: "🧠",
    key: "navigation.ai"
  },
  {
    route: "entities",
    icon: "🔌",
    key: "navigation.entities"
  },
  {
    route: "devices",
    icon: "💡",
    key: "navigation.devices"
  },
  {
    route: "areas",
    icon: "📍",
    key: "navigation.areas"
  },
  {
    route: "labels",
    icon: "🏷️ ",
    key: "navigation.labels"
  },
  {
    route: "automations",
    icon: "⚡",
    key: "navigation.automations"
  },
  {
    route: "scripts",
    icon: "📜",
    key: "navigation.scripts"
  },
  {
    route: "settings",
    icon: "💾",
    key: "navigation.settings"
  },
  {
    route: "help",
    icon: "❓",
    key: "navigation.help"
  }
];

function renderNavigation() {
  const navigation =
    document.getElementById(
      "mainNavigation"
    );

  const currentRoute =
    getCurrentRoute();

  navigation.innerHTML =
    navigationItems
      .map(item => `
        <button
          class="nav-button ${
            item.route === currentRoute
              ? "active"
              : ""
          }"
          type="button"
          data-route="${item.route}"
        >
          <span class="nav-icon">
            ${item.icon}
          </span>

          <span class="nav-label">
            ${t(item.key)}
          </span>
        </button>
      `)
      .join("");

  navigation
    .querySelectorAll(".nav-button")
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          await navigate(
            button.dataset.route
          );

          closeDrawer();
        }
      );
    });
}

function updateLanguageDisplay() {
  const language =
    getLanguage();

  const information =
    getLanguageInformation()[language];

  document.getElementById(
    "languageFlag"
  ).src =
    `phoenix_v2/assets/flags/${language === "en" ? "gb" : language === "ar" ? "sa" : language}.svg`;

  document.getElementById(
    "languageCode"
  ).textContent =
    information.name;

  document.getElementById(
    "systemLanguage"
  ).textContent =
    `${t("common.language")}: ${information.flag} ${information.name}`;

}

function openDrawer() {
  document
    .getElementById("sidebar")
    .classList.add("open");

  document
    .getElementById("drawerOverlay")
    .classList.add("open");
}

function closeDrawer() {
  document
    .getElementById("sidebar")
    .classList.remove("open");

  document
    .getElementById("drawerOverlay")
    .classList.remove("open");
}

function bindInterface() {
  document
    .getElementById("menuButton")
    .addEventListener(
      "click",
      openDrawer
    );

  document
    .getElementById("drawerOverlay")
    .addEventListener(
      "click",
      closeDrawer
    );

  const languageButton =
    document.getElementById(
      "languageButton"
    );

  const languageMenu =
    document.getElementById(
      "languageMenu"
    );

  languageButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      languageMenu.hidden =
        !languageMenu.hidden;
    }
  );

  languageMenu
    .querySelectorAll(
      "[data-language]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        async () => {
          setLanguage(
            button.dataset.language
          );

          languageMenu.hidden = true;

          await refreshCurrentPage();
        }
      );
    });

  document.addEventListener(
    "click",
    event => {
      if (
        !languageMenu.contains(
          event.target
        ) &&
        !languageButton.contains(
          event.target
        )
      ) {
        languageMenu.hidden = true;
      }
    }
  );
}

function registerRoutes() {
  registerRoute(
    "overview",
    renderOverview
  );

  registerRoute(
    "labels",
    renderLabels
  );

  registerRoute(
    "settings",
    renderSettings
  );

  registerRoute(
    "help",
    renderHelp
  );

  registerRoute(
    "home-assistant",
    renderHomeAssistant
  );

  registerRoute(
    "areas",
    renderAreas
  );

  registerRoute(
    "entities",
    renderEntities
  );

  registerRoute(
    "devices",
    renderDevices
  );

  registerRoute(
    "automations",
    renderAutomations
  );

  registerRoute(
    "scripts",
    renderScripts
  );

  registerRoute(
    "ai",
    renderRonnyAI
  );
}

async function refreshCurrentPage() {
  renderNavigation();
  updateLanguageDisplay();

  await navigate(
    getCurrentRoute() || "overview",
    {
      updateHistory: false
    }
  );
}

async function startPhoenixV2() {
  initializeLanguage();

  registerRoutes();
  bindInterface();
  renderNavigation();
  updateLanguageDisplay();

  window.addEventListener(
    "phoenix-v2:language-changed",
    refreshCurrentPage
  );

  window.addEventListener(
    "phoenix-v2:route-changed",
    renderNavigation
  );

  // Home-Assistant-Daten bereits laden,
  // während Phoenix selbst noch startet.
  import("./api.js")
    .then(api => {
      if (
        typeof api.preloadPhoenixOverviewData
        === "function"
      ) {
        return api.preloadPhoenixOverviewData();
      }
    })
    .catch(error => {
      console.debug(
        "[Phoenix V2] Preload übersprungen:",
        error
      );
    });

  await initializeRouter();

  console.log(
    "[Phoenix V2] Erfolgreich gestartet.",
    {
      language: getLanguage(),
      route: getCurrentRoute()
    }
  );
}

startPhoenixV2().catch(error => {
  console.error(
    "[Phoenix V2] Startfehler:",
    error
  );

  document.getElementById(
    "pageContent"
  ).innerHTML = `
    <div class="error-card">
      ${t("common.startupFailed")}
      <br>
      ${String(error.message || error)}
    </div>
  `;
});
