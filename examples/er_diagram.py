import streamlit as st

from streamlit_schema_editor import RelationshipSpec, TableSpec, streamlit_schema_editor


st.set_page_config(page_title="ER Diagram", layout="wide")
st.title("ER Diagram")
st.caption("ER-style view with table dragging enabled and mapping edits disabled.")

tables: list[TableSpec] = [
    {
        "id": "customers",
        "label": "customers",
        "position": {"x": 64, "y": 120},
        "columns": [
            {"id": "customer_id", "name": "customer_id", "data_type": "bigint"},
            {"id": "customer_name", "name": "customer_name", "data_type": "varchar"},
        ],
    },
    {
        "id": "orders",
        "label": "orders",
        "position": {"x": 456, "y": 96},
        "columns": [
            {"id": "order_id", "name": "order_id", "data_type": "bigint"},
            {"id": "customer_id", "name": "customer_id", "data_type": "bigint"},
            {"id": "ordered_at", "name": "ordered_at", "data_type": "timestamp"},
        ],
    },
    {
        "id": "payments",
        "label": "payments",
        "position": {"x": 456, "y": 360},
        "columns": [
            {"id": "payment_id", "name": "payment_id", "data_type": "bigint"},
            {"id": "order_id", "name": "order_id", "data_type": "bigint"},
            {"id": "amount", "name": "amount", "data_type": "decimal(12,2)"},
        ],
    },
]

relationships: list[RelationshipSpec] = [
    {
        "id": "rel::customers::customer_id::orders::customer_id",
        "source_table": "customers",
        "source_column": "customer_id",
        "target_table": "orders",
        "target_column": "customer_id",
        "label": "1:N",
    },
    {
        "id": "rel::orders::order_id::payments::order_id",
        "source_table": "orders",
        "source_column": "order_id",
        "target_table": "payments",
        "target_column": "order_id",
        "label": "1:N",
    },
]

value = streamlit_schema_editor(
    tables,
    relationships,
    editable=False,
    draggable=True,
    show_arrowheads=False,
    show_column_count_badge=False,
    show_controls=True,
    height=680,
    key="er-diagram",
)

st.subheader("Selection")
st.json(value["selection"])
