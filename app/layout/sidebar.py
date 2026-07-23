from shiny import ui

from .director import panel, quad_layout

source_panel = panel("qp-source", "Source", ui.output_ui("source_content"))
env_panel = panel("qp-env", "Environment", ui.output_ui("env_content"))
console_panel = panel("qp-console", "Console", ui.output_ui("console_content"))
output_panel = panel("qp-output", "Output", ui.output_ui("output_content"))

app_ui = ui.page_navbar(
    ui.nav_panel(
        "Workspace",
        quad_layout(source_panel, env_panel, console_panel, output_panel),
    ),
    # Full-page views of each panel
    ui.nav_panel("Source", ui.output_ui("source_content_full")),
    ui.nav_panel("Environment", ui.output_ui("env_content_full")),
    ui.nav_panel("Console", ui.output_ui("console_content_full")),
    ui.nav_panel("Output", ui.output_ui("output_content_full")),
    title="Peregrin",
    id="main_nav",
)