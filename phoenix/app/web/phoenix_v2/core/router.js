const routes = new Map();

let currentRoute = null;

export function registerRoute(name, renderer) {
  routes.set(name, renderer);
}

export function getCurrentRoute() {
  return currentRoute;
}

export async function navigate(name, options = {}) {
  const {
    updateHistory = true
  } = options;

  const route = routes.has(name)
    ? name
    : "overview";

  currentRoute = route;

  if (updateHistory) {
    const url = new URL(window.location.href);

    if (route === "overview") {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", route);
    }

    history.pushState(
      { route },
      "",
      url
    );
  }

  document
    .querySelectorAll(".nav-button")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.route === route
      );
    });

  const renderer = routes.get(route);

  if (typeof renderer === "function") {
    await renderer();
  }

  window.dispatchEvent(
    new CustomEvent(
      "phoenix-v2:route-changed",
      {
        detail: {
          route
        }
      }
    )
  );
}

export function initializeRouter() {
  window.addEventListener(
    "popstate",
    () => {
      const route =
        new URLSearchParams(location.search)
          .get("page") ||
        "overview";

      navigate(
        route,
        {
          updateHistory: false
        }
      );
    }
  );

  const initialRoute =
    new URLSearchParams(location.search)
      .get("page") ||
    "overview";

  return navigate(
    initialRoute,
    {
      updateHistory: false
    }
  );
}
