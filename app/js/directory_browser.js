(function () {
  "use strict";

  function init() {
    var input = document.getElementById("directory_path_input");
    var btn = document.getElementById("directory_browse_btn");
    if (!input || !btn) return;

    function scrollToEnd() {
      input.scrollLeft = input.scrollWidth;
    }

    function setPath(path) {
      if (!path) return;
      input.value = path;
      // Hide overflowing text behind the left edge, keeping the end visible.
      scrollToEnd();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Fallback for plain browsers (no Electron bridge, no File System Access
    // API). Browsers only expose the folder name, never the absolute path.
    // File contents are never read; the selection is discarded immediately.
    var fallbackPicker = null;
    function pickWithFallbackInput() {
      return new Promise(function (resolve) {
        if (!fallbackPicker) {
          fallbackPicker = document.createElement("input");
          fallbackPicker.type = "file";
          fallbackPicker.setAttribute("webkitdirectory", "");
          fallbackPicker.setAttribute("directory", "");
          fallbackPicker.style.display = "none";
          document.body.appendChild(fallbackPicker);
        }
        fallbackPicker.onchange = function () {
          var files = fallbackPicker.files;
          var rel = files && files.length ? files[0].webkitRelativePath : "";
          fallbackPicker.value = "";
          resolve(rel ? rel.split("/")[0] : null);
        };
        fallbackPicker.value = "";
        fallbackPicker.click();
      });
    }

    // Opens a folder-only dialog and resolves to the selected folder's
    // absolute path (or null if cancelled). Absolute paths are only
    // available inside the Electron app, via the preload bridge; in a plain
    // browser only the folder name can be obtained.
    function resolveFolderPath() {
      if (window.peregrin && typeof window.peregrin.pickDirectory === "function") {
        return window.peregrin.pickDirectory(input.value);
      }
      if (typeof window.showDirectoryPicker === "function") {
        return window
          .showDirectoryPicker({ mode: "read" })
          .then(function (dirHandle) { return dirHandle.name; })
          .catch(function (err) {
            if (err && err.name === "AbortError") return null;
            throw err;
          });
      }
      return pickWithFallbackInput();
    }

    btn.addEventListener("click", function () {
      resolveFolderPath()
        .then(setPath)
        .catch(function (err) {
          console.error("Directory selection failed:", err);
        });
    });

    // Scroll through overflowing text with the mouse wheel without
    // focusing/selecting it (no visible scrollbar).
    input.addEventListener(
      "wheel",
      function (e) {
        if (input.scrollWidth <= input.clientWidth) return;
        e.preventDefault();
        input.scrollLeft += e.deltaY || e.deltaX;
      },
      { passive: false }
    );

    // When editing ends, tuck the overflow back behind the left edge.
    input.addEventListener("blur", scrollToEnd);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();