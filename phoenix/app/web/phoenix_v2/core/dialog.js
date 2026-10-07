import {
  t
} from "./i18n.js?v=20260928-1050";


function ensureDialog() {
  let overlay =
    document.getElementById("phoenixDialogOverlay");

  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "phoenixDialogOverlay";
  overlay.className = "phoenix-dialog-overlay";
  overlay.hidden = true;

  overlay.innerHTML = `
    <div
      class="phoenix-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phoenixDialogTitle"
    >
      <div class="phoenix-dialog-header">
        <div
          id="phoenixDialogIcon"
          class="phoenix-dialog-icon"
          aria-hidden="true"
        ></div>

        <h3 id="phoenixDialogTitle"></h3>
      </div>

      <div
        id="phoenixDialogMessage"
        class="phoenix-dialog-message"
      ></div>

      <input
        id="phoenixDialogInput"
        class="phoenix-dialog-input"
        type="text"
        autocomplete="off"
        hidden
      >

      <div class="phoenix-dialog-actions">
        <button
          type="button"
          id="phoenixDialogCancel"
        ></button>

        <button
          type="button"
          id="phoenixDialogConfirm"
          class="phoenix-dialog-confirm"
        ></button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  return overlay;
}


function openDialog({
  title = "",
  message = "",
  value = null,
  confirmText = null,
  danger = false
} = {}) {
  const overlay = ensureDialog();

  const dialog =
    overlay.querySelector(".phoenix-dialog");

  const titleElement =
    overlay.querySelector("#phoenixDialogTitle");

  const iconElement =
    overlay.querySelector("#phoenixDialogIcon");

  const messageElement =
    overlay.querySelector("#phoenixDialogMessage");

  const input =
    overlay.querySelector("#phoenixDialogInput");

  const cancelButton =
    overlay.querySelector("#phoenixDialogCancel");

  const confirmButton =
    overlay.querySelector("#phoenixDialogConfirm");

  titleElement.textContent = title;
  messageElement.textContent = message;

  iconElement.textContent =
    danger ? "⚠️" : value !== null ? "✏️" : "ℹ️";

  cancelButton.textContent = t("common.cancel");

  confirmButton.textContent =
    confirmText ||
    (
      danger
        ? t("common.delete")
        : value !== null
          ? t("common.save")
          : t("common.confirm")
    );

  confirmButton.classList.toggle(
    "phoenix-dialog-danger",
    danger
  );

  input.hidden = value === null;
  input.value = value === null ? "" : String(value);

  overlay.hidden = false;

  requestAnimationFrame(() => {
    overlay.classList.add("is-open");

    if (value !== null) {
      input.focus();
      input.select();
    } else {
      confirmButton.focus();
    }
  });

  return new Promise((resolve) => {
    let finished = false;

    const finish = (result) => {
      if (finished) {
        return;
      }

      finished = true;

      overlay.classList.remove("is-open");

      window.setTimeout(() => {
        overlay.hidden = true;
      }, 140);

      overlay.removeEventListener(
        "click",
        handleOverlayClick
      );

      document.removeEventListener(
        "keydown",
        handleKeydown
      );

      resolve(result);
    };

    const handleOverlayClick = (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
        return;
      }

      if (
        event.key === "Enter" &&
        (
          document.activeElement === input ||
          document.activeElement === confirmButton
        )
      ) {
        event.preventDefault();

        finish(
          value !== null
            ? input.value
            : true
        );
      }
    };

    cancelButton.onclick = () => finish(null);

    confirmButton.onclick = () => {
      finish(
        value !== null
          ? input.value
          : true
      );
    };

    overlay.addEventListener(
      "click",
      handleOverlayClick
    );

    document.addEventListener(
      "keydown",
      handleKeydown
    );

    dialog.onclick = (event) => {
      event.stopPropagation();
    };
  });
}


export async function phoenixConfirm(
  message,
  {
    title = "",
    confirmText = null,
    danger = false
  } = {}
) {
  const result = await openDialog({
    title,
    message,
    confirmText,
    danger
  });

  return result === true;
}


export async function phoenixPrompt(
  message,
  defaultValue = "",
  {
    title = "",
    confirmText = null
  } = {}
) {
  return openDialog({
    title,
    message,
    value: defaultValue,
    confirmText
  });
}
