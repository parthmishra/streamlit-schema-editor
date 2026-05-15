import streamlit as st

from streamlit_schema_editor import RelationshipSpec, TableSpec, streamlit_schema_editor


st.set_page_config(page_title="E2E Schema Editor", layout="wide")
st.title("E2E Schema Editor")

tables: list[TableSpec] = [
    {
        "id": "crm_customer",
        "label": "crm_customer",
        "position": {"x": 64, "y": 96},
        "columns": [
            {"id": "customer_id", "name": "customer_id", "data_type": "uuid"},
            {"id": "customer_name", "name": "customer_name", "data_type": "varchar"},
        ],
    },
    {
        "id": "dim_customer",
        "label": "dim_customer",
        "position": {"x": 520, "y": 152},
        "columns": [
            {"id": "customer_key", "name": "customer_key", "data_type": "bigint"},
            {"id": "customer_name", "name": "customer_name", "data_type": "varchar"},
        ],
    },
]

relationships: list[RelationshipSpec] = [
    {
        "id": "rel::crm_customer::customer_name::dim_customer::customer_name",
        "source_table": "crm_customer",
        "source_column": "customer_name",
        "target_table": "dim_customer",
        "target_column": "customer_name",
    }
]

value = streamlit_schema_editor(
    tables,
    relationships,
    show_controls=True,
    show_edge_button=True,
    column_type_options=["uuid", "varchar", "text", "json", "bigint"],
    height=640,
    key="e2e-schema-editor",
)

event_context = value["event_context"] or {}
crm_customer = next(table for table in value["tables"] if table["id"] == "crm_customer")
st.write(f"event::{value['event'] or 'none'}")
st.write(
    f"selected_relationship::{value['selection']['selected_relationship_id'] or 'none'}"
)
st.write(f"selected_column::{value['selection']['selected_column_id'] or 'none'}")
st.write(f"context_relationship::{event_context.get('relationship_id') or 'none'}")
st.write(f"context_table::{event_context.get('table_id') or 'none'}")
st.write(f"context_column::{event_context.get('column_id') or 'none'}")
st.write(
    f"crm_customer_columns::{','.join(column['name'] for column in crm_customer['columns'])}"
)
st.write(
    "crm_customer_types::"
    f"{','.join(column['data_type'] for column in crm_customer['columns'])}"
)
