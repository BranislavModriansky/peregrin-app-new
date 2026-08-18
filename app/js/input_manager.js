(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initAll() {
    document.querySelectorAll(".input-manager:not([data-im-init])").forEach(setup);
  }

  ready(initAll);
  document.addEventListener("shiny:connected", initAll);
  document.addEventListener("shiny:value", () => setTimeout(initAll, 0));

  let uid = 0;
  const nextId = (p) => `${p}-${++uid}`;

  // Hierarchy: each level can only parent the next one down.
  const LEVELS = ["input", "set", "subset", "group", "subgroup"];
  const childLevelOf = (type) => LEVELS[LEVELS.indexOf(type) + 1] || null;
  const canParent = (parentType, childType) =>
    childLevelOf(parentType) === childType;

  /* ===================================================================== */

  function setup(container) {
    container.setAttribute("data-im-init", "1");

    const state = {
      nodes: [],          // { id, type, x, y, el, name, files, parentId }
      canvas: null,
      viewport: null,     // panned/translated layer holding nodes + svg
      svg: null,
      fileInput: null,
      panX: 0,
      panY: 0,
      zoom: 0.75,         // start zoomed out by default
    };

    buildToolbar(container, state);

    const canvas = document.createElement("div");
    canvas.className = "im-canvas";
    container.appendChild(canvas);
    state.canvas = canvas;

    // Viewport layer that we translate for panning.
    const viewport = document.createElement("div");
    viewport.className = "im-viewport";
    canvas.appendChild(viewport);
    state.viewport = viewport;

    // SVG layer for connectors (behind nodes).
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("im-links");
    viewport.appendChild(svg);
    state.svg = svg;

    // Grid "weight" overlay — darkens dots beneath nodes.
    const weight = document.createElement("div");
    weight.className = "im-weight";
    viewport.insertBefore(weight, svg); // below links & nodes
    state.weight = weight;

    // Hidden file input reused for all uploads.
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    container.appendChild(fileInput);
    state.fileInput = fileInput;

    // Root input node.
    const input = addNode(state, "input", 40, 40, null);

    // Default set element, connected to the input, and non-removable.
    const defaultSet = addNode(state, "set", 260, 60, input.id, false);
    defaultSet.locked = true;
    defaultSet.el.classList.add("im-locked");

    wireCanvas(container, state);
    wirePan(state);
    wireHandleDrag(state);
    applyPan(state);
    redrawLinks(state);
  }

  /* ---------- Toolbar (full view button) ---------- */

  function buildToolbar(container, state) {
    const bar = document.createElement("div");
    bar.className = "im-toolbar";

    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.className = "im-btn im-home";
    homeBtn.title = "Return home";
    homeBtn.textContent = "⌂";
    homeBtn.addEventListener("click", () => resetPan(state));
    bar.appendChild(homeBtn);

    const zoomInBtn = document.createElement("button");
    zoomInBtn.type = "button";
    zoomInBtn.className = "im-btn im-zoom-in";
    zoomInBtn.title = "Zoom in";
    zoomInBtn.textContent = "+";
    zoomInBtn.addEventListener("click", () => zoomBy(state, 1.2));
    bar.appendChild(zoomInBtn);

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.type = "button";
    zoomOutBtn.className = "im-btn im-zoom-out";
    zoomOutBtn.title = "Zoom out";
    zoomOutBtn.textContent = "−";
    zoomOutBtn.addEventListener("click", () => zoomBy(state, 1 / 1.2));
    bar.appendChild(zoomOutBtn);

    const fullBtn = document.createElement("button");
    fullBtn.type = "button";
    fullBtn.className = "im-btn im-fullview";
    fullBtn.title = "Open full view";
    fullBtn.textContent = "⤢";
    fullBtn.addEventListener("click", () => toggleFullView(container));
    bar.appendChild(fullBtn);

    container.appendChild(bar);
  }

  function toggleFullView(container) {
    const on = !container.classList.contains("im-fullview-on");

    if (on) {
      // Remember original position so we can restore later.
      container._imPlaceholder = document.createComment("im-placeholder");
      container.parentNode.insertBefore(container._imPlaceholder, container);
      document.body.appendChild(container);
      container.classList.add("im-fullview-on");
    } else {
      container.classList.remove("im-fullview-on");
      if (container._imPlaceholder && container._imPlaceholder.parentNode) {
        container._imPlaceholder.parentNode.insertBefore(
          container, container._imPlaceholder
        );
        container._imPlaceholder.remove();
        container._imPlaceholder = null;
      }
    }

    document.body.classList.toggle("im-modal-open", on);
    const btn = container.querySelector(".im-fullview");
    if (btn) btn.textContent = on ? "⤡" : "⤢";
    // Nudge sizing for the SVG/links.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function resetPan(state) {
    state.panX = 0;
    state.panY = 0;
    state.zoom = 0.75; // match the default zoomed-out view
    applyPan(state);
    redrawLinks(state);
  }

  /* ---------- Node creation ---------- */

  const TYPE_LABEL = {
    input: "Input",
    set: "Set",
    subset: "Subset",
    group: "Group",
    subgroup: "Subgroup",
  };

  function addNode(state, type, x, y, parentId, autoSelect = true) {
    const id = nextId("im-" + type);
    const el = document.createElement("div");
    el.className = "im-node im-" + type;
    el.dataset.id = id;
    el.dataset.type = type;
    el.style.left = x + "px";
    el.style.top = y + "px";

    const isInput = type === "input";
    const shapeClass = isInput ? "im-circle" : "im-square";
    const editable = isInput ? "" : 'contenteditable="true"';

    el.innerHTML = `
      <div class="${shapeClass}" title="Click or drop files to import">
        ${isInput ? "" : '<button type="button" class="im-remove" title="Remove">×</button>'}
        ${isInput ? '<span class="im-plus">+</span>' : ""}
        <div class="im-node-name" ${editable} spellcheck="false">${TYPE_LABEL[type]}</div>
        <div class="im-node-files"></div>
        <div class="im-port im-port-out" title="Add a child element">
          <span class="im-port-plus">+</span>
        </div>
      </div>
    `;

    state.viewport.appendChild(el);
    const node = {
      id, type, x, y, el,
      name: TYPE_LABEL[type], files: [], parentId,
    };
    state.nodes.push(node);

    if (!isInput) {
      const nameEl = el.querySelector(".im-node-name");
      if (autoSelect) setTimeout(() => selectText(nameEl), 0);
      nameEl.addEventListener("blur", () => {
        node.name = nameEl.textContent.trim() || TYPE_LABEL[type];
        nameEl.textContent = node.name;
      });
      nameEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
      });
    }

    return node;
  }

  function selectText(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function findNode(state, id) {
    return state.nodes.find((n) => n.id === id) || null;
  }

  function removeNode(state, node) {
    if (node.type === "input") return; // never remove the root input
    if (node.locked) return;           // default set is protected

    // Collect the node and all its descendants.
    const toRemove = new Set([node.id]);
    let changed = true;
    while (changed) {
      changed = false;
      state.nodes.forEach((n) => {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      });
    }

    state.nodes = state.nodes.filter((n) => {
      if (toRemove.has(n.id)) {
        n.el.remove();
        return false;
      }
      return true;
    });

    redrawLinks(state);
  }

  /* ---------- Canvas wiring ---------- */

  function wireCanvas(container, state) {
    const canvas = state.canvas;
    let activeNode = null;

    // Suppress the native menu across the whole manager (no node creation).
    container.addEventListener("contextmenu", (e) => e.preventDefault());

    // Remove (X) button.
    canvas.addEventListener("click", (e) => {
      const x = e.target.closest(".im-remove");
      if (!x) return;
      e.stopPropagation();
      const nodeEl = x.closest(".im-node");
      const node = findNode(state, nodeEl.dataset.id);
      if (node) removeNode(state, node);
    });

    // Click shape -> open file dialog.
    canvas.addEventListener("click", (e) => {
      if (e.target.closest(".im-remove")) return;
      if (e.target.closest(".im-node-name")) return;
      if (e.target.closest(".im-port")) return;
      const nodeEl = e.target.closest(".im-node");
      if (!nodeEl) return;
      if (canvas.dataset.justDragged === "1") { canvas.dataset.justDragged = ""; return; }
      if (e.target.closest(".im-circle") || e.target.closest(".im-square")) {
        const node = findNode(state, nodeEl.dataset.id);
        if (node.type === "input") return; // input circle can't hold files
        activeNode = node;
        state.fileInput.value = "";
        state.fileInput.click();
      }
    });

    state.fileInput.addEventListener("change", () => {
      if (activeNode) addFiles(state, activeNode, state.fileInput.files);
      activeNode = null;
    });

    // (Right-click node creation removed.)

    wireNodeDrag(state);
    wirePortClick(state);
    wireFileDrop(state);

    window.addEventListener("resize", () => redrawLinks(state));
  }

  /* ---------- File handling ---------- */

  function addFiles(state, node, fileList) {
    const files = [...fileList];
    files.forEach((f) => node.files.push(f));

    const list = node.el.querySelector(".im-node-files");
    files.forEach((f) => {
      const chip = document.createElement("div");
      chip.className = "im-file-chip";
      chip.textContent = f.name;
      list.appendChild(chip);
    });

    if (window.Shiny && Shiny.setInputValue) {
      Shiny.setInputValue(
        "input_manager_files",
        {
          node: node.id, type: node.type, parent: node.parentId,
          files: node.files.map((f) => ({ name: f.name, size: f.size })),
        },
        { priority: "event" }
      );
    }
    redrawLinks(state);
  }

  /* ---------- Node dragging (reposition) — FIXED ---------- */

  function wireNodeDrag(state) {
    const canvas = state.canvas;

    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".im-node-name")) return;
      if (e.target.closest(".im-port")) return; // ports handled separately
      const nodeEl = e.target.closest(".im-node");
      if (!nodeEl) return;

      e.stopPropagation(); // prevent pan from also starting

      const node = findNode(state, nodeEl.dataset.id);
      const startX = e.clientX, startY = e.clientY;
      const origX = node.x, origY = node.y;
      let moved = false;

      const move = (ev) => {
        const dx = (ev.clientX - startX) / state.zoom;
        const dy = (ev.clientY - startY) / state.zoom;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        moved = true;
        nodeEl.classList.add("im-node-dragging");
        node.x = origX + dx;
        node.y = origY + dy;
        node.el.style.left = node.x + "px";
        node.el.style.top = node.y + "px";
        redrawLinks(state);
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        nodeEl.classList.remove("im-node-dragging");
        if (moved) canvas.dataset.justDragged = "1";
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  /* ---------- Port dragging (re-plug into a new parent) ---------- */

  function wirePortDrag(state) {
    const canvas = state.canvas;

    canvas.addEventListener("mousedown", (e) => {
      const port = e.target.closest(".im-port-out");
      if (!port) return;
      e.stopPropagation();
      e.preventDefault();

      const parentEl = port.closest(".im-node");
      const parent = findNode(state, parentEl.dataset.id);
      const childType = childLevelOf(parent.type);
      if (!childType) return; // terminal level, nothing to connect

      // Temp link that follows the cursor (in viewport space).
      const svgNS = "http://www.w3.org/2000/svg";
      const temp = document.createElementNS(svgNS, "path");
      temp.classList.add("im-link", "im-link-temp");
      state.svg.appendChild(temp);

      const move = (ev) => {
        const p = viewportPoint(state, ev.clientX, ev.clientY);
        const from = portPoint(state, parent);
        temp.setAttribute("d", bezier(from.x, from.y, p.x, p.y));
        highlightDrop(state, ev, parent);
      };
      const up = (ev) => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        temp.remove();
        clearDropHighlight(state);

        const targetEl = elementNodeAt(ev.clientX, ev.clientY);

        // Dropped on an existing node -> re-plug if valid.
        if (targetEl) {
          const child = findNode(state, targetEl.dataset.id);
          if (child && child.id !== parent.id &&
              canParent(parent.type, child.type)) {
            child.parentId = parent.id;
            redrawLinks(state);
          }
          return;
        }
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function highlightDrop(state, ev, parent) {
    clearDropHighlight(state);
    const targetEl = elementNodeAt(ev.clientX, ev.clientY);
    if (!targetEl) return;
    const child = findNode(state, targetEl.dataset.id);
    if (child && canParent(parent.type, child.type) && child.id !== parent.id) {
      targetEl.classList.add("im-plug-target");
    }
  }
  function clearDropHighlight(state) {
    state.canvas.querySelectorAll(".im-plug-target")
      .forEach((n) => n.classList.remove("im-plug-target"));
  }

  function elementNodeAt(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const node = el.closest && el.closest(".im-node");
      if (node) return node;
    }
    return null;
  }

  /* ---------- Cable handle dragging (re-plug into a new parent) ---------- */

  function wireHandleDrag(state) {
    const svg = state.svg;

    svg.addEventListener("mousedown", (e) => {
      const handle = e.target.closest(".im-link-handle");
      if (!handle) return;
      e.stopPropagation();
      e.preventDefault();

      const child = findNode(state, handle.dataset.childId);
      if (!child) return;

      const svgNS = "http://www.w3.org/2000/svg";
      const temp = document.createElementNS(svgNS, "path");
      temp.classList.add("im-link", "im-link-temp");
      state.svg.appendChild(temp);

      const move = (ev) => {
        const p = viewportPoint(state, ev.clientX, ev.clientY);
        const to = inPoint(state, child);
        temp.setAttribute("d", bezier(p.x, p.y, to.x, to.y));
        highlightPlug(state, ev, child);
      };
      const up = (ev) => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        temp.remove();
        clearDropHighlight(state);

        const targetEl = elementNodeAt(ev.clientX, ev.clientY);
        if (targetEl) {
          const newParent = findNode(state, targetEl.dataset.id);
          if (newParent && newParent.id !== child.id &&
              canParent(newParent.type, child.type)) {
            child.parentId = newParent.id;
          }
        }
        redrawLinks(state);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function highlightPlug(state, ev, child) {
    clearDropHighlight(state);
    const targetEl = elementNodeAt(ev.clientX, ev.clientY);
    if (!targetEl) return;
    const parent = findNode(state, targetEl.dataset.id);
    if (parent && canParent(parent.type, child.type) && parent.id !== child.id) {
      targetEl.classList.add("im-plug-target");
    }
  }

  /* ---------- Curved connectors ---------- */

  function canvasPoint(canvas, clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // Point in the viewport's (untranslated) coordinate space.
  function viewportPoint(state, clientX, clientY) {
    const r = state.viewport.getBoundingClientRect();
    return {
      x: (clientX - r.left) / state.zoom,
      y: (clientY - r.top) / state.zoom,
    };
  }

  function portPoint(state, node) {
    const vr = state.viewport.getBoundingClientRect();
    const portEl = node.el.querySelector(".im-port-out");
    const rect = portEl.getBoundingClientRect();
    return {
      x: (rect.left - vr.left + rect.width / 2) / state.zoom,
      y: (rect.top - vr.top + rect.height / 2) / state.zoom,
    };
  }

  function inPoint(state, node) {
    const vr = state.viewport.getBoundingClientRect();
    const shape = node.el.querySelector(".im-circle, .im-square");
    const rect = shape.getBoundingClientRect();
    return {
      x: (rect.left - vr.left) / state.zoom,
      y: (rect.top - vr.top + rect.height / 2) / state.zoom,
    };
  }

  // Cubic bezier with horizontal ease-in / ease-out control points.
  function bezier(x1, y1, x2, y2) {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    const c1x = x1 + dx, c1y = y1;
    const c2x = x2 - dx, c2y = y2;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  function redrawLinks(state) {
    const svg = state.svg;
    const vr = state.viewport.getBoundingClientRect();

    // If the viewport isn't measurable yet (e.g. just inserted / hidden),
    // the endpoint rects would be invalid and links could vanish. Retry.
    if (vr.width === 0 || vr.height === 0) {
      requestAnimationFrame(() => redrawLinks(state));
      return;
    }

    // Viewport is scaled; use its UNSCALED size so the SVG's coordinate
    // system matches the unscaled node/link coordinates.
    const w = vr.width / state.zoom;
    const h = vr.height / state.zoom;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    svg.querySelectorAll(".im-link:not(.im-link-temp), .im-link-handle")
      .forEach((p) => p.remove());

    const svgNS = "http://www.w3.org/2000/svg";
    state.nodes.forEach((node) => {
      if (!node.parentId) return;
      const parent = findNode(state, node.parentId);
      if (!parent) return;
      const from = portPoint(state, parent);
      const to = inPoint(state, node);

      const path = document.createElementNS(svgNS, "path");
      path.classList.add("im-link");
      path.setAttribute("d", bezier(from.x, from.y, to.x, to.y));
      svg.appendChild(path);

      // Re-plug handle: placed ON the bezier curve, near the parent.
      const h = handlePoint(from, to);
      const handle = document.createElementNS(svgNS, "circle");
      handle.classList.add("im-link-handle");
      handle.setAttribute("cx", h.x);
      handle.setAttribute("cy", h.y);
      handle.setAttribute("r", 6);
      handle.dataset.childId = node.id;
      svg.appendChild(handle);
    });

    redrawWeight(state);
  }
  // Paint a soft radial darkening at each node's centre so the dot grid
  // appears to sag under the element's "weight".
  function redrawWeight(state) {
    const layer = state.weight;
    if (!layer) return;

    const styles = getComputedStyle(state.canvas);
    const gridSize =
      parseFloat(styles.getPropertyValue("--im-grid-size")) || 18;
    const darkDot =
      styles.getPropertyValue("--im-grid-weight").trim() || "rgba(0,0,0,0.35)";

    // Same dot geometry as the base grid (1px), darker color only.
    layer.style.backgroundImage =
      `radial-gradient(${darkDot} 1px, transparent 1px)`;
    layer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    layer.style.backgroundPosition = "0 0";

    const masks = [];
    for (const node of state.nodes) {
      const shape = node.el.querySelector(".im-circle, .im-square");
      if (!shape) continue;

      const cx = node.x + shape.offsetLeft + shape.offsetWidth / 2;
      const cy = node.y + shape.offsetTop + shape.offsetHeight / 2;
      const base = Math.max(shape.offsetWidth, shape.offsetHeight) / 2;
      const radius = base + 90; // halo reach
      const core = Math.round((base / radius) * 100);

      masks.push(
        `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, ` +
          `#000 0%, #000 ${core}%, transparent 100%)`
      );
    }

    const mask = masks.join(", ");
    layer.style.webkitMaskImage = mask || "none";
    layer.style.maskImage = mask || "none";
    // When multiple mask layers overlap, take the darkest (union) coverage.
    layer.style.webkitMaskComposite = "source-over";
    layer.style.maskComposite = "add";
  }

  // Cubic bezier control points (must match bezier()).
  function bezierPoints(x1, y1, x2, y2) {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return {
      p0: { x: x1, y: y1 },
      p1: { x: x1 + dx, y: y1 },
      p2: { x: x2 - dx, y: y2 },
      p3: { x: x2, y: y2 },
    };
  }

  // Evaluate the cubic bezier at parameter t (0..1).
  function bezierAt(cp, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * cp.p0.x + b * cp.p1.x + c * cp.p2.x + d * cp.p3.x,
      y: a * cp.p0.y + b * cp.p1.y + c * cp.p2.y + d * cp.p3.y,
    };
  }

  // A point ON the cable a fixed arc-distance from the parent.
  function handlePoint(from, to) {
    const cp = bezierPoints(from.x, from.y, to.x, to.y);
    const targetDist = 46; // distance along the curve from the parent

    // Walk the curve accumulating length until we reach targetDist.
    const steps = 40;
    let prev = bezierAt(cp, 0);
    let acc = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const pt = bezierAt(cp, t);
      const seg = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      if (acc + seg >= targetDist) {
        const f = (targetDist - acc) / seg;
        return {
          x: prev.x + (pt.x - prev.x) * f,
          y: prev.y + (pt.y - prev.y) * f,
        };
      }
      acc += seg;
      prev = pt;
    }
    // Fallback: near the end (short cables).
    return bezierAt(cp, 0.5);
  }

  /* ---------- Native file drag & drop onto nodes ---------- */

  function wireFileDrop(state) {
    const canvas = state.canvas;
    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      const nodeEl = e.target.closest(".im-node");
      canvas.querySelectorAll(".im-drop-hover")
        .forEach((n) => n.classList.remove("im-drop-hover"));
      if (nodeEl) nodeEl.classList.add("im-drop-hover");
    });
    canvas.addEventListener("dragleave", (e) => {
      const nodeEl = e.target.closest(".im-node");
      if (nodeEl) nodeEl.classList.remove("im-drop-hover");
    });
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      canvas.querySelectorAll(".im-drop-hover")
        .forEach((n) => n.classList.remove("im-drop-hover"));
      const nodeEl = e.target.closest(".im-node");
      if (!nodeEl) return;
      const node = findNode(state, nodeEl.dataset.id);
      if (node && node.type !== "input" && e.dataTransfer.files.length) {
        addFiles(state, node, e.dataTransfer.files);
      }
    });
  }

  /* ---------- Panning ---------- */

  function applyPan(state) {
    state.viewport.style.transform =
      `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    // Move + scale the grid pattern with the pan/zoom.
    const size = 18 * state.zoom;
    state.canvas.style.backgroundSize = `${size}px ${size}px`;
    state.canvas.style.backgroundPosition =
      `${state.panX}px ${state.panY}px`;
  }

  const clampZoom = (z) => Math.min(2.5, Math.max(0.3, z));

  function zoomBy(state, factor) {
    // Zoom toward the canvas center.
    const r = state.canvas.getBoundingClientRect();
    zoomAt(state, factor, r.width / 2, r.height / 2);
  }

  // Zoom keeping the point (cx, cy) in canvas-space anchored under the cursor.
  function zoomAt(state, factor, cx, cy) {
    const newZoom = clampZoom(state.zoom * factor);
    const ratio = newZoom / state.zoom;
    if (ratio === 1) return;
    state.panX = cx - (cx - state.panX) * ratio;
    state.panY = cy - (cy - state.panY) * ratio;
    state.zoom = newZoom;
    applyPan(state);
    redrawLinks(state);
  }

  function wirePan(state) {
    const canvas = state.canvas;

    // Touchpad / wheel: Ctrl = zoom, otherwise pan.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const p = canvasPoint(canvas, e.clientX, e.clientY);
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        zoomAt(state, factor, p.x, p.y);
        return;
      }
      state.panX -= e.deltaX;
      state.panY -= e.deltaY;
      applyPan(state);
      redrawLinks(state);
    }, { passive: false });

    // Drag empty space to pan.
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".im-node")) return;
      if (e.target.closest(".im-port")) return;
      if (e.target.closest(".im-link-handle")) return;
      if (e.target.closest(".im-remove")) return;

      const startX = e.clientX, startY = e.clientY;
      const origX = state.panX, origY = state.panY;
      canvas.classList.add("im-panning");

      const move = (ev) => {
        state.panX = origX + (ev.clientX - startX);
        state.panY = origY + (ev.clientY - startY);
        applyPan(state);
        redrawLinks(state);
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        canvas.classList.remove("im-panning");
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  /* ---------- Port click (create a child) ---------- */

  function wirePortClick(state) {
    const canvas = state.canvas;

    // Stop node-drag / pan from starting on the port.
    canvas.addEventListener("mousedown", (e) => {
      if (e.target.closest(".im-port-out")) e.stopPropagation();
    });

    canvas.addEventListener("click", (e) => {
      const port = e.target.closest(".im-port-out");
      if (!port) return;
      e.stopPropagation();

      const parentEl = port.closest(".im-node");
      const parent = findNode(state, parentEl.dataset.id);
      const childType = childLevelOf(parent.type);
      if (!childType) return; // terminal level

      addNode(state, childType, parent.x + 180, parent.y + 60, parent.id);
      redrawLinks(state);
      // The new node may not be laid out yet on this frame; redraw once
      // layout has settled so the connector is always rendered.
      requestAnimationFrame(() => redrawLinks(state));
    });
  }

  // Paint a soft radial darkening at each node's centre so the dot grid
  // appears to sag under the element's "weight".
  function redrawWeight(state) {
    const layer = state.weight;
    if (!layer) return;

    const styles = getComputedStyle(state.canvas);
    const gridSize =
      parseFloat(styles.getPropertyValue("--im-grid-size")) || 18;
    const darkDot =
      styles.getPropertyValue("--im-grid-weight").trim() || "rgba(0,0,0,0.35)";

    // Same dot geometry as the base grid (1px), darker color only.
    layer.style.backgroundImage =
      `radial-gradient(${darkDot} 1px, transparent 1px)`;
    layer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    layer.style.backgroundPosition = "0 0";

    const masks = [];
    for (const node of state.nodes) {
      const shape = node.el.querySelector(".im-circle, .im-square");
      if (!shape) continue;

      const cx = node.x + shape.offsetLeft + shape.offsetWidth / 2;
      const cy = node.y + shape.offsetTop + shape.offsetHeight / 2;
      const base = Math.max(shape.offsetWidth, shape.offsetHeight) / 2;
      const radius = base + 90; // halo reach
      const core = Math.round((base / radius) * 100);

      masks.push(
        `radial-gradient(circle ${radius}px at ${cx}px ${cy}px, ` +
          `#000 0%, #000 ${core}%, transparent 100%)`
      );
    }

    const mask = masks.join(", ");
    layer.style.webkitMaskImage = mask || "none";
    layer.style.maskImage = mask || "none";
    // When multiple mask layers overlap, take the darkest (union) coverage.
    layer.style.webkitMaskComposite = "source-over";
    layer.style.maskComposite = "add";
  }
})();