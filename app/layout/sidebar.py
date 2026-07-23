from shiny import ui

from .director import panel, quad_layout

source_panel = panel("qp-source", "Source", ui.output_ui("source_content"))
env_panel = panel("qp-env", "Environment", ui.output_ui("env_content"))
console_panel = panel("qp-console", "Console", ui.output_ui("console_content"))
output_panel = panel("qp-output", "Output", ui.output_ui("output_content"))

app_ui = ui.page_sidebar(
    ui.sidebar(
        "Sidebar",
        position="left",
        open='closed',
        width="15rem",
    ),
    ui.navset_bar(
        ui.nav_panel("Menu", ui.output_ui("menu_content")),
        ui.nav_panel(
            "Workspace",
            quad_layout(source_panel, env_panel, console_panel, output_panel),
        ),
        # Full-page views of each panel
        ui.nav_panel("Clustering", ui.output_ui("clustering_content")),
        title="Peregrin",
        id="main_nav",
    )
)