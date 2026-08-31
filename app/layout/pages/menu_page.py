from shiny import ui

menu_content = ui.div(
    ui.div(
        ui.div(
            "file input",
            ui.div(class_="input-manager"),
            class_="panel-content"
        ),
        class_="col-a static-panel input-panel",
    ),
    ui.div(
        ui.div(
            ui.div(
                ui.div(
                    ui.div(
                        "file summary",
                        class_="panel-content"
                    ),
                    class_="static-panel file-sum-panel",
                ),
                ui.div(
                    ui.div(
                        "category summary",
                        class_="panel-content"
                    ),
                    class_="static-panel cat-sum-panel",
                ),
                class_="col-a1a",
            ),
            ui.div(
                ui.div(
                    ui.div(
                        ui.output_ui("memory_usage_graph"),
                        class_="memory-usage-graph"
                    ),
                    class_="panel-content memory-usage-panel-content"
                ),
                class_="static-panel memory-usage-panel",
            ),
            class_="row-a1",
        ),
        ui.div(
            ui.div(
                "raw data preview",
                class_="panel-content"
            ),
            class_="static-panel preview-raw-panel",
        ),
        class_="col-b",
    ),
    class_="menu-grid"
)