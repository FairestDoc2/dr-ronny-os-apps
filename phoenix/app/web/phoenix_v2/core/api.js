async function requestNetwork(path, options = {}) {
  const response = await fetch(
    path,
    {
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `API ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

const phoenixRequestCache = new Map();
const phoenixRequestInflight = new Map();

const PHOENIX_CACHE_TTL = 5000;

const phoenixCacheablePaths = new Set([
  "../api/phoenix/system-control/status",
  "../api/phoenix/home-assistant/status",
  "../api/phoenix/home-assistant/entity-registry",
  "../api/phoenix/home-assistant/entities",
  "../api/phoenix/home-assistant/devices",
  "../api/phoenix/home-assistant/areas",
  "../api/phoenix/home-assistant/labels",
  "../api/phoenix/home-assistant/automations",
  "../api/phoenix/home-assistant/scripts"
]);

async function request(path, options = {}) {
  const method =
    String(options.method || "GET").toUpperCase();

  const cacheable =
    method === "GET" &&
    phoenixCacheablePaths.has(path);

  if (!cacheable) {
    return requestNetwork(path, options);
  }

  const now = Date.now();
  const cached =
    phoenixRequestCache.get(path);

  if (
    cached &&
    now - cached.timestamp < PHOENIX_CACHE_TTL
  ) {
    return cached.value;
  }

  const running =
    phoenixRequestInflight.get(path);

  if (running) {
    return running;
  }

  const promise = requestNetwork(
    path,
    options
  )
    .then(value => {
      phoenixRequestCache.set(
        path,
        {
          timestamp: Date.now(),
          value
        }
      );

      return value;
    })
    .finally(() => {
      phoenixRequestInflight.delete(path);
    });

  phoenixRequestInflight.set(
    path,
    promise
  );

  return promise;
}

export async function loadLabels() {
  return request(
    "../api/phoenix/home-assistant/labels"
  );
}

async function postLabelManagement(path) {
  const response = await fetch(path, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

export async function createLabel(name, confirm = false) {
  const params = new URLSearchParams({
    name,
    confirm: String(confirm)
  });

  return postLabelManagement(
    `../api/phoenix/home-assistant/labels?${params}`
  );
}

export async function renameLabel(
  labelId,
  name,
  confirm = false
) {
  const params = new URLSearchParams({
    name,
    confirm: String(confirm)
  });

  return postLabelManagement(
    `../api/phoenix/home-assistant/labels/` +
    `${encodeURIComponent(labelId)}/rename?${params}`
  );
}

export async function deleteLabel(
  labelId,
  confirm = false
) {
  const params = new URLSearchParams({
    confirm: String(confirm)
  });

  return postLabelManagement(
    `../api/phoenix/home-assistant/labels/` +
    `${encodeURIComponent(labelId)}/delete?${params}`
  );
}

export async function loadPhoenixStatus() {
  const possiblePaths = [
    "../api/phoenix/system-control/status",
    "api/phoenix/system-control/status",
    "/api/phoenix/system-control/status"
  ];

  let lastError = null;

  for (const path of possiblePaths) {
    try {
      return await request(path);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    "Phoenix Status API nicht erreichbar."
  );
}

export async function loadHomeAssistantServices() {
  return request(
    "../api/phoenix/home-assistant/services"
  );
}

export async function loadHomeAssistantTranslations(
  language
) {
  const params = new URLSearchParams({
    language: String(language || "de")
  });

  return request(
    "../api/phoenix/home-assistant/translations?" +
    params.toString()
  );
}

export async function loadHomeAssistantStatus() {
  const possiblePaths = [
    "../api/phoenix/home-assistant/status",
    "api/phoenix/home-assistant/status",
    "/api/phoenix/home-assistant/status"
  ];

  let lastError = null;

  for (const path of possiblePaths) {
    try {
      return await request(path);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    "Home Assistant Status API nicht erreichbar."
  );
}


async function postAreaAssignment(
  possiblePaths,
  areaId
) {
  let lastError = null;

  for (const path of possiblePaths) {
    try {
      return await request(
        path +
          "?area_id=" +
          encodeURIComponent(areaId ?? "") +
          "&confirm=true",
        {
          method: "POST"
        }
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    "Bereichszuordnung konnte nicht geändert werden."
  );
}

export async function setDeviceName(
  deviceId,
  name
) {
  const id = encodeURIComponent(deviceId);

  const params = new URLSearchParams({
    confirm: "true"
  });

  if (
    name !== null &&
    name !== undefined
  ) {
    params.set(
      "name",
      String(name)
    );
  }

  return request(
    `../api/phoenix/home-assistant/devices/${id}/name?` +
    params.toString(),
    {
      method: "POST"
    }
  );
}


export async function loadRonnyAiState() {
  return request(
    "../api/phoenix/home-assistant/ronny-ai/state"
  );
}


export async function ignoreRonnyAiSuggestion(
  key
) {
  return request(
    "../api/phoenix/home-assistant/ronny-ai/ignore",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key
      })
    }
  );
}


export async function unignoreRonnyAiSuggestion(
  key
) {
  return request(
    "../api/phoenix/home-assistant/ronny-ai/unignore",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key
      })
    }
  );
}


export async function cleanupRonnyAiOrphanedAutomation(
  entityId
) {
  const id =
    encodeURIComponent(entityId);

  return request(
    "../api/phoenix/home-assistant/" +
    `ronny-ai/orphaned-automation/${id}/cleanup?confirm=true`,
    {
      method: "POST"
    }
  );
}


export async function addRonnyAiHistory(
  entry
) {
  return request(
    "../api/phoenix/home-assistant/ronny-ai/history",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        entry || {}
      )
    }
  );
}


export async function setDeviceArea(
  deviceId,
  areaId
) {
  const id = encodeURIComponent(deviceId);

  return postAreaAssignment(
    [
      `../api/phoenix/home-assistant/devices/${id}/area`,
      `api/phoenix/home-assistant/devices/${id}/area`,
      `/api/phoenix/home-assistant/devices/${id}/area`
    ],
    areaId
  );
}

export async function setEntityName(
  entityId,
  name
) {
  const id = encodeURIComponent(entityId);

  const params = new URLSearchParams({
    confirm: "true"
  });

  if (
    name !== null &&
    name !== undefined
  ) {
    params.set(
      "name",
      String(name)
    );
  }

  return request(
    `../api/phoenix/home-assistant/entities/${id}/name?` +
    params.toString(),
    {
      method: "POST"
    }
  );
}


export async function setEntityArea(
  entityId,
  areaId
) {
  const id = encodeURIComponent(entityId);

  return postAreaAssignment(
    [
      `../api/phoenix/home-assistant/entities/${id}/area`,
      `api/phoenix/home-assistant/entities/${id}/area`,
      `/api/phoenix/home-assistant/entities/${id}/area`
    ],
    areaId
  );
}


async function postAreaManagement(
  possiblePaths
) {
  let lastError = null;

  for (const path of possiblePaths) {
    try {
      return await request(
        path,
        {
          method: "POST"
        }
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    "Bereich konnte nicht verwaltet werden."
  );
}


export async function createArea(name) {
  const encodedName = encodeURIComponent(name);

  return postAreaManagement([
    `../api/phoenix/home-assistant/areas?name=${encodedName}&confirm=true`,
    `api/phoenix/home-assistant/areas?name=${encodedName}&confirm=true`,
    `/api/phoenix/home-assistant/areas?name=${encodedName}&confirm=true`
  ]);
}


export async function renameArea(
  areaId,
  name
) {
  const id = encodeURIComponent(areaId);
  const encodedName = encodeURIComponent(name);

  return postAreaManagement([
    `../api/phoenix/home-assistant/areas/${id}/rename?name=${encodedName}&confirm=true`,
    `api/phoenix/home-assistant/areas/${id}/rename?name=${encodedName}&confirm=true`,
    `/api/phoenix/home-assistant/areas/${id}/rename?name=${encodedName}&confirm=true`
  ]);
}


export async function deleteArea(areaId) {
  const id = encodeURIComponent(areaId);

  return postAreaManagement([
    `../api/phoenix/home-assistant/areas/${id}/delete?confirm=true`,
    `api/phoenix/home-assistant/areas/${id}/delete?confirm=true`,
    `/api/phoenix/home-assistant/areas/${id}/delete?confirm=true`
  ]);
}

export async function loadLabelUsage() {
  return request(
    "../api/phoenix/home-assistant/labels/usage"
  );
}

export async function loadHomeAssistantAreas() {
  return request(
    "../api/phoenix/home-assistant/areas"
  );
}

export async function loadHomeAssistantFloors() {
  return request(
    "../api/phoenix/home-assistant/floors"
  );
}

export async function loadHomeAssistantThemes() {
  return request(
    "../api/phoenix/home-assistant/themes"
  );
}

export async function loadHomeAssistantConfigEntries() {
  return request(
    "../api/phoenix/home-assistant/config-entries"
  );
}

export async function loadHomeAssistantConversationAgents() {
  return request(
    "../api/phoenix/home-assistant/conversation-agents"
  );
}

export async function loadHomeAssistantStatistics() {
  return request(
    "../api/phoenix/home-assistant/statistics"
  );
}

export async function loadHomeAssistantLabels() {
  return request(
    "../api/phoenix/home-assistant/labels"
  );
}

export async function loadHomeAssistantDevices() {
  return request(
    "../api/phoenix/home-assistant/devices"
  );
}

export async function loadDeviceAutomationTriggers(deviceId) {
  return request(
    "../api/phoenix/home-assistant/devices/" +
    `${encodeURIComponent(deviceId)}/automation-triggers`
  );
}

export async function loadDeviceAutomationConditions(deviceId) {
  return request(
    "../api/phoenix/home-assistant/devices/" +
    `${encodeURIComponent(deviceId)}/automation-conditions`
  );
}

export async function loadHomeAssistantEntityRegistry() {
  return request(
    "../api/phoenix/home-assistant/entity-registry"
  );
}

export async function loadHomeAssistantEntities() {
  return request(
    "../api/phoenix/home-assistant/entities"
  );
}

export async function loadHomeAssistantAutomations() {
  return request(
    "../api/phoenix/home-assistant/automations"
  );
}


export async function loadHomeAssistantScripts() {
  return request(
    "../api/phoenix/home-assistant/scripts"
  );
}


export async function runScriptAction(entityId, action) {
  const params = new URLSearchParams({ action });

  return request(
    "../api/phoenix/home-assistant/scripts/" +
    `${encodeURIComponent(entityId)}/action?${params}`,
    { method: "POST" }
  );
}


export async function deleteScript(scriptId, confirm = false) {
  const params = new URLSearchParams({
    confirm: String(confirm)
  });

  return request(
    "../api/phoenix/home-assistant/scripts/" +
    `${encodeURIComponent(scriptId)}?${params}`,
    { method: "DELETE" }
  );
}


export async function loadScriptConfig(scriptId) {
  return request(
    "../api/phoenix/home-assistant/scripts/" +
    `${encodeURIComponent(scriptId)}/config`
  );
}


export async function saveScriptConfig(scriptId, config) {
  return request(
    "../api/phoenix/home-assistant/scripts/" +
    `${encodeURIComponent(scriptId)}/config`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    }
  );
}

async function postLabelAssignment(path, labels) {
  const response = await fetch(
    `${path}?confirm=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(labels)
    }
  );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

export async function setAreaLabels(
  areaId,
  labels
) {
  return postLabelAssignment(
    `../api/phoenix/home-assistant/areas/` +
    `${encodeURIComponent(areaId)}/labels`,
    labels
  );
}

export async function setDeviceLabels(
  deviceId,
  labels
) {
  return postLabelAssignment(
    `../api/phoenix/home-assistant/devices/` +
    `${encodeURIComponent(deviceId)}/labels`,
    labels
  );
}

export async function setEntityLabels(
  entityId,
  labels
) {
  return postLabelAssignment(
    `../api/phoenix/home-assistant/entities/` +
    `${encodeURIComponent(entityId)}/labels`,
    labels
  );
}

export async function runAutomationAction(
  entityId,
  action
) {
  const params = new URLSearchParams({
    action
  });

  return request(
    `../api/phoenix/home-assistant/automations/` +
    `${encodeURIComponent(entityId)}/action?${params}`,
    {
      method: "POST"
    }
  );
}


export async function deleteAutomation(
  automationId,
  confirm = false
) {
  const params = new URLSearchParams({
    confirm: String(confirm)
  });

  return request(
    `../api/phoenix/home-assistant/automations/` +
    `${encodeURIComponent(automationId)}?${params}`,
    {
      method: "DELETE"
    }
  );
}


export async function loadAutomationConfig(
  automationId
) {
  return request(
    `../api/phoenix/home-assistant/automations/` +
    `${encodeURIComponent(automationId)}/config`
  );
}


export async function saveAutomationConfig(
  automationId,
  config
) {
  return request(
    `../api/phoenix/home-assistant/automations/` +
    `${encodeURIComponent(automationId)}/config`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    }
  );
}


export async function loadDeviceAutomationActions(deviceId) {
  return request(
    "../api/phoenix/home-assistant/devices/" +
    `${encodeURIComponent(deviceId)}/automation-actions`
  );
}

export function preloadPhoenixOverviewData() {
  return Promise.allSettled([
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
}
