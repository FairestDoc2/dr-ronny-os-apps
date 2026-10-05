import {
  t
} from "../core/i18n.js?v=20260928-1050";

import {
  loadHomeAssistantDevices,
  loadHomeAssistantAreas,
  loadHomeAssistantLabels,
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantAutomations,
  loadHomeAssistantScripts,
  loadAutomationConfig,
  loadScriptConfig,
  setDeviceName,
  setDeviceArea,
  setDeviceLabels
} from "../core/api.js?v=20260928-1050";

let devicesData = [];
let areasData = [];
let labelsData = [];
let currentSearch = "";
let currentFilter = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeDevices(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.devices || [];
}

function normalizeAreas(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.areas || [];
}

function normalizeLabels(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.labels || [];
}


function getDeviceLabelIds(device) {
  return Array.isArray(device?.labels) ? device.labels : [];
}

function getDeviceLabelNames(device) {
  const ids = new Set(getDeviceLabelIds(device));

  return labelsData
    .filter((label) => ids.has(label.label_id))
    .map((label) => label.name || label.label_id);
}

export async function renderDevices() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>📱 ${escapeHtml(t("navigation.devices"))}</h2>
      <p id="devicesStatus">${escapeHtml(t("common.loading"))}</p>
    </section>
  `;

  try {
    const [deviceResponse, areaResponse, labelResponse] = await Promise.all([
      loadHomeAssistantDevices(),
      loadHomeAssistantAreas(),
    loadHomeAssistantLabels()
    ]);

    devicesData = normalizeDevices(deviceResponse);
    areasData = normalizeAreas(areaResponse);
    labelsData = normalizeLabels(labelResponse);

    const status = content.querySelector("#devicesStatus");

    if (status) {
      status.textContent = `${devicesData.length} ${t("navigation.devices")}`;
    }

    const areaNames = new Map(
      areasData.map((area) => [area.area_id, area.name])
    );

  const style = document.createElement("style");
  style.textContent = `
    #devicesList {
      display:grid;
      gap:.65rem;
    }

    #devicesList .phoenix-device-card {
      margin:0;
      padding:.8rem 1rem;
    }

    #devicesList .phoenix-device-card h3 {
      margin:0 0 .5rem;
      font-size:1.1rem;
    }

    #devicesList .phoenix-device-card p {
      margin:.25rem 0;
      line-height:1.3;
    }

    #devicesList .device-actions {
      display:flex;
      flex-wrap:wrap;
      gap:.5rem;
      margin-top:.55rem;
    }

    #devicesList .device-actions button {
      margin-top:0;
      min-height:42px;
    }

    .device-details-overlay {
      position:fixed;
      inset:0;
      z-index:10000;
      background:rgba(0,0,0,.58);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:1rem;
      box-sizing:border-box;
    }

    .device-details-dialog {
      width:min(760px,100%);
      max-height:90vh;
      overflow:auto;
      background:var(--card-background-color,#1f1f1f);
      color:var(--primary-text-color,#fff);
      border-radius:1rem;
      padding:1.1rem;
      box-sizing:border-box;
      box-shadow:0 20px 60px rgba(0,0,0,.35);
    }

    .device-details-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:1rem;
      margin-bottom:1rem;
    }

    .device-details-header h3 {
      margin:0;
    }

    .device-details-grid {
      display:grid;
      grid-template-columns:minmax(140px,auto) 1fr;
      gap:.55rem 1rem;
      margin-bottom:1rem;
    }

    .device-details-grid strong {
      overflow-wrap:anywhere;
    }

    .device-details-entities,
    .device-details-usage {
      display:grid;
      gap:.55rem;
      margin-bottom:1rem;
    }

    .device-details-item {
      padding:.7rem;
      border:1px solid rgba(127,127,127,.35);
      border-radius:.65rem;
      overflow-wrap:anywhere;
    }

    .device-details-close {
      min-height:42px;
      padding:.55rem .9rem;
    }

    @media (max-width:600px) {
      #devicesList .device-actions {
        display:grid;
        grid-template-columns:1fr 1fr;
      }

      #devicesList .device-actions button {
        width:100%;
      }

      .device-details-overlay {
        padding:0;
        align-items:stretch;
      }

      .device-details-dialog {
        width:100%;
        height:100%;
        max-height:none;
        border-radius:0;
        padding:1rem;
      }

      .device-details-grid {
        grid-template-columns:1fr;
        gap:.2rem;
      }

      .device-details-grid strong {
        margin-bottom:.55rem;
      }
    }
  `;
  content.appendChild(style);
    const list = document.createElement("section");
  const filters = document.createElement("div");
  const search = document.createElement("input"); search.type = "search"; search.placeholder = t("areas.searchDevices");
  const areaFilter = document.createElement("select");
  const labelFilter = document.createElement("select");
  areaFilter.innerHTML = `<option value="">${t("areas.allAreas")}</option>` + areasData.map((area) => `<option value="${escapeHtml(area.area_id)}">${escapeHtml(area.name || area.area_id)}</option>`).join("");
  labelFilter.innerHTML = `<option value="">${t("areas.allLabels")}</option>` + labelsData.map((label) => `<option value="${escapeHtml(label.label_id)}">${escapeHtml(label.name || label.label_id)}</option>`).join("");
  const applyFilters = () => {
    const q = search.value.trim().toLowerCase(); const area = areaFilter.value; const label = labelFilter.value;
    const cards = [...list.querySelectorAll("[data-device-id]")]; let visible = 0;
    cards.forEach((card) => { const d = devicesData.find((x) => x.id === card.dataset.deviceId); const text = `${d?.name || ""} ${d?.manufacturer || ""} ${d?.model || ""}`.toLowerCase(); const match = (!q || text.includes(q)) && (!area || d?.area_id === area) && (!label || getDeviceLabelIds(d).includes(label)); card.style.display = match ? "" : "none"; if (match) visible++; });
    if (status) status.textContent = `${visible} von ${devicesData.length} ${t("navigation.devices")}`;
  };
  [search, areaFilter, labelFilter].forEach((el) => { el.style.cssText = "width:100%;padding:.7rem;border-radius:.55rem;margin:0"; el.addEventListener(el === search ? "input" : "change", applyFilters); });
  filters.style.cssText = "display:grid;grid-template-columns:2fr 1fr 1fr;gap:.6rem;margin:.75rem 0";
  filters.append(search, areaFilter, labelFilter);
    list.id = "devicesList";
  list.style.maxHeight = "65vh";
  list.style.overflowY = "auto";
  list.style.overflowX = "hidden";
  list.style.scrollbarGutter = "stable";

    if (devicesData.length === 0) {
      list.innerHTML = `<p>${escapeHtml(t("areas.noDevices"))}</p>`;
    } else {
      list.innerHTML = devicesData.map((device) => {
        const areaName = device.area_id
          ? (areaNames.get(device.area_id) || t("areas.noArea"))
          : t("areas.noArea");

        const labelNames = getDeviceLabelNames(device);

        return `
          <article class="card phoenix-device-card" data-device-id="${escapeHtml(device.id)}">
            <h3>${escapeHtml(device.name || device.id)}</h3>

            <p>${escapeHtml(t("areas.manufacturer"))}: ${escapeHtml(device.manufacturer || "-")}</p>
            <p>${escapeHtml(t("areas.model"))}: ${escapeHtml(device.model || "-")}</p>

            <p>
              ${escapeHtml(t("areas.title"))}:
              <strong>${escapeHtml(areaName)}</strong>
            </p>

            <p>
              Labels:
              <strong>${escapeHtml(labelNames.length ? labelNames.join(", ") : "-")}</strong>
            </p>

            <div class="device-actions">
              <button
                type="button"
                data-device-action="details"
                data-device-id="${escapeHtml(device.id)}"
              >
                ℹ️ ${escapeHtml(t("areas.details"))}
              </button>

              <button
                type="button"
                data-device-action="name"
                data-device-id="${escapeHtml(device.id)}"
              >
                ${escapeHtml(t("areas.changeName"))}
              </button>

              <button
                type="button"
                data-device-action="area"
                data-device-id="${escapeHtml(device.id)}"
              >
                ${escapeHtml(t("areas.changeArea"))}
              </button>

              <button
                type="button"
                data-device-action="labels"
                data-device-id="${escapeHtml(device.id)}"
              >
                ${escapeHtml(t("areas.changeLabels"))}
              </button>
            </div>
          </article>
        `;
      }).join("");
    }


    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-device-action]");
      if (!button) {
        return;
      }

      const deviceId = button.dataset.deviceId;
      const action = button.dataset.deviceAction;
      const device = devicesData.find((item) => item.id === deviceId);

      if (!device) {
        return;
      }

      try {
        if (action === "details") {
          const overlay = document.createElement("div");
          overlay.className = "device-details-overlay";

          const dialog = document.createElement("section");
          dialog.className = "device-details-dialog";

          const areaName =
            areaNames.get(device.area_id) ||
            device.area_id ||
            "-";

          const labelNames =
            getDeviceLabelNames(device);

          dialog.innerHTML = `
            <div class="device-details-header">
              <div>
                <h3>${escapeHtml(device.name || device.id)}</h3>
                <small>${escapeHtml(device.id)}</small>
              </div>

              <button
                type="button"
                class="device-details-close"
                aria-label="${escapeHtml(t("areas.cancelChange"))}"
              >
                ✕
              </button>
            </div>

            <div class="device-details-grid">
              <span>${escapeHtml(t("areas.deviceId"))}</span>
              <strong>${escapeHtml(device.id)}</strong>

              <span>${escapeHtml(t("areas.manufacturer"))}</span>
              <strong>${escapeHtml(device.manufacturer || "-")}</strong>

              <span>${escapeHtml(t("areas.model"))}</span>
              <strong>${escapeHtml(device.model || "-")}</strong>

              <span>${escapeHtml(t("areas.title"))}</span>
              <strong>${escapeHtml(areaName)}</strong>

              <span>${escapeHtml(t("navigation.labels"))}</span>
              <strong>${escapeHtml(labelNames.join(", ") || "-")}</strong>
            </div>

            <h4>${escapeHtml(t("navigation.entities"))}</h4>
            <div
              class="device-details-entities"
              data-device-details-entities
            >
              …
            </div>

            <h4>${escapeHtml(t("areas.usedIn"))}</h4>
            <div
              class="device-details-usage"
              data-device-details-usage
            >
              …
            </div>
          `;

          overlay.appendChild(dialog);
          document.body.appendChild(overlay);

          const closeDetails = () => overlay.remove();

          dialog
            .querySelector(".device-details-close")
            ?.addEventListener("click", closeDetails);

          overlay.addEventListener("click", (clickEvent) => {
            if (clickEvent.target === overlay) {
              closeDetails();
            }
          });

          try {
            const [
              entityResponse,
              automationResponse,
              scriptResponse
            ] = await Promise.all([
              loadHomeAssistantEntityRegistry(),
              loadHomeAssistantAutomations(),
              loadHomeAssistantScripts()
            ]);

            const registryEntities =
              Array.isArray(entityResponse?.entities)
                ? entityResponse.entities
                : [];

            const automations =
              Array.isArray(automationResponse?.automations)
                ? automationResponse.automations
                : [];

            const scripts =
              Array.isArray(scriptResponse?.scripts)
                ? scriptResponse.scripts
                : [];

            const deviceEntities =
              registryEntities.filter(
                (entity) =>
                  entity.device_id === device.id
              );

            const entityTarget =
              dialog.querySelector(
                "[data-device-details-entities]"
              );

            if (entityTarget) {
              if (!deviceEntities.length) {
                entityTarget.textContent = "-";
              } else {
                entityTarget.innerHTML =
                  deviceEntities
                    .map((entity) => `
                      <div class="device-details-item">
                        <strong>
                          ${escapeHtml(
                            entity.name ||
                            entity.original_name ||
                            entity.entity_id
                          )}
                        </strong>
                        <div>
                          ${escapeHtml(entity.entity_id)}
                        </div>
                      </div>
                    `)
                    .join("");
              }
            }

            const entityIds =
              new Set(
                deviceEntities
                  .map((entity) => entity.entity_id)
                  .filter(Boolean)
              );

            const containsReference = (value) => {
              if (
                value === null ||
                value === undefined
              ) {
                return false;
              }

              if (typeof value === "string") {
                if (value.includes(device.id)) {
                  return true;
                }

                for (const entityId of entityIds) {
                  if (value.includes(entityId)) {
                    return true;
                  }
                }

                return false;
              }

              if (Array.isArray(value)) {
                return value.some(containsReference);
              }

              if (typeof value === "object") {
                return Object.values(value).some(
                  containsReference
                );
              }

              return false;
            };

            const usages = [];

            const automationResults =
              await Promise.all(
                automations.map(async (automation) => {
                  if (!automation?.id) {
                    return null;
                  }

                  try {
                    const response =
                      await loadAutomationConfig(
                        automation.id
                      );

                    if (
                      response?.status === "ok" &&
                      containsReference(response.config)
                    ) {
                      return {
                        type: t("navigation.automations"),
                        name:
                          automation.name ||
                          automation.entity_id ||
                          automation.id,
                        id:
                          automation.entity_id ||
                          automation.id
                      };
                    }
                  } catch (_) {
                    return null;
                  }

                  return null;
                })
              );

            usages.push(
              ...automationResults.filter(Boolean)
            );

            const scriptResults =
              await Promise.all(
                scripts.map(async (script) => {
                  const scriptId =
                    String(
                      script.entity_id || ""
                    ).replace(/^script\./, "");

                  if (!scriptId) {
                    return null;
                  }

                  try {
                    const response =
                      await loadScriptConfig(scriptId);

                    if (
                      response?.status === "ok" &&
                      containsReference(response.config)
                    ) {
                      return {
                        type: t("navigation.scripts"),
                        name:
                          script.name ||
                          script.entity_id ||
                          scriptId,
                        id:
                          script.entity_id ||
                          scriptId
                      };
                    }
                  } catch (_) {
                    return null;
                  }

                  return null;
                })
              );

            usages.push(
              ...scriptResults.filter(Boolean)
            );

            const usageTarget =
              dialog.querySelector(
                "[data-device-details-usage]"
              );

            if (usageTarget) {
              if (!usages.length) {
                usageTarget.textContent =
                  t("areas.noUsages");
              } else {
                usageTarget.innerHTML =
                  usages
                    .map((usage) => `
                      <div class="device-details-item">
                        <strong>
                          ${escapeHtml(usage.type)}
                        </strong>
                        <div>
                          ${escapeHtml(usage.name)}
                        </div>
                        <small>
                          ${escapeHtml(usage.id)}
                        </small>
                      </div>
                    `)
                    .join("");
              }
            }
          } catch (detailsError) {
            const usageTarget =
              dialog.querySelector(
                "[data-device-details-usage]"
              );

            if (usageTarget) {
              usageTarget.textContent =
                detailsError?.message ||
                String(detailsError);
            }
          }

          return;
        }

        if (action === "name") {
          const currentName =
            device.name_by_user ||
            device.name ||
            "";

          const box = document.createElement("div");
          box.style.cssText =
            "margin-top:.75rem;display:grid;gap:.6rem";

          const input = document.createElement("input");
          input.type = "text";
          input.value = currentName;
          input.placeholder = device.id;
          input.style.cssText =
            "width:100%;padding:.75rem;border-radius:.55rem;box-sizing:border-box";

          const actions = document.createElement("div");
          actions.style.cssText =
            "display:flex;gap:.6rem;flex-wrap:wrap";

          const save = document.createElement("button");
          save.type = "button";
          save.textContent = t("areas.save");

          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.textContent = t("areas.cancelChange");

          cancel.addEventListener("click", () => {
            box.remove();
          });

          save.addEventListener("click", async () => {
            const newName = input.value.trim();

            const result = await setDeviceName(
              device.id,
              newName || null
            );

            if (result?.status !== "ok") {
              window.alert(
                result?.error ||
                "Gerätename konnte nicht geändert werden"
              );
              return;
            }

            await renderDevices();
          });

          actions.appendChild(save);
          actions.appendChild(cancel);

          box.appendChild(input);
          box.appendChild(actions);

          button.parentElement.appendChild(box);

          input.focus();
          input.select();

          return;
        }

        if (action === "area") {
        const picker = document.createElement("select");
        picker.style.width = "100%";
        picker.style.marginTop = "0.75rem";
        picker.style.padding = "0.75rem";
        picker.innerHTML = `<option value="">${t("areas.noArea")}</option>` + areasData.map((area) => `<option value="${escapeHtml(area.area_id)}" ${device.area_id === area.area_id ? "selected" : ""}>${escapeHtml(area.name || area.area_id)}</option>`).join("");
        button.parentElement.appendChild(picker);
        picker.addEventListener("change", async () => {
          await setDeviceArea(device.id, picker.value || null);
          await renderDevices();
        });
        return;
      }
      if (action === "labels") {
        const box = document.createElement("div");
        box.style.cssText = "margin-top:.75rem;padding:.75rem;border:1px solid #666;border-radius:.6rem;max-height:260px;overflow-y:auto";
        const current = new Set(getDeviceLabelIds(device));
        box.innerHTML = labelsData.map((label) => `<label style="display:flex;align-items:center;gap:.7rem;padding:.55rem"><input type="checkbox" value="${escapeHtml(label.label_id)}" ${current.has(label.label_id) ? "checked" : ""}> <span>${escapeHtml(label.name || label.label_id)}</span></label>`).join("");
        button.parentElement.appendChild(box);
        const save = document.createElement("button");
        save.type = "button"; save.textContent = t("areas.save");
        save.addEventListener("click", async () => {
          const selected = [...box.querySelectorAll("input:checked")].map((input) => input.value);
          await setDeviceLabels(device.id, selected); await renderDevices();
        });
        box.appendChild(save); return;
      }
      } catch (error) {
        window.alert(error?.message || String(error));
      }
    });

  content.appendChild(filters);
    content.appendChild(list);
  } catch (error) {
    const status = content.querySelector("#devicesStatus");

    if (status) {
      status.textContent = error?.message || String(error);
    }
  }
}
