import {
  t
} from "../core/i18n.js?v=20260928-1050";

import {
  loadLabels,
  loadLabelUsage,
  loadHomeAssistantAreas,
  loadHomeAssistantDevices,
  loadHomeAssistantEntityRegistry,
  createLabel,
  renameLabel,
  deleteLabel,
  setDeviceLabels,
  setAreaLabels,
  setEntityLabels
} from "../core/api.js?v=20260928-1050";

let labelsData = [];
let areasData = [];
let devicesData = [];
let entitiesData = [];
let currentFilter = "all";
let currentSearch = "";

function normalizeApiData(labelData, usageData) {
  const labels = Array.isArray(labelData)
    ? labelData
    : (labelData?.labels || []);

  const usageLabels =
    usageData?.labels || [];

  const usageById = new Map(
    usageLabels.map(item => [
      item.label_id,
      item
    ])
  );

  const merged = labels.map(label => {
    const usage =
      usageById.get(label.label_id) || {};

    const areas =
      Number(usage.areas || 0);

    const devices =
      Number(usage.devices || 0);

    const entities =
      Number(usage.entities || 0);

    const total =
      Number(
        usage.total ??
        (areas + devices + entities)
      );

    return {
      ...label,
      areas,
      devices,
      entities,
      total,
      unused: total === 0,
      area_ids: usage.area_ids || [],
      device_ids: usage.device_ids || [],
      entity_ids: usage.entity_ids || []
    };
  });

  return {
    labels: merged,
    used: merged.filter(
      item => !item.unused
    ).length,
    unused: merged.filter(
      item => item.unused
    ).length
  };
}

function getFilteredLabels() {
  const search =
    currentSearch.trim().toLowerCase();

  return labelsData.filter(label => {
    const name = String(
      label.name ||
      label.label ||
      ""
    ).toLowerCase();

    if (
      search &&
      !name.includes(search)
    ) {
      return false;
    }

    if (
      currentFilter === "used" &&
      label.unused
    ) {
      return false;
    }

    if (
      currentFilter === "unused" &&
      !label.unused
    ) {
      return false;
    }

    return true;
  });
}

function getAreaDisplayName(areaId) {
  const area = areasData.find(
    item => item.area_id === areaId
  );

  return area?.name || areaId;
}

function getDeviceDisplayName(deviceId) {
  const device = devicesData.find(
    item => item.id === deviceId
  );

  return (
    device?.name ||
    device?.model ||
    deviceId
  );
}

function getEntityDisplayName(entityId) {
  const entity = entitiesData.find(
    item => item.entity_id === entityId
  );

  return (
    entity?.name ||
    entity?.original_name ||
    entity?.entity_id ||
    entityId
  );
}

function getLabelLinks(label) {
  return {
    areas: (label.area_ids || []).map(id => ({
      id,
      name: getAreaDisplayName(id)
    })),
    devices: (label.device_ids || []).map(id => ({
      id,
      name: getDeviceDisplayName(id)
    })),
    entities: (label.entity_ids || []).map(id => ({
      id,
      name: getEntityDisplayName(id)
    }))
  };
}

function renderLabelCards() {
  const grid =
    document.getElementById("labelsGrid");

  if (!grid) {
    return;
  }

  const labels =
    getFilteredLabels();

  if (!labels.length) {
    grid.innerHTML = `
      <div class="empty-card">
        ${t("labels.noResults")}
      </div>
    `;

    return;
  }

  grid.innerHTML = labels
    .map(label => {
      const name =
        label.name ||
        label.label ||
        "—";

      const links = getLabelLinks(label);

      const linkedEntityIds = new Set(
        links.entities.map(item => item.id)
      );

      const availableEntities = entitiesData
        .filter(
          entity =>
            !linkedEntityIds.has(entity.entity_id)
        )
        .sort((a, b) =>
          String(
            a.name ||
            a.original_name ||
            a.entity_id
          ).localeCompare(
            String(
              b.name ||
              b.original_name ||
              b.entity_id
            )
          )
        );

      const linkedAreaIds = new Set(
        links.areas.map(item => item.id)
      );

      const availableAreas = areasData
        .filter(
          area => !linkedAreaIds.has(area.area_id)
        )
        .sort((a, b) =>
          String(
            a.name || a.area_id
          ).localeCompare(
            String(
              b.name || b.area_id
            )
          )
        );

      const linkedDeviceIds = new Set(
        links.devices.map(item => item.id)
      );

      const availableDevices = devicesData
        .filter(
          device => !linkedDeviceIds.has(device.id)
        )
        .sort((a, b) =>
          String(
            a.name || a.model || a.id
          ).localeCompare(
            String(
              b.name || b.model || b.id
            )
          )
        );

      const areas =
        Number(
          label.areas ??
          0
        );

      const entities =
        Number(
          label.entities ??
          label.entity_count ??
          0
        );

      const devices =
        Number(
          label.devices ??
          label.device_count ??
          0
        );

      const status = label.unused
        ? t("common.unused")
        : t("labels.active");

      return `
        <article class="card label-card">
          <h3>${escapeHtml(name)}</h3>

          <div class="label-meta">
            ${status}
          </div>

          <div class="label-actions">
            <button
              class="filter-button"
              type="button"
              data-label-rename="${escapeHtml(label.label_id)}"
            >
              ✏️ ${t("labels.rename")}
            </button>

            <button
              class="filter-button"
              type="button"
              data-label-delete="${escapeHtml(label.label_id)}"
            >
              🗑️ ${t("labels.delete")}
            </button>
          </div>

          <div class="label-stats">
            <div class="label-stat">
              <strong>${areas}</strong>
              <span>${t("common.areas")}</span>
            </div>

            <div class="label-stat">
              <strong>${devices}</strong>
              <span>${t("common.devices")}</span>
            </div>

            <div class="label-stat">
              <strong>${entities}</strong>
              <span>${t("common.entities")}</span>
            </div>
          </div>

          <details class="label-links">
            <summary>
              🔗 ${t("labels.links")}
            </summary>

            <div class="label-links-content">
              <div class="label-links-group">
                <strong>${t("common.areas")} (${links.areas.length})</strong>

                ${
                  links.areas.length
                    ? links.areas.map(item => `
                        <div class="label-link-item">
                          <span>${escapeHtml(item.name)}</span>
                          <button
                            class="filter-button"
                            type="button"
                            data-label-area-remove="${escapeHtml(item.id)}"
                            data-label-id="${escapeHtml(label.label_id)}"
                          >
                            ✕ ${t("labels.removeLabel")}
                          </button>
                        </div>
                      `).join("")
                    : `<div>—</div>`
                }

                <div class="label-assignment-control">
                  <select
                    data-label-area-select="${escapeHtml(label.label_id)}"
                  >
                    <option value="">
                      ${t("labels.selectArea")}
                    </option>
                    ${availableAreas.map(area => `
                      <option value="${escapeHtml(area.area_id)}">
                        ${escapeHtml(area.name || area.area_id)}
                      </option>
                    `).join("")}
                  </select>

                  <button
                    class="filter-button"
                    type="button"
                    data-label-area-add="${escapeHtml(label.label_id)}"
                  >
                    ＋ ${t("labels.add")}
                  </button>
                </div>
              </div>

              <div class="label-links-group">
                <strong>${t("common.devices")} (${links.devices.length})</strong>
                ${
                  links.devices.length
                    ? `<ul>${links.devices.map(item =>
                        `<li>
                          <span>${escapeHtml(item.name)}</span>
                          <button
                            class="filter-button"
                            type="button"
                            data-label-device-remove="${escapeHtml(item.id)}"
                            data-label-id="${escapeHtml(label.label_id)}"
                          >
                            ✕ ${t("labels.removeLabel")}
                          </button>
                        </li>`
                      ).join("")}</ul>`
                    : `<div>—</div>`
                }

                <div class="label-assignment-control">
                  <select
                    data-label-device-select="${escapeHtml(label.label_id)}"
                  >
                    <option value="">
                      ${t("labels.selectDevice")}
                    </option>
                    ${availableDevices.map(device => {
                      const deviceName =
                        device.name ||
                        device.model ||
                        device.id;

                      return `
                        <option value="${escapeHtml(device.id)}">
                          ${escapeHtml(deviceName)}
                        </option>
                      `;
                    }).join("")}
                  </select>

                  <button
                    class="filter-button"
                    type="button"
                    data-label-device-add="${escapeHtml(label.label_id)}"
                  >
                    ＋ ${t("labels.add")}
                  </button>
                </div>
              </div>

              <div class="label-links-group">
                <strong>${t("common.entities")} (${links.entities.length})</strong>

                ${
                  links.entities.length
                    ? links.entities.map(item => `
                        <div class="label-link-item">
                          <span>${escapeHtml(item.name)}</span>
                          <button
                            class="filter-button"
                            type="button"
                            data-label-entity-remove="${escapeHtml(item.id)}"
                            data-label-id="${escapeHtml(label.label_id)}"
                          >
                            ✕ ${t("labels.removeLabel")}
                          </button>
                        </div>
                      `).join("")
                    : `<div>—</div>`
                }

                <div class="label-assignment-control">
                  <select
                    data-label-entity-select="${escapeHtml(label.label_id)}"
                  >
                    <option value="">
                      ${t("labels.selectEntity")}
                    </option>
                    ${availableEntities.map(entity => {
                      const entityName =
                        entity.name ||
                        entity.original_name ||
                        entity.entity_id;

                      return `
                        <option value="${escapeHtml(entity.entity_id)}">
                          ${escapeHtml(entityName)} — ${escapeHtml(entity.entity_id)}
                        </option>
                      `;
                    }).join("")}
                  </select>

                  <button
                    class="filter-button"
                    type="button"
                    data-label-entity-add="${escapeHtml(label.label_id)}"
                  >
                    ＋ ${t("labels.add")}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );
}

async function refreshLabels() {
  const [labelData, usageData] = await Promise.all([
    loadLabels(),
    loadLabelUsage()
  ]);

  const apiData = normalizeApiData(
    labelData,
    usageData
  );

  labelsData = apiData.labels || [];

  const statistics =
    document.getElementById(
      "labelsStatistics"
    );

  if (statistics) {
    statistics.innerHTML = `
      <article class="stat-card">
        <strong>
          ${labelsData.length}
        </strong>

        <span>
          ${t("common.labels")}
        </span>
      </article>

      <article class="stat-card">
        <strong>
          ${apiData.used || 0}
        </strong>

        <span>
          ${t("common.used")}
        </span>
      </article>

      <article class="stat-card">
        <strong>
          ${apiData.unused || 0}
        </strong>

        <span>
          ${t("common.unused")}
        </span>
      </article>
    `;
  }

  renderLabelCards();

  return apiData;
}

async function handleCreateLabel() {
  const input =
    document.getElementById("newLabelName");

  const name = input?.value.trim();

  if (!name) {
    return;
  }

  if (!window.confirm(
    t("labels.confirmCreate", { name })
  )) {
    return;
  }

  const result = await createLabel(
    name,
    true
  );

  if (result.status !== "ok") {
    window.alert(
      result.error || t("labels.createFailed")
    );
    return;
  }

  input.value = "";
  await refreshLabels();
}

async function handleRenameLabel(labelId) {
  const label = labelsData.find(
    item => item.label_id === labelId
  );

  if (!label) {
    return;
  }

  const name = window.prompt(
    t("labels.renamePrompt"),
    label.name || ""
  );

  if (!name || name.trim() === label.name) {
    return;
  }

  if (!window.confirm(
    t("labels.confirmRename", { oldName: label.name, newName: name.trim() })
  )) {
    return;
  }

  const result = await renameLabel(
    labelId,
    name.trim(),
    true
  );

  if (result.status !== "ok") {
    window.alert(
      result.error || t("labels.renameFailed")
    );
    return;
  }

  await refreshLabels();
}

async function handleDeleteLabel(labelId) {
  const label = labelsData.find(
    item => item.label_id === labelId
  );

  if (!label) {
    return;
  }

  if (!window.confirm(
    t("labels.confirmDelete", { name: label.name })
  )) {
    return;
  }

  const result = await deleteLabel(
    labelId,
    true
  );

  if (result.status === "blocked") {
    const dependencies =
      result.dependencies || {};

    window.alert(
      t("labels.deleteBlocked", {
        areas: dependencies.areas || 0,
        devices: dependencies.devices || 0,
        entities: dependencies.entities || 0
      })
    );
    return;
  }

  if (result.status !== "ok") {
    window.alert(
      result.error || t("labels.deleteFailed")
    );
    return;
  }

  await refreshLabels();
}

async function handleAddEntityLabel(
  entityId,
  labelId
) {
  let freshEntityData;

  try {
    freshEntityData =
      await loadHomeAssistantEntityRegistry();
  } catch (error) {
    window.alert(
      t("labels.entityDataLoadFailed")
    );
    return;
  }

  const freshEntities =
    Array.isArray(freshEntityData)
      ? freshEntityData
      : freshEntityData?.entities || [];

  const entity = freshEntities.find(
    item => item.entity_id === entityId
  );

  if (!entity) {
    window.alert(t("labels.entityNotFound"));
    return;
  }

  if (!Array.isArray(entity.labels)) {
    window.alert(
      t("labels.entityLabelsUnavailable")
    );
    return;
  }

  if (entity.labels.includes(labelId)) {
    window.alert(
      t("labels.entityAlreadyAssigned")
    );
    return;
  }

  const entityName =
    entity.name ||
    entity.original_name ||
    entity.entity_id;

  if (!window.confirm(
    t("labels.confirmAddEntity", { name: entityName })
  )) {
    return;
  }

  const newLabels = [
    ...entity.labels,
    labelId
  ];

  const result = await setEntityLabels(
    entityId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

async function handleRemoveEntityLabel(
  entityId,
  labelId
) {
  let freshEntityData;

  try {
    freshEntityData =
      await loadHomeAssistantEntityRegistry();
  } catch (error) {
    window.alert(
      t("labels.entityDataLoadFailed")
    );
    return;
  }

  const freshEntities =
    Array.isArray(freshEntityData)
      ? freshEntityData
      : freshEntityData?.entities || [];

  const entity = freshEntities.find(
    item => item.entity_id === entityId
  );

  if (!entity) {
    window.alert(t("labels.entityNotFound"));
    return;
  }

  if (!Array.isArray(entity.labels)) {
    window.alert(
      t("labels.entityLabelsUnavailable")
    );
    return;
  }

  if (!entity.labels.includes(labelId)) {
    window.alert(
      t("labels.entityNoLongerAssigned")
    );
    return;
  }

  const entityName =
    entity.name ||
    entity.original_name ||
    entity.entity_id;

  if (!window.confirm(
    t("labels.confirmRemoveEntity", { name: entityName })
  )) {
    return;
  }

  const newLabels = entity.labels.filter(
    id => id !== labelId
  );

  const result = await setEntityLabels(
    entityId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

async function handleAddAreaLabel(
  areaId,
  labelId
) {
  let freshAreaData;

  try {
    freshAreaData =
      await loadHomeAssistantAreas();
  } catch (error) {
    window.alert(
      t("labels.areaDataLoadFailed")
    );
    return;
  }

  const freshAreas =
    Array.isArray(freshAreaData)
      ? freshAreaData
      : freshAreaData?.areas || [];

  const area = freshAreas.find(
    item => item.area_id === areaId
  );

  if (!area) {
    window.alert(t("labels.areaNotFound"));
    return;
  }

  if (!Array.isArray(area.labels)) {
    window.alert(
      t("labels.areaLabelsUnavailable")
    );
    return;
  }

  if (area.labels.includes(labelId)) {
    window.alert(
      t("labels.areaAlreadyAssigned")
    );
    return;
  }

  const areaName =
    area.name ||
    area.area_id;

  if (!window.confirm(
    t("labels.confirmAddArea", { name: areaName })
  )) {
    return;
  }

  const newLabels = [
    ...area.labels,
    labelId
  ];

  const result = await setAreaLabels(
    areaId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

async function handleRemoveAreaLabel(
  areaId,
  labelId
) {
  let freshAreaData;

  try {
    freshAreaData =
      await loadHomeAssistantAreas();
  } catch (error) {
    window.alert(
      t("labels.areaDataLoadFailed")
    );
    return;
  }

  const freshAreas =
    Array.isArray(freshAreaData)
      ? freshAreaData
      : freshAreaData?.areas || [];

  const area = freshAreas.find(
    item => item.area_id === areaId
  );

  if (!area) {
    window.alert(t("labels.areaNotFound"));
    return;
  }

  if (!Array.isArray(area.labels)) {
    window.alert(
      t("labels.areaLabelsUnavailable")
    );
    return;
  }

  if (!area.labels.includes(labelId)) {
    window.alert(
      t("labels.areaNoLongerAssigned")
    );
    return;
  }

  const areaName =
    area.name ||
    area.area_id;

  if (!window.confirm(
    t("labels.confirmRemoveArea", { name: areaName })
  )) {
    return;
  }

  const newLabels = area.labels.filter(
    id => id !== labelId
  );

  const result = await setAreaLabels(
    areaId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

async function handleAddDeviceLabel(
  deviceId,
  labelId
) {
  let freshDeviceData;

  try {
    freshDeviceData =
      await loadHomeAssistantDevices();
  } catch (error) {
    window.alert(
      t("labels.deviceDataLoadFailed")
    );
    return;
  }

  const freshDevices =
    Array.isArray(freshDeviceData)
      ? freshDeviceData
      : freshDeviceData?.devices || [];

  const device = freshDevices.find(
    item => item.id === deviceId
  );

  if (!device) {
    window.alert(t("labels.deviceNotFound"));
    return;
  }

  if (!Array.isArray(device.labels)) {
    window.alert(
      t("labels.deviceLabelsUnavailable")
    );
    return;
  }

  if (device.labels.includes(labelId)) {
    window.alert(
      t("labels.deviceAlreadyAssigned")
    );
    return;
  }

  const deviceName =
    device.name ||
    device.model ||
    deviceId;

  if (!window.confirm(
    t("labels.confirmAddDevice", { name: deviceName })
  )) {
    return;
  }

  const newLabels = [
    ...device.labels,
    labelId
  ];

  const result = await setDeviceLabels(
    deviceId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

async function handleRemoveDeviceLabel(
  deviceId,
  labelId
) {
  let freshDeviceData;

  try {
    freshDeviceData =
      await loadHomeAssistantDevices();
  } catch (error) {
    window.alert(
      t("labels.deviceDataLoadFailed")
    );
    return;
  }

  const freshDevices =
    Array.isArray(freshDeviceData)
      ? freshDeviceData
      : freshDeviceData?.devices || [];

  const device = freshDevices.find(
    item => item.id === deviceId
  );

  if (!device) {
    window.alert(t("labels.deviceNotFound"));
    return;
  }

  if (!Array.isArray(device.labels)) {
    window.alert(
      t("labels.deviceLabelsUnavailable")
    );
    return;
  }

  const currentLabels = [...device.labels];

  if (!currentLabels.includes(labelId)) {
    window.alert(
      t("labels.deviceNoLongerAssigned")
    );
    return;
  }

  const deviceName =
    device.name ||
    device.model ||
    deviceId;

  if (!window.confirm(
    t("labels.confirmRemoveDevice", { name: deviceName })
  )) {
    return;
  }

  const newLabels = currentLabels.filter(
    id => id !== labelId
  );

  const result = await setDeviceLabels(
    deviceId,
    newLabels
  );

  if (result.status !== "ok") {
    window.alert(
      result.error ||
      t("labels.assignmentFailed")
    );
    return;
  }

  await renderLabels();
}

function bindLabelControls() {
  const search =
    document.getElementById("labelsSearch");

  search?.addEventListener(
    "input",
    event => {
      currentSearch =
        event.target.value || "";

      renderLabelCards();
    }
  );

  document
    .querySelectorAll(
      "[data-label-filter]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          currentFilter =
            button.dataset.labelFilter;

          document
            .querySelectorAll(
              "[data-label-filter]"
            )
            .forEach(item => {
              item.classList.toggle(
                "active",
                item === button
              );
            });

          renderLabelCards();
        }
      );
    });

  document
    .getElementById("createLabelButton")
    ?.addEventListener(
      "click",
      () => handleCreateLabel()
    );

  document
    .getElementById("newLabelName")
    ?.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          handleCreateLabel();
        }
      }
    );

  document
    .getElementById("labelsGrid")
    ?.addEventListener(
      "click",
      event => {
        const addEntityButton =
          event.target.closest(
            "[data-label-entity-add]"
          );

        if (addEntityButton) {
          const labelId =
            addEntityButton.dataset.labelEntityAdd;

          const select =
            document.querySelector(
              `[data-label-entity-select="${labelId}"]`
            );

          const entityId = select?.value;

          if (entityId) {
            handleAddEntityLabel(
              entityId,
              labelId
            );
          }

          return;
        }

        const removeEntityButton =
          event.target.closest(
            "[data-label-entity-remove]"
          );

        if (removeEntityButton) {
          handleRemoveEntityLabel(
            removeEntityButton.dataset.labelEntityRemove,
            removeEntityButton.dataset.labelId
          );

          return;
        }

        const addAreaButton =
          event.target.closest(
            "[data-label-area-add]"
          );

        if (addAreaButton) {
          const labelId =
            addAreaButton.dataset.labelAreaAdd;

          const select =
            document.querySelector(
              `[data-label-area-select="${labelId}"]`
            );

          const areaId = select?.value;

          if (areaId) {
            handleAddAreaLabel(
              areaId,
              labelId
            );
          }

          return;
        }

        const removeAreaButton =
          event.target.closest(
            "[data-label-area-remove]"
          );

        if (removeAreaButton) {
          handleRemoveAreaLabel(
            removeAreaButton.dataset.labelAreaRemove,
            removeAreaButton.dataset.labelId
          );

          return;
        }

        const addDeviceButton =
          event.target.closest(
            "[data-label-device-add]"
          );

        if (addDeviceButton) {
          const labelId =
            addDeviceButton.dataset.labelDeviceAdd;

          const select =
            document.querySelector(
              `[data-label-device-select="${labelId}"]`
            );

          const deviceId = select?.value;

          if (deviceId) {
            handleAddDeviceLabel(
              deviceId,
              labelId
            );
          }

          return;
        }

        const removeDeviceButton =
          event.target.closest(
            "[data-label-device-remove]"
          );

        if (removeDeviceButton) {
          handleRemoveDeviceLabel(
            removeDeviceButton.dataset.labelDeviceRemove,
            removeDeviceButton.dataset.labelId
          );
          return;
        }

        const renameButton =
          event.target.closest(
            "[data-label-rename]"
          );

        if (renameButton) {
          handleRenameLabel(
            renameButton.dataset.labelRename
          );
          return;
        }

        const deleteButton =
          event.target.closest(
            "[data-label-delete]"
          );

        if (deleteButton) {
          handleDeleteLabel(
            deleteButton.dataset.labelDelete
          );
        }
      }
    );
}

export async function renderLabels() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>
        🏷️ ${t("labels.title")}
      </h2>

      <p>
        ${t("labels.subtitle")}
      </p>
    </section>

    <section
      id="labelsStatistics"
      class="card-grid"
    >
      <div class="loading-card">
        ${t("common.loading")}
      </div>
    </section>

    <section class="card label-management-card">
      <h3>${t("labels.createTitle")}</h3>

      <div class="module-toolbar">
        <input
          id="newLabelName"
          class="search-input"
          type="text"
          placeholder="${t("labels.newLabelName")}"
        >

        <button
          id="createLabelButton"
          class="filter-button"
          type="button"
        >
          ➕ ${t("labels.create")}
        </button>
      </div>
    </section>

    <section class="module-toolbar">
      <input
        id="labelsSearch"
        class="search-input"
        type="search"
        placeholder="${t("labels.search")}"
      >

      <div class="filter-group">
        <button
          class="filter-button active"
          type="button"
          data-label-filter="all"
        >
          ${t("common.all")}
        </button>

        <button
          class="filter-button"
          type="button"
          data-label-filter="used"
        >
          ${t("common.used")}
        </button>

        <button
          class="filter-button"
          type="button"
          data-label-filter="unused"
        >
          ${t("common.unused")}
        </button>
      </div>
    </section>

    <section
      id="labelsGrid"
      class="card-grid"
    >
      <div class="loading-card">
        ${t("common.loading")}
      </div>
    </section>
  `;

  try {
    const [
      labelData,
      usageData,
      areaData,
      deviceData,
      entityData
    ] = await Promise.all([
      loadLabels(),
      loadLabelUsage(),
      loadHomeAssistantAreas(),
      loadHomeAssistantDevices(),
      loadHomeAssistantEntityRegistry()
    ]);

    const apiData =
      normalizeApiData(
        labelData,
        usageData
      );

    labelsData =
      apiData.labels || [];

    areasData = Array.isArray(areaData)
      ? areaData
      : areaData?.areas || [];

    devicesData = Array.isArray(deviceData)
      ? deviceData
      : deviceData?.devices || [];

    entitiesData = Array.isArray(entityData)
      ? entityData
      : entityData?.entities || [];

    const statistics =
      document.getElementById(
        "labelsStatistics"
      );

    statistics.innerHTML = `
      <article class="stat-card">
        <strong>
          ${labelsData.length}
        </strong>

        <span>
          ${t("common.labels")}
        </span>
      </article>

      <article class="stat-card">
        <strong>
          ${apiData.used || 0}
        </strong>

        <span>
          ${t("common.used")}
        </span>
      </article>

      <article class="stat-card">
        <strong>
          ${apiData.unused || 0}
        </strong>

        <span>
          ${t("common.unused")}
        </span>
      </article>
    `;

    bindLabelControls();
    renderLabelCards();
  } catch (error) {
    console.error(
      "[Phoenix V2 Labels]",
      error
    );

    const statistics =
      document.getElementById(
        "labelsStatistics"
      );

    statistics.innerHTML = `
      <div class="error-card">
        ${t("labels.loadError")}
        <br>
        <small>
          ${escapeHtml(error.message)}
        </small>
      </div>
    `;

    document.getElementById(
      "labelsGrid"
    ).innerHTML = "";
  }
}
