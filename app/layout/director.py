from shiny import ui
from pathlib import Path

path_to_js = Path(__file__).parents[1] / "js"
path_to_css = Path(__file__).parents[1] / "styles"


# Font-independent SVG icon paths (24x24 icon grid); they inherit color via currentColor.
_ICON_PATHS = {
    "collapse": "m356-160-56-56 180-180 180 180-56 56-124-124-124 124Zm124-404L300-744l56-56 124 124 124-124 56 56-180 180Z",
    "expand": "M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z",
    "maximize": "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0 0v-560 560Z",
    "grid": (
        "M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Z"
        "m0 400v-320h320v320H520ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Z"
        "m0 400h160v-160H600v160Zm-400 0h160v-160H200v160Zm400-400Zm0 240Zm-240 0Zm0-240Z"
    ),
}


def _icon(name: str):
    return ui.HTML(
        f'<svg class="qp-icon qp-icon-{name}" viewBox="0 -960 960 960" '
        f'fill="currentColor" aria-hidden="true" focusable="false">'
        f'<path d="{_ICON_PATHS[name]}"/></svg>'
    )


def panel(id: str, title: str, *content):
    """A single RData Lab-style panel with collapse / maximize buttons."""
    return ui.div(
        ui.div(
            ui.div(
                # Circle is drawn in CSS to match the navbar's unselected markers.
                ui.span(class_="qp-grip", title="Drag to move"),
                ui.span(title, class_="qp-title", **{"data-qp-title": title}),
                class_="qp-header-left",
            ),
            ui.div(
                ui.tags.button(
                    _icon("collapse"),
                    _icon("expand"),
                    class_="qp-btn qp-collapse",
                    title="Collapse",
                    type="button",
                    **{"aria-label": "Collapse"},
                ),
                ui.tags.button(
                    _icon("maximize"),
                    class_="qp-btn qp-maximize",
                    title="Maximize",
                    type="button",
                    **{"aria-label": "Maximize"},
                ),
                class_="qp-actions",
            ),
            class_="qp-header",
        ),
        ui.div(*content, class_="qp-body"),
        id=id,
        class_="qp-panel",
        draggable="false",
    )


def quad_layout(top_left, top_right, bottom_left, bottom_right):
    """Four flexible panels arranged in two resizable, swappable columns."""
    return ui.div(
        # Navbar shown only in single-panel (maximized) mode.
        ui.div(
            ui.div(
                ui.tags.button(
                    _icon("grid"),
                    class_="qp-nav-back qp-btn",
                    type="button",
                    title="Back to 4-panel view",
                    **{"aria-label": "Back to 4-panel view"},
                ),
                ui.div(class_="qp-nav-links", id="qp-nav-links"),
                class_="qp-navbar",
                id="qp-navbar",
            ),
            class_="qp-navbar-container"
        ),
        ui.div(
            # Left column: two stacked slots + horizontal divider.
            ui.div(
                ui.div(top_left, class_="qp-slot", id="qp-slot-tl", **{"data-slot": "tl", "data-qp-title": "Dashboard"}),
                ui.div(class_="qp-divider qp-divider-h", **{"data-col": "left"}),
                ui.div(bottom_left, class_="qp-slot", id="qp-slot-bl", **{"data-slot": "bl", "data-qp-title": "Log"}),
                class_="qp-col",
                id="qp-col-left",
                **{"data-col": "left"},
            ),
            # Single shared vertical divider.
            ui.div(class_="qp-divider qp-divider-v", id="qp-divider-v"),
            # Corner handles where the vertical divider meets each column's
            # horizontal divider (left + right).
            ui.div(class_="qp-divider-corner", id="qp-divider-corner-left",
                   **{"data-col": "left"}),
            ui.div(class_="qp-divider-corner", id="qp-divider-corner-right",
                   **{"data-col": "right"}),
            # Right column.
            ui.div(
                ui.div(top_right, class_="qp-slot", id="qp-slot-tr", **{"data-slot": "tr", "data-qp-title": "Filters"}),
                ui.div(class_="qp-divider qp-divider-h", **{"data-col": "right"}),
                ui.div(bottom_right, class_="qp-slot", id="qp-slot-br", **{"data-slot": "br", "data-qp-title": "Explorer"}),
                class_="qp-col",
                id="qp-col-right",
                **{"data-col": "right"},
            ),
            class_="qp-grid",
            id="qp-container",
        ),
        class_="qp-root qp-grid-mode",
    )