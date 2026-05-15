import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./global.css";
import SchemaEditorCanvas, {
  RelationshipSpec,
  TableSpec,
} from "./SchemaEditorCanvas";

const tables: TableSpec[] = [
  {
    id: "crm_customer",
    label: "crm_customer",
    position: { x: 64, y: 96 },
    columns: [
      { id: "customer_id", name: "customer_id", data_type: "uuid" },
      { id: "cust_name", name: "cust_name", data_type: "varchar" },
      { id: "email", name: "email", data_type: "varchar" },
      { id: "region_code", name: "region_code", data_type: "text" },
    ],
  },
  {
    id: "erp_order",
    label: "erp_order",
    position: { x: 64, y: 360 },
    columns: [
      { id: "order_id", name: "order_id", data_type: "uuid" },
      { id: "customer_id", name: "customer_id", data_type: "uuid" },
      { id: "order_total", name: "order_total", data_type: "decimal" },
      { id: "order_ts", name: "order_ts", data_type: "timestamp" },
    ],
  },
  {
    id: "dim_customer",
    label: "dim_customer",
    position: { x: 520, y: 152 },
    columns: [
      { id: "customer_key", name: "customer_key", data_type: "bigint" },
      { id: "customer_name", name: "customer_name", data_type: "varchar" },
      { id: "email", name: "email", data_type: "varchar" },
      { id: "region", name: "region", data_type: "varchar" },
    ],
  },
  {
    id: "fct_order",
    label: "fct_order",
    position: { x: 520, y: 432 },
    columns: [
      { id: "order_key", name: "order_key", data_type: "bigint" },
      { id: "customer_key", name: "customer_key", data_type: "bigint" },
      { id: "gross_amount", name: "gross_amount", data_type: "decimal" },
      { id: "ordered_at", name: "ordered_at", data_type: "timestamp" },
    ],
  },
];

const relationships: RelationshipSpec[] = [
  {
    id: "rel::crm_customer::customer_id::erp_order::customer_id",
    source_table: "crm_customer",
    source_column: "customer_id",
    target_table: "erp_order",
    target_column: "customer_id",
    label: "FK",
  },
  {
    id: "rel::crm_customer::cust_name::dim_customer::customer_name",
    source_table: "crm_customer",
    source_column: "cust_name",
    target_table: "dim_customer",
    target_column: "customer_name",
    metadata: { sql_expression: "UPPER(TRIM(cust_name))" },
  },
  {
    id: "rel::erp_order::order_total::fct_order::gross_amount",
    source_table: "erp_order",
    source_column: "order_total",
    target_table: "fct_order",
    target_column: "gross_amount",
    metadata: { sql_expression: "CAST(order_total AS DECIMAL(12,2))" },
  },
];

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Preview root not found");
}

document.body.style.margin = "0";
document.body.style.minHeight = "100vh";
document.body.style.padding = "24px";
document.body.style.background =
  "radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 36%), #fafafa";

document.documentElement.style.setProperty("--st-background-color", "#fafafa");
document.documentElement.style.setProperty(
  "--st-secondary-background-color",
  "#ffffff",
);
document.documentElement.style.setProperty("--st-text-color", "#111827");
document.documentElement.style.setProperty("--st-border-color", "#d4d4d8");
document.documentElement.style.setProperty(
  "--st-widget-border-color",
  "#d4d4d8",
);
document.documentElement.style.setProperty("--st-primary-color", "#2563eb");
document.documentElement.style.setProperty("--st-base-radius", "0.75rem");

createRoot(rootElement).render(
  <StrictMode>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <SchemaEditorCanvas
        data={{
          tables,
          relationships,
          fit_view: true,
          height: 760,
        }}
        parentElement={document.documentElement}
        setStateValue={() => undefined}
        setTriggerValue={() => undefined}
      />
    </div>
  </StrictMode>,
);
