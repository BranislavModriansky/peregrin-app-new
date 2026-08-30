(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initAll() {
    document
      .querySelectorAll(".ai-studio-grid:not([data-ai-init])")
      .forEach(setup);
  }

  ready(initAll);
  document.addEventListener("shiny:connected", initAll);
  document.addEventListener("shiny:value", () => setTimeout(initAll, 0));

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function setup(grid) {
    grid.setAttribute("data-ai-init", "1");

    const state = { colFrac: 0.5, rowFrac: 0.45 };
    apply();

    function apply() {
      grid.style.setProperty("--ai-col", state.colFrac);
      grid.style.setProperty("--ai-col2", 1 - state.colFrac);
      grid.style.setProperty("--ai-row", state.rowFrac);
      grid.style.setProperty("--ai-row2", 1 - state.rowFrac);
    }

    const vDiv = grid.querySelector("#ai-divider-v");
    const hDiv = grid.querySelector("#ai-divider-h");
    const corner = grid.querySelector("#ai-divider-corner");
    const rightCol = grid.querySelector("#ai-col-right");

    // Place the corner handle at the intersection of the two dividers.
    function positionCorner() {
      if (!corner || !vDiv || !hDiv) return;
      const gridRect = grid.getBoundingClientRect();
      const vRect = vDiv.getBoundingClientRect();
      const hRect = hDiv.getBoundingClientRect();
      if (gridRect.width < 1) return;
      corner.style.left = (vRect.left - gridRect.left + vRect.width / 2) + "px";
      corner.style.top = (hRect.top - gridRect.top + hRect.height / 2) + "px";
    }

    function startDrag(move) {
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.removeEventListener("touchmove", move);
        document.removeEventListener("touchend", up);
        document.body.classList.remove("qp-resizing");
      };
      document.body.classList.add("qp-resizing");
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.addEventListener("touchmove", move, { passive: false });
      document.addEventListener("touchend", up);
    }

    function bind(el, handler) {
      if (!el) return;
      el.addEventListener("mousedown", handler);
      el.addEventListener("touchstart", handler, { passive: false });
    }

    bind(vDiv, (e) => {
      e.preventDefault();
      const rect = grid.getBoundingClientRect();
      startDrag((ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        state.colFrac = clamp((p.clientX - rect.left) / rect.width, 0.2, 0.8);
        apply();
        positionCorner();
      });
    });

    bind(hDiv, (e) => {
      e.preventDefault();
      const rect = rightCol.getBoundingClientRect();
      startDrag((ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        state.rowFrac = clamp((p.clientY - rect.top) / rect.height, 0.15, 0.85);
        apply();
        positionCorner();
      });
    });

    // Corner: resize both the column split and the right-column row split.
    bind(corner, (e) => {
      e.preventDefault();
      const gridRect = grid.getBoundingClientRect();
      const colRect = rightCol.getBoundingClientRect();
      startDrag((ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        state.colFrac = clamp((p.clientX - gridRect.left) / gridRect.width, 0.2, 0.8);
        state.rowFrac = clamp((p.clientY - colRect.top) / colRect.height, 0.15, 0.85);
        apply();
        positionCorner();
      });
    });

    // Keep the corner in place on layout changes.
    positionCorner();
    window.addEventListener("resize", positionCorner);
    new ResizeObserver(positionCorner).observe(grid);
    window.addEventListener("load", positionCorner);
    document.addEventListener("shiny:idle", positionCorner);
  }
})();