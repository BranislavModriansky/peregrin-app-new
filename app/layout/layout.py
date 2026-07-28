from shiny import ui

from .director import panel, quad_layout
from .pages.menu import menu_content


source_panel = panel("qp-source", "Dashboard", ui.output_ui("dashboard_content"))
env_panel = panel("qp-env", "Filters", ui.output_ui("filters_page"))
console_panel = panel("qp-console", "Log", ui.output_ui("log_content"))
output_panel = panel("qp-output", "Explorer", ui.output_ui("explorer_content"))

app_ui = ui.page_sidebar(
    ui.sidebar(
        "Sidebar",
        position="left",
        open='closed',
        width="15rem",
    ),
    ui.navset_bar(
        ui.nav_panel("Menu", menu_content),
        ui.nav_panel(
            "Workspace",
            quad_layout(source_panel, env_panel, console_panel, output_panel),
        ),
        # Full-page views of each panel
        ui.nav_panel("Clustering", ui.output_ui("clustering_content")),
        ui.nav_spacer(),
        ui.nav_control(ui.input_dark_mode(id="lightmode")),
        title=ui.tags.span(
            ui.a(
                "Peregrin",
                href="https://branislavmodriansky.github.io/peregrin/index.html",
                target="_blank",
                rel="noopener noreferrer",
                class_="app-title"
            )
        ),
        id="main_nav",
        selected="Menu",
    )
)