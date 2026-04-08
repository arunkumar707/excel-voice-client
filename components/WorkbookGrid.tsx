"use client";

import { useLayoutEffect, useRef } from "react";
import type { GridCell } from "@/lib/grid-types";

type Props = {
  grid: GridCell[][];
  headerRow: number;
  activeRow: number;
  activeCol: number;
  /** When true, row has every data cell filled and is read-only until Edit. */
  isRowContentLocked: (excelRow: number) => boolean;
  onCellClick: (excelRow: number, excelCol: number, isHeaderRow: boolean) => void;
  onDataCellChange: (text: string) => void;
  onDataCellKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dirtyRows: ReadonlySet<number>;
  savedRows: ReadonlySet<number>;
  savingRow: number | null;
  onSaveRow: (excelRow: number) => void;
  onEditRow: (excelRow: number) => void;
  /** When set, scrolls that Excel row into view inside the grid (e.g. after search). */
  scrollRequest?: { excelRow: number; nonce: number } | null;
  className?: string;
};

export function WorkbookGrid({
  grid,
  headerRow,
  activeRow,
  activeCol,
  isRowContentLocked,
  onCellClick,
  onDataCellChange,
  onDataCellKeyDown,
  dirtyRows,
  savedRows,
  savingRow,
  onSaveRow,
  onEditRow,
  scrollRequest = null,
  className = "",
}: Props) {
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scrollRequest) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const el = root.querySelector(
      `[data-excel-row="${scrollRequest.excelRow}"]`
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [scrollRequest]);

  return (
    <div
      ref={scrollRootRef}
      className={`min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-lg border border-slate-600 bg-slate-950/50 [scrollbar-gutter:stable] ${className}`}
    >
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <tbody>
          {grid.map((row, ri) => {
            const excelRow = ri + 1;
            const isHeaderLine = excelRow === headerRow;
            const isDataRow = excelRow > headerRow;
            const dirty = dirtyRows.has(excelRow);
            const saved = savedRows.has(excelRow);
            const rowBusy = savingRow === excelRow;
            const contentLocked = isDataRow && isRowContentLocked(excelRow);

            return (
              <tr
                key={ri}
                data-excel-row={excelRow}
                className={`${
                  isHeaderLine ? "sticky top-0 z-10 bg-slate-800 shadow-md" : ""
                } ${
                  isDataRow && saved && !dirty
                    ? "bg-emerald-950/25"
                    : isDataRow && dirty
                      ? "bg-amber-950/20"
                      : "even:bg-slate-950/30"
                } ${
                  contentLocked
                    ? "ring-1 ring-inset ring-slate-500/35"
                    : ""
                }`}
              >
                {row.map((cell, ci) => {
                  const excelCol = ci + 1;
                  const isActive = excelRow === activeRow && excelCol === activeCol;
                  const display =
                    cell === null || cell === undefined ? "" : String(cell);
                  const editable = isDataRow && isActive && !contentLocked;
                  return (
                    <td
                      key={ci}
                      role="gridcell"
                      tabIndex={-1}
                      onClick={() =>
                        onCellClick(excelRow, excelCol, isHeaderLine)
                      }
                      className={`border border-slate-700/90 px-1 py-1 align-middle text-slate-200 ${
                        isHeaderLine ? "px-2 py-2 font-semibold text-slate-50" : ""
                      } ${
                        isActive
                          ? "bg-blue-950/90 ring-2 ring-blue-500 ring-inset"
                          : ""
                      }`}
                    >
                      {isHeaderLine || !isDataRow ? (
                        <span className="line-clamp-3 block break-words px-1 py-1">
                          {display}
                        </span>
                      ) : editable ? (
                        <input
                          type="text"
                          autoFocus
                          aria-label={`Cell R${excelRow}C${excelCol}`}
                          className="box-border w-full min-w-0 rounded bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-600 focus:bg-slate-900"
                          value={display}
                          onChange={(e) => onDataCellChange(e.target.value)}
                          onKeyDown={onDataCellKeyDown}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`line-clamp-3 block min-h-[2.25rem] break-words px-2 py-1.5 ${
                            contentLocked
                              ? "cursor-default text-slate-300/90"
                              : "cursor-text"
                          }`}
                          title={
                            contentLocked
                              ? "All columns filled — click Edit to change this row"
                              : undefined
                          }
                        >
                          {display}
                        </span>
                      )}
                    </td>
                  );
                })}
                {isHeaderLine ? (
                  <>
                    <td className="sticky top-0 z-10 w-[5.5rem] border border-slate-600 bg-slate-800 px-1 py-2 text-center text-xs font-semibold text-slate-200">
                      Save
                    </td>
                    <td className="sticky top-0 z-10 w-[5rem] border border-slate-600 bg-slate-800 px-1 py-2 text-center text-xs font-semibold text-slate-200">
                      Edit
                    </td>
                  </>
                ) : isDataRow ? (
                  <>
                    <td className="w-[5.5rem] border border-slate-700/90 px-1 py-1 align-middle">
                      <button
                        type="button"
                        disabled={!dirty || rowBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSaveRow(excelRow);
                        }}
                        className="w-full rounded-md bg-emerald-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {rowBusy ? "…" : "Save"}
                      </button>
                    </td>
                    <td className="w-[5rem] border border-slate-700/90 px-1 py-1 align-middle">
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRow(excelRow);
                        }}
                        className={`w-full rounded-md border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${
                          contentLocked
                            ? "border-sky-500/60 bg-sky-950/40 text-sky-100 hover:bg-sky-900/50"
                            : "border-slate-500 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        }`}
                      >
                        Edit
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border border-slate-700/90 bg-slate-900/50" />
                    <td className="border border-slate-700/90 bg-slate-900/50" />
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
