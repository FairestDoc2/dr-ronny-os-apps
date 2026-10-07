import {
  setDeviceArea,
  setEntityArea,
  setAreaLabels,
  loadHomeAssistantLabels,
  createArea,
  renameArea,
  deleteArea
} from "../core/api.js?v=20260928-1050";

import {
  t
} from "../core/i18n.js?v=20260928-1050";

import {
  phoenixConfirm,
  phoenixPrompt
} from "../core/dialog.js?v=20261007-0834";

async function loadAssignments() {
  const paths = [
    "../api/phoenix/home-assistant/assignments",
    "api/phoenix/home-assistant/assignments",
    "/api/phoenix/home-assistant/assignments"
  ];

  let lastError = null;

  for (const path of paths) {
    try {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (data.status !== "ok") {
        throw new Error(
          data.error || t("areas.assignmentsUnavailable")
        );
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    t("areas.phoenixAssignmentsUnavailable")
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function renderAreaDetails(
  content,
  data,
  areaId,
  areaName
) {
  const devices = data.devices.filter(
    (item) => item.area_id === areaId
  );

  const entities = data.entities.filter(
    (item) => item.effective_area_id === areaId
  );

  let activeType = "devices";
  let searchTerm = "";
  let assignmentBusy = false;

  async function changeAreaAssignment(
    type,
    itemId,
    newAreaId,
    itemName
  ) {
    if (assignmentBusy) {
      return;
    }

    const targetArea = newAreaId
      ? data.areas.find(
          (area) => area.area_id === newAreaId
        )
      : null;

    const variables = {
      item: itemName,
      area: targetArea?.name || ""
    };

    let message;

    if (type === "device") {
      message = targetArea
        ? t("areas.confirmMove", variables)
        : t(
            "areas.confirmRemoveDevice",
            variables
          );
    } else {
      message = targetArea
        ? t(
            "areas.confirmAssignEntity",
            variables
          )
        : t(
            "areas.confirmRemoveEntity",
            variables
          );
    }

    if (!window.confirm(message)) {
      return;
    }

    assignmentBusy = true;

    try {
      const result =
        type === "device"
          ? await setDeviceArea(
              itemId,
              newAreaId
            )
          : await setEntityArea(
              itemId,
              newAreaId
            );

      if (
        result.status !== "ok" ||
        result.updated !== true
      ) {
        throw new Error(
          result.error ||
          t("areas.assignmentUnchanged")
        );
      }

      await renderAreas();
    } catch (error) {
      window.alert(
        error?.message ||
        t("areas.assignmentFailed")
      );
    } finally {
      assignmentBusy = false;
    }
  }

  function renderList() {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    const source =
      activeType === "devices"
        ? devices
        : entities;

    const filtered = source.filter((item) => {
      if (!normalizedSearch) {
        return true;
      }

      if (activeType === "devices") {
        return [
          item.name,
          item.device_id
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(normalizedSearch)
          );
      }

      return [
        item.entity_id,
        item.device_id,
        item.effective_area_name
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(normalizedSearch)
        );
    });

    const visible = filtered.slice(0, 100);

    const rows = visible.length
      ? visible.map((item) => {
          if (activeType === "devices") {
            const areaOptions = data.areas
              .map((area) => `
                <option
                  value="${escapeHtml(area.area_id)}"
                  ${
                    item.area_id === area.area_id
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(area.name)}
                </option>
              `)
              .join("");

            return `
              <div class="card">
                <strong>
                  ${escapeHtml(item.name)}
                </strong>

                <p class="label-meta">
                  ${escapeHtml(item.device_id)}
                </p>

                <div class="area-assignment-control">
                  <select
                    class="area-assignment-select"
                    data-assignment-type="device"
                    data-item-id="${escapeHtml(item.device_id)}"
                    data-item-name="${escapeHtml(item.name)}"
                  >
                    <option value="">
                      ${t("areas.unassigned")}
                    </option>
                    ${areaOptions}
                  </select>

                  <button
                    type="button"
                    class="area-assignment-save"
                    data-assignment-type="device"
                    data-item-id="${escapeHtml(item.device_id)}"
                  >
                    ${t("areas.save")}
                  </button>
                </div>
              </div>
            `;
          }

          let assignmentText =
            t("areas.unassigned");

          if (item.area_source === "entity") {
            assignmentText =
              t("areas.directEntityAssignment");
          } else if (
            item.area_source === "device"
          ) {
            assignmentText =
              t("areas.inheritedFromDevice");
          }

          return `
            <div class="card">
              <strong class="technical-value">
                ${escapeHtml(item.entity_id)}
              </strong>

              <p class="label-meta">
                ${escapeHtml(assignmentText)}
              </p>

              <div class="area-assignment-control">
                <select
                  class="area-assignment-select"
                  data-assignment-type="entity"
                  data-item-id="${escapeHtml(item.entity_id)}"
                  data-item-name="${escapeHtml(item.entity_id)}"
                >
                  <option
                    value=""
                    ${
                      !item.entity_area_id
                        ? "selected"
                        : ""
                    }
                  >
                    ${
                      item.device_area_id
                        ? t("areas.inheritDeviceArea")
                        : t("areas.noDirectAssignment")
                    }
                  </option>

                  ${data.areas
                    .map((area) => `
                      <option
                        value="${escapeHtml(area.area_id)}"
                        ${
                          item.entity_area_id === area.area_id
                            ? "selected"
                            : ""
                        }
                      >
                        ${escapeHtml(area.name)}
                      </option>
                    `)
                    .join("")}
                </select>

                <button
                  type="button"
                  class="area-assignment-save"
                  data-assignment-type="entity"
                  data-item-id="${escapeHtml(item.entity_id)}"
                >
                  ${t("areas.save")}
                </button>
              </div>

              ${
                item.device_id
                  ? `
                    <p class="label-meta">
                      ${t("areas.device")}:
                      <span class="technical-value">
                        ${escapeHtml(item.device_id)}
                      </span>
                    </p>
                  `
                  : ""
              }
            </div>
          `;
        }).join("")
      : `
          <div class="empty-card">
            ${t("areas.noResults")}
          </div>
        `;

    const list =
      document.getElementById(
        "areaDetailList"
      );

    const resultInfo =
      document.getElementById(
        "areaResultInfo"
      );

    if (list) {
      list.innerHTML = rows;
    }

    document
      .querySelectorAll(
        ".area-assignment-save"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const type =
              button.dataset.assignmentType;

            const itemId =
              button.dataset.itemId;

            const select =
              button.parentElement?.querySelector(
                ".area-assignment-select"
              );

            if (!type || !itemId || !select) {
              return;
            }

            const itemName =
              select.dataset.itemName ||
              itemId;

            const newAreaId =
              select.value || null;

            await changeAreaAssignment(
              type,
              itemId,
              newAreaId,
              itemName
            );
          }
        );
      });

    if (resultInfo) {
      if (filtered.length > 100) {
        resultInfo.textContent =
        filtered.length > 100
          ? t(
              "areas.resultsLimited",
              { count: filtered.length }
            )
          : t(
              "areas.results",
              { count: filtered.length }
            );
      }
    }
  }

  content.innerHTML = `
    <section class="page-header">
      <h2>
        🏠 ${escapeHtml(areaName)}
      </h2>

      <p>
        ${t("areas.areaContents")}
      </p>
    </section>

    <button
      class="filter-button"
      id="areasBackButton"
      type="button"
    >
      ← ${t("areas.allAreas")}
    </button>

    <div
      class="label-stats"
      style="margin-bottom: 16px;"
    >
      <div class="label-stat">
        <strong>${devices.length}</strong>
        <span>${t("areas.devices")}</span>
      </div>

      <div class="label-stat">
        <strong>${entities.length}</strong>
        <span>${t("areas.entities")}</span>
      </div>
    </div>

    <div
      style="
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      "
    >
      <button
        class="filter-button active"
        id="showAreaDevices"
        type="button"
      >
        ${t("areas.devices")} (${devices.length})
      </button>

      <button
        class="filter-button"
        id="showAreaEntities"
        type="button"
      >
        ${t("areas.entities")} (${entities.length})
      </button>
    </div>

    <input
      class="search-input"
      id="areaDetailSearch"
      type="search"
      placeholder=t("areas.searchDevices")
      autocomplete="off"
    >

    <p
      class="label-meta"
      id="areaResultInfo"
    ></p>

    <div
      class="card-grid"
      id="areaDetailList"
    ></div>
  `;

  const backButton =
    document.getElementById(
      "areasBackButton"
    );

  const deviceButton =
    document.getElementById(
      "showAreaDevices"
    );

  const entityButton =
    document.getElementById(
      "showAreaEntities"
    );

  const search =
    document.getElementById(
      "areaDetailSearch"
    );

  backButton?.addEventListener(
    "click",
    () => renderAreas()
  );

  deviceButton?.addEventListener(
    "click",
    () => {
      activeType = "devices";

      deviceButton.classList.add("active");
      entityButton.classList.remove("active");

      search.placeholder =
        t("areas.searchDevices");

      renderList();
    }
  );

  entityButton?.addEventListener(
    "click",
    () => {
      activeType = "entities";

      entityButton.classList.add("active");
      deviceButton.classList.remove("active");

      search.placeholder =
        t("areas.searchEntities");

      renderList();
    }
  );

  search?.addEventListener(
    "input",
    (event) => {
      searchTerm =
        event.target.value || "";

      renderList();
    }
  );

  renderList();
}

function renderAreaOverview(content, data) {
  const counts = data.counts || {};

  const cards = data.areas.map((area) => {
    const deviceCount = data.devices.filter(
      (item) => item.area_id === area.area_id
    ).length;

    const entityCount = data.entities.filter(
      (item) =>
        item.effective_area_id === area.area_id
    ).length;

    return `
      <div
        class="card label-card phoenix-area-card"
        data-area-id="${escapeHtml(area.area_id)}"
        data-area-name="${escapeHtml(area.name)}"
      >
        <div class="area-card-header">
          <h3>
            🏠 ${escapeHtml(area.name)}
          </h3>

          <div class="area-card-actions">
            <button type="button" class="area-labels-button" data-area-id="${escapeHtml(area.area_id)}" title="${escapeHtml(t("areas.changeLabels"))}">🏷️</button>
            <button
              type="button"
              class="area-rename-button"
              data-area-id="${escapeHtml(area.area_id)}"
              data-area-name="${escapeHtml(area.name)}"
              title="${escapeHtml(t("areas.rename"))}"
            >
              ✏️
            </button>

            <button
              type="button"
              class="area-delete-button"
              data-area-id="${escapeHtml(area.area_id)}"
              data-area-name="${escapeHtml(area.name)}"
              title="${escapeHtml(t("areas.delete"))}"
            >
              🗑️
            </button>
          </div>
        </div>

        <div class="label-stats">
          <div class="label-stat">
            <strong>${deviceCount}</strong>
            <span>${t("areas.devices")}</span>
          </div>

          <div class="label-stat">
            <strong>${entityCount}</strong>
            <span>${t("areas.entities")}</span>
          </div>
        </div>

        <div style="margin-top:.65rem;font-size:.9rem;opacity:.85">
          🏷️ ${escapeHtml((area.labels || []).map((id) => data.availableLabels.find((label) => label.label_id === id)?.name || id).join(", ") || "—")}
        </div>
      </div>
    `;
  }).join("");

  const unassignedDevices = data.devices.filter(
    (item) => !item.area_id
  ).length;

  const unassignedEntities = data.entities.filter(
    (item) => item.area_source === "none"
  ).length;

  content.innerHTML = `
    <section class="page-header">
      <h2>🗺️ ${t("areas.title")}</h2>
      <p>
        ${t("areas.subtitle")}
      </p>
    </section>

    <div class="card area-management-card">
      <div class="area-create-control">
        <input
          type="text"
          id="newAreaName"
          class="area-create-input"
          placeholder="${escapeHtml(t("areas.createPlaceholder"))}"
          autocomplete="off"
        >

        <button
          type="button"
          id="createAreaButton"
          class="area-create-button"
        >
          ＋ ${t("areas.create")}
        </button>
      </div>

      <div
        id="areaManagementMessage"
        class="area-management-message"
      ></div>
    </div>

    <div class="card-grid">
      <div
        class="card label-card phoenix-area-card"
        data-area-id=""
        data-area-name="${escapeHtml(t("areas.unassigned"))}"
      >
        <h3>📦 ${t("areas.unassigned")}</h3>

        <div class="label-stats">
          <div class="label-stat">
            <strong>${unassignedDevices}</strong>
            <span>${t("areas.devices")}</span>
          </div>

          <div class="label-stat">
            <strong>${unassignedEntities}</strong>
            <span>${t("areas.entities")}</span>
          </div>
        </div>
      </div>

      ${cards}
    </div>

    <section class="page-header">
      <p>
        ${counts.areas || 0} ${t("areas.title")} ·
        ${counts.devices || 0} ${t("areas.devices")} ·
        ${counts.entities || 0} ${t("areas.registryEntities")}
      </p>
    </section>
  `;

  const message =
    content.querySelector("#areaManagementMessage");

  const showMessage = (text, isError = false) => {
    if (!message) {
      return;
    }

    message.textContent = text;
    message.classList.toggle(
      "error",
      isError
    );
  };

  const refreshAreas = async () => {
    const freshData = await loadAssignments();
    renderAreaOverview(
      content,
      freshData
    );
  };

  const createButton =
    content.querySelector("#createAreaButton");

  const createInput =
    content.querySelector("#newAreaName");

  if (createButton && createInput) {
    createButton.addEventListener(
      "click",
      async () => {
        const name = createInput.value.trim();

        if (!name) {
          showMessage(
            t("areas.enterName"),
            true
          );
          return;
        }

        createButton.disabled = true;

        try {
          const result = await createArea(name);

          if (result.status !== "ok") {
            throw new Error(
              result.error ||
              t("areas.createFailed")
            );
          }

          await refreshAreas();
        } catch (error) {
          createButton.disabled = false;
          showMessage(
            error.message,
            true
          );
        }
      }
    );

    createInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          createButton.click();
        }
      }
    );
  }

  content
    .querySelectorAll(".area-labels-button")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();

        const areaId = button.dataset.areaId;
        const area = data.areas.find((item) => item.area_id === areaId);

        if (!area) return;

        const existing = button.parentElement.querySelector(".area-label-editor");
        if (existing) {
          existing.remove();
          return;
        }

        const box = document.createElement("div");
        box.className = "area-label-editor";
        box.style.cssText = "margin-top:.75rem;padding:.75rem;border:1px solid #666;border-radius:.6rem;max-height:260px;overflow-y:auto";

        const current = new Set(area.labels || []);
        box.innerHTML = data.availableLabels.map((label) => `<label style="display:flex;align-items:center;gap:.7rem;padding:.55rem"><input type="checkbox" value="${escapeHtml(label.label_id)}" ${current.has(label.label_id) ? "checked" : ""}> <span>${escapeHtml(label.name || label.label_id)}</span></label>`).join("");

        const save = document.createElement("button");
        save.type = "button";
        save.textContent = t("areas.save");
        save.addEventListener("click", async (event) => {
          event.stopPropagation();
          const selected = [...box.querySelectorAll("input:checked")].map((input) => input.value);
          await setAreaLabels(areaId, selected);
          await renderAreas();
        });

        box.appendChild(save);
        button.parentElement.appendChild(box);
      });
    });

  content
    .querySelectorAll(".area-rename-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async (event) => {
          event.stopPropagation();

          const areaId =
            button.dataset.areaId;

          const oldName =
            button.dataset.areaName || "";

          const newName = await phoenixPrompt(
            t("areas.renamePrompt"),
            oldName,
            {
              title: oldName
            }
          );

          if (newName === null) {
            return;
          }

          const name = newName.trim();

          if (!name || name === oldName) {
            return;
          }

          button.disabled = true;

          try {
            const result = await renameArea(
              areaId,
              name
            );

            if (result.status !== "ok") {
              throw new Error(
                result.error ||
                t("areas.renameFailed")
              );
            }

            await refreshAreas();
          } catch (error) {
            button.disabled = false;
            showMessage(
              error.message,
              true
            );
          }
        }
      );
    });

  content
    .querySelectorAll(".area-delete-button")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async (event) => {
          event.stopPropagation();

          const areaId =
            button.dataset.areaId;

          const areaName =
            button.dataset.areaName || areaId;

          const confirmed = await phoenixConfirm(
            t("areas.deleteConfirm", {
              name: areaName
            }),
            {
              title: areaName,
              danger: true
            }
          );

          if (!confirmed) {
            return;
          }

          button.disabled = true;

          try {
            const result = await deleteArea(
              areaId
            );

            if (result.status === "blocked") {
              const dependencies =
                result.dependencies || {};

              throw new Error(
                t("areas.deleteBlocked", {
                  devices:
                    dependencies.devices || 0,
                  direct:
                    dependencies.direct_entities || 0,
                  inherited:
                    dependencies.inherited_entities || 0
                })
              );
            }

            if (result.status !== "ok") {
              throw new Error(
                result.error ||
                t("areas.deleteFailed")
              );
            }

            await refreshAreas();
          } catch (error) {
            button.disabled = false;
            showMessage(
              error.message,
              true
            );
          }
        }
      );
    });

  content
    .querySelectorAll(".phoenix-area-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const areaId =
          card.dataset.areaId || null;

        const areaName =
          card.dataset.areaName ||
          t("areas.unassigned");

        if (areaId) {
          renderAreaDetails(
            content,
            data,
            areaId,
            areaName
          );
          return;
        }

        const unassignedData = {
          ...data,
          devices: data.devices.filter(
            (item) => !item.area_id
          ),
          entities: data.entities.filter(
            (item) => item.area_source === "none"
          )
        };

        renderAreaDetails(
          content,
          unassignedData,
          null,
          t("areas.unassigned")
        );
      });
    });
}

export async function renderAreas() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>🗺️ ${t("areas.title")}</h2>
      <p>
        ${t("areas.loading")}
      </p>
    </section>

    <div class="loading-card">
      ${t("areas.loadingAssignments")}
    </div>
  `;

  try {
    const [data, labelsData] = await Promise.all([
      loadAssignments(),
      loadHomeAssistantLabels()
    ]);

    data.availableLabels = labelsData.labels || [];

    renderAreaOverview(
      content,
      data
    );
  } catch (error) {
    content.innerHTML = `
      <section class="page-header">
        <h2>🗺️ ${t("areas.title")}</h2>
      </section>

      <div class="error-card">
        <strong>
          ${t("areas.loadError")}
        </strong>
        <p>
          ${escapeHtml(error.message)}
        </p>
      </div>
    `;
  }
}
