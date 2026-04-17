import { FrontendRendererArgs } from "@streamlit/component-v2-lib";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  EdgeProps,
  MarkerType,
  Node,
  NodeProps,
  NodeTypes,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  CSSProperties,
  KeyboardEvent,
  MutableRefObject,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DatabaseSchemaNode as DatabaseSchemaNodeFrame,
  DatabaseSchemaNodeBody,
  DatabaseSchemaNodeHeader,
  DatabaseSchemaTableCell,
  DatabaseSchemaTableRow,
} from "./components/database-schema-node";
import { ButtonEdge } from "./components/button-edge";
import { LabeledHandle } from "./components/labeled-handle";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";

export type SchemaEditorPosition = {
  x: number;
  y: number;
};

export type ValidationStatus = "initial" | "success" | "loading" | "error";
export type Metadata = Record<string, unknown>;
export type ValidationSpec = {
  status?: ValidationStatus;
  code?: string;
  summary?: string;
  detail?: string;
};

export type ColumnSpec = {
  id: string;
  name: string;
  data_type: string;
  validation?: ValidationSpec;
  metadata?: Metadata;
};

export type TableSpec = {
  id: string;
  label: string;
  columns: ColumnSpec[];
  position?: SchemaEditorPosition;
  group_id?: string;
  validation?: ValidationSpec;
  metadata?: Metadata;
};

export type GroupSpec = {
  id: string;
  label: string;
  position?: SchemaEditorPosition;
  width?: number;
  height?: number;
  metadata?: Metadata;
};

export type GroupLayoutMode = "manual" | "columns" | "rows";
export type TableLayoutWithinGroupMode = "manual" | "stack";

export type RelationshipSpec = {
  id: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  label?: string;
  validation?: ValidationSpec;
  metadata?: Metadata;
};

export type SelectionState = {
  selected_table_id: string | null;
  selected_column_id: string | null;
  selected_relationship_id: string | null;
};

export type SchemaEditorEvent =
  | "selection_changed"
  | "node_moved"
  | "table_deleted"
  | "column_created"
  | "column_updated"
  | "column_deleted"
  | "relationship_created"
  | "relationship_deleted"
  | "relationship_rejected"
  | "edge_details_requested";

export type EventContext = Record<string, unknown> | null;

export type SchemaEditorStateShape = {
  groups: GroupSpec[];
  tables: TableSpec[];
  relationships: RelationshipSpec[];
  selection: SelectionState;
  event?: SchemaEditorEvent | null;
  event_context?: EventContext;
};

export type SchemaEditorDataShape = {
  groups?: GroupSpec[];
  tables: TableSpec[];
  relationships: RelationshipSpec[];
  editable?: boolean;
  fit_view?: boolean;
  height?: number;
  connectable?: boolean;
  draggable?: boolean;
  deletable?: boolean;
  show_controls?: boolean;
  show_arrowheads?: boolean;
  show_edge_button?: boolean;
  show_column_count_badge?: boolean;
  show_groups?: boolean;
  group_layout?: GroupLayoutMode;
  group_order?: string[];
  table_layout_within_group?: TableLayoutWithinGroupMode;
  show_validation?: boolean;
  validation_refresh_key?: string | number | null;
  column_type_options?: string[];
  allow_zoom?: boolean;
  allow_duplicate_edges?: boolean;
  max_connections_per_handle?: number | null;
  max_incoming_connections_per_handle?: number | null;
  max_outgoing_connections_per_handle?: number | null;
};

type DatabaseSchemaNodeData = {
  id: string;
  label: string;
  groupId: string | null;
  columns: ColumnSpec[];
  order: number;
  resolvedStatus: ValidationStatus;
  validation?: ValidationSpec;
  issueCount: number;
  selectedColumnId: string | null;
  editable: boolean;
  connectable: boolean;
  showValidation: boolean;
  showColumnCountBadge: boolean;
  columnTypeOptions: string[];
  validationRefreshKey?: string | number | null;
  metadata?: Metadata;
  onColumnSelect?: (tableId: string, columnId: string) => void;
  onColumnCreate?: (tableId: string) => void;
  onColumnUpdate?: (
    tableId: string,
    columnId: string,
    updates: Pick<ColumnSpec, "name" | "data_type">,
  ) => void;
  onColumnDelete?: (tableId: string, columnId: string) => void;
};

type GroupNodeData = {
  id: string;
  label: string;
  width: number;
  height: number;
  metadata?: Metadata;
};

type RelationshipEdgeData = {
  relationship: RelationshipSpec;
  showValidation: boolean;
  validationRefreshKey?: string | number | null;
  onDetailsRequest?: (relationshipId: string) => void;
};

type DatabaseTableNode = Node<DatabaseSchemaNodeData, "databaseSchema">;
type SchemaGroupNode = Node<GroupNodeData, "labeledGroup">;
type SchemaNode = DatabaseTableNode | SchemaGroupNode;
type RelationshipEdge = Edge<RelationshipEdgeData, "relationshipButton">;

export type SchemaEditorCanvasProps = Pick<
  FrontendRendererArgs<SchemaEditorStateShape, SchemaEditorDataShape>,
  "data" | "parentElement" | "setStateValue" | "setTriggerValue"
>;

const GRID_X_GAP = 360;
const GRID_Y_GAP = 240;
const GRID_COLUMNS = 3;
const SNAP_GRID: [number, number] = [16, 16];
const FIT_VIEW_OPTIONS = { padding: 0.14 };
const DELETE_KEY_CODES: string[] = ["Backspace", "Delete"];
const DISABLED_DELETE_KEY_CODES: string[] = [];
const LIGHT_BACKGROUND_FALLBACK = "#ffffff";
const DARK_BACKGROUND_FALLBACK = "#171717";
const DEFAULT_NEW_COLUMN_NAME = "new_column";
const DEFAULT_NEW_COLUMN_TYPE = "text";
const GROUP_PADDING_X = 28;
const GROUP_PADDING_Y_TOP = 44;
const GROUP_PADDING_Y_BOTTOM = 28;
const DEFAULT_GROUP_WIDTH = 420;
const DEFAULT_GROUP_HEIGHT = 260;
const GROUP_MIN_WIDTH = 360;
const GROUP_MIN_HEIGHT = 180;
const AUTO_LAYOUT_START_X = 48;
const AUTO_LAYOUT_START_Y = 48;
const AUTO_GROUP_GAP_X = 56;
const AUTO_GROUP_GAP_Y = 56;
const ESTIMATED_TABLE_WIDTH = 320;
const TABLE_BASE_HEIGHT = 62;
const TABLE_ROW_HEIGHT = 35;
const TABLE_EDITABLE_FOOTER_HEIGHT = 50;
const TABLE_STACK_GAP_Y = 18;
const STATUS_PRIORITY: Record<ValidationStatus, number> = {
  initial: 0,
  success: 1,
  loading: 2,
  error: 3,
};

const getThemeSource = (parentElement: HTMLElement | ShadowRoot): Element =>
  parentElement instanceof ShadowRoot ? parentElement.host : parentElement;

const parseRgb = (value: string): [number, number, number] | null => {
  const hex = value.trim();
  const hexMatch = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const normalized =
      hexMatch[1].length === 3
        ? hexMatch[1]
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : hexMatch[1];
    const intValue = Number.parseInt(normalized, 16);
    return [(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255];
  }

  const rgbMatch = value.match(
    /rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i,
  );
  if (!rgbMatch) {
    return null;
  }

  return [
    Number.parseFloat(rgbMatch[1]),
    Number.parseFloat(rgbMatch[2]),
    Number.parseFloat(rgbMatch[3]),
  ];
};

const getRelativeLuminance = ([red, green, blue]: [number, number, number]) => {
  const channel = (value: number): number => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
};

const jsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const sourceHandleId = (columnId: string): string => `source:${columnId}`;
const targetHandleId = (columnId: string): string => `target:${columnId}`;

const parseColumnHandleId = (
  handleId: string | null | undefined,
): string | null => {
  if (!handleId) {
    return null;
  }

  const [, columnId] = handleId.split(":");
  return columnId ?? null;
};

const fallbackPosition = (index: number): SchemaEditorPosition => ({
  x: 48 + (index % GRID_COLUMNS) * GRID_X_GAP,
  y: 48 + Math.floor(index / GRID_COLUMNS) * GRID_Y_GAP,
});

const isDatabaseTableNode = (node: SchemaNode | Node): node is DatabaseTableNode =>
  node.type === "databaseSchema";

const isSchemaGroupNode = (node: SchemaNode | Node): node is SchemaGroupNode =>
  node.type === "labeledGroup";

const normalizeEditableValue = (value: string): string => value.trim();

const estimateTableDimensions = (
  table: TableSpec,
  editable: boolean,
): { width: number; height: number } => ({
  width: ESTIMATED_TABLE_WIDTH,
  height:
    TABLE_BASE_HEIGHT +
    table.columns.length * TABLE_ROW_HEIGHT +
    (editable ? TABLE_EDITABLE_FOOTER_HEIGHT : 0),
});

type ResolvedGroupLayout = GroupSpec & {
  position: SchemaEditorPosition;
  width: number;
  height: number;
};

type ResolvedGroupLayoutResult = {
  groupLayouts: Map<string, ResolvedGroupLayout>;
  tablePositions: Map<string, SchemaEditorPosition>;
};

const orderGroups = (
  groups: GroupSpec[],
  groupOrder: string[],
): GroupSpec[] => {
  if (groupOrder.length === 0) {
    return groups;
  }

  const rankById = new Map(groupOrder.map((groupId, index) => [groupId, index]));
  return [...groups].sort((left, right) => {
    const leftRank = rankById.get(left.id);
    const rightRank = rankById.get(right.id);

    if (leftRank === undefined && rightRank === undefined) {
      return 0;
    }

    if (leftRank === undefined) {
      return 1;
    }

    if (rightRank === undefined) {
      return -1;
    }

    return leftRank - rightRank;
  });
};

const resolveGroupLayouts = (
  groups: GroupSpec[],
  tables: TableSpec[],
  editable: boolean,
  groupLayout: GroupLayoutMode,
  groupOrder: string[],
  tableLayoutWithinGroup: TableLayoutWithinGroupMode,
): ResolvedGroupLayoutResult => {
  const layouts = new Map<string, ResolvedGroupLayout>();
  const tablePositions = new Map<string, SchemaEditorPosition>();
  const orderedGroups = orderGroups(groups, groupOrder);
  let nextColumnX = AUTO_LAYOUT_START_X;
  let nextRowY = AUTO_LAYOUT_START_Y;

  orderedGroups.forEach((group, index) => {
    const memberTables = tables.filter((table) => table.group_id === group.id);
    const memberDimensions = memberTables.map((table) =>
      estimateTableDimensions(table, editable),
    );
    const memberBounds = memberTables.map((table, memberIndex) => {
      const absolutePosition =
        table.position ?? fallbackPosition(index + memberIndex);
      const dimensions = memberDimensions[memberIndex];
      return {
        left: absolutePosition.x,
        top: absolutePosition.y,
        right: absolutePosition.x + dimensions.width,
        bottom: absolutePosition.y + dimensions.height,
      };
    });
    const stackedContentHeight =
      memberDimensions.reduce((total, dimensions) => total + dimensions.height, 0) +
      Math.max(0, memberDimensions.length - 1) * TABLE_STACK_GAP_Y;
    const stackedContentWidth = Math.max(
      ESTIMATED_TABLE_WIDTH,
      ...memberDimensions.map((dimensions) => dimensions.width),
    );
    const defaultPosition =
      groupLayout === "columns"
        ? { x: nextColumnX, y: AUTO_LAYOUT_START_Y }
        : groupLayout === "rows"
          ? { x: AUTO_LAYOUT_START_X, y: nextRowY }
          : {
              x:
                memberBounds.length > 0
                  ? Math.min(...memberBounds.map((bounds) => bounds.left)) - GROUP_PADDING_X
                  : fallbackPosition(index).x - 24,
              y:
                memberBounds.length > 0
                  ? Math.min(...memberBounds.map((bounds) => bounds.top)) - GROUP_PADDING_Y_TOP
                  : fallbackPosition(index).y - 24,
            };
    const width =
      group.width ??
      (tableLayoutWithinGroup === "stack" && memberTables.length > 0
        ? Math.max(GROUP_MIN_WIDTH, stackedContentWidth + GROUP_PADDING_X * 2)
        : memberBounds.length > 0
          ? Math.max(
              GROUP_MIN_WIDTH,
              Math.max(...memberBounds.map((bounds) => bounds.right)) -
                defaultPosition.x +
                GROUP_PADDING_X,
            )
          : DEFAULT_GROUP_WIDTH);
    const height =
      group.height ??
      (tableLayoutWithinGroup === "stack" && memberTables.length > 0
        ? Math.max(
            GROUP_MIN_HEIGHT,
            stackedContentHeight + GROUP_PADDING_Y_TOP + GROUP_PADDING_Y_BOTTOM,
          )
        : memberBounds.length > 0
          ? Math.max(
              GROUP_MIN_HEIGHT,
              Math.max(...memberBounds.map((bounds) => bounds.bottom)) -
                defaultPosition.y +
                GROUP_PADDING_Y_BOTTOM,
            )
          : DEFAULT_GROUP_HEIGHT);

    layouts.set(group.id, {
      ...group,
      position: defaultPosition,
      width,
      height,
    });

    if (tableLayoutWithinGroup === "stack") {
      let currentY = defaultPosition.y + GROUP_PADDING_Y_TOP;
      memberTables.forEach((table, memberIndex) => {
        tablePositions.set(table.id, {
          x: defaultPosition.x + GROUP_PADDING_X,
          y: currentY,
        });
        currentY += memberDimensions[memberIndex].height + TABLE_STACK_GAP_Y;
      });
    }

    if (groupLayout === "columns") {
      nextColumnX = defaultPosition.x + width + AUTO_GROUP_GAP_X;
    } else if (groupLayout === "rows") {
      nextRowY = defaultPosition.y + height + AUTO_GROUP_GAP_Y;
    }
  });

  return {
    groupLayouts: layouts,
    tablePositions,
  };
};

const createColumnId = (tableId: string, columns: ColumnSpec[]): string => {
  const preferredBase = `${tableId}__${DEFAULT_NEW_COLUMN_NAME}`;
  const existingIds = new Set(columns.map((column) => column.id));
  if (!existingIds.has(preferredBase)) {
    return preferredBase;
  }

  let suffix = 2;
  while (existingIds.has(`${preferredBase}_${suffix}`)) {
    suffix += 1;
  }

  return `${preferredBase}_${suffix}`;
};

const isRelationshipAttachedToColumn = (
  relationship: RelationshipSpec,
  tableId: string,
  columnId: string,
): boolean =>
  (relationship.source_table === tableId &&
    relationship.source_column === columnId) ||
  (relationship.target_table === tableId &&
    relationship.target_column === columnId);

const aggregateTableStatus = (table: TableSpec): ValidationStatus => {
  if (table.validation?.status) {
    return table.validation.status;
  }

  return table.columns.reduce<ValidationStatus>((current, column) => {
    const nextStatus = column.validation?.status ?? "initial";
    return STATUS_PRIORITY[nextStatus] > STATUS_PRIORITY[current]
      ? nextStatus
      : current;
  }, "initial");
};

const countErroredColumns = (columns: ColumnSpec[]): number =>
  columns.filter((column) => column.validation?.status === "error").length;

const getStatusAccent = (status: ValidationStatus): string => {
  const accentByStatus: Record<ValidationStatus, string> = {
    initial: "var(--border)",
    success: "var(--st-green-color, #16a34a)",
    loading: "var(--st-blue-color, #2563eb)",
    error: "var(--st-red-color, #dc2626)",
  };

  return accentByStatus[status];
};

const getTableStatusStyles = (
  status: ValidationStatus,
  selected: boolean,
): CSSProperties => {
  const accent = getStatusAccent(status);

  return {
    border: `1px solid ${
      status === "initial"
        ? "var(--border)"
        : `color-mix(in srgb, ${accent} 36%, var(--border))`
    }`,
    backgroundColor: "var(--card)",
    boxShadow: selected
      ? `0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent), 0 6px 26px rgba(0, 0, 0, 0.24)`
      : `0 4px 18px rgba(0, 0, 0, 0.18)`,
  };
};

const getRowStatusStyles = (
  status: ValidationStatus | undefined,
  isSelected: boolean,
  isLastRow: boolean,
): CSSProperties | undefined => {
  const accentPalette: Record<ValidationStatus, string> = {
    initial: "var(--foreground)",
    success: getStatusAccent("success"),
    loading: getStatusAccent("loading"),
    error: getStatusAccent("error"),
  };

  if (isSelected) {
    return undefined;
  }

  if (!status || status === "initial") {
    return undefined;
  }

  return {
    backgroundColor: `color-mix(in srgb, ${accentPalette[status]} 6%, var(--card))`,
    ...(isLastRow
      ? {
          boxShadow: `inset 0 -1px 0 color-mix(in srgb, ${accentPalette[status]} 10%, transparent)`,
        }
      : {}),
  };
};

const isHandleTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement
    ? Boolean(target.closest(".react-flow__handle"))
    : false;

const relationshipIdForConnection = (
  sourceTable: string,
  sourceColumn: string,
  targetTable: string,
  targetColumn: string,
): string =>
  `rel::${sourceTable}::${sourceColumn}::${targetTable}::${targetColumn}`;

const tableToNode = (
  table: TableSpec,
  index: number,
  groupLayouts: Map<string, ResolvedGroupLayout>,
  resolvedTablePositions: Map<string, SchemaEditorPosition>,
  showGroups: boolean,
  tableLayoutWithinGroup: TableLayoutWithinGroupMode,
  selectedColumnId: string | null,
  editable: boolean,
  draggable: boolean,
  connectable: boolean,
  showValidation: boolean,
  showColumnCountBadge: boolean,
  columnTypeOptions: string[],
  validationRefreshKey?: string | number | null,
  onColumnSelect?: (tableId: string, columnId: string) => void,
  onColumnCreate?: (tableId: string) => void,
  onColumnUpdate?: (
    tableId: string,
    columnId: string,
    updates: Pick<ColumnSpec, "name" | "data_type">,
  ) => void,
  onColumnDelete?: (tableId: string, columnId: string) => void,
): DatabaseTableNode => {
  const absolutePosition =
    resolvedTablePositions.get(table.id) ??
    table.position ??
    fallbackPosition(index);
  const parentGroup =
    showGroups && table.group_id ? groupLayouts.get(table.group_id) : undefined;

  return {
    id: table.id,
    type: "databaseSchema",
    draggable:
      table.group_id && tableLayoutWithinGroup !== "manual" ? false : draggable,
    position: parentGroup
      ? {
          x: absolutePosition.x - parentGroup.position.x,
          y: absolutePosition.y - parentGroup.position.y,
        }
      : absolutePosition,
    ...(parentGroup
      ? {
          parentId: parentGroup.id,
          extent: "parent" as const,
        }
      : {}),
    data: {
      id: table.id,
      label: table.label,
      groupId: table.group_id ?? null,
      columns: table.columns,
      order: index,
      resolvedStatus: showValidation ? aggregateTableStatus(table) : "initial",
      validation: table.validation,
      issueCount: showValidation ? countErroredColumns(table.columns) : 0,
      selectedColumnId,
      editable,
      connectable,
      showValidation,
      showColumnCountBadge,
      columnTypeOptions,
      validationRefreshKey,
      metadata: table.metadata,
      onColumnSelect,
      onColumnCreate,
      onColumnUpdate,
      onColumnDelete,
    },
  };
};

const groupToNode = (
  group: ResolvedGroupLayout,
  draggable: boolean,
  groupLayout: GroupLayoutMode,
): SchemaGroupNode => ({
  id: group.id,
  type: "labeledGroup",
  position: group.position,
  draggable: draggable && groupLayout === "manual",
  selectable: false,
  deletable: false,
  data: {
    id: group.id,
    label: group.label,
    width: group.width,
    height: group.height,
    metadata: group.metadata,
  },
  style: {
    width: group.width,
    height: group.height,
  },
});

const withUpdatedNodeColumns = (
  node: DatabaseTableNode,
  columns: ColumnSpec[],
): DatabaseTableNode => {
  const nextTable: TableSpec = {
    id: node.id,
    label: node.data.label,
    ...(node.data.groupId ? { group_id: node.data.groupId } : {}),
    columns,
    ...(node.data.validation ? { validation: node.data.validation } : {}),
    ...(node.data.metadata ? { metadata: node.data.metadata } : {}),
  };

  return {
    ...node,
    data: {
      ...node.data,
      columns,
      resolvedStatus: node.data.showValidation
        ? aggregateTableStatus(nextTable)
        : "initial",
      issueCount: node.data.showValidation ? countErroredColumns(columns) : 0,
    },
  };
};

const relationshipToEdge = (
  relationship: RelationshipSpec,
  showArrowheads: boolean,
  showValidation: boolean,
  validationRefreshKey?: string | number | null,
  onDetailsRequest?: (relationshipId: string) => void,
  showEdgeButton: boolean = false,
): RelationshipEdge => ({
  id: relationship.id,
  ...(showEdgeButton ? { type: "relationshipButton" as const } : {}),
  source: relationship.source_table,
  target: relationship.target_table,
  sourceHandle: sourceHandleId(relationship.source_column),
  targetHandle: targetHandleId(relationship.target_column),
  ...(showArrowheads
    ? {
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "var(--border)",
        },
      }
    : {}),
  style: {
    stroke: "var(--border)",
    strokeWidth: 1.5,
  },
  deletable: true,
  data: { relationship, showValidation, validationRefreshKey, onDetailsRequest },
});

const nodesToTables = (nodes: SchemaNode[]): TableSpec[] => {
  const groupPositions = new Map(
    nodes
      .filter(isSchemaGroupNode)
      .map((node) => [node.id, node.position] as const),
  );

  return [...nodes]
    .filter(isDatabaseTableNode)
    .sort((left, right) => left.data.order - right.data.order)
    .map((node) => ({
      id: node.id,
      label: node.data.label,
      columns: node.data.columns,
      position: {
        x: Number(
          (
            node.position.x + (groupPositions.get(node.parentId ?? "")?.x ?? 0)
          ).toFixed(2),
        ),
        y: Number(
          (
            node.position.y + (groupPositions.get(node.parentId ?? "")?.y ?? 0)
          ).toFixed(2),
        ),
      },
      ...(node.data.groupId ? { group_id: node.data.groupId } : {}),
      ...(node.data.validation ? { validation: node.data.validation } : {}),
      ...(node.data.metadata ? { metadata: node.data.metadata } : {}),
    }));
};

const nodesToGroups = (
  nodes: SchemaNode[],
  fallbackGroups: GroupSpec[],
  showGroups: boolean,
): GroupSpec[] => {
  if (!showGroups) {
    return fallbackGroups;
  }

  const groupNodes = nodes.filter(isSchemaGroupNode);
  if (groupNodes.length === 0) {
    return fallbackGroups;
  }

  return groupNodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    position: {
      x: Number(node.position.x.toFixed(2)),
      y: Number(node.position.y.toFixed(2)),
    },
    width: Number(node.style?.width ?? node.data.width ?? DEFAULT_GROUP_WIDTH),
    height: Number(node.style?.height ?? node.data.height ?? DEFAULT_GROUP_HEIGHT),
    ...(node.data.metadata ? { metadata: node.data.metadata } : {}),
  }));
};

const getNodeAbsolutePosition = (
  node: SchemaNode | Node,
  nodes: SchemaNode[],
): SchemaEditorPosition => {
  const parentPosition = node.parentId
    ? nodes.find((candidate) => candidate.id === node.parentId)?.position
    : undefined;

  return {
    x: Number((node.position.x + (parentPosition?.x ?? 0)).toFixed(2)),
    y: Number((node.position.y + (parentPosition?.y ?? 0)).toFixed(2)),
  };
};

const edgesToRelationships = (edges: RelationshipEdge[]): RelationshipSpec[] =>
  edges
    .map((edge) => edge.data?.relationship)
    .filter((relationship): relationship is RelationshipSpec => Boolean(relationship));

const attachDetailsHandler = (
  edge: RelationshipEdge,
  onDetailsRequest?: (relationshipId: string) => void,
): RelationshipEdge => {
  const relationship = edge.data?.relationship;
  if (!relationship || !onDetailsRequest) {
    return edge;
  }

  return {
    ...edge,
    data: {
      relationship,
      showValidation: edge.data?.showValidation ?? true,
      validationRefreshKey: edge.data?.validationRefreshKey,
      onDetailsRequest,
    },
  };
};

const applySelectionToNodes = (
  nodes: SchemaNode[],
  selection: SelectionState,
): SchemaNode[] => {
  let hasChanges = false;

  const nextNodes = nodes.map((node) => {
    if (!isDatabaseTableNode(node)) {
      return node;
    }

    const isSelectedTable = node.id === selection.selected_table_id;
    const nextSelectedColumnId = isSelectedTable
      ? selection.selected_column_id
      : null;

    if (
      Boolean(node.selected) === isSelectedTable &&
      node.data.selectedColumnId === nextSelectedColumnId
    ) {
      return node;
    }

    hasChanges = true;
    return {
      ...node,
      selected: isSelectedTable,
      data: {
        ...node.data,
        selectedColumnId: nextSelectedColumnId,
      },
    };
  });

  return hasChanges ? nextNodes : nodes;
};

const applySelectionToEdges = (
  edges: RelationshipEdge[],
  selectedRelationshipId: string | null,
  onDetailsRequest?: (relationshipId: string) => void,
): RelationshipEdge[] => {
  let hasChanges = false;

  const nextEdges = edges.map((edge) => {
    const withHandler = attachDetailsHandler(edge, onDetailsRequest);
    const isSelected = withHandler.id === selectedRelationshipId;

    if (
      Boolean(withHandler.selected) === isSelected &&
      edge.data?.onDetailsRequest === onDetailsRequest
    ) {
      return edge;
    }

    hasChanges = true;
    return {
      ...withHandler,
      selected: isSelected,
    };
  });

  return hasChanges ? nextEdges : edges;
};

const areNodesEquivalent = (
  currentNodes: SchemaNode[],
  nextNodes: SchemaNode[],
): boolean => {
  if (currentNodes.length !== nextNodes.length) {
    return false;
  }

  return currentNodes.every((node, index) => {
    const nextNode = nextNodes[index];
    if (node.type !== nextNode.type) {
      return false;
    }

    if (isSchemaGroupNode(node) && isSchemaGroupNode(nextNode)) {
      return (
        node.id === nextNode.id &&
        node.position.x === nextNode.position.x &&
        node.position.y === nextNode.position.y &&
        jsonEqual(node.style, nextNode.style) &&
        node.data.label === nextNode.data.label &&
        node.data.width === nextNode.data.width &&
        node.data.height === nextNode.data.height &&
        jsonEqual(node.data.metadata, nextNode.data.metadata)
      );
    }

    if (!isDatabaseTableNode(node) || !isDatabaseTableNode(nextNode)) {
      return false;
    }

    return (
      node.id === nextNode.id &&
      node.position.x === nextNode.position.x &&
      node.position.y === nextNode.position.y &&
      Boolean(node.selected) === Boolean(nextNode.selected) &&
      node.parentId === nextNode.parentId &&
      node.data.label === nextNode.data.label &&
      node.data.groupId === nextNode.data.groupId &&
      node.data.order === nextNode.data.order &&
      node.data.resolvedStatus === nextNode.data.resolvedStatus &&
      node.data.issueCount === nextNode.data.issueCount &&
      node.data.selectedColumnId === nextNode.data.selectedColumnId &&
      node.data.editable === nextNode.data.editable &&
      node.data.connectable === nextNode.data.connectable &&
      node.data.showValidation === nextNode.data.showValidation &&
      node.data.showColumnCountBadge === nextNode.data.showColumnCountBadge &&
      node.data.validationRefreshKey === nextNode.data.validationRefreshKey &&
      node.data.onColumnSelect === nextNode.data.onColumnSelect &&
      node.data.onColumnCreate === nextNode.data.onColumnCreate &&
      node.data.onColumnUpdate === nextNode.data.onColumnUpdate &&
      node.data.onColumnDelete === nextNode.data.onColumnDelete &&
      jsonEqual(node.data.columnTypeOptions, nextNode.data.columnTypeOptions) &&
      jsonEqual(node.data.columns, nextNode.data.columns) &&
      jsonEqual(node.data.validation, nextNode.data.validation) &&
      jsonEqual(node.data.metadata, nextNode.data.metadata)
    );
  });
};

const areEdgesEquivalent = (
  currentEdges: RelationshipEdge[],
  nextEdges: RelationshipEdge[],
): boolean => {
  if (currentEdges.length !== nextEdges.length) {
    return false;
  }

  return currentEdges.every((edge, index) => {
    const nextEdge = nextEdges[index];
    return (
      edge.id === nextEdge.id &&
      edge.type === nextEdge.type &&
      edge.source === nextEdge.source &&
      edge.target === nextEdge.target &&
      edge.sourceHandle === nextEdge.sourceHandle &&
      edge.targetHandle === nextEdge.targetHandle &&
      Boolean(edge.selected) === Boolean(nextEdge.selected) &&
      edge.deletable === nextEdge.deletable &&
      edge.data?.onDetailsRequest === nextEdge.data?.onDetailsRequest &&
      edge.data?.showValidation === nextEdge.data?.showValidation &&
      edge.data?.validationRefreshKey === nextEdge.data?.validationRefreshKey &&
      jsonEqual(edge.markerEnd, nextEdge.markerEnd) &&
      jsonEqual(edge.style, nextEdge.style) &&
      jsonEqual(edge.data?.relationship, nextEdge.data?.relationship)
    );
  });
};

const buildSelection = (
  selectedNodes: Node[],
  selectedEdges: Edge[],
  previousSelection: SelectionState,
): SelectionState => {
  const selectedTableId =
    selectedNodes.find((node) => node.type === "databaseSchema")?.id ?? null;
  const selectedRelationshipId = selectedEdges[0]?.id ?? null;

  return {
    selected_table_id: selectedTableId,
    selected_column_id:
      selectedRelationshipId || !selectedTableId
        ? null
        : previousSelection.selected_table_id === selectedTableId
          ? previousSelection.selected_column_id
          : null,
    selected_relationship_id: selectedRelationshipId,
  };
};

const connectionToRelationship = (
  connection: Connection,
): RelationshipSpec | null => {
  if (!connection.source || !connection.target) {
    return null;
  }

  const sourceColumn = parseColumnHandleId(connection.sourceHandle);
  const targetColumn = parseColumnHandleId(connection.targetHandle);
  if (!sourceColumn || !targetColumn) {
    return null;
  }

  return {
    id: relationshipIdForConnection(
      connection.source,
      sourceColumn,
      connection.target,
      targetColumn,
    ),
    source_table: connection.source,
    source_column: sourceColumn,
    target_table: connection.target,
    target_column: targetColumn,
  };
};

const getRelationshipIssueTitle = (
  relationship: RelationshipSpec,
  showValidation: boolean,
): string =>
  showValidation
    ? relationship.validation?.summary?.trim() || "Inspect relationship details"
    : "Inspect relationship details";

const getRelationshipButtonStyles = (
  relationship: RelationshipSpec,
  showValidation: boolean,
): CSSProperties | undefined => {
  if (!showValidation) {
    return undefined;
  }

  const status = relationship.validation?.status;
  if (!status || status === "initial") {
    return undefined;
  }

  const accent = getStatusAccent(status);
  return {
    borderColor: `color-mix(in srgb, ${accent} 28%, var(--border))`,
    backgroundColor: `color-mix(in srgb, ${accent} 9%, var(--card))`,
    color: `color-mix(in srgb, ${accent} 70%, var(--foreground))`,
  };
};

type EditableColumnField = "name" | "data_type";
type EditingCellState = {
  columnId: string;
  field: EditableColumnField;
} | null;

type TypeComboboxEditorProps = {
  ariaLabel: string;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  options: string[];
  value: string;
  onCancel: () => void;
  onCommit: (nextValue?: string) => void;
  onValueChange: (nextValue: string) => void;
};

const TypeComboboxEditor = ({
  ariaLabel,
  inputRef,
  options,
  value,
  onCancel,
  onCommit,
  onValueChange,
}: TypeComboboxEditorProps): JSX.Element => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(options.length > 0);
  const [highlightedIndex, setHighlightedIndex] = useState(
    options.length > 0 ? 0 : -1,
  );
  const [usingKeyboardNavigation, setUsingKeyboardNavigation] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedValue = normalizeEditableValue(value).toLowerCase();
    const uniqueOptions = Array.from(
      new Map(options.map((option) => [option.toLowerCase(), option])).values(),
    );

    if (!normalizedValue) {
      return uniqueOptions;
    }

    const startsWithMatches = uniqueOptions.filter((option) =>
      option.toLowerCase().startsWith(normalizedValue),
    );
    const containsMatches = uniqueOptions.filter((option) => {
      const normalizedOption = option.toLowerCase();
      return (
        !normalizedOption.startsWith(normalizedValue) &&
        normalizedOption.includes(normalizedValue)
      );
    });

    return [...startsWithMatches, ...containsMatches];
  }, [options, value]);

  useEffect(() => {
    setHighlightedIndex((currentIndex) => {
      if (filteredOptions.length === 0) {
        return -1;
      }

      if (currentIndex < 0 || currentIndex >= filteredOptions.length) {
        return 0;
      }

      return currentIndex;
    });
  }, [filteredOptions]);

  useEffect(() => {
    const ownerDocument = wrapperRef.current?.ownerDocument;
    if (!ownerDocument) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof globalThis.Node) || !wrapperRef.current) {
        return;
      }

      if (!wrapperRef.current.contains(target)) {
        onCommit();
      }
    };

    ownerDocument.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [onCommit]);

  const closeIfFocusLeaves = useCallback(() => {
    const ownerWindow = wrapperRef.current?.ownerDocument.defaultView;
    ownerWindow?.setTimeout(() => {
      const activeElement = wrapperRef.current?.ownerDocument.activeElement;
      if (
        wrapperRef.current &&
        activeElement instanceof globalThis.Node &&
        wrapperRef.current.contains(activeElement)
      ) {
        return;
      }

      onCommit();
    }, 0);
  }, [onCommit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (filteredOptions.length === 0) {
          return;
        }

        setIsOpen(true);
        setUsingKeyboardNavigation(true);
        setHighlightedIndex((currentIndex) =>
          currentIndex < filteredOptions.length - 1 ? currentIndex + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (filteredOptions.length === 0) {
          return;
        }

        setIsOpen(true);
        setUsingKeyboardNavigation(true);
        setHighlightedIndex((currentIndex) =>
          currentIndex > 0 ? currentIndex - 1 : filteredOptions.length - 1,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (
          isOpen &&
          usingKeyboardNavigation &&
          highlightedIndex >= 0 &&
          filteredOptions[highlightedIndex]
        ) {
          onCommit(filteredOptions[highlightedIndex]);
          return;
        }

        onCommit();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [
      filteredOptions,
      highlightedIndex,
      isOpen,
      onCancel,
      onCommit,
      usingKeyboardNavigation,
    ],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onBlur={closeIfFocusLeaves}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="relative">
        <input
          ref={(node) => {
            inputRef.current = node;
          }}
          aria-autocomplete="list"
          aria-controls={filteredOptions.length > 0 ? listboxId : undefined}
          aria-expanded={isOpen && filteredOptions.length > 0}
          aria-label={ariaLabel}
          className="column-type-combobox-input nodrag nopan nowheel w-full rounded-md border border-input bg-background px-2 py-1 pr-7 text-right text-xs text-foreground shadow-sm"
          role="combobox"
          value={value}
          onChange={(event) => {
            setIsOpen(true);
            setUsingKeyboardNavigation(false);
            onValueChange(event.target.value);
          }}
          onFocus={() => {
            if (filteredOptions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {options.length > 0 ? (
          <button
            aria-label="Toggle suggested data types"
            className="nodrag nopan nowheel absolute inset-y-0 right-1 inline-flex items-center justify-center px-1 text-muted-foreground transition-colors hover:text-foreground"
            tabIndex={-1}
            type="button"
            onClick={() => {
              setIsOpen((open) => !open);
              inputRef.current?.focus();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              ▾
            </span>
          </button>
        ) : null}
      </div>
      {isOpen && filteredOptions.length > 0 ? (
        <div className="column-type-combobox-panel nodrag nopan nowheel absolute top-[calc(100%+0.25rem)] right-0 z-30 min-w-full overflow-hidden rounded-md border shadow-lg">
          <div
            aria-label="Suggested data types"
            className="max-h-44 overflow-y-auto py-1"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.map((option, index) => (
              <button
                key={option}
                aria-selected={highlightedIndex === index}
                className="column-type-combobox-option block w-full truncate px-3 py-1.5 text-right text-xs"
                data-highlighted={highlightedIndex === index}
                role="option"
                type="button"
                onClick={() => onCommit(option)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                  setUsingKeyboardNavigation(false);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const DatabaseSchemaNode = memo(
  ({ data, selected }: NodeProps<DatabaseTableNode>): JSX.Element => {
    const [editingCell, setEditingCell] = useState<EditingCellState>(null);
    const [draftValue, setDraftValue] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);
    const issueLabel =
      data.showValidation && data.issueCount > 0
        ? `${data.issueCount} issue${data.issueCount === 1 ? "" : "s"}`
        : null;

    const statusAccent: Record<Exclude<ValidationStatus, "initial">, string> = {
      success: getStatusAccent("success"),
      loading: getStatusAccent("loading"),
      error: getStatusAccent("error"),
    };
    const showAddPlaceholderRow = data.editable;
    const lastColumn = data.columns[data.columns.length - 1];
    const footerSurfaceStyle = lastColumn
      && !showAddPlaceholderRow
      ? getRowStatusStyles(
          data.showValidation ? lastColumn.validation?.status : undefined,
          data.selectedColumnId === lastColumn.id,
          true,
        )
      : undefined;
    const displayStatus = data.showValidation ? data.resolvedStatus : "initial";
    const tableStatusStyles = getTableStatusStyles(displayStatus, selected);

    useEffect(() => {
      if (!editingCell) {
        return;
      }

      const currentColumn = data.columns.find(
        (column) => column.id === editingCell.columnId,
      );
      if (!currentColumn) {
        setEditingCell(null);
        setDraftValue("");
      }
    }, [data.columns, editingCell]);

    useEffect(() => {
      if (!editingCell) {
        return;
      }

      inputRef.current?.focus();
      inputRef.current?.select();
    }, [editingCell]);

    const stopEditing = useCallback(() => {
      setEditingCell(null);
      setDraftValue("");
    }, []);

    const beginEditing = useCallback(
      (column: ColumnSpec, field: EditableColumnField) => {
        if (!data.editable) {
          return;
        }

        data.onColumnSelect?.(data.id, column.id);
        setEditingCell({ columnId: column.id, field });
        setDraftValue(column[field]);
      },
      [data],
    );

    const commitEditing = useCallback((nextValue?: string) => {
      if (!editingCell) {
        return;
      }

      const currentColumn = data.columns.find(
        (column) => column.id === editingCell.columnId,
      );
      if (!currentColumn) {
        stopEditing();
        return;
      }

      const normalized = normalizeEditableValue(nextValue ?? draftValue);
      if (!normalized) {
        stopEditing();
        return;
      }

      if (normalized !== currentColumn[editingCell.field]) {
        data.onColumnUpdate?.(data.id, editingCell.columnId, {
          [editingCell.field]: normalized,
        } as Pick<ColumnSpec, "name" | "data_type">);
      }

      stopEditing();
    }, [data, draftValue, editingCell, stopEditing]);

    const renderColumnField = useCallback(
      (column: ColumnSpec, field: EditableColumnField) => {
        const isEditing =
          editingCell?.columnId === column.id && editingCell.field === field;
        const isTypeField = field === "data_type";
        const value = column[field];
        const label = `Edit column ${
          isTypeField ? "data type" : "name"
        } for ${column.name} in table ${data.label}`;

        if (isEditing) {
          if (isTypeField) {
            return (
              <TypeComboboxEditor
                ariaLabel={label}
                inputRef={inputRef}
                options={data.columnTypeOptions}
                value={draftValue}
                onCancel={stopEditing}
                onCommit={commitEditing}
                onValueChange={setDraftValue}
              />
            );
          }

          return (
            <input
              ref={inputRef}
              aria-label={label}
              className={cn(
                "nodrag nopan nowheel w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm",
                isTypeField && "text-right",
              )}
              value={draftValue}
              onBlur={() => commitEditing()}
              onChange={(event) => setDraftValue(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitEditing();
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  stopEditing();
                }
              }}
              onMouseDown={(event) => event.stopPropagation()}
            />
          );
        }

        if (!data.editable) {
          return (
            <span
              className={cn(
                "block min-w-0 truncate px-2 py-1",
                isTypeField && "text-right",
              )}
            >
              {value}
            </span>
          );
        }

        return (
          <button
            aria-label={label}
            className={cn(
              "nodrag nopan nowheel block w-full min-w-0 cursor-text truncate rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50",
              isTypeField && "text-right",
            )}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              beginEditing(column, field);
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {value}
          </button>
        );
      },
      [
        beginEditing,
        commitEditing,
        data.columnTypeOptions,
        data.editable,
        data.label,
        draftValue,
        editingCell,
        stopEditing,
      ],
    );

    return (
      <DatabaseSchemaNodeFrame
        className="overflow-visible rounded-xl border-border bg-card"
        style={{
          ...tableStatusStyles,
          backgroundColor:
            footerSurfaceStyle?.backgroundColor ?? tableStatusStyles.backgroundColor,
        }}
      >
        <DatabaseSchemaNodeHeader
          title={data.showValidation ? data.validation?.summary : undefined}
          style={{
            backgroundColor:
              displayStatus === "initial"
                ? "var(--secondary)"
                : `color-mix(in srgb, ${
                    statusAccent[
                      displayStatus as Exclude<ValidationStatus, "initial">
                    ]
                  } 9%, var(--secondary))`,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex w-full cursor-grab items-center justify-between gap-3 px-2 py-1 select-none active:cursor-grabbing">
            <div className="flex min-w-0 items-center gap-2">
              {displayStatus !== "initial" ? (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      statusAccent[
                        displayStatus as Exclude<ValidationStatus, "initial">
                      ],
                  }}
                />
              ) : null}
              <strong className="truncate text-base font-semibold leading-5">
                {data.label}
              </strong>
            </div>
            <div className="flex items-center gap-2">
              {issueLabel ? (
                <span className="inline-flex min-w-10 items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none">
                  {issueLabel}
                </span>
              ) : null}
              {data.showColumnCountBadge ? (
                <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
                  {data.columns.length} cols
                </span>
              ) : null}
            </div>
          </div>
        </DatabaseSchemaNodeHeader>
        <DatabaseSchemaNodeBody>
          {data.columns.map((column, index) => {
            const isSelectedColumn = data.selectedColumnId === column.id;
            const isLastRow =
              index === data.columns.length - 1 && !showAddPlaceholderRow;
            const rowSurfaceStyle = getRowStatusStyles(
              data.showValidation ? column.validation?.status : undefined,
              isSelectedColumn,
              isLastRow,
            );
            const lastRowRadius = isLastRow ? "0.75rem" : undefined;
            const leftCellSurfaceStyle = {
              "--column-row-base-background":
                rowSurfaceStyle?.backgroundColor ?? "var(--card)",
              "--column-row-base-shadow": rowSurfaceStyle?.boxShadow ?? "none",
              borderBottomLeftRadius: lastRowRadius,
              backgroundClip: "padding-box",
            } as CSSProperties;
            const rightCellSurfaceStyle = {
              "--column-row-base-background":
                rowSurfaceStyle?.backgroundColor ?? "var(--card)",
              "--column-row-base-shadow": rowSurfaceStyle?.boxShadow ?? "none",
              borderBottomRightRadius: lastRowRadius,
              backgroundClip: "padding-box",
            } as CSSProperties;

            return (
              <DatabaseSchemaTableRow
                key={column.id}
                className="column-row group nodrag nopan cursor-pointer transition-colors"
                data-selected={isSelectedColumn}
                title={data.showValidation ? column.validation?.summary : undefined}
                style={{
                  borderBottom:
                    index < data.columns.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
                onMouseDown={(event) => {
                  if (isHandleTarget(event.target)) {
                    return;
                  }
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  if (isHandleTarget(event.target)) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  data.onColumnSelect?.(data.id, column.id);
                }}
              >
                <DatabaseSchemaTableCell
                  className="column-row-cell p-0 font-light transition-colors"
                  style={leftCellSurfaceStyle}
                >
                  {data.connectable ? (
                    <div className="flex w-full items-center py-1.5 pr-4">
                      <LabeledHandle
                        id={targetHandleId(column.id)}
                        className="w-full min-w-0"
                        label={renderColumnField(column, "name")}
                        labelClassName="w-full min-w-0 px-0"
                        position={Position.Left}
                        title={column.name}
                        type="target"
                      />
                    </div>
                  ) : (
                    <div className="w-full min-w-0 py-1.5 pl-3 pr-2">
                      {renderColumnField(column, "name")}
                    </div>
                  )}
                </DatabaseSchemaTableCell>
                <DatabaseSchemaTableCell
                  className="column-row-cell p-0 font-thin transition-colors"
                  style={rightCellSurfaceStyle}
                >
                  <div className="relative flex w-full items-center py-1.5 pl-2">
                    {data.editable ? (
                      <Button
                        aria-label={`Delete column ${column.name} from table ${data.label}`}
                        className="nodrag nopan nowheel absolute top-1/2 left-1 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
                        size="icon-xs"
                        title={`Delete ${column.name}`}
                        variant="ghost"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          data.onColumnDelete?.(data.id, column.id);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        ×
                      </Button>
                    ) : null}
                    {data.connectable ? (
                      <LabeledHandle
                        id={sourceHandleId(column.id)}
                        className="min-w-0 w-full p-0"
                        handleClassName="p-0"
                        label={renderColumnField(column, "data_type")}
                        labelClassName={cn(
                          "w-full min-w-0 p-0 pr-3",
                          data.editable && "pl-7",
                        )}
                        position={Position.Right}
                        title={column.data_type}
                        type="source"
                      />
                    ) : (
                      <div className={cn("min-w-0 flex-1", data.editable && "pl-7")}>
                        {renderColumnField(column, "data_type")}
                      </div>
                    )}
                  </div>
                </DatabaseSchemaTableCell>
              </DatabaseSchemaTableRow>
            );
          })}
          {showAddPlaceholderRow ? (
            <DatabaseSchemaTableRow
              className="column-row nodrag nopan"
              data-placeholder="true"
            >
              <DatabaseSchemaTableCell
                className="column-row-cell p-0"
                colSpan={2}
                style={{
                  borderBottomLeftRadius: "0.75rem",
                  borderBottomRightRadius: "0.75rem",
                  backgroundClip: "padding-box",
                }}
              >
                <button
                  aria-label={`Add column to table ${data.label}`}
                  className="nodrag nopan nowheel flex w-full items-center justify-center gap-2 rounded-b-xl border-0 border-t border-dashed border-border px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    data.onColumnCreate?.(data.id);
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <span className="text-base leading-none">+</span>
                  <span>Add column</span>
                </button>
              </DatabaseSchemaTableCell>
            </DatabaseSchemaTableRow>
          ) : null}
        </DatabaseSchemaNodeBody>
      </DatabaseSchemaNodeFrame>
    );
  },
);

DatabaseSchemaNode.displayName = "DatabaseSchemaNode";

const LabeledGroupNode = memo(
  ({ data }: NodeProps<SchemaGroupNode>): JSX.Element => (
    <div
      className="schema-group-node h-full w-full rounded-2xl border border-dashed"
      style={{
        width: data.width,
        height: data.height,
      }}
    >
      <div className="schema-group-node__label">
        <span>{data.label}</span>
      </div>
    </div>
  ),
);

LabeledGroupNode.displayName = "LabeledGroupNode";

const RelationshipButtonEdge = memo(
  ({ data, selected, ...edgeProps }: EdgeProps<RelationshipEdge>): JSX.Element => {
    const relationship = data?.relationship;
    if (!relationship) {
      return <ButtonEdge {...edgeProps}>{null}</ButtonEdge>;
    }

    const edgeSummary =
      relationship.label?.trim() || "i";
    const buttonLabel =
      edgeSummary.length <= 2 ? edgeSummary : edgeSummary.slice(0, 2);

    return (
      <ButtonEdge {...edgeProps}>
        <Button
          aria-label={`Inspect relationship from ${relationship.source_table}.${relationship.source_column} to ${relationship.target_table}.${relationship.target_column}`}
          className={cn("rounded-full shadow-sm", selected && "ring-2 ring-ring/50")}
          size="icon-xs"
          style={getRelationshipButtonStyles(
            relationship,
            data?.showValidation ?? true,
          )}
          title={getRelationshipIssueTitle(
            relationship,
            data?.showValidation ?? true,
          )}
          variant="outline"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data?.onDetailsRequest?.(relationship.id);
          }}
        >
          {buttonLabel}
        </Button>
      </ButtonEdge>
    );
  },
);

RelationshipButtonEdge.displayName = "RelationshipButtonEdge";

const nodeTypes: NodeTypes = {
  databaseSchema: DatabaseSchemaNode,
  labeledGroup: LabeledGroupNode,
};
const edgeTypes = { relationshipButton: RelationshipButtonEdge };

const SchemaEditorCanvas = ({
  data,
  parentElement,
  setStateValue,
  setTriggerValue,
}: SchemaEditorCanvasProps): JSX.Element => {
  const canvasHeight = data.height ?? 600;
  const groups = data.groups ?? [];
  const editable = data.editable ?? true;
  const connectable = data.connectable ?? true;
  const draggable = data.draggable ?? true;
  const deletable = data.deletable ?? true;
  const showControls = data.show_controls ?? false;
  const showArrowheads = data.show_arrowheads ?? true;
  const showEdgeButton = data.show_edge_button ?? false;
  const showColumnCountBadge = data.show_column_count_badge ?? true;
  const showGroups = data.show_groups ?? true;
  const groupLayout = data.group_layout ?? "manual";
  const groupOrder = data.group_order ?? [];
  const tableLayoutWithinGroup = data.table_layout_within_group ?? "manual";
  const showValidation = data.show_validation ?? true;
  const validationRefreshKey = data.validation_refresh_key ?? null;
  const columnTypeOptions = data.column_type_options ?? [];
  const allowZoom = data.allow_zoom ?? true;
  const allowDuplicateEdges = data.allow_duplicate_edges ?? false;
  const maxConnectionsPerHandle = data.max_connections_per_handle ?? null;
  const maxIncomingConnectionsPerHandle =
    data.max_incoming_connections_per_handle ?? maxConnectionsPerHandle;
  const maxOutgoingConnectionsPerHandle =
    data.max_outgoing_connections_per_handle ?? maxConnectionsPerHandle;

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selected_table_id: null,
    selected_column_id: null,
    selected_relationship_id: null,
  });

  const nodesRef = useRef<SchemaNode[]>([]);
  const edgesRef = useRef<RelationshipEdge[]>([]);
  const selectionRef = useRef<SelectionState>({
    selected_table_id: null,
    selected_column_id: null,
    selected_relationship_id: null,
  });

  const emitEvent = useCallback(
    (event: SchemaEditorEvent, eventContext: EventContext = null) => {
      setStateValue("event_context", eventContext);
      setTriggerValue("event", event);
    },
    [setStateValue, setTriggerValue],
  );

  const updateSelectionState = useCallback(
    (selection: SelectionState) => {
      selectionRef.current = selection;
      setSelectionState(selection);
      setStateValue("selection", selection);
    },
    [setStateValue],
  );

  const handleColumnSelect = useCallback(
    (tableId: string, columnId: string) => {
      const nextSelection: SelectionState = {
        selected_table_id: tableId,
        selected_column_id: columnId,
        selected_relationship_id: null,
      };

      setNodes((currentNodes) => applySelectionToNodes(currentNodes, nextSelection));
      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.selected ? { ...edge, selected: false } : edge,
        ),
      );

      updateSelectionState(nextSelection);
      emitEvent("selection_changed", nextSelection);
    },
    [emitEvent, updateSelectionState],
  );

  const handleColumnCreate = useCallback(
    (tableId: string) => {
      const targetNode = nodesRef.current.find(
        (node): node is DatabaseTableNode =>
          node.id === tableId && isDatabaseTableNode(node),
      );
      if (!targetNode) {
        return;
      }

      const nextColumnId = createColumnId(tableId, targetNode.data.columns);
      const nextColumn: ColumnSpec = {
        id: nextColumnId,
        name: DEFAULT_NEW_COLUMN_NAME,
        data_type: DEFAULT_NEW_COLUMN_TYPE,
      };
      const nextSelection: SelectionState = {
        selected_table_id: tableId,
        selected_column_id: nextColumnId,
        selected_relationship_id: null,
      };
      const nextNodes = applySelectionToNodes(
        nodesRef.current.map((node) =>
          node.id === tableId && isDatabaseTableNode(node)
            ? withUpdatedNodeColumns(node, [...node.data.columns, nextColumn])
            : node,
        ),
        nextSelection,
      );
      const nextEdges = edgesRef.current.map((edge) =>
        edge.selected ? { ...edge, selected: false } : edge,
      );

      setNodes(nextNodes);
      setEdges(nextEdges);
      updateSelectionState(nextSelection);
      setStateValue("groups", nodesToGroups(nextNodes, groups, showGroups));
      setStateValue("tables", nodesToTables(nextNodes));
      emitEvent("column_created", {
        table_id: tableId,
        column_id: nextColumnId,
        column: nextColumn,
      });
    },
    [emitEvent, groups, setStateValue, showGroups, updateSelectionState],
  );

  const handleColumnUpdate = useCallback(
    (
      tableId: string,
      columnId: string,
      updates: Pick<ColumnSpec, "name" | "data_type">,
    ) => {
      const nextNodes = nodesRef.current.map((node) => {
        if (node.id !== tableId || !isDatabaseTableNode(node)) {
          return node;
        }

        const nextColumns = node.data.columns.map((column) =>
          column.id === columnId ? { ...column, ...updates } : column,
        );
        return withUpdatedNodeColumns(node, nextColumns);
      });
      const updatedTableNode = nextNodes.find(
        (node): node is DatabaseTableNode =>
          node.id === tableId && isDatabaseTableNode(node),
      );
      const updatedColumn = updatedTableNode?.data.columns.find(
        (column) => column.id === columnId,
      );
      if (!updatedColumn) {
        return;
      }

      setNodes(nextNodes);
      setStateValue("groups", nodesToGroups(nextNodes, groups, showGroups));
      setStateValue("tables", nodesToTables(nextNodes));
      emitEvent("column_updated", {
        table_id: tableId,
        column_id: columnId,
        column: updatedColumn,
        fields: Object.keys(updates),
      });
    },
    [emitEvent, groups, setStateValue, showGroups],
  );

  const handleColumnDelete = useCallback(
    (tableId: string, columnId: string) => {
      const nextNodes = nodesRef.current.map((node) => {
        if (node.id !== tableId || !isDatabaseTableNode(node)) {
          return node;
        }

        const nextColumns = node.data.columns.filter(
          (column) => column.id !== columnId,
        );
        return withUpdatedNodeColumns(node, nextColumns);
      });
      const deletedRelationshipIds = edgesRef.current
        .map((edge) => edge.data?.relationship)
        .filter(
          (relationship): relationship is RelationshipSpec =>
            relationship !== undefined,
        )
        .filter(
          (relationship) =>
            isRelationshipAttachedToColumn(relationship, tableId, columnId),
        )
        .map((relationship) => relationship.id);
      const nextEdges = edgesRef.current.filter(
        (edge) => !deletedRelationshipIds.includes(edge.id),
      );
      const previousSelection = selectionRef.current;
      const nextSelection: SelectionState = {
        selected_table_id:
          previousSelection.selected_table_id === tableId
            ? tableId
            : previousSelection.selected_table_id,
        selected_column_id:
          previousSelection.selected_table_id === tableId &&
          previousSelection.selected_column_id === columnId
            ? null
            : previousSelection.selected_column_id,
        selected_relationship_id:
          previousSelection.selected_relationship_id &&
          deletedRelationshipIds.includes(previousSelection.selected_relationship_id)
            ? null
            : previousSelection.selected_relationship_id,
      };
      const appliedNodes = applySelectionToNodes(nextNodes, nextSelection);
      const appliedEdges = applySelectionToEdges(
        nextEdges,
        nextSelection.selected_relationship_id,
      );

      setNodes(appliedNodes);
      setEdges(appliedEdges);
      updateSelectionState(nextSelection);
      setStateValue("groups", nodesToGroups(appliedNodes, groups, showGroups));
      setStateValue("tables", nodesToTables(appliedNodes));
      setStateValue("relationships", edgesToRelationships(appliedEdges));
      emitEvent("column_deleted", {
        table_id: tableId,
        column_id: columnId,
        deleted_relationship_ids: deletedRelationshipIds,
      });
    },
    [emitEvent, groups, setStateValue, showGroups, updateSelectionState],
  );

  const resolvedLayouts = useMemo(
    () =>
      resolveGroupLayouts(
        groups,
        data.tables,
        editable,
        groupLayout,
        groupOrder,
        tableLayoutWithinGroup,
      ),
    [data.tables, editable, groupLayout, groupOrder, groups, tableLayoutWithinGroup],
  );

  const incomingNodes = useMemo(
    () =>
      [
        ...(showGroups
          ? groups
              .map((group) => resolvedLayouts.groupLayouts.get(group.id))
              .filter((group): group is ResolvedGroupLayout => Boolean(group))
              .map((group) => groupToNode(group, draggable, groupLayout))
          : []),
        ...data.tables.map((table, index) =>
          tableToNode(
            table,
            index,
            resolvedLayouts.groupLayouts,
            resolvedLayouts.tablePositions,
            showGroups,
            tableLayoutWithinGroup,
            null,
            editable,
            draggable,
            connectable,
            showValidation,
            showColumnCountBadge,
            columnTypeOptions,
            validationRefreshKey,
            handleColumnSelect,
            handleColumnCreate,
            handleColumnUpdate,
            handleColumnDelete,
          ),
        ),
      ],
    [
      connectable,
      columnTypeOptions,
      data.tables,
      editable,
      draggable,
      groupLayout,
      groupOrder,
      groups,
      handleColumnCreate,
      handleColumnDelete,
      handleColumnSelect,
      handleColumnUpdate,
      showColumnCountBadge,
      showGroups,
      showValidation,
      tableLayoutWithinGroup,
      validationRefreshKey,
    ],
  );

  const incomingEdges = useMemo(
    () =>
      data.relationships.map((relationship) =>
        relationshipToEdge(
          relationship,
          showArrowheads,
          showValidation,
          validationRefreshKey,
          undefined,
          showEdgeButton,
        ),
      ),
    [
      data.relationships,
      showArrowheads,
      showEdgeButton,
      showValidation,
      validationRefreshKey,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<SchemaNode>(incomingNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<RelationshipEdge>(incomingEdges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    const themeSource = getThemeSource(parentElement);
    const updateTheme = (): void => {
      const styles = getComputedStyle(themeSource);
      const background =
        styles.getPropertyValue("--st-background-color").trim() ||
        styles.getPropertyValue("--background").trim() ||
        LIGHT_BACKGROUND_FALLBACK;
      const rgb = parseRgb(background);
      if (!rgb) {
        setResolvedTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        return;
      }

      setResolvedTheme(getRelativeLuminance(rgb) < 0.45 ? "dark" : "light");
    };

    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => updateTheme();
    mediaQuery.addEventListener("change", onChange);

    const observer = new MutationObserver(updateTheme);
    observer.observe(themeSource, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    return () => {
      mediaQuery.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, [parentElement]);

  const themeStyle = useMemo(
    () =>
      ({
        "--background": `color-mix(in srgb, var(--st-background-color, ${
          resolvedTheme === "dark"
            ? DARK_BACKGROUND_FALLBACK
            : LIGHT_BACKGROUND_FALLBACK
        }) 84%, var(--st-secondary-background-color, var(--st-background-color, ${
          resolvedTheme === "dark"
            ? DARK_BACKGROUND_FALLBACK
            : LIGHT_BACKGROUND_FALLBACK
        })) 16%)`,
        "--foreground": `var(--st-text-color, ${
          resolvedTheme === "dark" ? "#f5f5f5" : "#18181b"
        })`,
        "--card":
          "color-mix(in srgb, var(--st-background-color, var(--background)) 94%, var(--st-secondary-background-color, var(--background)) 6%)",
        "--secondary":
          "color-mix(in srgb, var(--st-background-color, var(--background)) 56%, var(--st-secondary-background-color, var(--background)) 44%)",
        "--muted":
          "color-mix(in srgb, var(--st-background-color, var(--background)) 58%, var(--st-secondary-background-color, var(--background)) 42%)",
        "--muted-foreground":
          "color-mix(in srgb, var(--foreground) 68%, transparent)",
        "--border":
          "var(--st-border-color, color-mix(in srgb, var(--foreground) 12%, transparent))",
        "--input":
          "var(--st-widget-border-color, var(--st-border-color, var(--border)))",
        "--ring": "var(--st-primary-color, #2563eb)",
        "--primary": "var(--st-primary-color, #2563eb)",
        "--radius": "var(--st-base-radius, 0.75rem)",
        colorScheme: resolvedTheme,
      }) as CSSProperties,
    [resolvedTheme],
  );

  const publishSelection = useCallback(
    (selection: SelectionState) => {
      if (
        selectionRef.current.selected_table_id === selection.selected_table_id &&
        selectionRef.current.selected_column_id === selection.selected_column_id &&
        selectionRef.current.selected_relationship_id ===
          selection.selected_relationship_id
      ) {
        return;
      }

      updateSelectionState(selection);
      emitEvent("selection_changed", selection);
    },
    [emitEvent, updateSelectionState],
  );

  const publishRelationships = useCallback(
    (
      nextEdges: RelationshipEdge[],
      event: SchemaEditorEvent,
      eventContext: EventContext = null,
    ) => {
      setStateValue("relationships", edgesToRelationships(nextEdges));
      emitEvent(event, eventContext);
    },
    [emitEvent, setStateValue],
  );

  const publishNodeState = useCallback(
    (nextNodes: SchemaNode[]) => {
      setStateValue("groups", nodesToGroups(nextNodes, groups, showGroups));
      setStateValue("tables", nodesToTables(nextNodes));
    },
    [groups, setStateValue, showGroups],
  );

  const publishTables = useCallback(
    (
      nextNodes: SchemaNode[],
      event: SchemaEditorEvent = "node_moved",
      eventContext: EventContext = null,
    ) => {
      publishNodeState(nextNodes);
      emitEvent(event, eventContext);
    },
    [emitEvent, publishNodeState],
  );

  const handleRelationshipDetailsRequest = useCallback(
    (relationshipId: string) => {
      const nextSelection: SelectionState = {
        selected_table_id: null,
        selected_column_id: null,
        selected_relationship_id: relationshipId,
      };

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.selected ? { ...node, selected: false } : node,
        ),
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({
          ...attachDetailsHandler(edge, handleRelationshipDetailsRequest),
          selected: edge.id === relationshipId,
        })),
      );
      updateSelectionState(nextSelection);
      emitEvent("edge_details_requested", {
        relationship_id: relationshipId,
      });
    },
    [emitEvent, updateSelectionState],
  );

  useEffect(() => {
    const nextNodes = applySelectionToNodes(incomingNodes, selectionRef.current);

    startTransition(() => {
      setNodes((currentNodes) =>
        areNodesEquivalent(currentNodes, nextNodes) ? currentNodes : nextNodes,
      );
    });
  }, [incomingNodes, setNodes]);

  useEffect(() => {
    const nextEdges = applySelectionToEdges(
      incomingEdges,
      selectionRef.current.selected_relationship_id,
      showEdgeButton ? handleRelationshipDetailsRequest : undefined,
    );

    startTransition(() => {
      setEdges((currentEdges) =>
        areEdgesEquivalent(currentEdges, nextEdges) ? currentEdges : nextEdges,
      );
    });
  }, [handleRelationshipDetailsRequest, incomingEdges, setEdges, showEdgeButton]);

  useEffect(() => {
    setNodes((currentNodes) => applySelectionToNodes(currentNodes, selectionState));
    setEdges((currentEdges) =>
      applySelectionToEdges(
        currentEdges,
        selectionState.selected_relationship_id,
        showEdgeButton ? handleRelationshipDetailsRequest : undefined,
      ),
    );
  }, [handleRelationshipDetailsRequest, selectionState, setEdges, setNodes, showEdgeButton]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const relationship = connectionToRelationship(connection);
      if (!relationship) {
        emitEvent("relationship_rejected", { reason: "invalid_connection" });
        return;
      }

      const duplicateEdges = edgesRef.current.filter(
        (edge) => edge.id === relationship.id,
      );
      if (!allowDuplicateEdges && duplicateEdges.length > 0) {
        emitEvent("relationship_rejected", {
          reason: "duplicate_relationship",
          relationship_id: relationship.id,
          relationship,
        });
        return;
      }

      const sourceEdgeCount = edgesRef.current.filter(
        (edge) =>
          edge.source === relationship.source_table &&
          edge.sourceHandle === sourceHandleId(relationship.source_column),
      ).length;
      if (
        maxOutgoingConnectionsPerHandle !== null &&
        sourceEdgeCount >= maxOutgoingConnectionsPerHandle
      ) {
        emitEvent("relationship_rejected", {
          reason: "max_outgoing_connections_per_handle",
          relationship,
          limit: maxOutgoingConnectionsPerHandle,
          direction: "outgoing",
        });
        return;
      }

      const targetEdgeCount = edgesRef.current.filter(
        (edge) =>
          edge.target === relationship.target_table &&
          edge.targetHandle === targetHandleId(relationship.target_column),
      ).length;
      if (
        maxIncomingConnectionsPerHandle !== null &&
        targetEdgeCount >= maxIncomingConnectionsPerHandle
      ) {
        emitEvent("relationship_rejected", {
          reason: "max_incoming_connections_per_handle",
          relationship,
          limit: maxIncomingConnectionsPerHandle,
          direction: "incoming",
        });
        return;
      }

      const nextRelationship = {
        ...relationship,
        id:
          duplicateEdges.length === 0
            ? relationship.id
            : `${relationship.id}::${duplicateEdges.length + 1}`,
      };
      const nextEdges = addEdge(
        relationshipToEdge(
          nextRelationship,
          showArrowheads,
          showValidation,
          validationRefreshKey,
          showEdgeButton ? handleRelationshipDetailsRequest : undefined,
          showEdgeButton,
        ),
        edgesRef.current,
      ) as RelationshipEdge[];

      setEdges(nextEdges);
      publishRelationships(nextEdges, "relationship_created", {
        relationship_id: nextRelationship.id,
        relationship: nextRelationship,
      });
      updateSelectionState({
        selected_table_id: null,
        selected_column_id: null,
        selected_relationship_id: nextRelationship.id,
      });
    },
    [
      allowDuplicateEdges,
      emitEvent,
      handleRelationshipDetailsRequest,
      maxIncomingConnectionsPerHandle,
      maxOutgoingConnectionsPerHandle,
      publishRelationships,
      showArrowheads,
      showEdgeButton,
      showValidation,
      validationRefreshKey,
      updateSelectionState,
    ],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
      const nextEdges = edgesRef.current.filter((edge) => !deletedIds.has(edge.id));
      setEdges(nextEdges);
      publishRelationships(nextEdges, "relationship_deleted", {
        relationship_ids: deletedEdges.map((edge) => edge.id),
      });
      updateSelectionState({
        selected_table_id: null,
        selected_column_id: null,
        selected_relationship_id: null,
      });
    },
    [publishRelationships, updateSelectionState],
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedTableIds = deletedNodes
        .filter((node) => node.type === "databaseSchema")
        .map((node) => node.id);
      const deletedNodeIds = new Set(deletedTableIds);
      const nextNodes = nodesRef.current.filter((node) => !deletedNodeIds.has(node.id));
      const nextEdges = edgesRef.current.filter(
        (edge) =>
          !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target),
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      publishNodeState(nextNodes);
      setStateValue("relationships", edgesToRelationships(nextEdges));
      updateSelectionState({
        selected_table_id: null,
        selected_column_id: null,
        selected_relationship_id: null,
      });
      emitEvent("table_deleted", {
        table_ids: deletedTableIds,
      });
    },
    [emitEvent, publishNodeState, setEdges, setNodes, setStateValue, updateSelectionState],
  );

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) =>
      publishSelection(
        buildSelection(selectedNodes, selectedEdges, selectionRef.current),
      ),
    [publishSelection],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, movedNode: Node) => {
      const absolutePosition = getNodeAbsolutePosition(movedNode, nodesRef.current);
      publishTables(nodesRef.current, "node_moved", {
        ...(movedNode.type === "labeledGroup"
          ? { group_id: movedNode.id, node_type: "group" }
          : { table_id: movedNode.id, node_type: "table" }),
        position: absolutePosition,
      });
    },
    [publishTables],
  );

  return (
    <div
      className={`${resolvedTheme === "dark" ? "dark " : ""}schema-editor-frame w-full overflow-hidden rounded-xl border border-border bg-background`}
      data-theme-mode={resolvedTheme}
      style={{
        ...themeStyle,
        height: `${canvasHeight}px`,
        border: "1px solid var(--border)",
      }}
    >
      <ReactFlow
        className="schema-editor-flow bg-background"
        fitView={data.fit_view ?? true}
        fitViewOptions={FIT_VIEW_OPTIONS}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: "inherit",
        }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connectable ? onConnect : undefined}
        onEdgesDelete={deletable ? onEdgesDelete : undefined}
        onNodesDelete={deletable ? onNodesDelete : undefined}
        onSelectionChange={onSelectionChange}
        onNodeDragStop={draggable ? onNodeDragStop : undefined}
        deleteKeyCode={deletable ? DELETE_KEY_CODES : DISABLED_DELETE_KEY_CODES}
        nodesConnectable={connectable}
        nodesDraggable={draggable}
        elementsSelectable
        onlyRenderVisibleElements
        selectionOnDrag={false}
        snapToGrid
        snapGrid={SNAP_GRID}
        zoomOnDoubleClick={allowZoom}
        zoomOnScroll={allowZoom}
        zoomOnPinch={allowZoom}
        elevateEdgesOnSelect
      >
        <Background
          className="bg-background"
          color="var(--border)"
          gap={36}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        {showControls ? <Controls showInteractive={false} /> : null}
      </ReactFlow>
    </div>
  );
};

export default SchemaEditorCanvas;
