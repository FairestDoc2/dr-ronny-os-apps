import {
  loadHomeAssistantEntityRegistry,
  loadHomeAssistantEntities,
  loadHomeAssistantDevices,
  loadHomeAssistantAreas,
  loadHomeAssistantLabels,
  loadHomeAssistantAutomations,
  loadHomeAssistantScripts,
  loadAutomationConfig,
  loadScriptConfig,
  setDeviceArea,
  setDeviceLabels,
  setEntityLabels,
  setDeviceName,
  setEntityName,
  loadRonnyAiState,
  ignoreRonnyAiSuggestion,
  unignoreRonnyAiSuggestion,
  cleanupRonnyAiOrphanedAutomation,
  addRonnyAiHistory
} from "../core/api.js?v=20260928-1050";

import {
  t
} from "../core/i18n.js?v=20260928-1050";


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


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function setText(root, selector, value) {
  const element = root.querySelector(selector);

  if (element) {
    element.textContent = String(value);
  }
}


export async function renderRonnyAI() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <style>
      .ronny-ai {
        display: grid;
        gap: 18px;
      }

      .ronny-ai-hero {
        position: relative;
        overflow: hidden;

        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 18px;

        padding: 22px;

        border: 1px solid var(--border);
        border-radius: var(--radius-medium);

        background:
          radial-gradient(
            circle at 0% 0%,
            rgba(66,165,245,.17),
            transparent 38%
          ),
          radial-gradient(
            circle at 100% 0%,
            rgba(216,82,199,.13),
            transparent 34%
          ),
          var(--surface);

        box-shadow: var(--shadow);
      }

      .ronny-ai-logo {
        width: 82px;
        height: 82px;

        object-fit: cover;
        border-radius: 50%;

        border: 2px solid rgba(255,255,255,.12);

        box-shadow:
          0 0 28px rgba(66,165,245,.18),
          0 0 42px rgba(216,82,199,.10);
      }

      .ronny-ai-hero > * {
        min-width: 0;
      }

      .ronny-ai-hero h2 {
        margin: 0;
        max-width: 100%;
        font-size: clamp(1.55rem, 3vw, 2.2rem);
        overflow-wrap: anywhere;
      }

      .ronny-ai-hero p {
        margin: 7px 0 0;
        width: 100%;
        max-width: 720px;
        opacity: .72;
        line-height: 1.5;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      @media (max-width: 760px) {
        .ronny-ai-hero {
          min-width: 0;
          max-width: 100%;
        }

        .ronny-ai-hero p {
          max-width: 100%;
        }
      }

      .ronny-ai-status {
        padding: 8px 12px;
        border-radius: 999px;

        font-size: .78rem;
        font-weight: 800;

        white-space: nowrap;

        background: rgba(76,175,80,.11);
        border: 1px solid rgba(76,175,80,.24);
      }


      .ronny-ai-stats {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));

        gap: 12px;
      }

      .ronny-ai-stat {
        padding: 18px;

        border: 1px solid var(--border);
        border-radius: var(--radius-medium);

        background: var(--surface);
        box-shadow: var(--shadow);
      }

      .ronny-ai-stat-value {
        display: block;

        font-size: clamp(1.7rem, 3vw, 2.35rem);
        font-weight: 850;
        line-height: 1;
      }

      .ronny-ai-stat-label {
        display: block;

        margin-top: 8px;

        font-size: .84rem;
        opacity: .68;
      }


      .ronny-ai-grid {
        display: grid;

        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 16px;
      }

      .ronny-ai-panel {
        padding: 20px;

        border: 1px solid var(--border);
        border-radius: var(--radius-medium);

        background: var(--surface);
        box-shadow: var(--shadow);
      }

      .ronny-ai-panel h3 {
        display: flex;
        align-items: center;
        gap: 9px;

        margin: 0 0 7px;
      }

      .ronny-ai-panel > p {
        margin: 0 0 16px;

        opacity: .68;
        line-height: 1.45;
      }


      .ronny-ai-findings {
        display: grid;
        gap: 9px;
      }

      .ronny-ai-finding {
        display: flex;
        align-items: center;
        gap: 10px;

        padding: 11px 12px;

        border-radius: 11px;

        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.055);
      }

      .ronny-ai-finding strong {
        margin-left: auto;
        font-size: 1rem;
      }

      .ronny-ai-finding-clickable {
        cursor: pointer;
        user-select: none;
      }

      .ronny-ai-finding-clickable:hover {
        background: rgba(255,255,255,.055);
      }

      .ronny-ai-finding-details {
        display: grid;
        gap: 8px;

        padding: 10px 12px;

        border-radius: 11px;

        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.045);
      }

      .ronny-ai-finding-details[hidden] {
        display: none;
      }

      .ronny-ai-finding-detail-item {
        padding: 8px 0;

        border-bottom:
          1px solid rgba(255,255,255,.05);
      }

      .ronny-ai-finding-detail-item:last-child {
        border-bottom: 0;
      }

      .ronny-ai-finding-detail-item strong {
        display: block;
        margin: 0 0 4px;
      }

      .ronny-ai-finding-detail-entity {
        display: block;

        margin-top: 2px;

        font-size: .82rem;
        opacity: .67;

        overflow-wrap: anywhere;
      }

      .ronny-ai-device-detail-toggle {
        width: 100%;

        display: flex;
        align-items: center;
        gap: 10px;

        padding: 0;

        border: 0;
        background: transparent;

        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .ronny-ai-device-detail-name {
        flex: 1 1 auto;
        min-width: 0;

        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .ronny-ai-device-detail-count {
        flex: 0 0 auto;

        font-size: .82rem;
        opacity: .65;
      }

      .ronny-ai-device-entities {
        display: grid;
        gap: 2px;

        margin-top: 8px;
        padding-left: 12px;
      }

      .ronny-ai-device-entities[hidden] {
        display: none;
      }


      .ronny-ai-feature {
        display: flex;
        gap: 12px;
        align-items: flex-start;

        padding: 12px 0;

        border-bottom:
          1px solid rgba(255,255,255,.055);
      }

      .ronny-ai-feature:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }

      .ronny-ai-feature-icon {
        width: 36px;
        height: 36px;

        flex: 0 0 auto;

        display: grid;
        place-items: center;

        border-radius: 10px;

        background: rgba(66,165,245,.10);
      }

      .ronny-ai-feature strong {
        display: block;
        margin-bottom: 3px;
      }

      .ronny-ai-feature span {
        font-size: .84rem;
        opacity: .64;
        line-height: 1.4;
      }




      /* PHOENIX: einheitliche lange Ronny-AI-Listen */

      /*
       * Systemprüfung:
       * Die vier Detailbereiche bleiben aufklappbar,
       * wachsen aber nicht mehr endlos über die Seite.
       */
      .ronny-ai-finding-details {
        max-height: 420px;
        overflow-y: auto;
        overflow-x: hidden;

        overscroll-behavior: contain;
        scrollbar-gutter: stable;

        padding-right: 4px;
      }

      /*
       * Bereits gruppierte Geräte-Unterdetails innerhalb
       * der Systemprüfung etwas kompakter halten.
       */
      .ronny-ai-device-entities {
        max-height: 280px;
        overflow-y: auto;
        overflow-x: hidden;

        overscroll-behavior: contain;
        scrollbar-gutter: stable;
      }

      /*
       * Intelligente Vorschläge:
       * Bereiche / Labels / Namen.
       */
      .ronny-ai-smart-section-content {
        max-height: 420px;
        overflow-y: auto;
        overflow-x: hidden;

        overscroll-behavior: contain;
        scrollbar-gutter: stable;

        padding-right: 4px;
      }

      /*
       * Automationen & Skripte:
       * Logikprüfung und Verbesserungsvorschläge können
       * ebenfalls größere Ergebnislisten erzeugen.
       */
      #ronnyAiLogicStatus,
      #ronnyAiImprovementSuggestions {
        max-height: 420px;
        overflow-y: auto;
        overflow-x: hidden;

        overscroll-behavior: contain;
        scrollbar-gutter: stable;

        padding-right: 4px;
      }

      /*
       * Änderungsverlauf:
       * Der komplette Verlauf bleibt erreichbar,
       * verlängert aber nicht mehr die ganze Seite.
       */
      #ronnyAiHistoryList {
        max-height: 460px;
        overflow-y: auto;
        overflow-x: hidden;

        overscroll-behavior: contain;
        scrollbar-gutter: stable;

        padding-right: 4px;
      }

      /*
       * Einheitliche Scrollbars für alle langen
       * Ronny-AI-Bereiche.
       */
      .ronny-ai-finding-details,
      .ronny-ai-device-entities,
      .ronny-ai-smart-section-content,
      #ronnyAiLogicStatus,
      #ronnyAiImprovementSuggestions,
      #ronnyAiHistoryList {
        scrollbar-width: thin;
        scrollbar-color:
          rgba(160,170,210,.42)
          rgba(255,255,255,.025);
      }

      .ronny-ai-finding-details::-webkit-scrollbar,
      .ronny-ai-device-entities::-webkit-scrollbar,
      .ronny-ai-smart-section-content::-webkit-scrollbar,
      #ronnyAiLogicStatus::-webkit-scrollbar,
      #ronnyAiImprovementSuggestions::-webkit-scrollbar,
      #ronnyAiHistoryList::-webkit-scrollbar {
        width: 7px;
      }

      .ronny-ai-finding-details::-webkit-scrollbar-track,
      .ronny-ai-device-entities::-webkit-scrollbar-track,
      .ronny-ai-smart-section-content::-webkit-scrollbar-track,
      #ronnyAiLogicStatus::-webkit-scrollbar-track,
      #ronnyAiImprovementSuggestions::-webkit-scrollbar-track,
      #ronnyAiHistoryList::-webkit-scrollbar-track {
        background: rgba(255,255,255,.025);
        border-radius: 999px;
      }

      .ronny-ai-finding-details::-webkit-scrollbar-thumb,
      .ronny-ai-device-entities::-webkit-scrollbar-thumb,
      .ronny-ai-smart-section-content::-webkit-scrollbar-thumb,
      #ronnyAiLogicStatus::-webkit-scrollbar-thumb,
      #ronnyAiImprovementSuggestions::-webkit-scrollbar-thumb,
      #ronnyAiHistoryList::-webkit-scrollbar-thumb {
        background: rgba(160,170,210,.42);
        border-radius: 999px;
      }

      .ronny-ai-finding-details::-webkit-scrollbar-thumb:hover,
      .ronny-ai-device-entities::-webkit-scrollbar-thumb:hover,
      .ronny-ai-smart-section-content::-webkit-scrollbar-thumb:hover,
      #ronnyAiLogicStatus::-webkit-scrollbar-thumb:hover,
      #ronnyAiImprovementSuggestions::-webkit-scrollbar-thumb:hover,
      #ronnyAiHistoryList::-webkit-scrollbar-thumb:hover {
        background: rgba(175,185,225,.62);
      }


      /* PHOENIX: gruppierte Label-Vorschläge */

      .ronny-ai-label-group {
        display: grid;
        gap: 8px;

        padding: 8px;

        border-radius: 12px;

        background: rgba(255,255,255,.018);
        border: 1px solid rgba(255,255,255,.05);
      }

      .ronny-ai-label-group + .ronny-ai-label-group {
        margin-top: 10px;
      }

      .ronny-ai-label-group-toggle {
        width: 100%;

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        padding: 9px 10px;

        border: 0;
        border-radius: 9px;

        color: inherit;
        background: rgba(255,255,255,.035);

        font: inherit;
        cursor: pointer;

        text-align: left;
      }

      .ronny-ai-label-group-toggle:hover {
        background: rgba(255,255,255,.055);
      }

      .ronny-ai-label-group-title {
        min-width: 0;

        display: flex;
        align-items: center;
        gap: 8px;

        font-weight: 700;
      }

      .ronny-ai-label-group-count {
        flex: 0 0 auto;

        min-width: 28px;

        display: inline-flex;
        align-items: center;
        justify-content: center;

        padding: 4px 8px;

        border-radius: 999px;

        font-size: .76rem;
        font-weight: 700;

        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.07);
      }

      .ronny-ai-label-group-content {
        display: grid;
        gap: 10px;
      }

      .ronny-ai-label-group-content[hidden] {
        display: none;
      }

      .ronny-ai-suggestion-list {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }

      .ronny-ai-suggestion-card {
        padding: 16px;

        border-radius: 13px;
        border: 1px solid rgba(66,165,245,.18);

        background:
          linear-gradient(
            135deg,
            rgba(66,165,245,.07),
            rgba(216,82,199,.04)
          ),
          rgba(255,255,255,.025);
      }

      .ronny-ai-suggestion-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .ronny-ai-suggestion-device {
        min-width: 0;
      }

      .ronny-ai-suggestion-device strong {
        display: block;
        font-size: 1rem;
        overflow-wrap: anywhere;
      }

      .ronny-ai-confidence {
        flex: 0 0 auto;

        padding: 5px 9px;

        border-radius: 999px;

        font-size: .74rem;
        font-weight: 800;

        background: rgba(76,175,80,.11);
        border: 1px solid rgba(76,175,80,.22);
      }

      .ronny-ai-suggestion-details {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));

        gap: 8px 14px;

        margin-top: 14px;

        font-size: .86rem;
      }

      .ronny-ai-suggestion-details div {
        min-width: 0;
      }

      .ronny-ai-suggestion-details span {
        display: block;
        opacity: .58;
        margin-bottom: 2px;
      }

      .ronny-ai-suggestion-reason {
        margin-top: 12px;

        padding: 10px 12px;

        border-radius: 10px;

        font-size: .84rem;
        line-height: 1.45;

        background: rgba(255,255,255,.035);
      }


      .ronny-ai-decision-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;

        margin: 10px 0 12px;
      }

      .ronny-ai-decision-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;

        min-height: 27px;
        padding: 4px 9px;

        border-radius: 999px;

        font-size: .76rem;
        font-weight: 700;
        line-height: 1;

        letter-spacing: .02em;

        background: rgba(255,255,255,.045);
        border: 1px solid rgba(255,255,255,.075);
      }

      .ronny-ai-decision-badge.priority-1 {
        background: rgba(255,80,80,.09);
        border-color: rgba(255,80,80,.22);
      }

      .ronny-ai-decision-badge.priority-2 {
        background: rgba(255,170,60,.08);
        border-color: rgba(255,170,60,.20);
      }

      .ronny-ai-decision-badge.priority-3 {
        background: rgba(80,160,255,.10);
        border-color: rgba(80,160,255,.28);
      }

      .ronny-ai-decision-target {
        display: flex;
        align-items: center;
        gap: 8px;

        margin: 0 0 12px;
        padding: 9px 10px;

        border-radius: 10px;

        font-size: .84rem;

        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.05);

        overflow-wrap: anywhere;
      }

      .ronny-ai-decision-target-arrow {
        flex: 0 0 auto;
        opacity: .55;
      }

      .ronny-ai-suggestion-card.is-prepared {
        border-color: rgba(255,190,70,.32);
        box-shadow:
          inset 0 0 0 1px rgba(255,190,70,.05);
      }

      .ronny-ai-suggestion-card.is-prepared
      .ronny-ai-action.primary {
        border-color: rgba(255,190,70,.38);
      }

      .ronny-ai-prepared-state {
        display: flex;
        align-items: center;
        gap: 8px;

        margin-top: 10px;
        padding: 8px 10px;

        border-radius: 9px;

        font-size: .79rem;
        font-weight: 600;

        background: rgba(255,180,60,.065);
        border: 1px solid rgba(255,180,60,.16);
      }

      .ronny-ai-prepared-state[hidden] {
        display: none;
      }


      .ronny-ai-smart-value {
        display: grid;
        gap: 5px;
        margin: 9px 0 11px;
        padding: 10px 11px;
        border-radius: 10px;
        background: rgba(255,255,255,.025);
        border: 1px solid rgba(255,255,255,.05);
        overflow-wrap: anywhere;
      }

      .ronny-ai-smart-old {
        font-size: .78rem;
        opacity: .58;
      }

      .ronny-ai-smart-new {
        font-size: .9rem;
        font-weight: 650;
      }

      .ronny-ai-smart-editor {
        display: none;
        gap: 8px;
        margin-top: 10px;
      }

      .ronny-ai-smart-editor.is-open {
        display: grid;
      }

      .ronny-ai-smart-input,
      .ronny-ai-smart-select {
        width: 100%;
        box-sizing: border-box;
        padding: 9px 10px;
        border-radius: 9px;
        color: inherit;
        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.08);
      }

      .ronny-ai-smart-select {
        max-height: 190px;
        overflow-y: auto;

        color-scheme: dark;

        background:
          rgba(20,22,30,.96);
      }

      .ronny-ai-smart-select option {
        padding: 8px 10px;
        color: inherit;
        background: rgb(28,30,40);
      }


      .ronny-ai-smart-section {
        margin-top: 10px;
      }

      .ronny-ai-smart-section-toggle {
        width: 100%;

        display: flex;
        align-items: center;
        gap: 10px;

        padding: 10px 12px;

        border-radius: 10px;

        color: inherit;
        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.06);

        cursor: pointer;
        text-align: left;
      }

      .ronny-ai-smart-section-toggle strong {
        flex: 1 1 auto;
      }

      .ronny-ai-smart-section-count {
        font-size: .8rem;
        opacity: .65;
      }

            .ronny-ai-smart-section-main {
        flex: 1 1 auto;
        min-width: 0;

        display: grid;
        gap: 4px;

        text-align: left;
      }

      .ronny-ai-smart-section-main strong {
        display: block;
        line-height: 1.25;
      }

      .ronny-ai-smart-section-main small {
        display: block;

        font-size: .78rem;
        line-height: 1.35;
        font-weight: 400;

        opacity: .62;
      }

.ronny-ai-smart-section-content {
        margin-top: 8px;

        max-height: 420px;
        overflow-y: auto;

        padding-right: 4px;
      }

      .ronny-ai-smart-section-content[hidden] {
        display: none;
      }

      .ronny-ai-prepared-dot {
        width: 8px;
        height: 8px;

        flex: 0 0 auto;

        border-radius: 50%;
        background: currentColor;

        opacity: .8;
      }

      .ronny-ai-suggestion-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        margin-top: 14px;
      }

      .ronny-ai-action {
        appearance: none;

        padding: 8px 12px;

        border-radius: 9px;
        border: 1px solid var(--border);

        background: rgba(255,255,255,.055);
        color: inherit;

        cursor: pointer;
        font: inherit;
        font-size: .82rem;
        font-weight: 700;
      }

      .ronny-ai-action:hover {
        background: rgba(255,255,255,.09);
      }

      .ronny-ai-action.primary {
        background: rgba(66,165,245,.15);
        border-color: rgba(66,165,245,.30);
      }

      .ronny-ai-area-editor {
        display: none;

        gap: 8px;
        align-items: center;
        flex-wrap: wrap;

        margin-top: 12px;
      }

      .ronny-ai-area-editor.active {
        display: flex;
      }

      .ronny-ai-area-select {
        min-width: 180px;
        flex: 1 1 220px;

        padding: 8px 10px;

        border-radius: 9px;
        border: 1px solid var(--border);

        background: var(--surface);
        color: inherit;
      }

      .ronny-ai-no-suggestions {
        margin-top: 14px;
        padding: 13px;

        border-radius: 11px;

        background: rgba(76,175,80,.07);
        border: 1px solid rgba(76,175,80,.14);

        font-size: .86rem;
      }

      @media (max-width: 600px) {
        .ronny-ai-suggestion-details {
          grid-template-columns: 1fr;
        }
      }

      .ronny-ai-control {
        padding: 18px 20px;

        display: flex;
        align-items: center;
        gap: 14px;

        border-radius: var(--radius-medium);

        background:
          linear-gradient(
            135deg,
            rgba(66,165,245,.09),
            rgba(216,82,199,.07)
          ),
          var(--surface);

        border: 1px solid var(--border);
        box-shadow: var(--shadow);
      }

      .ronny-ai-control-icon {
        font-size: 1.6rem;
      }

      .ronny-ai-control strong {
        display: block;
        margin-bottom: 3px;
      }

      .ronny-ai-control span {
        font-size: .84rem;
        opacity: .68;
      }


      @media (max-width: 900px) {
        .ronny-ai-stats {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .ronny-ai-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        .ronny-ai-hero {
          grid-template-columns: auto 1fr;
          padding: 17px;
        }

        .ronny-ai-logo {
          width: 64px;
          height: 64px;
        }

        .ronny-ai-status {
          grid-column: 1 / -1;
          width: fit-content;
        }

        .ronny-ai-stat {
          padding: 15px;
        }
      }
    </style>


    <section class="ronny-ai">

      <header class="ronny-ai-hero">
        <img
          class="ronny-ai-logo"
          src="phoenix_v2/assets/phoenix-logo.png?v=1029"
          alt="Ronny AI"
        >

        <div>
          <h2>${t("ronnyAi.title")}</h2>

          <p>
            ${t("ronnyAi.description")}
          </p>
        </div>

        <div
          class="ronny-ai-status"
          id="ronnyAiStatus"
        >
          ${t("ronnyAi.checking")}
        </div>
      </header>


      <section class="ronny-ai-stats">

        <article class="ronny-ai-stat">
          <strong
            class="ronny-ai-stat-value"
            data-ai-stat="checked"
          >
            –
          </strong>

          <span class="ronny-ai-stat-label">
            ${t("ronnyAi.checkedObjects")}
          </span>
        </article>


        <article class="ronny-ai-stat">
          <strong
            class="ronny-ai-stat-value"
            data-ai-stat="errors"
          >
            –
          </strong>

          <span class="ronny-ai-stat-label">
            ${t("ronnyAi.errors")}
          </span>
        </article>


        <article class="ronny-ai-stat">
          <strong
            class="ronny-ai-stat-value"
            data-ai-stat="warnings"
          >
            –
          </strong>

          <span class="ronny-ai-stat-label">
            ${t("ronnyAi.warnings")}
          </span>
        </article>


        <article class="ronny-ai-stat">
          <strong
            class="ronny-ai-stat-value"
            data-ai-stat="suggestions"
          >
            –
          </strong>

          <span class="ronny-ai-stat-label">
            ${t("ronnyAi.suggestions")}
          </span>
        </article>

      </section>


      <section class="ronny-ai-grid">

        <article class="ronny-ai-panel">
          <h3>🔍 ${t("ronnyAi.systemCheck")}</h3>

          <p>
            ${t("ronnyAi.systemCheckText")}
          </p>

          <div class="ronny-ai-findings">

            <div
              class="
                ronny-ai-finding
                ronny-ai-finding-clickable
              "
              data-ai-toggle="unavailable"
              role="button"
              tabindex="0"
              aria-expanded="false"
            >
              <span>
                🔴 ${t("ronnyAi.unavailableEntities")}
              </span>

              <strong
                data-ai-finding="unavailable"
              >
                –
              </strong>
            </div>

            <div
              class="ronny-ai-finding-details"
              data-ai-details="unavailable"
              hidden
            ></div>


            <div
              class="
                ronny-ai-finding
                ronny-ai-finding-clickable
              "
              data-ai-toggle="entitiesWithoutArea"
              role="button"
              tabindex="0"
              aria-expanded="false"
            >
              <span>
                🟠 ${t("ronnyAi.entitiesWithoutArea")}
              </span>

              <strong
                data-ai-finding="entitiesWithoutArea"
              >
                –
              </strong>
            </div>

            <div
              class="ronny-ai-finding-details"
              data-ai-details="entitiesWithoutArea"
              hidden
            ></div>


            <div
              class="
                ronny-ai-finding
                ronny-ai-finding-clickable
              "
              data-ai-toggle="devicesWithoutArea"
              role="button"
              tabindex="0"
              aria-expanded="false"
            >
              <span>
                🟠 ${t("ronnyAi.devicesWithoutArea")}
              </span>

              <strong
                data-ai-finding="devicesWithoutArea"
              >
                –
              </strong>
            </div>

            <div
              class="ronny-ai-finding-details"
              data-ai-details="devicesWithoutArea"
              hidden
            ></div>


            <div
              class="
                ronny-ai-finding
                ronny-ai-finding-clickable
              "
              data-ai-toggle="disabled"
              role="button"
              tabindex="0"
              aria-expanded="false"
            >
              <span>
                🔵 ${t("ronnyAi.disabledItems")}
              </span>

              <strong
                data-ai-finding="disabled"
              >
                –
              </strong>
            </div>

            <div
              class="ronny-ai-finding-details"
              data-ai-details="disabled"
              hidden
            ></div>

          </div>
        </article>


        <article class="ronny-ai-panel">
          <h3>✨ ${t("ronnyAi.intelligentSuggestions")}</h3>

          <p>
            ${t("ronnyAi.intelligentSuggestionsText")}
          </p>


          <div class="ronny-ai-smart-section">

            <button
              type="button"
              class="ronny-ai-smart-section-toggle"
              data-smart-section-toggle="areas"
              aria-expanded="false"
            >
              <div class="ronny-ai-smart-section-main">
                <strong>
                  📍 ${t("ronnyAi.suggestAreas")}
                </strong>

                <small>
                  ${t("ronnyAi.suggestAreasText")}
                </small>
              </div>

              <span
                class="ronny-ai-smart-section-count"
                data-smart-section-count="areas"
              >
                0
              </span>
            </button>

            <div
              class="ronny-ai-smart-section-content"
              data-smart-section-content="areas"
              hidden
            >
              <div
                class="ronny-ai-suggestion-list"
                id="ronnyAiAreaSuggestions"
              ></div>
            </div>

          </div>


          <div class="ronny-ai-smart-section">

            <button
              type="button"
              class="ronny-ai-smart-section-toggle"
              data-smart-section-toggle="labels"
              aria-expanded="false"
            >
              <div class="ronny-ai-smart-section-main">
                <strong>
                  🏷️ ${t("ronnyAi.suggestLabels")}
                </strong>

                <small>
                  ${t("ronnyAi.suggestLabelsText")}
                </small>
              </div>

              <span
                class="ronny-ai-smart-section-count"
                data-smart-section-count="labels"
              >
                0
              </span>
            </button>

            <div
              class="ronny-ai-smart-section-content"
              data-smart-section-content="labels"
              hidden
            >
              <div
                class="ronny-ai-suggestion-list"
                id="ronnyAiLabelSuggestions"
              ></div>
            </div>

          </div>


          <div class="ronny-ai-smart-section">

            <button
              type="button"
              class="ronny-ai-smart-section-toggle"
              data-smart-section-toggle="names"
              aria-expanded="false"
            >
              <div class="ronny-ai-smart-section-main">
                <strong>
                  ✏️ ${t("ronnyAi.optimizeNames")}
                </strong>

                <small>
                  ${t("ronnyAi.optimizeNamesText")}
                </small>
              </div>

              <span
                class="ronny-ai-smart-section-count"
                data-smart-section-count="names"
              >
                0
              </span>
            </button>

            <div
              class="ronny-ai-smart-section-content"
              data-smart-section-content="names"
              hidden
            >
              <div
                class="ronny-ai-suggestion-list"
                id="ronnyAiNameSuggestions"
              ></div>
            </div>

          </div>

        </article>


        <article class="ronny-ai-panel">
          <h3>⚡ ${t("ronnyAi.automationsScripts")}</h3>

          <p>
            ${t("ronnyAi.automationsScriptsText")}
          </p>

          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              🔗
            </div>

            <div>
              <strong>
                ${t("ronnyAi.deadReferences")}
              </strong>

              <span>
                ${t("ronnyAi.deadReferencesText")}
              </span>

              <div
                id="ronnyAiDeadReferencesStatus"
                style="
                  margin-top: 8px;
                  display: grid;
                  gap: 8px;
                "
              >
                <span>
                  ${t("ronnyAi.deadReferencesChecking")}
                </span>
              </div>
            </div>

          </div>


          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              🧩
            </div>

            <div>
              <strong>
                ${t("ronnyAi.checkLogic")}
              </strong>

              <span>
                ${t("ronnyAi.checkLogicText")}
              </span>

              <div
                id="ronnyAiLogicStatus"
                style="
                  margin-top: 8px;
                  display: grid;
                  gap: 8px;
                "
              >
                <span>
                  ${t("ronnyAi.logicChecking")}
                </span>
              </div>
            </div>

          </div>


          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              💡
            </div>

            <div>
              <strong>
                ${t("ronnyAi.prepareImprovements")}
              </strong>

              <span>
                ${t("ronnyAi.prepareImprovementsText")}
              </span>

              <div
                id="ronnyAiImprovementSuggestions"
                style="
                  margin-top: 10px;
                  display: grid;
                  gap: 10px;
                "
              >
                <span>
                  ${t("ronnyAi.improvementsChecking")}
                </span>
              </div>
            </div>

          </div>
        </article>


        <article class="ronny-ai-panel">
          <h3>📋 ${t("ronnyAi.changesHistory")}</h3>

          <p>
            ${t("ronnyAi.changesHistoryText")}
          </p>

          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              ✅
            </div>

            <div>
              <strong>
                ${t("ronnyAi.youDecide")}
              </strong>

              <span>
                ${t("ronnyAi.youDecideText")}
              </span>
            </div>

          </div>


          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              👁️
            </div>

            <div>
              <strong>
                ${t("ronnyAi.beforeAfter")}
              </strong>

              <span>
                ${t("ronnyAi.beforeAfterText")}
              </span>
            </div>

          </div>


          <div class="ronny-ai-feature">

            <div class="ronny-ai-feature-icon">
              🕘
            </div>

            <div>
              <strong>
                ${t("ronnyAi.history")}
              </strong>

              <span>
                ${t("ronnyAi.historyText")}
              </span>
            </div>

          </div>

          <div
            id="ronnyAiHistoryList"
            style="
              display: grid;
              gap: 10px;
              margin-top: 14px;
            "
          >
            <div class="ronny-ai-no-suggestions">
              ${t("ronnyAi.historyEmpty")}
            </div>
          </div>
        </article>

      </section>


      <div class="ronny-ai-control">
        <div class="ronny-ai-control-icon">
          🛡️
        </div>

        <div>
          <strong>
            ${t("ronnyAi.controlledMode")}
          </strong>

          <span>
            ${t("ronnyAi.controlledModeText")}
          </span>
        </div>
      </div>

    </section>
  `;


  const [
    entitiesResult,
    statesResult,
    devicesResult,
    areasResult,
    labelsResult,
    automationsResult,
    scriptsResult,
    ronnyStateResult
  ] = await Promise.allSettled([
    loadHomeAssistantEntityRegistry(),
    loadHomeAssistantEntities(),
    loadHomeAssistantDevices(),
    loadHomeAssistantAreas(),
    loadHomeAssistantLabels(),
    loadHomeAssistantAutomations(),
    loadHomeAssistantScripts(),
    loadRonnyAiState()
  ]);


  const entities =
    entitiesResult.status === "fulfilled"
      ? asArray(
          entitiesResult.value,
          ["entities", "entity_registry"]
        )
      : [];

  const states =
    statesResult.status === "fulfilled"
      ? asArray(
          statesResult.value,
          ["entities", "states"]
        )
      : [];

  const devices =
    devicesResult.status === "fulfilled"
      ? asArray(
          devicesResult.value,
          ["devices"]
        )
      : [];

  const areas =
    areasResult.status === "fulfilled"
      ? asArray(
          areasResult.value,
          ["areas"]
        )
      : [];

  const labels =
    labelsResult.status === "fulfilled"
      ? asArray(
          labelsResult.value,
          ["labels"]
        )
      : [];

  const automations =
    automationsResult.status === "fulfilled"
      ? asArray(
          automationsResult.value,
          ["automations"]
        )
      : [];

  const scripts =
    scriptsResult.status === "fulfilled"
      ? asArray(
          scriptsResult.value,
          ["scripts"]
        )
      : [];


  const deadReferencesRoot =
    content.querySelector(
      "#ronnyAiDeadReferencesStatus"
    );


  const validEntityIds =
    new Set(
      [
        ...entities
          .map(entity => entity?.entity_id),
        ...states
          .map(state => state?.entity_id)
      ].filter(Boolean)
    );


  const validRegistryIds =
    new Set(
      entities
        .map(entity => entity?.registry_id)
        .filter(Boolean)
    );


  const validDeviceIds =
    new Set(
      devices
        .map(device => device?.id)
        .filter(Boolean)
    );


  const validAreaIds =
    new Set(
      areas
        .map(area => area?.area_id)
        .filter(Boolean)
    );


  const isDynamicReference = value => {
    if (typeof value !== "string") {
      return false;
    }

    return (
      value.includes("{{") ||
      value.includes("{%") ||
      value.includes("}}") ||
      value.includes("%}")
    );
  };


  const normalizeReferenceValues = value =>
    Array.isArray(value)
      ? value
      : [value];


  const collectReferences = (
    node,
    path = "$",
    result = []
  ) => {
    if (Array.isArray(node)) {
      node.forEach(
        (item, index) => {
          collectReferences(
            item,
            `${path}[${index}]`,
            result
          );
        }
      );

      return result;
    }

    if (
      !node ||
      typeof node !== "object"
    ) {
      return result;
    }

    for (
      const [key, value]
      of Object.entries(node)
    ) {
      const currentPath =
        `${path}.${key}`;

      if (
        key === "entity_id" ||
        key === "device_id" ||
        key === "area_id"
      ) {
        for (
          const candidate
          of normalizeReferenceValues(value)
        ) {
          if (
            typeof candidate !== "string"
          ) {
            continue;
          }

          const normalized =
            candidate.trim();

          if (
            !normalized ||
            isDynamicReference(normalized)
          ) {
            continue;
          }

          result.push({
            type: key,
            value: normalized,
            path: currentPath
          });
        }
      }

      collectReferences(
        value,
        currentPath,
        result
      );
    }

    return result;
  };


  const findMissingReferences =
    config => {
      const missing = [];

      for (
        const reference
        of collectReferences(config)
      ) {
        let exists = true;

        if (
          reference.type === "entity_id"
        ) {
          exists =
            validEntityIds.has(
              reference.value
            ) ||
            validRegistryIds.has(
              reference.value
            );
        } else if (
          reference.type === "device_id"
        ) {
          exists =
            validDeviceIds.has(
              reference.value
            );
        } else if (
          reference.type === "area_id"
        ) {
          exists =
            validAreaIds.has(
              reference.value
            );
        }

        if (!exists) {
          missing.push(reference);
        }
      }

      return missing;
    };


  const isOrphanedAutomationError = (
    item
  ) => {
    if (
      item?.kind !== "automation" ||
      !item?.error
    ) {
      return false;
    }

    const error =
      item.error;

    const statusCode =
      typeof error === "object" &&
      error !== null
        ? (
            error.status_code ||
            error.status ||
            null
          )
        : null;

    let body = "";

    if (
      typeof error === "object" &&
      error !== null
    ) {
      body =
        typeof error.body === "string"
          ? error.body
          : "";
    } else {
      body =
        String(error || "");
    }

    return (
      Number(statusCode) === 404 ||
      body.includes(
        "Resource not found"
      )
    );
  };


  const describeConfigLoadError = error => {
    if (!error) {
      return t(
        "ronnyAi.configLoadUnknownError"
      );
    }

    let statusCode = null;
    let message = "";

    if (
      typeof error === "object" &&
      error !== null
    ) {
      statusCode =
        error.status_code ||
        error.status ||
        null;

      const body =
        error.body;

      if (typeof body === "string") {
        try {
          const parsed =
            JSON.parse(body);

          message =
            parsed?.message ||
            body;
        } catch {
          message = body;
        }
      } else if (
        typeof error.message === "string"
      ) {
        message =
          error.message;
      }
    }

    if (
      !message &&
      error instanceof Error
    ) {
      message =
        error.message;
    }

    if (!message) {
      message =
        String(error);
    }

    /*
     * Falls der Fehlertext selbst JSON ist,
     * z. B. {"message":"Resource not found"}
     */
    try {
      const parsed =
        JSON.parse(message);

      if (parsed?.message) {
        message =
          parsed.message;
      }
    } catch {
      // normaler Text
    }

    if (
      statusCode &&
      message
    ) {
      return `${statusCode} – ${message}`;
    }

    return (
      message ||
      t(
        "ronnyAi.configLoadUnknownError"
      )
    );
  };


  const checkDeadReferences =
    async () => {
      const issues = [];
      const loadErrors = [];

      const automationChecks =
        automations
          .filter(
            automation => automation?.id
          )
          .map(
            async automation => {
              try {
                const response =
                  await loadAutomationConfig(
                    automation.id
                  );

                if (
                  response?.status !== "ok"
                ) {
                  throw (
                    response?.error ||
                    new Error(
                      "config_load_failed"
                    )
                  );
                }

                const config =
                  response?.config || {};

                const missing =
                  findMissingReferences(
                    config
                  );

                if (missing.length) {
                  issues.push({
                    kind: "automation",
                    name:
                      automation.name ||
                      automation.entity_id ||
                      automation.id,
                    entityId:
                      automation.entity_id ||
                      "",
                    missing
                  });
                }
              } catch (error) {
                loadErrors.push({
                  kind: "automation",
                  name:
                    automation.name ||
                    automation.entity_id ||
                    automation.id,
                  error
                });
              }
            }
          );


      const scriptChecks =
        scripts
          .filter(
            script =>
              typeof script?.entity_id ===
                "string" &&
              script.entity_id.startsWith(
                "script."
              )
          )
          .map(
            async script => {
              const scriptId =
                script.entity_id.replace(
                  /^script\./,
                  ""
                );

              try {
                const response =
                  await loadScriptConfig(
                    scriptId
                  );

                if (
                  response?.status !== "ok"
                ) {
                  throw new Error(
                    response?.error?.body ||
                    response?.error ||
                    "config_load_failed"
                  );
                }

                const config =
                  response?.config || {};

                const missing =
                  findMissingReferences(
                    config
                  );

                if (missing.length) {
                  issues.push({
                    kind: "script",
                    name:
                      script.name ||
                      script.entity_id,
                    entityId:
                      script.entity_id,
                    missing
                  });
                }
              } catch (error) {
                loadErrors.push({
                  kind: "script",
                  name:
                    script.name ||
                    script.entity_id,
                  error
                });
              }
            }
          );


      await Promise.allSettled([
        ...automationChecks,
        ...scriptChecks
      ]);


      if (!deadReferencesRoot) {
        return;
      }


      if (
        !issues.length &&
        !loadErrors.length
      ) {
        const checkedCount =
          automations.length +
          scripts.length;

        deadReferencesRoot.innerHTML = `
          <span>
            🟢 ${escapeHtml(
              t(
                "ronnyAi.deadReferencesClean"
              ).replace(
                "{count}",
                String(checkedCount)
              )
            )}
          </span>
        `;

        return;
      }


      const issueHtml =
        issues
          .map(issue => {
            const kindLabel =
              issue.kind === "script"
                ? t(
                    "ronnyAi.scriptSingular"
                  )
                : t(
                    "ronnyAi.automationSingular"
                  );

            const references =
              issue.missing
                .map(reference => `
                  <div
                    style="
                      margin-top: 4px;
                      overflow-wrap: anywhere;
                    "
                  >
                    <strong>
                      ${escapeHtml(
                        reference.type
                      )}
                    </strong>:
                    ${escapeHtml(
                      reference.value
                    )}
                    <br>
                    <small>
                      ${escapeHtml(
                        t(
                          "ronnyAi.referenceAt"
                        )
                      )}:
                      ${escapeHtml(
                        reference.path
                      )}
                    </small>
                  </div>
                `)
                .join("");

            return `
              <div
                style="
                  padding: 8px 10px;
                  border: 1px solid var(--border);
                  border-radius: 10px;
                "
              >
                <strong>
                  🔴 ${escapeHtml(
                    kindLabel
                  )}:
                  ${escapeHtml(
                    issue.name
                  )}
                </strong>

                ${references}
              </div>
            `;
          })
          .join("");


      const loadErrorDetailsHtml =
        loadErrors
          .map(item => {
            const kindLabel =
              item.kind === "script"
                ? t(
                    "ronnyAi.scriptSingular"
                  )
                : t(
                    "ronnyAi.automationSingular"
                  );

            const orphaned =
              isOrphanedAutomationError(
                item
              );

            return `
              <div
                style="
                  padding: 8px 10px;
                  border: 1px solid var(--border);
                  border-radius: 10px;
                  overflow-wrap: anywhere;
                "
              >
                <strong>
                  ${
                    orphaned
                      ? "🔴"
                      : "🟠"
                  }
                  ${
                    orphaned
                      ? escapeHtml(
                          t(
                            "ronnyAi.orphanedAutomation"
                          )
                        )
                      : escapeHtml(
                          kindLabel
                        )
                  }:
                  ${escapeHtml(
                    item.name
                  )}
                </strong>

                ${
                  orphaned
                    ? `
                      <div
                        style="
                          margin-top: 4px;
                        "
                      >
                        ${escapeHtml(
                          t(
                            "ronnyAi.orphanedAutomationText"
                          )
                        )}
                      </div>
                    `
                    : ""
                }

                <div
                  style="
                    margin-top: 4px;
                  "
                >
                  ${escapeHtml(
                    t(
                      "ronnyAi.configLoadErrorReason"
                    )
                  )}:
                  ${escapeHtml(
                    describeConfigLoadError(
                      item.error
                    )
                  )}
                </div>
              </div>
            `;
          })
          .join("");


      const orphanedReferenceAutomations =
        loadErrors.filter(
          item =>
            isOrphanedAutomationError(
              item
            )
        );


      const normalReferenceLoadErrors =
        loadErrors.filter(
          item =>
            !isOrphanedAutomationError(
              item
            )
        );


      const loadErrorHtml =
        loadErrors.length
          ? `
            ${
              orphanedReferenceAutomations.length
                ? `
                  <span>
                    🔴 ${escapeHtml(
                      t(
                        "ronnyAi.orphanedAutomationsFound"
                      ).replace(
                        "{count}",
                        String(
                          orphanedReferenceAutomations.length
                        )
                      )
                    )}
                  </span>
                `
                : ""
            }

            ${
              normalReferenceLoadErrors.length
                ? `
                  <span>
                    🟠 ${escapeHtml(
                      t(
                        "ronnyAi.deadReferencesLoadErrors"
                      ).replace(
                        "{count}",
                        String(
                          normalReferenceLoadErrors.length
                        )
                      )
                    )}
                  </span>
                `
                : ""
            }

            ${loadErrorDetailsHtml}
          `
          : "";


      deadReferencesRoot.innerHTML = `
        ${
          issues.length
            ? `
              <span>
                🔴 ${escapeHtml(
                  t(
                    "ronnyAi.deadReferencesFound"
                  ).replace(
                    "{count}",
                    String(
                      issues.length
                    )
                  )
                )}
              </span>
            `
            : ""
        }

        ${issueHtml}
        ${loadErrorHtml}
      `;
    };


  checkDeadReferences().catch(
    error => {
      console.error(
        "Ronny-AI-Prüfung auf tote Referenzen fehlgeschlagen:",
        error
      );

      if (deadReferencesRoot) {
        deadReferencesRoot.innerHTML = `
          <span>
            🟠 ${escapeHtml(
              t(
                "ronnyAi.deadReferencesCheckFailed"
              )
            )}
          </span>
        `;
      }
    }
  );


  const improvementSuggestionsRoot =
    content.querySelector(
      "#ronnyAiImprovementSuggestions"
    );


  const logicStatusRoot =
    content.querySelector(
      "#ronnyAiLogicStatus"
    );


  const scanLogicStructure = (
    node,
    path = "$",
    result = []
  ) => {
    if (Array.isArray(node)) {
      node.forEach(
        (item, index) => {
          scanLogicStructure(
            item,
            `${path}[${index}]`,
            result
          );
        }
      );

      return result;
    }

    if (
      !node ||
      typeof node !== "object"
    ) {
      return result;
    }


    if (
      Object.prototype.hasOwnProperty.call(
        node,
        "choose"
      ) &&
      Array.isArray(node.choose)
    ) {
      node.choose.forEach(
        (choice, index) => {
          if (
            choice &&
            typeof choice === "object" &&
            !choice.sequence?.length
          ) {
            result.push({
              type:
                "empty_choose_sequence",
              path:
                `${path}.choose[${index}].sequence`
            });
          }
        }
      );
    }


    if (
      node.repeat &&
      typeof node.repeat === "object" &&
      !node.repeat.sequence?.length
    ) {
      result.push({
        type:
          "empty_repeat_sequence",
        path:
          `${path}.repeat.sequence`
      });
    }


    if (
      Object.prototype.hasOwnProperty.call(
        node,
        "if"
      ) &&
      !node.then?.length
    ) {
      result.push({
        type: "empty_then",
        path: `${path}.then`
      });
    }


    if (
      Object.prototype.hasOwnProperty.call(
        node,
        "else"
      ) &&
      !node.else?.length
    ) {
      result.push({
        type: "empty_else",
        path: `${path}.else`
      });
    }


    for (
      const [key, value]
      of Object.entries(node)
    ) {
      scanLogicStructure(
        value,
        `${path}.${key}`,
        result
      );
    }

    return result;
  };


  const logicIssueLabel = type => {
    switch (type) {
      case "no_actions":
        return t(
          "ronnyAi.logicNoActions"
        );

      case "no_sequence":
        return t(
          "ronnyAi.logicNoSequence"
        );

      case "empty_choose_sequence":
        return t(
          "ronnyAi.logicEmptyChoose"
        );

      case "empty_repeat_sequence":
        return t(
          "ronnyAi.logicEmptyRepeat"
        );

      case "empty_then":
        return t(
          "ronnyAi.logicEmptyThen"
        );

      case "empty_else":
        return t(
          "ronnyAi.logicEmptyElse"
        );

      default:
        return t(
          "ronnyAi.logicUnknownIssue"
        );
    }
  };


  const checkAutomationLogic =
    async () => {
      const warnings = [];
      const manualHints = [];
      const loadErrors = [];
      let blueprintCount = 0;
      let checkedCount = 0;


      for (const automation of automations) {
        if (!automation?.id) {
          continue;
        }

        try {
          const response =
            await loadAutomationConfig(
              automation.id
            );

          if (
            response?.status !== "ok"
          ) {
            loadErrors.push({
              kind: "automation",
              name:
                automation.name ||
                automation.entity_id ||
                automation.id,
              targetId:
                automation.entity_id ||
                automation.id,
              error:
                response?.error ||
                "config_load_failed"
            });

            continue;
          }

          const config =
            response?.config || {};

          if (config.use_blueprint) {
            blueprintCount += 1;
            checkedCount += 1;
            continue;
          }

          checkedCount += 1;

          const triggers =
            Object.prototype
              .hasOwnProperty.call(
                config,
                "triggers"
              )
              ? config.triggers
              : config.trigger;

          const actions =
            Object.prototype
              .hasOwnProperty.call(
                config,
                "actions"
              )
              ? config.actions
              : config.action;

          const currentIssues =
            scanLogicStructure(
              config
            );


          if (
            !triggers?.length &&
            actions?.length
          ) {
            manualHints.push({
              name:
                automation.name ||
                automation.entity_id ||
                automation.id
            });
          }


          if (!actions?.length) {
            currentIssues.push({
              type: "no_actions",
              path: "$.actions"
            });
          }


          if (currentIssues.length) {
            warnings.push({
              kind: "automation",
              name:
                automation.name ||
                automation.entity_id ||
                automation.id,
              issues: currentIssues
            });
          }

        } catch (error) {
          loadErrors.push({
            kind: "automation",
            name:
              automation.name ||
              automation.entity_id ||
              automation.id,
            targetId:
              automation.entity_id ||
              automation.id,
            error
          });
        }
      }


      for (const script of scripts) {
        if (
          typeof script?.entity_id !==
            "string" ||
          !script.entity_id.startsWith(
            "script."
          )
        ) {
          continue;
        }

        const scriptId =
          script.entity_id.replace(
            /^script\./,
            ""
          );

        try {
          const response =
            await loadScriptConfig(
              scriptId
            );

          if (
            response?.status !== "ok"
          ) {
            loadErrors.push({
              kind: "script",
              name:
                script.name ||
                script.entity_id,
              error:
                response?.error ||
                "config_load_failed"
            });

            continue;
          }

          checkedCount += 1;

          const config =
            response?.config || {};

          const sequence =
            config.sequence;

          const currentIssues =
            scanLogicStructure(
              config
            );

          if (!sequence?.length) {
            currentIssues.push({
              type: "no_sequence",
              path: "$.sequence"
            });
          }

          if (currentIssues.length) {
            warnings.push({
              kind: "script",
              name:
                script.name ||
                script.entity_id,
              issues: currentIssues
            });
          }

        } catch (error) {
          loadErrors.push({
            kind: "script",
            name:
              script.name ||
              script.entity_id,
            error
          });
        }
      }


      if (!logicStatusRoot) {
        return;
      }


      const warningHtml =
        warnings
          .map(item => {
            const kindLabel =
              item.kind === "script"
                ? t(
                    "ronnyAi.scriptSingular"
                  )
                : t(
                    "ronnyAi.automationSingular"
                  );

            const issuesHtml =
              item.issues
                .map(issue => `
                  <div
                    style="
                      margin-top: 4px;
                    "
                  >
                    ${escapeHtml(
                      logicIssueLabel(
                        issue.type
                      )
                    )}
                    <br>
                    <small>
                      ${escapeHtml(
                        t(
                          "ronnyAi.referenceAt"
                        )
                      )}:
                      ${escapeHtml(
                        issue.path
                      )}
                    </small>
                  </div>
                `)
                .join("");

            return `
              <div
                style="
                  padding: 8px 10px;
                  border: 1px solid var(--border);
                  border-radius: 10px;
                "
              >
                <strong>
                  🟠 ${escapeHtml(
                    kindLabel
                  )}:
                  ${escapeHtml(
                    item.name
                  )}
                </strong>

                ${issuesHtml}
              </div>
            `;
          })
          .join("");


      const manualHtml =
        manualHints.length
          ? `
            <span>
              🔵 ${escapeHtml(
                t(
                  "ronnyAi.logicManualAutomations"
                ).replace(
                  "{count}",
                  String(
                    manualHints.length
                  )
                )
              )}
            </span>
          `
          : "";


      const blueprintHtml =
        blueprintCount
          ? `
            <span>
              🟢 ${escapeHtml(
                t(
                  "ronnyAi.logicBlueprints"
                ).replace(
                  "{count}",
                  String(
                    blueprintCount
                  )
                )
              )}
            </span>
          `
          : "";


      const orphanedAutomations =
        loadErrors.filter(
          item =>
            isOrphanedAutomationError(
              item
            )
        );


      const normalLoadErrors =
        loadErrors.filter(
          item =>
            !isOrphanedAutomationError(
              item
            )
        );


      const orphanedImprovementItems =
        orphanedAutomations
          .map(item => {
            const targetId =
              item.targetId ||
              item.name;

            const key =
              `orphaned-automation:${targetId}`;

            return {
              ...item,
              key
            };
          })
          .filter(
            item =>
              !ignoredSuggestionKeys.has(
                item.key
              )
          );


      const renderOrphanedImprovements =
        () => {
          if (!improvementSuggestionsRoot) {
            return;
          }

          if (
            !orphanedImprovementItems.length
          ) {
            improvementSuggestionsRoot.innerHTML = `
              <span>
                🟢 ${escapeHtml(
                  t(
                    "ronnyAi.noPreparedImprovements"
                  )
                )}
              </span>
            `;

            return;
          }

          improvementSuggestionsRoot.innerHTML =
            orphanedImprovementItems
              .map((item, index) => `
                <div
                  class="ronny-ai-suggestion-card"
                  data-orphan-improvement="${index}"
                  style="
                    padding: 10px;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                  "
                >
                  <strong>
                    🔴 ${escapeHtml(
                      t(
                        "ronnyAi.cleanupOrphanedAutomation"
                      )
                    )}
                  </strong>

                  <div
                    style="
                      margin-top: 5px;
                      font-weight: 600;
                    "
                  >
                    ${escapeHtml(
                      item.name
                    )}
                  </div>

                  <div
                    style="
                      margin-top: 5px;
                    "
                  >
                    ${escapeHtml(
                      t(
                        "ronnyAi.cleanupOrphanedAutomationReason"
                      )
                    )}
                  </div>

                  <div
                    style="
                      display: flex;
                      gap: 8px;
                      flex-wrap: wrap;
                      margin-top: 10px;
                    "
                  >
                    <button
                      type="button"
                      data-orphan-prepare="${index}"
                    >
                      ${escapeHtml(
                        t(
                          "ronnyAi.prepareCleanup"
                        )
                      )}
                    </button>

                    <button
                      type="button"
                      data-orphan-ignore="${index}"
                    >
                      ${escapeHtml(
                        t(
                          "ronnyAi.ignore"
                        )
                      )}
                    </button>
                  </div>
                </div>
              `)
              .join("");


          improvementSuggestionsRoot
            .querySelectorAll(
              "[data-orphan-prepare]"
            )
            .forEach(button => {
              button.addEventListener(
                "click",
                () => {
                  const index =
                    Number(
                      button.dataset
                        .orphanPrepare
                    );

                  const item =
                    orphanedImprovementItems[
                      index
                    ];

                  if (!item) {
                    return;
                  }

                  const card =
                    button.closest(
                      ".ronny-ai-suggestion-card"
                    );

                  if (!card) {
                    return;
                  }

                  card.innerHTML = `
                      <strong>
                        🛠️ ${escapeHtml(
                          t(
                            "ronnyAi.cleanupPrepared"
                          )
                        )}
                      </strong>

                      <div
                        style="
                          margin-top: 5px;
                        "
                      >
                        ${escapeHtml(
                          item.name
                        )}
                      </div>

                      <div
                        style="
                          margin-top: 5px;
                        "
                      >
                        ${escapeHtml(
                          t(
                            "ronnyAi.cleanupPreparedText"
                          )
                        )}
                      </div>

                      <div
                        style="
                          margin-top: 10px;
                        "
                      >
                        <button
                          type="button"
                          data-orphan-confirm-cleanup
                        >
                          ${escapeHtml(
                            t(
                              "ronnyAi.confirmCleanup"
                            )
                          )}
                        </button>
                      </div>
                    `;

                    const confirmButton =
                      card.querySelector(
                        "[data-orphan-confirm-cleanup]"
                      );

                    confirmButton
                      ?.addEventListener(
                        "click",
                        async () => {
                          const entityId =
                            item.targetId || "";

                          if (
                            !entityId.startsWith(
                              "automation."
                            )
                          ) {
                            console.error(
                              "Ungültige Automation-Entity:",
                              entityId
                            );

                            return;
                          }

                          confirmButton.disabled =
                            true;

                          try {
                            const result =
                              await cleanupRonnyAiOrphanedAutomation(
                                entityId
                              );

                            if (
                              result?.status !== "ok" ||
                              result?.removed !== true
                            ) {
                              throw new Error(
                                result?.error ||
                                "cleanup_failed"
                              );
                            }

                            try {
                              await addRonnyAiHistory({
                                id:
                                  `cleanup-orphan:${Date.now()}`,
                                type:
                                  "orphaned-automation",
                                action:
                                  "cleaned",
                                target_id:
                                  entityId,
                                target_name:
                                  item.name ||
                                  entityId,
                                old_value:
                                  "orphaned",
                                new_value:
                                  "removed",
                                meta: {
                                  suggestion_key:
                                    item.key
                                },
                                timestamp:
                                  new Date()
                                    .toISOString()
                              });
                            } catch (
                              historyError
                            ) {
                              console.warn(
                                "Ronny-AI-Verlauf konnte nicht gespeichert werden:",
                                historyError
                              );
                            }

                            await renderRonnyAI(
                              content
                            );
                          } catch (error) {
                            confirmButton.disabled =
                              false;

                            console.error(
                              "Ronny-AI-Bereinigung fehlgeschlagen:",
                              error
                            );

                            const errorBox =
                              document.createElement(
                                "div"
                              );

                            errorBox.style.marginTop =
                              "8px";

                            errorBox.textContent =
                              `${t(
                                "ronnyAi.cleanupFailed"
                              )}: ${
                                error?.message ||
                                error
                              }`;

                            card.appendChild(
                              errorBox
                            );
                          }
                        }
                      );
                }
              );
            });


          improvementSuggestionsRoot
            .querySelectorAll(
              "[data-orphan-ignore]"
            )
            .forEach(button => {
              button.addEventListener(
                "click",
                async () => {
                  const index =
                    Number(
                      button.dataset
                        .orphanIgnore
                    );

                  const item =
                    orphanedImprovementItems[
                      index
                    ];

                  if (!item) {
                    return;
                  }

                  button.disabled = true;

                  try {
                    await ignoreRonnyAiSuggestion(
                      item.key
                    );

                    ignoredSuggestionKeys.add(
                      item.key
                    );

                    try {
                      await addRonnyAiHistory({
                        id:
                          `ignore-orphan:${Date.now()}`,
                        type:
                          "orphaned-automation",
                        action:
                          "ignored",
                        target_id:
                          item.targetId ||
                          "",
                        target_name:
                          item.name ||
                          "",
                        old_value:
                          "orphaned",
                        new_value:
                          null,
                        meta: {
                          suggestion_key:
                            item.key
                        },
                        timestamp:
                          new Date()
                            .toISOString()
                      });
                    } catch (
                      historyError
                    ) {
                      console.warn(
                        "Ronny-AI-Verlauf konnte nicht gespeichert werden:",
                        historyError
                      );
                    }

                    await renderRonnyAI(
                      content
                    );
                  } catch (error) {
                    button.disabled = false;

                    console.error(
                      "Ronny-AI-Vorschlag konnte nicht ignoriert werden:",
                      error
                    );
                  }
                }
              );
            });
        };


      renderOrphanedImprovements();


      const logicLoadErrorDetailsHtml =
        normalLoadErrors
          .map(item => {
            const kindLabel =
              item.kind === "script"
                ? t(
                    "ronnyAi.scriptSingular"
                  )
                : t(
                    "ronnyAi.automationSingular"
                  );

            return `
              <div
                style="
                  padding: 8px 10px;
                  border: 1px solid var(--border);
                  border-radius: 10px;
                  overflow-wrap: anywhere;
                "
              >
                <strong>
                  🟠 ${escapeHtml(
                    kindLabel
                  )}:
                  ${escapeHtml(
                    item.name
                  )}
                </strong>

                <div
                  style="
                    margin-top: 4px;
                  "
                >
                  ${escapeHtml(
                    t(
                      "ronnyAi.configLoadErrorReason"
                    )
                  )}:
                  ${escapeHtml(
                    describeConfigLoadError(
                      item.error
                    )
                  )}
                </div>
              </div>
            `;
          })
          .join("");


      const loadErrorHtml =
        loadErrors.length
          ? `
            ${
              orphanedAutomations.length
                ? `
                  <span>
                    🔴 ${escapeHtml(
                      t(
                        "ronnyAi.orphanedAutomationAlreadyListed"
                      ).replace(
                        "{count}",
                        String(
                          orphanedAutomations.length
                        )
                      )
                    )}
                  </span>
                `
                : ""
            }

            ${
              normalLoadErrors.length
                ? `
                  <span>
                    🟠 ${escapeHtml(
                      t(
                        "ronnyAi.logicLoadErrors"
                      ).replace(
                        "{count}",
                        String(
                          normalLoadErrors.length
                        )
                      )
                    )}
                  </span>

                  ${logicLoadErrorDetailsHtml}
                `
                : ""
            }
          `
          : "";


      if (
        !warnings.length &&
        !loadErrors.length
      ) {
        logicStatusRoot.innerHTML = `
          <span>
            🟢 ${escapeHtml(
              t(
                "ronnyAi.logicClean"
              ).replace(
                "{count}",
                String(
                  checkedCount
                )
              )
            )}
          </span>

          ${blueprintHtml}
          ${manualHtml}
        `;

        return;
      }


      logicStatusRoot.innerHTML = `
        ${
          warnings.length
            ? `
              <span>
                🟠 ${escapeHtml(
                  t(
                    "ronnyAi.logicWarningsFound"
                  ).replace(
                    "{count}",
                    String(
                      warnings.length
                    )
                  )
                )}
              </span>
            `
            : ""
        }

        ${warningHtml}
        ${loadErrorHtml}
        ${blueprintHtml}
        ${manualHtml}
      `;
    };


  checkAutomationLogic().catch(
    error => {
      console.error(
        "Ronny-AI-Logikprüfung fehlgeschlagen:",
        error
      );

      if (logicStatusRoot) {
        logicStatusRoot.innerHTML = `
          <span>
            🟠 ${escapeHtml(
              t(
                "ronnyAi.logicCheckFailed"
              )
            )}
          </span>
        `;
      }
    }
  );


  const ronnyState =
    ronnyStateResult.status === "fulfilled"
      ? ronnyStateResult.value || {}
      : {};

  const ignoredSuggestionKeys =
    new Set(
      Array.isArray(ronnyState.ignored)
        ? ronnyState.ignored
        : []
    );


  const deviceById =
    new Map(
      devices
        .filter(device => device?.id)
        .map(device => [
          device.id,
          device
        ])
    );


  const areaById =
    new Map(
      areas
        .filter(area => area?.area_id)
        .map(area => [
          area.area_id,
          area
        ])
    );


  const historyEntries =
    Array.isArray(ronnyState.history)
      ? ronnyState.history
      : [];

  const historyRoot =
    content.querySelector(
      "#ronnyAiHistoryList"
    );


  const historyValueLabel = value => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return t("ronnyAi.noArea");
    }

    const valueString =
      String(value);

      if (valueString === "orphaned") {
        return t(
          "ronnyAi.historyValueOrphaned"
        );
      }

      if (valueString === "removed") {
        return t(
          "ronnyAi.historyValueRemoved"
        );
      }

    return (
      areaById.get(valueString)?.name ||
      valueString
    );
  };


  const historyActionLabel = action => {
    switch (action) {
      case "applied":
        return t(
          "ronnyAi.historyApplied"
        );

      case "applied_edited":
        return t(
          "ronnyAi.historyAppliedEdited"
        );

      case "ignored":
        return t(
          "ronnyAi.historyIgnored"
        );

      case "restored":
        return t(
          "ronnyAi.historyRestored"
        );

      case "cleaned":
        return t(
          "ronnyAi.historyCleaned"
        );

      default:
        return t(
          "ronnyAi.historyUnknown"
        );
    }
  };


  const renderRonnyAiHistory = () => {
    if (!historyRoot) {
      return;
    }

    if (!historyEntries.length) {
      historyRoot.innerHTML = `
        <div class="ronny-ai-no-suggestions">
          ${t("ronnyAi.historyEmpty")}
        </div>
      `;

      return;
    }

    historyRoot.innerHTML =
      historyEntries
        .slice(0, 50)
        .map((entry, index) => {
          const action =
            String(
              entry?.action || ""
            );

          const targetName =
            entry?.target_name ||
            entry?.target_id ||
            t(
              "ronnyAi.historyEntryFallback"
            );

          const oldValue =
            historyValueLabel(
              entry?.old_value
            );

          const newValue =
            historyValueLabel(
              entry?.new_value
            );

          let timestamp = "";

          if (entry?.timestamp) {
            const date =
              new Date(
                entry.timestamp
              );

            if (
              !Number.isNaN(
                date.getTime()
              )
            ) {
              timestamp =
                date.toLocaleString();
            }
          }

          const suggestionKey =
            entry?.meta
              ?.suggestion_key ||
            "";

          const canRestore =
            action === "ignored" &&
            suggestionKey &&
            ignoredSuggestionKeys.has(
              suggestionKey
            );

          return `
            <div
              class="ronny-ai-feature"
              data-history-index="${index}"
            >
              <div
                class="ronny-ai-feature-icon"
              >
                ${
                  action === "ignored"
                    ? "🚫"
                    : action === "restored"
                      ? "↩️"
                      : "✅"
                }
              </div>

              <div
                style="
                  min-width: 0;
                  flex: 1;
                "
              >
                <strong>
                  ${escapeHtml(
                    targetName
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    historyActionLabel(
                      action
                    )
                  )}
                  ${
                    timestamp
                      ? ` · ${escapeHtml(
                          timestamp
                        )}`
                      : ""
                  }
                </span>

                <span
                  style="
                    display: block;
                    margin-top: 4px;
                  "
                >
                  ${escapeHtml(
                    t(
                      "ronnyAi.historyOldValue"
                    )
                  )}:
                  <strong>
                    ${escapeHtml(
                      oldValue
                    )}
                  </strong>

                  &nbsp;→&nbsp;

                  ${escapeHtml(
                    t(
                      "ronnyAi.historyNewValue"
                    )
                  )}:
                  <strong>
                    ${escapeHtml(
                      newValue
                    )}
                  </strong>
                </span>

                ${
                  canRestore
                    ? `
                      <button
                        type="button"
                        data-history-restore="${escapeHtml(
                          suggestionKey
                        )}"
                        style="
                          margin-top: 9px;
                        "
                      >
                        ${escapeHtml(
                          t(
                            "ronnyAi.restoreSuggestion"
                          )
                        )}
                      </button>
                    `
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("");

    historyRoot
      .querySelectorAll(
        "[data-history-restore]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const key =
              button.dataset
                .historyRestore;

            if (!key) {
              return;
            }

            button.disabled = true;

            try {
              await unignoreRonnyAiSuggestion(
                key
              );

              ignoredSuggestionKeys.delete(
                key
              );

              const sourceEntry =
                historyEntries.find(
                  entry =>
                    entry?.meta
                      ?.suggestion_key ===
                    key
                );

              try {
                await addRonnyAiHistory({
                  id:
                    `restore:${Date.now()}`,
                  type:
                    sourceEntry?.type ||
                    "device-area",
                  action: "restored",
                  target_id:
                    sourceEntry
                      ?.target_id ||
                    "",
                  target_name:
                    sourceEntry
                      ?.target_name ||
                    "",
                  old_value:
                    sourceEntry
                      ?.new_value ??
                    null,
                  new_value: null,
                  meta: {
                    suggestion_key:
                      key
                  },
                  timestamp:
                    new Date()
                      .toISOString()
                });
              } catch (
                historyError
              ) {
                console.warn(
                  "Ronny-AI-Verlauf konnte nicht gespeichert werden:",
                  historyError
                );
              }

              await renderRonnyAI(
                content
              );
            } catch (error) {
              button.disabled = false;

              console.error(
                "Ronny-AI-Ignorierung konnte nicht aufgehoben werden:",
                error
              );
            }
          }
        );
      });
  };


  renderRonnyAiHistory();


  const entitiesByDevice =
    new Map();

  for (const entity of entities) {
    if (
      !entity?.device_id ||
      entity?.disabled_by
    ) {
      continue;
    }

    if (!entitiesByDevice.has(entity.device_id)) {
      entitiesByDevice.set(
        entity.device_id,
        []
      );
    }

    entitiesByDevice
      .get(entity.device_id)
      .push(entity);
  }


  const areaSuggestions = [];

  for (const device of devices) {
    if (
      !device?.id ||
      device?.disabled_by ||
      device?.area_id
    ) {
      continue;
    }

    const relatedEntities =
      entitiesByDevice.get(device.id) || [];

    if (!relatedEntities.length) {
      continue;
    }

    /*
     * Sicherheitsstufe HOCH:
     * Jede aktive zugehörige Entität
     * muss bereits einen direkten Bereich haben.
     */
    if (
      relatedEntities.some(
        entity => !entity?.area_id
      )
    ) {
      continue;
    }

    const areaIds =
      [
        ...new Set(
          relatedEntities.map(
            entity => entity.area_id
          )
        )
      ];

    if (areaIds.length !== 1) {
      continue;
    }

    const areaId = areaIds[0];
    const area = areaById.get(areaId);

    if (!area) {
      continue;
    }

    areaSuggestions.push({
      type: "related-entities",
      device,
      area,
      relatedEntities
    });
  }


  /*
   * -------------------------------------------------------
   * RONNY AI – BEREICHSVORSCHLÄGE STUFE 2
   *
   * Nur physische Smart-Home-Geräte.
   *
   * Ein Vorschlag entsteht nur wenn:
   * - Kandidat selbst keinen Bereich hat
   * - Kandidat ein physisches Smart-Home-Gerät ist
   * - mindestens zwei bereits zugeordnete physische Geräte
   *   ein charakteristisches Namensmerkmal teilen
   * - alle Belege im exakt gleichen Bereich liegen
   *
   * Technische Begriffe wie fritz/fritzbox usw.
   * werden ausdrücklich nicht als Beweis verwendet.
   * -------------------------------------------------------
   */

  const physicalPlatforms =
    new Set([
      "mqtt",
      "zha",
      "zwave_js",
      "esphome",
      "shelly",
      "hue",
      "matter",
      "tuya",
      "deconz",
      "homematicip_local",
      "knx",
      "switchbot",
      "bosch_shc"
    ]);


  const ignoredNameWords =
    new Set([
      "licht",
      "lampe",
      "sensor",
      "kontakt",
      "controller",
      "schalter",
      "steckdose",
      "gerät",
      "geraet",
      "device",
      "smart",
      "zigbee",
      "wifi",
      "wlan",
      "fritz",
      "fritzbox",
      "repeater",
      "gateway"
    ]);


  const platformsForDevice =
    device => {
      const related =
        entitiesByDevice.get(device?.id) || [];

      return new Set(
        related
          .map(entity =>
            String(
              entity?.platform || ""
            ).toLowerCase()
          )
          .filter(Boolean)
      );
    };


  const isPhysicalDevice =
    device => {
      const platforms =
        platformsForDevice(device);

      for (const platform of platforms) {
        if (physicalPlatforms.has(platform)) {
          return true;
        }
      }

      return false;
    };


  const nameTokens =
    value => {
      const words =
        String(value || "")
          .toLowerCase()
          .match(
            /[a-z0-9äöüß]+/g
          ) || [];

      return [
        ...new Set(
          words.filter(word =>
            word.length >= 4 &&
            !ignoredNameWords.has(word) &&
            !/^[0-9]+$/.test(word)
          )
        )
      ];
    };


  /*
   * Bereits zugeordnete physische Geräte
   * bilden die Wissensbasis.
   */
  const assignedByToken =
    new Map();


  for (const device of devices) {
    if (
      !device?.id ||
      device?.disabled_by ||
      !device?.area_id ||
      !isPhysicalDevice(device)
    ) {
      continue;
    }

    for (
      const token of
      nameTokens(device.name)
    ) {
      if (!assignedByToken.has(token)) {
        assignedByToken.set(
          token,
          []
        );
      }

      assignedByToken
        .get(token)
        .push(device);
    }
  }


  /*
   * Geräte, die bereits durch Stufe 1
   * vorgeschlagen wurden, nicht doppelt anzeigen.
   */
  const suggestedDeviceIds =
    new Set(
      areaSuggestions.map(
        suggestion =>
          suggestion.device?.id
      )
    );


  for (const device of devices) {
    if (
      !device?.id ||
      device?.disabled_by ||
      device?.area_id ||
      suggestedDeviceIds.has(device.id) ||
      !isPhysicalDevice(device)
    ) {
      continue;
    }


    let bestSuggestion = null;


    for (
      const token of
      nameTokens(device.name)
    ) {
      const matches =
        assignedByToken.get(token) || [];


      /*
       * Mindestens zwei Belege.
       */
      if (matches.length < 2) {
        continue;
      }


      const matchedAreaIds =
        [
          ...new Set(
            matches
              .map(match =>
                match?.area_id
              )
              .filter(Boolean)
          )
        ];


      /*
       * Alle Vergleichsgeräte müssen
       * exakt denselben Bereich besitzen.
       */
      if (matchedAreaIds.length !== 1) {
        continue;
      }


      const areaId =
        matchedAreaIds[0];

      const area =
        areaById.get(areaId);


      if (!area) {
        continue;
      }


      const candidate = {
        type: "similar-devices",
        device,
        area,
        token,
        matches
      };


      /*
       * Bei mehreren möglichen Merkmalen
       * gewinnt das mit den meisten Belegen.
       */
      if (
        !bestSuggestion ||
        matches.length >
          bestSuggestion.matches.length
      ) {
        bestSuggestion =
          candidate;
      }
    }


    if (bestSuggestion) {
      areaSuggestions.push(
        bestSuggestion
      );

      suggestedDeviceIds.add(
        device.id
      );
    }
  }


  for (const suggestion of areaSuggestions) {
    suggestion.key =
      [
        "device-area",
        suggestion.device?.id || "",
        suggestion.area?.area_id || ""
      ].join(":");
  }

  const visibleAreaSuggestions =
    areaSuggestions.filter(
      suggestion =>
        !ignoredSuggestionKeys.has(
          suggestion.key
        )
    );


  const suggestionRoot =
    content.querySelector(
      "#ronnyAiAreaSuggestions"
    );

  if (suggestionRoot) {
    if (!visibleAreaSuggestions.length) {
      suggestionRoot.innerHTML = `
        <div class="ronny-ai-no-suggestions">
          ✅ ${t("ronnyAi.noAreaSuggestions")}
        </div>
      `;
    } else {
      suggestionRoot.innerHTML =
        visibleAreaSuggestions
          .map((suggestion, index) => {
            const device =
              suggestion.device;

            const area =
              suggestion.area;

            let reason;

            if (
              suggestion.type ===
              "similar-devices"
            ) {
              reason =
                t(
                  "ronnyAi.similarDevicesReason"
                )
                  .replace(
                    "{count}",
                    String(
                      suggestion
                        .matches
                        .length
                    )
                  )
                  .replace(
                    "{term}",
                    suggestion.token
                  )
                  .replace(
                    "{area}",
                    suggestion.area.name ||
                    suggestion.area.area_id
                  );
            } else {
              reason =
                t("ronnyAi.relatedEntities")
                  .replace(
                    "{count}",
                    String(
                      suggestion
                        .relatedEntities
                        .length
                    )
                  );
            }

            const options =
              areas
                .slice()
                .sort((a, b) =>
                  String(a?.name || "")
                    .localeCompare(
                      String(b?.name || "")
                    )
                )
                .map(item => `
                  <option
                    value="${escapeHtml(
                      item.area_id
                    )}"
                    ${
                      item.area_id ===
                      area.area_id
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(
                      item.name ||
                      item.area_id
                    )}
                  </option>
                `)
                .join("");

            return `
              <article
                class="ronny-ai-suggestion-card"
                data-suggestion-index="${index}"
              >
                <div class="ronny-ai-suggestion-head">
                  <div class="ronny-ai-suggestion-device">
                    <strong>
                      ${escapeHtml(
                        device.name ||
                        device.id
                      )}
                    </strong>

                    <small>
                      ${escapeHtml(
                        device.manufacturer || "–"
                      )}
                      ·
                      ${escapeHtml(
                        device.model || "–"
                      )}
                    </small>
                  </div>

                  <span class="ronny-ai-confidence">
                    ${t("ronnyAi.confidence")}:
                    ${t("ronnyAi.confidenceHigh")}
                  </span>
                </div>

                <div class="ronny-ai-suggestion-details">
                  <div>
                    <span>
                      ${t("ronnyAi.currentArea")}
                    </span>

                    <strong>
                      ${t("ronnyAi.noArea")}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ${t("ronnyAi.proposedArea")}
                    </span>

                    <strong>
                      ${escapeHtml(
                        area.name ||
                        area.area_id
                      )}
                    </strong>
                  </div>
                </div>

                ${
                  suggestion.type ===
                  "similar-devices"
                    ? `
                      <div class="ronny-ai-suggestion-reason">
                        <strong>
                          ${t("ronnyAi.matchedFeature")}:
                        </strong>
                        ${escapeHtml(
                          suggestion.token
                        )}
                      </div>
                    `
                    : ""
                }

                <div class="ronny-ai-suggestion-reason">
                  <strong>
                    ${t("ronnyAi.reason")}:
                  </strong>
                  ${escapeHtml(reason)}
                </div>

                <div class="ronny-ai-suggestion-actions">
                  <button
                    type="button"
                    class="ronny-ai-action primary"
                    data-ai-action="apply"
                  >
                    ${t("ronnyAi.apply")}
                  </button>

                  <button
                    type="button"
                    class="ronny-ai-action"
                    data-ai-action="edit"
                  >
                    ${t("ronnyAi.edit")}
                  </button>

                  <button
                    type="button"
                    class="ronny-ai-action"
                    data-ai-action="ignore"
                  >
                    ${t("ronnyAi.ignore")}
                  </button>
                </div>

                <div class="ronny-ai-area-editor">
                  <select
                    class="ronny-ai-area-select"
                    aria-label="${escapeHtml(
                      t("ronnyAi.selectArea")
                    )}"
                  >
                    ${options}
                  </select>

                  <button
                    type="button"
                    class="ronny-ai-action primary"
                    data-ai-action="apply-edited"
                  >
                    ${t("ronnyAi.apply")}
                  </button>

                  <button
                    type="button"
                    class="ronny-ai-action"
                    data-ai-action="cancel-edit"
                  >
                    ${t("ronnyAi.cancel")}
                  </button>
                </div>
              </article>
            `;
          })
          .join("");


      /*
       * Ronny AI Decision Center
       *
       * Ergänzt bestehende Vorschläge ausschließlich
       * um Bewertung und eine zweite Bestätigungsstufe.
       *
       * Die eigentlichen Apply-/Edit-/Ignore-Handler
       * darunter bleiben unverändert.
       */
      const applyRonnyAiDecisionCenter =
        () => {
          suggestionRoot
            .querySelectorAll(
              ".ronny-ai-suggestion-card"
            )
            .forEach(card => {
              const index =
                Number(
                  card.dataset
                    .suggestionIndex
                );

              const suggestion =
                visibleAreaSuggestions[
                  index
                ];

              if (!suggestion) {
                return;
              }


              /*
               * Sicherheit / Confidence
               *
               * exact:
               *   sehr starke Übereinstimmung
               *
               * token:
               *   gute Namens-/Merkmalsübereinstimmung
               *
               * Rest:
               *   vorsichtiger behandeln
               */
              const suggestionType =
                String(
                  suggestion.type || ""
                ).toLowerCase();

              let confidence = 74;
              let priority = 3;
              let risk = 1;

              if (
                suggestionType.includes(
                  "exact"
                )
              ) {
                confidence = 97;
                priority = 1;
              } else if (
                suggestionType.includes(
                  "token"
                )
              ) {
                confidence = 89;
                priority = 2;
              } else if (
                suggestion.token
              ) {
                confidence = 84;
                priority = 2;
              }


              /*
               * Bereichszuordnung ist grundsätzlich
               * ein niedriges Risiko.
               *
               * Falls bereits ein Bereich vorhanden
               * wäre, markieren wir vorsichtiger.
               */
              if (
                suggestion.device?.area_id
              ) {
                risk = 2;
              }


              const targetName =
                suggestion.area?.name ||
                suggestion.area?.area_id ||
                "–";

              const details =
                card.querySelector(
                  ".ronny-ai-suggestion-details"
                );

              if (
                details &&
                !details.querySelector(
                  ".ronny-ai-decision-meta"
                )
              ) {
                const meta =
                  document.createElement(
                    "div"
                  );

                meta.className =
                  "ronny-ai-decision-meta";

                meta.innerHTML = `
                  <span
                    class="
                      ronny-ai-decision-badge
                      priority-${priority}
                    "
                    title="Priority"
                  >
                    ${
                      priority === 1
                        ? "🔴"
                        : priority === 2
                          ? "🟠"
                          : "🔵"
                    }
                    P${priority}
                  </span>

                  <span
                    class="ronny-ai-decision-badge"
                    title="Risk"
                  >
                    🛡️ R${risk}
                  </span>

                  <span
                    class="ronny-ai-decision-badge"
                    title="Confidence"
                  >
                    ◎ ${confidence}%
                  </span>
                `;

                details.prepend(meta);


                const target =
                  document.createElement(
                    "div"
                  );

                target.className =
                  "ronny-ai-decision-target";

                target.innerHTML = `
                  <span
                    class="ronny-ai-decision-target-arrow"
                  >
                    →
                  </span>

                  <strong>
                    ${escapeHtml(
                      targetName
                    )}
                  </strong>
                `;

                meta.insertAdjacentElement(
                  "afterend",
                  target
                );
              }


              if (
                !card.querySelector(
                  ".ronny-ai-prepared-state"
                )
              ) {
                const state =
                  document.createElement(
                    "div"
                  );

                state.className =
                  "ronny-ai-prepared-state";

                state.hidden = true;

                state.innerHTML = `
                  <span
                    class="ronny-ai-prepared-dot"
                  ></span>

                  <span>
                    ✓ →
                    ${escapeHtml(
                      targetName
                    )}
                  </span>
                `;

                const actions =
                  card.querySelector(
                    ".ronny-ai-suggestion-actions"
                  );

                actions
                  ?.insertAdjacentElement(
                    "afterend",
                    state
                  );
              }
            });
        };


      applyRonnyAiDecisionCenter();


      /*
       * Zweite Bestätigungsstufe.
       *
       * CAPTURE ist hier absichtlich gewählt:
       * Beim ersten Klick wird der bestehende
       * Apply-Handler noch nicht erreicht.
       *
       * Erst beim zweiten Klick darf die bereits
       * vorhandene Apply-Logik weiterlaufen.
       */
      if (
        !suggestionRoot.dataset
          .decisionCenterBound
      ) {
        suggestionRoot.dataset
          .decisionCenterBound =
            "true";

        suggestionRoot.addEventListener(
          "click",
          event => {
            const button =
              event.target.closest(
                [
                  '[data-ai-action="apply"]',
                  '[data-ai-action="apply-edited"]'
                ].join(",")
              );

            if (!button) {
              return;
            }

            const card =
              button.closest(
                ".ronny-ai-suggestion-card"
              );

            if (!card) {
              return;
            }


            /*
             * Zweiter Klick:
             * bestehende Apply-Logik darf laufen.
             */
            if (
              button.dataset
                .ronnyAiConfirmed ===
                "true"
            ) {
              return;
            }


            /*
             * Erster Klick:
             * nur vorbereiten.
             */
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            card
              .querySelectorAll(
                [
                  '[data-ai-action="apply"]',
                  '[data-ai-action="apply-edited"]'
                ].join(",")
              )
              .forEach(otherButton => {
                otherButton.dataset
                  .ronnyAiConfirmed =
                    "false";
              });

            button.dataset
              .ronnyAiConfirmed =
                "true";

            if (
              !button.dataset
                .ronnyAiOriginalText
            ) {
              button.dataset
                .ronnyAiOriginalText =
                  button.textContent.trim();
            }

            button.textContent =
              `✓ ${
                button.dataset
                  .ronnyAiOriginalText
              }`;

            card.classList.add(
              "is-prepared"
            );

            const preparedState =
              card.querySelector(
                ".ronny-ai-prepared-state"
              );

            if (preparedState) {
              preparedState.hidden =
                false;
            }
          },
          true
        );


        /*
         * Sobald der Benutzer wieder editiert
         * oder abbricht, wird die vorbereitete
         * Freigabe zurückgesetzt.
         */
        suggestionRoot.addEventListener(
          "click",
          event => {
            const resetButton =
              event.target.closest(
                [
                  '[data-ai-action="edit"]',
                  '[data-ai-action="cancel"]',
                  '[data-ai-action="ignore"]'
                ].join(",")
              );

            if (!resetButton) {
              return;
            }

            const card =
              resetButton.closest(
                ".ronny-ai-suggestion-card"
              );

            if (!card) {
              return;
            }

            card.classList.remove(
              "is-prepared"
            );

            const preparedState =
              card.querySelector(
                ".ronny-ai-prepared-state"
              );

            if (preparedState) {
              preparedState.hidden =
                true;
            }

            card
              .querySelectorAll(
                [
                  '[data-ai-action="apply"]',
                  '[data-ai-action="apply-edited"]'
                ].join(",")
              )
              .forEach(applyButton => {
                applyButton.dataset
                  .ronnyAiConfirmed =
                    "false";

                const original =
                  applyButton.dataset
                    .ronnyAiOriginalText;

                if (original) {
                  applyButton.textContent =
                    original;
                }
              });
          }
        );
      }


      suggestionRoot
        .querySelectorAll(
          ".ronny-ai-suggestion-card"
        )
        .forEach(card => {
          const index =
            Number(
              card.dataset.suggestionIndex
            );

          const suggestion =
            visibleAreaSuggestions[index];

          if (!suggestion) {
            return;
          }

          const editor =
            card.querySelector(
              ".ronny-ai-area-editor"
            );

          const select =
            card.querySelector(
              ".ronny-ai-area-select"
            );

          const applyArea =
            async areaId => {
              if (!areaId) {
                return;
              }

              const buttons =
                card.querySelectorAll(
                  "button"
                );

              buttons.forEach(
                button =>
                  button.disabled = true
              );

              try {
                await setDeviceArea(
                  suggestion.device.id,
                  areaId
                );

                /*
                 * Die Home-Assistant-Änderung ist
                 * bereits erfolgreich. Der Verlauf
                 * wird separat protokolliert.
                 */
                try {
                  await addRonnyAiHistory({
                    id:
                      `device-area:${suggestion.device.id}:${Date.now()}`,
                    type: "device-area",
                    action:
                      areaId ===
                      suggestion.area?.area_id
                        ? "applied"
                        : "applied_edited",
                    target_id:
                      suggestion.device.id,
                    target_name:
                      suggestion.device.name ||
                      suggestion.device.id,
                    old_value: null,
                    new_value: areaId,
                    meta: {
                      suggestion_key:
                        suggestion.key,
                      suggestion_type:
                        suggestion.type,
                      proposed_area_id:
                        suggestion.area?.area_id ||
                        null,
                      matched_feature:
                        suggestion.token || null
                    },
                    timestamp:
                      new Date().toISOString()
                  });
                } catch (historyError) {
                  console.warn(
                    "Ronny-AI-Verlauf konnte nicht gespeichert werden:",
                    historyError
                  );
                }

                card.innerHTML = `
                  <div class="ronny-ai-no-suggestions">
                    ✅ ${t(
                      "ronnyAi.applySuccess"
                    )}
                  </div>
                `;
              } catch (error) {
                buttons.forEach(
                  button =>
                    button.disabled = false
                );

                window.alert(
                  t("ronnyAi.applyFailed")
                );
              }
            };


          card
            .querySelector(
              '[data-ai-action="apply"]'
            )
            ?.addEventListener(
              "click",
              () =>
                applyArea(
                  suggestion.area.area_id
                )
            );


          card
            .querySelector(
              '[data-ai-action="edit"]'
            )
            ?.addEventListener(
              "click",
              () => {
                editor?.classList.add(
                  "active"
                );
              }
            );


          card
            .querySelector(
              '[data-ai-action="cancel-edit"]'
            )
            ?.addEventListener(
              "click",
              () => {
                editor?.classList.remove(
                  "active"
                );
              }
            );


          card
            .querySelector(
              '[data-ai-action="apply-edited"]'
            )
            ?.addEventListener(
              "click",
              () =>
                applyArea(
                  select?.value
                )
            );


          card
            .querySelector(
              '[data-ai-action="ignore"]'
            )
            ?.addEventListener(
              "click",
              async () => {
                const buttons =
                  card.querySelectorAll(
                    "button"
                  );

                buttons.forEach(
                  button =>
                    button.disabled = true
                );

                try {
                  await ignoreRonnyAiSuggestion(
                    suggestion.key
                  );

                  try {
                    await addRonnyAiHistory({
                      id:
                        `ignore:${suggestion.device.id}:${Date.now()}`,
                      type: "device-area",
                      action: "ignored",
                      target_id:
                        suggestion.device.id,
                      target_name:
                        suggestion.device.name ||
                        suggestion.device.id,
                      old_value: null,
                      new_value:
                        suggestion.area?.area_id ||
                        null,
                      meta: {
                        suggestion_key:
                          suggestion.key,
                        suggestion_type:
                          suggestion.type,
                        matched_feature:
                          suggestion.token || null
                      },
                      timestamp:
                        new Date().toISOString()
                    });
                  } catch (historyError) {
                    console.warn(
                      "Ronny-AI-Verlauf konnte nicht gespeichert werden:",
                      historyError
                    );
                  }

                  card.remove();

                  if (
                    suggestionRoot
                      .querySelectorAll(
                        ".ronny-ai-suggestion-card"
                      )
                      .length === 0
                  ) {
                    suggestionRoot.innerHTML = `
                      <div class="ronny-ai-no-suggestions">
                        ${t(
                          "ronnyAi.ignoredForCheck"
                        )}
                      </div>
                    `;
                  }
                } catch (error) {
                  buttons.forEach(
                    button =>
                      button.disabled = false
                  );

                  console.error(
                    "Ronny-AI-Vorschlag konnte nicht ignoriert werden:",
                    error
                  );
                }
              }
            );
        });
    }
  }


  const entityRegistryById =
    new Map(
      entities
        .filter(entity => entity?.entity_id)
        .map(entity => [
          entity.entity_id,
          entity
        ])
    );


  const ignoredUnavailablePlatforms =
    new Set([
      "template",
      "command_line",
      "check_weather"
    ]);


  const unavailableDeviceIds =
    new Set();


  const unavailableDeviceDetails =
    new Map();

  const standaloneUnavailableDetails =
    [];

  let standaloneUnavailable = 0;


  for (const state of states) {
    if (state?.state !== "unavailable") {
      continue;
    }

    const entityId =
      String(
        state?.entity_id || ""
      );

    const registryEntity =
      entityRegistryById.get(entityId);

    if (registryEntity?.disabled_by) {
      continue;
    }

    const deviceId =
      registryEntity?.device_id;

    if (deviceId) {
      const device =
        deviceById.get(deviceId);

      if (device?.disabled_by) {
        continue;
      }

      unavailableDeviceIds.add(
        deviceId
      );

      const deviceName =
        device?.name_by_user ||
        device?.name ||
        device?.model ||
        deviceId;

      const existingDeviceDetail =
        unavailableDeviceDetails.get(
          deviceId
        ) || {
          deviceId,
          name: deviceName,
          entities: []
        };

      existingDeviceDetail.entities.push(
        entityId
      );

      unavailableDeviceDetails.set(
        deviceId,
        existingDeviceDetail
      );

      continue;
    }

    const domain =
      entityId.includes(".")
        ? entityId.split(".", 1)[0]
        : "";

    if (domain.startsWith("input_")) {
      continue;
    }

    const platform =
      registryEntity?.platform ||
      "";

    if (
      ignoredUnavailablePlatforms.has(
        platform
      )
    ) {
      continue;
    }

    standaloneUnavailableDetails.push({
      entityId,
      platform:
        platform || "unknown"
    });

    standaloneUnavailable += 1;
  }


  const unavailable =
    unavailableDeviceIds.size +
    standaloneUnavailable;


  const disabledEntities =
    entities.filter(
      entity =>
        Boolean(entity?.disabled_by)
    ).length;


  const disabledDeviceItems =
    devices.filter(
      device =>
        Boolean(device?.disabled_by)
    );


  const disabledDevices =
    disabledDeviceItems.length;


  const areaRelevantEntityDomains =
    new Set([
      "light",
      "switch",
      "media_player",
      "climate",
      "cover",
      "fan",
      "lock",
      "camera",
      "vacuum",
      "humidifier",
      "alarm_control_panel",
      "siren"
    ]);


  const entitiesWithoutAreaItems =
    entities.filter(entity => {
      if (entity?.disabled_by) {
        return false;
      }

      if (entity?.area_id) {
        return false;
      }

      /*
       * Entitäten mit Gerät werden nicht
       * nochmals separat gezählt.
       * Fehlende Bereiche werden dort
       * über das Gerät bewertet.
       */
      if (entity?.device_id) {
        return false;
      }

      const entityId =
        String(
          entity?.entity_id || ""
        );

      const domain =
        entityId.includes(".")
          ? entityId.split(".", 1)[0]
          : "";

      return (
        areaRelevantEntityDomains.has(
          domain
        )
      );
    });


  const entitiesWithoutArea =
    entitiesWithoutAreaItems.length;


  const devicesWithoutAreaItems =
    devices.filter(
      device =>
        !device?.disabled_by &&
        !device?.area_id &&
        isPhysicalDevice(device)
    );


  const devicesWithoutArea =
    devicesWithoutAreaItems.length;


  const disabled =
    disabledDevices;


  const errors =
    unavailable;


  const warnings =
    entitiesWithoutArea +
    devicesWithoutArea +
    disabled;


  /*
   * Noch KEINE künstlich erzeugten
   * KI-Vorschläge.
   *
   * Sobald die Vorschlags-Engine existiert,
   * wird dieser Wert daraus berechnet.
   */

  const normalizeRonnyAiText =
    value =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, " ")
        .trim();


  const ronnyAiTokens =
    value =>
      normalizeRonnyAiText(value)
        .split(/\s+/)
        .filter(token => token.length >= 3);


  const ronnyAiLabelId =
    label =>
      String(
        label?.label_id ||
        label?.id ||
        ""
      );


  const ronnyAiLabelName =
    label =>
      String(
        label?.name ||
        label?.label_id ||
        label?.id ||
        ""
      );


  const ronnyAiObjectLabels =
    item => {
      const raw =
        item?.labels ??
        item?.label_ids ??
        [];

      return Array.isArray(raw)
        ? raw
        : [];
    };


  const ronnyAiAreaNameById =
    new Map(
      areas.map(area => [
        area?.area_id,
        area?.name || ""
      ])
    );


  const ronnyAiIgnoredKeys =
    new Set(
      (
        Array.isArray(
          ronnyState?.ignored
        )
          ? ronnyState.ignored
          : []
      )
        .map(item =>
          typeof item === "string"
            ? item
            : item?.key ||
              item?.suggestion_key ||
              ""
        )
        .filter(Boolean)
    );


  const buildRonnyAiLabelSuggestions =
    () => {
      const result = [];

      const evaluate =
        (
          kind,
          id,
          item,
          name,
          areaId
        ) => {
          if (!id || !name) {
            return;
          }

          const existing =
            new Set(
              ronnyAiObjectLabels(item)
            );

          const areaName =
            ronnyAiAreaNameById.get(
              areaId
            ) || "";

          const sourceText =
            normalizeRonnyAiText(
              `${name} ${areaName}`
            );

          const sourceTokens =
            new Set(
              ronnyAiTokens(sourceText)
            );

          let best = null;

          labels.forEach(label => {
            const id =
              ronnyAiLabelId(label);

            const name =
              ronnyAiLabelName(label);

            if (
              !id ||
              !name ||
              existing.has(id)
            ) {
              return;
            }

            const normalized =
              normalizeRonnyAiText(name);

            const tokens =
              ronnyAiTokens(name);

            let confidence = 0;

            if (
              normalized.length >= 4 &&
              sourceText.includes(
                normalized
              )
            ) {
              confidence = 97;
            }

            if (
              tokens.length >= 2 &&
              tokens.every(token =>
                sourceTokens.has(token)
              )
            ) {
              confidence =
                Math.max(
                  confidence,
                  95
                );
            }

            if (
              tokens.length === 1 &&
              tokens[0].length >= 5 &&
              sourceTokens.has(tokens[0])
            ) {
              confidence =
                Math.max(
                  confidence,
                  90
                );
            }

            if (confidence < 90) {
              return;
            }

            if (
              !best ||
              confidence >
                best.confidence
            ) {
              best = {
                label,
                confidence
              };
            }
          });

          if (!best) {
            return;
          }

          const matchedId =
            ronnyAiLabelId(
              best.label
            );

          const key =
            `${kind}-label:${id}:${matchedId}`;

          if (
            ronnyAiIgnoredKeys.has(key)
          ) {
            return;
          }

          result.push({
            key,
            type:
              `${kind}-label`,
            kind,
            targetId: id,
            targetName: name,
            item,
            labelId: matchedId,
            labelName:
              ronnyAiLabelName(
                best.label
              ),
            confidence:
              best.confidence,
            priority: 3,
            risk: 1
          });
        };


      devices.forEach(device => {
        if (
          !device?.id ||
          device?.disabled_by
        ) {
          return;
        }

        if (
          typeof isPhysicalDevice ===
            "function" &&
          !isPhysicalDevice(device)
        ) {
          return;
        }

        const name =
          device?.name_by_user ||
          device?.name ||
          device?.model ||
          "";

        evaluate(
          "device",
          device.id,
          device,
          name,
          device?.area_id
        );
      });


      entities.forEach(entity => {
        if (
          !entity?.entity_id ||
          entity?.disabled_by ||
          entity?.device_id
        ) {
          return;
        }

        const entityId =
          String(
            entity.entity_id
          );

        const domain =
          entityId.includes(".")
            ? entityId.split(".", 1)[0]
            : "";

        if (
          typeof areaRelevantEntityDomains !==
            "undefined" &&
          !areaRelevantEntityDomains.has(
            domain
          )
        ) {
          return;
        }

        const name =
          entity?.name ||
          entity?.original_name ||
          entityId;

        evaluate(
          "entity",
          entityId,
          entity,
          name,
          entity?.area_id
        );
      });


      return result
        .sort(
          (a, b) =>
            b.confidence -
              a.confidence
        )
        .slice(0, 30);
    };


  const ronnyAiLooksTechnicalName =
    value => {
      const name =
        String(value || "").trim();

      if (
        !name ||
        name.length < 4
      ) {
        return false;
      }

      if (
        /\b\d{1,3}(?:[._-]\d{1,3}){3}\b/.test(
          name
        )
      ) {
        return false;
      }

      if (
        /\b(?:[0-9A-F]{2}[-:]){4,}[0-9A-F]{2}\b/i.test(
          name
        )
      ) {
        return false;
      }

      return (
        name.includes("_") ||
        name.includes("--") ||
        /\s{2,}/.test(name)
      );
    };


  const ronnyAiCleanName =
    value =>
      String(value || "")
        .replace(/_/g, " ")
        .replace(/-{2,}/g, " ")
        .replace(/\s+/g, " ")
        .trim();


  const buildRonnyAiNameSuggestions =
    () => {
      const result = [];


      devices.forEach(device => {
        if (
          !device?.id ||
          device?.disabled_by
        ) {
          return;
        }

        const oldName =
          String(
            device?.name_by_user ||
            ""
          ).trim();

        if (
          !ronnyAiLooksTechnicalName(
            oldName
          )
        ) {
          return;
        }

        const newName =
          ronnyAiCleanName(
            oldName
          );

        if (
          !newName ||
          newName === oldName
        ) {
          return;
        }

        const key =
          `device-name:${device.id}:${normalizeRonnyAiText(newName)}`;

        if (
          ronnyAiIgnoredKeys.has(key)
        ) {
          return;
        }

        result.push({
          key,
          type: "device-name",
          kind: "device",
          targetId: device.id,
          targetName: oldName,
          item: device,
          oldName,
          newName,
          confidence: 97,
          priority: 3,
          risk: 1
        });
      });


      entities.forEach(entity => {
        if (
          !entity?.entity_id ||
          entity?.disabled_by
        ) {
          return;
        }

        const oldName =
          String(
            entity?.name ||
            ""
          ).trim();

        if (
          !ronnyAiLooksTechnicalName(
            oldName
          )
        ) {
          return;
        }

        const newName =
          ronnyAiCleanName(
            oldName
          );

        if (
          !newName ||
          newName === oldName
        ) {
          return;
        }

        const entityId =
          String(
            entity.entity_id
          );

        const key =
          `entity-name:${entityId}:${normalizeRonnyAiText(newName)}`;

        if (
          ronnyAiIgnoredKeys.has(key)
        ) {
          return;
        }

        result.push({
          key,
          type: "entity-name",
          kind: "entity",
          targetId: entityId,
          targetName: oldName,
          item: entity,
          oldName,
          newName,
          confidence: 97,
          priority: 3,
          risk: 1
        });
      });


      return result
        .sort(
          (a, b) =>
            String(a.targetName)
              .localeCompare(
                String(b.targetName)
              )
        )
        .slice(0, 30);
    };


  const visibleLabelSuggestions =
    buildRonnyAiLabelSuggestions();


  const visibleNameSuggestions =
    buildRonnyAiNameSuggestions();


  const renderRonnyAiSmartSuggestions =
    (
      rootId,
      suggestions,
      mode
    ) => {
      const root =
        content.querySelector(
          `#${rootId}`
        );

      if (!root) {
        return;
      }

      root.innerHTML =
        suggestions
          .map(
            (
              suggestion,
              index
            ) => {
              const isLabel =
                mode === "label";

              const oldValue =
                isLabel
                  ? suggestion.targetName
                  : suggestion.oldName;

              const newValue =
                isLabel
                  ? `🏷️ ${suggestion.labelName}`
                  : suggestion.newName;

              const labelOptions =
                isLabel
                  ? labels
                      .map(label => {
                        const id =
                          ronnyAiLabelId(
                            label
                          );

                        const name =
                          ronnyAiLabelName(
                            label
                          );

                        if (!id || !name) {
                          return "";
                        }

                        return `
                          <option
                            value="${escapeHtml(id)}"
                            ${
                              id ===
                                suggestion.labelId
                                ? "selected"
                                : ""
                            }
                          >
                            ${escapeHtml(name)}
                          </option>
                        `;
                      })
                      .join("")
                  : "";

              return `
                <div
                  class="ronny-ai-suggestion-card"
                  data-smart-index="${index}"
                >
                  <div
                    class="ronny-ai-suggestion-head"
                  >
                    <div
                      class="ronny-ai-suggestion-device"
                    >
                      ${escapeHtml(
                        suggestion.targetName
                      )}
                    </div>
                  </div>

                  <div
                    class="ronny-ai-decision-meta"
                  >
                    <span
                      class="
                        ronny-ai-decision-badge
                        priority-${suggestion.priority}
                      "
                      title="Priorität"
                    >
                      ${
                        suggestion.priority === 1
                          ? "🔴 Priorität: hoch"
                          : suggestion.priority === 2
                            ? "🟠 Priorität: mittel"
                            : "🔵 Priorität: niedrig"
                      }
                    </span>

                    <span
                      class="ronny-ai-decision-badge"
                      title="Risiko der Änderung"
                    >
                      🛡️ Risiko:
                      ${
                        suggestion.risk === 1
                          ? "niedrig"
                          : suggestion.risk === 2
                            ? "mittel"
                            : "hoch"
                      }
                    </span>

                    <span
                      class="ronny-ai-decision-badge"
                      title="Sicherheit der Erkennung"
                    >
                      ◎ Sicherheit:
                      ${suggestion.confidence}%
                    </span>
                  </div>

                  <div
                    class="ronny-ai-smart-value"
                  >
                    <span
                      class="ronny-ai-smart-old"
                    >
                      ${escapeHtml(
                        oldValue
                      )}
                    </span>

                    <span
                      class="ronny-ai-smart-new"
                    >
                      → ${escapeHtml(
                        newValue
                      )}
                    </span>
                  </div>

                  <div
                    class="ronny-ai-suggestion-actions"
                  >
                    <button
                      type="button"
                      class="ronny-ai-action primary"
                      data-smart-action="apply"
                    >
                      ${t("ronnyAi.apply")}
                    </button>

                    <button
                      type="button"
                      class="ronny-ai-action"
                      data-smart-action="edit"
                    >
                      ${t("ronnyAi.edit")}
                    </button>

                    <button
                      type="button"
                      class="ronny-ai-action"
                      data-smart-action="ignore"
                    >
                      ${t("ronnyAi.ignore")}
                    </button>
                  </div>

                  <div
                    class="ronny-ai-prepared-state"
                    hidden
                  >
                    <span
                      class="ronny-ai-prepared-dot"
                    ></span>

                    <span>
                      ✓ → ${escapeHtml(
                        newValue
                      )}
                    </span>
                  </div>

                  <div
                    class="ronny-ai-smart-editor"
                  >
                    ${
                      isLabel
                        ? `
                          <select
                            class="ronny-ai-smart-select"
                            data-smart-value
                            size="6"
                          >
                            ${labelOptions}
                          </select>
                        `
                        : `
                          <input
                            type="text"
                            class="ronny-ai-smart-input"
                            data-smart-value
                            value="${escapeHtml(
                              suggestion.newName
                            )}"
                          >
                        `
                    }

                    <button
                      type="button"
                      class="ronny-ai-action primary"
                      data-smart-action="apply-edited"
                    >
                      ${t("ronnyAi.apply")}
                    </button>
                  </div>
                </div>
              `;
            }
          )
          .join("");

        // PHOENIX: Label-Vorschläge nach Label gruppieren
        if (mode === "label" && suggestions.length) {

          const groups =
            new Map();

          suggestions.forEach(
            (
              suggestion,
              index
            ) => {

              const groupKey =
                String(
                  suggestion.labelId ||
                  suggestion.labelName ||
                  "label"
                );

              if (!groups.has(groupKey)) {
                groups.set(
                  groupKey,
                  {
                    labelName:
                      suggestion.labelName ||
                      "Label",

                    indexes: []
                  }
                );
              }

              groups
                .get(groupKey)
                .indexes
                .push(index);
            }
          );


          const cardsByIndex =
            new Map();

          root
            .querySelectorAll(
              ".ronny-ai-suggestion-card[data-smart-index]"
            )
            .forEach(card => {

              const index =
                Number(
                  card.dataset.smartIndex
                );

              if (
                Number.isInteger(index)
              ) {
                cardsByIndex.set(
                  index,
                  card
                );
              }
            });


          const fragment =
            document.createDocumentFragment();


          groups.forEach(
            group => {

              const wrapper =
                document.createElement(
                  "div"
                );

              wrapper.className =
                "ronny-ai-label-group";


              const toggle =
                document.createElement(
                  "button"
                );

              toggle.type =
                "button";

              toggle.className =
                "ronny-ai-label-group-toggle";

              toggle.setAttribute(
                "aria-expanded",
                "false"
              );


              const title =
                document.createElement(
                  "span"
                );

              title.className =
                "ronny-ai-label-group-title";

              title.textContent =
                `🏷️ ${group.labelName}`;


              const count =
                document.createElement(
                  "span"
                );

              count.className =
                "ronny-ai-label-group-count";

              count.textContent =
                String(
                  group.indexes.length
                );


              toggle.append(
                title,
                count
              );


              const groupContent =
                document.createElement(
                  "div"
                );

              groupContent.className =
                "ronny-ai-label-group-content";

              groupContent.hidden =
                true;


              group.indexes.forEach(
                index => {

                  const card =
                    cardsByIndex.get(index);

                  if (card) {
                    groupContent.appendChild(
                      card
                    );
                  }
                }
              );


              toggle.addEventListener(
                "click",
                () => {

                  const open =
                    groupContent.hidden;

                  groupContent.hidden =
                    !open;

                  toggle.setAttribute(
                    "aria-expanded",
                    open
                      ? "true"
                      : "false"
                  );
                }
              );


              wrapper.append(
                toggle,
                groupContent
              );

              fragment.appendChild(
                wrapper
              );
            }
          );


          root.replaceChildren(
            fragment
          );
        }



      const resetPrepared =
        card => {
          card.classList.remove(
            "is-prepared"
          );

          const prepared =
            card.querySelector(
              ".ronny-ai-prepared-state"
            );

          if (prepared) {
            prepared.hidden = true;
          }

          card
            .querySelectorAll(
              [
                '[data-smart-action="apply"]',
                '[data-smart-action="apply-edited"]'
              ].join(",")
            )
            .forEach(button => {
              button.dataset.confirmed =
                "false";

              if (
                button.dataset.originalText
              ) {
                button.textContent =
                  button.dataset.originalText;
              }
            });
        };


      const confirmSecondClick =
        (
          button,
          card
        ) => {
          if (
            button.dataset.confirmed ===
              "true"
          ) {
            return true;
          }

          resetPrepared(card);

          button.dataset.confirmed =
            "true";

          button.dataset.originalText =
            button.textContent.trim();

          button.textContent =
            `✓ ${button.dataset.originalText}`;

          card.classList.add(
            "is-prepared"
          );

          const prepared =
            card.querySelector(
              ".ronny-ai-prepared-state"
            );

          if (prepared) {
            prepared.hidden = false;
          }

          return false;
        };


      root
        .querySelectorAll(
          ".ronny-ai-suggestion-card"
        )
        .forEach(card => {
          const index =
            Number(
              card.dataset.smartIndex
            );

          const suggestion =
            suggestions[index];

          if (!suggestion) {
            return;
          }

          const editor =
            card.querySelector(
              ".ronny-ai-smart-editor"
            );

          const valueInput =
            card.querySelector(
              "[data-smart-value]"
            );


          card
            .querySelector(
              '[data-smart-action="edit"]'
            )
            ?.addEventListener(
              "click",
              () => {
                resetPrepared(card);

                editor?.classList.toggle(
                  "is-open"
                );
              }
            );


          const execute =
            async (
              button,
              edited
            ) => {
              if (
                !confirmSecondClick(
                  button,
                  card
                )
              ) {
                return;
              }

              const buttons =
                card.querySelectorAll(
                  "button"
                );

              buttons.forEach(
                item =>
                  item.disabled = true
              );

              try {
                if (mode === "label") {
                  const selectedLabelId =
                    edited
                      ? String(
                          valueInput?.value ||
                          ""
                        )
                      : suggestion.labelId;

                  if (!selectedLabelId) {
                    throw new Error(
                      "Label-ID fehlt."
                    );
                  }

                  const oldLabels =
                    ronnyAiObjectLabels(
                      suggestion.item
                    );

                  const newLabels =
                    Array.from(
                      new Set([
                        ...oldLabels,
                        selectedLabelId
                      ])
                    );

                  if (
                    suggestion.kind ===
                      "device"
                  ) {
                    await setDeviceLabels(
                      suggestion.targetId,
                      newLabels
                    );
                  } else {
                    await setEntityLabels(
                      suggestion.targetId,
                      newLabels
                    );
                  }

                  await addRonnyAiHistory({
                    id:
                      `label:${suggestion.targetId}:${Date.now()}`,
                    type:
                      suggestion.type,
                    action: "applied",
                    target_id:
                      suggestion.targetId,
                    target_name:
                      suggestion.targetName,
                    old_value:
                      oldLabels,
                    new_value:
                      newLabels,
                    meta: {
                      suggestion_key:
                        suggestion.key,
                      confidence:
                        suggestion.confidence,
                      label_id:
                        selectedLabelId
                    },
                    timestamp:
                      new Date().toISOString()
                  });

                } else {
                  const newName =
                    edited
                      ? String(
                          valueInput?.value ||
                          ""
                        ).trim()
                      : suggestion.newName;

                  if (
                    !newName ||
                    newName.length < 2
                  ) {
                    throw new Error(
                      "Ungültiger Name."
                    );
                  }

                  if (
                    suggestion.kind ===
                      "device"
                  ) {
                    await setDeviceName(
                      suggestion.targetId,
                      newName
                    );
                  } else {
                    await setEntityName(
                      suggestion.targetId,
                      newName
                    );
                  }

                  await addRonnyAiHistory({
                    id:
                      `name:${suggestion.targetId}:${Date.now()}`,
                    type:
                      suggestion.type,
                    action: "applied",
                    target_id:
                      suggestion.targetId,
                    target_name:
                      suggestion.targetName,
                    old_value:
                      suggestion.oldName,
                    new_value:
                      newName,
                    meta: {
                      suggestion_key:
                        suggestion.key,
                      confidence:
                        suggestion.confidence
                    },
                    timestamp:
                      new Date().toISOString()
                  });
                }

                card.remove();

              } catch (error) {
                buttons.forEach(
                  item =>
                    item.disabled = false
                );

                resetPrepared(card);

                console.error(
                  "Ronny-AI Smart-Vorschlag konnte nicht angewendet werden:",
                  error
                );
              }
            };


          card
            .querySelector(
              '[data-smart-action="apply"]'
            )
            ?.addEventListener(
              "click",
              event =>
                execute(
                  event.currentTarget,
                  false
                )
            );


          card
            .querySelector(
              '[data-smart-action="apply-edited"]'
            )
            ?.addEventListener(
              "click",
              event =>
                execute(
                  event.currentTarget,
                  true
                )
            );


          card
            .querySelector(
              '[data-smart-action="ignore"]'
            )
            ?.addEventListener(
              "click",
              async () => {
                const buttons =
                  card.querySelectorAll(
                    "button"
                  );

                buttons.forEach(
                  item =>
                    item.disabled = true
                );

                try {
                  await ignoreRonnyAiSuggestion(
                    suggestion.key
                  );

                  await addRonnyAiHistory({
                    id:
                      `ignore:${suggestion.targetId}:${Date.now()}`,
                    type:
                      suggestion.type,
                    action: "ignored",
                    target_id:
                      suggestion.targetId,
                    target_name:
                      suggestion.targetName,
                    old_value:
                      mode === "name"
                        ? suggestion.oldName
                        : null,
                    new_value:
                      mode === "name"
                        ? suggestion.newName
                        : suggestion.labelId,
                    meta: {
                      suggestion_key:
                        suggestion.key,
                      confidence:
                        suggestion.confidence
                    },
                    timestamp:
                      new Date().toISOString()
                  });

                  card.remove();

                } catch (error) {
                  buttons.forEach(
                    item =>
                      item.disabled = false
                  );

                  console.error(
                    "Ronny-AI Smart-Vorschlag konnte nicht ignoriert werden:",
                    error
                  );
                }
              }
            );
        });
    };


  renderRonnyAiSmartSuggestions(
    "ronnyAiLabelSuggestions",
    visibleLabelSuggestions,
    "label"
  );


  renderRonnyAiSmartSuggestions(
    "ronnyAiNameSuggestions",
    visibleNameSuggestions,
    "name"
  );


  const setupRonnyAiSmartSection =
    (
      key,
      count
    ) => {
      const toggle =
        content.querySelector(
          `[data-smart-section-toggle="${key}"]`
        );

      const section =
        content.querySelector(
          `[data-smart-section-content="${key}"]`
        );

      const countNode =
        content.querySelector(
          `[data-smart-section-count="${key}"]`
        );

      if (countNode) {
        countNode.textContent =
          String(count);
      }

      if (
        !toggle ||
        !section
      ) {
        return;
      }

      toggle.addEventListener(
        "click",
        () => {
          const isHidden =
            section.hidden;

          section.hidden =
            !isHidden;

          toggle.setAttribute(
            "aria-expanded",
            isHidden
              ? "true"
              : "false"
          );
        }
      );
    };


  setupRonnyAiSmartSection(



    "areas",



    visibleAreaSuggestions.length



  );



  setupRonnyAiSmartSection(
    "labels",
    visibleLabelSuggestions.length
  );


  setupRonnyAiSmartSection(
    "names",
    visibleNameSuggestions.length
  );


  const suggestions =
    visibleAreaSuggestions.length +
    visibleLabelSuggestions.length +
    visibleNameSuggestions.length;


  const checked =
    entities.length +
    devices.length +
    areas.length +
    labels.length +
    automations.length +
    scripts.length;


  setText(
    content,
    '[data-ai-stat="checked"]',
    checked
  );

  setText(
    content,
    '[data-ai-stat="errors"]',
    errors
  );

  setText(
    content,
    '[data-ai-stat="warnings"]',
    warnings
  );

  setText(
    content,
    '[data-ai-stat="suggestions"]',
    suggestions
  );


  setText(
    content,
    '[data-ai-finding="unavailable"]',
    unavailable
  );


  const unavailableToggle =
    content.querySelector(
      '[data-ai-toggle="unavailable"]'
    );

  const unavailableDetailsRoot =
    content.querySelector(
      '[data-ai-details="unavailable"]'
    );


  if (unavailableDetailsRoot) {
    const deviceItems =
      [...unavailableDeviceDetails.values()]
        .sort((a, b) =>
          String(a?.name || "")
            .localeCompare(
              String(b?.name || "")
            )
        );


    const standaloneItems =
      [...standaloneUnavailableDetails]
        .sort((a, b) =>
          String(a?.entityId || "")
            .localeCompare(
              String(b?.entityId || "")
            )
        );


    unavailableDetailsRoot.innerHTML = [
      ...deviceItems.map((item, index) => {
        const itemEntities =
          Array.isArray(item?.entities)
            ? item.entities
                .slice()
                .sort()
            : [];

        return `
          <div
            class="ronny-ai-finding-detail-item"
          >
            <button
              type="button"
              class="ronny-ai-device-detail-toggle"
              data-unavailable-device-toggle="${index}"
              aria-expanded="false"
            >
              <span
                class="ronny-ai-device-detail-name"
              >
                ${escapeHtml(
                  item?.name ||
                  item?.deviceId ||
                  "–"
                )}
              </span>

              <span
                class="ronny-ai-device-detail-count"
              >
                ${itemEntities.length}
              </span>
            </button>

            <div
              class="ronny-ai-device-entities"
              data-unavailable-device-entities="${index}"
              hidden
            >
              ${itemEntities
                .map(entityId => `
                  <span
                    class="ronny-ai-finding-detail-entity"
                  >
                    ${escapeHtml(entityId)}
                  </span>
                `)
                .join("")}
            </div>
          </div>
        `;
      }),

      ...standaloneItems.map(item => `
        <div
          class="ronny-ai-finding-detail-item"
        >
          <strong>
            ${escapeHtml(
              item?.entityId || "–"
            )}
          </strong>

          <span
            class="ronny-ai-finding-detail-entity"
          >
            ${escapeHtml(
              item?.platform || "unknown"
            )}
          </span>
        </div>
      `)
    ].join("");

    unavailableDetailsRoot
      .querySelectorAll(
        "[data-unavailable-device-toggle]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const index =
              button.dataset
                .unavailableDeviceToggle;

            const entitiesRoot =
              unavailableDetailsRoot.querySelector(
                `[data-unavailable-device-entities="${index}"]`
              );

            if (!entitiesRoot) {
              return;
            }

            const isHidden =
              entitiesRoot.hidden;

            entitiesRoot.hidden =
              !isHidden;

            button.setAttribute(
              "aria-expanded",
              isHidden ? "true" : "false"
            );
          }
        );
      });
  }


  const toggleUnavailableDetails =
    () => {
      if (
        !unavailableToggle ||
        !unavailableDetailsRoot
      ) {
        return;
      }

      const isHidden =
        unavailableDetailsRoot.hidden;

      unavailableDetailsRoot.hidden =
        !isHidden;

      unavailableToggle.setAttribute(
        "aria-expanded",
        isHidden ? "true" : "false"
      );
    };


  unavailableToggle
    ?.addEventListener(
      "click",
      toggleUnavailableDetails
    );


  unavailableToggle
    ?.addEventListener(
      "keydown",
      event => {
        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        event.preventDefault();

        toggleUnavailableDetails();
      }
    );

  setText(
    content,
    '[data-ai-finding="entitiesWithoutArea"]',
    entitiesWithoutArea
  );

  setText(
    content,
    '[data-ai-finding="devicesWithoutArea"]',
    devicesWithoutArea
  );

  setText(
    content,
    '[data-ai-finding="disabled"]',
    disabled
  );


  const setupSimpleFindingDetails =
    (
      key,
      items
    ) => {
      const toggle =
        content.querySelector(
          `[data-ai-toggle="${key}"]`
        );

      const detailsRoot =
        content.querySelector(
          `[data-ai-details="${key}"]`
        );

      if (
        !toggle ||
        !detailsRoot
      ) {
        return;
      }

      detailsRoot.innerHTML =
        items
          .map(item => `
            <div
              class="ronny-ai-finding-detail-item"
            >
              <strong>
                ${escapeHtml(
                  item?.primary || "–"
                )}
              </strong>

              ${
                item?.secondary &&
                item.secondary !==
                  item.primary
                  ? `
                    <span
                      class="ronny-ai-finding-detail-entity"
                    >
                      ${escapeHtml(
                        item.secondary
                      )}
                    </span>
                  `
                  : ""
              }

              ${
                item?.tertiary
                  ? `
                    <span
                      class="ronny-ai-finding-detail-entity"
                    >
                      ${escapeHtml(
                        item.tertiary
                      )}
                    </span>
                  `
                  : ""
              }
            </div>
          `)
          .join("");


      const toggleDetails =
        () => {
          const isHidden =
            detailsRoot.hidden;

          detailsRoot.hidden =
            !isHidden;

          toggle.setAttribute(
            "aria-expanded",
            isHidden
              ? "true"
              : "false"
          );
        };


      toggle.addEventListener(
        "click",
        toggleDetails
      );


      toggle.addEventListener(
        "keydown",
        event => {
          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }

          event.preventDefault();

          toggleDetails();
        }
      );
    };


  setupSimpleFindingDetails(
    "entitiesWithoutArea",
    entitiesWithoutAreaItems
      .map(entity => {
        const entityId =
          entity?.entity_id || "";

        const name =
          entity?.name ||
          entity?.original_name ||
          entityId;

        return {
          primary: name,
          secondary: entityId
        };
      })
      .sort((a, b) =>
        String(a.primary)
          .localeCompare(
            String(b.primary)
          )
      )
  );


  setupSimpleFindingDetails(
    "devicesWithoutArea",
    devicesWithoutAreaItems
      .map(device => {
        const name =
          device?.name_by_user ||
          device?.name ||
          device?.model ||
          device?.id ||
          "–";

        const modelInfo =
          [
            device?.manufacturer,
            device?.model
          ]
            .filter(Boolean)
            .join(" · ");

        return {
          primary: name,
          secondary:
            device?.id || "",
          tertiary:
            modelInfo || ""
        };
      })
      .sort((a, b) =>
        String(a.primary)
          .localeCompare(
            String(b.primary)
          )
      )
  );


  setupSimpleFindingDetails(
    "disabled",
    disabledDeviceItems
      .map(device => {
        const name =
          device?.name_by_user ||
          device?.name ||
          device?.model ||
          device?.id ||
          "–";

        const modelInfo =
          [
            device?.manufacturer,
            device?.model
          ]
            .filter(Boolean)
            .join(" · ");

        return {
          primary: name,
          secondary:
            device?.id || "",
          tertiary:
            modelInfo || ""
        };
      })
      .sort((a, b) =>
        String(a.primary)
          .localeCompare(
            String(b.primary)
          )
      )
  );


  const status =
    content.querySelector("#ronnyAiStatus");

  if (status) {
    if (
      entitiesResult.status === "rejected" ||
      devicesResult.status === "rejected"
    ) {
      status.textContent =
        t("ronnyAi.partialCheck");
    } else if (
      errors === 0 &&
      warnings === 0
    ) {
      status.textContent =
        t("ronnyAi.noIssues");
    } else {
      status.textContent =
        t("ronnyAi.issuesDetected").replace(
          "{count}",
          String(errors + warnings)
        );
    }
  }
}
