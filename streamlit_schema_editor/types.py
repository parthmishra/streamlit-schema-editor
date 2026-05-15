from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

ValidationStatus = Literal["initial", "success", "loading", "error"]
GroupLayoutMode = Literal["manual", "columns", "rows"]
TableLayoutWithinGroupMode = Literal["manual", "stack"]
Metadata = dict[str, Any]


class Position(TypedDict):
    x: float
    y: float


class ValidationSpec(TypedDict):
    status: NotRequired[ValidationStatus]
    code: NotRequired[str]
    summary: NotRequired[str]
    detail: NotRequired[str]


class ColumnSpec(TypedDict):
    id: str
    name: str
    data_type: str
    validation: NotRequired[ValidationSpec]
    metadata: NotRequired[Metadata]


class TableSpec(TypedDict):
    id: str
    label: str
    columns: list[ColumnSpec]
    position: NotRequired[Position]
    group_id: NotRequired[str]
    validation: NotRequired[ValidationSpec]
    metadata: NotRequired[Metadata]


class GroupSpec(TypedDict):
    id: str
    label: str
    position: NotRequired[Position]
    width: NotRequired[float]
    height: NotRequired[float]
    metadata: NotRequired[Metadata]


class RelationshipSpec(TypedDict):
    id: str
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    label: NotRequired[str]
    validation: NotRequired[ValidationSpec]
    metadata: NotRequired[Metadata]


class SelectionState(TypedDict):
    selected_table_id: str | None
    selected_column_id: str | None
    selected_relationship_id: str | None


SchemaEditorEvent = (
    Literal[
        "selection_changed",
        "node_moved",
        "table_deleted",
        "column_created",
        "column_updated",
        "column_deleted",
        "relationship_created",
        "relationship_deleted",
        "relationship_rejected",
        "edge_details_requested",
    ]
    | None
)

EventContext = dict[str, Any] | None


class SchemaEditorValue(TypedDict):
    groups: list[GroupSpec]
    tables: list[TableSpec]
    relationships: list[RelationshipSpec]
    selection: SelectionState
    event: SchemaEditorEvent
    event_context: EventContext


__all__ = [
    "ColumnSpec",
    "EventContext",
    "GroupSpec",
    "GroupLayoutMode",
    "Metadata",
    "Position",
    "RelationshipSpec",
    "SchemaEditorEvent",
    "SchemaEditorValue",
    "SelectionState",
    "TableSpec",
    "TableLayoutWithinGroupMode",
    "ValidationSpec",
    "ValidationStatus",
]
