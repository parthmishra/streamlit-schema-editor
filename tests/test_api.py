import streamlit_schema_editor as sse
from streamlit.errors import StreamlitAPIException
from streamlit_schema_editor import EventContext, Metadata, streamlit_schema_editor
from streamlit_schema_editor import _component as component_registry
from streamlit_schema_editor import api as api_module


def test_import_smoke() -> None:
    assert callable(streamlit_schema_editor)
    assert Metadata is not None
    assert EventContext is not None


def test_component_falls_back_to_inline_assets_when_manifest_is_missing(
    monkeypatch,
) -> None:
    calls: list[dict[str, str | None]] = []
    original_component = component_registry.st.components.v2.component
    original_cached_component = component_registry._COMPONENT

    def fake_component(
        name: str,
        *,
        html: str | None = None,
        js: str | None = None,
        css: str | None = None,
    ):
        calls.append({"name": name, "html": html, "js": js, "css": css})
        if len(calls) == 1:
            raise StreamlitAPIException(
                "Component 'x' must be declared in pyproject.toml with asset_dir to use file-backed css."
            )
        return lambda **kwargs: {"tables": [], "relationships": []}

    monkeypatch.setattr(component_registry, "_COMPONENT", None)
    monkeypatch.setattr(
        component_registry,
        "_load_built_asset",
        lambda pattern: f"inline::{pattern}\n",
    )
    monkeypatch.setattr(component_registry.st.components.v2, "component", fake_component)

    try:
        resolved = component_registry.get_component()
    finally:
        monkeypatch.setattr(component_registry.st.components.v2, "component", original_component)
        monkeypatch.setattr(component_registry, "_COMPONENT", original_cached_component)

    assert callable(resolved)
    assert len(calls) == 2
    assert calls[0]["js"] == "index-*.js"
    assert calls[0]["css"] == "index-*.css"
    assert calls[1]["js"] == "inline::index-*.js\n"
    assert calls[1]["css"] == "inline::index-*.css\n"


def test_streamlit_schema_editor_normalizes_limit_arguments(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_renderer(**kwargs):
        captured.update(kwargs)
        return kwargs["default"]

    monkeypatch.setattr(api_module, "get_component", lambda: fake_renderer)

    value = streamlit_schema_editor(
        tables=[],
        relationships=[],
        show_arrowheads=False,
        show_edge_button=True,
        show_column_count_badge=False,
        show_validation=False,
        validation_refresh_key="refresh-1",
        column_type_options=["uuid", "varchar", "json"],
        max_connections_per_handle=2,
        max_incoming_connections_per_handle=3,
        max_outgoing_connections_per_handle=4,
        max_incoming_per_target=5,
        max_outgoing_per_source=6,
        key="normalization-test",
    )

    assert value["tables"] == []
    assert value["relationships"] == []
    assert captured["key"] == "normalization-test"
    assert captured["default"] == {
        "selection": {
            "selected_table_id": None,
            "selected_column_id": None,
            "selected_relationship_id": None,
        },
        "event_context": None,
    }
    assert captured["data"] == {
        "groups": None,
        "tables": [],
        "relationships": [],
        "editable": True,
        "fit_view": True,
        "height": 600,
        "connectable": True,
        "draggable": True,
        "deletable": True,
        "show_controls": False,
        "show_arrowheads": False,
        "show_edge_button": True,
        "show_column_count_badge": False,
        "show_groups": True,
        "group_layout": "manual",
        "group_order": None,
        "table_layout_within_group": "manual",
        "show_validation": False,
        "validation_refresh_key": "refresh-1",
        "column_type_options": ["uuid", "varchar", "json"],
        "allow_zoom": True,
        "allow_duplicate_edges": False,
        "max_connections_per_handle": 2,
        "max_incoming_connections_per_handle": 5,
        "max_outgoing_connections_per_handle": 6,
    }


def test_streamlit_schema_editor_keeps_dragging_enabled_in_read_only_mode(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_renderer(**kwargs):
        captured.update(kwargs)
        return kwargs["default"]

    monkeypatch.setattr(api_module, "get_component", lambda: fake_renderer)

    streamlit_schema_editor(
        tables=[],
        relationships=[],
        editable=False,
        connectable=False,
        deletable=False,
        key="read-only-default-dragging",
    )

    assert captured["data"] == {
        "groups": None,
        "tables": [],
        "relationships": [],
        "editable": False,
        "fit_view": True,
        "height": 600,
        "connectable": False,
        "draggable": True,
        "deletable": False,
        "show_controls": False,
        "show_arrowheads": True,
        "show_edge_button": False,
        "show_column_count_badge": True,
        "show_groups": True,
        "group_layout": "manual",
        "group_order": None,
        "table_layout_within_group": "manual",
        "show_validation": True,
        "validation_refresh_key": None,
        "column_type_options": None,
        "allow_zoom": True,
        "allow_duplicate_edges": False,
        "max_connections_per_handle": None,
        "max_incoming_connections_per_handle": None,
        "max_outgoing_connections_per_handle": None,
    }


def test_streamlit_schema_editor_round_trips_groups(monkeypatch) -> None:
    captured: dict[str, object] = {}
    groups = [
        {
            "id": "source",
            "label": "Source",
            "position": {"x": 40.0, "y": 56.0},
            "width": 440.0,
            "height": 520.0,
        }
    ]

    def fake_renderer(**kwargs):
        captured.update(kwargs)
        return {
            "groups": groups,
            "tables": [],
            "relationships": [],
            "selection": kwargs["default"]["selection"],
            "event_context": None,
        }

    monkeypatch.setattr(api_module, "get_component", lambda: fake_renderer)

    value = streamlit_schema_editor(
        tables=[],
        relationships=[],
        groups=groups,
        show_groups=False,
        key="group-roundtrip",
    )

    assert value["groups"] == groups
    assert captured["data"]["groups"] == groups
    assert captured["data"]["show_groups"] is False


def test_streamlit_schema_editor_passes_group_layout_options(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_renderer(**kwargs):
        captured.update(kwargs)
        return {
            "groups": [],
            "tables": [],
            "relationships": [],
            "selection": kwargs["default"]["selection"],
            "event_context": None,
        }

    monkeypatch.setattr(api_module, "get_component", lambda: fake_renderer)

    streamlit_schema_editor(
        tables=[],
        relationships=[],
        groups=[],
        group_layout="columns",
        group_order=["source", "target"],
        table_layout_within_group="stack",
    )

    assert captured["data"]["group_layout"] == "columns"
    assert captured["data"]["group_order"] == ["source", "target"]
    assert captured["data"]["table_layout_within_group"] == "stack"
