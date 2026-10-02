const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "js", "input_manager.js"),
  "utf8"
);
const rect = { left: 0, top: 0, width: 100, height: 100 };

function element() {
  return {
    style: {},
    dataset: {},
    classList: { add() {} },
    getBoundingClientRect: () => rect,
    setAttribute() {},
    appendChild() {},
    querySelectorAll: () => [],
    remove() { this.removed = true; },
  };
}

const context = vm.createContext({
  document: {
    readyState: "loading",
    addEventListener() {},
    createElementNS: element,
  },
});
// Expose private helpers in the test context without changing the browser API.
vm.runInContext(source.replace(/\}\)\(\);\s*$/, `
  globalThis.manager = {
    removeNode, canAddChild, canImportInto, refreshPortAvailability
  };
})();`), context);
const manager = context.manager;

function node(id, type, parentId = null, files = []) {
  const el = element();
  const port = element();
  const shape = element();
  el.querySelector = (selector) =>
    selector === ".im-port-out" ? port : shape;
  return { id, type, parentId, files, el };
}

function state(nodes, importLevel) {
  const result = {
    nodes, importLevel, zoom: 1, viewport: element(), svg: element(),
  };
  manager.refreshPortAvailability(result);
  return result;
}

function portDisplay(node) {
  return node.el.querySelector(".im-port-out").style.display;
}

test("removing the only file-bearing node unlocks neighbouring branches", () => {
  const root = node("root", "input");
  const neighbour = node("neighbour", "set", root.id);
  const removed = node("removed", "set", root.id, [{ name: "data.csv" }]);
  const current = state([root, neighbour, removed], "set");
  assert.equal(portDisplay(neighbour), "none");

  manager.removeNode(current, removed);

  assert.equal(current.importLevel, null);
  assert.equal(removed.el.removed, true);
  assert.equal(manager.canAddChild(current, neighbour), true);
  assert.equal(portDisplay(neighbour), "");
  assert.equal(manager.canImportInto(current, neighbour), true);
  assert.equal(manager.canImportInto(current, root), false);
});

test("removing a subtree clears the lock and recalculates the import level", () => {
  const root = node("root", "input");
  const neighbour = node("neighbour", "set", root.id);
  const removed = node("removed", "set", root.id);
  const descendant = node("descendant", "subset", removed.id, [{ name: "data.csv" }]);
  const current = state([root, neighbour, removed, descendant], "subset");
  assert.equal(manager.canImportInto(current, neighbour), false);

  manager.removeNode(current, removed);

  assert.equal(current.nodes.length, 2);
  assert.equal(descendant.el.removed, true);
  assert.equal(current.importLevel, null);
  assert.equal(portDisplay(neighbour), "");
  assert.equal(manager.canImportInto(current, neighbour), true);
});

test("remaining files keep branching locked and imports at their level", () => {
  const root = node("root", "input");
  const parent = node("parent", "set", root.id);
  const neighbour = node("neighbour", "subset", parent.id, [{ name: "keep.csv" }]);
  const removed = node("removed", "subset", parent.id, [{ name: "remove.csv" }]);
  const current = state([root, parent, neighbour, removed], "subset");

  manager.removeNode(current, removed);

  assert.equal(current.importLevel, "subset");
  assert.equal(portDisplay(neighbour), "none");
  assert.equal(manager.canAddChild(current, neighbour), false);
  assert.equal(portDisplay(parent), "");
  assert.equal(manager.canImportInto(current, neighbour), true);
  assert.equal(manager.canImportInto(current, parent), false);
});

test("removing an empty node leaves unlocked branching and deepest-level imports", () => {
  const root = node("root", "input");
  const parent = node("parent", "set", root.id);
  const neighbour = node("neighbour", "subset", parent.id);
  const removed = node("removed", "subset", parent.id);
  const current = state([root, parent, neighbour, removed], null);

  manager.removeNode(current, removed);

  assert.equal(current.importLevel, null);
  assert.equal(portDisplay(neighbour), "");
  assert.equal(manager.canImportInto(current, neighbour), true);
  assert.equal(manager.canImportInto(current, parent), false);
});

test("root and locked default nodes remain protected", () => {
  const root = node("root", "input");
  const locked = node("locked", "set", root.id, [{ name: "keep.csv" }]);
  locked.locked = true;
  const current = state([root, locked], "set");

  manager.removeNode(current, root);
  manager.removeNode(current, locked);

  assert.equal(current.nodes.length, 2);
  assert.equal(root.el.removed, undefined);
  assert.equal(locked.el.removed, undefined);
  assert.equal(current.importLevel, "set");
  assert.equal(portDisplay(locked), "none");
});
