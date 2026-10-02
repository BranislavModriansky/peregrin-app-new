from shiny import ui

menu_content = ui.div(
    ui.div(
        ui.div(
            ui.div(
                ui.tags.input(
                    type="text",
                    id="directory_path_input",
                    class_="directory-path-input",
                    placeholder="Load a local directory...",
                    spellcheck="false",
                    autocomplete="off",
                ),
                ui.tags.button(
                    ui.HTML(
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
                        '<circle cx="11" cy="11" r="7"></circle>'
                        '<line x1="16.2" y1="16.2" x2="21" y2="21"></line>'
                        '</svg>'
                    ),
                    type="button",
                    id="directory_browse_btn",
                    class_="directory-browse-btn",
                    title="Browse for a folder",
                ),
                class_="directory-browser",
            ),
            ui.div(class_="directory-browser-shadow"),
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