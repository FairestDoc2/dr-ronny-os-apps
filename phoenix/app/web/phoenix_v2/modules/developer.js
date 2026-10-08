import { t, getLanguage } from "../core/i18n.js?v=20260928-1050";
import { phoenixConfirm } from "../core/dialog.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson(path) {
  const response = await fetch(path);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.error ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

export async function renderDeveloper() {
  const page =
    document.getElementById("pageContent");

  if (!page) {
    return;
  }

  page.innerHTML = `
    <section class="page-header">
      <h2>🛠️ ${t("developer.title")}</h2>
      <p>${t("developer.subtitle")}</p>
    </section>

    <section class="card-grid">
      <article class="card">
        ${t("developer.loading")}
      </article>
    </section>
  `;

  try {
    const status = await loadJson(
      "api/phoenix/system-control/status"
    );

    const ownerInstallation =
      status.owner_installation === true;

    const developerMode =
      status.developer_mode === true;

    if (
      !ownerInstallation ||
      !developerMode
    ) {
      page.innerHTML = `
        <section class="page-header">
          <h2>🛠️ ${t("developer.title")}</h2>
          <p>${t("developer.subtitle")}</p>
        </section>

        <section class="card-grid">
          <article class="card">
            <h3>
              🔒 ${t("developer.accessDeniedTitle")}
            </h3>

            <p>
              ${t("developer.accessDeniedText")}
            </p>
          </article>
        </section>
      `;

      return;
    }

    const project =
      status.project || {};

    const releaseVersions =
      status.release_versions || {};

    const git =
      project.git || {};

    page.innerHTML = `
      <section class="page-header">
        <h2>🛠️ ${t("developer.title")}</h2>
        <p>${t("developer.subtitle")}</p>
      </section>

      <section class="card-grid">
        <article class="card developer-publish-card">
          <h3>
            🚀 ${t("settings.developerPublish")}
          </h3>

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
              placeholder="1.2.0"
            >

            <div class="developer-version-bump">
              <button type="button" class="btn"
                data-version-bump="patch">
                + ${t("developer.versionPatch")}
              </button>
              <button type="button" class="btn"
                data-version-bump="minor">
                + ${t("developer.versionMinor")}
              </button>
              <button type="button" class="btn"
                data-version-bump="major">
                + ${t("developer.versionMajor")}
              </button>
            </div>

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

        <article class="card">
          <h3>🌿 Git – Entwicklungsstatus</h3>

          ${
            git.available === false
              ? `
                <p>⚪ ${t("settings.gitUnavailable")}</p>
              `
              : `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0;">
                  <div style="padding:14px;border:1px solid var(--border-color, #5555);border-radius:10px;">
                    <div style="opacity:.75;font-size:.85rem;margin-bottom:6px;">
                      ${t("settings.branch")}
                    </div>
                    <strong class="technical-value">
                      ${escapeHtml(git.branch || "–")}
                    </strong>
                  </div>

                  <div style="padding:14px;border:1px solid var(--border-color, #5555);border-radius:10px;">
                    <div style="opacity:.75;font-size:.85rem;margin-bottom:6px;">
                      ${t("settings.commit")}
                    </div>
                    <strong class="technical-value">
                      ${escapeHtml(git.commit || "–")}
                    </strong>
                  </div>
                </div>

                <div style="padding:14px;border-radius:10px;background:var(--card-background-color,transparent);">
                  <strong>
                    ${
                      git.clean === true
                        ? `✅ ${t("settings.clean")}`
                        : git.clean === false
                          ? `⚠️ ${t("settings.dirty")}`
                          : `⚪ ${t("settings.gitUnknown")}`
                    }
                  </strong>
                  <p style="margin:8px 0 0;opacity:.8;font-size:.9rem;">
                    ${
                      git.clean === true
                        ? t("settings.gitCleanDescription")
                        : git.clean === false
                          ? t("settings.gitDirtyDescription")
                          : t("settings.gitUnknownDescription")
                    }
                  </p>
                </div>
              `
          }
        </article>

      </section>
      <section class="phoenix-github-grid">
        <article class="card" id="githubStatsCard">
          <h3>📊 ${t("settings.githubStatsTitle")}</h3>
          <p>${t("settings.githubPeriod")}</p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0;">

            <div class="card">
              <p>${t("settings.githubViews")}</p>
              <strong id="githubViews">–</strong>
            </div>

            <div class="card">
              <p>${t("settings.githubVisitors")}</p>
              <strong id="githubVisitors">–</strong>
            </div>

            <div class="card">
              <p>${t("settings.githubClones")}</p>
              <strong id="githubClones">–</strong>
            </div>

            <div class="card">
              <p>${t("settings.githubCloners")}</p>
              <strong id="githubCloners">–</strong>
            </div>

          </div>


        </article>
        <article class="card" id="githubRepositoryCard">
          <h3>${t("settings.githubRepositoryTitle")}</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0;">
            <div class="card">
              <p>⭐ ${t("settings.githubStars")}</p>
              <strong id="githubStars">–</strong>
            </div>
            <div class="card">
              <p>${t("settings.githubForks")}</p>
              <strong id="githubForks">–</strong>
            </div>
            <div class="card">
              <p>${t("settings.githubIssues")}</p>
              <strong id="githubIssues">–</strong>
            </div>
            <div class="card">
              <p>${t("settings.githubCreated")}</p>
              <strong id="githubCreated">–</strong>
            </div>
            <div class="card">
              <p>${t("settings.githubLastPush")}</p>
              <strong id="githubLastPush">–</strong>
            </div>
          </div>

          <p id="githubStatsStatus">
            ${t("settings.githubLoading")}
          </p>
        </article>
      </section>

      <section class="phoenix-github-insights" aria-label="GitHub insights">
        <h3>📈 ${t("settings.insightsTitle")}</h3>
        <div class="phoenix-github-grid phoenix-insights-grid">
          <article class="card"><h3>${t("settings.insightsDaily")}</h3><div id="githubInsightsDaily" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsClones")}</h3><div id="githubInsightsClones" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsReferrers")}</h3><div id="githubInsightsReferrers" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsPaths")}</h3><div id="githubInsightsPaths" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsCommits")}</h3><div id="githubInsightsCommits" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsBranches")}</h3><div id="githubInsightsBranches" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsActions")}</h3><div id="githubInsightsActions" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsContributors")}</h3><div id="githubInsightsContributors" class="phoenix-insights-content"></div></article>
          <article class="card"><h3>${t("settings.insightsInstalls")}</h3><p>${t("settings.insightsInstallsDisclaimer")}</p></article>
        </div>
      </section>
    `;

    async function loadGithubStats() {
      const statusElement =
        document.getElementById("githubStatsStatus");

      const fields = {
        githubViews: ["views", "count"],
        githubVisitors: ["views", "uniques"],
        githubClones: ["clones", "count"],
        githubCloners: ["clones", "uniques"],
        githubStars: ["repository_stats", "stars"],
        githubForks: ["repository_stats", "forks"],
        githubIssues: ["repository_stats", "open_issues"]
      };

      const unavailable =
        t("settings.githubUnavailable");

      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      };

      try {
        const data = await loadJson(
          "api/phoenix/system-control/github-stats"
        );

        let hasError = false;

        for (const [id, [group, property]] of
          Object.entries(fields)) {
          const result = data[group];
          const value = result?.[property];

          if (
            result?.status === "ok" &&
            typeof value === "number" &&
            Number.isFinite(value)
          ) {
            setValue(id, value.toLocaleString());
          } else {
            setValue(id, unavailable);
            hasError = true;
          }
        }

        const repositoryDates = {
          githubCreated: "created_at",
          githubLastPush: "pushed_at"
        };

        for (const [id, property] of
          Object.entries(repositoryDates)) {
          const raw =
            data.repository_stats?.[property];

          const date =
            typeof raw === "string"
              ? new Date(raw)
              : new Date(NaN);

          if (
            data.repository_stats?.status === "ok" &&
            Number.isFinite(date.getTime())
          ) {
            setValue(
              id,
              date.toLocaleString(
                ({
                  de: "de-DE",
                  en: "en-US",
                  ru: "ru-RU",
                  it: "it-IT",
                  es: "es-ES",
                  ar: "ar-SA",
                  tr: "tr-TR",
                  th: "th-TH"
                })[getLanguage()] || "de-DE",
                {
                  dateStyle: "medium",
                  timeStyle: "short"
                }
              )
            );
          } else {
            setValue(id, unavailable);
            hasError = true;
          }
        }

        if (statusElement) {
          statusElement.textContent =
            hasError ? unavailable : "";
        }

      } catch (error) {
        for (const id of [
          ...Object.keys(fields),
          "githubCreated",
          "githubLastPush"
        ]) {
          setValue(id, unavailable);
        }

        if (statusElement) {
          statusElement.textContent = unavailable;
        }

        console.warn(
          "Phoenix GitHub statistics unavailable:",
          error
        );
      }
    }

    void loadGithubStats();

    async function loadGithubInsights() {
      const unavailable = t("settings.insightsUnavailable");
      const empty = t("settings.insightsEmpty");
      const ids = {
        views_daily: "githubInsightsDaily",
        clones_daily: "githubInsightsClones",
        referrers: "githubInsightsReferrers",
        popular_paths: "githubInsightsPaths",
        commits: "githubInsightsCommits",
        branches: "githubInsightsBranches",
        workflow_runs: "githubInsightsActions",
        contributors: "githubInsightsContributors"
      };
      const render = (name, html) => {
        const el = document.getElementById(ids[name]);
        if (el && page.contains(el)) el.innerHTML = html;
      };
      const safe = (v) => escapeHtml(v ?? "–");
      const number = (v) => typeof v === "number" && Number.isFinite(v)
        ? v.toLocaleString(getLanguage()) : "–";
      const date = (v) => {
        const d = new Date(v);
        return v && Number.isFinite(d.getTime())
          ? d.toLocaleDateString(getLanguage()) : "–";
      };
      const table = (rows) => rows.length ?
        `<div class="phoenix-insights-list">${rows.map(row =>
          `<div class="phoenix-insights-row">${row}</div>`).join("")}</div>` :
        `<p>${safe(empty)}</p>`;
      const item = (text, metric) =>
        `<span class="phoenix-insights-label">${safe(text)}</span><strong>${safe(metric)}</strong>`;
      const showBars = (items) => {
        const max = Math.max(1, ...items.map(row => Number(row.count) || 0));
        return table(items.map(row =>
          `<div class="phoenix-insights-bar-label">${safe(date(row.timestamp))}</div>`+
          `<div class="phoenix-insights-bar-track"><div class="phoenix-insights-bar" style="width:${Math.max(0, Math.min(100, (Number(row.count) || 0) / max * 100))}%"></div></div>`+
          `<strong>${safe(number(row.count))}</strong>`));
      };
      try {
        const data = await loadJson("api/phoenix/system-control/github-insights");
        for (const name of Object.keys(ids)) {
          const result = data[name];
          if (result?.status !== "ok" || !Array.isArray(result.items)) {
            render(name, `<p>${safe(unavailable)}</p>`);
            continue;
          }
          const rows = result.items;
          switch (name) {
            case "views_daily":
            case "clones_daily":
              render(name, showBars(rows)); break;
            case "referrers":
              render(name, table(rows.map(r => item(r.referrer, number(r.count))))); break;
            case "popular_paths":
              render(name, table(rows.map(r => item(r.path, number(r.count))))); break;
            case "commits":
              render(name, table(rows.map(r =>
                item(`${r.sha} · ${r.message}`, date(r.date))))); break;
            case "branches":
              render(name, table(rows.map(r => item(r.name, r.sha)))); break;
            case "workflow_runs":
              render(name, table(rows.map(r =>
                item(`${r.name} · ${r.branch || "–"}`, r.conclusion || r.status || "–")))); break;
            case "contributors":
              render(name, table(rows.map(r => item(r.login, number(r.contributions))))); break;
          }
        }
      } catch (error) {
        for (const name of Object.keys(ids)) render(name, `<p>${safe(unavailable)}</p>`);
        console.warn("Phoenix GitHub insights unavailable", error);
      }
    }
    void loadGithubInsights();


    const developerVersionInput =
      document.getElementById("developerVersionInput");

    const developerVersionSaveButton =
      document.getElementById("developerVersionSaveButton");

    const developerVersionStatus =
      document.getElementById("developerVersionStatus");

    const developerPublishButton =
      document.getElementById("developerPublishButton");

    const developerPublishStatus =
      document.getElementById("developerPublishStatus");

    const versionBumpButtons =
      page.querySelectorAll("[data-version-bump]");

    for (const button of versionBumpButtons) {
      button.addEventListener("click", () => {
        const current = developerVersionInput.value.trim();
        const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);

        if (!match) {
          developerVersionStatus.textContent =
            "❌ " + current;
          return;
        }

        let major = Number(match[1]);
        let minor = Number(match[2]);
        let patch = Number(match[3]);

        if (button.dataset.versionBump === "major") {
          major++;
          minor = 0;
          patch = 0;
        } else if (button.dataset.versionBump === "minor") {
          minor++;
          patch = 0;
        } else {
          patch++;
        }

        developerVersionInput.value =
          `${major}.${minor}.${patch}`;

        developerVersionStatus.textContent = "";
      });
    }

    if (developerVersionSaveButton && developerVersionInput) {
      developerVersionSaveButton.addEventListener("click", async () => {
        const version = developerVersionInput.value.trim();

        developerVersionSaveButton.disabled = true;

        try {
          developerVersionStatus.textContent =
            `⏳ ${t("settings.developerVersionSaving")}`;

          const response = await fetch(
            "./api/phoenix/system-control/developer-version",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ version })
            }
          );

          const result = await response.json();

          if (!response.ok || result.status !== "ok") {
            throw new Error(
              result.error || result.detail || "Unknown error"
            );
          }

          developerVersionStatus.textContent =
            `✅ ${t("settings.developerVersionSaved")}`;

          await renderDeveloper();

        } catch (error) {
          developerVersionStatus.textContent =
            `❌ ${error.message}`;
        } finally {
          developerVersionSaveButton.disabled = false;
        }
      });
    }

    if (developerPublishButton) {
      developerPublishButton.addEventListener("click", async () => {
        const version =
          releaseVersions.development_version || "";

        const confirmed = await phoenixConfirm(
          t("settings.developerPublishConfirm", { version })
        );

        if (!confirmed) {
          return;
        }

        developerPublishButton.disabled = true;

        try {
          developerPublishStatus.textContent =
            `⏳ ${t("settings.developerPublishRunning")}`;

          const response = await fetch(
            "api/phoenix/system-control/developer-publish",
            { method: "POST" }
          );

          const data = await response.json();

          if (!response.ok || data.status === "error") {
            throw new Error(
              data.detail ||
              data.error ||
              "Phoenix-Version konnte nicht veröffentlicht werden."
            );
          }

          developerPublishStatus.textContent =
            `✅ ${t("settings.developerPublishSuccess")}`;

          await renderDeveloper();

        } catch (error) {
          developerPublishStatus.textContent =
            `❌ ${error.message}`;
        } finally {
          developerPublishButton.disabled = false;
        }
      });
    }

    const developerUpdateButton =
      document.getElementById("developerUpdateButton");

    const developerUpdateStatus =
      document.getElementById("developerUpdateStatus");

    if (developerUpdateButton) {
      developerUpdateButton.addEventListener(
        "click",
        async () => {
          developerUpdateButton.disabled = true;

          try {
            developerUpdateStatus.textContent =
              `⏳ ${t("settings.developerUpdateRunning")}`;

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

            developerUpdateStatus.textContent =
              `✅ ${t("settings.developerUpdateSuccess")}`;

          } catch (error) {
            developerUpdateStatus.textContent =
              `❌ ${error.message}`;

          } finally {
            developerUpdateButton.disabled = false;
          }
        }
      );
    }

  } catch (error) {
    page.innerHTML = `
      <section class="page-header">
        <h2>🛠️ ${t("developer.title")}</h2>
      </section>

      <section class="card-grid">
        <article class="card">
          <h3>
            ❌ ${t("developer.errorTitle")}
          </h3>

          <p>
            ${escapeHtml(
              error.message || error
            )}
          </p>
        </article>
      </section>
    `;
  }
}
