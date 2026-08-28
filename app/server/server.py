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
        svg = live_cpu.live_usage(style='gauge', cpu_c="#4164af")  # or style='chart', window=40 
        return ui.HTML(svg)


    themes = [
        "low_contrast.css", 
        "high_contrast.css",
    ]
    contrast_levels = ["low_contrast", "high_contrast"]
    contrast_idx = reactive.Value(0)

    def _current_theme_name():
        mode = "dark" if input.lightmode() == "dark" else "light"
        return f"{mode}_{contrast_levels[contrast_idx.get()]}"

    @reactive.effect
    @reactive.event(input.theme_toggle)
    async def _toggle_contrast():
        contrast_idx.set((contrast_idx.get() + 1) % len(contrast_levels))
        await session.send_custom_message("set-theme", {"name": _current_theme_name()})

    @reactive.effect
    @reactive.event(input.lightmode)
    async def _toggle_mode():
        await session.send_custom_message("set-theme", {"name": _current_theme_name()})
    count = reactive.Value(0)

    # @reactive.calc
    # def theme():

    #     @output(id="dynamic_theme")
    #     @render.ui
    #     def dynamic_theme():
    #         if input.lightmode() == 'dark':
    #             theme = "dark_" + themes[count.get()]
    #         else:
    #             theme = "light_" + themes[count.get()]
    #         # css_text = (path_to_css / theme).read_text()
    #         # return ui.tags.style(css_text)
    #         return ui.include_css(path_to_css / theme, method="inline")

    @reactive.effect
    @reactive.event(input.theme_toggle)
    def _():
        # just flip the index, don't call include_css here
        if count.get() == len(themes) - 1:
            count.set(0)
        else:
            count.set(count.get() + 1)
        print(f"Selected theme index: {count.get()}")

        theme()  # Trigger a re-render of the dynamic theme


    def _dummy_data_for_gist():
        """Generate a dummy DataFrame for demonstration purposes."""
        data = {
            "Column 1": np.random.randn(30) * 10 + 50,
            "Column 2": np.random.randn(30) * 5 + 20,
            "Column 3": np.random.randn(30) * 15 + 100,
        }
        return pd.DataFrame(data)


    df = _dummy_data_for_gist()

    @reactive.Calc
    def filtered_df():
        """Filter df by the slider range on Column 1."""
        low, high = input.value_filter()
        return df[(df["Column 1"] >= low) & (df["Column 1"] <= high)]

    @output(id="filters_page")
    @render.ui
    def filters_page():
        return
        return ui.div(
            ui.output_plot("histogram_plot"),
        )

    @output(id="histogram_plot")
    @render.plot
    def histogram_plot():
        return
        data = filtered_df()
        fig, ax = plt.subplots(figsize=(4, 2))
        ax.hist(data["Column 1"], bins=10, color="skyblue", edgecolor="black")
        ax.set_title("Histogram of Column 1")
        ax.set_xlabel("Value")
        ax.set_ylabel("Frequency")
        return fig

    @output(id="dashboard_content")
    @render.ui
    def dashboard_content():
        return
        return ui.div(
            ui.output_data_frame("data_table"),
        )

    @output(id="data_table")
    @render.data_frame
    def data_table():
        return
        return render.DataGrid(filtered_df().round(2), height="400px")

    @output(id="log_content")
    @render.ui
    def log_content():

        rows = ()
        for i in range(1, 31):
            rows += (ui.div(str(i)),)
            

        return ui.div(*rows)

    @output(id="explorer_content")
    @render.ui
    def explorer_content():
        col_min = float(df["Column 1"].min())
        col_max = float(df["Column 1"].max())
        return
        return ui.div(
            ui.input_slider(
                "value_filter",
                "Filter Column 1 range",
                min=round(col_min, 2),
                max=round(col_max, 2),
                value=[round(col_min, 2), round(col_max, 2)],
            ),
        )

