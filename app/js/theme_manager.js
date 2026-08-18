(function () {
  "use strict";

  const THEME_DIR = "themes/";
  const STORAGE_KEY = "peregrin-theme";
  const DEFAULT_THEME = "light_low_contrast";

  // Applies a set of variables onto :root as CSS custom properties.
  function applyVariables(vars) {
    const root = document.documentElement;
    for (const key in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, key)) {
        root.style.setProperty("--" + key, vars[key]);
      }
    }
  }

  // Fetches and applies a theme by name (inline bundle first, then fetch).
  async function loadTheme(name) {
    try {
      let theme;
      const bundle = window.__PEREGRIN_THEMES__;
      if (bundle && bundle[name]) {
        theme = bundle[name];
      } else {
        const res = await fetch(THEME_DIR + name + ".json", { cache: "no-cache" });
        if (!res.ok) throw new Error("Theme not found: " + name);
        theme = await res.json();
      }
      applyVariables(theme.variables || {});
      document.documentElement.setAttribute("data-theme", theme.name || name);
      try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
      document.dispatchEvent(
        new CustomEvent("theme:changed", { detail: { name: theme.name || name } })
      );
      return theme;
    } catch (err) {
      console.error("[theme-manager]", err);
      if (name !== DEFAULT_THEME) return loadTheme(DEFAULT_THEME);
    }
  }

  // Public API.
  const ThemeManager = {
    load: loadTheme,
    current: () => document.documentElement.getAttribute("data-theme"),
    init() {
      let saved = DEFAULT_THEME;
      try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME; } catch (e) {}
      return loadTheme(saved);
    },
  };

  window.ThemeManager = ThemeManager;

  // Auto-init as early as possible.
  if (document.readyState !== "loading") ThemeManager.init();
  else document.addEventListener("DOMContentLoaded", () => ThemeManager.init());

  // Optional: let Shiny trigger theme changes.
  document.addEventListener("shiny:connected", () => {
    if (window.Shiny && Shiny.addCustomMessageHandler) {
      Shiny.addCustomMessageHandler("set-theme", (msg) => {
        if (msg && msg.name) loadTheme(msg.name);
      });
    }
  });
})();