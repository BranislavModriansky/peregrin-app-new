(function () {
  "use strict";

  const SLOTS = ["tl", "tr", "bl", "br"];

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initAll() {
    document.querySelectorAll(".qp-grid:not([data-qp-init])").forEach(setup);
  }

  ready(initAll);
  document.addEventListener("shiny:connected", initAll);
  // Re-scan when dynamic UI is inserted.
  document.addEventListener("shiny:value", () => setTimeout(initAll, 0));

  function setup(grid) {
    grid.setAttribute("data-qp-init", "1");

    const state = {
      colFrac: 0.5, // left column share
      rowFrac: 0.5, // top row share
      maximized: null,
    };

    applyFractions(grid, state);

    wireButtons(grid, state);
    wireResizers(grid, state);
    wireDragDrop(grid, state);

    window.addEventListener("resize", () => applyFractions(grid, state));
  }

  /* ---------- Sizing ---------- */

  function applyFractions(grid, state) {
    grid.style.setProperty("--qp-col", state.colFrac);
    grid.style.setProperty("--qp-col2", 1 - state.colFrac);
    grid.style.setProperty("--qp-row", state.rowFrac);
    grid.style.setProperty("--qp-row2", 1 - state.rowFrac);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function wireResizers(grid, state) {
    const vDiv = grid.querySelector("#qp-divider-v");
    const hDiv = grid.querySelector("#qp-divider-h");
    const cDiv = grid.querySelector("#qp-divider-center");

    const drag = (e, axis) => {
      if (state.maximized) return;
      e.preventDefault();
      const rect = grid.getBoundingClientRect();

      const move = (ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        if (axis === "x" || axis === "xy") {
          state.colFrac = clamp((p.clientX - rect.left) / rect.width, 0.1, 0.9);
        }
        if (axis === "y" || axis === "xy") {
          state.rowFrac = clamp((p.clientY - rect.top) / rect.height, 0.1, 0.9);
        }
        applyFractions(grid, state);
      };
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
    };

    vDiv.addEventListener("mousedown", (e) => drag(e, "x"));
    vDiv.addEventListener("touchstart", (e) => drag(e, "x"), { passive: false });
    hDiv.addEventListener("mousedown", (e) => drag(e, "y"));
    hDiv.addEventListener("touchstart", (e) => drag(e, "y"), { passive: false });
    cDiv.addEventListener("mousedown", (e) => drag(e, "xy"));
    cDiv.addEventListener("touchstart", (e) => drag(e, "xy"), { passive: false });
  }

  /* ---------- Collapse / Maximize ---------- */

  function wireButtons(grid, state) {
    grid.addEventListener("click", (e) => {
      const collapseBtn = e.target.closest(".qp-collapse");
      const maxBtn = e.target.closest(".qp-maximize");
      if (collapseBtn) {
        const panel = collapseBtn.closest(".qp-panel");
        if (panel) panel.classList.toggle("qp-collapsed");
      } else if (maxBtn) {
        const panel = maxBtn.closest(".qp-panel");
        if (panel) toggleMaximize(grid, state, panel);
      }
    });
  }

  function toggleMaximize(grid, state, panel) {
    const slot = panel.closest(".qp-slot");
    if (!slot) return;

    const isMax = grid.classList.contains("qp-has-max") && state.maximized === slot;
    // Clear any previous max.
    grid.querySelectorAll(".qp-slot").forEach((s) => s.classList.remove("qp-maximized"));

    if (isMax) {
      grid.classList.remove("qp-has-max");
      state.maximized = null;
      panel.classList.remove("qp-panel-max");
    } else {
      grid.classList.add("qp-has-max");
      slot.classList.add("qp-maximized");
      panel.classList.add("qp-panel-max");
      panel.classList.remove("qp-collapsed");
      state.maximized = slot;
    }
  }

  /* ---------- Drag & drop swapping ---------- */

  function wireDragDrop(grid, state) {
    let dragging = null; // the panel being dragged
    let sourceSlot = null;
    let ghost = null;
    let offsetX = 0;
    let offsetY = 0;

    grid.addEventListener("mousedown", (e) => {
      const grip = e.target.closest(".qp-grip");
      if (!grip || state.maximized) return;
      e.preventDefault();

      const panel = grip.closest(".qp-panel");
      sourceSlot = panel.closest(".qp-slot");
      dragging = panel;

      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      ghost = panel.cloneNode(true);
      ghost.classList.add("qp-ghost");
      ghost.style.width = rect.width + "px";
      ghost.style.height = rect.height + "px";
      ghost.style.left = rect.left + "px";
      ghost.style.top = rect.top + "px";
      document.body.appendChild(ghost);

      panel.classList.add("qp-drag-source");
      document.body.classList.add("qp-dragging");

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    function targetSlotAt(x, y) {
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        const slot = el.closest && el.closest(".qp-slot");
        if (slot && grid.contains(slot)) return slot;
      }
      return null;
    }

    function onMove(e) {
      if (!ghost) return;
      ghost.style.left = e.clientX - offsetX + "px";
      ghost.style.top = e.clientY - offsetY + "px";

      grid.querySelectorAll(".qp-slot").forEach((s) =>
        s.classList.remove("qp-drop-target")
      );
      const target = targetSlotAt(e.clientX, e.clientY);
      if (target && target !== sourceSlot) {
        target.classList.add("qp-drop-target");
      }
    }

    function onUp(e) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const target = targetSlotAt(e.clientX, e.clientY);
      if (target && target !== sourceSlot) {
        swapSlots(sourceSlot, target);
      }

      if (ghost) ghost.remove();
      ghost = null;
      if (dragging) dragging.classList.remove("qp-drag-source");
      grid.querySelectorAll(".qp-slot").forEach((s) =>
        s.classList.remove("qp-drop-target")
      );
      document.body.classList.remove("qp-dragging");
      dragging = null;
      sourceSlot = null;
    }
  }

  function swapSlots(a, b) {
    const pa = a.querySelector(".qp-panel");
    const pb = b.querySelector(".qp-panel");
    if (!pa || !pb) return;
    // Swap panel nodes between the two fixed slots.
    a.appendChild(pb);
    b.appendChild(pa);
  }
})();