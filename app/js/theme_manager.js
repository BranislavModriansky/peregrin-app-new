(function () {
  "use strict";

  const THEME_JSON_URL = "styles/themes.json";
  const STORAGE_KEY = "peregrin-theme";
  const DEFAULT_THEME = "light";

  let THEMES = null;

  /** Apply a set of CSS variables to :root. */
  function applyVariables(vars) {
    if (!vars) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(`--${name}`, value);
    }
  }

  /** Apply a named theme ("light" | "dark"). */
  function applyTheme(name) {
    if (!THEMES) return;
    const theme = THEMES[name] || THEMES[DEFAULT_THEME];
    if (!theme) return;
    applyVariables(theme);
    document.documentElement.setAttribute("data-theme", name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch (e) {
      /* ignore storage errors */
    }
  }

  /** Resolve the current theme from bslib dark-mode or storage. */
  function resolveCurrentTheme() {
    const attr = document.documentElement.getAttribute("data-bs-theme");
    if (attr === "dark" || attr === "light") return attr;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_THEME;
  }

  /** Watch bslib's dark-mode toggle (updates data-bs-theme on <html>). */
  function watchDarkMode() {
    const observer = new MutationObserver(() => {
      applyTheme(resolveCurrentTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-bs-theme"],
    });
  }

  /** Load themes from JSON, then initialize. */
  function init() {
    fetch(THEME_JSON_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        THEMES = data;
        applyTheme(resolveCurrentTheme());
        watchDarkMode();
      })
      .catch((err) => {
        console.error("[theme_manager] Failed to load themes.json:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose a small API for manual toggling/debugging.
  window.PeregrinTheme = {
    apply: applyTheme,
    toggle() {
      applyTheme(resolveCurrentTheme() === "dark" ? "light" : "dark");
    },
    get themes() {
      return THEMES;
    },
  };
})();