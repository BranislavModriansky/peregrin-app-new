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
                ui.span(title, class_="qp-title"),
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
    """Four flexible panels arranged in a 2x2 resizable, swappable grid."""
    return ui.div(
        ui.include_css(path_to_css / "quadpanel.css"),
        ui.include_js(path_to_js / "quadpanel.js"),
        ui.div(
            ui.div(top_left, class_="qp-slot", id="qp-slot-tl", **{"data-slot": "tl"}),
            ui.div(top_right, class_="qp-slot", id="qp-slot-tr", **{"data-slot": "tr"}),
            ui.div(bottom_left, class_="qp-slot", id="qp-slot-bl", **{"data-slot": "bl"}),
            ui.div(bottom_right, class_="qp-slot", id="qp-slot-br", **{"data-slot": "br"}),
            ui.div(class_="qp-divider qp-divider-v", id="qp-divider-v"),
            ui.div(class_="qp-divider qp-divider-h", id="qp-divider-h"),
            ui.div(class_="qp-divider-center", id="qp-divider-center"),
            class_="qp-grid",
            id="qp-container",
        ),
        class_="qp-root",
    )