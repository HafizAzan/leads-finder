"use client";
import React from "react";
import Checkbox from "./checkbox";
import { TableProps } from "@/app/data/leads-data";

function Table<T extends Record<string, unknown>>({ columns, data, selectedRows, setSelectedRows }: TableProps<T>) {
  const allRowsSelected = data?.length > 0 && selectedRows?.length === data?.length;
  const someSelectedRows = data?.length > 0 && selectedRows?.length! > 0 && selectedRows?.length! < data?.length;

  const toggleAll = () => {
    if (allRowsSelected) {
      setSelectedRows?.([]);
    } else {
      setSelectedRows?.(data?.map((row) => row.id as number) || []);
    }
  };

  const specificRow = (id: number) => {
    setSelectedRows?.((prev) => {
      if (prev?.includes(id)) {
        return prev?.filter((rowID) => rowID !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-175 text-left">
          <thead>
            <tr className="border-b border-border bg-sidebar">
              {columns.map((column) => {
                if (column.isCheckbox) {
                  return (
                    <th key={String(column.key)} className="w-12 px-4 py-3">
                      <Checkbox checked={allRowsSelected} indeterminate={someSelectedRows} onChange={toggleAll} />
                    </th>
                  );
                }

                return (
                  <th key={String(column.key)} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap">
                    {column.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="border-b border-border last:border-0 transition-colors hover:bg-sidebar/60">
                {columns.map((column) => {
                  if (column.isCheckbox) {
                    return (
                      <td key={String(column.key)} className="w-12 px-4 py-3">
                        <Checkbox checked={selectedRows?.includes(row?.id as number)} onChange={() => specificRow(row?.id as number)} />
                      </td>
                    );
                  }

                  if (column.isActions) {
                    return (
                      <td key={String(column.key)} className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {column.cell?.(row)}
                      </td>
                    );
                  }

                  if (row?.[column.key] && typeof row?.[column.key] === "object" && React.isValidElement(row?.[column.key])) {
                    return (
                      <td key={String(column.key)} className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {row?.[column.key] as React.ReactNode}
                      </td>
                    );
                  }

                  return (
                    <td key={String(column.key)} className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {String(row[column.key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(Table);
