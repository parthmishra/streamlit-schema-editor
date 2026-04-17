import streamlit as st

from streamlit_schema_editor import (
    GroupSpec,
    RelationshipSpec,
    TableSpec,
    streamlit_schema_editor,
)


def build_default_groups() -> list[GroupSpec]:
    return [
        {
            "id": "source",
            "label": "Source",
            "width": 384,
            "height": 620,
        },
        {
            "id": "target",
            "label": "Target",
            "width": 392,
            "height": 620,
        },
    ]


def build_default_tables() -> list[TableSpec]:
    return [
        {
            "id": "crm_customer",
            "label": "crm_customer",
            "group_id": "source",
            "validation": {
                "summary": "One source column no longer exists in the remote CRM schema."
            },
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
                        "detail": "Latest schema introspection did not return crm_customer.region_code.",
                    },
                },
            ],
        },
        {
            "id": "erp_order",
            "label": "erp_order",
            "group_id": "source",
            "columns": [
                {"id": "order_id", "name": "order_id", "data_type": "uuid"},
                {"id": "customer_id", "name": "customer_id", "data_type": "uuid"},
                {
                    "id": "order_total",
                    "name": "order_total",
                    "data_type": "decimal(12,2)",
                    "validation": {"status": "success"},
                },
                {
                    "id": "order_ts",
                    "name": "order_ts",
                    "data_type": "timestamp",
                    "validation": {
                        "status": "loading",
                        "summary": "Waiting on warehouse metadata refresh.",
                    },
                },
            ],
        },
        {
            "id": "dim_customer",
            "label": "dim_customer",
            "group_id": "target",
            "columns": [
                {"id": "customer_key", "name": "customer_key", "data_type": "bigint"},
                {
                    "id": "customer_name",
                    "name": "customer_name",
                    "data_type": "varchar(255)",
                    "validation": {"status": "success"},
                },
                {"id": "email", "name": "email", "data_type": "varchar(255)"},
                {"id": "region", "name": "region", "data_type": "varchar(24)"},
            ],
        },
        {
            "id": "fct_order",
            "label": "fct_order",
            "group_id": "target",
            "columns": [
                {"id": "order_key", "name": "order_key", "data_type": "bigint"},
                {"id": "customer_key", "name": "customer_key", "data_type": "bigint"},
                {
                    "id": "gross_amount",
                    "name": "gross_amount",
                    "data_type": "decimal(12,2)",
                    "validation": {"status": "success"},
                },
                {"id": "ordered_at", "name": "ordered_at", "data_type": "timestamp"},
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
            },
            "metadata": {
                "mapping_kind": "transform",
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
                "rule_id": "MAP-2048",
                "sql_expression": "CAST(order_total AS DECIMAL(12,2))",
            },
        },
    ]


def optional_bool_control(label: str, key: str, default: str) -> bool | None:
    choice = st.selectbox(
        label,
        options=["component default", "enabled", "disabled"],
        index=["component default", "enabled", "disabled"].index(default),
        key=key,
    )
    if choice == "enabled":
        return True
    if choice == "disabled":
        return False
    return None


st.set_page_config(page_title="Schema Editor Playground", layout="wide")
st.title("Schema Editor Playground")
st.caption(
    "Interactive demo for toggling runtime behavior and seeing the component update live."
)

if "playground_tables" not in st.session_state:
    st.session_state.playground_tables = build_default_tables()

if "playground_groups" not in st.session_state:
    st.session_state.playground_groups = build_default_groups()

if "playground_relationships" not in st.session_state:
    st.session_state.playground_relationships = build_default_relationships()

if "playground_validation_refresh_nonce" not in st.session_state:
    st.session_state.playground_validation_refresh_nonce = 0

with st.sidebar:
    st.subheader("Canvas")
    editable = st.toggle("Editable", value=True)
    fit_view = st.toggle("Fit View On Render", value=True)
    show_controls = st.toggle("Show Controls", value=True)
    show_arrowheads = st.toggle("Show Arrowheads", value=True)
    show_edge_button = st.toggle("Show Edge Button", value=True)
    show_column_count_badge = st.toggle("Show Column Count Badge", value=True)
    show_groups = st.toggle("Show Groups", value=True)
    show_validation = st.toggle("Show Validation", value=True)
    allow_zoom = st.toggle("Allow Zoom", value=True)

    st.subheader("Grouping")
    group_layout = st.selectbox(
        "Group Layout",
        options=["manual", "columns", "rows"],
        index=1,
    )
    table_layout_within_group = st.selectbox(
        "Tables Within Group",
        options=["manual", "stack"],
        index=1,
    )
    group_order = st.multiselect(
        "Group Order",
        options=[group["id"] for group in st.session_state.playground_groups],
        default=[group["id"] for group in st.session_state.playground_groups],
        help="Controls left-to-right or top-to-bottom order when automatic group layout is enabled.",
    )

    st.subheader("Interaction Defaults")
    connectable = optional_bool_control(
        "Connectable Override", "playground_connectable", "component default"
    )
    draggable = optional_bool_control(
        "Draggable Override", "playground_draggable", "component default"
    )
    deletable = optional_bool_control(
        "Deletable Override", "playground_deletable", "component default"
    )

    st.subheader("Connections")
    allow_duplicate_edges = st.toggle("Allow Duplicate Edges", value=False)
    limit_enabled = st.toggle("Apply Shared Handle Limit", value=False)
    max_connections_per_handle = (
        st.number_input(
            "Max Connections Per Handle",
            min_value=1,
            max_value=10,
            value=2,
            step=1,
        )
        if limit_enabled
        else None
    )

    st.subheader("Type Editor")
    use_type_options = st.toggle("Use Suggested Type Options", value=True)
    column_type_options = (
        [
            "uuid",
            "bigint",
            "integer",
            "varchar",
            "varchar(255)",
            "text",
            "timestamp",
            "decimal(12,2)",
            "json",
        ]
        if use_type_options
        else None
    )

    st.subheader("Validation")
    if st.button("Refresh Validation Visuals"):
        st.session_state.playground_validation_refresh_nonce += 1

    st.subheader("Data")
    if st.button("Reset Tables And Relationships", type="primary"):
        st.session_state.playground_groups = build_default_groups()
        st.session_state.playground_tables = build_default_tables()
        st.session_state.playground_relationships = build_default_relationships()
        st.session_state.playground_validation_refresh_nonce = 0

component_value = streamlit_schema_editor(
    st.session_state.playground_tables,
    st.session_state.playground_relationships,
    groups=st.session_state.playground_groups,
    height=760,
    fit_view=fit_view,
    editable=editable,
    connectable=connectable,
    draggable=draggable,
    deletable=deletable,
    show_controls=show_controls,
    show_arrowheads=show_arrowheads,
    show_edge_button=show_edge_button,
    show_column_count_badge=show_column_count_badge,
    show_groups=show_groups,
    group_layout=group_layout,
    group_order=group_order,
    table_layout_within_group=table_layout_within_group,
    show_validation=show_validation,
    validation_refresh_key=st.session_state.playground_validation_refresh_nonce,
    column_type_options=column_type_options,
    allow_zoom=allow_zoom,
    allow_duplicate_edges=allow_duplicate_edges,
    max_connections_per_handle=max_connections_per_handle,
    key="schema-editor-playground",
)

st.session_state.playground_groups = component_value["groups"]
st.session_state.playground_tables = component_value["tables"]
st.session_state.playground_relationships = component_value["relationships"]

summary_columns = st.columns(4)
summary_columns[0].metric("Groups", len(st.session_state.playground_groups))
summary_columns[1].metric(
    "Tables", len(st.session_state.playground_tables)
)
summary_columns[2].metric(
    "Relationships", len(st.session_state.playground_relationships)
)
summary_columns[3].metric("Groups Visible", "Yes" if show_groups else "No")

st.caption(
    "Selection: "
    f"{component_value['selection']['selected_table_id'] or component_value['selection']['selected_relationship_id'] or 'None'}"
    f" | Last Event: {component_value['event'] or 'None'}"
)

st.subheader("Current Event Context")
st.json(component_value["event_context"])

with st.expander("Runtime Configuration", expanded=False):
    st.write(
        {
            "editable": editable,
            "connectable": connectable,
            "draggable": draggable,
            "deletable": deletable,
            "show_controls": show_controls,
            "show_arrowheads": show_arrowheads,
            "show_edge_button": show_edge_button,
            "show_column_count_badge": show_column_count_badge,
            "show_groups": show_groups,
            "group_layout": group_layout,
            "group_order": group_order,
            "table_layout_within_group": table_layout_within_group,
            "show_validation": show_validation,
            "validation_refresh_key": st.session_state.playground_validation_refresh_nonce,
            "column_type_options": column_type_options,
            "allow_zoom": allow_zoom,
            "allow_duplicate_edges": allow_duplicate_edges,
            "max_connections_per_handle": max_connections_per_handle,
        }
    )

with st.expander("Current Payload", expanded=False):
    st.json(component_value)
