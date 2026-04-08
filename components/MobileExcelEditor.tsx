"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { MobileWorkbookCard } from "@/components/MobileWorkbookCard";
import type { GridCell } from "@/lib/grid-types";
import { GRID_MAX_DATA_ROWS, GRID_MIN_DATA_ROWS } from "@/lib/grid-rows";
import { clearAccessToken, nestFetch } from "@/lib/nest-auth-fetch";
import type { VoiceIntent } from "@/lib/voice-intent";
import { applyColVoiceFilter, detectColKind, needsServerFilter } from "@/lib/column-voice-filter";

type WorkbookState = {
  grid: GridCell[][];
  sheetName: string;
  headerRow: number;
  activeRow: number;
  activeCol: number;
};

type Action =
  | {
      type: "LOAD";
      payload: {
        grid: GridCell[][];
        sheetName: string;
        headerRow: number;
      };
    }
  | { type: "SET_ACTIVE"; row: number; col: number }
  | { type: "NEXT_ROW" }
  | { type: "NEXT_COLUMN" }
  | { type: "NAV_ROW"; delta: 1 | -1 }
  | { type: "NAV_COL"; delta: 1 | -1 }
  | { type: "FILL_VALUE"; value: string; advance: "row" | "column" }
  | { type: "SET_ACTIVE_CELL_TEXT"; text: string }
  | { type: "CLEAR_ACTIVE_CELL" };

function colWidth(grid: GridCell[][]): number {
  return Math.max(1, ...grid.map((r) => r.length));
}

function padRow(row: GridCell[], width: number): GridCell[] {
  const next = [...row];
  while (next.length < width) next.push(null);
  return next;
}

function padGridMinDataRows(
  grid: GridCell[][],
  headerRow: number,
  width: number
): GridCell[][] {
  const minTotal = headerRow + GRID_MIN_DATA_ROWS;
  const maxTotal = headerRow + GRID_MAX_DATA_ROWS;
  let g = grid.map((r) => padRow(r, width));
  while (g.length < minTotal) {
    g = [...g, Array(width).fill(null)];
  }
  if (g.length > maxTotal) {
    g = g.slice(0, maxTotal);
  }
  return g;
}

function cellMatchesSearch(
  cell: GridCell,
  query: string,
  columnIndex: number
): boolean {
  const raw = query.trim();
  if (raw === "") return false;
  if (cell === null || cell === undefined) return false;
  const t = String(cell).trim();
  if (t === "") return false;
  if (columnIndex === 0) {
    const q = raw.toLowerCase();
    if (t.toLowerCase() === q) return true;
    const cn = Number(t);
    const qn = Number(raw);
    if (Number.isFinite(cn) && Number.isFinite(qn) && cn === qn) return true;
    return false;
  }
  return t.toLowerCase().includes(raw.toLowerCase());
}

function reducer(state: WorkbookState, action: Action): WorkbookState {
  const w = colWidth(state.grid);

  switch (action.type) {
    case "LOAD": {
      const { grid, sheetName, headerRow } = action.payload;
      const cw = colWidth(grid);
      const normalized = padGridMinDataRows(
        grid.map((r) => padRow(r, cw)),
        headerRow,
        cw
      );
      return {
        grid: normalized,
        sheetName,
        headerRow,
        activeRow: headerRow + 1,
        activeCol: 1,
      };
    }
    case "SET_ACTIVE":
      return { ...state, activeRow: action.row, activeCol: action.col };
    case "NEXT_ROW": {
      const maxExcelRow = state.headerRow + GRID_MAX_DATA_ROWS;
      const width = colWidth(state.grid);
      let nextRow = state.activeRow + 1;
      let nextCol = state.activeCol;
      if (nextRow > maxExcelRow) {
        nextRow = state.headerRow + 1;
        nextCol = Math.min(nextCol + 1, width);
      }
      let nextGrid = state.grid;
      while (nextGrid.length < nextRow) {
        nextGrid = [...nextGrid, Array(width).fill(null)];
      }
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;
      if (nextGrid.length > maxTotalLen) {
        nextGrid = nextGrid.slice(0, maxTotalLen);
      }
      return { ...state, grid: nextGrid, activeRow: nextRow, activeCol: nextCol };
    }
    case "NAV_ROW": {
      const maxExcelRow = state.headerRow + GRID_MAX_DATA_ROWS;
      let next = state.activeRow + action.delta;
      next = Math.max(state.headerRow + 1, Math.min(next, maxExcelRow));
      let g = state.grid.map((row) => padRow([...row], w));
      while (g.length < next) {
        g = [...g, Array(w).fill(null)];
      }
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;
      if (g.length > maxTotalLen) g = g.slice(0, maxTotalLen);
      return { ...state, grid: g, activeRow: next, activeCol: state.activeCol };
    }
    case "NAV_COL": {
      const width = colWidth(state.grid);
      const nextCol = Math.max(
        1,
        Math.min(state.activeCol + action.delta, width)
      );
      return { ...state, activeCol: nextCol };
    }
    case "NEXT_COLUMN": {
      const width = colWidth(state.grid);
      const maxExcelRow = state.headerRow + GRID_MAX_DATA_ROWS;
      let nextCol = state.activeCol + 1;
      let nextRow = state.activeRow;
      if (nextCol > width) {
        nextCol = 1;
        nextRow = nextRow + 1;
      }
      if (nextRow > maxExcelRow) {
        nextRow = maxExcelRow;
      }
      let nextGrid = state.grid;
      while (nextGrid.length < nextRow) {
        nextGrid = [...nextGrid, Array(width).fill(null)];
      }
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;
      if (nextGrid.length > maxTotalLen) {
        nextGrid = nextGrid.slice(0, maxTotalLen);
      }
      return { ...state, grid: nextGrid, activeCol: nextCol, activeRow: nextRow };
    }
    case "FILL_VALUE": {
      const { activeRow, activeCol } = state;
      const r = activeRow - 1;
      const c = activeCol - 1;
      const width = Math.max(w, c + 1);
      let g = state.grid.map((row) => padRow([...row], width));
      while (g.length <= r) {
        g = [...g, Array(width).fill(null)];
      }
      const row = padRow([...g[r]], width);
      row[c] = action.value;
      g[r] = row;
      const maxExcelRow = state.headerRow + GRID_MAX_DATA_ROWS;
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;

      if (action.advance === "column") {
        let nextCol = activeCol + 1;
        let nextRow = activeRow;
        if (nextCol > width) {
          nextCol = 1;
          nextRow = activeRow + 1;
        }
        if (nextRow > maxExcelRow) nextRow = maxExcelRow;
        while (g.length < nextRow) {
          g = [...g, Array(width).fill(null)];
        }
        if (g.length > maxTotalLen) g = g.slice(0, maxTotalLen);
        return { ...state, grid: g, activeRow: nextRow, activeCol: nextCol };
      }

      let nextRow = activeRow + 1;
      let nextCol = activeCol;
      if (nextRow > maxExcelRow) {
        nextRow = state.headerRow + 1;
        nextCol = Math.min(activeCol + 1, width);
      }
      while (g.length < nextRow) {
        g = [...g, Array(width).fill(null)];
      }
      if (g.length > maxTotalLen) g = g.slice(0, maxTotalLen);
      return { ...state, grid: g, activeRow: nextRow, activeCol: nextCol };
    }
    case "SET_ACTIVE_CELL_TEXT": {
      const { activeRow, activeCol } = state;
      const r = activeRow - 1;
      const c = activeCol - 1;
      const width = Math.max(w, c + 1);
      let g = state.grid.map((row) => padRow([...row], width));
      while (g.length <= r) {
        g = [...g, Array(width).fill(null)];
      }
      const row = padRow([...g[r]], width);
      const num = Number(action.text);
      row[c] =
        action.text.trim() === ""
          ? null
          : Number.isFinite(num) &&
              action.text.trim() !== "" &&
              /^-?\d+(\.\d+)?$/.test(action.text.trim())
            ? num
            : action.text;
      g[r] = row;
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;
      if (g.length > maxTotalLen) g = g.slice(0, maxTotalLen);
      return { ...state, grid: g };
    }
    case "CLEAR_ACTIVE_CELL": {
      const { activeRow, activeCol } = state;
      const r = activeRow - 1;
      const c = activeCol - 1;
      const width = Math.max(w, c + 1);
      let g = state.grid.map((row) => padRow([...row], width));
      while (g.length <= r) {
        g = [...g, Array(width).fill(null)];
      }
      const row = padRow([...g[r]], width);
      row[c] = null;
      g[r] = row;
      const maxTotalLen = state.headerRow + GRID_MAX_DATA_ROWS;
      if (g.length > maxTotalLen) g = g.slice(0, maxTotalLen);
      return { ...state, grid: g };
    }
    default:
      return state;
  }
}

const initialState: WorkbookState = {
  grid: [],
  sheetName: "",
  headerRow: 1,
  activeRow: 1,
  activeCol: 1,
};

type Props = { workbookId: number; workbookName: string };

export function MobileExcelEditor({ workbookId, workbookName }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const skipFirstSave = useRef(true);
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [savedRows, setSavedRows] = useState<Set<number>>(new Set());
  /** Rows the user opened with Edit; cleared on Save so complete rows lock again. */
  const [unlockedRows, setUnlockedRows] = useState<Set<number>>(new Set());
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [rowBackendError, setRowBackendError] = useState<string | null>(null);
  const [searchCol, setSearchCol] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{
    excelRow: number;
    nonce: number;
  } | null>(null);
  /** Where to move the active cell after voice (or Enter) fills a value. */
  const [voiceAdvance, setVoiceAdvance] = useState<"row" | "column">("row");
  const [showLockedPopup, setShowLockedPopup] = useState(false);

  const triggerLockedPopup = useCallback(() => {
    setShowLockedPopup(true);
    setTimeout(() => setShowLockedPopup(false), 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    skipFirstSave.current = true;
    (async () => {
      try {
        const res = await nestFetch<{
          error?: string;
          grid?: GridCell[][];
          sheetName?: string;
          headerRow?: number;
        }>(`/excel-workbooks/${workbookId}/grid`);
        if (cancelled) return;
        dispatch({
          type: "LOAD",
          payload: {
            grid: res.data.grid ?? [],
            sheetName: res.data.sheetName ?? "",
            headerRow: res.data.headerRow ?? 1,
          },
        });
        setDirtyRows(new Set());
        setSavedRows(new Set());
        setUnlockedRows(new Set());
        setHydrated(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workbookId]);

  useEffect(() => {
    if (!hydrated || state.grid.length === 0) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      setSaveStatus("saving");
      void (async () => {
        try {
          const res = await nestFetch(`/excel-workbooks/${workbookId}/grid`, {
            method: "put",
            data: { grid: state.grid },
          });
          void res; // axios throws on non-2xx
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 1500);
        } catch {
          setSaveStatus("error");
        }
      })();
    }, 500);
    return () => clearTimeout(t);
  }, [state.grid, hydrated, workbookId]);

  /** Every data column non-empty, and not currently editing (dirty / Edit unlocked). */
  const isRowContentLocked = useCallback(
    (excelRow: number): boolean => {
      if (dirtyRows.has(excelRow) || unlockedRows.has(excelRow)) return false;
      const hi = state.headerRow - 1;
      const colCount = (state.grid[hi] ?? []).length;
      if (colCount === 0) return false;
      const ri = excelRow - 1;
      const row = state.grid[ri];
      if (!row) return false;
      for (let c = 0; c < colCount; c++) {
        const v = row[c];
        if (v === null || v === undefined || String(v).trim() === "") {
          return false;
        }
      }
      return true;
    },
    [state.grid, state.headerRow, dirtyRows, unlockedRows]
  );

  const onCellClick = useCallback(
    (excelRow: number, excelCol: number, isHeaderRow: boolean) => {
      if (isHeaderRow) {
        dispatch({
          type: "SET_ACTIVE",
          row: state.headerRow + 1,
          col: excelCol,
        });
      } else {
        if (isRowContentLocked(excelRow)) {
          triggerLockedPopup();
        }
        dispatch({ type: "SET_ACTIVE", row: excelRow, col: excelCol });
      }
    },
    [state.headerRow, isRowContentLocked, triggerLockedPopup]
  );

  const onVoiceTranscript = useCallback(
    (intent: VoiceIntent) => {
      if (intent.type === "action") {
        const label =
          intent.action === "NEXT_ROW"
            ? "next row"
            : intent.action === "NEXT_COLUMN"
              ? "next column"
              : "clear";
        setLastTranscript(`[${label}]`);
        if (intent.action === "NEXT_ROW") {
          dispatch({ type: "NEXT_ROW" });
          return;
        }
        if (intent.action === "NEXT_COLUMN") {
          dispatch({ type: "NEXT_COLUMN" });
          return;
        }
        if (isRowContentLocked(state.activeRow)) {
          setLastTranscript("Row locked — click Edit to change");
          triggerLockedPopup();
          return;
        }
        dispatch({ type: "CLEAR_ACTIVE_CELL" });
        setDirtyRows((prev) => new Set(prev).add(state.activeRow));
        return;
      }
      if (isRowContentLocked(state.activeRow)) {
        setLastTranscript("Row locked — click Edit to change");
        triggerLockedPopup();
        return;
      }
      const raw = intent.text.trim();
      if (!raw) return;

      // ── Column-aware voice filter ─────────────────────────────────────────
      const headerRowIdx = state.headerRow - 1;
      const activeColIdx = state.activeCol - 1;
      const colHeader = state.grid[headerRowIdx]?.[activeColIdx] ?? null;
      const colKind = detectColKind(colHeader);
      const localText = applyColVoiceFilter(raw, colKind);
      const filledRow = state.activeRow;
      const filledCol = state.activeCol;

      if (needsServerFilter()) {
        // ── AI / MM: fill immediately with raw, then replace with GPT-cleaned value ─
        setLastTranscript(`Cleaning… [${colKind}]`);
        dispatch({ type: "FILL_VALUE", value: raw, advance: voiceAdvance });
        setDirtyRows((prev) => new Set(prev).add(filledRow));

        void (async () => {
          try {
            const res = await fetch("/api/clean-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: raw,
                colLabel: String(colHeader ?? colKind),
              }),
            });
            const data = (await res.json()) as { text?: string };
            const cleaned = data.text?.trim() || raw;
            // Patch the exact cell that was filled (active may have moved)
            dispatch({
              type: "SET_ACTIVE",
              row: filledRow,
              col: filledCol,
            });
            dispatch({ type: "SET_ACTIVE_CELL_TEXT", text: cleaned });
            setDirtyRows((prev) => new Set(prev).add(filledRow));
            setLastTranscript(
              cleaned !== raw
                ? `${raw}  →  ${cleaned}  [${colKind}]`
                : cleaned
            );
          } catch {
            setLastTranscript(raw); // fall back silently
          }
        })();
        return;
      }
      // ─────────────────────────────────────────────────────────────────

      setLastTranscript(
        colKind !== "default" && localText !== raw
          ? `${raw}  →  ${localText}  [${colKind}]`
          : localText
      );
      dispatch({
        type: "FILL_VALUE",
        value: localText,
        advance: voiceAdvance,
      });
      setDirtyRows((prev) => new Set(prev).add(filledRow));
    },
    [state.activeRow, state.activeCol, state.headerRow, state.grid, voiceAdvance, isRowContentLocked, triggerLockedPopup]
  );

  const onDataCellChange = useCallback((text: string) => {
    const r = state.activeRow;
    dispatch({ type: "SET_ACTIVE_CELL_TEXT", text });
    setDirtyRows((prev) => new Set(prev).add(r));
  }, [state.activeRow]);

  const onDataCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (voiceAdvance === "column") {
          dispatch({ type: "NEXT_COLUMN" });
        } else {
          dispatch({ type: "NEXT_ROW" });
        }
      }
    },
    [voiceAdvance]
  );

  const handleSaveRow = useCallback(
    async (excelRow: number) => {
      setRowBackendError(null);
      const hi = state.headerRow - 1;
      const ri = excelRow - 1;
      const headerCells = state.grid[hi] ?? [];
      const columns = headerCells.map((c) =>
        c === null || c === undefined ? "" : String(c)
      );
      const values = state.grid[ri] ?? [];
      setSavingRow(excelRow);
      try {
        const res = await nestFetch<{ error?: string; message?: string }>(
          `/excel-workbooks/${workbookId}/rows`,
          {
            method: "post",
            data: { excelRow, columns, values },
          }
        );
        void res; // axios throws on non-2xx
        setDirtyRows((prev) => {
          const n = new Set(prev);
          n.delete(excelRow);
          return n;
        });
        setUnlockedRows((prev) => {
          const n = new Set(prev);
          n.delete(excelRow);
          return n;
        });
        setSavedRows((prev) => new Set(prev).add(excelRow));
      } catch (e) {
        setRowBackendError(
          e instanceof Error ? e.message : "Row save failed"
        );
      } finally {
        setSavingRow(null);
      }
    },
    [state.grid, state.headerRow, workbookId]
  );

  const handleEditRow = useCallback((excelRow: number) => {
    setUnlockedRows((prev) => new Set(prev).add(excelRow));
    setSavedRows((prev) => {
      const n = new Set(prev);
      n.delete(excelRow);
      return n;
    });
    dispatch({ type: "SET_ACTIVE", row: excelRow, col: 1 });
  }, []);

  const handleSearchRow = useCallback(() => {
    if (state.grid.length === 0) return;
    const raw = searchQuery.trim();
    if (!raw) {
      setSearchMessage("Enter a value to search.");
      return;
    }
    const hi = state.headerRow - 1;
    const colIdx = searchCol;
    const maxExcelRow = state.headerRow + GRID_MAX_DATA_ROWS;
    for (let ri = hi + 1; ri < state.grid.length; ri++) {
      const excelRow = ri + 1;
      if (excelRow > maxExcelRow) break;
      const row = state.grid[ri];
      const cell = row?.[colIdx];
      if (cellMatchesSearch(cell, raw, colIdx)) {
        setSearchMessage(null);
        dispatch({
          type: "SET_ACTIVE",
          row: excelRow,
          col: colIdx + 1,
        });
        setScrollRequest({ excelRow, nonce: Date.now() });
        return;
      }
    }
    setSearchMessage("No matching row.");
  }, [state.grid, state.headerRow, searchCol, searchQuery]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (state.grid.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      dispatch({ type: "NAV_ROW", delta: 1 });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      dispatch({ type: "NAV_ROW", delta: -1 });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      dispatch({ type: "NAV_COL", delta: 1 });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      dispatch({ type: "NAV_COL", delta: -1 });
    }
  };

  const download = async () => {
    setDownloadBusy(true);
    try {
      await nestFetch(`/excel-workbooks/${workbookId}/grid`, {
        method: "put",
        data: { grid: state.grid },
      });
      const res = await nestFetch<ArrayBuffer>(
        `/excel-workbooks/${workbookId}/download`,
        { responseType: "arraybuffer" }
      );
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const cd = res.headers["content-disposition"] as string | undefined;
      let name = `${workbookName}.xlsx`;
      const m = cd?.match(/filename="([^"]+)"/);
      if (m?.[1]) name = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-3 py-2 pb-12">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <Link
            href="/"
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            ← All Excels
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {workbookName}
          </h1>
          <p className="text-xs text-slate-500">
            ID {workbookId} · Rows with every column filled are read-only until you
            click Edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/excel/${workbookId}?force=desktop`}
            className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600"
          >
            💻 Desktop View
          </Link>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace("/login?toast=logout");
            }}
            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      {showLockedPopup && (
        <div className="fixed inset-x-0 top-1/4 z-50 flex justify-center px-4">
          <div className="animate-bounce rounded-xl border border-amber-500/50 bg-amber-950/90 px-6 py-4 text-center shadow-2xl backdrop-blur-md">
            <p className="text-sm font-bold text-amber-200">
              🔒 Row locked
            </p>
            <p className="text-xs text-amber-100/80">
              Please click the <span className="font-bold text-sky-400">Edit</span> button first to unlock this row.
            </p>
          </div>
        </div>
      )}

      {loadError ? (
        <p className="shrink-0 text-sm text-rose-400">{loadError}</p>
      ) : null}
      {rowBackendError ? (
        <p className="shrink-0 text-sm text-rose-400">{rowBackendError}</p>
      ) : null}

      {!hydrated && !loadError ? (
        <p className="shrink-0 text-slate-400">Loading…</p>
      ) : null}

      {hydrated && state.grid.length > 0 ? (
        <div
          role="grid"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="flex flex-col gap-2 rounded-xl border border-slate-700/80 bg-slate-900/40 p-3 outline-none ring-blue-500/30 focus-visible:ring-2"
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {state.sheetName} · R{state.activeRow}C{state.activeCol} ·{" "}
              {GRID_MAX_DATA_ROWS} data rows · full rows locked until Edit · scroll
              to navigate
            </span>
          </div>
          <MobileWorkbookCard
            grid={state.grid}
            headerRow={state.headerRow}
            activeRow={state.activeRow}
            activeCol={state.activeCol}
            isRowContentLocked={isRowContentLocked}
            onCellClick={onCellClick}
            onDataCellChange={onDataCellChange}
            onDataCellKeyDown={onDataCellKeyDown}
            dirtyRows={dirtyRows}
            savedRows={savedRows}
            savingRow={savingRow}
            onSaveRow={(r) => void handleSaveRow(r)}
            onEditRow={handleEditRow}
            scrollRequest={scrollRequest}
            onNavRow={(delta) => dispatch({ type: "NAV_ROW", delta })}
          />
          <div className="shrink-0 space-y-2 rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
            <p className="text-xs font-medium text-slate-400">Find row</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-40 flex-col gap-1">
                <label htmlFor="search-col" className="text-xs text-slate-500">
                  Column
                </label>
                <select
                  id="search-col"
                  className="rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
                  value={searchCol}
                  onChange={(e) => setSearchCol(Number(e.target.value))}
                >
                  {(state.grid[state.headerRow - 1] ?? []).map((h, i) => (
                    <option key={i} value={i}>
                      {h === null || h === undefined || String(h).trim() === ""
                        ? `Column ${i + 1}`
                        : String(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-32 flex-1 flex-col gap-1 sm:min-w-48">
                <label htmlFor="search-q" className="text-xs text-slate-500">
                  Value (Sl.no: exact match)
                </label>
                <input
                  id="search-q"
                  type="text"
                  placeholder="e.g. 12"
                  className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchRow();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearchRow()}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
              >
                Search
              </button>
            </div>
            {searchMessage ? (
              <p className="text-xs text-amber-400/90">{searchMessage}</p>
            ) : null}
          </div>
          <div className="shrink-0 space-y-2 border-t border-slate-700/80 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                After voice / Enter, move:
              </span>
              <button
                type="button"
                aria-pressed={voiceAdvance === "row"}
                onClick={() => setVoiceAdvance("row")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  voiceAdvance === "row"
                    ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-100"
                    : "border-slate-600 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                Row <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                aria-pressed={voiceAdvance === "column"}
                onClick={() => setVoiceAdvance("column")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  voiceAdvance === "column"
                    ? "border-sky-500/70 bg-sky-950/50 text-sky-100"
                    : "border-slate-600 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                Col <span aria-hidden>↓</span>
              </button>
            </div>
            <VoiceRecorder
              compactToolbar
              disabled={!hydrated}
              onTranscript={onVoiceTranscript}
              trailing={
                <>
                  <button
                    type="button"
                    onClick={() => void download()}
                    disabled={downloadBusy || !hydrated}
                    className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {downloadBusy ? "Preparing…" : "Download Excel (.xlsx)"}
                  </button>
                  <span className="shrink-0 text-xs text-slate-500">
                    {saveStatus === "saving" && "Syncing to database…"}
                    {saveStatus === "saved" && "Synced"}
                    {saveStatus === "error" && "Sync failed"}
                    {saveStatus === "idle" && !downloadBusy && "From MySQL"}
                  </span>
                </>
              }
            />
            {lastTranscript ? (
              <p className="text-xs text-slate-500">
                Last: <span className="text-slate-400">{lastTranscript}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

