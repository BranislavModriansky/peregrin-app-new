(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initAll() {
    document.querySelectorAll(".qp-grid:not([data-qp-init])").forEach(setup);
  }

  ready(initAll);
  document.addEventListener("shiny:connected", initAll);
  document.addEventListener("shiny:value", () => setTimeout(initAll, 0));

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function setup(grid) {
    grid.setAttribute("data-qp-init", "1");
    const root = grid.closest(".qp-root");

    const state = {
      colFrac: 0.35, // left column width share
      rowLeft: 0.5, // left column top-row share
      rowRight: 0.65, // right column top-row share
      maximized: null, // slot id string when in single-panel mode
      collapsed: null, // saved collapse state while maximized
    };

    applyFractions(grid, state);
    buildNavbar(root, grid, state);
    wireButtons(root, grid, state);
    wireResizers(grid, state);
    wireDragDrop(grid, state);

    // Collapse the Console panel (bottom-left) by default.
    const consoleSlot = grid.querySelector('#qp-col-left .qp-slot:last-child');
    if (consoleSlot) toggleCollapse(consoleSlot);

    window.addEventListener("resize", () => applyFractions(grid, state));
  }

  /* ---------- Sizing ---------- */

  function applyFractions(grid, state) {
    grid.style.setProperty("--qp-col", state.colFrac);
    grid.style.setProperty("--qp-col2", 1 - state.colFrac);
    grid.style.setProperty("--qp-row-l", state.rowLeft);
    grid.style.setProperty("--qp-row-l2", 1 - state.rowLeft);
    grid.style.setProperty("--qp-row-r", state.rowRight);
    grid.style.setProperty("--qp-row-r2", 1 - state.rowRight);
  }

  function wireResizers(grid, state) {
    const vDiv = grid.querySelector("#qp-divider-v");
    const leftCol = grid.querySelector("#qp-col-left");
    const rightCol = grid.querySelector("#qp-col-right");
    const hLeft = leftCol.querySelector(".qp-divider-h");
    const hRight = rightCol.querySelector(".qp-divider-h");

    const dragV = (e) => {
      if (state.maximized) return;
      e.preventDefault();
      const rect = grid.getBoundingClientRect();
      const move = (ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        state.colFrac = clamp((p.clientX - rect.left) / rect.width, 0.15, 0.85);
        applyFractions(grid, state);
      };
      startDrag(move);
    };

    const dragH = (e, col) => {
      if (state.maximized) return;
      e.preventDefault();
      const colEl = col === "left" ? leftCol : rightCol;
      const rect = colEl.getBoundingClientRect();
      const key = col === "left" ? "rowLeft" : "rowRight";
      const move = (ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        state[key] = clamp((p.clientY - rect.top) / rect.height, 0.1, 0.9);
        applyFractions(grid, state);
      };
      startDrag(move);
    };

    bind(vDiv, dragV);
    bind(hLeft, (e) => dragH(e, "left"));
    bind(hRight, (e) => dragH(e, "right"));
  }

  function bind(el, handler) {
    el.addEventListener("mousedown", handler);
    el.addEventListener("touchstart", handler, { passive: false });
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

  /* ---------- Collapse (snap to top/bottom) ---------- */

  function wireButtons(root, grid, state) {
    grid.addEventListener("click", (e) => {
      const collapseBtn = e.target.closest(".qp-collapse");
      const maxBtn = e.target.closest(".qp-maximize");
      if (collapseBtn) {
        const slot = collapseBtn.closest(".qp-slot");
        if (slot) toggleCollapse(slot);
      } else if (maxBtn) {
        const panel = maxBtn.closest(".qp-panel");
        if (panel) enterMaximized(root, grid, state, panel.id);
      }
    });
  }

  function toggleCollapse(slot) {
    applyCollapse(slot, !slot.classList.contains("qp-collapsed"));
  }

  function applyCollapse(slot, collapse) {
    const col = slot.closest(".qp-col");
    const slots = [...col.querySelectorAll(".qp-slot")];
    const isTop = slots.indexOf(slot) === 0;

    slot.classList.toggle("qp-collapsed", collapse);
    slot.classList.toggle("qp-collapsed-top", collapse && isTop);
    slot.classList.toggle("qp-collapsed-bottom", collapse && !isTop);

    col.classList.toggle(
      "qp-col-collapsed",
      col.querySelector(".qp-collapsed") !== null
    );

    // Nudge Shiny/browser to (re)bind & size any outputs revealed on expand.
    if (!collapse) nudgeShiny(slot);
  }

  /* ---------- Maximize -> single-panel navbar view ---------- */

  function buildNavbar(root, grid, state) {
    const links = root.querySelector("#qp-nav-links");
    const back = root.querySelector(".qp-nav-back");

    // Desired navbar order (by panel id).
    const navOrder = ["qp-source", "qp-env", "qp-output", "qp-console"];

    // Collect panels, then sort by the desired order.
    const panels = [...grid.querySelectorAll(".qp-slot .qp-panel")];
    panels.sort((a, b) => {
      const ia = navOrder.indexOf(a.id);
      const ib = navOrder.indexOf(b.id);
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
    });

    panels.forEach((panel) => {
      const title =
        panel.querySelector(".qp-title")?.getAttribute("data-qp-title") ||
        panel.querySelector(".qp-title")?.textContent ||
        panel.id;
      const link = document.createElement("button");
      link.type = "button";
      link.className = "qp-nav-link";
      link.textContent = title;
      link.dataset.panel = panel.id;
      link.addEventListener("click", () =>
        enterMaximized(root, grid, state, panel.id)
      );
      links.appendChild(link);
    });

    back.addEventListener("click", () => exitMaximized(root, grid, state));
  }

  function enterMaximized(root, grid, state, panelId) {
    // Find the slot that currently holds this panel.
    const panel = grid.querySelector("#" + CSS.escape(panelId));
    const slot = panel ? panel.closest(".qp-slot") : null;
    if (!slot) return;

    // Preserve the current collapse state so we can restore it on exit.
    // Keyed by panel id (panels can be swapped between slots via drag & drop).
    if (!state.maximized) {
      state.collapsed = new Map();
      grid.querySelectorAll(".qp-slot").forEach((s) => {
        const p = s.querySelector(".qp-panel");
        if (p) state.collapsed.set(p.id, s.classList.contains("qp-collapsed"));
      });
    }

    state.maximized = panelId;
    root.classList.add("qp-single-mode");
    root.classList.remove("qp-grid-mode");

    grid.querySelectorAll(".qp-slot").forEach((s) => {
      s.classList.toggle("qp-active-slot", s === slot);
      // Clear collapse while maximized so full content shows.
      s.classList.remove("qp-collapsed", "qp-collapsed-top", "qp-collapsed-bottom");
    });
    grid.querySelectorAll(".qp-col").forEach((c) =>
      c.classList.remove("qp-col-collapsed")
    );

    root.querySelectorAll(".qp-nav-link").forEach((l) =>
      l.classList.toggle("qp-nav-active", l.dataset.panel === panelId)
    );

    // Nudge Shiny to bind & size any outputs revealed by maximizing.
    nudgeShiny(slot);
  }

  function exitMaximized(root, grid, state) {
    state.maximized = null;
    root.classList.remove("qp-single-mode");
    root.classList.add("qp-grid-mode");
    grid.querySelectorAll(".qp-slot").forEach((s) =>
      s.classList.remove("qp-active-slot")
    );

    // Restore the collapse state captured when entering maximized mode.
    if (state.collapsed) {
      grid.querySelectorAll(".qp-slot").forEach((s) => {
        const p = s.querySelector(".qp-panel");
        if (p && state.collapsed.get(p.id)) applyCollapse(s, true);
        else applyCollapse(s, false);
      });
      grid.querySelectorAll(".qp-col").forEach((c) =>
        c.classList.toggle(
          "qp-col-collapsed",
          c.querySelector(".qp-collapsed") !== null
        )
      );
      state.collapsed = null;
    }

    // Re-bind/size all panels when returning to the grid.
    nudgeShiny(grid);
  }

  function nudgeShiny(scope) {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      if (window.Shiny && Shiny.bindAll) {
        try { Shiny.bindAll(scope); } catch (e) {}
      }
    });
  }

  /* ---------- Drag & drop swapping ---------- */

  function wireDragDrop(grid, state) {
    let dragging = null;
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
      if (target && target !== sourceSlot) target.classList.add("qp-drop-target");
    }

    function onUp(e) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const target = targetSlotAt(e.clientX, e.clientY);
      if (target && target !== sourceSlot) swapSlots(sourceSlot, target);
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
    a.appendChild(pb);
    b.appendChild(pa);
  }
})();