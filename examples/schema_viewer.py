import streamlit as st

from streamlit_schema_editor import TableSpec, streamlit_schema_editor


st.set_page_config(page_title="Schema Viewer", layout="wide")
st.title("Schema Viewer")
st.caption("Read-only schema explorer with validation badges and metadata.")

tables: list[TableSpec] = [
    {
        "id": "orders",
        "label": "analytics.orders",
        "position": {"x": 64, "y": 96},
        "metadata": {"owner": "analytics", "catalog": "main", "schema": "analytics"},
        "columns": [
            {
                "id": "order_id",
                "name": "order_id",
                "data_type": "bigint",
                "validation": {"status": "success"},
            },
            {
                "id": "customer_id",
                "name": "customer_id",
                "data_type": "bigint",
                "validation": {"status": "success"},
            },
            {
                "id": "order_total",
                "name": "order_total",
                "data_type": "decimal(12,2)",
                "validation": {
                    "status": "loading",
                    "summary": "Waiting for finance contract refresh.",
                },
            },
        ],
    },
    {
        "id": "customers",
        "label": "analytics.customers",
        "position": {"x": 460, "y": 164},
        "metadata": {"owner": "analytics", "catalog": "main", "schema": "analytics"},
        "columns": [
            {
                "id": "customer_id",
                "name": "customer_id",
                "data_type": "bigint",
                "validation": {"status": "success"},
            },
            {
                "id": "customer_name",
                "name": "customer_name",
                "data_type": "varchar",
                "validation": {"status": "success"},
            },
            {
                "id": "segment",
                "name": "segment",
                "data_type": "varchar",
                "validation": {"status": "success"},
            },
        ],
    },
]

value = streamlit_schema_editor(
    tables,
    [],
    editable=False,
    show_controls=True,
    height=640,
    key="schema-viewer",
)

selected_table = next(
    (table for table in value["tables"] if table["id"] == value["selection"]["selected_table_id"]),
    None,
)

left, right = st.columns([3, 2])
with left:
    st.subheader("Selection")
    st.json(value["selection"])
    st.subheader("Last event context")
    st.json(value["event_context"])

with right:
    st.subheader("Selected table metadata")
    if selected_table is None:
        st.info("Click a table to inspect its metadata.")
    else:
        st.json(selected_table.get("metadata") or {})
