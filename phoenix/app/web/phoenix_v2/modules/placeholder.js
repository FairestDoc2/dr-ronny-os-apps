import {
  t
} from "../core/i18n.js?v=20260928-1050";

export async function renderPlaceholder() {
  const content =
    document.getElementById("pageContent");

  content.innerHTML = `
    <section class="page-header">
      <h2>
        🧩 ${t("placeholder.title")}
      </h2>

      <p>
        ${t("placeholder.text")}
      </p>
    </section>
  `;
}
