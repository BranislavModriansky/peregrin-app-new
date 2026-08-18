from shiny import ui
from pathlib import Path

path_to_js = Path(__file__).parents[1] / "js"
path_to_css = Path(__file__).parents[1] / "styles"


def panel(id: str, title: str, *content):
    """A single RStudio-style panel with collapse / maximize buttons."""
    return ui.div(
        ui.div(
            ui.div(
                ui.span("⣿", class_="qp-grip", title="Drag to move"),
                ui.span(title, class_="qp-title", **{"data-qp-title": title}),
                class_="qp-header-left",
            ),
            ui.div(
                ui.tags.button(
                    ui.HTML("&#9472;"),
                    class_="qp-btn qp-collapse",
                    title="Collapse",
                    type="button",
                ),
                ui.tags.button(
                    ui.HTML("&#9974;"),
                    class_="qp-btn qp-maximize",
                    title="Maximize",
                    type="button",
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
            ui.tags.button(
                ui.HTML("&#8862;"),
                None,
                class_="qp-nav-back qp-btn",
                type="button",
                title="Back to 4-panel view",
            ),
            ui.div(class_="qp-nav-links", id="qp-nav-links"),
            class_="qp-navbar",
            id="qp-navbar",
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