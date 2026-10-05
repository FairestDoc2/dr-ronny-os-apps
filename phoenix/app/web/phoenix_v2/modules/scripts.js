import {
  automationActionType,
  setAutomationEditorData,
  automationConditionType,
  ensureDeviceAutomationConditions,
  getDeviceAutomationConditions,
  ensureDeviceAutomationActions,
  getDeviceAutomationActions,
  ensureDeviceAutomationTriggers,
  getDeviceAutomationTriggers,
  automationActionTypeLabel,
  automationActionDefault,
  renderAutomationActions,
  getActionByPath,
  getActionParentByPath,
  getTriggerByPath,
  getTriggerParentByPath,
  getConditionByPath,
  getConditionParentByPath
} from "./automations.js?v=20261002-0632";
import {
  loadHomeAssistantScripts,
  runScriptAction,
  deleteScript,
  loadScriptConfig,
  saveScriptConfig,
  loadHomeAssistantLabels,
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantEntities,
  loadHomeAssistantDevices,
  loadHomeAssistantAreas,
  loadHomeAssistantFloors,
  loadHomeAssistantThemes,
  loadHomeAssistantConfigEntries,
  loadHomeAssistantConversationAgents,
  loadHomeAssistantStatistics,
  loadHomeAssistantServices,
  loadHomeAssistantTranslations
} from "../core/api.js?v=20260929-0635";

import {
  t,
  getLanguage
} from "../core/i18n.js?v=20260929-0635";

let scriptServices = [];
let scriptEntities = [];
let scriptDevices = [];
let scriptAreas = [];
let scriptFloors = [];
let scriptThemes = [];
let scriptConfigEntries = [];
let scriptConversationAgents = [];
let scriptStatistics = [];
let scriptLabels = [];
let scriptTranslations = {};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderScriptServiceOptions(services = []) {
  return services
    .map((service) => {
      const action =
        service?.action || "";

      const name =
        service?.name || "";

      const translationKey =
        service?.domain && service?.service
          ? `component.${service.domain}.services.${service.service}.name`
          : "";

      const translatedName =
        translationKey
          ? scriptTranslations[translationKey]
          : "";

      const displayName =
        translatedName ||
        name ||
        action;

      if (!action) {
        return "";
      }

      return `
        <option
          value="${escapeHtml(action)}"
          label="${escapeHtml(displayName)}"
        ></option>
      `;
    })
    .join("");
}

function renderScriptServiceFields(
  action,
  service
) {
  if (!service || !action) {
    return "";
  }

  const fields = service.fields || {};
  const data = action.data || {};

  return Object.entries(fields)
    .map(([name, definition]) => {
      const field = definition || {};

      if (
        field.fields &&
        typeof field.fields === "object"
      ) {
        const sectionTranslationKey =
          `component.${service.domain}.services.${service.service}` +
          `.sections.${name}.name`;

        const sectionLabel =
          scriptTranslations[sectionTranslationKey] ||
          field.name ||
          name;

        const sectionContent =
          renderScriptServiceFields(
            action,
            {
              ...service,
              fields: field.fields
            }
          );

        return `
          <details
            class="script-service-section"
            ${field.collapsed === true ? "" : "open"}
          >
            <summary>
              ${escapeHtml(sectionLabel)}
            </summary>

            <div class="script-service-section-fields">
              ${sectionContent}
            </div>
          </details>
        `;
      }

      const selector = field.selector || {};
      const selectorType =
        Object.keys(selector)[0] || "text";

      const value =
        data[name] ??
        field.default ??
        "";

      const selectorLabelKeys = {
        device: "scripts.serviceFieldDevice",
        entity: "scripts.serviceFieldEntity",
        area: "scripts.serviceFieldArea",
        label: "scripts.serviceFieldLabel",
        date: "scripts.serviceFieldDate",
        datetime: "scripts.serviceFieldDateTime",
        time: "scripts.serviceFieldTime",
        duration: "scripts.serviceFieldDuration",
        state: "scripts.serviceFieldState",
        icon: "scripts.serviceFieldIcon",
        template: "scripts.serviceFieldTemplate",
        media: "scripts.serviceFieldMedia",
        color_rgb: "scripts.serviceFieldColorRgb",
        color_temp: "scripts.serviceFieldColorTemp"
      };

      const translationKey =
        `component.${service.domain}.services.${service.service}` +
        `.fields.${name}.name`;

      const translatedLabel =
        scriptTranslations[translationKey];

      const fieldLabelKeys = {
        counter_id: "scripts.serviceFieldCounterId",
        initial: "scripts.serviceFieldInitial",
        minimum: "scripts.serviceFieldMinimum",
        maximum: "scripts.serviceFieldMaximum",
        step: "scripts.serviceFieldStep",
        restore: "scripts.serviceFieldRestore",
        topic: "scripts.serviceFieldTopic",
        payload: "scripts.serviceFieldPayload",
        retain: "scripts.serviceFieldRetain",
        message_expiry_interval: "scripts.serviceFieldMessageExpiry",
        event_id: "scripts.serviceFieldEventId",
        alexa_device: "scripts.serviceFieldAlexaDevice",
        suppress_confirmation: "scripts.serviceFieldSuppressConfirmation",
        icon: "scripts.serviceFieldIcon"
      };

      const phoenixFieldLabel =
        getLanguage() === "de" &&
        fieldLabelKeys[name]
          ? t(fieldLabelKeys[name])
          : "";

      const label =
        phoenixFieldLabel ||
        translatedLabel ||
        (
          selectorLabelKeys[selectorType]
            ? t(selectorLabelKeys[selectorType])
            : field.name || name
        );

      const required =
        field.required === true
          ? " required"
          : "";

      if (selectorType === "constant") {
        const options =
          selector.constant || {};

        const constantValue =
          options.value;

        const constantLabel =
          options.label || "";

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <span>
              <input
                type="checkbox"
                data-service-field="${escapeHtml(name)}"
                ${value === constantValue ? "checked" : ""}
              >
              ${escapeHtml(constantLabel)}
            </span>
          </label>
        `;
      }

      if (selectorType === "boolean") {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="checkbox"
              data-service-field="${escapeHtml(name)}"
              ${value === true ? "checked" : ""}
            >
          </label>
        `;
      }

      if (selectorType === "entity") {
        const options = selector.entity || {};

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        const filters =
          Array.isArray(options.filter)
            ? options.filter
            : [];

        const allowedDomains =
          filters.flatMap((filter) => {
            const domains = filter?.domain;

            if (Array.isArray(domains)) {
              return domains;
            }

            return domains ? [domains] : [];
          });

        const entities =
          allowedDomains.length
            ? scriptEntities.filter((entity) =>
                allowedDomains.includes(entity.domain)
              )
            : scriptEntities;

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <select
              data-service-field="${escapeHtml(name)}"
              ${options.multiple === true ? "multiple" : ""}
              ${required}
            >
              ${
                options.multiple === true
                  ? ""
                  : '<option value=""></option>'
              }

              ${entities.map((entity) => {
                const entityId =
                  String(entity.entity_id || "");

                const entityName =
                  String(
                    entity.name ||
                    entity.entity_id ||
                    ""
                  );

                return `
                  <option
                    value="${escapeHtml(entityId)}"
                    ${selectedValues.includes(entityId)
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(
                      `${entityName} (${entityId})`
                    )}
                  </option>
                `;
              }).join("")}
            </select>
          </label>
        `;
      }

      if (selectorType === "device") {
        const options = selector.device || {};

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <select
              data-service-field="${escapeHtml(name)}"
              ${options.multiple === true ? "multiple" : ""}
              ${required}
            >
              ${
                options.multiple === true
                  ? ""
                  : '<option value=""></option>'
              }

              ${scriptDevices.map((device) => {
                const deviceId =
                  String(device.id || "");

                const deviceName =
                  String(
                    device.name ||
                    device.id ||
                    ""
                  );

                return `
                  <option
                    value="${escapeHtml(deviceId)}"
                    ${selectedValues.includes(deviceId)
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(
                      `${deviceName} (${deviceId})`
                    )}
                  </option>
                `;
              }).join("")}
            </select>
          </label>
        `;
      }

      if (selectorType === "area") {
        const options = selector.area || {};

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <select
              data-service-field="${escapeHtml(name)}"
              ${options.multiple === true ? "multiple" : ""}
              ${required}
            >
              ${
                options.multiple === true
                  ? ""
                  : '<option value=""></option>'
              }

              ${scriptAreas.map((area) => {
                const areaId =
                  String(area.area_id || "");

                const areaName =
                  String(
                    area.name ||
                    area.area_id ||
                    ""
                  );

                return `
                  <option
                    value="${escapeHtml(areaId)}"
                    ${selectedValues.includes(areaId)
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(
                      `${areaName} (${areaId})`
                    )}
                  </option>
                `;
              }).join("")}
            </select>
          </label>
        `;
      }

      if (selectorType === "floor") {
        const options = selector.floor || {};

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        if (scriptFloors.length) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${options.multiple === true ? "multiple" : ""}
                ${required}
              >
                ${
                  options.multiple === true
                    ? ""
                    : '<option value=""></option>'
                }

                ${scriptFloors.map((floor) => {
                  const floorId =
                    String(floor.floor_id || "");

                  const floorName =
                    String(
                      floor.name ||
                      floor.floor_id ||
                      ""
                    );

                  return `
                    <option
                      value="${escapeHtml(floorId)}"
                      ${selectedValues.includes(floorId)
                        ? "selected"
                        : ""}
                    >
                      ${escapeHtml(
                        `${floorName} (${floorId})`
                      )}
                    </option>
                  `;
                }).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "theme") {
        const options = selector.theme || {};

        if (scriptThemes.length) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${required}
              >
                <option value=""></option>

                ${scriptThemes.map((theme) => `
                  <option
                    value="${escapeHtml(theme)}"
                    ${String(value) === String(theme)
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(theme)}
                  </option>
                `).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "config_entry") {
        const options =
          selector.config_entry || {};

        const integration =
          String(options.integration || "").trim();

        const entries =
          integration
            ? scriptConfigEntries.filter(
                (entry) =>
                  entry.domain === integration
              )
            : scriptConfigEntries;

        if (entries.length) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${required}
              >
                <option value=""></option>

                ${entries.map((entry) => {
                  const entryId =
                    String(entry.entry_id || "");

                  const entryTitle =
                    String(
                      entry.title ||
                      entry.entry_id ||
                      ""
                    );

                  const entryDomain =
                    String(entry.domain || "");

                  return `
                    <option
                      value="${escapeHtml(entryId)}"
                      ${String(value) === entryId
                        ? "selected"
                        : ""}
                    >
                      ${escapeHtml(
                        `${entryTitle} (${entryDomain})`
                      )}
                    </option>
                  `;
                }).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "conversation_agent") {
        if (scriptConversationAgents.length) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${required}
              >
                <option value=""></option>

                ${scriptConversationAgents.map((agent) => {
                  const agentId =
                    String(agent.id || "");

                  const agentName =
                    String(
                      agent.name ||
                      agent.id ||
                      ""
                    );

                  return `
                    <option
                      value="${escapeHtml(agentId)}"
                      ${String(value) === agentId
                        ? "selected"
                        : ""}
                    >
                      ${escapeHtml(
                        `${agentName} (${agentId})`
                      )}
                    </option>
                  `;
                }).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "statistic") {
        const options =
          selector.statistic || {};

        const multiple =
          options.multiple === true;

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        if (scriptStatistics.length) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${multiple ? "multiple" : ""}
                ${required}
              >
                ${
                  multiple
                    ? ""
                    : '<option value=""></option>'
                }

                ${scriptStatistics.map((item) => {
                  const statisticId =
                    String(
                      item.statistic_id || ""
                    );

                  const suffix =
                    item.unit
                      ? ` [${item.unit}]`
                      : "";

                  return `
                    <option
                      value="${escapeHtml(statisticId)}"
                      ${selectedValues.includes(statisticId)
                        ? "selected"
                        : ""}
                    >
                      ${escapeHtml(
                        statisticId + suffix
                      )}
                    </option>
                  `;
                }).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (
        selectorType === "addon" ||
        selectorType === "app" ||
        selectorType === "backup_location"
      ) {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "condition") {
        const conditionValue =
          typeof value === "object" &&
          value !== null
            ? JSON.stringify(value, null, 2)
            : value;

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="6"
              placeholder='{"condition":"state"}'
              ${required}
            >${escapeHtml(conditionValue)}</textarea>
          </label>
        `;
      }

      if (selectorType === "label") {
        const options = selector.label || {};

        const selectedValues =
          Array.isArray(value)
            ? value.map(String)
            : value !== ""
              ? [String(value)]
              : [];

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <select
              data-service-field="${escapeHtml(name)}"
              ${options.multiple === true ? "multiple" : ""}
              ${required}
            >
              ${
                options.multiple === true
                  ? ""
                  : '<option value=""></option>'
              }

              ${scriptLabels.map((item) => {
                const labelId =
                  String(item.label_id || "");

                const labelName =
                  String(
                    item.name ||
                    item.label_id ||
                    ""
                  );

                return `
                  <option
                    value="${escapeHtml(labelId)}"
                    ${selectedValues.includes(labelId)
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(
                      `${labelName} (${labelId})`
                    )}
                  </option>
                `;
              }).join("")}
            </select>
          </label>
        `;
      }

      if (selectorType === "color_temp") {
        const options =
          selector.color_temp || {};

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="number"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${options.min != null
                ? `min="${escapeHtml(options.min)}"`
                : ""}
              ${options.max != null
                ? `max="${escapeHtml(options.max)}"`
                : ""}
              step="1"
              ${required}
            >
            <small>
              ${escapeHtml(
                options.unit || "kelvin"
              )}
            </small>
          </label>
        `;
      }


      if (selectorType === "text") {
        const options =
          selector.text || {};

        const isMultiline =
          options.multiline === true;

        const inputType =
          options.type === "password"
            ? "password"
            : options.type === "email"
              ? "email"
              : options.type === "url"
                ? "url"
                : options.type === "tel"
                  ? "tel"
                  : "text";

        const minLength =
          options.min != null
            ? `minlength="${escapeHtml(options.min)}"`
            : options.min_length != null
              ? `minlength="${escapeHtml(options.min_length)}"`
              : "";

        const maxLength =
          options.max != null
            ? `maxlength="${escapeHtml(options.max)}"`
            : options.max_length != null
              ? `maxlength="${escapeHtml(options.max_length)}"`
              : "";

        const prefix =
          options.prefix
            ? `<small>${escapeHtml(options.prefix)}</small>`
            : "";

        const suffix =
          options.suffix
            ? `<small>${escapeHtml(options.suffix)}</small>`
            : "";

        if (isMultiline) {
          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              ${prefix}
              <textarea
                data-service-field="${escapeHtml(name)}"
                rows="4"
                ${minLength}
                ${maxLength}
                ${required}
              >${escapeHtml(value)}</textarea>
              ${suffix}
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            ${prefix}
            <input
              type="${escapeHtml(inputType)}"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${minLength}
              ${maxLength}
              ${required}
            >
            ${suffix}
          </label>
        `;
      }


      if (selectorType === "number") {
        const options = selector.number || {};

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="number"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${options.min != null
                ? `min="${escapeHtml(options.min)}"`
                : ""}
              ${options.max != null
                ? `max="${escapeHtml(options.max)}"`
                : ""}
              ${options.step != null
                ? `step="${escapeHtml(options.step)}"`
                : ""}
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "select") {
        const options =
          Array.isArray(selector.select?.options)
            ? selector.select.options
            : [];

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <select
              data-service-field="${escapeHtml(name)}"
              ${required}
            >
              <option value=""></option>
              ${options.map((option) => `
                <option
                  value="${escapeHtml(option)}"
                  ${String(value) === String(option)
                    ? "selected"
                    : ""}
                >
                  ${escapeHtml(option)}
                </option>
              `).join("")}
            </select>
          </label>
        `;
      }

      if (selectorType === "state") {
        const options =
          selector.state || {};

        const attribute =
          options.attribute || name;

        const candidateKeys = [
          attribute,
          `${attribute}s`,
          `${attribute}_list`
        ];

        const targetDomains =
          (service.target?.entity || [])
            .flatMap((target) => {
              const domains = target?.domain;

              if (Array.isArray(domains)) {
                return domains;
              }

              return domains
                ? [domains]
                : [];
            });

        const entities =
          targetDomains.length
            ? scriptEntities.filter(
                (entity) =>
                  targetDomains.includes(
                    entity.domain
                  )
              )
            : scriptEntities;

        const values =
          Array.from(
            new Set(
              entities.flatMap((entity) => {
                const result = [];

                if (
                  Array.isArray(entity.options)
                ) {
                  result.push(
                    ...entity.options
                  );
                }

                const listAttributes =
                  entity.list_attributes || {};

                candidateKeys.forEach((key) => {
                  const list =
                    listAttributes[key];

                  if (Array.isArray(list)) {
                    result.push(...list);
                  }
                });

                return result;
              })
            )
          )
            .filter(
              (item) =>
                item !== null &&
                item !== undefined &&
                item !== ""
            );

        const multiple =
          options.multiple === true;

        if (values.length) {
          const selectedValues =
            multiple
              ? (
                  Array.isArray(value)
                    ? value.map(String)
                    : value
                      ? [String(value)]
                      : []
                )
              : [String(value ?? "")];

          return `
            <label class="script-service-field">
              ${escapeHtml(label)}
              <select
                data-service-field="${escapeHtml(name)}"
                ${multiple ? "multiple" : ""}
                ${required}
              >
                ${multiple
                  ? ""
                  : '<option value=""></option>'}
                ${values.map((option) => `
                  <option
                    value="${escapeHtml(option)}"
                    ${selectedValues.includes(
                      String(option)
                    )
                      ? "selected"
                      : ""}
                  >
                    ${escapeHtml(option)}
                  </option>
                `).join("")}
              </select>
            </label>
          `;
        }

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (
        selectorType === "date" ||
        selectorType === "datetime" ||
        selectorType === "time"
      ) {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="${selectorType === "datetime"
                ? "datetime-local"
                : selectorType}"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "color_rgb") {
        const rgb =
          Array.isArray(value) &&
          value.length >= 3
            ? value
            : [0, 0, 0];

        const hexValue =
          "#" +
          rgb
            .slice(0, 3)
            .map((part) =>
              Math.max(
                0,
                Math.min(
                  255,
                  Number(part) || 0
                )
              )
                .toString(16)
                .padStart(2, "0")
            )
            .join("");

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="color"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(hexValue)}"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "duration") {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(
                typeof value === "object"
                  ? JSON.stringify(value)
                  : value
              )}"
              placeholder="00:00:00"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "object") {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="3"
              ${required}
            >${escapeHtml(
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : value
            )}</textarea>
          </label>
        `;
      }

      if (selectorType === "icon") {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="text"
              data-service-field="${escapeHtml(name)}"
              value="${escapeHtml(value)}"
              placeholder="mdi:lightbulb"
              ${required}
            >
          </label>
        `;
      }

      if (selectorType === "media") {
        const options =
          selector.media || {};

        const mediaValue =
          typeof value === "object" &&
          value !== null
            ? JSON.stringify(value, null, 2)
            : value;

        const placeholder =
          options.multiple === true
            ? '[{"media_content_id":"media-source://...","media_content_type":"music"}]'
            : '{"media_content_id":"media-source://...","media_content_type":"music"}';

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="5"
              placeholder="${escapeHtml(placeholder)}"
              ${required}
            >${escapeHtml(mediaValue)}</textarea>
          </label>
        `;
      }

      if (selectorType === "template") {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="4"
              ${required}
            >${escapeHtml(value)}</textarea>
          </label>
        `;
      }

      if (
        service.action === "script.alexareagiert" &&
        name === "suppress_confirmation"
      ) {
        const checked =
          value === true ||
          value === "true";

        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <input
              type="checkbox"
              data-service-field="${escapeHtml(name)}"
              ${checked ? "checked" : ""}
            >
          </label>
        `;
      }

      if (
        service.action === "calendar.create_event" &&
        name === "in"
      ) {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="4"
              placeholder='{"days": 2}'
              ${required}
            >${escapeHtml(
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : value
            )}</textarea>
          </label>
        `;
      }

      if (
        service.action === "watchman.report" &&
        name === "data"
      ) {
        return `
          <label class="script-service-field">
            ${escapeHtml(label)}
            <textarea
              data-service-field="${escapeHtml(name)}"
              rows="4"
              placeholder="title: Watchman Report"
              ${required}
            >${escapeHtml(value)}</textarea>
          </label>
        `;
      }

      return `
        <label class="script-service-field">
          ${escapeHtml(label)}
          <input
            type="text"
            data-service-field="${escapeHtml(name)}"
            value="${escapeHtml(
              typeof value === "object"
                ? JSON.stringify(value)
                : value
            )}"
            ${required}
          >
        </label>
      `;
    })
    .join("");
}

function attachScriptServiceFields(
  editor,
  services
) {
  if (!editor) return;

  editor
    .querySelectorAll("[data-action-path]")
    .forEach((card) => {
      const actionField =
        card.querySelector(
          '[data-action-field="action"]'
        );

      if (!actionField) return;

      const actionName =
        String(actionField.value || "").trim();

      if (!actionName) return;

      const service =
        services.find(
          (item) =>
            item?.action === actionName
        );

      if (!service) return;

      const actionPath =
        card.dataset.actionPath;

      if (!actionPath) return;

      const action =
        getActionByPath(
          editor._scriptEditorConfig?.sequence || [],
          actionPath
        );

      if (!action) return;

      let container =
        card.querySelector(
          "[data-script-service-fields]"
        );

      if (!container) {
        container =
          document.createElement("div");

        container.dataset.scriptServiceFields =
          "true";

        const targetField =
          card.querySelector(
            "[data-action-target-entity]"
          )?.closest("label");

        const jsonField =
          card.querySelector(
            '[data-action-json-field="data"]'
          )?.closest("label");

        if (targetField) {
          targetField.after(container);
        } else if (jsonField) {
          jsonField.before(container);
        } else {
          card.appendChild(container);
        }
      }

      container.innerHTML =
        renderScriptServiceFields(
          action,
          service
        );
    });
}

function attachScriptEntityChoices(
  editor,
  entities
) {
  if (!editor) return;

  editor
    .querySelectorAll(
      "[data-action-target-entity]"
    )
    .forEach((field, index) => {
      const card =
        field.closest("[data-action-path]");

      const actionField =
        card?.querySelector(
          '[data-action-field="action"]'
        );

      const domain =
        String(actionField?.value || "")
          .split(".", 1)[0];

      const listId =
        `scriptEntityOptions${index}`;

      let datalist =
        editor.querySelector(`#${listId}`);

      if (!datalist) {
        datalist =
          document.createElement("datalist");

        datalist.id = listId;
        editor.appendChild(datalist);
      }

      const matching =
        entities.filter((entity) => {
          if (!domain) return true;

          return (
            entity.domain === domain ||
            String(entity.entity_id || "")
              .startsWith(`${domain}.`)
          );
        });

      datalist.innerHTML =
        matching
          .map((entity) => {
            const entityId =
              entity.entity_id || "";

            const name =
              entity.name || entityId;

            return `
              <option
                value="${escapeHtml(entityId)}"
                label="${escapeHtml(name)}"
              ></option>
            `;
          })
          .join("");

      field.setAttribute("list", listId);
      field.setAttribute(
        "autocomplete",
        "off"
      );
    });
}

function attachScriptServiceChoices(editor, services) {
  if (!editor) return;

  editor
    .querySelectorAll(
      '[data-action-field="action"]'
    )
    .forEach((field) => {
      if (field.tagName === "SELECT") {
        return;
      }

      const currentValue =
        String(field.value || "");

      const wrapper =
        document.createElement("div");

      wrapper.className =
        "script-service-choice";

      const search =
        document.createElement("input");

      search.type = "search";
      search.className =
        "script-service-search";
      search.placeholder =
        "Dienst suchen …";
      search.autocomplete = "off";

      const select =
        document.createElement("select");

      select.dataset.actionField = "action";

      const emptyOption =
        document.createElement("option");

      emptyOption.value = "";
      emptyOption.textContent = "";

      select.appendChild(emptyOption);

      let currentValueFound = false;

      (Array.isArray(services) ? [...services] : [])
        .sort((a, b) => {
          const getDisplayName = (service) => {
            const translationKey =
              service?.domain && service?.service
                ? `component.${service.domain}.services.${service.service}.name`
                : "";

            return (
              (
                translationKey
                  ? scriptTranslations[translationKey]
                  : ""
              ) ||
              service?.name ||
              service?.action ||
              ""
            );
          };

          const nameA = getDisplayName(a);
          const nameB = getDisplayName(b);

          const byName = nameA.localeCompare(
            nameB,
            getLanguage(),
            { sensitivity: "base" }
          );

          if (byName !== 0) {
            return byName;
          }

          return String(a?.action || "").localeCompare(
            String(b?.action || ""),
            undefined,
            { sensitivity: "base" }
          );
        })
        .forEach((service) => {
          const action =
            service?.action || "";

          if (!action) {
            return;
          }

          const translationKey =
            service?.domain && service?.service
              ? `component.${service.domain}.services.${service.service}.name`
              : "";

          const translatedName =
            translationKey
              ? scriptTranslations[translationKey]
              : "";

          const displayName =
            translatedName ||
            service?.name ||
            action;

          const option =
            document.createElement("option");

          option.value = action;
          option.textContent =
            `${displayName} (${action})`;

          if (action === currentValue) {
            option.selected = true;
            currentValueFound = true;
          }

          select.appendChild(option);
        });

      if (
        currentValue &&
        !currentValueFound
      ) {
        const option =
          document.createElement("option");

        option.value = currentValue;
        option.textContent = currentValue;
        option.selected = true;

        select.appendChild(option);
      }

      const allOptions =
        [...select.options].map(
          option => ({
            value: option.value,
            text: option.textContent || ""
          })
        );

      wrapper.append(
        search,
        select
      );

      field.replaceWith(wrapper);

      search.addEventListener(
        "input",
        () => {
          const query =
            String(search.value || "")
              .trim()
              .toLowerCase();

          const current =
            select.value;

          select.innerHTML = "";

          allOptions.forEach(
            optionData => {
              if (
                query &&
                !optionData.text
                  .toLowerCase()
                  .includes(query) &&
                !optionData.value
                  .toLowerCase()
                  .includes(query)
              ) {
                return;
              }

              const option =
                document.createElement("option");

              option.value =
                optionData.value;

              option.textContent =
                optionData.text;

              if (
                optionData.value === current
              ) {
                option.selected = true;
              }

              select.appendChild(option);
            }
          );

          if (
            select.value &&
            select.value !== current
          ) {
            select.dispatchEvent(
              new Event(
                "change",
                { bubbles: true }
              )
            );
          }
        }
      );
    });
}

function refreshScriptActions(
  editor,
  scriptEditorConfig,
  scriptServices
) {
  const container =
    editor?.querySelector(
      "[data-script-actions]"
    );

  if (!container || !scriptEditorConfig) {
    return;
  }

  container.innerHTML =
    renderAutomationActions(
      scriptEditorConfig.sequence || [],
      scriptEditorConfig
    );

  attachScriptServiceChoices(
    editor,
    scriptServices
  );

  attachScriptEntityChoices(
    editor,
    scriptEntities
  );

  attachScriptServiceFields(
    editor,
    scriptServices
  );
}

function renderScriptActionTypeOptions(selectedType = "service") {
  const types = [
    "service",
    "device",
    "delay",
    "if",
    "choose",
    "wait_for_trigger",
    "wait_template",
    "condition",
    "variables",
    "repeat",
    "parallel",
    "event",
    "stop"
  ];

  return types
    .map((type) => `
      <option
        value="${escapeHtml(type)}"
        ${type === selectedType ? "selected" : ""}
      >
        ${escapeHtml(automationActionTypeLabel(type))}
      </option>
    `)
    .join("");
}


export async function renderScripts() {
  const content = document.getElementById("pageContent");

  content.innerHTML = `
    <style>
      .scripts-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
      }

      .scripts-toolbar input {
        flex: 1;
        min-width: 220px;
      }

      #scriptsList {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
      }

      .script-row {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) auto auto;
        gap: 20px;
        align-items: center;
        padding: 14px 16px;
        border: 1px solid var(--divider-color, rgba(127,127,127,.25));
        border-radius: 12px;
        background: var(--card-background-color, rgba(255,255,255,.04));
      }

      .script-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .script-main strong {
        font-size: 1rem;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      .script-main small {
        opacity: .65;
        overflow-wrap: anywhere;
      }

      .script-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      .script-label {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: .78rem;
        background: var(--secondary-background-color, rgba(127,127,127,.15));
      }

      .script-system-badge {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        margin-top: 4px;
        padding: 4px 9px;
        border: 1px solid var(--divider-color, rgba(127,127,127,.3));
        border-radius: 999px;
        font-size: .78rem;
        font-weight: 600;
        background: var(--secondary-background-color, rgba(127,127,127,.15));
      }

      .script-actions button:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      .script-status {
        white-space: nowrap;
        font-size: .9rem;
      }

      .script-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
      }

      .script-actions button {
        white-space: nowrap;
      }

      #scriptConfigEditor {
        padding: 20px;
        padding-bottom: 100px;
      }

      .scripts-group {
        margin-top: 16px;
      }

      .scripts-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
        padding: 0 4px;
      }

      .scripts-group-header h3 {
        margin: 0;
      }

      .scripts-group-header small {
        display: block;
        margin-top: 4px;
        opacity: .65;
      }

      .script-editor-actions {
        position: fixed;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%);
        width: min(calc(100% - 2rem), 900px);
        box-sizing: border-box;
        z-index: 1000;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: .65rem;
        margin: 0;
        padding: .65rem;
        background: rgba(20,20,24,.96);
        border: 1px solid #666;
        border-radius: .75rem;
        box-shadow: 0 -4px 18px rgba(0,0,0,.35);
        backdrop-filter: blur(8px);
      }

      .script-editor-actions button {
        width: 100%;
        padding: .7rem;
        border-radius: .55rem;
      }

      /* Einheitliches Layout für den grafischen Script-Editor */
      .script-sequence-editor {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: .85rem;
        background: rgba(255,255,255,.035);
      }

      .script-sequence-header {
        margin-bottom: .9rem;
      }

      .script-sequence-header h4 {
        margin: 0;
        font-size: 1.05rem;
      }

      .script-sequence-editor input,
      .script-sequence-editor select,
      .script-sequence-editor textarea {
        box-sizing: border-box;
        min-height: 42px;
        padding: .55rem .65rem;
        border-radius: .5rem;
      }

      .script-sequence-editor textarea {
        min-height: 90px;
        resize: vertical;
      }

      .script-sequence-editor [data-action-path],
      .script-sequence-editor [data-condition-path],
      .script-sequence-editor [data-trigger-path] {
        box-sizing: border-box;
        width: 100%;
        margin: .7rem 0;
        padding: .85rem;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: .7rem;
      }

      .script-sequence-editor [data-action-path] > div {
        box-sizing: border-box;
      }

      .script-sequence-editor [data-action-path] label {
        display: flex;
        flex-direction: column;
        gap: .35rem;
        flex: 1 1 240px;
        min-width: 0;
      }

      .script-sequence-editor [data-action-path] label > input,
      .script-sequence-editor [data-action-path] label > select,
      .script-sequence-editor [data-action-path] label > textarea {
        width: 100%;
        min-width: 0;
      }

      .script-sequence-editor [data-action-field="action"],
      .script-sequence-editor [data-action-target-entity],
      .script-sequence-editor [data-action-field="response_variable"] {
        width: 100%;
      }

      .script-sequence-editor [data-action-json-field="data"] {
        width: 100%;
        min-height: 120px;
      }

      .script-sequence-editor [data-action-path] input,
      .script-sequence-editor [data-action-path] select {
        min-width: 220px;
        max-width: 100%;
      }

      .script-sequence-editor [data-action-path] textarea {
        min-width: 280px;
        max-width: 100%;
      }

      .script-sequence-editor button {
        min-height: 42px;
        padding: .55rem .8rem;
        border-radius: .5rem;
      }

      .script-add-action {
        display: grid;
        grid-template-columns: minmax(220px, 320px) auto;
        align-items: center;
        gap: .7rem;
        margin-top: 1rem;
      }

      .script-add-action select,
      .script-add-action button {
        width: 100%;
      }

      @media (max-width: 900px) {
        .script-row {
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .script-actions {
          justify-content: flex-start;
        }

        .scripts-toolbar {
          align-items: stretch;
          flex-direction: column;
        }

        .scripts-toolbar input {
          width: 100%;
        }
      }
    </style>

    <section class="page-header">
      <h2>📜 ${escapeHtml(t("navigation.scripts"))}</h2>

      <p id="scriptsStatus">
        ${escapeHtml(t("common.loading"))}
      </p>

      <div class="scripts-toolbar">
        <input
          type="search"
          id="scriptsSearch"
          placeholder="${escapeHtml(t("scripts.searchPlaceholder"))}"
          autocomplete="off"
        >

        <button
          type="button"
          id="scriptCreateButton"
        >
          ➕ ${escapeHtml(t("scripts.create"))}
        </button>
      </div>
    </section>

    <section class="scripts-group">


      <div class="scripts-group-header">


        <div>


          <h3>${escapeHtml(t("scripts.homeAssistantGroup"))}</h3>


          <small>${escapeHtml(t("scripts.homeAssistantGroupHint"))}</small>


        </div>


      </div>



      <section


        id="scriptsList"


        class="card"


      ></section>


    </section>

    <section
      id="phoenixScriptsGroup"
      class="scripts-group"
      hidden
    >
      <div class="scripts-group-header">
        <div>
          <h3>Dr. Ronny Phoenix</h3>
          <small>Externe Skripte, die nicht von Home Assistant verwaltet werden.</small>
        </div>
      </div>

      <section
        id="phoenixScriptsList"
        class="card"
      ></section>
    </section>

    <section
      id="scriptConfigEditor"
      class="card"
      hidden
    ></section>
  `;

  const status = content.querySelector("#scriptsStatus");
  const list = content.querySelector("#scriptsList");
  const phoenixGroup =
    content.querySelector("#phoenixScriptsGroup");
  const phoenixList =
    content.querySelector("#phoenixScriptsList");
  const search = content.querySelector("#scriptsSearch");
  const createButton =
    content.querySelector("#scriptCreateButton");
  const editor =
    content.querySelector("#scriptConfigEditor");
  const toolbar =
    content.querySelector(".scripts-toolbar");

  let listScrollPosition = 0;
  let scriptEditorConfig = null;

  function showScriptEditor() {
    listScrollPosition = window.scrollY;

    if (toolbar) {
      toolbar.hidden = true;
    }

    list.hidden = true;
    editor.hidden = false;

    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }

  function showScriptList() {
    scriptEditorConfig = null;

    editor.hidden = true;
    editor.innerHTML = "";

    if (toolbar) {
      toolbar.hidden = false;
    }

    list.hidden = false;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: listScrollPosition,
        behavior: "instant"
      });
    });
  }

  let scripts = [];

  let phoenixScripts = [];

  let labels = [];
  let labelNames = new Map();

  function updateStatus(message) {
    status.textContent = message;
  }

  function renderList() {
    const query =
      String(search?.value || "")
        .trim()
        .toLocaleLowerCase();

    const filtered = scripts.filter((script) => {
      if (!query) {
        return true;
      }

      const name =
        String(script.name || "").toLocaleLowerCase();

      const entityId =
        String(script.entity_id || "").toLocaleLowerCase();

      return (
        name.includes(query) ||
        entityId.includes(query)
      );
    });

    if (phoenixGroup && phoenixList) {
      const filteredPhoenixScripts =
        phoenixScripts.filter((script) => {
          if (!query) {
            return true;
          }

          const name =
            String(script.name || "").toLocaleLowerCase();

          const id =
            String(script.id || "").toLocaleLowerCase();

          return (
            name.includes(query) ||
            id.includes(query)
          );
        });

      phoenixGroup.hidden =
        filteredPhoenixScripts.length === 0;

      phoenixList.innerHTML =
        filteredPhoenixScripts
          .map((script) => `
            <article
              class="script-row"
              data-phoenix-script-id="${escapeHtml(script.id)}"
            >
              <div class="script-main">
                <strong>
                  ${escapeHtml(script.name)}
                </strong>

                <small>
                  ${escapeHtml(script.id)}
                </small>
              </div>

              <div class="script-status">
                🔒 Extern
              </div>

              <div class="script-actions">
                <small>
                  Nicht von Home Assistant verwaltet
                </small>
              </div>
            </article>
          `)
          .join("");
    }

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-state">
          ${escapeHtml(t("scripts.noScripts"))}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered
      .map((script) => {
        const scriptState =
          String(script.state || "").toLowerCase();

        const running =
          scriptState === "on";

        const ready =
          scriptState === "off";

        const scriptId =
          String(script.entity_id || "")
            .replace(/^script\./, "");
        const scriptLabels =
          Array.isArray(script.labels)
            ? script.labels
            : [];

        const labelsHtml = scriptLabels
          .map((labelId) => {
            const labelName =
              labelNames.get(labelId) || labelId;

            return `
              <span class="script-label">
                ${escapeHtml(labelName)}
              </span>
            `;
          })
          .join("");

        return `
          <article
            class="script-row"
            data-script-entity="${escapeHtml(script.entity_id)}"
            data-script-id="${escapeHtml(scriptId)}"
          >
            <div class="script-main">
              <strong>
                ${escapeHtml(script.name || script.entity_id)}
              </strong>

              <small>
                ${escapeHtml(script.entity_id)}
              </small>

              ${
                labelsHtml
                  ? `<div class="script-labels">${labelsHtml}</div>`
                  : ""
              }
            </div>

            <div class="script-status">
              ${
                running
                  ? `🟢 ${escapeHtml(t("scripts.running"))}`
                  : ready
                    ? `🟡 ${escapeHtml(t("scripts.idle"))}`
                    : `🔴 ${escapeHtml(t("scripts.unavailable"))}`
              }
            </div>

            <div class="script-actions">
              <button
                type="button"
                data-script-run="${escapeHtml(script.entity_id)}"
              >
                ▶️ ${escapeHtml(t("scripts.run"))}
              </button>

              <button
                type="button"
                data-script-edit="${escapeHtml(script.entity_id)}"
              >
                ✏️ ${escapeHtml(t("scripts.edit"))}
              </button>

              <button
                type="button"
                data-script-delete="${escapeHtml(script.entity_id)}"
              >
                🗑️ ${escapeHtml(t("scripts.delete"))}
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadScripts() {
    updateStatus(t("common.loading"));

    const response =
      await loadHomeAssistantScripts();

    if (response?.status !== "ok") {
      scripts = [];

      updateStatus(
        response?.error ||
        t("scripts.loadError")
      );

      renderList();
      return;
    }

    scripts = Array.isArray(response.scripts)
      ? response.scripts
      : [];

    updateStatus(
      t("scripts.count", {
        count:
          scripts.length +
          phoenixScripts.length
      })
    );

    renderList();
  }

  search?.addEventListener("input", () => {
    renderList();
  });

  list.addEventListener("click", async (event) => {
    const runButton =
      event.target.closest("[data-script-run]");

    if (runButton) {
      const entityId =
        runButton.dataset.scriptRun;

      if (!entityId) {
        return;
      }

      runButton.disabled = true;

      try {
        const response =
          await runScriptAction(
            entityId,
            "turn_on"
          );

        if (response?.status !== "ok") {
          updateStatus(
            response?.error ||
            t("scripts.runError")
          );
          return;
        }

        updateStatus(
          t("scripts.runSuccess")
        );

        await loadScripts();
      } finally {
        runButton.disabled = false;
      }

      return;
    }

    const editButton =
      event.target.closest("[data-script-edit]");

    if (editButton) {
      const entityId =
        editButton.dataset.scriptEdit;

      if (!entityId) {
        return;
      }

      const scriptId =
        entityId.replace(/^script\./, "");

      const response =
        await loadScriptConfig(scriptId);

      if (response?.status !== "ok") {
        updateStatus(
          response?.error ||
          t("scripts.loadConfigError")
        );
        return;
      }

      scriptEditorConfig =
        structuredClone(response.config || {});

      if (!Array.isArray(scriptEditorConfig.sequence)) {
        scriptEditorConfig.sequence = [];
      }

      editor.innerHTML = `
        <h3>
          ✏️ ${escapeHtml(t("scripts.editorTitle"))}
        </h3>

        <label>
          ${escapeHtml(t("scripts.scriptId"))}
          <input
            type="text"
            value="${escapeHtml(scriptId)}"
            disabled
          >
        </label>

        <section class="script-sequence-editor">
          <div class="script-sequence-header">
            <h4>
              ${escapeHtml(t("scripts.actions"))}
            </h4>
          </div>

          <div data-script-actions>
            ${renderAutomationActions(
              scriptEditorConfig.sequence,
              scriptEditorConfig
            )}
          </div>

          <div class="script-add-action">
            <select data-script-action-type>
              ${renderScriptActionTypeOptions()}
            </select>

            <button
              type="button"
              data-script-action-add
            >
              ➕ ${escapeHtml(t("scripts.addAction"))}
            </button>
          </div>
        </section>

        <div class="script-editor-actions">
          <button
            type="button"
            data-script-save
          >
            💾 ${escapeHtml(t("scripts.save"))}
          </button>

          <button
            type="button"
            data-script-editor-close
          >
            ✖️ ${escapeHtml(t("scripts.cancel"))}
          </button>
        </div>
      `;

      editor.dataset.scriptId = scriptId;
      editor._scriptEditorConfig = scriptEditorConfig;

      attachScriptServiceChoices(
        editor,
        scriptServices
      );

      attachScriptEntityChoices(
        editor,
        scriptEntities
      );

      attachScriptServiceFields(
        editor,
        scriptServices
      );

      showScriptEditor();

      requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: "instant"
        });
      });

      return;
    }

    const deleteButton =
      event.target.closest("[data-script-delete]");

    if (deleteButton) {
      const entityId =
        deleteButton.dataset.scriptDelete;

      if (!entityId) {
        return;
      }

      const scriptId =
        entityId.replace(/^script\./, "");

      if (
        !window.confirm(
          t("scripts.deleteConfirm")
        )
      ) {
        return;
      }

      deleteButton.disabled = true;

      try {
        const response =
          await deleteScript(
            scriptId,
            true
          );

        if (response?.status !== "ok") {
          updateStatus(
            response?.error ||
            t("scripts.deleteError")
          );
          return;
        }

        updateStatus(
          t("scripts.deleteSuccess")
        );

        showScriptList();
        await loadScripts();
      } finally {
        deleteButton.disabled = false;
      }

      return;
    }
  });

  editor.addEventListener("change", async (event) => {
    const field = event.target.closest(
      "[data-device-action-choice]"
    );

    if (!field || !scriptEditorConfig) {
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
      getActionByPath(
        scriptEditorConfig.sequence,
        actionPath
      );

    if (
      !action ||
      automationActionType(action) !== "device"
    ) {
      return;
    }

    const available =
      getDeviceAutomationActions(
        action.device_id
      );

    const choiceIndex =
      Number(field.value);

    if (
      !Number.isInteger(choiceIndex) ||
      !available[choiceIndex]
    ) {
      return;
    }

    const selected =
      structuredClone(
        available[choiceIndex]
      );

    delete selected.platform;
    delete selected.metadata;

    const parent =
      getActionParentByPath(
        scriptEditorConfig.sequence,
        actionPath
      );

    if (!parent) {
      return;
    }

    parent.actions[parent.index] = {
      ...selected,
      device_id: action.device_id
    };

    const actionsContainer =
      editor.querySelector(
        "[data-script-actions]"
      );

    if (actionsContainer) {
      actionsContainer.innerHTML =
        renderAutomationActions(
          scriptEditorConfig.sequence,
          scriptEditorConfig
        );
    }
  });

  editor.addEventListener("change", async (event) => {
    const field = event.target.closest(
      '[data-action-field="device_id"]'
    );

    if (!field || !scriptEditorConfig) {
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
      getActionByPath(
        scriptEditorConfig.sequence,
        actionPath
      );

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

    const actionsContainer =
      editor.querySelector(
        "[data-script-actions]"
      );

    if (actionsContainer) {
      actionsContainer.innerHTML =
        renderAutomationActions(
          scriptEditorConfig.sequence,
          scriptEditorConfig
        );
    }
  });

  editor.addEventListener("change", (event) => {
    const field =
      event.target.closest(
        "[data-device-trigger-choice]"
      );

    if (!field || !scriptEditorConfig) {
      return;
    }

    const card =
      field.closest("[data-trigger-path]");

    if (!card) {
      return;
    }

    const triggerPath =
      card.dataset.triggerPath;

    const trigger =
      getTriggerByPath(
        scriptEditorConfig.sequence,
        triggerPath
      );

    if (
      !trigger ||
      trigger.trigger !== "device"
    ) {
      return;
    }

    const available =
      getDeviceAutomationTriggers(
        trigger.device_id
      );

    const choiceIndex =
      Number(field.value);

    if (
      !Number.isInteger(choiceIndex) ||
      !available[choiceIndex]
    ) {
      return;
    }

    const selected =
      structuredClone(
        available[choiceIndex]
      );

    delete selected.platform;
    delete selected.metadata;

    const parent =
      getTriggerParentByPath(
        scriptEditorConfig.sequence,
        triggerPath
      );

    if (!parent) {
      return;
    }

    parent.triggers[parent.index] = {
      ...selected,
      trigger: "device"
    };

    const actionsContainer =
      editor.querySelector(
        "[data-script-actions]"
      );

    if (actionsContainer) {
      actionsContainer.innerHTML =
        renderAutomationActions(
          scriptEditorConfig.sequence,
          scriptEditorConfig
        );
    }
  });

  const updateScriptTriggerField = async (event) => {
    const field =
      event.target.closest("[data-trigger-field]");

    if (!field || !scriptEditorConfig) {
      return;
    }

    const card =
      field.closest("[data-trigger-path]");

    const triggerPath =
      card?.dataset.triggerPath;

    if (!triggerPath) {
      return;
    }

    const trigger =
      getTriggerByPath(
        scriptEditorConfig.sequence,
        triggerPath
      );

    if (!trigger) {
      return;
    }

    const name =
      field.dataset.triggerField;

    let value = field.value;

    if (
      name === "entity_id" &&
      trigger.trigger === "state"
    ) {
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
      [
        "from",
        "to",
        "id",
        "hours",
        "minutes",
        "seconds"
      ].includes(name)
    ) {
      delete trigger[name];
    } else {
      trigger[name] = value;
    }

    if (
      name === "entity_id" &&
      trigger.trigger === "state"
    ) {
      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    if (
      name === "device_id" &&
      trigger.trigger === "device"
    ) {
      delete trigger.entity_id;
      delete trigger.domain;
      delete trigger.type;

      await ensureDeviceAutomationTriggers(
        value
      ).catch((error) => {
        console.error(
          "Device automation triggers:",
          error
        );
        return [];
      });

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }
    }
  };

  editor.addEventListener(
    "input",
    updateScriptTriggerField
  );

  editor.addEventListener(
    "change",
    updateScriptTriggerField
  );

  const updateScriptConditionField = (event) => {
    const field = event.target.closest(
      "[data-condition-field]"
    );

    if (!field || !scriptEditorConfig) {
      return;
    }

    const card =
      field.closest("[data-condition-path]");

    const conditionPath =
      card?.dataset.conditionPath;

    if (!conditionPath) {
      return;
    }

    const condition =
      getConditionByPath(
        scriptEditorConfig.sequence,
        conditionPath
      );

    if (!condition) {
      return;
    }

    const name =
      field.dataset.conditionField;

    const value = field.value;

    if (
      value === "" &&
      [
        "after",
        "before",
        "state",
        "above",
        "below",
        "value_template"
      ].includes(name)
    ) {
      delete condition[name];
    } else {
      condition[name] = value;
    }

    if (
      name === "entity_id" &&
      condition.condition === "state"
    ) {
      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }
    }
  };

  editor.addEventListener(
    "change",
    updateScriptConditionField
  );

  editor.addEventListener(
    "input",
    updateScriptConditionField
  );

  const updateScriptActionField = (event) => {
    const field = event.target.closest(
      "[data-action-field], [data-action-target-entity], " +
      "[data-action-json-field], [data-action-delay-field], " +
      "[data-action-whole-json], [data-service-field]"
    );

    if (!field || !scriptEditorConfig) {
      return;
    }

    const card = field.closest("[data-action-path]");
    const actionPath = card?.dataset.actionPath;

    if (!actionPath) {
      return;
    }

    const action =
      getActionByPath(
        scriptEditorConfig.sequence,
        actionPath
      );

    if (
      !action ||
      typeof action !== "object" ||
      Array.isArray(action)
    ) {
      return;
    }

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
          getActionParentByPath(
            scriptEditorConfig.sequence,
            actionPath
          );

        if (!parent) {
          throw new Error(
            t("automations.actionPathResolveFailed")
          );
        }

        parent.actions[parent.index] = parsed;
        field.setCustomValidity("");
      } catch (error) {
        field.setCustomValidity(
          error?.message ||
          t("scripts.invalidJson")
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
        field.setCustomValidity(
          t("scripts.invalidJson")
        );
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

    if (field.hasAttribute("data-service-field")) {
      const name =
        field.dataset.serviceField;

      if (!name) {
        return;
      }

      if (!action.data || typeof action.data !== "object") {
        action.data = {};
      }

      let value;

      if (
        field.tagName === "SELECT" &&
        field.multiple
      ) {
        value =
          Array.from(field.selectedOptions)
            .map((option) => option.value)
            .filter(Boolean);

        if (!value.length) {
          delete action.data[name];
          return;
        }
      } else if (field.type === "checkbox") {
        value = field.checked;
      } else if (
        field.tagName === "TEXTAREA"
      ) {
        const raw = field.value.trim();

        if (!raw) {
          delete action.data[name];
          return;
        }

        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
      } else if (
        field.type === "number"
      ) {
        if (field.value === "") {
          delete action.data[name];
          return;
        }

        value = Number(field.value);
      } else if (
        field.type === "color"
      ) {
        const hex =
          String(field.value || "")
            .replace("#", "");

        if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
          delete action.data[name];
          return;
        }

        value = [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      } else {
        value = field.value;

        if (value === "") {
          delete action.data[name];
          return;
        }
      }

      action.data[name] = value;
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
      const previousAction =
        action.action ||
        action.service ||
        "";

      action.action = value;
      delete action.service;

      if (previousAction !== value) {
        delete action.data;
      }

      attachScriptEntityChoices(
        editor,
        scriptEntities
      );

      attachScriptServiceFields(
        editor,
        scriptServices
      );
    } else {
      action[name] = value;
    }
  };

  editor.addEventListener(
    "change",
    updateScriptActionField
  );

  editor.addEventListener("click", async (event) => {
    const closeButton =
      event.target.closest(
        "[data-script-editor-close]"
      );

    if (closeButton) {
      showScriptList();
      return;
    }

    const waitTriggerAddButton =
      event.target.closest(
        "[data-wait-trigger-add]"
      );

    if (waitTriggerAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        waitTriggerAddButton.dataset.waitTriggerAdd;

      const action =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !action ||
        automationActionType(action) !== "wait_for_trigger"
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-wait-trigger-new-type]` +
        `[data-wait-trigger-parent="${CSS.escape(actionPath)}"]`
      );

      const type =
        select?.value || "state";

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

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const removeTriggerButton =
      event.target.closest(
        "[data-trigger-remove]"
      );

    if (removeTriggerButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const card =
        removeTriggerButton.closest(
          "[data-trigger-path]"
        );

      const triggerPath =
        card?.dataset.triggerPath ??
        removeTriggerButton.dataset.triggerRemove;

      const parent =
        getTriggerParentByPath(
          scriptEditorConfig.sequence,
          triggerPath
        );

      if (
        !parent ||
        !parent.triggers[parent.index]
      ) {
        return;
      }

      parent.triggers.splice(
        parent.index,
        1
      );

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const removeActionButton =
      event.target.closest(
        "[data-action-remove-path]"
      );

    if (removeActionButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        removeActionButton.dataset.actionRemovePath;

      const parent =
        getActionParentByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (!parent) {
        return;
      }

      parent.actions.splice(parent.index, 1);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const conditionChildAddButton =
      event.target.closest(
        "[data-condition-child-add]"
      );

    if (conditionChildAddButton) {
      if (!scriptEditorConfig) return;

      const parentPath =
        conditionChildAddButton.dataset.conditionChildAdd;

      if (!parentPath) return;

      const parentCondition =
        getConditionByPath(
          scriptEditorConfig.sequence,
          parentPath
        );

      if (
        !parentCondition ||
        !["and", "or", "not"].includes(
          automationConditionType(parentCondition)
        )
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-condition-child-new-type]` +
        `[data-condition-parent-path="${CSS.escape(parentPath)}"]`
      );

      const type = select?.value || "state";

      const defaults = {
        state: { condition: "state", entity_id: "", state: "" },
        numeric_state: { condition: "numeric_state", entity_id: "" },
        time: { condition: "time" },
        sun: { condition: "sun" },
        template: { condition: "template", value_template: "" },
        device: { condition: "device" },
        trigger: { condition: "trigger", id: "" },
        and: { condition: "and", conditions: [] },
        or: { condition: "or", conditions: [] },
        not: { condition: "not", conditions: [] }
      };

      if (!defaults[type]) return;

      if (!Array.isArray(parentCondition.conditions)) {
        parentCondition.conditions = [];
      }

      parentCondition.conditions.push(
        structuredClone(defaults[type])
      );

      const actionsContainer =
        editor.querySelector("[data-script-actions]");

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const conditionRemoveButton =
      event.target.closest(
        "[data-condition-remove]"
      );

    if (conditionRemoveButton) {
      if (!scriptEditorConfig) return;

      const conditionPath =
        conditionRemoveButton.dataset.conditionRemovePath;

      if (!conditionPath) return;

      const parent =
        getConditionParentByPath(
          scriptEditorConfig.sequence,
          conditionPath
        );

      if (
        !parent ||
        !Array.isArray(parent.conditions) ||
        !parent.conditions[parent.index]
      ) {
        return;
      }

      parent.conditions.splice(parent.index, 1);

      const actionsContainer =
        editor.querySelector("[data-script-actions]");

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const choiceConditionAddButton =
      event.target.closest(
        "[data-choice-condition-add]"
      );

    if (choiceConditionAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const choicePath =
        choiceConditionAddButton.dataset.choiceConditionAdd;

      if (!choicePath) {
        return;
      }

      const choice =
        getActionByPath(
          scriptEditorConfig.sequence,
          choicePath
        );

      if (
        !choice ||
        typeof choice !== "object" ||
        Array.isArray(choice)
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-choice-condition-new-type]` +
        `[data-choice-condition-parent="${CSS.escape(choicePath)}"]`
      );

      const type =
        select?.value || "state";

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

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const choiceRemoveButton =
      event.target.closest(
        "[data-choice-remove]"
      );

    if (choiceRemoveButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const choicePath =
        choiceRemoveButton.dataset.choiceRemove;

      const parts =
        String(choicePath).split(".");

      const choiceIndex =
        Number(parts.pop());

      if (
        parts.pop() !== "choose" ||
        !Number.isInteger(choiceIndex) ||
        choiceIndex < 0
      ) {
        return;
      }

      const actionPath =
        parts.join(".");

      const action =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !action ||
        automationActionType(action) !== "choose" ||
        !Array.isArray(action.choose) ||
        !action.choose[choiceIndex]
      ) {
        return;
      }

      action.choose.splice(choiceIndex, 1);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const choiceAddButton =
      event.target.closest(
        "[data-choice-add]"
      );

    if (choiceAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        choiceAddButton.dataset.choiceAdd;

      if (!actionPath) {
        return;
      }

      const action =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

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

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const choiceDefaultAddButton =
      event.target.closest(
        "[data-choice-default-add]"
      );

    if (choiceDefaultAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        choiceDefaultAddButton.dataset.choiceDefaultAdd;

      if (!actionPath) {
        return;
      }

      const action =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !action ||
        automationActionType(action) !== "choose"
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-choice-default-new-type]` +
        `[data-choice-default-parent="${CSS.escape(actionPath)}"]`
      );

      const type =
        select?.value || "service";

      const newAction =
        automationActionDefault(type);

      if (!newAction) {
        return;
      }

      if (!Array.isArray(action.default)) {
        action.default = [];
      }

      action.default.push(newAction);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const choiceActionAddButton =
      event.target.closest(
        "[data-choice-action-add]"
      );

    if (choiceActionAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const choicePath =
        choiceActionAddButton.dataset.choiceActionAdd;

      if (!choicePath) {
        return;
      }

      const choice =
        getActionByPath(
          scriptEditorConfig.sequence,
          choicePath
        );

      if (
        !choice ||
        typeof choice !== "object" ||
        Array.isArray(choice)
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-choice-action-new-type]` +
        `[data-choice-action-parent="${CSS.escape(choicePath)}"]`
      );

      const type =
        select?.value || "service";

      const newAction =
        automationActionDefault(type);

      if (!newAction) {
        return;
      }

      if (!Array.isArray(choice.sequence)) {
        choice.sequence = [];
      }

      choice.sequence.push(newAction);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const repeatActionAddButton =
      event.target.closest(
        "[data-repeat-action-add]"
      );

    if (repeatActionAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        repeatActionAddButton.dataset.repeatActionAdd;

      if (!actionPath) {
        return;
      }

      const parentAction =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !parentAction ||
        automationActionType(parentAction) !== "repeat"
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-repeat-action-new-type]` +
        `[data-repeat-action-parent="${CSS.escape(actionPath)}"]`
      );

      const type =
        select?.value || "service";

      const newAction =
        automationActionDefault(type);

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

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const parallelActionAddButton =
      event.target.closest(
        "[data-parallel-action-add]"
      );

    if (parallelActionAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const actionPath =
        parallelActionAddButton.dataset.parallelActionAdd;

      if (!actionPath) {
        return;
      }

      const parentAction =
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !parentAction ||
        automationActionType(parentAction) !== "parallel"
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-parallel-action-new-type]` +
        `[data-parallel-action-parent="${CSS.escape(actionPath)}"]`
      );

      const type =
        select?.value || "service";

      const newAction =
        automationActionDefault(type);

      if (!newAction) {
        return;
      }

      if (!Array.isArray(parentAction.parallel)) {
        parentAction.parallel = [];
      }

      parentAction.parallel.push(newAction);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const actionChildAddButton =
      event.target.closest(
        "[data-action-child-add]"
      );

    if (actionChildAddButton) {
      if (!scriptEditorConfig) {
        return;
      }

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
        getActionByPath(
          scriptEditorConfig.sequence,
          actionPath
        );

      if (
        !parentAction ||
        automationActionType(parentAction) !== "if"
      ) {
        return;
      }

      const select = editor.querySelector(
        `[data-action-child-new-type]` +
        `[data-action-child-parent="${CSS.escape(parentPath)}"]`
      );

      const type =
        select?.value || "service";

      const newAction =
        automationActionDefault(type);

      if (!newAction) {
        return;
      }

      if (!Array.isArray(parentAction[branch])) {
        parentAction[branch] = [];
      }

      parentAction[branch].push(newAction);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const addActionButton =
      event.target.closest(
        "[data-script-action-add]"
      );

    if (addActionButton) {
      if (!scriptEditorConfig) {
        return;
      }

      const typeSelect =
        editor.querySelector(
          "[data-script-action-type]"
        );

      const type =
        typeSelect?.value || "service";

      const newAction =
        automationActionDefault(type);

      if (!newAction) {
        return;
      }

      if (!Array.isArray(scriptEditorConfig.sequence)) {
        scriptEditorConfig.sequence = [];
      }

      scriptEditorConfig.sequence.push(newAction);

      const actionsContainer =
        editor.querySelector(
          "[data-script-actions]"
        );

      if (actionsContainer) {
        refreshScriptActions(
          editor,
          scriptEditorConfig,
          scriptServices
        );
      }

      return;
    }

    const saveButton =
      event.target.closest(
        "[data-script-save]"
      );

    if (!saveButton) {
      return;
    }

    const scriptId =
      editor.dataset.scriptId;

    if (!scriptId || !scriptEditorConfig) {
      return;
    }

    const config =
      structuredClone(scriptEditorConfig);

    if (!Array.isArray(config.sequence)) {
      config.sequence = [];
    }

    saveButton.disabled = true;

    try {
      const response =
        await saveScriptConfig(
          scriptId,
          config
        );

      if (response?.status !== "ok") {
        updateStatus(
          response?.error ||
          t("scripts.saveError")
        );
        return;
      }

      updateStatus(
        t("scripts.saveSuccess")
      );

      showScriptList();

      await loadScripts();
    } finally {
      saveButton.disabled = false;
    }
  });

  createButton?.addEventListener(
    "click",
    () => {
      showScriptEditor();

      editor.dataset.scriptId = "";

      scriptEditorConfig = {
        alias: "",
        sequence: [],
        mode: "single"
      };

      editor.innerHTML = `
        <h3>
          ➕ ${escapeHtml(t("scripts.createTitle"))}
        </h3>

        <label>
          ${escapeHtml(t("scripts.scriptId"))}
          <input
            type="text"
            data-script-new-id
            placeholder="${escapeHtml(
              t("scripts.scriptIdPlaceholder")
            )}"
          >
        </label>

        <section class="script-sequence-editor">
          <div class="script-sequence-header">
            <h4>${escapeHtml(t("scripts.actions"))}</h4>
          </div>

          <div data-script-actions>
            ${renderAutomationActions(
              scriptEditorConfig.sequence,
              scriptEditorConfig
            )}
          </div>

          <div class="script-add-action">
            <select data-script-action-type>
              ${renderScriptActionTypeOptions()}
            </select>

            <button
              type="button"
              data-script-action-add
            >
              ➕ ${escapeHtml(t("scripts.addAction"))}
            </button>
          </div>
        </section>

        <div class="script-editor-actions">
          <button
            type="button"
            data-script-create-save
          >
            💾 ${escapeHtml(t("scripts.createSave"))}
          </button>

          <button
            type="button"
            data-script-editor-close
          >
            ✖️ ${escapeHtml(t("scripts.cancel"))}
          </button>
        </div>
      `;

      editor._scriptEditorConfig = scriptEditorConfig;

      attachScriptServiceChoices(
        editor,
        scriptServices
      );

      attachScriptEntityChoices(
        editor,
        scriptEntities
      );

      attachScriptServiceFields(
        editor,
        scriptServices
      );

    }
  );

  editor.addEventListener("click", async (event) => {
    const createSaveButton =
      event.target.closest(
        "[data-script-create-save]"
      );

    if (!createSaveButton) {
      return;
    }

    const idField =
      editor.querySelector(
        "[data-script-new-id]"
      );

    const scriptId =
      String(idField?.value || "")
        .trim()
        .replace(/^script\./, "");

    if (!scriptId) {
      updateStatus(
        t("scripts.scriptIdRequired")
      );
      return;
    }

    if (!scriptEditorConfig) {
      return;
    }

    const config =
      structuredClone(scriptEditorConfig);

    if (!Array.isArray(config.sequence)) {
      config.sequence = [];
    }

    createSaveButton.disabled = true;

    try {
      const response =
        await saveScriptConfig(
          scriptId,
          config
        );

      if (response?.status !== "ok") {
        updateStatus(
          response?.error ||
          t("scripts.saveError")
        );
        return;
      }

      updateStatus(
        t("scripts.saveSuccess")
      );

      showScriptList();

      await loadScripts();
    } finally {
      createSaveButton.disabled = false;
    }
  });

  try {
    const [
      labelResponse,
      entityResponse,
      deviceResponse,
      stateResponse,
      areaResponse,
      floorResponse,
      themeResponse,
      configEntryResponse,
      conversationAgentResponse,
      statisticResponse,
      serviceResponse,
      translationResponse
    ] = await Promise.all([
      loadHomeAssistantLabels(),
      loadHomeAssistantEntityRegistry(),
      loadHomeAssistantDevices(),
      loadHomeAssistantEntities(),
      loadHomeAssistantAreas(),
      loadHomeAssistantFloors(),
      loadHomeAssistantThemes(),
      loadHomeAssistantConfigEntries(),
      loadHomeAssistantConversationAgents(),
      loadHomeAssistantStatistics(),
      loadHomeAssistantServices(),
      loadHomeAssistantTranslations(
        getLanguage()
      )
    ]);

    labels =
      Array.isArray(labelResponse?.labels)
        ? labelResponse.labels
        : [];

    scriptLabels = labels;

    scriptDevices =
      Array.isArray(deviceResponse?.devices)
        ? deviceResponse.devices
        : [];

    labelNames = new Map(
      labels.map((label) => [
        label.label_id,
        label.name || label.label_id
      ])
    );

    scriptServices =
      Array.isArray(serviceResponse?.services)
        ? serviceResponse.services
        : [];
scriptTranslations =
      translationResponse?.translations?.resources &&
      typeof translationResponse.translations.resources === "object"
        ? translationResponse.translations.resources
        : {};

    scriptEntities =
      Array.isArray(stateResponse?.entities)
        ? stateResponse.entities
        : [];

    scriptAreas =
      Array.isArray(areaResponse?.areas)
        ? areaResponse.areas
        : [];

    scriptFloors =
      Array.isArray(floorResponse?.floors)
        ? floorResponse.floors
        : [];

    scriptThemes =
      Array.isArray(themeResponse?.themes)
        ? themeResponse.themes
        : [];

    scriptConfigEntries =
      Array.isArray(configEntryResponse?.config_entries)
        ? configEntryResponse.config_entries
        : [];

    scriptConversationAgents =
      Array.isArray(conversationAgentResponse?.agents)
        ? conversationAgentResponse.agents
        : [];

    scriptStatistics =
      Array.isArray(statisticResponse?.statistics)
        ? statisticResponse.statistics
        : [];

    setAutomationEditorData(
      Array.isArray(entityResponse?.entities)
        ? entityResponse.entities
        : [],
      Array.isArray(deviceResponse?.devices)
        ? deviceResponse.devices
        : [],
      Array.isArray(stateResponse?.entities)
        ? stateResponse.entities
        : []
    );

    await loadScripts();
  } catch (error) {
    console.error(
      "Scripts:",
      error
    );

    updateStatus(
      t("scripts.loadError")
    );

    renderList();
  }
}
