from shiny import ui




def memory_usage_panel():
    """A panel that displays memory usage information."""
    return ui.div(
        ui.div(
            ui.h3("Memory Usage"),
            ui.output_text("memory_usage_text"),
            class_="panel-content"
        ),
        class_="static-panel memory-usage-panel",
    )