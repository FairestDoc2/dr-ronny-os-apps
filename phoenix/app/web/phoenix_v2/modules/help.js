import { t } from "../core/i18n.js?v=20260928-1050";

function helpCard(icon, title, description, details = []) {
  return `
    <article class="card help-card">
      <div class="help-card-heading">
        <span class="help-card-icon">${icon}</span>
        <h3>${title}</h3>
      </div>

      <p>${description}</p>

      ${
        details.length
          ? `
            <ul class="help-list">
              ${details.map(item => `<li>${item}</li>`).join("")}
            </ul>
          `
          : ""
      }
    </article>
  `;
}

export async function renderHelp() {
  let developerMode = false;

  try {
    const response = await fetch(
      "api/phoenix/system-control/status",
      { cache: "no-store" }
    );

    if (response.ok) {
      const status = await response.json();
      developerMode =
        status.owner_installation === true &&
        status.developer_mode === true;
    }
  } catch (error) {
    console.warn(
      "Phoenix Help: Entwicklerstatus konnte nicht geladen werden.",
      error
    );
  }
  const page = document.getElementById("pageContent");

  if (!page) {
    return;
  }

  page.innerHTML = `
    <section class="page-header">
      <h2>❓ ${t("help.title")}</h2>
      <p>${t("help.subtitle")}</p>
    </section>

    <section class="help-intro card">
      <div class="help-intro-logo">
        <img
          src="phoenix_v2/assets/phoenix-logo.png?v=1029"
          alt="Dr. Ronny OS"
        >
      </div>

      <div>
        <h3>${t("help.welcomeTitle")}</h3>
        <p>${t("help.welcomeText")}</p>
      </div>
    </section>

    <nav class="help-jump-navigation">
      <a href="#help-system">🏠 ${t("help.systemTitle")}</a>
      <a href="#help-home-assistant">🏡 ${t("help.homeAssistantTitle")}</a>
      <a href="#help-organization">🏷️ ${t("help.organizationTitle")}</a>
      <a href="#help-actions">⚡ ${t("help.actionsTitle")}</a>
      <a href="#help-ai">🧠 ${t("help.aiTitle")}</a>
      <a href="#help-backups">💾 ${t("help.backupsTitle")}</a>
      ${developerMode ? `
      <a href="#help-developer">🛠️ ${t("help.developerTitle")}</a>
      ` : ""}
      <a href="#help-contact">✉️ ${t("help.contactTitle")}</a>
    </nav>

    <section id="help-system" class="help-section">
      <div class="page-header help-section-header">
        <h2>🏠 ${t("help.systemTitle")}</h2>
        <p>${t("help.systemSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "📊",
          t("help.overviewTitle"),
          t("help.overviewText"),
          [
            t("help.overviewPoint1"),
            t("help.overviewPoint2")
          ]
        )}

        ${helpCard(
          "🔌",
          t("help.entitiesTitle"),
          t("help.entitiesText")
        )}

        ${helpCard(
          "💡",
          t("help.devicesTitle"),
          t("help.devicesText")
        )}
      </div>
    </section>

    <section id="help-home-assistant" class="help-section">
      <div class="page-header help-section-header">
        <h2>🏡 ${t("help.homeAssistantTitle")}</h2>
        <p>${t("help.homeAssistantSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "🟢",
          t("help.homeAssistantStatusTitle"),
          t("help.homeAssistantStatusText"),
          [
            t("help.homeAssistantStatusPoint1"),
            t("help.homeAssistantStatusPoint2")
          ]
        )}

        ${helpCard(
          "🌐",
          t("help.homeAssistantNetworkTitle"),
          t("help.homeAssistantNetworkText"),
          [
            t("help.homeAssistantNetworkPoint1"),
            t("help.homeAssistantNetworkPoint2")
          ]
        )}

        ${helpCard(
          "📦",
          t("help.homeAssistantInventoryTitle"),
          t("help.homeAssistantInventoryText"),
          [
            t("help.homeAssistantInventoryPoint1"),
            t("help.homeAssistantInventoryPoint2")
          ]
        )}
      </div>
    </section>

    <section id="help-organization" class="help-section">
      <div class="page-header help-section-header">
        <h2>🏷️ ${t("help.organizationTitle")}</h2>
        <p>${t("help.organizationSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "📍",
          t("help.areasTitle"),
          t("help.areasText")
        )}

        ${helpCard(
          "🏷️",
          t("help.labelsTitle"),
          t("help.labelsText")
        )}
      </div>
    </section>

    <section id="help-actions" class="help-section">
      <div class="page-header help-section-header">
        <h2>⚡ ${t("help.actionsTitle")}</h2>
        <p>${t("help.actionsSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "⚡",
          t("help.automationsTitle"),
          t("help.automationsText")
        )}

        ${helpCard(
          "📜",
          t("help.scriptsTitle"),
          t("help.scriptsText")
        )}
      </div>
    </section>

    <section id="help-ai" class="help-section">
      <div class="page-header help-section-header">
        <h2>🧠 ${t("help.aiTitle")}</h2>
        <p>${t("help.aiSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "🧠",
          t("help.ronnyAiTitle"),
          t("help.ronnyAiText"),
          [
            t("help.ronnyAiPoint1"),
            t("help.ronnyAiPoint2")
          ]
        )}
      </div>
    </section>

    <section id="help-backups" class="help-section">
      <div class="page-header help-section-header">
        <h2>💾 ${t("help.backupsTitle")}</h2>
        <p>${t("help.backupsSubtitle")}</p>
      </div>

      <div class="card-grid">
        ${helpCard(
          "🧠",
          t("help.phoenixSnapshotTitle"),
          t("help.phoenixSnapshotText"),
          [
            t("help.phoenixSnapshotPoint1"),
            t("help.phoenixSnapshotPoint2")
          ]
        )}

        ${helpCard(
          "🏠",
          t("help.haBackupTitle"),
          t("help.haBackupText"),
          [
            t("help.haBackupPoint1"),
            t("help.haBackupPoint2"),
            t("help.haBackupPoint3")
          ]
        )}
      </div>

      <article class="card help-backup-note">
        <h3>ℹ️ ${t("help.backupDifferenceTitle")}</h3>
        <p>${t("help.backupDifferenceText")}</p>
      </article>

    </section>

    ${developerMode ? `
    <section id="help-developer" class="help-section">
      <div class="page-header help-section-header">
        <h2>🛠️ ${t("help.developerTitle")}</h2>
        <p>${t("help.developerText")}</p>
      </div>

      <article class="card help-developer-card">
        <ul class="help-detail-list">
          <li>${t("help.developerPoint1")}</li>
          <li>${t("help.developerPoint2")}</li>
          <li>${t("help.developerPoint3")}</li>
          <li>${t("help.developerPoint4")}</li>
        </ul>

        <p class="help-developer-warning">
          🔒 ${t("help.developerWarning")}
        </p>
      </article>
    </section>
    ` : ""}

    <section id="help-contact" class="help-section">
      <div class="page-header help-section-header">
        <h2>✉️ ${t("help.contactTitle")}</h2>
        <p>${t("help.contactSubtitle")}</p>
      </div>

      <article class="card help-contact-card">
        <div>
          <h3>${t("help.contactIdeasTitle")}</h3>
          <p>${t("help.contactIdeasText")}</p>
        </div>

        <a
          class="help-email-button"
          href="mailto:FairestDoc@googlemail.com"
        >
          ✉️ FairestDoc@googlemail.com
        </a>
      </article>
    </section>
  `;
}
