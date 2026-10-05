import { t, getLanguage } from "../core/i18n.js?v=20260928-1050";

async function loadHomeAssistantStatus() {
  const possiblePaths = [
    "../api/phoenix/home-assistant/status",
    "api/phoenix/home-assistant/status",
    "/api/phoenix/home-assistant/status"
  ];

  let lastError = null;

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path, {
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `API ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    t("homeAssistant.statusUnavailable")
  );
}


export async function renderHomeAssistant() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>🏠 ${t("homeAssistant.title")}</h2>
      <p>
        ${t("homeAssistant.description")}
      </p>
    </section>

    <div class="loading-card">
      ${t("homeAssistant.loading")}
    </div>
  `;

  try {
    const data =
      await loadHomeAssistantStatus();

    if (!data.connected) {
      content.innerHTML += `
        <div class="error-card">
          <strong>${t("homeAssistant.notConnected")}</strong>
          <p>
            ${data.error || t("homeAssistant.unreachable")}
          </p>
        </div>
      `;
      return;
    }

    const ha =
      data.home_assistant || {};

    const extractCount = (
      payload,
      preferredKeys = []
    ) => {
      if (Array.isArray(payload)) {
        return payload.length;
      }

      if (
        payload &&
        typeof payload === "object"
      ) {
        if (
          Number.isFinite(
            Number(payload.count)
          )
        ) {
          return Number(payload.count);
        }

        for (const key of preferredKeys) {
          if (Array.isArray(payload[key])) {
            return payload[key].length;
          }
        }

        const firstArray =
          Object.values(payload)
            .find(Array.isArray);

        if (firstArray) {
          return firstArray.length;
        }
      }

      return "–";
    };

    const loadCount = async (
      url,
      preferredKeys = []
    ) => {
      try {
        const response =
          await fetch(
            url,
            { cache: "no-store" }
          );

        if (!response.ok) {
          return "–";
        }

        const payload =
          await response.json();

        return extractCount(
          payload,
          preferredKeys
        );
      } catch {
        return "–";
      }
    };

    const [
      entityCount,
      deviceCount,
      areaCount,
      automationCount,
      scriptCount,
      integrationCount,
      serviceCount
    ] = await Promise.all([
      loadCount(
        "../api/phoenix/home-assistant/entities",
        ["entities"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/devices",
        ["devices"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/areas",
        ["areas"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/automations",
        ["automations"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/scripts",
        ["scripts"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/config-entries",
        ["entries", "config_entries"]
      ),
      loadCount(
        "../api/phoenix/home-assistant/services",
        ["services"]
      )
    ]);

    const coreUpdate =
      ha.core_update || null;

    const language =
      getLanguage();

    const localeMap = {
      de: "de-DE",
      en: "en-US",
      ru: "ru-RU",
      it: "it-IT",
      es: "es-ES",
      ar: "ar",
      tr: "tr-TR",
      th: "th-TH"
    };

    const locale =
      localeMap[language] || language || "de-DE";

    const localizeCountry = (value) => {
      if (!value) return null;

      try {
        return new Intl.DisplayNames(
          [locale],
          { type: "region" }
        ).of(String(value).toUpperCase()) || value;
      } catch {
        return value;
      }
    };

    const localizeLanguage = (value) => {
      if (!value) return null;

      try {
        return new Intl.DisplayNames(
          [locale],
          { type: "language" }
        ).of(String(value).toLowerCase()) || value;
      } catch {
        return value;
      }
    };

    const localizeTimezone = (value) => {
      if (!value) return null;

      try {
        const parts =
          new Intl.DateTimeFormat(
            locale,
            {
              timeZone: value,
              timeZoneName: "longGeneric"
            }
          ).formatToParts(new Date());

        return (
          parts.find(
            part =>
              part.type === "timeZoneName"
          )?.value ||
          value
        );
      } catch {
        return value;
      }
    };

    const localizeLocation = (value) => {
      if (!value) return null;

      const normalized =
        String(value)
          .trim()
          .toLowerCase();

      if (
        normalized === "zuhause" ||
        normalized === "home"
      ) {
        return t("homeAssistant.home");
      }

      return value;
    };

    const localizeSystemState = (value) => {
      if (!value) return null;

      const normalized =
        String(value)
          .trim()
          .toLowerCase();

      const knownStates = {
        running: "running",
        starting: "starting",
        stopping: "stopping",
        stopped: "stopped"
      };

      const key =
        knownStates[normalized];

      if (!key) {
        return value;
      }

      return t(
        `homeAssistant.${key}`
      );
    };

    const hasValue = (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return false;
      }

      if (
        value === "–" ||
        value === "-"
      ) {
        return false;
      }

      return true;
    };

    const statCard = (
      value,
      label,
      className = ""
    ) => {
      if (!hasValue(value)) {
        return "";
      }

      return `
        <div class="ha-stat-card ${className}">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>
      `;
    };

    const section = (
      title,
      cards
    ) => {
      const visibleCards =
        cards.filter(Boolean);

      if (!visibleCards.length) {
        return "";
      }

      return `
        <section class="ha-section">
          <h3>${title}</h3>

          <div class="ha-card-grid">
            ${visibleCards.join("")}
          </div>
        </section>
      `;
    };

    let updateText = null;

    if (coreUpdate) {
      if (coreUpdate.state === "on") {
        updateText =
          coreUpdate.latest_version
            ? `${t("homeAssistant.updateAvailable")} ${coreUpdate.latest_version}`
            : t("homeAssistant.updateAvailable");
      } else if (coreUpdate.state === "off") {
        updateText =
          t("homeAssistant.upToDate");
      } else if (coreUpdate.state) {
        updateText =
          coreUpdate.state;
      }
    }

    const systemState =
      localizeSystemState(
        ha.state || "running"
      );

    const boolText = (value) => {
      if (value === true) {
        return t("homeAssistant.active");
      }

      if (value === false) {
        return t("homeAssistant.inactive");
      }

      return null;
    };

    const systemCards = [
      statCard(
        `✅ ${t("homeAssistant.connected")}`,
        t("homeAssistant.connection")
      ),
      statCard(
        ha.version,
        t("homeAssistant.coreLabel"),
        "technical-value"
      ),
      statCard(
        systemState,
        t("homeAssistant.systemState")
      ),
      statCard(
        updateText,
        t("homeAssistant.coreUpdate")
      ),
      statCard(
        boolText(ha.safe_mode),
        t("homeAssistant.safeMode")
      ),
      statCard(
        boolText(ha.recovery_mode),
        t("homeAssistant.recoveryMode")
      )
    ];

    const networkCards = [
      statCard(
        localizeLocation(
          ha.location_name
        ),
        t("homeAssistant.location")
      ),
      statCard(
        localizeTimezone(
          ha.time_zone
        ),
        t("homeAssistant.timezone"),
        "technical-value"
      ),
      statCard(
        ha.internal_url,
        t("homeAssistant.internalAddress"),
        "technical-value ha-wide-value"
      ),
      statCard(
        ha.external_url,
        t("homeAssistant.externalAddress"),
        "technical-value ha-wide-value"
      ),
      statCard(
        localizeCountry(
          ha.country
        ),
        t("homeAssistant.country")
      ),
      statCard(
        localizeLanguage(
          ha.language
        ),
        t("homeAssistant.language")
      )
    ];

    const inventoryCards = [
      statCard(
        entityCount,
        t("homeAssistant.entities")
      ),
      statCard(
        deviceCount,
        t("homeAssistant.devices")
      ),
      statCard(
        areaCount,
        t("homeAssistant.areas")
      ),
      statCard(
        automationCount,
        t("homeAssistant.automations")
      ),
      statCard(
        scriptCount,
        t("homeAssistant.scripts")
      ),
      statCard(
        integrationCount,
        t("homeAssistant.integrations")
      ),
      statCard(
        serviceCount,
        t("homeAssistant.services")
      ),
      statCard(
        ha.components_count,
        t("homeAssistant.loadedComponents")
      )
    ];

    const additionalCards = [
      statCard(
        ha.uptime,
        t("homeAssistant.uptime"),
        "technical-value"
      ),
      statCard(
        ha.last_boot,
        t("homeAssistant.lastStart"),
        "technical-value"
      ),
      statCard(
        coreUpdate?.installed_version,
        t("homeAssistant.installedCoreVersion"),
        "technical-value"
      ),
      statCard(
        coreUpdate?.latest_version,
        t("homeAssistant.latestCoreVersion"),
        "technical-value"
      )
    ];

    content.innerHTML = `
      <div class="ha-dashboard">
        <section class="page-header">
          <h2>🏠 ${t("homeAssistant.title")}</h2>
          <p>
            ${t("homeAssistant.description")}
          </p>
        </section>

        ${section(
          `🟢 ${t("homeAssistant.systemOverview")}`,
          systemCards
        )}

        ${section(
          `🌐 ${t("homeAssistant.networkLocation")}`,
          networkCards
        )}

        ${section(
          `🏠 ${t("homeAssistant.inventory")}`,
          inventoryCards
        )}

        ${section(
          `⚙️ ${t("homeAssistant.additionalSystemData")}`,
          additionalCards
        )}
      </div>
    `;
  } catch (error) {
    content.innerHTML += `
      <div class="error-card">
        <strong>${t("homeAssistant.connectionError")}</strong>
        <p>${error.message}</p>
      </div>
    `;
  }
}
