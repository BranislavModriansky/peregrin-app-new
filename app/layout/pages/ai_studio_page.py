from shiny import ui

ai_studio_page_content = ui.div(
    ui.div(
        ui.div(
            ui.div(
                "Chat",
                class_="ai-chat panel-content"
            ),
            class_="ai-chat-panel"
        ),
        ui.div(
            ui.div(
                "Code Output Editable",
                class_="ai-code-output panel-content"
            ),
            class_="ai-code-output-panel"
        ),
        ui.div(
            ui.div(
                "Graph Output",
                class_="ai-graph-output panel-content"
            ),
            class_="ai-graph-output-panel"
        ),
        class_="ai-studio-page",
    )
)