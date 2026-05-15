import streamlit as st

from streamlit_schema_editor import (
    RelationshipSpec,
    TableSpec,
    streamlit_schema_editor,
)


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def save_relationship_edits() -> None:
    relationship_id = st.session_state.get("inspected_relationship_id")
    if not relationship_id:
        return

    next_label = normalize_optional_text(st.session_state.get("editor_label_input"))
    next_sql_expression = normalize_optional_text(
        st.session_state.get("editor_sql_expression_input")
    )

    next_relationships: list[RelationshipSpec] = []
    for relationship in st.session_state.demo_relationships:
        if relationship["id"] != relationship_id:
            next_relationships.append(relationship)
            continue

        updated_relationship: RelationshipSpec = dict(relationship)

        if next_label is not None:
            updated_relationship["label"] = next_label
        else:
            updated_relationship.pop("label", None)

        next_metadata = dict(updated_relationship.get("metadata") or {})
        if next_sql_expression is not None:
            next_metadata["sql_expression"] = next_sql_expression
        else:
            next_metadata.pop("sql_expression", None)

        if next_metadata:
            updated_relationship["metadata"] = next_metadata
        else:
            updated_relationship.pop("metadata", None)

        next_relationships.append(updated_relationship)

    st.session_state.demo_relationships = next_relationships
    st.session_state.editor_loaded_relationship_id = relationship_id
    st.session_state.relationship_save_notice = relationship_id


def build_default_tables() -> list[TableSpec]:
    return [
        {
            "id": "crm_customer",
            "label": "crm_customer",
            "validation": {
                "summary": "One source column no longer exists in the remote CRM schema."
            },
            "position": {"x": 64, "y": 96},
            "columns": [
                {
                    "id": "customer_id",
                    "name": "customer_id",
                    "data_type": "uuid",
                    "validation": {"status": "success"},
                },
                {
                    "id": "cust_name",
                    "name": "cust_name",
                    "data_type": "varchar",
                    "validation": {"status": "success"},
                },
                {
                    "id": "email",
                    "name": "email",
                    "data_type": "varchar",
                    "validation": {"status": "success"},
                },
                {
                    "id": "region_code",
                    "name": "region_code",
                    "data_type": "text",
                    "validation": {
                        "status": "error",
                        "code": "missing_column",
                        "summary": "Column not found in remote CRM table.",
                        "detail": (
                            "The mapping references crm_customer.region_code, but the "
                            "latest database introspection for PROD_CRM.PUBLIC.CUSTOMER "
                            "did not return that column."
                        ),
                    },
                },
            ],
        },
        {
            "id": "erp_order",
            "label": "erp_order",
            "position": {"x": 64, "y": 360},
            "columns": [
                {
                    "id": "order_id",
                    "name": "order_id",
                    "data_type": "uuid",
                    "validation": {"status": "success"},
                },
                {
                    "id": "customer_id",
                    "name": "customer_id",
                    "data_type": "uuid",
                    "validation": {"status": "success"},
                },
                {
                    "id": "order_total",
                    "name": "order_total",
                    "data_type": "decimal",
                    "validation": {"status": "success"},
                },
                {
                    "id": "order_ts",
                    "name": "order_ts",
                    "data_type": "timestamp",
                    "validation": {
                        "status": "loading",
                        "summary": "Waiting on warehouse metadata refresh.",
                        "detail": (
                            "This column is still being validated against the latest ERP "
                            "catalog snapshot."
                        ),
                    },
                },
            ],
        },
        {
            "id": "dim_customer",
            "label": "dim_customer",
            "position": {"x": 520, "y": 152},
            "columns": [
                {
                    "id": "customer_key",
                    "name": "customer_key",
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
                    "id": "email",
                    "name": "email",
                    "data_type": "varchar",
                    "validation": {"status": "success"},
                },
                {
                    "id": "region",
                    "name": "region",
                    "data_type": "varchar",
                    "validation": {"status": "success"},
                },
            ],
        },
        {
            "id": "fct_order",
            "label": "fct_order",
            "position": {"x": 520, "y": 432},
            "columns": [
                {
                    "id": "order_key",
                    "name": "order_key",
                    "data_type": "bigint",
                    "validation": {"status": "success"},
                },
                {
                    "id": "customer_key",
                    "name": "customer_key",
                    "data_type": "bigint",
                    "validation": {"status": "success"},
                },
                {
                    "id": "gross_amount",
                    "name": "gross_amount",
                    "data_type": "decimal",
                    "validation": {"status": "success"},
                },
                {
                    "id": "ordered_at",
                    "name": "ordered_at",
                    "data_type": "timestamp",
                    "validation": {"status": "success"},
                },
            ],
        },
    ]


def build_default_relationships() -> list[RelationshipSpec]:
    return [
        {
            "id": "rel::crm_customer::customer_id::erp_order::customer_id",
            "source_table": "crm_customer",
            "source_column": "customer_id",
            "target_table": "erp_order",
            "target_column": "customer_id",
            "label": "FK",
            "metadata": {
                "mapping_kind": "foreign_key",
                "source_system": "CRM",
                "target_system": "ERP",
            },
        },
        {
            "id": "rel::crm_customer::cust_name::dim_customer::customer_name",
            "source_table": "crm_customer",
            "source_column": "cust_name",
            "target_table": "dim_customer",
            "target_column": "customer_name",
            "validation": {
                "status": "error",
                "code": "manual_review_required",
                "summary": "Target normalization expression needs review.",
                "detail": (
                    "The canonical target uses a warehouse-managed normalization rule. "
                    "This source-to-target expression is still pending approval from "
                    "the data engineering team."
                ),
            },
            "metadata": {
                "mapping_kind": "transform",
                "owner": "data-platform",
                "rule_id": "MAP-1024",
                "sql_expression": "UPPER(TRIM(cust_name))",
            },
        },
        {
            "id": "rel::erp_order::order_total::fct_order::gross_amount",
            "source_table": "erp_order",
            "source_column": "order_total",
            "target_table": "fct_order",
            "target_column": "gross_amount",
            "validation": {
                "status": "success",
                "summary": "Validated against the latest finance model contract.",
            },
            "metadata": {
                "mapping_kind": "measure",
                "owner": "finance-analytics",
                "rule_id": "MAP-2048",
                "sql_expression": "CAST(order_total AS DECIMAL(12,2))",
            },
        },
    ]


st.set_page_config(page_title="streamlit-schema-editor", layout="wide")
st.title("streamlit-schema-editor")
st.caption("Generic schema and mapping canvas built with Streamlit CCv2 + React Flow.")

if "demo_tables" not in st.session_state:
    st.session_state.demo_tables = build_default_tables()

if "demo_relationships" not in st.session_state:
    st.session_state.demo_relationships = build_default_relationships()

if "inspected_relationship_id" not in st.session_state:
    st.session_state.inspected_relationship_id = None

if "editor_loaded_relationship_id" not in st.session_state:
    st.session_state.editor_loaded_relationship_id = None

if "editor_label_input" not in st.session_state:
    st.session_state.editor_label_input = ""

if "editor_sql_expression_input" not in st.session_state:
    st.session_state.editor_sql_expression_input = ""

if "relationship_save_notice" not in st.session_state:
    st.session_state.relationship_save_notice = None

detail_slot = st.container()

component_value = streamlit_schema_editor(
    st.session_state.demo_tables,
    st.session_state.demo_relationships,
    height=760,
    show_controls=True,
    show_edge_button=True,
    max_connections_per_handle=2,
    key="schema-editor-demo",
)

st.session_state.demo_tables = component_value["tables"]
st.session_state.demo_relationships = component_value["relationships"]

selection = component_value["selection"]
selected_table_id = selection["selected_table_id"]
selected_column_id = selection["selected_column_id"]
selected_relationship_id = selection["selected_relationship_id"]
selected_table = next(
    (
        table
        for table in st.session_state.demo_tables
        if table["id"] == selected_table_id
    ),
    None,
)
selected_column = next(
    (
        column
        for column in (selected_table or {}).get("columns", [])
        if column["id"] == selected_column_id
    ),
    None,
)
selected_relationship = next(
    (
        relationship
        for relationship in st.session_state.demo_relationships
        if relationship["id"] == selected_relationship_id
    ),
    None,
)
if component_value["event"] == "edge_details_requested":
    st.session_state.inspected_relationship_id = selected_relationship_id

if st.session_state.inspected_relationship_id and not any(
    relationship["id"] == st.session_state.inspected_relationship_id
    for relationship in st.session_state.demo_relationships
):
    st.session_state.inspected_relationship_id = None

inspected_relationship = next(
    (
        relationship
        for relationship in st.session_state.demo_relationships
        if relationship["id"] == st.session_state.inspected_relationship_id
    ),
    None,
)

if inspected_relationship is None:
    st.session_state.editor_loaded_relationship_id = None
elif st.session_state.editor_loaded_relationship_id != inspected_relationship["id"]:
    st.session_state.editor_label_input = inspected_relationship.get("label", "")
    st.session_state.editor_sql_expression_input = (
        inspected_relationship.get("metadata") or {}
    ).get("sql_expression", "")
    st.session_state.editor_loaded_relationship_id = inspected_relationship["id"]

with detail_slot.container(border=True):
    st.subheader("Selection details")

    if selected_column is not None and selected_table is not None:
        validation = selected_column.get("validation") or {}
        status = validation.get("status", "initial")
        status_cols = st.columns(3)
        status_cols[0].metric(
            "Column",
            f"{selected_table['label']}.{selected_column['name']}",
        )
        status_cols[1].metric("Type", selected_column["data_type"])
        status_cols[2].metric("Validation", status.title())

        if status == "error":
            st.error(
                validation.get("summary") or "This column failed schema validation."
            )
        elif status == "loading":
            st.warning(
                validation.get("summary") or "This column is still being validated."
            )
        elif status == "success":
            st.success("This column passed the latest schema validation check.")
        else:
            st.info("No validation metadata is currently attached to this column.")

        issue_code = validation.get("code")
        if issue_code:
            st.caption(f"Issue code: `{issue_code}`")

        st.code(
            validation.get("detail")
            or validation.get("summary")
            or "-- no additional issue detail --",
            language="text",
        )
        st.caption(
            "Click another row to inspect its validation state, or click an edge button to inspect mapping metadata."
        )
        st.divider()

    st.subheader("Relationship details")
    if inspected_relationship is None:
        st.info(
            "Click an edge button to inspect its full metadata without showing edge labels by default."
        )
    else:
        source = (
            f"{inspected_relationship['source_table']}."
            f"{inspected_relationship['source_column']}"
        )
        target = (
            f"{inspected_relationship['target_table']}."
            f"{inspected_relationship['target_column']}"
        )
        top_cols = st.columns(3)
        top_cols[0].metric("Source", source)
        top_cols[1].metric("Target", target)
        top_cols[2].metric(
            "Edge label",
            inspected_relationship.get("label") or "None",
        )
        relationship_validation = inspected_relationship.get("validation") or {}
        relationship_status = relationship_validation.get("status")
        if relationship_status == "error":
            st.error(
                relationship_validation.get("summary")
                or "This relationship failed validation."
            )
        elif relationship_status == "loading":
            st.warning(
                relationship_validation.get("summary")
                or "This relationship is still being validated."
            )
        elif relationship_status == "success":
            st.success(
                relationship_validation.get("summary")
                or "This relationship passed validation."
            )
        if st.session_state.relationship_save_notice == inspected_relationship["id"]:
            st.success("Saved relationship metadata and pushed it back into the graph.")
            st.session_state.relationship_save_notice = None

        with st.form("relationship_editor", border=False):
            st.text_input(
                "Label",
                key="editor_label_input",
                help="Optional short badge shown on the edge button when present.",
            )
            st.text_area(
                "SQL expression",
                key="editor_sql_expression_input",
                height=160,
                help="Example of domain-specific metadata that round-trips through the component without being a first-class schema field.",
            )
            st.form_submit_button(
                "Save relationship metadata", on_click=save_relationship_edits
            )

        st.caption("Current saved SQL expression")
        st.code(
            (inspected_relationship.get("metadata") or {}).get("sql_expression")
            or "-- no SQL expression metadata --",
            language="sql",
        )
        st.caption("Relationship validation")
        st.json(relationship_validation)
        st.caption("Relationship metadata")
        st.json(inspected_relationship.get("metadata") or {})

summary_columns = st.columns(4)
summary_columns[0].metric("Tables", len(st.session_state.demo_tables))
summary_columns[1].metric("Relationships", len(st.session_state.demo_relationships))
summary_columns[2].metric("Selected table", selected_table_id or "None")
summary_columns[3].metric(
    "Last event",
    component_value["event"] or "None",
)

with st.expander("Selected relationship", expanded=True):
    if selected_relationship is None:
        st.info("Select an edge to inspect the current selection state.")
    else:
        st.write(
            {
                "source": f"{selected_relationship['source_table']}.{selected_relationship['source_column']}",
                "target": f"{selected_relationship['target_table']}.{selected_relationship['target_column']}",
                "label": selected_relationship.get("label"),
                "validation": selected_relationship.get("validation"),
                "metadata": selected_relationship.get("metadata"),
            }
        )

st.subheader("Current payload")
st.json(component_value)
st.subheader("Last event context")
st.json(component_value["event_context"])
