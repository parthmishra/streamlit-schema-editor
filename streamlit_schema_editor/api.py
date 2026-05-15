from __future__ import annotations

from typing import Any, cast

from ._component import get_component
from .types import (
    GroupLayoutMode,
    GroupSpec,
    SchemaEditorValue,
    SelectionState,
    TableLayoutWithinGroupMode,
    TableSpec,
    RelationshipSpec,
)


def _noop() -> None:
    """Keep CCv2 state keys available in the returned result."""


def _coerce_result(result: Any) -> dict[str, Any]:
    if isinstance(result, dict):
        return result

    if result is None:
        return {}

    coerced: dict[str, Any] = {}
    for key in (
        "groups",
        "tables",
        "relationships",
        "selection",
        "event",
        "event_context",
    ):
        if hasattr(result, key):
            coerced[key] = getattr(result, key)

    return coerced


def _coerce_selection(value: Any) -> SelectionState:
    if isinstance(value, dict):
        return {
            "selected_table_id": value.get("selected_table_id"),
            "selected_column_id": value.get("selected_column_id"),
            "selected_relationship_id": value.get("selected_relationship_id"),
        }

    return {
        "selected_table_id": getattr(value, "selected_table_id", None),
        "selected_column_id": getattr(value, "selected_column_id", None),
        "selected_relationship_id": getattr(value, "selected_relationship_id", None),
    }


def _resolve_interaction_flag(explicit: bool | None, *, editable: bool) -> bool:
    if explicit is not None:
        return explicit

    return editable


def _resolve_draggable_flag(explicit: bool | None) -> bool:
    if explicit is not None:
        return explicit

    return True


def _resolve_limit(
    override: int | None,
    fallback: int | None,
) -> int | None:
    if override is not None:
        return override

    return fallback


def _state_or_fallback(
    value: dict[str, Any],
    key: str,
    fallback: Any,
) -> Any:
    resolved = value.get(key)
    if resolved is None:
        return fallback

    return resolved


def streamlit_schema_editor(
    tables: list[TableSpec],
    relationships: list[RelationshipSpec],
    *,
    groups: list[GroupSpec] | None = None,
    height: int = 600,
    fit_view: bool = True,
    editable: bool = True,
    connectable: bool | None = None,
    draggable: bool | None = None,
    deletable: bool | None = None,
    show_controls: bool = False,
    show_arrowheads: bool = True,
    show_edge_button: bool = False,
    show_column_count_badge: bool = True,
    show_groups: bool = True,
    group_layout: GroupLayoutMode = "manual",
    group_order: list[str] | None = None,
    table_layout_within_group: TableLayoutWithinGroupMode = "manual",
    show_validation: bool = True,
    validation_refresh_key: str | int | float | None = None,
    column_type_options: list[str] | None = None,
    allow_zoom: bool = True,
    allow_duplicate_edges: bool = False,
    max_connections_per_handle: int | None = None,
    max_incoming_connections_per_handle: int | None = None,
    max_outgoing_connections_per_handle: int | None = None,
    max_incoming_per_target: int | None = None,
    max_outgoing_per_source: int | None = None,
    key: str | None = None,
) -> SchemaEditorValue:
    """Render a schema canvas backed by React Flow.

    Parameters
    ----------
    tables:
        The tables to render as database-schema nodes.
    groups:
        Optional labeled group containers used to visually organize tables.
    relationships:
        Relationships between table columns.
    height:
        Pixel height passed to the mounted component.
    fit_view:
        Whether the initial render should auto-fit the graph.
    key:
        Optional Streamlit component key.

    Returns
    -------
    SchemaEditorValue
        The current group positions, table positions, relationships, selection
        state, and the last semantic event emitted by the component.
    """

    default_selection: SelectionState = {
        "selected_table_id": None,
        "selected_column_id": None,
        "selected_relationship_id": None,
    }
    resolved_connectable = _resolve_interaction_flag(connectable, editable=editable)
    resolved_draggable = _resolve_draggable_flag(draggable)
    resolved_deletable = _resolve_interaction_flag(deletable, editable=editable)
    resolved_max_incoming_connections_per_handle = _resolve_limit(
        max_incoming_connections_per_handle,
        max_connections_per_handle,
    )
    resolved_max_outgoing_connections_per_handle = _resolve_limit(
        max_outgoing_connections_per_handle,
        max_connections_per_handle,
    )
    if max_incoming_per_target is not None:
        resolved_max_incoming_connections_per_handle = max_incoming_per_target
    if max_outgoing_per_source is not None:
        resolved_max_outgoing_connections_per_handle = max_outgoing_per_source

    component_value = get_component()(
        key=key,
        height=height,
        default={
            "selection": default_selection,
            "event_context": None,
        },
        data={
            "groups": groups,
            "tables": tables,
            "relationships": relationships,
            "editable": editable,
            "fit_view": fit_view,
            "height": height,
            "connectable": resolved_connectable,
            "draggable": resolved_draggable,
            "deletable": resolved_deletable,
            "show_controls": show_controls,
            "show_arrowheads": show_arrowheads,
            "show_edge_button": show_edge_button,
            "show_column_count_badge": show_column_count_badge,
            "show_groups": show_groups,
            "group_layout": group_layout,
            "group_order": group_order,
            "table_layout_within_group": table_layout_within_group,
            "show_validation": show_validation,
            "validation_refresh_key": validation_refresh_key,
            "column_type_options": column_type_options,
            "allow_zoom": allow_zoom,
            "allow_duplicate_edges": allow_duplicate_edges,
            "max_connections_per_handle": max_connections_per_handle,
            "max_incoming_connections_per_handle": resolved_max_incoming_connections_per_handle,
            "max_outgoing_connections_per_handle": resolved_max_outgoing_connections_per_handle,
        },
        on_groups_change=_noop,
        on_tables_change=_noop,
        on_relationships_change=_noop,
        on_selection_change=_noop,
        on_event_change=_noop,
        on_event_context_change=_noop,
    )

    value = _coerce_result(component_value)
    selection = _coerce_selection(value.get("selection") or default_selection)

    return cast(
        SchemaEditorValue,
        {
            "groups": _state_or_fallback(value, "groups", groups or []),
            "tables": _state_or_fallback(value, "tables", tables),
            "relationships": _state_or_fallback(value, "relationships", relationships),
            "selection": {
                "selected_table_id": selection["selected_table_id"],
                "selected_column_id": selection["selected_column_id"],
                "selected_relationship_id": selection["selected_relationship_id"],
            },
            "event": value.get("event"),
            "event_context": value.get("event_context"),
        },
    )


__all__ = ["streamlit_schema_editor"]
