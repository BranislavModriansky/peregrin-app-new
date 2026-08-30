from shiny import ui


def _ai_panel(id: str, title: str, *content):
    """qp-style panel with a fixed in-panel header (no drag/collapse/maximize)."""
    return ui.div(
        ui.div(
            ui.div(
                ui.span(title, class_="qp-title"),
                class_="qp-header-left",
            ),
            class_="ai-header",
        ),
        ui.div(*content, class_="ai-body"),
        id=id,
        class_="ai-panel",
    )


ai_studio_page_content = ui.div(
    # Left: chat
    ui.div(
        _ai_panel("ai-chat", "Chat", ui.output_ui("chat_panel_content")),
        class_="ai-col",
        id="ai-col-left",
    ),
    # Vertical divider
    ui.div(class_="ai-divider ai-divider-v", id="ai-divider-v"),
    # Corner handle where all three panels meet
    ui.div(class_="ai-divider-corner", id="ai-divider-corner"),
    # Right: code editor above graph output
    ui.div(
        _ai_panel("ai-code", "Code Output", ui.output_ui("code_panel_content")),
        ui.div(class_="ai-divider ai-divider-h", id="ai-divider-h"),
        _ai_panel("ai-graph", "Graph Output", ui.output_ui("graph_panel_content")),
        class_="ai-col",
        id="ai-col-right",
    ),
    class_="ai-studio-grid",
    id="ai-studio-grid",
)