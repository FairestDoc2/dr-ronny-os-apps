import {
  loadPhoenixStatus,
  loadHomeAssistantStatus,
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantEntities,
  loadHomeAssistantDevices,
  loadHomeAssistantAreas,
  loadHomeAssistantLabels,
  loadHomeAssistantAutomations,
  loadHomeAssistantScripts
} from "../core/api.js?v=20260928-1050";

import { t } from "../core/i18n.js?v=20260928-1050";

const overviewLogoUrl = "/local/avatar.png";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  return [];
}

export async function renderOverview() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <style>
      .overview-hero {
        display:grid;
        grid-template-columns:auto 1fr;
        gap:1rem;
        align-items:center;
        padding:1rem;
        margin-bottom:1rem;
        border-radius:var(--radius-medium);
        background:var(--surface);
        border:1px solid var(--border);
        box-shadow:var(--shadow);
      }

      .overview-hero-logo {
        width:120px;
        height:120px;
        object-fit:cover;
        border-radius:50%;
        box-shadow:
          0 0 0 3px rgba(255,255,255,.04),
          0 0 30px rgba(0,220,255,.18);
      }

      .overview-hero h2 {
        margin:0;
        font-size:2rem;
      }

      .overview-hero p {
        margin:.45rem 0 0;
        opacity:.75;
      }

      @media (max-width:600px) {
        .overview-hero {
          grid-template-columns:auto 1fr;
          padding:.8rem;
        }

        .overview-hero-logo {
          width:82px;
          height:82px;
        }

        .overview-hero h2 {
          font-size:1.45rem;
        }
      }

      .overview-section-title {
        margin: 26px 0 12px;
        font-size: 1.05rem;
        font-weight: 700;
        opacity: .92;
      }

      .overview-metrics {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
      }

      .overview-metric {
        position: relative;
        overflow: hidden;
        padding: 18px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-medium);
        background: var(--surface);
        box-shadow: var(--shadow);
        min-width: 0;
      }

      .overview-metric-icon {
        font-size: 1.55rem;
        margin-bottom: 10px;
      }

      .overview-metric-value {
        display: block;
        font-size: clamp(1.65rem, 3vw, 2.25rem);
        font-weight: 800;
        line-height: 1;
      }

      .overview-metric-label {
        display: block;
        margin-top: 8px;
        font-size: .85rem;
        opacity: .72;
      }


      .overview-attention-card {
        margin-top: 16px;
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius-medium);
        background: var(--surface);
        box-shadow: var(--shadow);
      }

      .overview-attention-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }

      .overview-attention-head h3 {
        margin: 0;
      }

      .overview-attention-badge {
        padding: 6px 10px;
        border-radius: 999px;
        font-size: .78rem;
        font-weight: 700;
        background: rgba(255, 193, 7, .12);
        border: 1px solid rgba(255, 193, 7, .22);
      }

      .overview-attention-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .overview-attention-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.06);
      }

      .overview-attention-item strong {
        margin-left: auto;
        font-size: 1.05rem;
      }

      .overview-attention-ok {
        display: none;
        padding: 14px;
        border-radius: 12px;
        background: rgba(76, 175, 80, .10);
        border: 1px solid rgba(76, 175, 80, .20);
      }

      @media (max-width: 600px) {
        .overview-attention-list {
          grid-template-columns: 1fr;
        }
      }

      .overview-ai-card {
        margin-top: 16px;
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: var(--radius-medium);
        background:
          linear-gradient(
            135deg,
            rgba(66, 165, 245, .10),
            rgba(216, 82, 199, .08)
          ),
          var(--surface);
        box-shadow: var(--shadow);
      }

      .overview-ai-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .overview-ai-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .overview-ai-icon {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 1.5rem;
        background:
          linear-gradient(
            135deg,
            rgba(66, 165, 245, .30),
            rgba(216, 82, 199, .30)
          );
        border: 1px solid rgba(255,255,255,.12);
      }

      .overview-ai-card h3 {
        margin: 0;
      }

      .overview-ai-card p {
        margin: 5px 0 0;
        opacity: .72;
      }

      .overview-ai-state {
        padding: 6px 10px;
        border-radius: 999px;
        font-size: .78rem;
        font-weight: 700;
        white-space: nowrap;
        background: rgba(66, 165, 245, .16);
        border: 1px solid rgba(66, 165, 245, .25);
      }

      @media (max-width: 1100px) {
        .overview-metrics {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .overview-system-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .overview-system-card {
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: var(--radius-medium);
        background: var(--surface);
        box-shadow: var(--shadow);
        min-width: 0;
      }

      .overview-system-card h3 {
        margin: 0 0 14px;
        font-size: 1rem;
      }

      .overview-status-list {
        display: grid;
        gap: 9px;
      }

      .overview-status-row {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
      }

      .overview-status-label {
        opacity: .68;
        min-width: 0;
      }

      .overview-status-value {
        text-align: right;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .overview-system-card-wide {
        grid-column: span 2;
      }

      @media (max-width: 700px) {
        .overview-system-grid {
          grid-template-columns: 1fr;
        }

        .overview-system-card-wide {
          grid-column: auto;
        }
      }

      @media (max-width: 600px) {
        .overview-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .overview-metric {
          padding: 15px 13px;
        }

        .overview-ai-head {
          align-items: flex-start;
        }
      }
    </style>

    <section class="overview-hero">
      <img
        class="overview-hero-logo"
        src="${overviewLogoUrl}"
        alt="Dr. Ronny OS"
      >

      <div>
        <h2>Dr. Ronny OS</h2>
        <p>
          ${t("overview.systemSummary")}
        </p>
      </div>
    </section>

    <div class="overview-section-title">
      ${t("overview.smartHome")}
    </div>

    <section class="overview-metrics" id="overviewMetrics">
      <article class="overview-metric">
        <div class="overview-metric-icon">🔌</div>
        <strong class="overview-metric-value" data-metric="entities">–</strong>
        <span class="overview-metric-label">${t("overview.entitiesMetric")}</span>
      </article>

      <article class="overview-metric">
        <div class="overview-metric-icon">💡</div>
        <strong class="overview-metric-value" data-metric="devices">–</strong>
        <span class="overview-metric-label">${t("overview.devicesMetric")}</span>
      </article>

      <article class="overview-metric">
        <div class="overview-metric-icon">📍</div>
        <strong class="overview-metric-value" data-metric="areas">–</strong>
        <span class="overview-metric-label">${t("overview.areasMetric")}</span>
      </article>

      <article class="overview-metric">
        <div class="overview-metric-icon">🏷️</div>
        <strong class="overview-metric-value" data-metric="labels">–</strong>
        <span class="overview-metric-label">${t("overview.labelsMetric")}</span>
      </article>

      <article class="overview-metric">
        <div class="overview-metric-icon">⚡</div>
        <strong class="overview-metric-value" data-metric="automations">–</strong>
        <span class="overview-metric-label">${t("overview.automationsMetric")}</span>
      </article>

      <article class="overview-metric">
        <div class="overview-metric-icon">📜</div>
        <strong class="overview-metric-value" data-metric="scripts">–</strong>
        <span class="overview-metric-label">${t("overview.scriptsMetric")}</span>
      </article>
    </section>

    <article class="overview-attention-card">
      <div class="overview-attention-head">
        <h3>${t("overview.attentionRequired")}</h3>
        <span class="overview-attention-badge" id="overviewAttentionTotal">
          ${t("overview.checkingAttention")}
        </span>
      </div>

      <div class="overview-attention-list" id="overviewAttentionList">
        <div class="overview-attention-item">
          <span>🔴 ${t("overview.unavailableEntities")}</span>
          <strong data-attention="unavailable">–</strong>
        </div>

        <div class="overview-attention-item">
          <span>🟠 ${t("overview.entitiesWithoutArea")}</span>
          <strong data-attention="entitiesWithoutArea">–</strong>
        </div>

        <div class="overview-attention-item">
          <span>🟠 ${t("overview.devicesWithoutArea")}</span>
          <strong data-attention="devicesWithoutArea">–</strong>
        </div>

        <div class="overview-attention-item">
          <span>🔵 ${t("overview.disabledItems")}</span>
          <strong data-attention="disabled">–</strong>
        </div>
      </div>

      <div class="overview-attention-ok" id="overviewAttentionOk">
        ✅ ${t("overview.noIssuesDetected")}
      </div>
    </article>

    <article class="overview-ai-card">
      <div class="overview-ai-head">
        <div class="overview-ai-title">
          <div class="overview-ai-icon">🧠</div>

          <div>
            <h3>Ronny AI</h3>
            <p>
              ${t("overview.ronnyAiDescription")}
            </p>
          </div>
        </div>

        <span class="overview-ai-state">
          ${t("overview.preparing")}
        </span>
      </div>
    </article>

    <div class="overview-section-title">
      ${t("overview.systemStatus")}
    </div>

    <section class="card-grid overview-system-grid">
      <article class="card">
        <h3>⏳ ${t("overview.checkingPhoenix")}</h3>
        <p>${t("overview.systemStatusLoading")}</p>
      </article>

      <article class="card">
        <h3>⏳ ${t("overview.checkingHomeAssistant")}</h3>
        <p>${t("overview.connectionLoading")}</p>
      </article>
    </section>
  `;

  const grid = content.querySelector(".card-grid");

  const [
    phoenixResult,
    haResult,
    entitiesResult,
    statesResult,
    devicesResult,
    areasResult,
    labelsResult,
    automationsResult,
    scriptsResult
  ] = await Promise.allSettled([
    loadPhoenixStatus(),
    loadHomeAssistantStatus(),
    loadHomeAssistantEntityRegistry(),
    loadHomeAssistantEntities(),
    loadHomeAssistantDevices(),
    loadHomeAssistantAreas(),
    loadHomeAssistantLabels(),
    loadHomeAssistantAutomations(),
    loadHomeAssistantScripts()
  ]);

  const entities =
    entitiesResult.status === "fulfilled"
      ? asArray(entitiesResult.value, ["entities", "entity_registry"])
      : [];

  const states =
    statesResult.status === "fulfilled"
      ? asArray(statesResult.value, ["entities", "states"])
      : [];

  const devices =
    devicesResult.status === "fulfilled"
      ? asArray(devicesResult.value, ["devices"])
      : [];

  const areas =
    areasResult.status === "fulfilled"
      ? asArray(areasResult.value, ["areas"])
      : [];

  const labels =
    labelsResult.status === "fulfilled"
      ? asArray(labelsResult.value, ["labels"])
      : [];

  const automations =
    automationsResult.status === "fulfilled"
      ? asArray(automationsResult.value, ["automations"])
      : [];

  const scripts =
    scriptsResult.status === "fulfilled"
      ? asArray(scriptsResult.value, ["scripts"])
      : [];

  const metrics = {
    entities: entities.length,
    devices: devices.length,
    areas: areas.length,
    labels: labels.length,
    automations: automations.length,
    scripts: scripts.length
  };

  for (const [name, value] of Object.entries(metrics)) {
    const element =
      content.querySelector(`[data-metric="${name}"]`);

    if (element) {
      element.textContent = String(value);
    }
  }

  const deviceById =
    new Map(
      devices
        .filter(device => device?.id)
        .map(device => [device.id, device])
    );

  const unavailable =
    states.filter(
      entity =>
        entity?.state === "unavailable"
    ).length;

  const disabledEntities =
    entities.filter(
      entity => Boolean(entity?.disabled_by)
    ).length;

  const disabledDevices =
    devices.filter(
      device => Boolean(device?.disabled_by)
    ).length;

  const entitiesWithoutArea =
    entities.filter(entity => {
      if (entity?.disabled_by) {
        return false;
      }

      if (entity?.area_id) {
        return false;
      }

      const device =
        entity?.device_id
          ? deviceById.get(entity.device_id)
          : null;

      return !device?.area_id;
    }).length;

  const devicesWithoutArea =
    devices.filter(
      device =>
        !device?.disabled_by &&
        !device?.area_id
    ).length;

  const attention = {
    unavailable,
    entitiesWithoutArea,
    devicesWithoutArea,
    disabled:
      disabledEntities +
      disabledDevices
  };

  let attentionTotal = 0;

  for (const [name, value] of Object.entries(attention)) {
    attentionTotal += value;

    const element =
      content.querySelector(
        `[data-attention="${name}"]`
      );

    if (element) {
      element.textContent = String(value);
    }
  }

  const attentionBadge =
    content.querySelector("#overviewAttentionTotal");

  const attentionList =
    content.querySelector("#overviewAttentionList");

  const attentionOk =
    content.querySelector("#overviewAttentionOk");

  if (attentionBadge) {
    attentionBadge.textContent =
      attentionTotal === 0
        ? t("overview.allClean")
        : t("overview.attentionCount")
            .replace(
              "{count}",
              String(attentionTotal)
            );
  }

  if (attentionTotal === 0) {
    if (attentionList) {
      attentionList.style.display = "none";
    }

    if (attentionOk) {
      attentionOk.style.display = "block";
    }
  }

  let systemCards = `
    <article class="overview-system-card">
      <h3>❌ ${t("overview.connectionSection")}</h3>
      <p>${t("overview.haStatusUnavailable")}</p>
    </article>

    <article class="overview-system-card">
      <h3>❌ Home Assistant</h3>
      <p>${t("overview.haStatusUnavailable")}</p>
    </article>
  `;

  if (haResult.status === "fulfilled") {
    const data = haResult.value;
    const ha = data.home_assistant || {};
    const system = data.system || {};
    const core = system.core || {};
    const supervisor = system.supervisor || {};
    const os = system.os || {};
    const network = system.network || {};

    const connected = data.connected === true;

    const formatBool = value => {
      if (value === true) {
        return t("overview.yes");
      }

      if (value === false) {
        return t("overview.no");
      }

      return "–";
    };

    const formatOnline = value => {
      if (value === true) {
        return `✅ ${t("overview.online")}`;
      }

      if (value === false) {
        return `❌ ${t("overview.offline")}`;
      }

      return "–";
    };

    const formatUpdate = value => {
      if (value === true) {
        return `⚠️ ${t("homeAssistant.updateAvailable")}`;
      }

      if (value === false) {
        return `✅ ${t("overview.noUpdateAvailable")}`;
      }

      return "–";
    };

    let checkedAt = "–";

    if (data.checked_at) {
      try {
        checkedAt = new Date(
          data.checked_at
        ).toLocaleString();
      } catch {
        checkedAt = data.checked_at;
      }
    }

    const responseTime =
      data.response_time_ms !== null &&
      data.response_time_ms !== undefined
        ? `${escapeHtml(data.response_time_ms)} ms`
        : "–";

    systemCards = `
      <article class="overview-system-card">
        <h3>🔗 ${t("overview.connectionSection")}</h3>

        <div class="overview-status-list">
          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("homeAssistant.status")}
            </span>
            <span class="overview-status-value">
              ${formatOnline(connected)}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.responseTime")}
            </span>
            <span class="overview-status-value">
              ${responseTime}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.lastCheck")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(checkedAt)}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.hostInternet")}
            </span>
            <span class="overview-status-value">
              ${formatOnline(network.host_internet)}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.supervisorInternet")}
            </span>
            <span class="overview-status-value">
              ${formatOnline(network.supervisor_internet)}
            </span>
          </div>
        </div>
      </article>

      <article class="overview-system-card">
        <h3>🏠 Home Assistant</h3>

        <div class="overview-status-list">
          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.version")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(ha.version || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("homeAssistant.location")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(ha.location_name || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("homeAssistant.timezone")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(ha.time_zone || supervisor.timezone || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.updateStatus")}
            </span>
            <span class="overview-status-value">
              ${formatUpdate(core.update_available)}
            </span>
          </div>
        </div>
      </article>

      <article class="overview-system-card">
        <h3>🌐 ${t("overview.networkSection")}</h3>

        <div class="overview-status-list">
          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.ipAddress")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(network.ip_address || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.networkInterface")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(network.interface || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.internetAccess")}
            </span>
            <span class="overview-status-value">
              ${formatOnline(network.connected)}
            </span>
          </div>
        </div>
      </article>

      <article class="overview-system-card">
        <h3>⚙️ ${t("overview.systemSection")}</h3>

        <div class="overview-status-list">
          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.homeAssistantOs")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(os.version || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.supervisor")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(supervisor.version || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.architecture")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(
                core.architecture ||
                supervisor.architecture ||
                "–"
              )}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.channel")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(supervisor.channel || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.healthy")}
            </span>
            <span class="overview-status-value">
              ${formatBool(supervisor.healthy)}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.supported")}
            </span>
            <span class="overview-status-value">
              ${formatBool(supervisor.supported)}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.bootSlot")}
            </span>
            <span class="overview-status-value">
              ${escapeHtml(os.boot || "–")}
            </span>
          </div>

          <div class="overview-status-row">
            <span class="overview-status-label">
              ${t("overview.updateStatus")}
            </span>
            <span class="overview-status-value">
              ${formatUpdate(os.update_available)}
            </span>
          </div>
        </div>
      </article>
    `;

    if (phoenixResult.status === "fulfilled") {
      const phoenixData = phoenixResult.value;
      const phoenix = phoenixData.phoenix || {};
      const doctor = phoenixData.doctor || {};

      const healthy =
        phoenixData.status === "ok" &&
        doctor.ok === true;

      systemCards += `
        <article class="overview-system-card overview-system-card-wide">
          <h3>
            ${healthy ? "✅" : "⚠️"} ${t("overview.phoenixSection")}
          </h3>

          <div class="overview-status-list">
            <div class="overview-status-row">
              <span class="overview-status-label">
                ${t("overview.version")}
              </span>
              <span class="overview-status-value">
                ${escapeHtml(phoenix.version || "–")}
              </span>
            </div>

            <div class="overview-status-row">
              <span class="overview-status-label">
                ${t("overview.channel")}
              </span>
              <span class="overview-status-value">
                ${escapeHtml(phoenix.stage || "–")}
              </span>
            </div>

            <div class="overview-status-row">
              <span class="overview-status-label">
                ${t("overview.doctor")}
              </span>
              <span class="overview-status-value">
                ${
                  doctor.ok === true
                    ? "✅ OK"
                    : `⚠️ ${t("overview.error")}`
                }
              </span>
            </div>
          </div>
        </article>
      `;
    }
  }

  grid.innerHTML = systemCards;
}
