from shiny import ui

from .director import panel, quad_layout
from .pages.menu import menu_content

from pathlib import Path

path_to_js = Path(__file__).parents[1] / "js"
path_to_css = Path(__file__).parents[1] / "styles"

source_panel = panel("qp-source", "Dashboard", ui.output_ui("dashboard_content"))
env_panel = panel("qp-env", "Filters", ui.output_ui("filters_page"))
console_panel = panel("qp-console", "Log", ui.output_ui("log_content"))
output_panel = panel("qp-output", "Explorer", ui.output_ui("explorer_content"))

app_ui = ui.page_sidebar(
    ui.sidebar(
        ui.div(),
        position="left",
        open='closed',
        width="16rem",
    ),
    ui.div(
        ui.busy_indicators.use(spinners=True, pulse=False, fade=True),
        ui.input_action_button("anim_toggle", "⦽", class_="anim-toggle"),
        ui.input_action_button("theme_toggle", "◑", class_="theme-toggle"),
        class_="sidebar-buttons",
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
    ),
    ui.head_content(
        ui.include_css(path_to_css / "styles.css"),
        ui.include_js(path_to_js / "theme_manager.js", method="inline"),
        ui.include_js(path_to_js / "input_manager.js", method="inline"),
        ui.include_js(path_to_js / "quadpanel.js", method="inline"),
    ),
    ui.tags.div(
        ui.tags.div(class_="grid-wall"),
        ui.tags.div(class_="grid-left"),
        ui.tags.div(class_="grid-right"),
        class_="grid-bg",
    ),
    ui.div(
        "",
        ui.HTML("""
            <svg width='0' height='0' aria-hidden='true'>
                <filter id='grain'>
                    <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
                    <feColorMatrix type='saturate' values='0'/>
                    <feComponentTransfer>
                        <feFuncA type='linear' slope='0.15'/>
                    </feComponentTransfer>
                    <feComposite operator='over' in2='SourceGraphic'/>
                </filter>
            </svg>
        """),
        class_="invisible-injector"
    )
)