"use client";
import React, { useMemo } from "react";
import Checkbox from "./checkbox";
import { RowId, TableProps } from "@/app/data/leads-data";

function Table<T extends { id: RowId }>({
  columns,
  data,
  selectedRows,
  setSelectedRows,
  isRowSelectable,
}: TableProps<T>) {
  const selectableIds = useMemo(() => {
    return (data || [])
      .filter((row) => (isRowSelectable ? isRowSelectable(row) : true))
      .map((row) => row.id);
  }, [data, isRowSelectable]);

  const selectedOnPage = selectableIds.filter((id) => selectedRows?.includes(id));
  const allRowsSelected = selectableIds.length > 0 && selectedOnPage.length === selectableIds.length;
  const someSelectedRows =
    selectableIds.length > 0 && selectedOnPage.length > 0 && selectedOnPage.length < selectableIds.length;

  const toggleAll = () => {
    if (allRowsSelected) {
      setSelectedRows?.((prev) => prev.filter((id) => !selectableIds.includes(id)));
    } else {
      setSelectedRows?.((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.add(id));
        return [...next];
      });
    }
  };

  const specificRow = (id: RowId, selectable: boolean) => {
    if (!selectable) return;
    setSelectedRows?.((prev) => {
      if (prev?.includes(id)) return prev?.filter((rowID) => rowID !== id);
      return [...prev, id];
    });
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="-mx-px w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-175 text-left">
          <thead>
            <tr className="border-b border-border bg-sidebar">
              {columns.map((column) => {
                if (column.isCheckbox) {
                  return (
                    <th key={String(column.key)} className="sticky left-0 z-10 w-12 bg-sidebar px-3 py-3 sm:px-4">
                      <Checkbox
                        checked={allRowsSelected}
                        indeterminate={someSelectedRows}
                        onChange={toggleAll}
                        disabled={selectableIds.length === 0}
                      />
                    </th>
                  );
                }

                return (
                  <th
                    key={String(column.key)}
                    className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap sm:px-4"
                  >
                    {column.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {data.map((row) => {
              const selectable = isRowSelectable ? isRowSelectable(row) : true;

              return (
                <tr
                  key={String(row.id)}
                  className={`group border-b border-border last:border-0 transition-colors hover:bg-sidebar/60 ${
                    selectable ? "" : "opacity-60"
                  }`}
                >
                  {columns.map((column) => {
                    if (column.isCheckbox) {
                      return (
                        <td
                          key={String(column.key)}
                          className="sticky left-0 z-10 w-12 bg-card px-3 py-3 transition-colors group-hover:bg-sidebar/60 sm:px-4"
                        >
                          <Checkbox
                            checked={Boolean(selectedRows?.includes(row.id))}
                            onChange={() => specificRow(row.id, selectable)}
                            disabled={!selectable}
                          />
                        </td>
                      );
                    }

                    if (column.cell) {
                      return (
                        <td key={String(column.key)} className="px-3 py-3 text-sm text-foreground whitespace-nowrap sm:px-4">
                          {column.cell(row)}
                        </td>
                      );
                    }

                    const value = row[column.key as keyof T];
                    return (
                      <td key={String(column.key)} className="px-3 py-3 text-sm text-foreground whitespace-nowrap sm:px-4">
                        {value == null ? "—" : String(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(Table) as typeof Table;
