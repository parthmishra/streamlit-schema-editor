# streamlit-schema-editor

Streamlit custom component for viewing and editing schema, ER, and source-to-target
mapping graphs with React Flow and Streamlit Custom Components v2.

## Installation

```sh
uv pip install streamlit-schema-editor
```

## What It Supports

- schema viewing with table and column metadata
- source-to-target mapping with interactive relationship creation and deletion
- inline column editing for `name` and `data_type`
- optional edge action button for relationship inspection or custom workflows
- read-only or editable canvases
- validation styling for tables, columns, and relationships
- metadata passthrough on tables, columns, and relationships
- structured `event` + `event_context` payloads for Streamlit-side workflows

## Usage

```python
import streamlit as st

from streamlit_schema_editor import streamlit_schema_editor


if "tables" not in st.session_state:
    st.session_state.tables = [
        {
            "id": "crm_customer",
            "label": "crm_customer",
            "metadata": {"system": "crm"},
            "columns": [
                {"id": "customer_id", "name": "customer_id", "data_type": "uuid"},
                {"id": "cust_name", "name": "cust_name", "data_type": "varchar"},
            ],
        },
        {
            "id": "dim_customer",
            "label": "dim_customer",
            "metadata": {"system": "warehouse"},
            "columns": [
                {"id": "customer_key", "name": "customer_key", "data_type": "bigint"},
                {"id": "customer_name", "name": "customer_name", "data_type": "varchar"},
            ],
        },
    ]

if "relationships" not in st.session_state:
    st.session_state.relationships = [
        {
            "id": "rel::crm_customer::cust_name::dim_customer::customer_name",
            "source_table": "crm_customer",
            "source_column": "cust_name",
            "target_table": "dim_customer",
            "target_column": "customer_name",
            "validation": {
                "status": "loading",
                "summary": "Awaiting warehouse validation for this mapping.",
            },
            "metadata": {
                "rule_id": "MAP-1024",
                "sql_expression": "UPPER(TRIM(cust_name))",
            },
        }
    ]

value = streamlit_schema_editor(
    st.session_state.tables,
    st.session_state.relationships,
    height=700,
    show_controls=True,
    max_connections_per_handle=2,
    key="schema-editor",
)

st.session_state.tables = value["tables"]
st.session_state.relationships = value["relationships"]

st.write(value["event"])
st.json(value["event_context"])
```

## API

```python
streamlit_schema_editor(
    tables,
    relationships,
    *,
    groups=None,
    height=600,
    fit_view=True,
    editable=True,
    connectable=None,
    draggable=None,
    deletable=None,
    show_controls=False,
    show_arrowheads=True,
    show_edge_button=False,
    show_column_count_badge=True,
    show_groups=True,
    group_layout="manual",
    group_order=None,
    table_layout_within_group="manual",
    show_validation=True,
    validation_refresh_key=None,
    column_type_options=None,
    allow_zoom=True,
    allow_duplicate_edges=False,
    max_connections_per_handle=None,
    max_incoming_connections_per_handle=None,
    max_outgoing_connections_per_handle=None,
    key=None,
)
```

`editable` acts as the default for `connectable` and `deletable`. Dragging is
enabled by default even for read-only canvases, and `editable` also enables
inline column editing, row add/remove controls, and column edit events. Override
the interaction flags individually when you need a mixed mode.

Use `show_arrowheads=False` for ER-style views where you want the canvas to read
more like an undirected diagram, and `show_column_count_badge=False` when long
table names need the extra header space. The legacy aliases
`max_incoming_per_target` and `max_outgoing_per_source` are still accepted for
backward compatibility, but the generic connection-limit parameters are the
preferred public API.

`show_edge_button` is optional and defaults to `False`. Turn it on only when you
want a per-relationship action affordance in the middle of the edge.

Use `groups` plus per-table `group_id` when you want optional labeled containers
such as `Source` / `Target`, database lanes, or bronze/silver/gold layers.
`show_groups` controls whether those containers are currently rendered without
requiring you to change the underlying table or relationship payload.

Use `group_layout="columns"` or `group_layout="rows"` when you want the
component to place groups automatically without manually setting every group
`position`. Use `group_order` to control that automatic order, and
`table_layout_within_group="stack"` to vertically arrange grouped tables for
lane-style views. Automatic layout modes intentionally own placement, so they
are best paired with read-only or lightly interactive canvases.

`show_validation` controls whether validation-derived colors, badges, and
summaries are rendered. If you want to force those visuals to refresh without
changing the schema payload, change `validation_refresh_key` between reruns.

### Edge Button

Enable the button when you want relationship inspection or a custom workflow
trigger from the canvas:

```python
value = streamlit_schema_editor(
    tables,
    relationships,
    show_edge_button=True,
    key="schema-editor-with-edge-actions",
)

if value["event"] == "edge_details_requested":
    relationship_id = (value["event_context"] or {}).get("relationship_id")
    st.write(f"Inspect relationship: {relationship_id}")
```

When enabled, the edge button can show:

- `relationship["label"]` when present
- `i` as a compact fallback for inspection

This button is useful for cases like opening a details panel, surfacing lineage
metadata, showing validation context, or launching a relationship editor. For
pure ER or schema-viewing use cases, leave it disabled.

### Return Value

- `tables`: current table list with updated positions
- `groups`: current group list with updated positions and sizes
- `relationships`: current relationships after connect/delete actions
- `selection`: current selected table, column, and relationship ids
- `event`: semantic event name or `None`
- `event_context`: structured payload for the last event

### Event Names

- `selection_changed`
- `node_moved`
- `table_deleted`
- `column_created`
- `column_updated`
- `column_deleted`
- `relationship_created`
- `relationship_deleted`
- `relationship_rejected`
- `edge_details_requested`

`edge_details_requested` is only emitted when `show_edge_button=True`.

### Schema Fields

Tables, columns, and relationships support generic `metadata` passthrough. Tables,
columns, and relationships can also opt into a top-level `validation` object.
Tables can optionally declare a single `group_id`, and groups are defined
separately with `id`, `label`, `position`, `width`, `height`, and `metadata`:

```python
{
    "validation": {
        "status": "error",
        "code": "missing_column",
        "summary": "Column not found in upstream schema.",
        "detail": "Latest introspection did not return crm_customer.region_code.",
    }
}
```

Use `validation` for generic UI state that the component understands, and keep
app-specific semantics in `metadata`. For example, SQL expressions, lineage
attributes, ownership, or workflow IDs should live in `metadata`, not as
first-class component fields.

### Inline Column Editing

When `editable=True`, table nodes support lightweight inline schema editing:

- click a column name to edit `column["name"]`
- click a data type to edit `column["data_type"]`
- use the placeholder row at the bottom of a table to add a column row
- use the `×` control on a row to remove that column

Column ids remain stable and are not edited inline. If you delete a column, any
attached relationships are removed from the graph at the same time.

If you pass `column_type_options`, the inline data-type editor uses an in-node
combobox with suggested values while still allowing custom typed entries such as
`varchar(255)`.

### Common Recipes

Viewer-style canvas with dragging enabled but editing disabled:

```python
value = streamlit_schema_editor(
    tables,
    relationships,
    editable=False,
    draggable=True,
    connectable=False,
    deletable=False,
    show_controls=True,
    key="schema-viewer",
)
```

Mapping editor with inline column editing and relationship inspection:

```python
value = streamlit_schema_editor(
    tables,
    relationships,
    editable=True,
    show_edge_button=True,
    show_controls=True,
    key="mapping-editor",
)
```

Toggle labeled source / target lanes on and off at runtime:

```python
groups = [
    {"id": "source", "label": "Source", "width": 420, "height": 640},
    {"id": "target", "label": "Target", "width": 380, "height": 640},
]

tables = [
    {**source_table, "group_id": "source"},
    {**target_table, "group_id": "target"},
]

show_groups = st.toggle("Show groups", value=True)

value = streamlit_schema_editor(
    tables,
    relationships,
    groups=groups,
    show_groups=show_groups,
    group_layout="columns",
    group_order=["source", "target"],
    table_layout_within_group="stack",
    key="schema-editor-groups",
)
```

Hide validation visuals until the user opts in:

```python
show_validation = st.toggle("Show validation", value=True)

value = streamlit_schema_editor(
    tables,
    relationships,
    show_validation=show_validation,
    key="schema-editor-validation-toggle",
)
```

Force validation visuals to refresh on demand:

```python
if "validation_refresh_nonce" not in st.session_state:
    st.session_state.validation_refresh_nonce = 0

if st.button("Refresh validation visuals"):
    st.session_state.validation_refresh_nonce += 1

value = streamlit_schema_editor(
    tables,
    relationships,
    show_validation=True,
    validation_refresh_key=st.session_state.validation_refresh_nonce,
    key="schema-editor-validation-refresh",
)
```

Use known type options while still allowing custom values:

```python
value = streamlit_schema_editor(
    tables,
    relationships,
    editable=True,
    column_type_options=[
        "uuid",
        "bigint",
        "integer",
        "varchar",
        "text",
        "timestamp",
        "json",
    ],
    key="schema-editor-type-options",
)
```

Handle inline column edit events in Streamlit:

```python
value = streamlit_schema_editor(
    tables,
    relationships,
    editable=True,
    key="schema-editor-events",
)

if value["event"] == "column_created":
    st.success(f"Added column: {(value['event_context'] or {}).get('column_id')}")

if value["event"] == "column_updated":
    context = value["event_context"] or {}
    st.info(
        "Updated "
        f"{context.get('table_id')}.{context.get('column_id')} "
        f"fields={context.get('fields')}"
    )

if value["event"] == "column_deleted":
    context = value["event_context"] or {}
    st.warning(
        "Deleted "
        f"{context.get('table_id')}.{context.get('column_id')} "
        f"and removed relationships={context.get('deleted_relationship_ids')}"
    )
```

## Examples

Run the examples from the project root:

```sh
uv run streamlit run example.py
uv run streamlit run examples/playground.py
uv run streamlit run examples/schema_viewer.py
uv run streamlit run examples/er_diagram.py
uv run streamlit run examples/databricks_mapping.py
```

- `example.py`: full source-to-target mapping demo
- `examples/playground.py`: interactive playground for toggling runtime options, grouping visibility, and validation live
- `examples/schema_viewer.py`: read-only schema browser
- `examples/er_diagram.py`: ER-style relationship view with arrowheads hidden
- `examples/databricks_mapping.py`: Databricks-inspired source-to-target mapping demo with labeled group lanes

## Development

Build the frontend first, then build the Python package:

```sh
cd streamlit_schema_editor/frontend
npm install
npm run build
cd ../..
uv build
```

## Testing

Run the Python tests:

```sh
uv run pytest
```
