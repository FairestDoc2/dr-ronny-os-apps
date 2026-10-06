import { t } from "../core/i18n.js?v=20260928-1050";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson(path) {
  const possiblePaths = [
    `../${path}`,
    path,
    `/${path}`
  ];

  let lastError = null;

  for (const url of possiblePaths) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(t("settings.apiUnavailable"));
}

async function createSnapshot() {
  const possiblePaths = [
    "../api/phoenix/system-control/snapshots",
    "api/phoenix/system-control/snapshots",
    "/api/phoenix/system-control/snapshots"
  ];

  let lastError = null;

  for (const url of possiblePaths) {
    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    t("settings.snapshotApiUnavailable")
  );
}

function formatSnapshotSize(bytes) {
  const value = Number(bytes || 0);

  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  const size = value / Math.pow(1024, index);

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatSnapshotDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

/* === Phoenix HA Backup UI === */

async function createHaBackup(name) {
  const query = name
    ? `?name=${encodeURIComponent(name)}`
    : "";

  const response = await fetch(
    `api/phoenix/system-control/ha-backups${query}`,
    {
      method: "POST"
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data.status === "error" ||
    data.created === false
  ) {
    throw new Error(
      data.error ||
      t("settings.haBackupCreateFailed")
    );
  }

  return data;
}


async function restoreHaBackup(slug) {
  const response = await fetch(
    `api/phoenix/system-control/ha-backups/${encodeURIComponent(slug)}/restore?confirm=true`,
    {
      method: "POST"
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data.status === "error" ||
    data.restored === false
  ) {
    throw new Error(
      data.error ||
      t("settings.haBackupRestoreFailed")
    );
  }

  return data;
}


async function deleteHaBackup(slug) {
  const response = await fetch(
    `api/phoenix/system-control/ha-backups/${encodeURIComponent(slug)}?confirm=true`,
    {
      method: "DELETE"
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    data.status === "error" ||
    data.deleted === false
  ) {
    throw new Error(
      data.error ||
      t("settings.haBackupDeleteFailed")
    );
  }

  return data;
}


function formatHaBackupSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return "–";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  let current = size;
  let index = 0;

  while (
    current >= 1024 &&
    index < units.length - 1
  ) {
    current /= 1024;
    index += 1;
  }

  return `${current.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}


function formatHaBackupDate(value) {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}


function renderHaBackups(data) {
  const backups =
    Array.isArray(data?.backups)
      ? data.backups
      : [];

  if (!backups.length) {
    return `
      <article class="card">
        <h3>🏠 ${t("settings.haBackup")}</h3>

        <p>
          ${t("settings.noHaBackups")}
        </p>

        <p>
          ${t("settings.haBackupsIndependent")}
        </p>
      </article>
    `;
  }

  return backups.map(backup => {
    const slug =
      String(backup.slug || "");

    const name =
      String(
        backup.name ||
        t("settings.haBackupFallback", { slug })
      );

    return `
      <article class="card">

        <h3>🏠 ${t("settings.haBackup")}</h3>

        <p>
          <strong>
            ${escapeHtml(name)}
          </strong>
        </p>

        <p>
          📅 ${escapeHtml(
            formatHaBackupDate(backup.date)
          )}
        </p>

        <p>
          💾 ${escapeHtml(
            formatHaBackupSize(backup.size)
          )}
        </p>

        <p>
          ${t("settings.backupType")}:
          <strong>
            🏠 ${t("settings.homeAssistant")}
          </strong>
        </p>

        <div class="button-row">

          <button
            type="button"
            class="btn restoreHaBackupButton"
            data-ha-backup-slug="${escapeHtml(slug)}"
            data-ha-backup-name="${escapeHtml(name)}"
          >
            ♻️ Wiederherstellen
          </button>

          <button
            type="button"
            class="btn deleteHaBackupButton"
            data-ha-backup-slug="${escapeHtml(slug)}"
            data-ha-backup-name="${escapeHtml(name)}"
          >
            🗑️ Löschen
          </button>

        </div>

      </article>
    `;
  }).join("");
}

async function setDeveloperMode(enabled) {
  const response = await fetch(
    "api/phoenix/system-control/developer-mode",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        enabled
      })
    }
  );

  const data = await response.json();

  if (!response.ok || data.status === "error") {
    throw new Error(
      data.detail ||
      data.error ||
      "Developer Mode konnte nicht geändert werden."
    );
  }

  return data;
}


async function updateDeveloperVersion() {
  const response = await fetch(
    "api/phoenix/system-control/developer-update",
    {
      method: "POST"
    }
  );

  const data = await response.json();

  if (!response.ok || data.status === "error") {
    throw new Error(
      data.detail ||
      data.error ||
      "Entwicklerversion konnte nicht aktualisiert werden."
    );
  }

  return data;
}


async function publishDeveloperVersion() {
  const response = await fetch(
    "api/phoenix/system-control/developer-publish",
    {
      method: "POST"
    }
  );

  const data = await response.json();

  if (!response.ok || data.status === "error") {
    throw new Error(
      data.detail ||
      data.error ||
      "Phoenix-Version konnte nicht veröffentlicht werden."
    );
  }

  return data;
}

function renderSnapshots(data) {
  const snapshots = data.snapshots || [];

  if (!snapshots.length) {
    return `
      <article class="empty-card">
        ${t("settings.noSnapshots")}
      </article>
    `;
  }

  return snapshots.map((snapshot) => {
    const metadata = snapshot.metadata || {};
    const snapshotName =
      metadata.name ||
      `Snapshot ${snapshot.id}`;

    return `
      <article class="card snapshot-card">
        <h3>
          📸 ${escapeHtml(snapshotName)}
        </h3>

        <p>
          <strong>${t("settings.snapshotId")}:</strong>
          ${escapeHtml(snapshot.id)}
        </p>

        <p>
          <strong>${t("settings.created")}:</strong>
          ${escapeHtml(formatSnapshotDate(metadata.created))}
        </p>

        <p>
          <strong>${t("settings.size")}:</strong>
          ${escapeHtml(formatSnapshotSize(metadata.size_bytes))}
        </p>

        <p>
          <strong>${t("settings.version")}:</strong>
          ${escapeHtml(metadata.version || "—")}
        </p>

        <p>
          <strong>${t("settings.file")}:</strong>
          ${escapeHtml(snapshot.file)}
        </p>

        <p>
          <strong>${t("settings.status")}:</strong>
          <strong>
            ${
              snapshot.verified
                ? `✅ ${t("settings.verified")}`
                : `⚠️ ${t("settings.notVerified")}`
            }
          </strong>
        </p>

        <div class="snapshot-actions">
          <button
            type="button"
            class="btn renameSnapshotButton"
            data-snapshot-id="${escapeHtml(snapshot.id)}"
            data-snapshot-name="${escapeHtml(snapshotName)}"
          >
            ✏️ ${t("settings.renameSnapshot")}
          </button>

          <button
            type="button"
            class="btn verifySnapshotButton"
            data-snapshot-id="${escapeHtml(snapshot.id)}"
          >
            🛡️ ${t("settings.verifySnapshot")}
          </button>

          ${
            snapshot.verified
              ? `
                <button
                  type="button"
                  class="btn restoreSnapshotButton"
                  data-snapshot-id="${escapeHtml(snapshot.id)}"
                >
                  ♻️ ${t("settings.restoreSnapshot")}
                </button>
              `
              : `
                <span>
                  ⚠️ ${t("settings.restoreLocked")}
                </span>
              `
          }

          <button
            type="button"
            class="btn deleteSnapshotButton"
            data-snapshot-id="${escapeHtml(snapshot.id)}"
            data-snapshot-name="${escapeHtml(snapshotName)}"
          >
            🗑️ ${t("settings.deleteSnapshot")}
          </button>
        </div>
      </article>
    `;
  }).join("");
}


async function callSnapshotAction(snapshotId, action, options = {}) {
  const encodedId = encodeURIComponent(snapshotId);
  const method = options.method || "POST";
  const query = options.confirm ? "?confirm=true" : "";

  const possiblePaths = [
    `../api/phoenix/system-control/snapshots/${encodedId}/${action}${query}`,
    `api/phoenix/system-control/snapshots/${encodedId}/${action}${query}`,
    `/api/phoenix/system-control/snapshots/${encodedId}/${action}${query}`
  ];

  let lastError = null;

  for (const url of possiblePaths) {
    try {
      const fetchOptions = {
        method,
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      };

      if (options.body !== undefined) {
        fetchOptions.headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "ok") {
        throw new Error(
          data.error ||
          data.reason ||
          t("settings.snapshotActionFailed")
        );
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(t("settings.snapshotApiUnavailable"));
}

async function renameSnapshot(snapshotId, name) {
  return callSnapshotAction(
    snapshotId,
    "rename",
    {
      body: { name }
    }
  );
}

async function verifySnapshot(snapshotId) {
  return callSnapshotAction(
    snapshotId,
    "verify"
  );
}

async function deleteSnapshot(snapshotId) {
  const encodedId = encodeURIComponent(snapshotId);

  const possiblePaths = [
    `../api/phoenix/system-control/snapshots/${encodedId}?confirm=true`,
    `api/phoenix/system-control/snapshots/${encodedId}?confirm=true`,
    `/api/phoenix/system-control/snapshots/${encodedId}?confirm=true`
  ];

  let lastError = null;

  for (const url of possiblePaths) {
    try {
      const response = await fetch(url, {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "ok" || !data.delete?.deleted) {
        throw new Error(
          data.error ||
          t("settings.snapshotDeleteFailed")
        );
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(t("settings.snapshotApiUnavailable"));
}

async function restoreSnapshot(snapshotId) {
  const encodedId = encodeURIComponent(snapshotId);

  const possiblePaths = [
    `../api/phoenix/system-control/snapshots/${encodedId}/restore?confirm=true`,
    `api/phoenix/system-control/snapshots/${encodedId}/restore?confirm=true`,
    `/api/phoenix/system-control/snapshots/${encodedId}/restore?confirm=true`
  ];

  let lastError = null;

  for (const url of possiblePaths) {
    try {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "ok" || !data.restore?.restored) {
        throw new Error(
          data.restore?.reason || t("settings.restoreNotExecuted")
        );
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    t("settings.restoreApiUnavailable")
  );
}

export async function renderSettings() {
  const page =
    document.getElementById("pageContent");

  if (!page) {
    return;
  }

  page.innerHTML = `
    <section class="page-header">
      <h2>⚙️  ${t("settings.title")}</h2>
      <p>
        ${t("settings.subtitle")}
      </p>
    </section>

    <section class="card-grid">
      <article class="card">
        ${t("settings.loading")}
      </article>
    </section>
  `;

  try {
      const [status, snapshotData, haBackupData] =
        await Promise.all([
          loadJson(
            "api/phoenix/system-control/status"
          ),
          loadJson(
            "api/phoenix/system-control/snapshots"
          ),
          loadJson(
            "api/phoenix/system-control/ha-backups"
          )
        ]);

    const phoenix = status.phoenix || {};
    const project = status.project || {};
      const ownerInstallation =
        status.owner_installation === true;

      const developerMode =
        status.developer_mode === true;

      const releaseVersions =
        status.release_versions || {};

      const git =
        developerMode
          ? (project.git || {})
          : {};
    const doctor = status.doctor || {};

    page.innerHTML = `
      <section class="page-header">
        <h2>⚙️  ${t("settings.title")}</h2>
        <p>
          ${t("settings.subtitle")}
        </p>
      </section>

      <section class="card-grid">
        <article class="card">
          <h3>🧠 Phoenix</h3>
          <p>
            ${t("settings.version")}:
            <strong class="technical-value">
              ${escapeHtml(phoenix.version)}
            </strong>
          </p>
          <p>
            ${t("settings.stage")}:
            <strong>
              ${escapeHtml(phoenix.stage)}
            </strong>
          </p>
          <p>
            Architektur:
            <strong>
              ${phoenix.architecture_locked
                ? `🔒 ${t("settings.locked")}`
                : `🔓 ${t("settings.open")}`}
            </strong>
          </p>
        </article>

        <article class="card">
          <h3>🩺 Doctor</h3>
          <p>
            ${t("settings.status")}:
            <strong>
              ${doctor.ok
                ? "✅ OK"
                : `❌ ${t("settings.error")}`}
            </strong>
          </p>
        </article>

        ${ownerInstallation ? `
          <article class="card developer-mode-card">
            <h3>
              🛠️ ${t("settings.developerMode")}
            </h3>

            <p>
              ${t("settings.developerModeDescription")}
            </p>

            <p>
              <strong>
                ${
                  developerMode
                    ? `🟢 ${t("settings.developerModeActive")}`
                    : `⚪ ${t("settings.developerModeInactive")}`
                }
              </strong>
            </p>

            <button
              id="developerModeToggle"
              type="button"
              class="btn"
            >
              ${
                developerMode
                  ? `⏹️ ${t("settings.developerModeDisable")}`
                  : `▶️ ${t("settings.developerModeEnable")}`
              }
            </button>
          </article>
        ` : ""}

        ${developerMode ? `
        <article class="card developer-update-card">
          <h3>
            🔄 ${t("settings.developerUpdate")}
          </h3>

          <p>
            ${t("settings.developerUpdateDescription")}
          </p>

          <button
            id="developerUpdateButton"
            type="button"
            class="btn"
          >
            🔄 ${t("settings.developerUpdate")}
          </button>

          <p id="developerUpdateStatus"></p>
        </article>
        ` : ""}

        ${developerMode ? `
        <article class="card developer-publish-card">
          <h3>
            🚀 ${t("settings.developerPublish")}
          </h3>

          <p>
            ${t("settings.developerPublishDescription")}
          </p>

          <p>
            ${t("settings.developerPublishedVersion")}:
            <strong class="technical-value">
              ${escapeHtml(
                releaseVersions.published_version || "–"
              )}
            </strong>
          </p>

          <p>
            ${t("settings.developerDevelopmentVersion")}:
            <strong class="technical-value">
              ${escapeHtml(
                releaseVersions.development_version || "–"
              )}
            </strong>
          </p>

          <p>
            ${t("settings.developerPublishVersion")}:
            <strong class="technical-value">
              ${escapeHtml(
                releaseVersions.publish_version || "–"
              )}
            </strong>
          </p>

          <div>
            <input
              id="developerVersionInput"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              value="${escapeHtml(
                releaseVersions.development_version || ""
              )}"
              placeholder="1.0.27"
            >

            <button
              id="developerVersionSaveButton"
              type="button"
              class="btn"
            >
              💾 ${t("settings.developerVersionSave")}
            </button>
          </div>

          <p id="developerVersionStatus"></p>

          <button
            id="developerPublishButton"
            type="button"
            class="btn"
          >
            🚀 ${t("settings.developerPublish")}
          </button>

          <p id="developerPublishStatus"></p>
        </article>
        ` : ""}

        ${developerMode ? `
        <article class="card">
          <h3>🌿 Git</h3>

          ${
            git.available === false
              ? `
                <p>
                  <strong>
                    ⚪ ${t("settings.gitUnavailable")}
                  </strong>
                </p>
              `
              : `
                <p>
                  ${t("settings.branch")}:
                  <strong>
                    ${escapeHtml(git.branch || "–")}
                  </strong>
                </p>

                <p>
                  ${t("settings.commit")}:
                  <strong class="technical-value">
                    ${escapeHtml(git.commit || "–")}
                  </strong>
                </p>

                <p>
                  ${t("settings.workingTree")}:
                  <strong>
                    ${
                      git.clean === true
                        ? `✅ ${t("settings.clean")}`
                        : git.clean === false
                          ? `⚠️ ${t("settings.dirty")}`
                          : `⚪ ${t("settings.gitUnknown")}`
                    }
                  </strong>
                </p>
              `
          }
        </article>
        ` : ""}

        <article class="card">
          <h3>🧠 ${t("settings.osSnapshots")}</h3>
          <p>
            ${t("settings.available")}:
            <strong>
              ${escapeHtml(snapshotData.count)}
            </strong>
          </p>
        </article>

        <article class="card">
          <h3>🏠 ${t("settings.haBackups")}</h3>
          <p>
            Verfügbar:
            <strong>
              ${escapeHtml(haBackupData.count || 0)}
            </strong>
          </p>
          <p>
            Home Assistant
          </p>
        </article>
      </section>

      <section class="page-header">
          <h2>🧠 ${t("settings.osSnapshots")}</h2>
        <p>
          ${t("settings.snapshotDescription")}
        </p>

        <button
          id="createSnapshotButton"
          type="button"
          class="btn"
        >
            🧠 ${t("settings.createSnapshot")}
        </button>

        <p id="snapshotActionStatus"></p>
      </section>

      <section class="card-grid">
        ${renderSnapshots(snapshotData)}
      </section>
        <section class="page-header">
          <h2>🏠 ${t("settings.haBackups")}</h2>

          <p>
            ${t("settings.haBackupDescription")}
          </p>

          <button
            id="createHaBackupButton"
            type="button"
            class="btn"
          >
            🏠 ${t("settings.createHaBackup")}
          </button>

          <p id="haBackupActionStatus"></p>
        </section>

        <section class="card-grid">
          ${renderHaBackups(haBackupData)}
        </section>
    `;

      const developerModeToggle =
        document.getElementById(
          "developerModeToggle"
        );

      const developerUpdateButton =
        document.getElementById(
          "developerUpdateButton"
        );

      const developerUpdateStatus =
        document.getElementById(
          "developerUpdateStatus"
        );

      const developerVersionInput =
        document.getElementById(
          "developerVersionInput"
        );

      const developerVersionSaveButton =
        document.getElementById(
          "developerVersionSaveButton"
        );

      const developerVersionStatus =
        document.getElementById(
          "developerVersionStatus"
        );

      const developerPublishButton =
        document.getElementById(
          "developerPublishButton"
        );

      const developerPublishStatus =
        document.getElementById(
          "developerPublishStatus"
        );

    const createButton =
      document.getElementById("createSnapshotButton");

    const actionStatus =
      document.getElementById("snapshotActionStatus");

    const createHaBackupButton =
      document.getElementById(
        "createHaBackupButton"
      );

    const haBackupActionStatus =
      document.getElementById(
        "haBackupActionStatus"
      );

    const restoreHaBackupButtons =
      document.querySelectorAll(
        ".restoreHaBackupButton"
      );

    const deleteHaBackupButtons =
      document.querySelectorAll(
        ".deleteHaBackupButton"
      );

    const renameButtons =
      document.querySelectorAll(".renameSnapshotButton");

    const verifyButtons =
      document.querySelectorAll(".verifySnapshotButton");

    const deleteButtons =
      document.querySelectorAll(".deleteSnapshotButton");

    if (createHaBackupButton) {
      createHaBackupButton.addEventListener(
        "click",
        async () => {
          const name = window.prompt(
            t("settings.haBackupNamePrompt"),
            t("settings.haChangesDefaultName", {
              date: new Date().toLocaleString()
            })
          );

          if (name === null) {
            return;
          }

          try {
            createHaBackupButton.disabled = true;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `⏳ ${t("settings.haBackupCreating")}`;
            }

            await createHaBackup(
              name.trim()
            );

            await renderSettings();

          } catch (error) {
            createHaBackupButton.disabled = false;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }


    for (const button of restoreHaBackupButtons) {
      button.addEventListener(
        "click",
        async () => {
          const slug =
            button.dataset.haBackupSlug || "";

          const name =
            button.dataset.haBackupName || slug;

          if (!slug) {
            return;
          }

          if (!window.confirm(
            t("settings.haRestoreConfirm", { name })
          )) {
            return;
          }

          try {
            button.disabled = true;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `⏳ ${t("settings.haSafetyRestoreStarting")}`;
            }

            await restoreHaBackup(slug);

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `✅ ${t("settings.haRestoreStarted")}`;
            }

          } catch (error) {
            button.disabled = false;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }


    for (const button of deleteHaBackupButtons) {
      button.addEventListener(
        "click",
        async () => {
          const slug =
            button.dataset.haBackupSlug || "";

          const name =
            button.dataset.haBackupName || slug;

          if (!slug) {
            return;
          }

          if (!window.confirm(
            t("settings.haDeleteConfirm", { name })
          )) {
            return;
          }

          try {
            button.disabled = true;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `⏳ ${t("settings.haBackupDeleting")}`;
            }

            await deleteHaBackup(slug);

            await renderSettings();

          } catch (error) {
            button.disabled = false;

            if (haBackupActionStatus) {
              haBackupActionStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }

    if (developerModeToggle) {
      developerModeToggle.addEventListener(
        "click",
        async () => {
          try {
            developerModeToggle.disabled = true;

            await setDeveloperMode(
              !developerMode
            );

            await renderSettings();

          } catch (error) {
            developerModeToggle.disabled = false;

            window.alert(
              error.message
            );
          }
        }
      );
    }

    if (
      developerVersionSaveButton &&
      developerVersionInput
    ) {
      developerVersionSaveButton.addEventListener(
        "click",
        async () => {
          const version =
            developerVersionInput.value.trim();

          try {
            developerVersionSaveButton.disabled = true;

            if (developerVersionStatus) {
              developerVersionStatus.textContent =
                `⏳ ${t("settings.developerVersionSaving")}`;
            }

            const response = await fetch(
              "./api/phoenix/system-control/developer-version",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  version
                })
              }
            );

            const result = await response.json();

            if (
              !response.ok ||
              result.status !== "ok"
            ) {
              throw new Error(
                result.error ||
                result.detail ||
                "Unknown error"
              );
            }

            if (developerVersionStatus) {
              developerVersionStatus.textContent =
                `✅ ${t("settings.developerVersionSaved")}`;
            }

            await renderSettings();

          } catch (error) {
            developerVersionSaveButton.disabled = false;

            if (developerVersionStatus) {
              developerVersionStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }

    if (developerPublishButton) {
      developerPublishButton.addEventListener(
        "click",
        async () => {
          const version =
            releaseVersions.development_version || "";

          const confirmed = window.confirm(
            t("settings.developerPublishConfirm", {
              version
            })
          );

          if (!confirmed) {
            return;
          }

          try {
            developerPublishButton.disabled = true;

            if (developerPublishStatus) {
              developerPublishStatus.textContent =
                `⏳ ${t("settings.developerPublishRunning")}`;
            }

            await publishDeveloperVersion();

            if (developerPublishStatus) {
              developerPublishStatus.textContent =
                `✅ ${t("settings.developerPublishSuccess")}`;
            }

            await renderSettings();

          } catch (error) {
            developerPublishButton.disabled = false;

            if (developerPublishStatus) {
              developerPublishStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }

    if (developerUpdateButton) {
      developerUpdateButton.addEventListener(
        "click",
        async () => {
          try {
            developerUpdateButton.disabled = true;

            if (developerUpdateStatus) {
              developerUpdateStatus.textContent =
                `⏳ ${t("settings.developerUpdateRunning")}`;
            }

            await updateDeveloperVersion();

            if (developerUpdateStatus) {
              developerUpdateStatus.textContent =
                `✅ ${t("settings.developerUpdateSuccess")}`;
            }

          } catch (error) {
            developerUpdateButton.disabled = false;

            if (developerUpdateStatus) {
              developerUpdateStatus.textContent =
                `❌ ${error.message}`;
            }
          }
        }
      );
    }

    for (const button of renameButtons) {
      button.addEventListener("click", async () => {
        const snapshotId = button.dataset.snapshotId || "";
        const currentName =
          button.dataset.snapshotName ||
          `Snapshot ${snapshotId}`;

        const name = window.prompt(
          t("settings.renamePrompt"),
          currentName
        );

        if (name === null) {
          return;
        }

        const trimmedName = name.trim();

        if (!trimmedName || trimmedName === currentName) {
          return;
        }

        if (!window.confirm(
          t("settings.renameConfirm", {
            oldName: currentName,
            newName: trimmedName
          })
        )) {
          return;
        }

        try {
          button.disabled = true;

          if (actionStatus) {
            actionStatus.textContent =
              `⏳ ${t("settings.renamingSnapshot")}`;
          }

          await renameSnapshot(snapshotId, trimmedName);
          await renderSettings();
        } catch (error) {
          button.disabled = false;

          if (actionStatus) {
            actionStatus.textContent =
              `❌ ${t("settings.renameFailed", {
                error: error.message
              })}`;
          }
        }
      });
    }

    for (const button of verifyButtons) {
      button.addEventListener("click", async () => {
        const snapshotId = button.dataset.snapshotId || "";

        try {
          button.disabled = true;

          if (actionStatus) {
            actionStatus.textContent =
              `⏳ ${t("settings.verifyingSnapshot")}`;
          }

          const result = await verifySnapshot(snapshotId);

          if (!result.verification?.ok) {
            throw new Error(
              result.verification?.reason ||
              t("settings.verificationFailed")
            );
          }

          await renderSettings();
        } catch (error) {
          button.disabled = false;

          if (actionStatus) {
            actionStatus.textContent =
              `❌ ${t("settings.verifyFailed", {
                error: error.message
              })}`;
          }
        }
      });
    }

    for (const button of deleteButtons) {
      button.addEventListener("click", async () => {
        const snapshotId = button.dataset.snapshotId || "";
        const snapshotName =
          button.dataset.snapshotName ||
          `Snapshot ${snapshotId}`;

        if (!window.confirm(
          t("settings.deleteConfirm", {
            name: snapshotName
          })
        )) {
          return;
        }

        try {
          button.disabled = true;

          if (actionStatus) {
            actionStatus.textContent =
              `⏳ ${t("settings.deletingSnapshot", {
                name: snapshotName
              })}`;
          }

          await deleteSnapshot(snapshotId);
          await renderSettings();
        } catch (error) {
          button.disabled = false;

          if (actionStatus) {
            actionStatus.textContent =
              `❌ ${t("settings.deleteFailed", {
                error: error.message
              })}`;
          }
        }
      });
    }

    const restoreButtons =
      document.querySelectorAll(".restoreSnapshotButton");

    for (const button of restoreButtons) {
      button.addEventListener("click", async () => {
        const snapshotId =
          button.dataset.snapshotId || "";

        const confirmed = window.confirm(
          t(
            "settings.restoreConfirm",
            { id: snapshotId }
          )
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;
        button.textContent = `⏳ ${t("settings.restoreRunning")}`;

        if (actionStatus) {
          actionStatus.textContent =
            t("settings.restoreProgress", { id: snapshotId });
        }

        try {
          await restoreSnapshot(snapshotId);

          if (actionStatus) {
            actionStatus.textContent =
              `✅ ${t("settings.restoreSuccess", { id: snapshotId })}`;
          }

          button.textContent = `✅ ${t("settings.restoreSuccess", { id: snapshotId })}`;
        } catch (error) {
          button.disabled = false;
          button.textContent = `♻️ ${t("settings.restoreSnapshot")}`;

          if (actionStatus) {
            actionStatus.textContent =
              `❌ ${t("settings.restoreFailed", { error: error.message })}`;
          }
        }
      });
    }

    if (createButton) {
      createButton.addEventListener("click", async () => {
        createButton.disabled = true;
        createButton.textContent = `⏳ ${t("settings.creatingSnapshot")}`;

        if (actionStatus) {
          actionStatus.textContent = "";
        }

        try {
          await createSnapshot();
          await renderSettings();
        } catch (error) {
          createButton.disabled = false;
          createButton.textContent = `📸 ${t("settings.createSnapshot")}`;

          if (actionStatus) {
            actionStatus.textContent =
              `❌ ${t("settings.snapshotCreateFailed", { error: error.message })}`;
          }
        }
      });
    }

  } catch (error) {
    page.innerHTML = `
      <section class="page-header">
        <h2>⚙️  ${t("settings.title")}</h2>
      </section>

      <article class="empty-card">
        ❌ ${t("settings.systemLoadFailed")}
        ${escapeHtml(error.message)}
        <hr>
        <small>
          URL: ${escapeHtml(window.location.href)}<br>
          Path: ${escapeHtml(window.location.pathname)}<br>
          Base: ${escapeHtml(document.baseURI)}
        </small>
      </article>
    `;
  }
}
