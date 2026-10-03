from shiny import ui

menu_content = ui.div(
    ui.div(
        ui.div(
            ui.div(
                ui.tags.input(
                    type="text",
                    id="directory_path_input",
                    class_="directory-path-input",
                    placeholder="Load files from a directory...",
                    spellcheck="false",
                    autocomplete="off",
                ),
                ui.tags.button(
                    ui.HTML(
                        '<svg xmlns="http://www.w3.org/2000/svg" height="45" width="45" viewBox="0 -960 960 960" fill="currentColor">'
                        '<path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v131q-18-13-38-22.5T800-548v-92H447l-80-80H160v480h283q3 21 9.5 41t15.5 39H160Z'
                        ' M751-229q29-29 29-71t-29-71q-29-29-71-29t-71 29q-29 29-29 71t29 71q29 29 71 29t71-29ZM884-40 776-148q-21 14-45.5 21t-50.5 7q-75 0-127.5-52.5T500-300q0-75 52.5-127.5T680-480q75 0 127.5 52.5T860-300q0 26-7 50.5T832-204L940-96l-56 56Z"/>'
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