from pathlib import Path
from shiny import App
from layout.sidebar import app_ui
from server.server import server

app = App(app_ui, server)