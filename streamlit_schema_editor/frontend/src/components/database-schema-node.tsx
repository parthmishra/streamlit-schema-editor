import React, { type ComponentProps, type ReactNode } from "react";

import { BaseNode, BaseNodeContent, BaseNodeHeader } from "./base-node";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { cn } from "../lib/utils";

export type DatabaseSchemaNodeHeaderProps = React.ComponentProps<"header">;

export const DatabaseSchemaNodeHeader = ({
  children,
  className,
  ...props
}: DatabaseSchemaNodeHeaderProps) => {
  return (
    <BaseNodeHeader
      className={cn(
        "rounded-t-xl bg-secondary p-2 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    >
      <h2>{children}</h2>
    </BaseNodeHeader>
  );
};

export type DatabaseSchemaNodeBodyProps = {
  children?: ReactNode;
};

export const DatabaseSchemaNodeBody = ({
  children,
}: DatabaseSchemaNodeBodyProps) => {
  return (
    <BaseNodeContent className="p-0">
      <table className="w-full border-separate border-spacing-0 overflow-visible">
        <TableBody>{children}</TableBody>
      </table>
    </BaseNodeContent>
  );
};

export type DatabaseSchemaTableRowProps = React.ComponentProps<"tr">;

export const DatabaseSchemaTableRow = ({
  children,
  className,
  ...props
}: DatabaseSchemaTableRowProps) => {
  return (
    <TableRow className={`relative text-xs ${className || ""}`} {...props}>
      {children}
    </TableRow>
  );
};

export type DatabaseSchemaTableCellProps = React.ComponentProps<"td">;

export const DatabaseSchemaTableCell = ({
  className,
  children,
  ...props
}: DatabaseSchemaTableCellProps) => {
  return (
    <TableCell className={className} {...props}>
      {children}
    </TableCell>
  );
};

export type DatabaseSchemaNodeProps = ComponentProps<"div">;

export const DatabaseSchemaNode = ({
  className,
  children,
  ...props
}: DatabaseSchemaNodeProps) => {
  return (
    <BaseNode className={className} {...props}>
      {children}
    </BaseNode>
  );
};
