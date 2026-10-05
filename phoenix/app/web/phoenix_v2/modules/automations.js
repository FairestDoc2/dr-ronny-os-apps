import {
  loadHomeAssistantAutomations,
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantEntities,
  loadHomeAssistantDevices,
  loadDeviceAutomationTriggers,
  loadDeviceAutomationConditions,
  loadDeviceAutomationActions,
  loadHomeAssistantLabels,
  setEntityLabels,
  createLabel,
  deleteLabel,
  runAutomationAction,
  deleteAutomation,
  loadAutomationConfig,
  saveAutomationConfig
} from "../core/api.js?v=20260928-1050";

import {
  t
} from "../core/i18n.js?v=20260928-1050";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


let automationEntities = [];
let automationDevices = [];

export function setAutomationEditorData(entities = [], devices = [], states = []) {
  automationEntities = (Array.isArray(entities) ? entities : [])
    .filter((entity) => entity?.entity_id)
    .sort((a, b) =>
      String(a.name || a.original_name || a.entity_id).localeCompare(
        String(b.name || b.original_name || b.entity_id),
        undefined,
        { sensitivity: "base" }
      )
    );

  automationDevices = (Array.isArray(devices) ? devices : [])
    .filter((device) => device?.id)
    .sort((a, b) =>
      String(a.name || a.id).localeCompare(
        String(b.name || b.id),
        undefined,
        { sensitivity: "base" }
      )
    );

  automationEntityStates = new Map(
    (Array.isArray(states) ? states : [])
      .filter((entity) => entity?.entity_id)
      .map((entity) => [
        entity.entity_id,
        {
          state: entity.state || "",
          domain:
            entity.domain ||
            String(entity.entity_id).split(".", 1)[0],
          options: Array.isArray(entity.options)
            ? entity.options
            : []
        }
      ])
  );
}
let automationDeviceTriggers = new Map();
let automationDeviceConditions = new Map();
let automationDeviceActions = new Map();
let automationEntityStates = new Map();

function getAutomationEntityStateOptions(entityId) {
  const info = automationEntityStates.get(entityId);

  if (!info) {
    return [];
  }

  const values = new Set();

  if (Array.isArray(info.options)) {
    for (const option of info.options) {
      if (option !== null && option !== undefined && String(option) !== "") {
        values.add(String(option));
      }
    }
  }

  const onOffDomains = new Set([
    "light",
    "switch",
    "input_boolean",
    "automation",
    "fan"
  ]);

  if (onOffDomains.has(info.domain)) {
    values.add("on");
    values.add("off");
  }

  if (info.domain === "binary_sensor") {
    values.add("on");
    values.add("off");
  }

  if (info.domain === "person" || info.domain === "device_tracker") {
    values.add("home");
    values.add("not_home");
  }

  if (info.state) {
    values.add(String(info.state));
  }

  return Array.from(values);
}

export async function ensureDeviceAutomationTriggers(deviceId) {
  if (!deviceId) {
    return [];
  }

  if (automationDeviceTriggers.has(deviceId)) {
    return automationDeviceTriggers.get(deviceId);
  }

  const response = await loadDeviceAutomationTriggers(deviceId);

  const triggers = Array.isArray(response?.triggers)
    ? response.triggers
    : [];

  automationDeviceTriggers.set(deviceId, triggers);

  return triggers;
}


export function getDeviceAutomationTriggers(deviceId) {
  return automationDeviceTriggers.get(deviceId) || [];
}


export function getDeviceAutomationConditions(deviceId) {
  return automationDeviceConditions.get(deviceId) || [];
}

export async function ensureDeviceAutomationConditions(deviceId) {
  if (!deviceId) {
    return [];
  }

  if (automationDeviceConditions.has(deviceId)) {
    return automationDeviceConditions.get(deviceId);
  }

  const response = await loadDeviceAutomationConditions(deviceId);

  const conditions =
    response?.status === "ok" &&
    Array.isArray(response.conditions)
      ? response.conditions
      : [];

  automationDeviceConditions.set(deviceId, conditions);

  return conditions;
}

export function getDeviceAutomationActions(deviceId) {
  return automationDeviceActions.get(deviceId) || [];
}

export async function ensureDeviceAutomationActions(deviceId) {
  if (!deviceId) {
    return [];
  }

  if (automationDeviceActions.has(deviceId)) {
    return automationDeviceActions.get(deviceId);
  }

  const response = await loadDeviceAutomationActions(deviceId);

  const actions =
    response?.status === "ok" &&
    Array.isArray(response.actions)
      ? response.actions
      : [];

  automationDeviceActions.set(deviceId, actions);

  return actions;
}


function automationTriggerType(trigger) {
  return trigger?.trigger || trigger?.platform || "";
}

function automationTriggerTypeLabel(type) {
  const labels = {
    state: t("automations.triggerState"),
    time: t("automations.triggerTime"),
    device: t("automations.triggerDevice"),
    time_pattern: t("automations.triggerTimePattern"),
    homeassistant: t("automations.triggerHomeAssistant"),
    event: t("automations.triggerEvent")
  };

  return labels[type] || type || "Unbekannt";
}

function renderAutomationTrigger(
  trigger,
  index,
  triggerPath = null
) {
  const type = automationTriggerType(trigger);
  const path =
    triggerPath === null
      ? String(index)
      : String(triggerPath);

  const header = `
    <div class="automation-trigger-header">
      <strong>
        ${escapeHtml(
          automationTriggerTypeLabel(type)
        )}
      </strong>

      <button
        type="button"
        data-trigger-remove="${index}"
      >
        🗑️ ${escapeHtml(t("automations.triggerRemove"))}
      </button>
    </div>
  `;

  let fields = "";

  if (type === "state") {
    const entityIds = Array.isArray(trigger.entity_id)
      ? trigger.entity_id
      : trigger.entity_id
        ? [trigger.entity_id]
        : [];

    const selectedEntityId = entityIds[0] || "";

    const entityOptions = automationEntities
      .map((entity) => {
        const entityId = entity.entity_id;
        const name =
          entity.name ||
          entity.original_name ||
          entityId;

        return `
          <option
            value="${escapeHtml(entityId)}"
            ${entityId === selectedEntityId ? "selected" : ""}
          >
            ${escapeHtml(name)} — ${escapeHtml(entityId)}
          </option>
        `;
      })
      .join("");

    const stateOptions = getAutomationEntityStateOptions(selectedEntityId)
      .map(
        (state) =>
          `<option value="${escapeHtml(state)}"></option>`
      )
      .join("");

    fields = `
      <label>
        ${escapeHtml(t("automations.triggerEntity"))}
        <select data-trigger-field="entity_id">
          <option value=""></option>
          ${entityOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.triggerFrom"))}
        <input
          type="text"
          data-trigger-field="from"
          value="${escapeHtml(trigger.from || "")}"
          list="trigger-state-values-${index}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.triggerTo"))}
        <input
          type="text"
          data-trigger-field="to"
          value="${escapeHtml(trigger.to || "")}"
          list="trigger-state-values-${index}"
        >
      </label>

      <datalist id="trigger-state-values-${index}">
        ${stateOptions}
      </datalist>
    `;
  } else if (type === "device") {
    const selectedDeviceId = trigger.device_id || "";

    const deviceOptions = automationDevices
      .map((device) => `
        <option
          value="${escapeHtml(device.id)}"
          ${device.id === selectedDeviceId ? "selected" : ""}
        >
          ${escapeHtml(device.name || device.id)}
        </option>
      `)
      .join("");

    fields = `
      <label>
        ${escapeHtml(t("automations.triggerDevice"))}
        <select data-trigger-field="device_id">
          <option value=""></option>
          ${deviceOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.triggerEventType"))}
        <select data-device-trigger-choice>
          <option value=""></option>
          ${
            (automationDeviceTriggers.get(selectedDeviceId) || [])
              .map((availableTrigger, triggerIndex) => {
                const selected =
                  availableTrigger.type === trigger.type &&
                  availableTrigger.domain === trigger.domain &&
                  availableTrigger.entity_id === trigger.entity_id;

                const registryEntity = automationEntities.find(
                  (entity) =>
                    entity.registry_id === availableTrigger.entity_id
                );

                const entityName =
                  registryEntity?.name ||
                  registryEntity?.original_name ||
                  registryEntity?.entity_id ||
                  availableTrigger.domain ||
                  availableTrigger.entity_id ||
                  "";

                const typeLabel = String(
                  availableTrigger.type || ""
                )
                  .replaceAll("_", " ");

                return `
                  <option
                    value="${triggerIndex}"
                    ${selected ? "selected" : ""}
                  >
                    ${escapeHtml(entityName)} — ${escapeHtml(typeLabel)}
                  </option>
                `;
              })
              .join("")
          }
        </select>
      </label>
    `;
  } else if (type === "time_pattern") {
    fields = `
      <label>
        ${escapeHtml(t("automations.triggerHours"))}
        <input
          type="text"
          data-trigger-field="hours"
          value="${escapeHtml(trigger.hours || "")}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.triggerMinutes"))}
        <input
          type="text"
          data-trigger-field="minutes"
          value="${escapeHtml(trigger.minutes || "")}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.triggerSeconds"))}
        <input
          type="text"
          data-trigger-field="seconds"
          value="${escapeHtml(trigger.seconds || "")}"
        >
      </label>
    `;
  } else if (type === "homeassistant") {
    fields = `
      <label>
        ${escapeHtml(t("automations.triggerEvent"))}
        <select data-trigger-field="event">
          <option
            value="start"
            ${trigger.event === "start" ? "selected" : ""}
          >
            ${escapeHtml(t("automations.triggerStart"))}
          </option>
          <option
            value="shutdown"
            ${trigger.event === "shutdown" ? "selected" : ""}
          >
            ${escapeHtml(t("automations.triggerShutdown"))}
          </option>
        </select>
      </label>
    `;
  } else if (type === "event") {
    fields = `
      <label>
        ${escapeHtml(t("automations.triggerEventType"))}
        <input
          type="text"
          data-trigger-field="event_type"
          value="${escapeHtml(trigger.event_type || "")}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.triggerEventData"))}
        <textarea
          rows="4"
          data-trigger-field="event_data"
        >${escapeHtml(
          JSON.stringify(
            trigger.event_data || {},
            null,
            2
          )
        )}</textarea>
      </label>
    `;
  } else {
    fields = `
      <p>
        ${escapeHtml(t("automations.triggerUnsupported"))}
      </p>
    `;
  }

  return `
    <article
      class="automation-trigger-card"
      data-trigger-index="${index}"
      data-trigger-path="${escapeHtml(path)}"
    >
      ${header}
      <div class="automation-trigger-fields">
        ${fields}

        <label>
          ${escapeHtml(t("automations.triggerId"))}
          <input
            type="text"
            data-trigger-field="id"
            value="${escapeHtml(trigger.id || "")}"
            placeholder="${escapeHtml(t("automations.exampleTriggerId"))}"
          >
        </label>
      </div>
    </article>
  `;
}

export function automationConditionType(condition) {
  return condition?.condition || "";
}

function renderAutomationCondition(condition, index, path = null, config = null) {
  const type = automationConditionType(condition);
  const conditionPath =
    path === null ? String(index) : String(path);

  const labels = {
    state: t("automations.conditionState"),
    numeric_state: t("automations.conditionNumericState"),
    time: t("automations.conditionTime"),
    sun: t("automations.conditionSun"),
    template: t("automations.conditionTemplate"),
    device: t("automations.conditionDevice"),
    trigger: t("automations.conditionTrigger"),
    and: t("automations.conditionAnd"),
    or: t("automations.conditionOr"),
    not: t("automations.conditionNot")
  };

  const typeLabel = labels[type] || type || "Unbekannt";

  let fields = "";

  if (type === "state") {
    const selectedEntityId = condition.entity_id || "";

    const entityOptions = automationEntities
      .map((entity) => {
        const entityId = entity.entity_id;
        const name =
          entity.name ||
          entity.original_name ||
          entityId;

        return `
          <option
            value="${escapeHtml(entityId)}"
            ${entityId === selectedEntityId ? "selected" : ""}
          >
            ${escapeHtml(name)} — ${escapeHtml(entityId)}
          </option>
        `;
      })
      .join("");

    const stateOptions = getAutomationEntityStateOptions(selectedEntityId)
      .map(
        (state) =>
          `<option value="${escapeHtml(state)}"></option>`
      )
      .join("");

    fields = `
      <label>
        ${escapeHtml(t("automations.entity"))}
        <select data-condition-field="entity_id">
          <option value=""></option>
          ${entityOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.state"))}
        <input
          type="text"
          data-condition-field="state"
          value="${escapeHtml(condition.state || "")}"
          list="condition-state-values-${conditionPath.replaceAll(".", "-")}"
        >
        <datalist id="condition-state-values-${conditionPath.replaceAll(".", "-")}">
          ${stateOptions}
        </datalist>
      </label>
    `;
  } else if (type === "numeric_state") {
    const selectedEntityId = condition.entity_id || "";

    const entityOptions = automationEntities
      .map((entity) => {
        const entityId = entity.entity_id;
        const name =
          entity.name ||
          entity.original_name ||
          entityId;

        return `
          <option
            value="${escapeHtml(entityId)}"
            ${entityId === selectedEntityId ? "selected" : ""}
          >
            ${escapeHtml(name)} — ${escapeHtml(entityId)}
          </option>
        `;
      })
      .join("");

    fields = `
      <label>
        ${escapeHtml(t("automations.entity"))}
        <select data-condition-field="entity_id">
          <option value=""></option>
          ${entityOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.above"))}
        <input
          type="number"
          step="any"
          data-condition-field="above"
          value="${escapeHtml(condition.above ?? "")}"
          placeholder="${escapeHtml(t("automations.exampleAbove"))}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.below"))}
        <input
          type="number"
          step="any"
          data-condition-field="below"
          value="${escapeHtml(condition.below ?? "")}"
          placeholder="${escapeHtml(t("automations.exampleBelow"))}"
        >
      </label>
    `;
  } else if (type === "time") {
    const selectedWeekdays = Array.isArray(condition.weekday)
      ? condition.weekday
      : [];

    const weekdays = [
      ["mon", t("automations.weekdayMon")],
      ["tue", t("automations.weekdayTue")],
      ["wed", t("automations.weekdayWed")],
      ["thu", t("automations.weekdayThu")],
      ["fri", t("automations.weekdayFri")],
      ["sat", t("automations.weekdaySat")],
      ["sun", t("automations.weekdaySun")]
    ];

    const weekdayButtons = weekdays
      .map(([value, label]) => `
        <label class="automation-weekday-chip">
          <input
            type="checkbox"
            data-condition-weekday="${value}"
            ${selectedWeekdays.includes(value) ? "checked" : ""}
          >
          <span>${label}</span>
        </label>
      `)
      .join("");

    fields = `
      <div class="automation-condition-time">
        <label>
          ${escapeHtml(t("automations.after"))}
          <input
            type="time"
            step="1"
            data-condition-field="after"
            value="${escapeHtml(condition.after || "")}"
          >
        </label>

        <label>
          ${escapeHtml(t("automations.before"))}
          <input
            type="time"
            step="1"
            data-condition-field="before"
            value="${escapeHtml(condition.before || "")}"
          >
        </label>
      </div>

      <div class="automation-condition-weekdays">
        <strong>${escapeHtml(t("automations.weekdays"))}</strong>

        <div class="automation-weekday-list">
          ${weekdayButtons}
        </div>
      </div>
    `;
  } else if (type === "sun") {
    fields = `
      <label>
        ${escapeHtml(t("automations.after"))}
        <select data-condition-field="after">
          <option value=""></option>
          <option value="sunrise" ${condition.after === "sunrise" ? "selected" : ""}>
            ${escapeHtml(t("automations.sunrise"))}
          </option>
          <option value="sunset" ${condition.after === "sunset" ? "selected" : ""}>
            ${escapeHtml(t("automations.sunset"))}
          </option>
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.before"))}
        <select data-condition-field="before">
          <option value=""></option>
          <option value="sunrise" ${condition.before === "sunrise" ? "selected" : ""}>
            ${escapeHtml(t("automations.sunrise"))}
          </option>
          <option value="sunset" ${condition.before === "sunset" ? "selected" : ""}>
            ${escapeHtml(t("automations.sunset"))}
          </option>
        </select>
      </label>
    `;
  } else if (type === "device") {
    const selectedDeviceId = condition.device_id || "";

    const deviceOptions = automationDevices
      .map((device) => `
        <option
          value="${escapeHtml(device.id)}"
          ${device.id === selectedDeviceId ? "selected" : ""}
        >
          ${escapeHtml(device.name || device.id)}
        </option>
      `)
      .join("");

    fields = `
      <label>
        ${escapeHtml(t("automations.actionDevice"))}
        <select data-condition-field="device_id">
          <option value=""></option>
          ${deviceOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.deviceCondition"))}
        <select data-device-condition-choice>
          <option value=""></option>
          ${
            (automationDeviceConditions.get(selectedDeviceId) || [])
              .map((availableCondition, conditionIndex) => {
                const selected =
                  availableCondition.type === condition.type &&
                  availableCondition.domain === condition.domain &&
                  availableCondition.entity_id === condition.entity_id;

                const registryEntity = automationEntities.find(
                  (entity) =>
                    entity.registry_id === availableCondition.entity_id
                );

                const entityName =
                  registryEntity?.name ||
                  registryEntity?.original_name ||
                  registryEntity?.entity_id ||
                  availableCondition.domain ||
                  availableCondition.entity_id ||
                  "";

                const conditionLabel = String(
                  availableCondition.type || ""
                ).replaceAll("_", " ");

                return `
                  <option
                    value="${conditionIndex}"
                    ${selected ? "selected" : ""}
                  >
                    ${escapeHtml(entityName)} — ${escapeHtml(conditionLabel)}
                  </option>
                `;
              })
              .join("")
          }
        </select>
      </label>
    `;
  } else if (type === "trigger") {
    const triggerIds = [
      ...new Set(
        (Array.isArray(config?.triggers)
          ? config.triggers
          : [])
          .map((trigger) => String(trigger?.id || "").trim())
          .filter(Boolean)
      )
    ];

    const currentIds = Array.isArray(condition.id)
      ? condition.id
      : condition.id
        ? [condition.id]
        : [];

    const allTriggerIds = [
      ...new Set([
        ...triggerIds,
        ...currentIds.map((id) => String(id))
      ])
    ];

    fields = `
      <label>
        ${escapeHtml(t("automations.triggerId"))}
        <select data-condition-field="id">
          <option value=""></option>
          ${allTriggerIds
            .map((id) => `
              <option
                value="${escapeHtml(id)}"
                ${currentIds.includes(id) ? "selected" : ""}
              >
                ${escapeHtml(id)}
              </option>
            `)
            .join("")}
        </select>
      </label>

      ${
        triggerIds.length === 0
          ? `
            <p>
              ${escapeHtml(t("automations.triggerIdEmpty"))}
              ${escapeHtml(t("automations.triggerIdRequiredHint"))}
            </p>
          `
          : ""
      }
    `;
  } else if (
    type === "and" ||
    type === "or" ||
    type === "not"
  ) {
    const nestedConditions = Array.isArray(condition.conditions)
      ? condition.conditions
      : [];

    const logicalLabel =
      type === "and"
        ? "UND"
        : type === "or"
          ? "ODER"
          : "NICHT";

    const maxConditions = type === "not" ? 1 : Infinity;

    const nestedHtml = nestedConditions
      .map((nestedCondition, nestedIndex) =>
        renderAutomationCondition(
          nestedCondition,
          nestedIndex,
          `${conditionPath}.${nestedIndex}`,
          config
        )
      )
      .join("");

    fields = `
      <div class="automation-condition-logical">
        <p>
          <strong>${logicalLabel}</strong>
          ${
            type === "not"
              ? ` – ${t("automations.conditionNotDescription")}`
              : type === "and"
                ? ` – ${t("automations.conditionAndDescription")}`
                : ` – ${t("automations.conditionOrDescription")}`
          }
        </p>

        <div class="automation-condition-list">
          ${
            nestedHtml ||
            `<p>${escapeHtml(t("automations.noSubcondition"))}</p>`
          }
        </div>

        ${
          nestedConditions.length < maxConditions
            ? `
              <div class="automation-condition-add">
                <select
                  data-condition-child-new-type
                  data-condition-parent-path="${escapeHtml(conditionPath)}"
                >
                  <option value="state">${escapeHtml(t("automations.triggerState"))}</option>
                  <option value="numeric_state">${escapeHtml(t("automations.conditionNumericState"))}</option>
                  <option value="time">${escapeHtml(t("automations.conditionTime"))}</option>
                  <option value="sun">${escapeHtml(t("automations.conditionSun"))}</option>
                  <option value="template">${escapeHtml(t("automations.conditionTemplate"))}</option>
                  <option value="device">${escapeHtml(t("automations.triggerDevice"))}</option>
                  <option value="trigger">${escapeHtml(t("automations.conditionTrigger"))}</option>
                  <option value="and">${escapeHtml(t("automations.conditionAnd"))}</option>
                  <option value="or">${escapeHtml(t("automations.conditionOr"))}</option>
                  <option value="not">${escapeHtml(t("automations.conditionNot"))}</option>
                </select>

                <button
                  type="button"
                  class="automation-editor-secondary"
                  data-condition-child-add="${escapeHtml(conditionPath)}"
                >
                  + ${escapeHtml(t("automations.subcondition"))}
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  } else if (type === "template") {
    fields = `
      <label>
        ${escapeHtml(t("automations.conditionTemplate"))}
        <textarea
          rows="6"
          data-condition-field="value_template"
        >${escapeHtml(condition.value_template || "")}</textarea>
      </label>
    `;
  } else {
    fields = `
      <p>
        ${escapeHtml(t("automations.conditionUnsupported"))}
      </p>
    `;
  }

  const isConditionAction =
    conditionPath.startsWith("action-condition.");

  const removeButton = isConditionAction
    ? ""
    : `
        <button
          type="button"
          class="automation-trigger-remove"
          data-condition-remove="${index}"
          data-condition-remove-path="${escapeHtml(conditionPath)}"
        >
          ✕
        </button>
      `;

  return `
    <article
      class="automation-condition-card"
      data-condition-index="${index}"
      data-condition-path="${escapeHtml(conditionPath)}"
    >
      <div class="automation-trigger-header">
        <strong>
          ${escapeHtml(t("automations.actionCondition"))} ${index + 1}: ${escapeHtml(typeLabel)}
        </strong>

        ${removeButton}
      </div>

      <div class="automation-trigger-fields">
        ${fields}
      </div>
    </article>
  `;
}

function renderAutomationConditions(
  conditions,
  config = null,
  pathPrefix = null
) {
  const items = Array.isArray(conditions)
    ? conditions
    : [];

  return items
    .map((condition, index) => {
      const path =
        pathPrefix === null
          ? String(index)
          : `${pathPrefix}.${index}`;

      return renderAutomationCondition(
        condition,
        index,
        path,
        config
      );
    })
    .join("");
}

function renderAutomationTriggers(
  triggers,
  pathPrefix = null
) {
  const items = Array.isArray(triggers)
    ? triggers
    : [];

  return items
    .map((trigger, index) => {
      const path =
        pathPrefix === null
          ? String(index)
          : `${pathPrefix}.${index}`;

      return renderAutomationTrigger(
        trigger,
        index,
        path
      );
    })
    .join("");
}

export function getConditionRoot(actions, path) {
  if (!Array.isArray(actions)) {
    return null;
  }

  const parts = String(path).split(".");

  if (!parts.length) {
    return null;
  }

  const actionIndex = Number(parts[0]);

  if (
    !Number.isInteger(actionIndex) ||
    actionIndex < 0 ||
    !actions[actionIndex]
  ) {
    return null;
  }

  let current = actions[actionIndex];
  let position = 1;

  while (position < parts.length) {
    const key = parts[position];

    if (
      key === "if" ||
      key === "conditions" ||
      key === "while" ||
      key === "until"
    ) {
      const conditionList = current?.[key];

      if (!Array.isArray(conditionList)) {
        return null;
      }

      return {
        conditions: conditionList,
        parts: parts.slice(position + 1)
      };
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(key in current)
    ) {
      return null;
    }

    current = current[key];
    position += 1;
  }

  return null;
}

export function getConditionByPath(actions, path) {
  const root = getConditionRoot(actions, path);

  if (
    !root ||
    !Array.isArray(root.conditions)
  ) {
    return null;
  }

  const parts = root.parts.map(
    (part) => Number(part)
  );

  if (
    parts.length === 0 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0
    )
  ) {
    return null;
  }

  let conditions = root.conditions;
  let condition = null;

  for (
    let depth = 0;
    depth < parts.length;
    depth += 1
  ) {
    const index = parts[depth];

    if (
      !Array.isArray(conditions) ||
      !conditions[index]
    ) {
      return null;
    }

    condition = conditions[index];

    if (depth < parts.length - 1) {
      conditions = condition.conditions;
    }
  }

  return condition;
}

export function getConditionParentByPath(actions, path) {
  const root = getConditionRoot(actions, path);

  if (
    !root ||
    !Array.isArray(root.conditions)
  ) {
    return null;
  }

  const parts = root.parts.map(
    (part) => Number(part)
  );

  if (
    parts.length === 0 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0
    )
  ) {
    return null;
  }

  const index = parts.pop();
  let conditions = root.conditions;

  for (const part of parts) {
    const parent = conditions?.[part];

    if (
      !parent ||
      !Array.isArray(parent.conditions)
    ) {
      return null;
    }

    conditions = parent.conditions;
  }

  return {
    conditions,
    index
  };
}

export function getActionByPath(actions, path) {
  if (!Array.isArray(actions)) {
    return null;
  }

  const parts = String(path).split(".");

  if (!parts.length) {
    return null;
  }

  let current = actions;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  return current || null;
}


export function getActionParentByPath(actions, path) {
  if (!Array.isArray(actions)) {
    return null;
  }

  const parts = String(path).split(".");

  if (!parts.length) {
    return null;
  }

  const last = parts.pop();
  let current = actions;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  const index = Number(last);

  if (
    !Array.isArray(current) ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return null;
  }

  return {
    actions: current,
    index
  };
}


export function getTriggerByPath(actions, path) {
  if (!Array.isArray(actions)) {
    return null;
  }

  const parts = String(path).split(".");

  if (parts[0] === "actions") {
    parts.shift();
  }

  let current = actions;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  return current || null;
}


export function getTriggerParentByPath(actions, path) {
  if (!Array.isArray(actions)) {
    return null;
  }

  const parts = String(path).split(".");

  if (parts[0] === "actions") {
    parts.shift();
  }

  if (!parts.length) {
    return null;
  }

  const last = parts.pop();
  let current = actions;

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  const index = Number(last);

  if (
    !Array.isArray(current) ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return null;
  }

  return {
    triggers: current,
    index
  };
}


export function automationActionType(action) {
  if (!action || typeof action !== "object") {
    return "unknown";
  }

  if ("action" in action || "service" in action) return "service";

  if (
    "device_id" in action &&
    "domain" in action &&
    "type" in action
  ) {
    return "device";
  }

  if ("delay" in action) return "delay";
  if ("if" in action) return "if";
  if ("choose" in action) return "choose";
  if ("wait_for_trigger" in action) return "wait_for_trigger";
  if ("wait_template" in action) return "wait_template";
  if ("condition" in action) return "condition";
  if ("variables" in action) return "variables";
  if ("repeat" in action) return "repeat";
  if ("parallel" in action) return "parallel";
  if ("event" in action) return "event";
  if ("stop" in action) return "stop";

  return "unknown";
}


export function automationActionTypeLabel(type) {
  const labels = {
    service: t("automations.actionService"),
    device: t("automations.actionDevice"),
    delay: t("automations.actionDelay"),
    if: t("automations.actionIf"),
    choose: t("automations.actionChoose"),
    wait_for_trigger: t("automations.actionWaitForTrigger"),
    wait_template: t("automations.actionWaitTemplate"),
    condition: t("automations.actionCondition"),
    variables: t("automations.actionVariables"),
    repeat: t("automations.actionRepeat"),
    parallel: t("automations.actionParallel"),
    event: t("automations.actionEvent"),
    stop: t("automations.actionStop"),
    unknown: t("automations.actionUnknown")
  };

  return labels[type] || type || t("automations.actionUnknown");
}


export function automationActionDefault(type) {
  const defaults = {
    service: {
      action: ""
    },

    device: {
      device_id: "",
      domain: "",
      type: ""
    },

    delay: {
      delay: {
        seconds: 1
      }
    },

    if: {
      if: [],
      then: [],
      else: []
    },

    choose: {
      choose: [],
      default: []
    },

    wait_for_trigger: {
      wait_for_trigger: []
    },

    wait_template: {
      wait_template: ""
    },

    condition: {
      condition: "state",
      entity_id: "",
      state: ""
    },

    variables: {
      variables: {}
    },

    repeat: {
      repeat: {
        count: 1,
        sequence: []
      }
    },

    parallel: {
      parallel: []
    },

    event: {
      event: ""
    },

    stop: {
      stop: ""
    }
  };

  return defaults[type]
    ? structuredClone(defaults[type])
    : null;
}


function renderAutomationConditionTypeOptions(selectedType = "") {
  const types = [
    ["state", t("automations.conditionState")],
    ["numeric_state", t("automations.conditionNumericState")],
    ["time", t("automations.conditionTime")],
    ["sun", t("automations.conditionSun")],
    ["template", t("automations.conditionTemplate")],
    ["device", t("automations.conditionDevice")],
    ["trigger", t("automations.conditionTrigger")],
    ["and", t("automations.conditionAnd")],
    ["or", t("automations.conditionOr")],
    ["not", t("automations.conditionNot")]
  ];

  return types
    .map(([value, label]) => `
      <option
        value="${escapeHtml(value)}"
        ${value === selectedType ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `)
    .join("");
}


function renderAutomationActionTypeOptions(selectedType = "") {
  const types = [
    ["service", t("automations.actionService")],
    ["device", t("automations.actionDevice")],
    ["delay", t("automations.actionDelay")],
    ["if", t("automations.actionIf")],
    ["choose", t("automations.actionChoose")],
    ["wait_for_trigger", t("automations.actionWaitForTrigger")],
    ["wait_template", t("automations.actionWaitTemplate")],
    ["condition", t("automations.actionCondition")],
    ["variables", t("automations.actionVariables")],
    ["repeat", t("automations.actionRepeat")],
    ["parallel", t("automations.actionParallel")],
    ["event", t("automations.actionEvent")],
    ["stop", t("automations.actionStop")]
  ];

  return types
    .map(([value, label]) => `
      <option
        value="${escapeHtml(value)}"
        ${value === selectedType ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `)
    .join("");
}


function renderAutomationVariableRows(variables, actionPath) {
  const entries =
    variables &&
    typeof variables === "object" &&
    !Array.isArray(variables)
      ? Object.entries(variables)
      : [];

  if (!entries.length) {
    return `
      <p>${escapeHtml(t("automations.variableEmpty"))}</p>
    `;
  }

  return entries
    .map(([name, value], index) => `
      <div
        class="automation-editor-section"
        data-action-variable-index="${index}"
      >
        <label>
          ${escapeHtml(t("automations.variableName"))}
          <input
            type="text"
            data-action-variable-name
            value="${escapeHtml(name)}"
            placeholder="${escapeHtml(t("automations.exampleVariableName"))}"
          >
        </label>

        <label>
          ${escapeHtml(t("automations.variableValue"))}
          <textarea
            data-action-variable-value
            rows="6"
            placeholder="{{ ... }}"
          >${escapeHtml(
            value === null || value === undefined
              ? ""
              : String(value)
          )}</textarea>
        </label>

        <button
          type="button"
          class="automation-editor-secondary"
          data-action-variable-remove="${index}"
          data-action-variable-parent="${escapeHtml(actionPath)}"
        >
          ${escapeHtml(t("automations.variableRemove"))}
        </button>
      </div>
    `)
    .join("");
}


function automationRepeatType(action) {
  const repeat =
    action &&
    typeof action === "object" &&
    action.repeat &&
    typeof action.repeat === "object" &&
    !Array.isArray(action.repeat)
      ? action.repeat
      : {};

  if ("while" in repeat) return "while";
  if ("until" in repeat) return "until";
  if ("for_each" in repeat) return "for_each";

  return "count";
}

export function renderAutomationAction(action, index, path = null, config = null) {
  const type = automationActionType(action);
  const actionPath =
    path === null ? String(index) : String(path);

  let fields = "";

  if (type === "service") {
    const actionName =
      action.action ||
      action.service ||
      "";

    const targetEntity = action?.target?.entity_id;

    const entityValue = Array.isArray(targetEntity)
      ? targetEntity.join(", ")
      : targetEntity || "";

    fields = `
      <label>
        ${escapeHtml(t("automations.actionService"))}
        <input
          type="text"
          data-action-field="action"
          value="${escapeHtml(actionName)}"
          placeholder="${escapeHtml(t("automations.exampleService"))}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.targetEntity"))}
        <input
          type="text"
          data-action-target-entity
          value="${escapeHtml(entityValue)}"
          placeholder="${escapeHtml(t("automations.exampleEntity"))}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.dataJson"))}
        <textarea
          data-action-json-field="data"
          rows="5"
          placeholder='{"brightness_pct": 80}'
        >${escapeHtml(
          action.data
            ? JSON.stringify(action.data, null, 2)
            : ""
        )}</textarea>
      </label>

      <label>
        ${escapeHtml(t("automations.responseVariable"))}
        <input
          type="text"
          data-action-field="response_variable"
          value="${escapeHtml(action.response_variable || "")}"
          placeholder="${escapeHtml(t("automations.exampleResponseVariable"))}"
        >
      </label>
    `;
  } else if (type === "device") {
    const selectedDeviceId = action.device_id || "";

    const deviceOptions = automationDevices
      .map((device) => `
        <option
          value="${escapeHtml(device.id)}"
          ${device.id === selectedDeviceId ? "selected" : ""}
        >
          ${escapeHtml(device.name || device.id)}
        </option>
      `)
      .join("");

    const availableActions =
      automationDeviceActions.get(selectedDeviceId) || [];

    fields = `
      <label>
        ${escapeHtml(t("automations.actionDevice"))}
        <select data-action-field="device_id">
          <option value=""></option>
          ${deviceOptions}
        </select>
      </label>

      <label>
        ${escapeHtml(t("automations.deviceAction"))}
        <select data-device-action-choice>
          <option value=""></option>

          ${availableActions
            .map((availableAction, actionIndex) => {
              const selected =
                availableAction.type === action.type &&
                availableAction.domain === action.domain &&
                availableAction.entity_id === action.entity_id;

              const registryEntity = automationEntities.find(
                (entity) =>
                  entity.registry_id === availableAction.entity_id
              );

              const entityName =
                registryEntity?.name ||
                registryEntity?.original_name ||
                registryEntity?.entity_id ||
                availableAction.domain ||
                availableAction.entity_id ||
                "";

              const label = String(
                availableAction.type || ""
              ).replaceAll("_", " ");

              return `
                <option
                  value="${actionIndex}"
                  ${selected ? "selected" : ""}
                >
                  ${escapeHtml(entityName)} — ${escapeHtml(label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  } else if (type === "delay") {
    const delay = action.delay;

    const hours =
      typeof delay === "object"
        ? delay?.hours ?? 0
        : 0;

    const minutes =
      typeof delay === "object"
        ? delay?.minutes ?? 0
        : 0;

    const seconds =
      typeof delay === "object"
        ? delay?.seconds ?? 0
        : delay ?? 0;

    fields = `
      <label>
        ${escapeHtml(t("automations.hours"))}
        <input
          type="number"
          min="0"
          data-action-delay-field="hours"
          value="${escapeHtml(hours)}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.minutes"))}
        <input
          type="number"
          min="0"
          data-action-delay-field="minutes"
          value="${escapeHtml(minutes)}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.seconds"))}
        <input
          type="number"
          min="0"
          step="any"
          data-action-delay-field="seconds"
          value="${escapeHtml(seconds)}"
        >
      </label>
    `;
  } else if (type === "wait_template") {
    fields = `
      <label>
        ${escapeHtml(t("automations.conditionTemplate"))}
        <textarea
          data-action-field="wait_template"
          rows="5"
          placeholder="{{ ... }}"
        >${escapeHtml(action.wait_template || "")}</textarea>
      </label>

      <label>
        Timeout
        <input
          type="text"
          data-action-field="timeout"
          value="${escapeHtml(action.timeout || "")}"
          placeholder="00:05:00"
        >
      </label>
    `;
  } else if (type === "variables") {
    fields = `
      <div class="automation-editor-section">
        <h4>📦 ${escapeHtml(t("automations.actionVariables"))}</h4>

        <p>
          ${escapeHtml(t("automations.variableDescription"))}
        </p>

        <div class="automation-variable-list">
          ${renderAutomationVariableRows(
            action.variables,
            actionPath
          )}
        </div>

        <button
          type="button"
          class="automation-editor-secondary"
          data-action-variable-add="${escapeHtml(actionPath)}"
        >
          + ${escapeHtml(t("automations.variableAdd"))}
        </button>
      </div>
    `;
  } else if (type === "event") {
    fields = `
      <label>
        ${escapeHtml(t("automations.actionEvent"))}
        <input
          type="text"
          data-action-field="event"
          value="${escapeHtml(action.event || "")}"
          placeholder="${escapeHtml(t("automations.exampleEvent"))}"
        >
      </label>

      <label>
        ${escapeHtml(t("automations.eventDataJson"))}
        <textarea
          data-action-json-field="event_data"
          rows="5"
        >${escapeHtml(
          action.event_data
            ? JSON.stringify(action.event_data, null, 2)
            : ""
        )}</textarea>
      </label>
    `;
  } else if (type === "stop") {
    fields = `
      <label>
        ${escapeHtml(t("automations.stopMessage"))}
        <input
          type="text"
          data-action-field="stop"
          value="${escapeHtml(action.stop || "")}"
          placeholder="${escapeHtml(t("automations.stopPlaceholder"))}"
        >
      </label>

      <label>
        <input
          type="checkbox"
          data-action-field="error"
          ${action.error === true ? "checked" : ""}
        >
        ${escapeHtml(t("automations.stopError"))}
      </label>
    `;
  } else if (type === "condition") {
    fields = `
      <p>
        ${escapeHtml(t("automations.conditionActionDescription"))}
      </p>

      <div class="automation-editor-section">
        ${renderAutomationCondition(
          action,
          index,
          `action-condition.${actionPath}`,
          config
        )}
      </div>
    `;
  } else if (type === "wait_for_trigger") {
    const waitTriggers = Array.isArray(action.wait_for_trigger)
      ? action.wait_for_trigger
      : [];

    fields = `
      <div class="automation-editor-section">
        <h4>⏳ ${escapeHtml(t("automations.actionWaitForTrigger"))}</h4>

        <p>
          ${escapeHtml(t("automations.waitTriggerDescription"))}
        </p>

        <div class="automation-trigger-list">
          ${
            renderAutomationTriggers(
              waitTriggers,
              `actions.${actionPath}.wait_for_trigger`
            ) ||
            `<p>${escapeHtml(t("automations.waitTriggerEmpty"))}</p>`
          }
        </div>

        <div class="automation-trigger-add">
          <select
            data-wait-trigger-new-type
            data-wait-trigger-parent="${escapeHtml(actionPath)}"
          >
            <option value="state">${escapeHtml(t("automations.triggerState"))}</option>
            <option value="time">${escapeHtml(t("automations.triggerTime"))}</option>
            <option value="device">${escapeHtml(t("automations.triggerDevice"))}</option>
            <option value="time_pattern">${escapeHtml(t("automations.triggerTimePattern"))}</option>
            <option value="homeassistant">${escapeHtml(t("automations.triggerHomeAssistant"))}</option>
            <option value="event">${escapeHtml(t("automations.triggerEvent"))}</option>
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-wait-trigger-add="${escapeHtml(actionPath)}"
          >
            + ${escapeHtml(t("automations.triggerAddConfirm"))}
          </button>
        </div>

        <label>
          Timeout
          <input
            type="text"
            data-action-field="timeout"
            value="${escapeHtml(action.timeout || "")}"
            placeholder="00:05:00"
          >
        </label>

        <label>
          <input
            type="checkbox"
            data-action-field="continue_on_timeout"
            ${action.continue_on_timeout !== false ? "checked" : ""}
          >
          ${escapeHtml(t("automations.waitContinueOnTimeout"))}
        </label>
      </div>
    `;
  } else if (type === "if") {
    const ifConditions = Array.isArray(action.if)
      ? action.if
      : [];

    const thenActions = Array.isArray(action.then)
      ? action.then
      : [];

    const elseActions = Array.isArray(action.else)
      ? action.else
      : [];

    fields = `
      <div class="automation-editor-section">
        <h4>🔎 ${escapeHtml(t("automations.ifWhen"))}</h4>
        <p>${escapeHtml(t("automations.ifConditionsRequired"))}</p>

        <div class="automation-condition-list">
          ${
            renderAutomationConditions(
              ifConditions,
              config,
              `actions.${actionPath}.if`
            ) ||
            `<p>${escapeHtml(t("automations.noCondition"))}</p>`
          }
        </div>

        <div class="automation-condition-add">
          <select
            data-action-condition-new-type
            data-action-condition-parent="${escapeHtml(actionPath)}"
          >
            ${renderAutomationConditionTypeOptions("state")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-action-condition-add="${escapeHtml(actionPath)}"
          >
            + ${escapeHtml(t("automations.actionCondition"))}
          </button>
        </div>
      </div>

      <div class="automation-editor-section">
        <h4>▶️ ${escapeHtml(t("automations.ifThen"))}</h4>
        <p>
          ${escapeHtml(t("automations.ifThenDescription"))}
        </p>

        <div class="automation-action-list">
          ${
            renderAutomationActions(
              thenActions,
              config,
              `${actionPath}.then`
            ) ||
            `<p>${escapeHtml(t("automations.noAction"))}</p>`
          }
        </div>

        <div class="automation-action-add">
          <select
            data-action-child-new-type
            data-action-child-parent="${escapeHtml(actionPath)}.then"
          >
            ${renderAutomationActionTypeOptions("service")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-action-child-add="${escapeHtml(actionPath)}.then"
          >
            + ${escapeHtml(t("automations.addAction"))}
          </button>
        </div>
      </div>

      <div class="automation-editor-section">
        <h4>↪️ ${escapeHtml(t("automations.ifElse"))}</h4>
        <p>
          ${escapeHtml(t("automations.ifElseDescription"))}
        </p>

        <div class="automation-action-list">
          ${
            renderAutomationActions(
              elseActions,
              config,
              `${actionPath}.else`
            ) ||
            `<p>${escapeHtml(t("automations.noAction"))}</p>`
          }
        </div>

        <div class="automation-action-add">
          <select
            data-action-child-new-type
            data-action-child-parent="${escapeHtml(actionPath)}.else"
          >
            ${renderAutomationActionTypeOptions("service")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-action-child-add="${escapeHtml(actionPath)}.else"
          >
            + ${escapeHtml(t("automations.addAction"))}
          </button>
        </div>
      </div>
    `;
  } else if (type === "choose") {
    const choices = Array.isArray(action.choose)
      ? action.choose
      : [];

    const defaultActions = Array.isArray(action.default)
      ? action.default
      : [];

    const choiceHtml = choices
      .map((choice, choiceIndex) => {
        const choicePath =
          `${actionPath}.choose.${choiceIndex}`;

        const conditions =
          Array.isArray(choice?.conditions)
            ? choice.conditions
            : [];

        const sequence =
          Array.isArray(choice?.sequence)
            ? choice.sequence
            : [];

        return `
          <div
            class="automation-editor-section"
            data-choice-path="${escapeHtml(choicePath)}"
          >
            <div class="automation-trigger-header">
              <h4>🔀 ${escapeHtml(t("automations.chooseOption"))} ${choiceIndex + 1}</h4>

              <button
                type="button"
                class="automation-editor-secondary"
                data-choice-remove="${escapeHtml(choicePath)}"
              >
                ${escapeHtml(t("automations.chooseRemoveOption"))}
              </button>
            </div>

            <h4>🔎 ${escapeHtml(t("automations.conditions"))}</h4>

            <div class="automation-condition-list">
              ${
                renderAutomationConditions(
                  conditions,
                  config,
                  `actions.${choicePath}.conditions`
                ) ||
                `<p>${escapeHtml(t("automations.noCondition"))}</p>`
              }
            </div>

            <div class="automation-condition-add">
              <select
                data-choice-condition-new-type
                data-choice-condition-parent="${escapeHtml(choicePath)}"
              >
                ${renderAutomationConditionTypeOptions("state")}
              </select>

              <button
                type="button"
                class="automation-editor-secondary"
                data-choice-condition-add="${escapeHtml(choicePath)}"
              >
                + ${escapeHtml(t("automations.actionCondition"))}
              </button>
            </div>

            <h4>▶️ ${escapeHtml(t("automations.actions"))}</h4>

            <div class="automation-action-list">
              ${
                renderAutomationActions(
                  sequence,
                  config,
                  `${choicePath}.sequence`
                ) ||
                `<p>${escapeHtml(t("automations.noAction"))}</p>`
              }
            </div>

            <div class="automation-action-add">
              <select
                data-choice-action-new-type
                data-choice-action-parent="${escapeHtml(choicePath)}"
              >
                ${renderAutomationActionTypeOptions("service")}
              </select>

              <button
                type="button"
                class="automation-editor-secondary"
                data-choice-action-add="${escapeHtml(choicePath)}"
              >
                + ${escapeHtml(t("automations.addAction"))}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    fields = `
      <div class="automation-editor-section">
        <h4>🔀 ${escapeHtml(t("automations.actionChoose"))}</h4>
        <p>
          ${escapeHtml(t("automations.chooseDescription"))}
        </p>

        ${
          choiceHtml ||
          `<p>${escapeHtml(t("automations.chooseNoOption"))}</p>`
        }

        <button
          type="button"
          class="automation-editor-secondary"
          data-choice-add="${escapeHtml(actionPath)}"
        >
          + ${escapeHtml(t("automations.chooseOption"))}
        </button>
      </div>

      <div class="automation-editor-section">
        <h4>↪️ ${escapeHtml(t("automations.chooseDefault"))}</h4>
        <p>
          ${escapeHtml(t("automations.chooseDefaultDescription"))}
        </p>

        <div class="automation-action-list">
          ${
            renderAutomationActions(
              defaultActions,
              config,
              `${actionPath}.default`
            ) ||
            `<p>${escapeHtml(t("automations.chooseNoDefaultAction"))}</p>`
          }
        </div>

        <div class="automation-action-add">
          <select
            data-choice-default-new-type
            data-choice-default-parent="${escapeHtml(actionPath)}"
          >
            ${renderAutomationActionTypeOptions("service")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-choice-default-add="${escapeHtml(actionPath)}"
          >
            + ${escapeHtml(t("automations.chooseAddDefaultAction"))}
          </button>
        </div>
      </div>
    `;

  } else if (type === "repeat") {
    const repeat = action.repeat || {};
    const repeatType = automationRepeatType(action);
    const sequence = Array.isArray(repeat.sequence)
      ? repeat.sequence
      : [];

    fields = `
      <p>
        <strong>${escapeHtml(t("automations.actionRepeat"))}</strong>
      </p>

      <label>
        ${escapeHtml(t("automations.repeatType"))}
        <select data-repeat-type>
          <option value="count"${repeatType === "count" ? " selected" : ""}>
            ${escapeHtml(t("automations.repeatCount"))}
          </option>
          <option value="while"${repeatType === "while" ? " selected" : ""}>
            ${escapeHtml(t("automations.repeatWhile"))}
          </option>
          <option value="until"${repeatType === "until" ? " selected" : ""}>
            ${escapeHtml(t("automations.repeatUntil"))}
          </option>
          <option value="for_each"${repeatType === "for_each" ? " selected" : ""}>
            ${escapeHtml(t("automations.repeatForEach"))}
          </option>
        </select>
      </label>

      ${
        repeatType === "count"
          ? `
            <label>
              ${escapeHtml(t("automations.repeatCount"))}
              <input
                type="number"
                min="1"
                step="1"
                data-repeat-field="count"
                value="${escapeHtml(repeat.count ?? 1)}"
              >
            </label>
          `
          : ""
      }

      ${
        repeatType === "while" || repeatType === "until"
          ? `
            <div class="automation-condition-section">
              <strong>
                ${escapeHtml(
                  repeatType === "while"
                    ? t("automations.repeatWhileConditions")
                    : t("automations.repeatUntilConditions")
                )}
              </strong>

              <div class="automation-condition-list">
                ${
                  renderAutomationConditions(
                    Array.isArray(repeat[repeatType])
                      ? repeat[repeatType]
                      : [],
                    config,
                    `${actionPath}.repeat.${repeatType}`
                  ) ||
                  `<p>${escapeHtml(t("automations.noCondition"))}</p>`
                }
              </div>

              <div class="automation-condition-add">
                <select
                  data-repeat-condition-new-type
                  data-repeat-condition-parent="${escapeHtml(actionPath)}"
                  data-repeat-condition-mode="${escapeHtml(repeatType)}"
                >
                  ${renderAutomationConditionTypeOptions("state")}
                </select>

                <button
                  type="button"
                  class="automation-editor-secondary"
                  data-repeat-condition-add="${escapeHtml(actionPath)}"
                  data-repeat-condition-mode="${escapeHtml(repeatType)}"
                >
                  + ${escapeHtml(t("automations.repeatAddCondition"))}
                </button>
              </div>
            </div>
          `
          : ""
      }

      ${
        repeatType === "for_each"
          ? `
            <label>
              ${escapeHtml(t("automations.repeatForEachValue"))}
              <input
                type="text"
                data-repeat-field="for_each"
                value="${escapeHtml(repeat.for_each ?? "")}"
                placeholder="${escapeHtml(t("automations.exampleForEach"))}"
              >
            </label>
          `
          : ""
      }

      <div class="automation-nested-actions">
        <strong>${escapeHtml(t("automations.repeatSequence"))}</strong>

        ${
          renderAutomationActions(
            sequence,
            config,
            `${actionPath}.repeat.sequence`
          ) ||
          `<p>${escapeHtml(t("automations.repeatNoActions"))}</p>`
        }

        <div class="automation-action-add">
          <select
            data-repeat-action-new-type
            data-repeat-action-parent="${escapeHtml(actionPath)}"
          >
            ${renderAutomationActionTypeOptions("service")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-repeat-action-add="${escapeHtml(actionPath)}"
          >
            + ${escapeHtml(t("automations.repeatAddAction"))}
          </button>
        </div>
      </div>
    `;

  } else if (type === "parallel") {
    const parallelActions = Array.isArray(action.parallel)
      ? action.parallel
      : [];

    fields = `
      <p>
        <strong>${escapeHtml(t("automations.actionParallel"))}</strong>
        ${escapeHtml(t("automations.parallelDescription"))}
      </p>

      <div class="automation-nested-actions">
        <strong>${escapeHtml(t("automations.parallelActions"))}</strong>

        ${
          renderAutomationActions(
            parallelActions,
            config,
            `${actionPath}.parallel`
          ) ||
          `<p>${escapeHtml(t("automations.parallelNoActions"))}</p>`
        }

        <div class="automation-action-add">
          <select
            data-parallel-action-new-type
            data-parallel-action-parent="${escapeHtml(actionPath)}"
          >
            ${renderAutomationActionTypeOptions("service")}
          </select>

          <button
            type="button"
            class="automation-editor-secondary"
            data-parallel-action-add="${escapeHtml(actionPath)}"
          >
            + ${escapeHtml(t("automations.parallelAddAction"))}
          </button>
        </div>
      </div>
    `;
  } else {
    fields = `
      <p>
        ${escapeHtml(t("automations.actionUnsupported"))}
      </p>

      <label>
        ${escapeHtml(t("automations.actionJson"))}
        <textarea
          data-action-whole-json
          rows="10"
        >${escapeHtml(JSON.stringify(action, null, 2))}</textarea>
      </label>
    `;
  }

  const actionDepth =
    String(actionPath)
      .split(".")
      .filter((part) => /^\\d+$/.test(part))
      .length;

  return `
    <article
      class="automation-trigger-card automation-action-card"
      data-action-index="${index}"
      data-action-path="${escapeHtml(actionPath)}"
      data-action-depth="${actionDepth}"
    >
      <div class="automation-trigger-header">
        <strong>
          ${escapeHtml(automationActionTypeLabel(type))}
        </strong>

        <button
          type="button"
          class="automation-editor-secondary"
          data-action-remove-path="${escapeHtml(actionPath)}"
        >
          ${escapeHtml(t("automations.triggerRemove"))}
        </button>
      </div>

      <div class="automation-trigger-fields">
        ${fields}
      </div>
    </article>
  `;
}


export function renderAutomationActions(
  actions,
  config = null,
  pathPrefix = null
) {
  const items = Array.isArray(actions)
    ? actions
    : [];

  return items
    .map((action, index) => {
      const path =
        pathPrefix === null
          ? String(index)
          : `${pathPrefix}.${index}`;

      return renderAutomationAction(
        action,
        index,
        path,
        config
      );
    })
    .join("");
}


function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function normalizeLabels(response) {
  return Array.isArray(response?.labels)
    ? response.labels
    : [];
}

export async function renderAutomations() {
  const content = document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>⚡ ${escapeHtml(t("navigation.automations"))}</h2>
      <p id="automationsStatus">${escapeHtml(t("common.loading"))}</p>
      <button
        type="button"
        id="automationCreateButton"
      >
        ➕ ${escapeHtml(t("automations.create"))}
      </button>
    </section>
  `;

  try {
    const [automationResponse, labelResponse, entityResponse, stateResponse, deviceResponse] = await Promise.all([
      loadHomeAssistantAutomations(),
      loadHomeAssistantLabels(),
      loadHomeAssistantEntityRegistry(),
      loadHomeAssistantEntities(),
      loadHomeAssistantDevices()
    ]);

    const automations = Array.isArray(automationResponse?.automations)
      ? automationResponse.automations
      : [];

    automationEntities = (Array.isArray(entityResponse?.entities) ? entityResponse.entities : [])
      .filter((entity) => entity?.entity_id)
      .sort((a, b) =>
        String(a.name || a.original_name || a.entity_id).localeCompare(
          String(b.name || b.original_name || b.entity_id),
          undefined,
          { sensitivity: "base" }
        )
      );

    automationDevices = (Array.isArray(deviceResponse?.devices) ? deviceResponse.devices : [])
      .filter((device) => device?.id)
      .sort((a, b) =>
        String(a.name || a.id).localeCompare(
          String(b.name || b.id),
          undefined,
          { sensitivity: "base" }
        )
      );

    automationEntityStates = new Map(
      (Array.isArray(stateResponse?.entities) ? stateResponse.entities : [])
        .filter((entity) => entity?.entity_id)
        .map((entity) => [
          entity.entity_id,
          {
            state: entity.state || "",
            domain:
              entity.domain ||
              String(entity.entity_id).split(".", 1)[0],
            options: Array.isArray(entity.options)
              ? entity.options
              : []
          }
        ])
    );

    const labels = normalizeLabels(labelResponse);
    const labelNames = new Map(
      labels.map((label) => [
        label.label_id,
        label.name || label.label_id
      ])
    );

    const automationMap = new Map(
      automations.map((automation) => [
        automation.entity_id,
        automation
      ])
    );

    const status = content.querySelector("#automationsStatus");

    const style = document.createElement("style");
    style.textContent = `
      #automationsFilters {
        display:grid;
        grid-template-columns:2fr 1fr 1fr;
        gap:.65rem;
        margin-bottom:.65rem
      }
      #automationsFilters input,
      #automationsFilters select,
      #automationBulkActions button {
        width:100%;
        padding:.7rem;
        border-radius:.55rem
      }
      #automationBulkActions {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:.65rem;
        margin-bottom:.75rem
      }
      #automationsList {
        display:grid;
        gap:.65rem
      }
      #automationsList .phoenix-automation-card {
        margin:0;
        padding:.8rem 1rem
      }
      .automation-title {
        display:flex;
        align-items:center;
        gap:.7rem
      }
      .automation-title h3 {
        margin:0;
        font-size:1.1rem
      }
      #automationsList p {
        margin:.25rem 0;
        line-height:1.3
      }
      #automationConfigEditor {
        margin:0 0 1rem 0;
        padding:1rem 1rem 6rem 1rem
      }
      .automation-editor-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:1rem;
        margin-bottom:1rem
      }
      .automation-editor-header h3 {
        margin:0
      }
      .automation-editor-header button {
        min-width:2.5rem;
        font-size:1.3rem
      }
      #automationConfigEditor > label {
        display:grid;
        gap:.35rem;
        margin-bottom:.85rem;
        font-weight:600
      }
      #automationConfigEditor input,
      #automationConfigEditor textarea,
      #automationConfigEditor select {
        width:100%;
        box-sizing:border-box;
        padding:.7rem;
        border-radius:.55rem
      }
      #automationConfigEditor textarea {
        resize:vertical
      }
      .automation-editor-summary {
        display:grid;
        grid-template-columns:repeat(3, 1fr);
        gap:.65rem;
        margin:.85rem 0
      }
      .automation-editor-summary p {
        margin:0;
        padding:.7rem;
        border:1px solid #666;
        border-radius:.55rem;
        text-align:center
      }
      .automation-editor-actions {
        position:fixed;
        left:50%;
        bottom:1rem;
        transform:translateX(-50%);
        width:min(calc(100% - 2rem), 900px);
        box-sizing:border-box;
        z-index:1000;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:.65rem;
        margin:0;
        padding:.65rem;
        background:rgba(20,20,24,.96);
        border:1px solid #666;
        border-radius:.75rem;
        box-shadow:0 -4px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px)
      }
      .automation-editor-actions button {
        width:100%;
        padding:.7rem;
        border-radius:.55rem
      }
      .automation-trigger-section {
        margin:.85rem 0;
        padding:.8rem;
        border:1px solid #666;
        border-radius:.6rem
      }

      .automation-trigger-section-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:.65rem;
        margin-bottom:.7rem
      }

      .automation-trigger-section-header button {
        padding:.55rem .75rem;
        border-radius:.55rem
      }

      .automation-trigger-add-panel {
        padding:.75rem;
        margin-bottom:.75rem;
        border:1px dashed #777;
        border-radius:.55rem
      }

      .automation-trigger-add-panel label,
      .automation-trigger-fields label {
        display:flex;
        flex-direction:column;
        gap:.35rem;
        margin-bottom:.65rem
      }

      .automation-trigger-add-panel input,
      .automation-trigger-add-panel select,
      .automation-trigger-fields input,
      .automation-trigger-fields select,
      .automation-trigger-fields textarea {
        width:100%;
        box-sizing:border-box;
        padding:.65rem;
        border-radius:.5rem
      }

      .automation-trigger-add-actions {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:.5rem
      }

      .automation-trigger-add-actions button {
        padding:.65rem;
        border-radius:.5rem
      }

      .automation-trigger-list,
      .automation-condition-list {
        display:grid;
        gap:.65rem
      }

      .automation-trigger-card,
      .automation-condition-card {
        padding:.75rem;
        border:1px solid #666;
        border-radius:.55rem
      }

      .automation-condition-card {
        border-left:4px solid #d6a323
      }

      .automation-action-card {
        position:relative;
        border-left-width:5px;
        transition:
          border-color .15s ease,
          background .15s ease
      }

      .automation-action-card[data-action-depth="1"] {
        border-left-color:#4f9cff;
        background:rgba(79,156,255,.06)
      }

      .automation-action-card[data-action-depth="2"] {
        border-left-color:#55c98b;
        background:rgba(85,201,139,.07)
      }

      .automation-action-card[data-action-depth="3"] {
        border-left-color:#c58cff;
        background:rgba(197,140,255,.07)
      }

      .automation-action-card[data-action-depth="4"] {
        border-left-color:#e7a94b;
        background:rgba(231,169,75,.07)
      }

      .automation-action-card[data-action-depth="5"],
      .automation-action-card[data-action-depth="6"] {
        border-left-color:#df6f8f;
        background:rgba(223,111,143,.07)
      }

      .automation-editor-section {
        margin-top:1rem;
        padding:1rem;
        border:1px solid #555;
        border-radius:.75rem
      }

      .automation-editor-section-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:1rem;
        margin-bottom:.85rem
      }

      .automation-editor-section-header h4 {
        margin:0 0 .2rem 0
      }

      .automation-editor-section-header small {
        opacity:.75
      }

      .automation-condition-time {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:.65rem
      }

      .automation-condition-weekdays {
        margin-top:.65rem
      }

      .automation-weekday-list {
        display:flex;
        flex-wrap:wrap;
        gap:.4rem;
        margin-top:.45rem
      }

      .automation-weekday-chip {
        position:relative;
        cursor:pointer
      }

      .automation-weekday-chip input {
        position:absolute;
        opacity:0;
        pointer-events:none
      }

      .automation-weekday-chip span {
        display:flex;
        align-items:center;
        justify-content:center;
        min-width:2.35rem;
        padding:.45rem .55rem;
        border:1px solid #666;
        border-radius:999px;
        font-weight:600;
        transition:.15s ease
      }

      .automation-weekday-chip input:checked + span {
        border-color:#d6a323;
        box-shadow:inset 0 0 0 1px #d6a323
      }

      .automation-condition-card textarea {
        width:100%;
        box-sizing:border-box;
        resize:vertical;
        font-family:monospace
      }

      .automation-trigger-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:.65rem;
        margin-bottom:.7rem
      }

      .automation-trigger-header button {
        padding:.45rem .65rem;
        border-radius:.5rem
      }

      .automation-trigger-fields {
        display:grid;
        gap:.1rem
      }

      @media (max-width:700px) {
        .automation-editor-summary {
          grid-template-columns:1fr
        }
        .automation-editor-actions {
          width:calc(100% - 1rem);
          bottom:.5rem;
          padding:.5rem;
          gap:.45rem
        }

        .automation-editor-section-header {
          align-items:stretch;
          flex-direction:column
        }

        .automation-editor-section-header > .automation-editor-secondary {
          width:100%;
          max-width:100%;
          box-sizing:border-box
        }

        .automation-condition-time {
          grid-template-columns:1fr
        }
      }

      .automation-category-editor {
        margin-top:.75rem;
        padding:.75rem;
        border:1px solid #666;
        border-radius:.6rem;
        max-height:320px;
        overflow-y:auto
      }
      .automation-category-editor label {
        display:flex;
        align-items:center;
        gap:.7rem;
        padding:.45rem
      }
      .automation-category-buttons {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:.5rem;
        margin-top:.65rem
      }
      @media (max-width:700px) {
        #automationsFilters,
        #automationBulkActions,
        .automation-category-buttons {
          grid-template-columns:1fr
        }
      }
    `;
    content.appendChild(style);

    const filters = document.createElement("div");
    filters.id = "automationsFilters";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("automations.search");

    const stateFilter = document.createElement("select");
    stateFilter.innerHTML = `
      <option value="">${escapeHtml(t("automations.allStates"))}</option>
      <option value="on">${escapeHtml(t("automations.active"))}</option>
      <option value="off">${escapeHtml(t("automations.inactive"))}</option>
    `;

    const labelFilter = document.createElement("select");
    labelFilter.innerHTML =
      `<option value="">${escapeHtml(t("automations.allCategories"))}</option>` +
      labels.map((label) =>
        `<option value="${escapeHtml(label.label_id)}">${escapeHtml(label.name || label.label_id)}</option>`
      ).join("");

    filters.append(search, stateFilter, labelFilter);

    const bulkActions = document.createElement("div");
    bulkActions.id = "automationBulkActions";

    const selectVisible = document.createElement("button");
    selectVisible.type = "button";
    selectVisible.textContent = t("automations.selectVisible");

    const editCategories = document.createElement("button");
    editCategories.type = "button";
    editCategories.textContent = t("automations.categoriesForSelection");

    bulkActions.append(selectVisible, editCategories);

    const list = document.createElement("section");
    list.id = "automationsList";

    list.innerHTML = automations.map((automation) => {
      const ids = Array.isArray(automation.labels)
        ? automation.labels
        : [];

      const names = ids.map((id) =>
        labelNames.get(id) || id
      );

      return `
        <article
          class="card phoenix-automation-card"
          data-automation-id="${escapeHtml(automation.entity_id)}"
          data-automation-state="${escapeHtml(automation.state)}"
        >
          <div class="automation-title">
            <input
              type="checkbox"
              data-automation-select
              value="${escapeHtml(automation.entity_id)}"
            >
            <h3>${escapeHtml(automation.name || automation.entity_id)}</h3>
          </div>

          <p>${escapeHtml(t("automations.entityId"))}: <strong>${escapeHtml(automation.entity_id)}</strong></p>

          <p>
            ${escapeHtml(t("automations.status"))}:
            <strong>${automation.state === "on" ? escapeHtml(t("automations.active")) : automation.state === "off" ? escapeHtml(t("automations.inactive")) : escapeHtml(automation.state || "-")}</strong>
          </p>

          <p>${escapeHtml(t("automations.mode"))}: <strong>${escapeHtml(automation.mode || "-")}</strong></p>

          <p>
            ${escapeHtml(t("automations.lastRun"))}:
            <strong>${escapeHtml(formatDate(automation.last_triggered))}</strong>
          </p>

          <p>
            ${escapeHtml(t("automations.categories"))}:
            <strong>${escapeHtml(names.length ? names.join(", ") : "-")}</strong>
          </p>

          <div class="automation-actions">
            <button
              type="button"
              data-automation-action="trigger"
            >
              ▶ ${escapeHtml(t("automations.runNow"))}
            </button>

            <button
              type="button"
              data-automation-action="${automation.state === "on" ? "turn_off" : "turn_on"}"
            >
              ${automation.state === "on"
                ? "⏸ " + escapeHtml(t("automations.disable"))
                : "✓ " + escapeHtml(t("automations.enable"))}
            </button>

            <button
              type="button"
              data-automation-edit="${escapeHtml(automation.id || "")}"
              ${automation.id ? "" : "disabled"}
            >
              ✏️ ${escapeHtml(t("automations.edit"))}
            </button>

            <button
              type="button"
              data-automation-delete="${escapeHtml(automation.id || "")}"
              data-automation-name="${escapeHtml(automation.name || automation.entity_id)}"
              ${automation.id ? "" : "disabled"}
            >
              🗑 ${escapeHtml(t("automations.delete"))}
            </button>
          </div>
        </article>
      `;
    }).join("");

    const searchableText = new Map(
      automations.map((automation) => [
        automation.entity_id,
        `${automation.entity_id || ""} ${automation.name || ""} ${automation.mode || ""}`.toLowerCase()
      ])
    );

    const applyFilters = () => {
      const query = search.value.trim().toLowerCase();
      const state = stateFilter.value;
      const label = labelFilter.value;
      let visible = 0;

      list.querySelectorAll("[data-automation-id]").forEach((card) => {
        const id = card.dataset.automationId;
        const automation = automationMap.get(id);
        const automationLabels = Array.isArray(automation?.labels)
          ? automation.labels
          : [];

        const matches =
          (!query || searchableText.get(id)?.includes(query)) &&
          (!state || card.dataset.automationState === state) &&
          (!label || automationLabels.includes(label));

        card.style.display = matches ? "" : "none";

        if (matches) visible++;
      });

      if (status) {
        status.textContent =
          `${visible} / ${automations.length} ${t("navigation.automations")}`;
      }
    };

    function selectedIds() {
      return [...list.querySelectorAll("[data-automation-select]:checked")]
        .map((input) => input.value);
    }

    function openCategoryEditor(ids) {
      const existing = content.querySelector("#automationCategoryEditor");

      if (existing) {
        existing.remove();

        if (existing.dataset.selection === ids.slice().sort().join("|")) {
          return;
        }
      }

      if (!ids.length) {
        window.alert(t("automations.selectAutomation"));
        return;
      }

      const selectionKey = ids.slice().sort().join("|");
      const editor = document.createElement("section");
      editor.id = "automationCategoryEditor";
      editor.className = "card";
      editor.dataset.selection = selectionKey;

      const selectedAutomations = ids
        .map((id) => automationMap.get(id))
        .filter(Boolean);

      const commonLabels = new Set(
        selectedAutomations.length
          ? (selectedAutomations[0].labels || [])
          : []
      );

      for (const automation of selectedAutomations.slice(1)) {
        const current = new Set(automation.labels || []);
        [...commonLabels].forEach((labelId) => {
          if (!current.has(labelId)) {
            commonLabels.delete(labelId);
          }
        });
      }

      editor.innerHTML = `
        <div class="automation-category-header">
          <h3>${escapeHtml(t("automations.categories"))}</h3>
          <button
            type="button"
            data-category-close
            aria-label="×"
            title="×"
          >×</button>
        </div>

        <p>
          ${escapeHtml(
            ids.length === 1
              ? t("automations.selectedOne")
              : t("automations.selectedMany", { count: ids.length })
          )}
        </p>

        <div class="automation-category-management">
          <input
            type="text"
            data-new-category-name
            placeholder="${escapeHtml(t("automations.categoryName"))}"
          >
          <button type="button" data-category-create>
            ${escapeHtml(t("automations.createCategory"))}
          </button>
        </div>

        <div class="automation-category-delete">
          <select data-category-delete-select>
            <option value="">
              ${escapeHtml(t("automations.chooseCategoryDelete"))}
            </option>
            ${labels.map((label) => `
              <option value="${escapeHtml(label.label_id)}">
                ${escapeHtml(label.name || label.label_id)}
              </option>
            `).join("")}
          </select>

          <button type="button" data-category-delete>
            ${escapeHtml(t("automations.deleteCategory"))}
          </button>
        </div>

        <div class="automation-category-list">
          ${labels.length
            ? labels.map((label) => `
                <label>
                  <input
                    type="checkbox"
                    value="${escapeHtml(label.label_id)}"
                    ${commonLabels.has(label.label_id) ? "checked" : ""}
                  >
                  <span>${escapeHtml(label.name || label.label_id)}</span>
                </label>
              `).join("")
            : `<p>${escapeHtml(t("automations.allCategories"))}: 0</p>`
          }
        </div>

        <div class="automation-category-buttons">
          <button type="button" data-category-action="add">
            ${escapeHtml(t("automations.addCategories"))}
          </button>
          <button type="button" data-category-action="remove">
            ${escapeHtml(t("automations.removeCategories"))}
          </button>
        </div>
      `;

      bulkActions.after(editor);

      editor.querySelector("[data-category-close]")
        ?.addEventListener("click", () => editor.remove());

      editor.querySelector("[data-category-create]")
        ?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          const input = editor.querySelector("[data-new-category-name]");
          const name = input?.value.trim();

          if (!name) {
            input?.focus();
            return;
          }

          button.disabled = true;

          try {
            if (!window.confirm(
              t("labels.confirmCreate", { name })
            )) {
              button.disabled = false;
              return;
            }

            const result = await createLabel(
              name,
              true
            );

            if (result.status !== "ok") {
              window.alert(
                result.error || t("automations.createCategoryFailed")
              );
              button.disabled = false;
              return;
            }

            await renderAutomations();
          } catch (error) {
            window.alert(
              error?.message || t("automations.createCategoryFailed")
            );
            button.disabled = false;
          }
        });

      editor.querySelector("[data-category-delete]")
        ?.addEventListener("click", async (event) => {
          const button = event.currentTarget;
          const select = editor.querySelector(
            "[data-category-delete-select]"
          );
          const labelId = select?.value;

          if (!labelId) {
            select?.focus();
            return;
          }

          const label = labels.find(
            (item) => item.label_id === labelId
          );
          const name = label?.name || labelId;

          if (!window.confirm(
            t("automations.confirmDeleteCategory", { name })
          )) {
            return;
          }

          button.disabled = true;

          try {
            const result = await deleteLabel(labelId, true);

            if (result?.status === "blocked") {
              const dependencies = result.dependencies || {};

              window.alert(
                t("automations.deleteCategoryBlocked", {
                  areas: dependencies.areas || 0,
                  devices: dependencies.devices || 0,
                  entities: dependencies.entities || 0
                })
              );

              button.disabled = false;
              return;
            }

            if (result?.status !== "ok" && !result?.deleted) {
              throw new Error(
                result?.error || t("automations.deleteCategoryFailed")
              );
            }

            await renderAutomations();
          } catch (error) {
            window.alert(
              error?.message || t("automations.deleteCategoryFailed")
            );
            button.disabled = false;
          }
        });

      editor.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-category-action]");
        if (!button) return;

        const chosen = [
          ...editor.querySelectorAll(
            ".automation-category-list input:checked"
          )
        ].map((input) => input.value);

        if (!chosen.length) {
          window.alert(t("automations.selectCategory"));
          return;
        }

        button.disabled = true;

        try {
          for (const entityId of ids) {
            const automation = automationMap.get(entityId);
            const current = new Set(
              Array.isArray(automation?.labels)
                ? automation.labels
                : []
            );

            if (button.dataset.categoryAction === "add") {
              chosen.forEach((labelId) => current.add(labelId));
            } else {
              chosen.forEach((labelId) => current.delete(labelId));
            }

            await setEntityLabels(entityId, [...current]);
          }

          await renderAutomations();
        } catch (error) {
          window.alert(error?.message || String(error));
          button.disabled = false;
        }
      });
    }

    const automationCreateButton =
      content.querySelector("#automationCreateButton");

    const automationEditor = document.createElement("section");
    automationEditor.id = "automationConfigEditor";
    automationEditor.className = "card";
    automationEditor.hidden = true;


    let automationEditorConfig = null;
    let automationEditorId = null;
    let automationEditorIsNew = false;

function getAutomationTriggerByPath(path) {
  if (!automationEditorConfig) {
    return null;
  }

  const parts = String(path).split(".");

  if (!parts.length) {
    return null;
  }

  let current;

  if (parts[0] === "actions") {
    current = automationEditorConfig;
  } else {
    current = automationEditorConfig.triggers;
  }

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  return current || null;
}


function getAutomationTriggerParentByPath(path) {
  if (!automationEditorConfig) {
    return null;
  }

  const parts = String(path).split(".");

  if (!parts.length) {
    return null;
  }

  const last = parts.pop();
  let current;

  if (parts[0] === "actions") {
    current = automationEditorConfig;
  } else {
    current = automationEditorConfig.triggers;
  }

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !current[index]
      ) {
        return null;
      }

      current = current[index];
      continue;
    }

    if (
      !current ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      return null;
    }

    current = current[part];
  }

  const index = Number(last);

  if (
    !Array.isArray(current) ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return null;
  }

  return {
    triggers: current,
    index
  };
}



    function getAutomationActionByPath(path) {
      if (
        !automationEditorConfig ||
        !Array.isArray(automationEditorConfig.actions)
      ) {
        return null;
      }

      const parts = String(path).split(".");

      if (!parts.length) {
        return null;
      }

      let current = automationEditorConfig.actions;

      for (const part of parts) {
        if (Array.isArray(current)) {
          const index = Number(part);

          if (
            !Number.isInteger(index) ||
            index < 0 ||
            !current[index]
          ) {
            return null;
          }

          current = current[index];
          continue;
        }

        if (
          !current ||
          typeof current !== "object" ||
          !(part in current)
        ) {
          return null;
        }

        current = current[part];
      }

      return current || null;
    }

    function getAutomationActionParentByPath(path) {
      if (
        !automationEditorConfig ||
        !Array.isArray(automationEditorConfig.actions)
      ) {
        return null;
      }

      const parts = String(path).split(".");

      if (!parts.length) {
        return null;
      }

      const last = parts.pop();
      let current = automationEditorConfig.actions;

      for (const part of parts) {
        if (Array.isArray(current)) {
          const index = Number(part);

          if (
            !Number.isInteger(index) ||
            index < 0 ||
            !current[index]
          ) {
            return null;
          }

          current = current[index];
          continue;
        }

        if (
          !current ||
          typeof current !== "object" ||
          !(part in current)
        ) {
          return null;
        }

        current = current[part];
      }

      const index = Number(last);

      if (
        !Array.isArray(current) ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return null;
      }

      return {
        actions: current,
        index
      };
    }

    function getAutomationConditionRoot(path) {
      const value = String(path);

      if (!value.startsWith("actions.")) {
        return {
          conditions: automationEditorConfig?.conditions,
          parts: value.split(".")
        };
      }

      const parts = value.split(".");

      if (
        parts.length < 4 ||
        parts[0] !== "actions"
      ) {
        return null;
      }

      const actionIndex = Number(parts[1]);

      if (
        !Number.isInteger(actionIndex) ||
        actionIndex < 0 ||
        !Array.isArray(automationEditorConfig?.actions)
      ) {
        return null;
      }

      let current =
        automationEditorConfig.actions[actionIndex];

      let position = 2;

      while (position < parts.length) {
        const key = parts[position];

        if (
          key === "if" ||
          key === "conditions" ||
          key === "while" ||
          key === "until"
        ) {
          const conditionList = current?.[key];

          if (!Array.isArray(conditionList)) {
            return null;
          }

          return {
            conditions: conditionList,
            parts: parts.slice(position + 1)
          };
        }

        if (
          !current ||
          typeof current !== "object" ||
          !(key in current)
        ) {
          return null;
        }

        current = current[key];
        position += 1;
      }

      return null;
    }

    function getAutomationConditionByPath(path) {
      if (!automationEditorConfig) {
        return null;
      }

      const value = String(path);

      if (value.startsWith("action-condition.")) {
        const actionPath = value.slice(
          "action-condition.".length
        );

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          typeof action !== "object" ||
          automationActionType(action) !== "condition"
        ) {
          return null;
        }

        return action;
      }

      const root = getAutomationConditionRoot(path);

      if (
        !root ||
        !Array.isArray(root.conditions)
      ) {
        return null;
      }

      const parts = root.parts.map(
        (part) => Number(part)
      );

      if (
        parts.length === 0 ||
        parts.some(
          (part) =>
            !Number.isInteger(part) ||
            part < 0
        )
      ) {
        return null;
      }

      let conditions = root.conditions;
      let condition = null;

      for (
        let depth = 0;
        depth < parts.length;
        depth += 1
      ) {
        const index = parts[depth];

        if (
          !Array.isArray(conditions) ||
          !conditions[index]
        ) {
          return null;
        }

        condition = conditions[index];

        if (depth < parts.length - 1) {
          conditions = condition.conditions;
        }
      }

      return condition;
    }

    function getAutomationConditionParentByPath(path) {
      if (!automationEditorConfig) {
        return null;
      }

      const root = getAutomationConditionRoot(path);

      if (
        !root ||
        !Array.isArray(root.conditions)
      ) {
        return null;
      }

      const parts = root.parts.map(
        (part) => Number(part)
      );

      if (
        parts.length === 0 ||
        parts.some(
          (part) =>
            !Number.isInteger(part) ||
            part < 0
        )
      ) {
        return null;
      }

      const index = parts.pop();
      let conditions = root.conditions;

      for (const part of parts) {
        const parent = conditions?.[part];

        if (
          !parent ||
          !Array.isArray(parent.conditions)
        ) {
          return null;
        }

        conditions = parent.conditions;
      }

      return {
        conditions,
        index
      };
    }


    function closeAutomationEditor() {
      automationEditor.hidden = true;
      automationEditor.innerHTML = "";
      automationEditorConfig = null;
      automationEditorId = null;
      automationEditorIsNew = false;
    }

    function showAutomationEditor(config, automationId, isNew) {
      const wasVisible = !automationEditor.hidden;
      const previousScrollY = window.scrollY;

      automationEditorConfig = config;
      automationEditorId = automationId;
      automationEditorIsNew = isNew;

      automationEditor.innerHTML = `
        <div class="automation-editor-header">
          <h3>
            ${escapeHtml(
              isNew
                ? t("automations.create")
                : t("automations.edit")
            )}
          </h3>

          <button
            type="button"
            data-automation-editor-close
            aria-label="${escapeHtml(t("automations.close"))}"
          >
            ×
          </button>
        </div>

        <label>
          ${escapeHtml(t("automations.name"))}
          <input
            type="text"
            id="automationEditorAlias"
            value="${escapeHtml(config.alias || "")}"
          >
        </label>

        <label>
          ${escapeHtml(t("automations.description"))}
          <textarea
            id="automationEditorDescription"
            rows="3"
          >${escapeHtml(config.description || "")}</textarea>
        </label>

        <label>
          ${escapeHtml(t("automations.mode"))}
          <select id="automationEditorMode">
            ${["single", "restart", "queued", "parallel"]
              .map((mode) => `
                <option
                  value="${mode}"
                  ${config.mode === mode ? "selected" : ""}
                >
                  ${mode}
                </option>
              `)
              .join("")}
          </select>
        </label>

        <div class="automation-trigger-section">
            <div class="automation-trigger-section-header">
              <strong>
                ${escapeHtml(t("automations.triggers"))}
                (${Array.isArray(config.triggers)
                  ? config.triggers.length
                  : 0})
              </strong>

              <button
                type="button"
                data-trigger-add
              >
                ➕ ${escapeHtml(t("automations.triggerAdd"))}
              </button>
            </div>

            <div class="automation-trigger-add-panel" hidden>
              <label>
                ${escapeHtml(t("automations.triggerType"))}
                <select data-trigger-new-type>
                  <option value="state">${escapeHtml(t("automations.triggerState"))}</option>
                  <option value="time">${escapeHtml(t("automations.triggerTime"))}</option>
                  <option value="device">${escapeHtml(t("automations.triggerDevice"))}</option>
                  <option value="time_pattern">${escapeHtml(t("automations.triggerTimePattern"))}</option>
                  <option value="homeassistant">${escapeHtml(t("automations.triggerHomeAssistant"))}</option>
                  <option value="event">${escapeHtml(t("automations.triggerEvent"))}</option>
                </select>
              </label>

              <div class="automation-trigger-add-actions">
                <button
                  type="button"
                  data-trigger-add-confirm
                >
                  ${escapeHtml(t("automations.triggerAddConfirm"))}
                </button>

                <button
                  type="button"
                  data-trigger-add-cancel
                >
                  ${escapeHtml(t("automations.triggerAddCancel"))}
                </button>
              </div>
            </div>

            <div class="automation-trigger-list">
              ${renderAutomationTriggers(config.triggers)}
            </div>
        </div>

        <div class="automation-editor-section">
          <div class="automation-editor-section-header">
            <div>
              <h4>🧩 ${escapeHtml(t("automations.conditions"))}</h4>
              <small>
                ${escapeHtml(t("automations.conditionsDescription"))}
              </small>
            </div>

            <button
              type="button"
              class="automation-editor-secondary"
              data-condition-add
            >
              + ${escapeHtml(t("automations.actionCondition"))}
            </button>
          </div>

          <div class="automation-condition-list">
            ${renderAutomationConditions(config.conditions, config)}
          </div>
        </div>

        <div class="automation-editor-section">
          <div class="automation-editor-section-header">
            <div>
              <h4>▶️ ${escapeHtml(t("automations.actions"))}</h4>
              <small>
                ${escapeHtml(t("automations.actionsDescription"))}
              </small>
            </div>
          </div>

          <div class="automation-action-list">
            ${renderAutomationActions(config.actions, config)}
          </div>

          <div class="automation-trigger-add">
            <select data-action-new-type>
              ${renderAutomationActionTypeOptions("service")}
            </select>

            <button
              type="button"
              class="automation-editor-secondary"
              data-action-add
            >
              + ${escapeHtml(t("automations.addAction"))}
            </button>
          </div>
        </div>

        <div class="automation-editor-actions">
          <button
            type="button"
            data-automation-editor-save
          >
            💾 ${escapeHtml(t("automations.save"))}
          </button>

          <button
            type="button"
            data-automation-editor-close
          >
            ${escapeHtml(t("automations.cancel"))}
          </button>
        </div>
      `;

      automationEditor.hidden = false;

      if (wasVisible) {
        window.scrollTo({
          top: previousScrollY,
          behavior: "instant"
        });
      } else {
        automationEditor.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }

    automationCreateButton?.addEventListener("click", () => {
      const automationId =
        "dr_ronny_os_" + Date.now();

      showAutomationEditor(
        {
          id: automationId,
          alias: "",
          description: "",
          triggers: [],
          conditions: [],
          actions: [],
          mode: "single"
        },
        automationId,
        true
      );
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-automation-edit]");

      if (!button) {
        return;
      }

      const automationId = button.dataset.automationEdit;

      if (!automationId) {
        return;
      }

      button.disabled = true;

      try {
        const result =
          await loadAutomationConfig(automationId);

        if (
          result?.status !== "ok" ||
          !result?.config
        ) {
          throw new Error(
            t("automations.loadConfigFailed")
          );
        }

        const deviceIds = [
          ...new Set(
            (Array.isArray(result.config.triggers)
              ? result.config.triggers
              : [])
              .filter(
                (trigger) =>
                  automationTriggerType(trigger) === "device" &&
                  trigger?.device_id
              )
              .map((trigger) => trigger.device_id)
          )
        ];

        await Promise.all(
          deviceIds.map((deviceId) =>
            ensureDeviceAutomationTriggers(deviceId)
              .catch((error) => {
                console.error(
                  "Device automation triggers:",
                  error
                );
                return [];
              })
          )
        );

        const conditionDeviceIds = [
          ...new Set(
            (Array.isArray(result.config.conditions)
              ? result.config.conditions
              : [])
              .filter(
                (condition) =>
                  automationConditionType(condition) === "device" &&
                  condition?.device_id
              )
              .map((condition) => condition.device_id)
          )
        ];

        await Promise.all(
          conditionDeviceIds.map((deviceId) =>
            ensureDeviceAutomationConditions(deviceId)
              .catch((error) => {
                console.error(
                  "Device automation conditions:",
                  error
                );
                return [];
              })
          )
        );

        showAutomationEditor(
          result.config,
          automationId,
          false
        );
      } catch (error) {
        window.alert(
          error?.message ||
          t("automations.loadConfigFailed")
        );
      } finally {
        button.disabled = false;
      }
    });


    function syncAutomationEditorBaseFields() {
      if (!automationEditorConfig) return;

      const alias = automationEditor
        .querySelector("#automationEditorAlias")
        ?.value;

      const description = automationEditor
        .querySelector("#automationEditorDescription")
        ?.value;

      const mode = automationEditor
        .querySelector("#automationEditorMode")
        ?.value;

      if (alias !== undefined) {
        automationEditorConfig.alias = alias;
      }

      if (description !== undefined) {
        automationEditorConfig.description = description;
      }

      if (mode) {
        automationEditorConfig.mode = mode;
      }
    }

    automationEditor.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-trigger-add]");

      if (addButton) {
        const panel = automationEditor.querySelector(
          ".automation-trigger-add-panel"
        );

        if (panel) {
          panel.hidden = false;
        }

        return;
      }

      const cancelButton = event.target.closest(
        "[data-trigger-add-cancel]"
      );

      if (cancelButton) {
        const panel = automationEditor.querySelector(
          ".automation-trigger-add-panel"
        );

        if (panel) {
          panel.hidden = true;
        }

        return;
      }

      const confirmButton = event.target.closest(
        "[data-trigger-add-confirm]"
      );

      if (confirmButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const select = automationEditor.querySelector(
          "[data-trigger-new-type]"
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            trigger: "state",
            entity_id: []
          },
          time: {
            trigger: "time",
            at: "00:00:00"
          },
          device: {
            trigger: "device",
            type: "",
            device_id: "",
            entity_id: "",
            domain: ""
          },
          time_pattern: {
            trigger: "time_pattern",
            minutes: "/5"
          },
          homeassistant: {
            trigger: "homeassistant",
            event: "start"
          },
          event: {
            trigger: "event",
            event_type: "",
            event_data: {}
          }
        };

        if (!Array.isArray(automationEditorConfig.triggers)) {
          automationEditorConfig.triggers = [];
        }

        automationEditorConfig.triggers.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const variableAddButton = event.target.closest(
        "[data-action-variable-add]"
      );

      if (variableAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          variableAddButton.dataset.actionVariableAdd;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "variables"
        ) {
          return;
        }

        if (
          !action.variables ||
          typeof action.variables !== "object" ||
          Array.isArray(action.variables)
        ) {
          action.variables = {};
        }

        let number = 1;
        let name = "variable";

        while (
          Object.prototype.hasOwnProperty.call(
            action.variables,
            name
          )
        ) {
          number += 1;
          name = `variable_${number}`;
        }

        action.variables[name] = "";

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const variableRemoveButton = event.target.closest(
        "[data-action-variable-remove]"
      );

      if (variableRemoveButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          variableRemoveButton.dataset.actionVariableParent;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "variables" ||
          !action.variables ||
          typeof action.variables !== "object" ||
          Array.isArray(action.variables)
        ) {
          return;
        }

        const index = Number(
          variableRemoveButton.dataset.actionVariableRemove
        );

        const entries = Object.entries(action.variables);

        if (
          !Number.isInteger(index) ||
          index < 0 ||
          !entries[index]
        ) {
          return;
        }

        entries.splice(index, 1);
        action.variables = Object.fromEntries(entries);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const waitTriggerAddButton = event.target.closest(
        "[data-wait-trigger-add]"
      );

      if (waitTriggerAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          waitTriggerAddButton.dataset.waitTriggerAdd;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "wait_for_trigger"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-wait-trigger-new-type]` +
          `[data-wait-trigger-parent="${CSS.escape(actionPath)}"]`
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            trigger: "state",
            entity_id: []
          },
          time: {
            trigger: "time",
            at: "00:00:00"
          },
          device: {
            trigger: "device",
            type: "",
            device_id: "",
            entity_id: "",
            domain: ""
          },
          time_pattern: {
            trigger: "time_pattern",
            minutes: "/5"
          },
          homeassistant: {
            trigger: "homeassistant",
            event: "start"
          },
          event: {
            trigger: "event",
            event_type: "",
            event_data: {}
          }
        };

        if (!defaults[type]) {
          return;
        }

        if (!Array.isArray(action.wait_for_trigger)) {
          action.wait_for_trigger = [];
        }

        action.wait_for_trigger.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }


      const removeButton = event.target.closest(
        "[data-trigger-remove]"
      );

      if (removeButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const card = removeButton.closest(
          "[data-trigger-path]"
        );

        const triggerPath =
          card?.dataset.triggerPath ??
          removeButton.dataset.triggerRemove;

        const parent =
          getAutomationTriggerParentByPath(triggerPath);

        if (
          !parent ||
          !parent.triggers[parent.index]
        ) {
          return;
        }

        parent.triggers.splice(parent.index, 1);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const conditionAddButton = event.target.closest(
        "[data-condition-add]"
      );

      if (conditionAddButton) {
        let panel = automationEditor.querySelector(
          ".automation-condition-add-panel"
        );

        if (!panel) {
          panel = document.createElement("div");
          panel.className = "automation-condition-add-panel";
          panel.innerHTML = `
            <label>
              ${escapeHtml(t("automations.conditionType"))}
              <select data-condition-new-type>
                <option value="state">${escapeHtml(t("automations.triggerState"))}</option>
                <option value="numeric_state">${escapeHtml(t("automations.conditionNumericState"))}</option>
                <option value="time">${escapeHtml(t("automations.conditionTime"))}</option>
                <option value="sun">${escapeHtml(t("automations.conditionSun"))}</option>
                <option value="template">${escapeHtml(t("automations.conditionTemplate"))}</option>
                <option value="device">${escapeHtml(t("automations.triggerDevice"))}</option>
                <option value="trigger">${escapeHtml(t("automations.conditionTrigger"))}</option>
                <option value="and">${escapeHtml(t("automations.conditionAnd"))}</option>
                <option value="or">${escapeHtml(t("automations.conditionOr"))}</option>
                <option value="not">${escapeHtml(t("automations.conditionNot"))}</option>
              </select>
            </label>

            <div class="automation-editor-actions">
              <button
                type="button"
                data-condition-add-confirm
              >
                ${escapeHtml(t("automations.triggerAddConfirm"))}
              </button>

              <button
                type="button"
                class="automation-editor-secondary"
                data-condition-add-cancel
              >
                ${escapeHtml(t("automations.cancel"))}
              </button>
            </div>
          `;

          conditionAddButton
            .closest(".automation-editor-section")
            ?.appendChild(panel);
        }

        panel.hidden = false;
        return;
      }

      const conditionCancelButton = event.target.closest(
        "[data-condition-add-cancel]"
      );

      if (conditionCancelButton) {
        const panel = automationEditor.querySelector(
          ".automation-condition-add-panel"
        );

        if (panel) panel.hidden = true;
        return;
      }

      const conditionConfirmButton = event.target.closest(
        "[data-condition-add-confirm]"
      );

      if (conditionConfirmButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const select = automationEditor.querySelector(
          "[data-condition-new-type]"
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            condition: "state",
            entity_id: "",
            state: ""
          },
          numeric_state: {
            condition: "numeric_state",
            entity_id: ""
          },
          time: {
            condition: "time"
          },
          sun: {
            condition: "sun"
          },
          template: {
            condition: "template",
            value_template: ""
          },
          device: {
            condition: "device"
          },
          trigger: {
            condition: "trigger",
            id: ""
          },
          and: {
            condition: "and",
            conditions: []
          },
          or: {
            condition: "or",
            conditions: []
          },
          not: {
            condition: "not",
            conditions: []
          }
        };

        if (!Array.isArray(automationEditorConfig.conditions)) {
          automationEditorConfig.conditions = [];
        }

        automationEditorConfig.conditions.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const repeatConditionAddButton = event.target.closest(
        "[data-repeat-condition-add]"
      );

      if (repeatConditionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          repeatConditionAddButton.dataset.repeatConditionAdd;

        const mode =
          repeatConditionAddButton.dataset.repeatConditionMode;

        if (!["while", "until"].includes(mode)) {
          return;
        }

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "repeat"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-repeat-condition-new-type]` +
          `[data-repeat-condition-parent="${CSS.escape(actionPath)}"]` +
          `[data-repeat-condition-mode="${CSS.escape(mode)}"]`
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            condition: "state",
            entity_id: "",
            state: ""
          },
          numeric_state: {
            condition: "numeric_state",
            entity_id: ""
          },
          time: {
            condition: "time"
          },
          sun: {
            condition: "sun"
          },
          template: {
            condition: "template",
            value_template: ""
          },
          device: {
            condition: "device"
          },
          trigger: {
            condition: "trigger",
            id: ""
          },
          and: {
            condition: "and",
            conditions: []
          },
          or: {
            condition: "or",
            conditions: []
          },
          not: {
            condition: "not",
            conditions: []
          }
        };

        if (!defaults[type]) {
          return;
        }

        if (
          !action.repeat ||
          typeof action.repeat !== "object" ||
          Array.isArray(action.repeat)
        ) {
          action.repeat = {
            count: 1,
            sequence: []
          };
        }

        if (!Array.isArray(action.repeat[mode])) {
          action.repeat[mode] = [];
        }

        action.repeat[mode].push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const actionConditionAddButton = event.target.closest(
        "[data-action-condition-add]"
      );

      if (actionConditionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          actionConditionAddButton.dataset.actionConditionAdd;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "if"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-action-condition-new-type]` +
          `[data-action-condition-parent="${CSS.escape(actionPath)}"]`
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            condition: "state",
            entity_id: "",
            state: ""
          },
          numeric_state: {
            condition: "numeric_state",
            entity_id: ""
          },
          time: {
            condition: "time"
          },
          sun: {
            condition: "sun"
          },
          template: {
            condition: "template",
            value_template: ""
          },
          device: {
            condition: "device"
          },
          trigger: {
            condition: "trigger",
            id: ""
          },
          and: {
            condition: "and",
            conditions: []
          },
          or: {
            condition: "or",
            conditions: []
          },
          not: {
            condition: "not",
            conditions: []
          }
        };

        if (!defaults[type]) {
          return;
        }

        if (!Array.isArray(action.if)) {
          action.if = [];
        }

        action.if.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const conditionChildAddButton = event.target.closest(
        "[data-condition-child-add]"
      );

      if (conditionChildAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const parentPath =
          conditionChildAddButton.dataset.conditionChildAdd;

        const parentCondition =
          getAutomationConditionByPath(parentPath);

        if (
          !parentCondition ||
          !["and", "or", "not"].includes(
            automationConditionType(parentCondition)
          )
        ) {
          return;
        }

        if (!Array.isArray(parentCondition.conditions)) {
          parentCondition.conditions = [];
        }

        if (
          automationConditionType(parentCondition) === "not" &&
          parentCondition.conditions.length >= 1
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-condition-child-new-type]` +
          `[data-condition-parent-path="${CSS.escape(parentPath)}"]`
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            condition: "state",
            entity_id: "",
            state: ""
          },
          numeric_state: {
            condition: "numeric_state",
            entity_id: ""
          },
          time: {
            condition: "time"
          },
          sun: {
            condition: "sun"
          },
          template: {
            condition: "template",
            value_template: ""
          },
          device: {
            condition: "device"
          },
          trigger: {
            condition: "trigger",
            id: ""
          },
          and: {
            condition: "and",
            conditions: []
          },
          or: {
            condition: "or",
            conditions: []
          },
          not: {
            condition: "not",
            conditions: []
          }
        };

        if (!defaults[type]) {
          return;
        }

        parentCondition.conditions.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const conditionRemoveButton = event.target.closest(
        "[data-condition-remove]"
      );

      if (conditionRemoveButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const conditionPath =
          conditionRemoveButton.dataset.conditionRemovePath;

        if (!conditionPath) {
          return;
        }

        const parent =
          getAutomationConditionParentByPath(conditionPath);

        if (
          !parent ||
          !Array.isArray(parent.conditions) ||
          !parent.conditions[parent.index]
        ) {
          return;
        }

        parent.conditions.splice(parent.index, 1);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const choiceDefaultAddButton = event.target.closest(
        "[data-choice-default-add]"
      );

      if (choiceDefaultAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          choiceDefaultAddButton.dataset.choiceDefaultAdd;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "choose"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-choice-default-new-type]` +
          `[data-choice-default-parent="${CSS.escape(actionPath)}"]`
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (!Array.isArray(action.default)) {
          action.default = [];
        }

        action.default.push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const choiceActionAddButton = event.target.closest(
        "[data-choice-action-add]"
      );

      if (choiceActionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const choicePath =
          choiceActionAddButton.dataset.choiceActionAdd;

        const choice =
          getAutomationActionByPath(choicePath);

        if (
          !choice ||
          typeof choice !== "object" ||
          Array.isArray(choice)
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-choice-action-new-type]` +
          `[data-choice-action-parent="${CSS.escape(choicePath)}"]`
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (!Array.isArray(choice.sequence)) {
          choice.sequence = [];
        }

        choice.sequence.push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const choiceConditionAddButton = event.target.closest(
        "[data-choice-condition-add]"
      );

      if (choiceConditionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const choicePath =
          choiceConditionAddButton.dataset.choiceConditionAdd;

        const choice =
          getAutomationActionByPath(choicePath);

        if (
          !choice ||
          typeof choice !== "object" ||
          Array.isArray(choice)
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-choice-condition-new-type]` +
          `[data-choice-condition-parent="${CSS.escape(choicePath)}"]`
        );

        const type = select?.value || "state";

        const defaults = {
          state: {
            condition: "state",
            entity_id: "",
            state: ""
          },
          numeric_state: {
            condition: "numeric_state",
            entity_id: ""
          },
          time: {
            condition: "time"
          },
          sun: {
            condition: "sun"
          },
          template: {
            condition: "template",
            value_template: ""
          },
          device: {
            condition: "device"
          },
          trigger: {
            condition: "trigger",
            id: ""
          },
          and: {
            condition: "and",
            conditions: []
          },
          or: {
            condition: "or",
            conditions: []
          },
          not: {
            condition: "not",
            conditions: []
          }
        };

        if (!defaults[type]) {
          return;
        }

        if (!Array.isArray(choice.conditions)) {
          choice.conditions = [];
        }

        choice.conditions.push(
          structuredClone(defaults[type])
        );

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const choiceRemoveButton = event.target.closest(
        "[data-choice-remove]"
      );

      if (choiceRemoveButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const choicePath =
          choiceRemoveButton.dataset.choiceRemove;

        const parts = String(choicePath).split(".");
        const choiceIndex = Number(parts.pop());

        if (
          parts.pop() !== "choose" ||
          !Number.isInteger(choiceIndex) ||
          choiceIndex < 0
        ) {
          return;
        }

        const actionPath = parts.join(".");
        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "choose" ||
          !Array.isArray(action.choose) ||
          !action.choose[choiceIndex]
        ) {
          return;
        }

        action.choose.splice(choiceIndex, 1);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const choiceAddButton = event.target.closest(
        "[data-choice-add]"
      );

      if (choiceAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          choiceAddButton.dataset.choiceAdd;

        const action =
          getAutomationActionByPath(actionPath);

        if (
          !action ||
          automationActionType(action) !== "choose"
        ) {
          return;
        }

        if (!Array.isArray(action.choose)) {
          action.choose = [];
        }

        action.choose.push({
          conditions: [],
          sequence: []
        });

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const actionAddButton = event.target.closest(
        "[data-action-add]"
      );

      if (actionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const select = automationEditor.querySelector(
          "[data-action-new-type]"
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (!Array.isArray(automationEditorConfig.actions)) {
          automationEditorConfig.actions = [];
        }

        automationEditorConfig.actions.push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const actionChildAddButton = event.target.closest(
        "[data-action-child-add]"
      );

      if (actionChildAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const parentPath =
          actionChildAddButton.dataset.actionChildAdd;

        if (!parentPath) {
          return;
        }

        const parts = parentPath.split(".");
        const branch = parts.pop();

        if (!["then", "else"].includes(branch)) {
          return;
        }

        const actionPath = parts.join(".");
        const parentAction =
          getAutomationActionByPath(actionPath);

        if (
          !parentAction ||
          automationActionType(parentAction) !== "if"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-action-child-new-type]` +
          `[data-action-child-parent="${CSS.escape(parentPath)}"]`
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (!Array.isArray(parentAction[branch])) {
          parentAction[branch] = [];
        }

        parentAction[branch].push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const parallelActionAddButton = event.target.closest(
        "[data-parallel-action-add]"
      );

      if (parallelActionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          parallelActionAddButton.dataset.parallelActionAdd;

        const parentAction =
          getAutomationActionByPath(actionPath);

        if (
          !parentAction ||
          automationActionType(parentAction) !== "parallel"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-parallel-action-new-type]` +
          `[data-parallel-action-parent="${CSS.escape(actionPath)}"]`
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (!Array.isArray(parentAction.parallel)) {
          parentAction.parallel = [];
        }

        parentAction.parallel.push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const repeatActionAddButton = event.target.closest(
        "[data-repeat-action-add]"
      );

      if (repeatActionAddButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          repeatActionAddButton.dataset.repeatActionAdd;

        const parentAction =
          getAutomationActionByPath(actionPath);

        if (
          !parentAction ||
          automationActionType(parentAction) !== "repeat"
        ) {
          return;
        }

        const select = automationEditor.querySelector(
          `[data-repeat-action-new-type]` +
          `[data-repeat-action-parent="${CSS.escape(actionPath)}"]`
        );

        const type = select?.value || "service";
        const newAction = automationActionDefault(type);

        if (!newAction) {
          return;
        }

        if (
          !parentAction.repeat ||
          typeof parentAction.repeat !== "object" ||
          Array.isArray(parentAction.repeat)
        ) {
          parentAction.repeat = {
            count: 1,
            sequence: []
          };
        }

        if (!Array.isArray(parentAction.repeat.sequence)) {
          parentAction.repeat.sequence = [];
        }

        parentAction.repeat.sequence.push(newAction);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }

      const actionRemoveButton = event.target.closest(
        "[data-action-remove-path]"
      );

      if (actionRemoveButton) {
        if (!automationEditorConfig) return;

        syncAutomationEditorBaseFields();

        const actionPath =
          actionRemoveButton.dataset.actionRemovePath;

        const parent =
          getAutomationActionParentByPath(actionPath);

        if (
          !parent ||
          !Array.isArray(parent.actions) ||
          !parent.actions[parent.index]
        ) {
          return;
        }

        parent.actions.splice(parent.index, 1);

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );

        return;
      }
    });

    automationEditor.addEventListener("change", (event) => {
      const field = event.target.closest(
        "[data-device-trigger-choice]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-trigger-path]");

      if (!card) {
        return;
      }

      const triggerPath = card.dataset.triggerPath;
      const trigger = getAutomationTriggerByPath(triggerPath);

      if (!trigger || automationTriggerType(trigger) !== "device") {
        return;
      }

      const available =
        automationDeviceTriggers.get(trigger.device_id) || [];

      const choiceIndex = Number(field.value);

      if (
        !Number.isInteger(choiceIndex) ||
        !available[choiceIndex]
      ) {
        return;
      }

      const selected = structuredClone(
        available[choiceIndex]
      );

      delete selected.platform;
      delete selected.metadata;

      const parent =
        getAutomationTriggerParentByPath(triggerPath);

      if (!parent) {
        return;
      }

      parent.triggers[parent.index] = {
        ...selected,
        trigger: "device"
      };

      syncAutomationEditorBaseFields();

      showAutomationEditor(
        automationEditorConfig,
        automationEditorId,
        automationEditorIsNew
      );
    });

    automationEditor.addEventListener("change", (event) => {
      const field = event.target.closest(
        "[data-device-condition-choice]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-condition-path]");
      const conditionPath = card?.dataset.conditionPath;

      if (!conditionPath) {
        return;
      }

      const condition =
        getAutomationConditionByPath(conditionPath);

      if (
        !condition ||
        automationConditionType(condition) !== "device"
      ) {
        return;
      }

      const available =
        automationDeviceConditions.get(condition.device_id) || [];

      const choiceIndex = Number(field.value);

      if (
        !Number.isInteger(choiceIndex) ||
        !available[choiceIndex]
      ) {
        return;
      }

      const selected = structuredClone(
        available[choiceIndex]
      );

      delete selected.platform;
      delete selected.metadata;

      const parent =
        getAutomationConditionParentByPath(conditionPath);

      if (!parent || !Array.isArray(parent.conditions)) {
        return;
      }

      parent.conditions[parent.index] = {
        ...selected,
        condition: "device"
      };

      syncAutomationEditorBaseFields();

      showAutomationEditor(
        automationEditorConfig,
        automationEditorId,
        automationEditorIsNew
      );
    });

    automationEditor.addEventListener("change", (event) => {
      const field = event.target.closest(
        "[data-condition-weekday]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-condition-path]");
      const conditionPath = card?.dataset.conditionPath;

      if (!conditionPath) {
        return;
      }

      const condition =
        getAutomationConditionByPath(conditionPath);

      if (!condition) {
        return;
      }

      syncAutomationEditorBaseFields();

      const weekdays = [
        "mon", "tue", "wed", "thu",
        "fri", "sat", "sun"
      ];

      const selected = [
        ...card.querySelectorAll(
          "[data-condition-weekday]:checked"
        )
      ].map((item) => item.dataset.conditionWeekday);

      const ordered = weekdays.filter(
        (day) => selected.includes(day)
      );

      if (ordered.length) {
        condition.weekday = ordered;
      } else {
        delete condition.weekday;
      }
    });

    const updateAutomationConditionField = (event) => {
      const field = event.target.closest(
        "[data-condition-field]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-condition-path]");
      const conditionPath = card?.dataset.conditionPath;

      if (!conditionPath) {
        return;
      }

      const condition =
        getAutomationConditionByPath(conditionPath);

      if (!condition) {
        return;
      }

      syncAutomationEditorBaseFields();

      const name = field.dataset.conditionField;
      const value = field.value;

      if (
        value === "" &&
        ["after", "before", "state", "above", "below", "value_template"]
          .includes(name)
      ) {
        delete condition[name];
      } else {
        condition[name] = value;
      }

      if (
        name === "entity_id" &&
        condition.condition === "state"
      ) {
        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );
      }

      if (
        name === "device_id" &&
        automationConditionType(condition) === "device"
      ) {
        delete condition.entity_id;
        delete condition.domain;
        delete condition.type;

        syncAutomationEditorBaseFields();

        ensureDeviceAutomationConditions(value)
          .catch((error) => {
            console.error(
              "Device automation conditions:",
              error
            );
            return [];
          })
          .finally(() => {
            showAutomationEditor(
              automationEditorConfig,
              automationEditorId,
              automationEditorIsNew
            );
          });
      }
    };

    automationEditor.addEventListener(
      "change",
      updateAutomationConditionField
    );

    automationEditor.addEventListener(
      "input",
      updateAutomationConditionField
    );

    const updateAutomationVariableField = (event) => {
      const field = event.target.closest(
        "[data-action-variable-name], " +
        "[data-action-variable-value]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest(
        "[data-action-variable-index]"
      );

      const actionCard = field.closest(
        "[data-action-path]"
      );

      const actionPath =
        actionCard?.dataset.actionPath;

      const index = Number(
        card?.dataset.actionVariableIndex
      );

      if (
        !actionPath ||
        !Number.isInteger(index) ||
        index < 0
      ) {
        return;
      }

      const action =
        getAutomationActionByPath(actionPath);

      if (
        !action ||
        automationActionType(action) !== "variables" ||
        !action.variables ||
        typeof action.variables !== "object" ||
        Array.isArray(action.variables)
      ) {
        return;
      }

      const entries = Object.entries(action.variables);

      if (!entries[index]) {
        return;
      }

      const [oldName, oldValue] = entries[index];

      if (
        field.hasAttribute(
          "data-action-variable-value"
        )
      ) {
        entries[index] = [
          oldName,
          field.value
        ];

        action.variables =
          Object.fromEntries(entries);

        return;
      }

      const newName = field.value.trim();

      if (!newName || newName === oldName) {
        return;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          action.variables,
          newName
        )
      ) {
        field.setCustomValidity(
          t("automations.variableDuplicateName")
        );
        return;
      }

      field.setCustomValidity("");

      entries[index] = [
        newName,
        oldValue
      ];

      action.variables =
        Object.fromEntries(entries);
    };

    automationEditor.addEventListener(
      "input",
      updateAutomationVariableField
    );

    automationEditor.addEventListener(
      "change",
      updateAutomationVariableField
    );

    const updateAutomationActionField = (event) => {
      const field = event.target.closest(
        "[data-action-field], [data-action-target-entity], " +
        "[data-action-json-field], [data-action-delay-field], " +
        "[data-action-whole-json]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-action-path]");
      const actionPath = card?.dataset.actionPath;

      if (!actionPath) {
        return;
      }

      const action =
        getAutomationActionByPath(actionPath);

      if (
        !action ||
        typeof action !== "object" ||
        Array.isArray(action)
      ) {
        return;
      }

      syncAutomationEditorBaseFields();

      if (field.hasAttribute("data-action-whole-json")) {
        try {
          const parsed = JSON.parse(field.value);

          if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
          ) {
            throw new Error(
              t("automations.actionMustBeJsonObject")
            );
          }

          const parent =
            getAutomationActionParentByPath(actionPath);

          if (!parent) {
            throw new Error(
              t("automations.actionPathResolveFailed")
            );
          }

          parent.actions[parent.index] = parsed;
          field.setCustomValidity("");
        } catch (error) {
          field.setCustomValidity(
            error?.message || "Ungültiges JSON."
          );
        }

        return;
      }

      if (field.hasAttribute("data-action-json-field")) {
        const name = field.dataset.actionJsonField;

        try {
          const value = field.value.trim();

          if (!value) {
            delete action[name];
          } else {
            action[name] = JSON.parse(value);
          }

          field.setCustomValidity("");
        } catch {
          field.setCustomValidity("Ungültiges JSON.");
        }

        return;
      }

      if (field.hasAttribute("data-action-target-entity")) {
        const value = field.value.trim();

        if (!value) {
          delete action.target;
        } else {
          const entityIds = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

          action.target = {
            ...(action.target || {}),
            entity_id:
              entityIds.length === 1
                ? entityIds[0]
                : entityIds
          };
        }

        return;
      }

      if (field.hasAttribute("data-action-delay-field")) {
        const hoursField = card.querySelector(
          '[data-action-delay-field="hours"]'
        );

        const minutesField = card.querySelector(
          '[data-action-delay-field="minutes"]'
        );

        const secondsField = card.querySelector(
          '[data-action-delay-field="seconds"]'
        );

        const hours = Number(hoursField?.value || 0);
        const minutes = Number(minutesField?.value || 0);
        const seconds = Number(secondsField?.value || 0);

        const delay = {};

        if (hours) delay.hours = hours;
        if (minutes) delay.minutes = minutes;
        if (seconds) delay.seconds = seconds;

        action.delay = delay;

        return;
      }

      const name = field.dataset.actionField;

      if (!name) {
        return;
      }

      const value =
        field.type === "checkbox"
          ? field.checked
          : field.value;

      if (
        value === "" &&
        field.type !== "checkbox"
      ) {
        delete action[name];
      } else if (name === "action") {
        action.action = value;
        delete action.service;
      } else {
        action[name] = value;
      }
    };

    automationEditor.addEventListener(
      "change",
      updateAutomationActionField
    );

    automationEditor.addEventListener("change", (event) => {
      const typeField = event.target.closest("[data-repeat-type]");

      if (typeField && automationEditorConfig) {
        syncAutomationEditorBaseFields();

        const card = typeField.closest("[data-action-path]");
        const actionPath = card?.dataset.actionPath;
        const action = actionPath
          ? getAutomationActionByPath(actionPath)
          : null;

        if (
          action &&
          automationActionType(action) === "repeat"
        ) {
          const repeat = {
            sequence: Array.isArray(action.repeat?.sequence)
              ? action.repeat.sequence
              : []
          };

          switch (typeField.value) {
            case "while":
              repeat.while = Array.isArray(action.repeat?.while)
                ? action.repeat.while
                : [];
              break;

            case "until":
              repeat.until = Array.isArray(action.repeat?.until)
                ? action.repeat.until
                : [];
              break;

            case "for_each":
              repeat.for_each =
                typeof action.repeat?.for_each === "string"
                  ? action.repeat.for_each
                  : "";
              break;

            case "count":
            default:
              repeat.count = Number.isFinite(
                Number(action.repeat?.count)
              )
                ? Math.max(1, Number(action.repeat.count))
                : 1;
              break;
          }

          action.repeat = repeat;

          showAutomationEditor(
            automationEditorConfig,
            automationEditorId,
            automationEditorIsNew
          );
        }

        return;
      }

      const repeatField = event.target.closest(
        "[data-repeat-field]"
      );

      if (
        !repeatField ||
        !automationEditorConfig
      ) {
        return;
      }

      const card = repeatField.closest("[data-action-path]");
      const actionPath = card?.dataset.actionPath;

      if (!actionPath) {
        return;
      }

      const action =
        getAutomationActionByPath(actionPath);

      if (
        !action ||
        automationActionType(action) !== "repeat"
      ) {
        return;
      }

      if (
        !action.repeat ||
        typeof action.repeat !== "object" ||
        Array.isArray(action.repeat)
      ) {
        action.repeat = {
          count: 1,
          sequence: []
        };
      }

      const fieldName =
        repeatField.dataset.repeatField;

      if (fieldName === "count") {
        const count = Number(repeatField.value);

        action.repeat.count =
          Number.isFinite(count) && count >= 1
            ? Math.floor(count)
            : 1;

        delete action.repeat.while;
        delete action.repeat.until;
        delete action.repeat.for_each;
      }

      if (fieldName === "for_each") {
        const value = repeatField.value;

        if (value === "") {
          delete action.repeat.for_each;
        } else {
          action.repeat.for_each = value;
        }

        delete action.repeat.count;
        delete action.repeat.while;
        delete action.repeat.until;
      }
    });

    automationEditor.addEventListener(
      "input",
      updateAutomationActionField
    );

    automationEditor.addEventListener("change", async (event) => {
      const field = event.target.closest(
        "[data-device-action-choice]"
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card =
        field.closest("[data-action-path]");

      const actionPath =
        card?.dataset.actionPath;

      if (!actionPath) {
        return;
      }

      const action =
        getAutomationActionByPath(actionPath);

      if (
        !action ||
        automationActionType(action) !== "device"
      ) {
        return;
      }

      const available =
        automationDeviceActions.get(
          action.device_id
        ) || [];

      const choiceIndex = Number(field.value);

      if (
        !Number.isInteger(choiceIndex) ||
        !available[choiceIndex]
      ) {
        return;
      }

      const selected =
        structuredClone(available[choiceIndex]);

      delete selected.platform;
      delete selected.metadata;

      const parent =
        getAutomationActionParentByPath(actionPath);

      if (!parent) {
        return;
      }

      parent.actions[parent.index] = {
        ...selected,
        device_id: action.device_id
      };

      syncAutomationEditorBaseFields();

      showAutomationEditor(
        automationEditorConfig,
        automationEditorId,
        automationEditorIsNew
      );
    });

    automationEditor.addEventListener("change", async (event) => {
      const field = event.target.closest(
        '[data-action-field="device_id"]'
      );

      if (!field || !automationEditorConfig) {
        return;
      }

      const card =
        field.closest("[data-action-path]");

      const actionPath =
        card?.dataset.actionPath;

      if (!actionPath) {
        return;
      }

      const action =
        getAutomationActionByPath(actionPath);

      if (
        !action ||
        typeof action !== "object" ||
        Array.isArray(action)
      ) {
        return;
      }

      if (
        automationActionType(action) !== "device" &&
        !("device_id" in action)
      ) {
        return;
      }

      action.device_id = field.value;
      action.domain = "";
      action.type = "";
      delete action.entity_id;

      await ensureDeviceAutomationActions(
        field.value
      ).catch((error) => {
        console.error(
          "Device automation actions:",
          error
        );

        return [];
      });

      showAutomationEditor(
        automationEditorConfig,
        automationEditorId,
        automationEditorIsNew
      );
    });

    automationEditor.addEventListener("input", async (event) => {
      const field = event.target.closest("[data-trigger-field]");

      if (!field || !automationEditorConfig) {
        return;
      }

      const card = field.closest("[data-trigger-path]");

      if (!card) return;

      const triggerPath = card.dataset.triggerPath;
      const trigger = getAutomationTriggerByPath(triggerPath);

      if (!trigger) return;

      const name = field.dataset.triggerField;
      let value = field.value;

      if (name === "entity_id" && trigger.trigger === "state") {
        value = value ? [value] : [];
      }

      if (name === "event_data") {
        try {
          value = value.trim()
            ? JSON.parse(value)
            : {};
          field.setCustomValidity("");
        } catch {
          field.setCustomValidity(
            t("automations.triggerInvalidJson")
          );
          return;
        }
      }

      if (
        value === "" &&
        ["from", "to", "id", "hours", "minutes", "seconds"]
          .includes(name)
      ) {
        delete trigger[name];
      } else {
        trigger[name] = value;
      }

      if (
        name === "entity_id" &&
        trigger.trigger === "state"
      ) {
        syncAutomationEditorBaseFields();

        showAutomationEditor(
          automationEditorConfig,
          automationEditorId,
          automationEditorIsNew
        );
      }

      if (
        name === "device_id" &&
        automationTriggerType(trigger) === "device"
      ) {
        delete trigger.entity_id;
        delete trigger.domain;
        delete trigger.type;

        syncAutomationEditorBaseFields();

        ensureDeviceAutomationTriggers(value)
          .catch((error) => {
            console.error(
              "Device automation triggers:",
              error
            );
            return [];
          })
          .finally(() => {
            showAutomationEditor(
              automationEditorConfig,
              automationEditorId,
              automationEditorIsNew
            );
          });
      }
    });

    automationEditor.addEventListener("click", async (event) => {
      if (
        event.target.closest(
          "[data-automation-editor-close]"
        )
      ) {
        closeAutomationEditor();
        return;
      }

      const saveButton = event.target.closest(
        "[data-automation-editor-save]"
      );

      if (!saveButton) {
        return;
      }

      if (
        !automationEditorConfig ||
        !automationEditorId
      ) {
        return;
      }

      const alias = automationEditor
        .querySelector("#automationEditorAlias")
        ?.value.trim();

      const description = automationEditor
        .querySelector("#automationEditorDescription")
        ?.value.trim() || "";

      const mode = automationEditor
        .querySelector("#automationEditorMode")
        ?.value || "single";

      if (!alias) {
        window.alert(t("automations.nameRequired"));
        return;
      }

      const config = {
        ...automationEditorConfig,
        id: automationEditorId,
        alias,
        description,
        mode
      };

      console.log(
        "PHOENIX AUTOMATION SAVE CONFIG:",
        JSON.stringify(config, null, 2)
      );

      saveButton.disabled = true;

      try {
        const result = await saveAutomationConfig(
          automationEditorId,
          config
        );

        console.log(
          "PHOENIX AUTOMATION SAVE RESULT:",
          result
        );

        if (
          result?.status !== "ok" ||
          result?.saved !== true
        ) {
          throw new Error(
            typeof result?.error === "string"
              ? result.error
              : t("automations.saveFailed")
          );
        }

        closeAutomationEditor();
        await renderAutomations();
      } catch (error) {
        window.alert(
          error?.message ||
          t("automations.saveFailed")
        );

        saveButton.disabled = false;
      }
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-automation-delete]");

      if (!button) {
        return;
      }

      const automationId = button.dataset.automationDelete;
      const automationName =
        button.dataset.automationName || automationId;

      if (!automationId) {
        return;
      }

      if (
        !window.confirm(
          t("automations.confirmDelete", {
            name: automationName
          })
        )
      ) {
        return;
      }

      button.disabled = true;

      try {
        const result = await deleteAutomation(
          automationId,
          true
        );

        if (
          result?.status !== "ok" ||
          result?.deleted !== true
        ) {
          throw new Error(
            result?.error ||
            t("automations.deleteFailed")
          );
        }

        await renderAutomations();
      } catch (error) {
        window.alert(
          error?.message ||
          t("automations.deleteFailed")
        );

        button.disabled = false;
      }
    });

    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-automation-action]");

      if (!button) {
        return;
      }

      const card = button.closest("[data-automation-id]");
      const entityId = card?.dataset.automationId;
      const action = button.dataset.automationAction;

      if (!entityId || !action) {
        return;
      }

      if (
        action === "trigger" &&
        !window.confirm(t("automations.confirmRun"))
      ) {
        return;
      }

      button.disabled = true;

      try {
        const result = await runAutomationAction(
          entityId,
          action
        );

        if (result?.status !== "ok") {
          throw new Error(
            result?.error ||
            (
              action === "trigger"
                ? t("automations.runFailed")
                : t("automations.stateChangeFailed")
            )
          );
        }

        await renderAutomations();
      } catch (error) {
        window.alert(
          error?.message ||
          (
            action === "trigger"
              ? t("automations.runFailed")
              : t("automations.stateChangeFailed")
          )
        );

        button.disabled = false;
      }
    });

    let searchTimer;

    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 120);
    });

    stateFilter.addEventListener("change", applyFilters);
    labelFilter.addEventListener("change", applyFilters);

    selectVisible.addEventListener("click", () => {
      const visible = [
        ...list.querySelectorAll("[data-automation-id]")
      ].filter((card) => card.style.display !== "none");

      const shouldSelect = visible.some((card) =>
        !card.querySelector("[data-automation-select]").checked
      );

      visible.forEach((card) => {
        card.querySelector("[data-automation-select]").checked =
          shouldSelect;
      });

      selectVisible.textContent =
        shouldSelect
          ? t("automations.deselectVisible")
          : t("automations.selectVisible");
    });

    editCategories.addEventListener("click", () => {
      openCategoryEditor(selectedIds());
    });

    content.appendChild(filters);
    content.appendChild(bulkActions);
    content.appendChild(automationEditor);
    content.appendChild(list);

    applyFilters();
  } catch (error) {
    const status = content.querySelector("#automationsStatus");

    if (status) {
      status.textContent = error?.message || String(error);
    }
  }
}
