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

    // Hidden file input reused for all uploads.
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    container.appendChild(fileInput);
    state.fileInput = fileInput;

    // Root input node.
    addNode(state, "input", 40, 40, null);

    wireCanvas(container, state);
    wirePan(state);
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
    const on = container.classList.toggle("im-fullview-on");
    document.body.classList.toggle("im-modal-open", on);
    const btn = container.querySelector(".im-fullview");
    if (btn) btn.textContent = on ? "⤡" : "⤢";
    // Nudge sizing for the SVG/links.
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  function resetPan(state) {
    state.panX = 0;
    state.panY = 0;
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

  function addNode(state, type, x, y, parentId) {
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
        ${isInput ? '<span class="im-plus">+</span>' : ""}
        <div class="im-node-name" ${editable} spellcheck="false">${TYPE_LABEL[type]}</div>
        <div class="im-node-files"></div>
        <div class="im-port im-port-out" title="Drag to connect a child"></div>
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
      setTimeout(() => selectText(nameEl), 0);
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

  /* ---------- Canvas wiring ---------- */

  function wireCanvas(container, state) {
    const canvas = state.canvas;
    let activeNode = null;

    // Suppress the native menu across the whole manager.
    container.addEventListener("contextmenu", (e) => e.preventDefault());

    // Click shape -> open file dialog.
    canvas.addEventListener("click", (e) => {
      if (e.target.closest(".im-node-name")) return;
      if (e.target.closest(".im-port")) return;
      const nodeEl = e.target.closest(".im-node");
      if (!nodeEl) return;
      if (canvas.dataset.justDragged === "1") { canvas.dataset.justDragged = ""; return; }
      if (e.target.closest(".im-circle") || e.target.closest(".im-square")) {
        activeNode = findNode(state, nodeEl.dataset.id);
        state.fileInput.value = "";
        state.fileInput.click();
      }
    });

    state.fileInput.addEventListener("change", () => {
      if (activeNode) addFiles(state, activeNode, state.fileInput.files);
      activeNode = null;
    });

    // Right-click a node -> add a child of the next level.
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nodeEl = e.target.closest(".im-node");

      // Right-click on empty canvas -> create a root-level "set".
      if (!nodeEl) {
        const p = viewportPoint(state, e.clientX, e.clientY);
        addNode(state, "set", p.x, p.y, null);
        redrawLinks(state);
        return;
      }

      const parent = findNode(state, nodeEl.dataset.id);
      const childType = childLevelOf(parent.type);
      if (!childType) return; // subgroup is the last container level
      addNode(state, childType, parent.x + 160, parent.y + 40, parent.id);
      redrawLinks(state);
    });

    wireNodeDrag(state);
    wirePortDrag(state);
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

      const node = findNode(state, nodeEl.dataset.id);
      const startX = e.clientX, startY = e.clientY;
      const origX = node.x, origY = node.y;
      let moved = false;

      const move = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
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

        // Dropped on empty space -> create a new child there.
        const p = viewportPoint(state, ev.clientX, ev.clientY);
        addNode(state, childType, p.x - 20, p.y - 20, parent.id);
        redrawLinks(state);
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

  /* ---------- Curved connectors ---------- */

  function canvasPoint(canvas, clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  // Point in the viewport's (untranslated) coordinate space.
  function viewportPoint(state, clientX, clientY) {
    const r = state.viewport.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function portPoint(state, node) {
    const vr = state.viewport.getBoundingClientRect();
    const portEl = node.el.querySelector(".im-port-out");
    const rect = portEl.getBoundingClientRect();
    return {
      x: rect.left - vr.left + rect.width / 2,
      y: rect.top - vr.top + rect.height / 2,
    };
  }

  function inPoint(state, node) {
    const vr = state.viewport.getBoundingClientRect();
    const shape = node.el.querySelector(".im-circle, .im-square");
    const rect = shape.getBoundingClientRect();
    return {
      x: rect.left - vr.left,
      y: rect.top - vr.top + rect.height / 2,
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
    svg.setAttribute("width", vr.width);
    svg.setAttribute("height", vr.height);
    svg.setAttribute("viewBox", `0 0 ${vr.width} ${vr.height}`);

    svg.querySelectorAll(".im-link:not(.im-link-temp)").forEach((p) => p.remove());

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
    });
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
      if (node && e.dataTransfer.files.length) {
        addFiles(state, node, e.dataTransfer.files);
      }
    });
  }

  /* ---------- Panning ---------- */

  function applyPan(state) {
    state.viewport.style.transform =
      `translate(${state.panX}px, ${state.panY}px)`;
    // Move the grid pattern with the pan (grid lives on the canvas).
    state.canvas.style.backgroundPosition =
      `${state.panX}px ${state.panY}px`;
  }

  function resetPan(state) {
    state.panX = 0;
    state.panY = 0;
    applyPan(state);
    redrawLinks(state);
  }

  function wirePan(state) {
    const canvas = state.canvas;

    // Touchpad / wheel scrolling pans the canvas.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      state.panX -= e.deltaX;
      state.panY -= e.deltaY;
      applyPan(state);
      redrawLinks(state);
    }, { passive: false });

    // Drag empty space to pan.
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".im-node")) return; // node/port drags handled elsewhere
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
})();