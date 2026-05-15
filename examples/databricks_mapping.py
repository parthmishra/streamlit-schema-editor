from collections import defaultdict

import streamlit as st

from streamlit_schema_editor import (
    GroupSpec,
    TableSpec,
    streamlit_schema_editor,
)


def build_tables_from_databricks_columns(rows: list[dict[str, str]]) -> list[TableSpec]:
    grouped: dict[tuple[str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[(row["catalog"], row["schema"], row["table"])].append(row)

    tables: list[TableSpec] = []
    for index, ((catalog, schema, table), columns) in enumerate(grouped.items()):
        tables.append(
            {
                "id": f"{catalog}.{schema}.{table}",
                "label": f"{schema}.{table}",
                "position": {"x": 80 + (index % 2) * 520, "y": 96 + (index // 2) * 320},
                "metadata": {"catalog": catalog, "schema": schema, "table": table},
                "columns": [
                    {
                        "id": column["column"],
                        "name": column["column"],
                        "data_type": column["type"],
                        "metadata": {
                            "nullable": column["nullable"],
                            "ordinal_position": column["ordinal_position"],
                        },
                    }
                    for column in columns
                ],
            }
        )

    return tables


def build_source_target_groups() -> list[GroupSpec]:
    return [
        {
            "id": "source",
            "label": "Source",
            "width": 468,
            "height": 620,
        },
        {
            "id": "target",
            "label": "Target",
            "width": 372,
            "height": 420,
        },
    ]


st.set_page_config(page_title="Databricks Mapping", layout="wide")
st.title("Databricks Source-to-Target Mapping")
st.caption(
    "Example only: replace the mocked metadata rows below with your Databricks "
    "catalog or information schema query results. This demo keeps source tables "
    "in a left lane and the modeled target table in a right lane."
)

source_rows = [
    {
        "catalog": "main",
        "schema": "bronze",
        "table": "crm_customer",
        "column": "customer_id",
        "type": "string",
        "nullable": "false",
        "ordinal_position": "1",
    },
    {
        "catalog": "main",
        "schema": "bronze",
        "table": "crm_customer",
        "column": "customer_name",
        "type": "string",
        "nullable": "true",
        "ordinal_position": "2",
    },
    {
        "catalog": "main",
        "schema": "bronze",
        "table": "erp_order",
        "column": "order_id",
        "type": "string",
        "nullable": "false",
        "ordinal_position": "1",
    },
    {
        "catalog": "main",
        "schema": "bronze",
        "table": "erp_order",
        "column": "customer_id",
        "type": "string",
        "nullable": "false",
        "ordinal_position": "2",
    },
    {
        "catalog": "main",
        "schema": "bronze",
        "table": "erp_order",
        "column": "order_total",
        "type": "decimal(12,2)",
        "nullable": "true",
        "ordinal_position": "3",
    },
]

target_rows = [
    {
        "catalog": "main",
        "schema": "silver",
        "table": "dim_customer",
        "column": "customer_key",
        "type": "bigint",
        "nullable": "false",
        "ordinal_position": "1",
    },
    {
        "catalog": "main",
        "schema": "silver",
        "table": "dim_customer",
        "column": "customer_name",
        "type": "string",
        "nullable": "true",
        "ordinal_position": "2",
    },
]

source_tables = [
    {**table, "group_id": "source"}
    for table in build_tables_from_databricks_columns(source_rows)
]
target_tables = [
    {**table, "group_id": "target"}
    for table in build_tables_from_databricks_columns(target_rows)
]

if "mapping_tables" not in st.session_state:
    st.session_state.mapping_tables = source_tables + target_tables

if "mapping_groups" not in st.session_state:
    st.session_state.mapping_groups = build_source_target_groups()

if "mapping_relationships" not in st.session_state:
    st.session_state.mapping_relationships = [
        {
            "id": "rel::main.bronze.crm_customer::customer_name::main.silver.dim_customer::customer_name",
            "source_table": "main.bronze.crm_customer",
            "source_column": "customer_name",
            "target_table": "main.silver.dim_customer",
            "target_column": "customer_name",
            "validation": {
                "status": "loading",
                "summary": "Awaiting warehouse-backed mapping validation.",
            },
            "metadata": {
                "rule_id": "DBX-1001",
                "pipeline": "customer-dim-load",
                "sql_expression": "UPPER(TRIM(customer_name))",
            },
        }
    ]

show_groups = st.toggle("Show source / target groups", value=True)

value = streamlit_schema_editor(
    st.session_state.mapping_tables,
    st.session_state.mapping_relationships,
    groups=st.session_state.mapping_groups,
    show_controls=True,
    show_groups=show_groups,
    group_layout="columns",
    group_order=["source", "target"],
    table_layout_within_group="stack",
    max_connections_per_handle=2,
    height=720,
    key="databricks-mapping",
)

st.session_state.mapping_groups = value["groups"]
st.session_state.mapping_tables = value["tables"]
st.session_state.mapping_relationships = value["relationships"]

st.subheader("Last event")
st.write(value["event"] or "None")
st.subheader("Event context")
st.json(value["event_context"])
st.subheader("Current mapping payload")
st.json(value)
