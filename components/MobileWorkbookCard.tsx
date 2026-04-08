"use client";

import { useLayoutEffect, useRef } from "react";
import type { GridCell } from "@/lib/grid-types";

type Props = {
  grid: GridCell[][];
  headerRow: number;
  activeRow: number;
  activeCol: number;
  isRowContentLocked: (excelRow: number) => boolean;
  onCellClick: (excelRow: number, excelCol: number, isHeaderRow: boolean) => void;
  onDataCellChange: (text: string) => void;
  onDataCellKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  dirtyRows: ReadonlySet<number>;
  savedRows: ReadonlySet<number>;
  savingRow: number | null;
  onSaveRow: (excelRow: number) => void;
  onEditRow: (excelRow: number) => void;
  scrollRequest?: { excelRow: number; nonce: number } | null;
  className?: string;
  onNavRow: (delta: 1 | -1) => void;
};

export function MobileWorkbookCard({
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
  onNavRow,
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

  const hi = headerRow - 1;
  const headers = grid[hi] || [];

  return (
    <div
      ref={scrollRootRef}
      className={`rounded-lg bg-slate-950/20 ${className}`}
    >
      <div className="flex flex-col gap-4 p-1 pb-4">
        {grid.map((row, ri) => {
          const excelRow = ri + 1;
          const isDataRow = excelRow > headerRow;
          // Skip header row and any row that is not the currently active row
          if (!isDataRow || excelRow !== activeRow) {
            return null;
          }

          const dirty = dirtyRows.has(excelRow);
          const saved = savedRows.has(excelRow);
          const rowBusy = savingRow === excelRow;
          const contentLocked = isRowContentLocked(excelRow);

          return (
            <div
              key={ri}
              data-excel-row={excelRow}
              className={`flex flex-col rounded-xl border overflow-hidden shadow-sm ${
                saved && !dirty
                  ? "bg-emerald-950/10 border-emerald-900/50"
                  : dirty
                    ? "bg-amber-950/20 border-amber-900/50"
                    : "bg-slate-900/50 border-slate-700"
              } ${contentLocked ? "ring-1 ring-inset ring-slate-500/20" : ""}`}
            >
              {/* TOP ACTION BAR */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 px-3 py-2 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={excelRow <= headerRow + 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavRow(-1);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 outline-none active:bg-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    &lt;
                  </button>
                  <span className="text-sm font-bold text-slate-200">
                    Row {excelRow}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavRow(1);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-200 hover:bg-slate-600 outline-none active:bg-slate-500"
                  >
                    &gt;
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 text-xs">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditRow(excelRow);
                    }}
                    className={`rounded-md border px-4 py-1.5 font-medium disabled:opacity-50 ${
                      contentLocked
                        ? "border-sky-500/60 bg-sky-950/40 text-sky-100 hover:bg-sky-900/50"
                        : "border-slate-500 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={!dirty || rowBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveRow(excelRow);
                    }}
                    className="rounded-md bg-emerald-700 px-4 py-1.5 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {rowBusy ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {/* REMAINING BODY: Vertical Columns */}
              <div className="flex flex-col divide-y divide-slate-800/60 p-1 bg-slate-900/30">
                {row.map((cell, ci) => {
                  const excelCol = ci + 1;
                  const isActive = excelRow === activeRow && excelCol === activeCol;
                  const display = cell === null || cell === undefined ? "" : String(cell);
                  const editable = isActive && !contentLocked;
                  const headerTitle = String(headers[ci] || `Column ${excelCol}`);

                  return (
                    <div 
                      key={ci}
                      onClick={() => onCellClick(excelRow, excelCol, false)}
                      className={`flex flex-col px-3 py-2 transition-colors cursor-pointer ${
                        isActive
                          ? "bg-blue-950/40 ring-2 ring-inset ring-blue-500/70 rounded-md my-0.5"
                          : "hover:bg-slate-800/40"
                      }`}
                    >
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate block px-1">
                        {headerTitle.trim() === "" ? `Column ${excelCol}` : headerTitle}
                      </label>

                      {editable ? (
                        <input
                          type="text"
                          autoFocus
                          aria-label={`Cell R${excelRow}C${excelCol}`}
                          className="box-border w-full min-w-0 rounded bg-slate-950 px-2 py-1.5 text-base sm:text-sm text-slate-100 outline-none ring-1 ring-blue-500 placeholder:text-slate-600 focus:bg-slate-900"
                          value={display}
                          onChange={(e) => onDataCellChange(e.target.value)}
                          onKeyDown={onDataCellKeyDown}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={`line-clamp-3 block min-h-[1.5rem] break-words px-2 font-medium ${
                            contentLocked
                              ? "text-slate-400"
                              : "text-slate-200"
                          }`}
                        >
                          {display}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
