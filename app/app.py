from pathlib import Path
from shiny import App
from layout.layout import app_ui
from server.server import server

app = App(
    app_ui,
    server,
    static_assets={
        "/js": Path(__file__).parent / "js",
        "/styles": Path(__file__).parent / "styles",
    },
)
