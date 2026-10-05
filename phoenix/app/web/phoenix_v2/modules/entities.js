import {
  t
} from "../core/i18n.js?v=20260928-1050";

import {
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantAreas,
  loadHomeAssistantLabels,
  loadHomeAssistantEntities,
  loadHomeAssistantDevices,
  loadHomeAssistantAutomations,
  loadHomeAssistantScripts,
  loadAutomationConfig,
  loadScriptConfig,
  setEntityName,
  setEntityArea,
  setEntityLabels
} from "../core/api.js?v=20260928-1050";

let entitiesData = [];
let areasData = [];
let labelsData = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEntities(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.entities || [];
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


function getEntityLabelIds(entity) {
  return Array.isArray(entity?.labels) ? entity.labels : [];
}

function getEntityLabelNames(entity) {
  const ids = new Set(getEntityLabelIds(entity));

  return labelsData
    .filter((label) => ids.has(label.label_id))
    .map((label) => label.name || label.label_id);
}

export async function renderEntities() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>📱 ${escapeHtml(t("navigation.entities"))}</h2>
      <p id="entitiesStatus">${escapeHtml(t("common.loading"))}</p>
    </section>
  `;

  try {
    const [entityResponse, areaResponse, labelResponse] = await Promise.all([
      loadHomeAssistantEntityRegistry(),
      loadHomeAssistantAreas(),
    loadHomeAssistantLabels()
    ]);

    entitiesData = normalizeEntities(entityResponse);
    areasData = normalizeAreas(areaResponse);
    labelsData = normalizeLabels(labelResponse);

    const status = content.querySelector("#entitiesStatus");

    if (status) {
      status.textContent = `${entitiesData.length} ${t("navigation.entities")}`;
    }

    const areaNames = new Map(
      areasData.map((area) => [area.area_id, area.name])
    );

  const style = document.createElement("style");
  style.textContent = `
    #entitiesList {
      display:grid;
      gap:.65rem;
    }

    #entitiesList .phoenix-entity-card {
      margin:0;
      padding:.8rem 1rem;
    }

    #entitiesList .phoenix-entity-card h3 {
      margin:0 0 .5rem;
      font-size:1.1rem;
    }

    #entitiesList .phoenix-entity-card p {
      margin:.25rem 0;
      line-height:1.3;
    }

    #entitiesList .entity-actions {
      display:flex;
      gap:.5rem;
      flex-wrap:wrap;
      margin-top:.55rem;
    }

    #entitiesList .entity-actions button {
      margin-top:0;
      min-height:42px;
    }

    .entity-details-overlay {
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

    .entity-details-dialog {
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

    .entity-details-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:1rem;
      margin-bottom:1rem;
    }

    .entity-details-header h3 {
      margin:0;
    }

    .entity-details-grid {
      display:grid;
      grid-template-columns:minmax(140px,auto) 1fr;
      gap:.55rem 1rem;
      margin-bottom:1rem;
    }

    .entity-details-grid strong {
      overflow-wrap:anywhere;
    }

    .entity-details-usage {
      display:grid;
      gap:.55rem;
    }

    .entity-details-usage-item {
      padding:.7rem;
      border:1px solid rgba(127,127,127,.35);
      border-radius:.65rem;
    }

    .entity-details-close {
      min-height:42px;
      padding:.55rem .9rem;
    }

    @media (max-width:600px) {
      .entity-actions {
        display:grid !important;
        grid-template-columns:1fr 1fr;
      }

      .entity-actions button {
        width:100%;
      }

      .entity-details-overlay {
        padding:0;
        align-items:stretch;
      }

      .entity-details-dialog {
        width:100%;
        max-height:none;
        height:100%;
        border-radius:0;
        padding:1rem;
      }

      .entity-details-grid {
        grid-template-columns:1fr;
        gap:.2rem;
      }

      .entity-details-grid strong {
        margin-bottom:.55rem;
      }

      .entity-details-close {
        min-width:48px;
      }
    }
  `;
  content.appendChild(style);
    const list = document.createElement("section");
  const filters = document.createElement("div");
  const search = document.createElement("input"); search.type = "search"; search.placeholder = t("areas.searchEntities");
  const areaFilter = document.createElement("select");
  const labelFilter = document.createElement("select");
  areaFilter.innerHTML = `<option value="">${t("areas.allAreas")}</option>` + areasData.map((area) => `<option value="${escapeHtml(area.area_id)}">${escapeHtml(area.name || area.area_id)}</option>`).join("");
  labelFilter.innerHTML = `<option value="">${t("areas.allLabels")}</option>` + labelsData.map((label) => `<option value="${escapeHtml(label.label_id)}">${escapeHtml(label.name || label.label_id)}</option>`).join("");
  const entityMap = new Map(entitiesData.map((entity) => [entity.entity_id, entity]));
  const searchableText = new Map(entitiesData.map((entity) => [entity.entity_id, `${entity.entity_id || ""} ${entity.name || ""} ${entity.original_name || ""} ${entity.platform || ""}`.toLowerCase()]));
  const applyFilters = () => {
    const q = search.value.trim().toLowerCase();
    const area = areaFilter.value;
    const label = labelFilter.value;
    let visible = 0;
    list.querySelectorAll("[data-entity-id]").forEach((card) => {
      const id = card.dataset.entityId;
      const entity = entityMap.get(id);
      const match = (!q || searchableText.get(id)?.includes(q)) && (!area || entity?.area_id === area) && (!label || getEntityLabelIds(entity).includes(label));
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    if (status) status.textContent = `${visible} ${t("areas.of")} ${entitiesData.length} ${t("navigation.entities")}`;
  };
  let searchTimer;
  search.style.cssText = "width:100%;padding:.7rem;border-radius:.55rem;margin:0";
  areaFilter.style.cssText = search.style.cssText;
  labelFilter.style.cssText = search.style.cssText;
  search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
  });
  areaFilter.addEventListener("change", applyFilters);
  labelFilter.addEventListener("change", applyFilters);
  filters.style.cssText = "display:grid;grid-template-columns:2fr 1fr 1fr;gap:.6rem;margin:.75rem 0";
  filters.append(search, areaFilter, labelFilter);
    list.id = "entitiesList";
  list.style.maxHeight = "65vh";
  list.style.overflowY = "auto";
  list.style.overflowX = "hidden";
  list.style.scrollbarGutter = "stable";

    if (entitiesData.length === 0) {
      list.innerHTML = `<p>${escapeHtml(t("areas.noEntities"))}</p>`;
    } else {
      list.innerHTML = entitiesData.map((entity) => {
        const areaName = entity.area_id
          ? (areaNames.get(entity.area_id) || t("areas.noArea"))
          : t("areas.noArea");

        const labelNames = getEntityLabelNames(entity);

        return `
          <article class="card phoenix-entity-card" data-entity-id="${escapeHtml(entity.entity_id)}">
            <h3>${escapeHtml(entity.name || entity.original_name || entity.entity_id)}</h3>

            <p>${escapeHtml(t("areas.entityId"))}: <strong>${escapeHtml(entity.entity_id)}</strong></p>
            <p>${escapeHtml(t("areas.platform"))}: ${escapeHtml(entity.platform || "-")} · ${escapeHtml(t("areas.category"))}: ${escapeHtml(entity.entity_category || "-")}</p>

            <p>
              ${escapeHtml(t("areas.title"))}:
              <strong>${escapeHtml(areaName)}</strong>
            </p>

            <p>
              ${escapeHtml(t("navigation.labels"))}:
              <strong>${escapeHtml(labelNames.length ? labelNames.join(", ") : "-")}</strong>
            </p>

            <div class="entity-actions">
              <button
                type="button"
                data-entity-action="details"
                data-entity-id="${escapeHtml(entity.entity_id)}"
              >
                ℹ️ ${escapeHtml(t("areas.details"))}
              </button>

              <button
                type="button"
                data-entity-action="name"
                data-entity-id="${escapeHtml(entity.entity_id)}"
              >
                ${escapeHtml(t("areas.changeName"))}
              </button>

              <button
                type="button"
                data-entity-action="area"
                data-entity-id="${escapeHtml(entity.entity_id)}"
              >
                ${escapeHtml(t("areas.changeArea"))}
              </button>

              <button
                type="button"
                data-entity-action="labels"
                data-entity-id="${escapeHtml(entity.entity_id)}"
              >
                ${escapeHtml(t("areas.changeLabels"))}
              </button>
            </div>
          </article>
        `;
      }).join("");
    }


    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-entity-action]");
      if (!button) {
        return;
      }

      const entityId = button.dataset.entityId;
      const action = button.dataset.entityAction;
      const entity = entitiesData.find((item) => item.entity_id === entityId);

      if (!entity) {
        return;
      }

      try {
        if (action === "details") {
          const overlay = document.createElement("div");
          overlay.className = "entity-details-overlay";

          const dialog = document.createElement("section");
          dialog.className = "entity-details-dialog";

          const displayName =
            entity.name ||
            entity.original_name ||
            entity.entity_id;

          dialog.innerHTML = `
            <div class="entity-details-header">
              <div>
                <h3>${escapeHtml(displayName)}</h3>
                <small>${escapeHtml(entity.entity_id)}</small>
              </div>

              <button
                type="button"
                class="entity-details-close"
                aria-label="${escapeHtml(t("areas.cancelChange"))}"
              >
                ✕
              </button>
            </div>

            <div class="entity-details-grid">
              <span>${escapeHtml(t("areas.entityId"))}</span>
              <strong>${escapeHtml(entity.entity_id)}</strong>

              <span>${escapeHtml(t("areas.originalName"))}</span>
              <strong>${escapeHtml(entity.original_name || "-")}</strong>

              <span>${escapeHtml(t("areas.integration"))}</span>
              <strong>${escapeHtml(entity.platform || "-")}</strong>

              <span>${escapeHtml(t("areas.changeArea").replace(" ändern", ""))}</span>
              <strong>
                ${escapeHtml(
                  areaNames.get(entity.area_id) ||
                  entity.area_id ||
                  "-"
                )}
              </strong>

              <span>${escapeHtml(t("navigation.labels"))}</span>
              <strong>
                ${escapeHtml(
                  getEntityLabelNames(entity).join(", ") || "-"
                )}
              </strong>

              <span>${escapeHtml(t("areas.device"))}</span>
              <strong data-details-device>…</strong>

              <span>${escapeHtml(t("automations.state"))}</span>
              <strong data-details-state>…</strong>
            </div>

            <h4>${escapeHtml(t("areas.usedIn"))}</h4>

            <div
              class="entity-details-usage"
              data-details-usage
            >
              …
            </div>
          `;

          overlay.appendChild(dialog);
          document.body.appendChild(overlay);

          const closeDetails = () => {
            overlay.remove();
          };

          dialog
            .querySelector(".entity-details-close")
            ?.addEventListener(
              "click",
              closeDetails
            );

          overlay.addEventListener("click", (clickEvent) => {
            if (clickEvent.target === overlay) {
              closeDetails();
            }
          });

          try {
            const [
              stateResponse,
              deviceResponse,
              automationResponse,
              scriptResponse
            ] = await Promise.all([
              loadHomeAssistantEntities(),
              loadHomeAssistantDevices(),
              loadHomeAssistantAutomations(),
              loadHomeAssistantScripts()
            ]);

            const states =
              Array.isArray(stateResponse?.entities)
                ? stateResponse.entities
                : [];

            const devices =
              Array.isArray(deviceResponse?.devices)
                ? deviceResponse.devices
                : [];

            const automations =
              Array.isArray(automationResponse?.automations)
                ? automationResponse.automations
                : [];

            const scripts =
              Array.isArray(scriptResponse?.scripts)
                ? scriptResponse.scripts
                : [];

            const stateEntity =
              states.find(
                (item) =>
                  item.entity_id === entity.entity_id
              );

            const device =
              devices.find(
                (item) =>
                  item.id === entity.device_id
              );

            const stateTarget =
              dialog.querySelector(
                "[data-details-state]"
              );

            const deviceTarget =
              dialog.querySelector(
                "[data-details-device]"
              );

            if (stateTarget) {
              stateTarget.textContent =
                stateEntity?.state || "-";
            }

            if (deviceTarget) {
              deviceTarget.textContent =
                device?.name ||
                device?.name_by_user ||
                entity.device_id ||
                "-";
            }

            const containsEntityId = (value) => {
              if (value === null || value === undefined) {
                return false;
              }

              if (typeof value === "string") {
                return value.includes(entity.entity_id);
              }

              if (Array.isArray(value)) {
                return value.some(containsEntityId);
              }

              if (typeof value === "object") {
                return Object.values(value).some(
                  containsEntityId
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
                      containsEntityId(response.config)
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
                      containsEntityId(response.config)
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
                "[data-details-usage]"
              );

            if (usageTarget) {
              if (!usages.length) {
                usageTarget.textContent =
                  t("areas.noUsages");
              } else {
                usageTarget.innerHTML =
                  usages
                    .map((usage) => `
                      <div class="entity-details-usage-item">
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
                "[data-details-usage]"
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
            entity.name ||
            entity.original_name ||
            "";

          const box = document.createElement("div");
          box.style.cssText =
            "margin-top:.75rem;display:grid;gap:.6rem";

          const input = document.createElement("input");
          input.type = "text";
          input.value = currentName;
          input.placeholder = entity.entity_id;
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

            const result = await setEntityName(
              entity.entity_id,
              newName || null
            );

            if (result?.status !== "ok") {
              window.alert(
                result?.error ||
                "Name konnte nicht geändert werden"
              );
              return;
            }

            await renderEntities();
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
        picker.innerHTML = `<option value="">${t("areas.noArea")}</option>` + areasData.map((area) => `<option value="${escapeHtml(area.area_id)}" ${entity.area_id === area.area_id ? "selected" : ""}>${escapeHtml(area.name || area.area_id)}</option>`).join("");
        button.parentElement.appendChild(picker);
        picker.addEventListener("change", async () => {
          await setEntityArea(entity.entity_id, picker.value || null);
          await renderEntities();
        });
        return;
      }
      if (action === "labels") {
        const box = document.createElement("div");
        box.style.cssText = "margin-top:.75rem;padding:.75rem;border:1px solid #666;border-radius:.6rem;max-height:260px;overflow-y:auto";
        const current = new Set(getEntityLabelIds(entity));
        box.innerHTML = labelsData.map((label) => `<label style="display:flex;align-items:center;gap:.7rem;padding:.55rem"><input type="checkbox" value="${escapeHtml(label.label_id)}" ${current.has(label.label_id) ? "checked" : ""}> <span>${escapeHtml(label.name || label.label_id)}</span></label>`).join("");
        button.parentElement.appendChild(box);
        const save = document.createElement("button");
        save.type = "button"; save.textContent = t("areas.save");
        save.addEventListener("click", async () => {
          const selected = [...box.querySelectorAll("input:checked")].map((input) => input.value);
          await setEntityLabels(entity.entity_id, selected); await renderEntities();
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
    const status = content.querySelector("#entitiesStatus");

    if (status) {
      status.textContent = error?.message || String(error);
    }
  }
}
