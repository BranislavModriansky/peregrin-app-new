from shiny import ui, reactive, render
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

from .memory.memory_viz import LiveCPU


path_to_css = Path(__file__).parents[1] / "styles"

def server(input, output, session):

    live_cpu = LiveCPU()

    @render.ui
    def memory_usage_graph():
        reactive.invalidate_later(1)  # re-run every second
        svg = live_cpu.live_usage(style='gauge', ram_c="#323232", cpu_c="#4164af")  # or style='chart', window=40 
        return ui.HTML(svg)

    @render.ui
    def memory_usage_chart():
        reactive.invalidate_later(1)  # re-run every second
        svg = live_cpu.live_usage(style='chart', window=40, ram_c="#b8ceff", cpu_c="darkgrey", facecolor="#303236")  # #3D3F44
        return ui.HTML(svg)

