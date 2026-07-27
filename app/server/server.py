from shiny import ui, reactive, render
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np


def server(input, output, session):


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
        return ui.div(
            ui.h3("Filters Page"),
            ui.p("This is the filters page content."),
            ui.output_plot("histogram_plot"),
        )

    @output(id="histogram_plot")
    @render.plot
    def histogram_plot():
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
        return ui.div(
            ui.p("This is the dashboard content."),
            ui.output_data_frame("data_table"),
        )

    @output(id="data_table")
    @render.data_frame
    def data_table():
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
        return ui.div(
            ui.p("This is the explorer content."),
            ui.input_slider(
                "value_filter",
                "Filter Column 1 range",
                min=round(col_min, 2),
                max=round(col_max, 2),
                value=[round(col_min, 2), round(col_max, 2)],
            ),
        )

