"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "report_summary_sheet_v2";
const MULTIPLIER_KEY = "report_summary_ob_multiplier";
const MIN_COL_WIDTH = 48;
const DEFAULT_COL_WIDTH = 110;
const NAME_COL_WIDTH = 140;
const OB_COL_WIDTH = 100;
const OB_TARGET_COL_WIDTH = 110;
const FALLBACK_QUOTA = 20;
const DEFAULT_MULTIPLIER = 7;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SheetData {
  names: string[];
  extraCols: { label: string; width: number; cells: string[] }[];
}

interface ContextMenu {
  x: number;
  y: number;
  colIdx: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFinitePositive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function colLabel(index: number): string {
  let label = "";
  let i = index;
  do {
    label = String.fromCharCode(65 + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return label;
}

function insertAt<T>(arr: T[], index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index)];
}

/**
 * Column layout (for formula refs):
 *   A = Name (col 0)
 *   B = OB Calls Daily (col 1)
 *   C = OB Calls Target (col 2)
 *   D+ = extra user cols (col 3+)
 */
function evalFormula(
  formula: string,
  rowIdx: number,
  names: string[],
  obQuota: number,
  obMultiplier: number,
  extraCols: SheetData["extraCols"]
): string {
  const getCell = (colIdx: number, rIdx: number): string => {
    if (colIdx === 0) return names[rIdx] ?? "";
    if (colIdx === 1) return names[rIdx]?.trim() ? String(obQuota) : "";
    if (colIdx === 2) return names[rIdx]?.trim() ? String(obQuota * obMultiplier) : "";
    const ec = extraCols[colIdx - 3];
    return ec?.cells[rIdx] ?? "";
  };

  try {
    const expr = formula.replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
      const colIdx =
        col.split("").reduce((acc: number, c: string) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
      const rIdx = parseInt(row, 10) - 1;
      const totalCols = 3 + extraCols.length;
      if (rIdx < 0 || rIdx >= names.length || colIdx < 0 || colIdx >= totalCols) return "0";
      const raw = getCell(colIdx, rIdx);
      return isNaN(Number(raw)) || raw === "" ? "0" : raw;
    });
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result === "number" && isFinite(result))
      return Number.isInteger(result) ? String(result) : result.toFixed(2);
    return String(result);
  } catch {
    return "#ERR";
  }
}

function initSheet(): SheetData {
  return {
    names: Array(5).fill(""),
    extraCols: [
      { label: "D", width: DEFAULT_COL_WIDTH, cells: Array(5).fill("") },
      { label: "E", width: DEFAULT_COL_WIDTH, cells: Array(5).fill("") },
    ],
  };
}

function loadSheet(): SheetData {
  if (typeof window === "undefined") return initSheet();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SheetData;
  } catch {}
  return initSheet();
}

function saveSheet(sheet: SheetData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
  } catch {}
}

function loadMultiplier(): number {
  if (typeof window === "undefined") return DEFAULT_MULTIPLIER;
  const v = Number(localStorage.getItem(MULTIPLIER_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MULTIPLIER;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportSummary() {
  const [sheet, setSheet] = useState<SheetData>(initSheet);
  const [obQuota, setObQuota] = useState<number>(FALLBACK_QUOTA);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [multiplier, setMultiplier] = useState<number>(DEFAULT_MULTIPLIER);
  const [editingMultiplier, setEditingMultiplier] = useState(false);
  const [multiplierInput, setMultiplierInput] = useState("");
  const multiplierRef = useRef<HTMLInputElement>(null);

  // editing: col -1 = name col, col >= 0 = extraCols index
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizingCol = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => { setSheet(loadSheet()); }, []);
  useEffect(() => { setMultiplier(loadMultiplier()); }, []);
  useEffect(() => { saveSheet(sheet); }, [sheet]);
  useEffect(() => {
    localStorage.setItem(MULTIPLIER_KEY, String(multiplier));
  }, [multiplier]);
  useEffect(() => { if (editingCell) inputRef.current?.focus(); }, [editingCell]);
  useEffect(() => { if (editingMultiplier) multiplierRef.current?.focus(); }, [editingMultiplier]);

  useEffect(() => {
    fetch("/api/outbound-quota")
      .then((res) => res.json())
      .then((data) => {
        if (isFinitePositive(data?.outbound_quota)) {
          setObQuota(data.outbound_quota);
        } else {
          console.warn("outbound-quota: invalid value, falling back to", FALLBACK_QUOTA, data);
        }
      })
      .catch((err) => {
        console.warn("outbound-quota: fetch failed, falling back to", FALLBACK_QUOTA, err);
      })
      .finally(() => setQuotaLoading(false));
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("contextmenu", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
    };
  }, [contextMenu]);

  const rowCount = sheet.names.length;

  // ── Display value for extra cols ─────────────────────────────────────────
  function displayExtra(raw: string, rowIdx: number): string {
    if (raw.startsWith("="))
      return evalFormula(raw.slice(1), rowIdx, sheet.names, obQuota, multiplier, sheet.extraCols);
    return raw;
  }

  // ── Multiplier editing ───────────────────────────────────────────────────
  function startEditMultiplier() {
    setMultiplierInput(String(multiplier));
    setEditingMultiplier(true);
  }

  function commitMultiplier() {
    const v = Number(multiplierInput);
    if (Number.isFinite(v) && v > 0) setMultiplier(v);
    setEditingMultiplier(false);
  }

  function handleMultiplierKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitMultiplier();
    else if (e.key === "Escape") setEditingMultiplier(false);
  }

  // ── Cell editing ─────────────────────────────────────────────────────────
  function startEdit(row: number, col: number) {
    setEditingCell({ row, col });
    const val = col === -1
      ? sheet.names[row]
      : sheet.extraCols[col]?.cells[row] ?? "";
    setEditValue(val);
  }

  function commitEdit() {
    if (!editingCell) return;
    const { row, col } = editingCell;
    setSheet((prev) => {
      if (col === -1) {
        const names = [...prev.names];
        names[row] = editValue;
        return { ...prev, names };
      }
      const extraCols = prev.extraCols.map((ec, ci) => {
        if (ci !== col) return ec;
        const cells = [...ec.cells];
        cells[row] = editValue;
        return { ...ec, cells };
      });
      return { ...prev, extraCols };
    });
    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // name(-1) + extras(0..n-1) → flat 0..n
    const totalCols = 1 + sheet.extraCols.length;
    const flatCol = editingCell ? editingCell.col + 1 : 0;

    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      if (editingCell && editingCell.row + 1 < rowCount) {
        const next = { row: editingCell.row + 1, col: editingCell.col };
        setEditingCell(next);
        setEditValue(
          next.col === -1 ? sheet.names[next.row] : sheet.extraCols[next.col]?.cells[next.row] ?? ""
        );
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      if (editingCell) {
        const nextFlat = (flatCol + 1) % totalCols;
        const nextCol = nextFlat - 1;
        const nextRow = flatCol + 1 >= totalCols ? editingCell.row + 1 : editingCell.row;
        if (nextRow < rowCount) {
          setEditingCell({ row: nextRow, col: nextCol });
          setEditValue(
            nextCol === -1 ? sheet.names[nextRow] : sheet.extraCols[nextCol]?.cells[nextRow] ?? ""
          );
        } else {
          setEditingCell(null);
        }
      }
    }
  }

  // ── Column resize ────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, colIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizingCol.current = colIdx;
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = sheet.extraCols[colIdx]?.width ?? DEFAULT_COL_WIDTH;

      const onMouseMove = (ev: MouseEvent) => {
        if (resizingCol.current === null) return;
        const delta = ev.clientX - resizeStartX.current;
        const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth.current + delta);
        setSheet((prev) => {
          const extraCols = prev.extraCols.map((ec, i) =>
            i === resizingCol.current ? { ...ec, width: newWidth } : ec
          );
          return { ...prev, extraCols };
        });
      };

      const onMouseUp = () => {
        resizingCol.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sheet.extraCols]
  );

  // ── Context menu ─────────────────────────────────────────────────────────
  function openContextMenu(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, colIdx });
  }

  function insertExtraCol(at: number) {
    setSheet((prev) => {
      const label = colLabel(3 + at); // offset by 3 fixed cols
      const newCol = { label, width: DEFAULT_COL_WIDTH, cells: Array(rowCount).fill("") };
      return { ...prev, extraCols: insertAt(prev.extraCols, at, newCol) };
    });
    setContextMenu(null);
  }

  function removeExtraCol(colIdx: number) {
    setSheet((prev) => ({
      ...prev,
      extraCols: prev.extraCols.filter((_, i) => i !== colIdx),
    }));
    setContextMenu(null);
  }

  function renameExtraCol(colIdx: number, name: string) {
    setSheet((prev) => ({
      ...prev,
      extraCols: prev.extraCols.map((ec, i) => (i === colIdx ? { ...ec, label: name } : ec)),
    }));
  }

  function addExtraCol() {
    setSheet((prev) => ({
      ...prev,
      extraCols: [
        ...prev.extraCols,
        { label: colLabel(3 + prev.extraCols.length), width: DEFAULT_COL_WIDTH, cells: Array(prev.names.length).fill("") },
      ],
    }));
  }

  function addRow() {
    setSheet((prev) => ({
      names: [...prev.names, ""],
      extraCols: prev.extraCols.map((ec) => ({ ...ec, cells: [...ec.cells, ""] })),
    }));
  }

  function removeRow(rowIdx: number) {
    if (sheet.names.length <= 1) return;
    setSheet((prev) => ({
      names: prev.names.filter((_, i) => i !== rowIdx),
      extraCols: prev.extraCols.map((ec) => ({
        ...ec,
        cells: ec.cells.filter((_, i) => i !== rowIdx),
      })),
    }));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <li className="bg-white border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-indigo-500">
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">
          Report Summary
        </span>
        <div className="flex gap-1">
          <button
            onClick={addExtraCol}
            className="flex items-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 border border-indigo-200 hover:border-indigo-400 rounded transition-colors"
          >
            <Plus size={9} /> Col
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-0.5 text-[9px] text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 border border-indigo-200 hover:border-indigo-400 rounded transition-colors"
          >
            <Plus size={9} /> Row
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-auto">
        <table className="border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: NAME_COL_WIDTH }} />
            <col style={{ width: OB_COL_WIDTH }} />
            <col style={{ width: OB_TARGET_COL_WIDTH }} />
            {sheet.extraCols.map((ec, i) => (
              <col key={i} style={{ width: ec.width }} />
            ))}
            <col style={{ width: 16 }} />
          </colgroup>

          <thead>
            <tr>
              <th className="bg-gray-100 border border-gray-200 select-none" />

              {/* Name */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <span className="text-[10px] font-semibold text-gray-500">Name</span>
              </th>

              {/* OB Calls Daily */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] font-semibold text-indigo-600 truncate">
                    OB Calls Daily
                  </span>
                  {quotaLoading && <Loader2 size={8} className="animate-spin text-gray-400" />}
                </div>
              </th>

              {/* OB Calls Target */}
              <th className="bg-gray-100 border border-gray-200 px-2 py-0 h-6 text-center select-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[10px] font-semibold text-emerald-600 truncate">
                    OB Calls Target
                  </span>
                  {/* Multiplier badge — click to edit */}
                  <button
                    onClick={startEditMultiplier}
                    className="shrink-0 flex items-center"
                    title="Click to change multiplier"
                  >
                    {editingMultiplier ? (
                      <input
                        ref={multiplierRef}
                        className="w-7 text-center text-[9px] font-bold bg-white border border-indigo-300 rounded outline-none tabular-nums"
                        value={multiplierInput}
                        onChange={(e) => setMultiplierInput(e.target.value)}
                        onBlur={commitMultiplier}
                        onKeyDown={handleMultiplierKeyDown}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[9px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded px-1 tabular-nums transition-colors cursor-pointer">
                        ×{multiplier}
                      </span>
                    )}
                  </button>
                </div>
              </th>

              {/* User extra cols */}
              {sheet.extraCols.map((ec, ci) => (
                <th
                  key={ci}
                  className="bg-gray-100 border border-gray-200 px-0 py-0 font-semibold text-gray-600 text-center group relative select-none"
                  onContextMenu={(e) => openContextMenu(e, ci)}
                >
                  <div className="flex items-center h-6">
                    <input
                      className="flex-1 min-w-0 bg-transparent text-center text-[10px] font-semibold text-gray-600 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 px-1 h-full"
                      value={ec.label}
                      onChange={(e) => renameExtraCol(ci, e.target.value)}
                      onContextMenu={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => removeExtraCol(ci)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity px-0.5 shrink-0"
                    >
                      <Trash2 size={9} />
                    </button>
                    <div
                      onMouseDown={(e) => onResizeMouseDown(e, ci)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400 active:bg-indigo-600 transition-colors z-10"
                    />
                  </div>
                </th>
              ))}

              <th className="bg-gray-50 border border-gray-200" />
            </tr>
          </thead>

          <tbody>
            {sheet.names.map((name, ri) => {
              const hasName = name.trim() !== "";
              const obDisplay = hasName ? (quotaLoading ? "…" : String(obQuota)) : "";
              const targetDisplay = hasName
                ? quotaLoading ? "…" : String(obQuota * multiplier)
                : "";

              return (
                <tr key={ri} className="group/row hover:bg-indigo-50/30">
                  {/* Row number */}
                  <td className="bg-gray-100 border border-gray-200 text-center text-[9px] text-gray-400 select-none px-1">
                    <div className="flex items-center justify-between gap-0.5">
                      <span>{ri + 1}</span>
                      <button
                        onClick={() => removeRow(ri)}
                        className="opacity-0 group-hover/row:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 size={8} />
                      </button>
                    </div>
                  </td>

                  {/* Name */}
                  <td
                    className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${
                      editingCell?.row === ri && editingCell?.col === -1
                        ? "bg-white ring-1 ring-inset ring-indigo-400 z-10"
                        : "hover:bg-indigo-50"
                    }`}
                    onClick={() => startEdit(ri, -1)}
                  >
                    {editingCell?.row === ri && editingCell?.col === -1 ? (
                      <input
                        ref={inputRef}
                        className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                      />
                    ) : (
                      <span className="block truncate text-gray-800">{name}</span>
                    )}
                  </td>

                  {/* OB Calls Daily (read-only) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-gray-50/50 select-none">
                    <span className={`block truncate tabular-nums text-center font-semibold ${hasName ? "text-indigo-700" : "text-gray-300"}`}>
                      {obDisplay}
                    </span>
                  </td>

                  {/* OB Calls Target (read-only, computed) */}
                  <td className="border border-gray-200 px-1 py-0 h-6 overflow-hidden bg-emerald-50/40 select-none">
                    <span className={`block truncate tabular-nums text-center font-semibold ${hasName ? "text-emerald-700" : "text-gray-300"}`}>
                      {targetDisplay}
                    </span>
                  </td>

                  {/* Extra cols */}
                  {sheet.extraCols.map((ec, ci) => {
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                    const raw = ec.cells[ri] ?? "";
                    const shown = displayExtra(raw, ri);
                    const isFormula = raw.startsWith("=");

                    return (
                      <td
                        key={ci}
                        className={`border border-gray-200 px-1 py-0 h-6 cursor-text overflow-hidden ${
                          isEditing
                            ? "bg-white ring-1 ring-inset ring-indigo-400 z-10"
                            : "hover:bg-indigo-50"
                        }`}
                        onClick={() => startEdit(ri, ci)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            className="w-full h-full outline-none bg-transparent text-[11px] text-gray-800 tabular-nums"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                          />
                        ) : (
                          <span className={`block truncate tabular-nums ${isFormula ? "text-indigo-700" : "text-gray-800"}`}>
                            {shown}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border border-gray-200 bg-gray-50" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50">
        <span className="text-[9px] text-gray-400">
          Click to edit · <code>=A1+B1</code> for formulas · Click <strong>×{multiplier}</strong> badge to change multiplier · Right-click column to insert/delete · Drag edge to resize · Auto-saved
        </span>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 shadow-lg rounded text-[11px] py-1 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-gray-700 flex items-center gap-2"
            onClick={() => insertExtraCol(contextMenu.colIdx)}
          >
            <Plus size={10} className="text-indigo-500" /> Insert column before
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-gray-700 flex items-center gap-2"
            onClick={() => insertExtraCol(contextMenu.colIdx + 1)}
          >
            <Plus size={10} className="text-indigo-500" /> Insert column after
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
            onClick={() => removeExtraCol(contextMenu.colIdx)}
          >
            <Trash2 size={10} /> Delete column
          </button>
        </div>
      )}
    </li>
  );
}
