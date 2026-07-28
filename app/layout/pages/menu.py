from shiny import ui

menu_content = ui.div(
    ui.div(
        "file input",
        class_="col-a static-panel input-panel",
    ),
    ui.div(
        ui.div(
            ui.div(
                ui.div(
                    "file summary",
                    class_="static-panel file-sum-panel",
                ),
                ui.div(
                    "category summary",
                    class_="static-panel cat-sum-panel",
                ),
                class_="col-a1a",
            ),
            ui.div(
                "memory usage",
                class_="static-panel memory-usage-panel",
            ),
            class_="row-a1",
        ),
        ui.div(
            "raw data preview",
            class_="static-panel preview-raw-panel",
        ),
        class_="col-b",
    ),
    class_="menu-grid"
)