import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface EditableTableProps {
    description: string;
    setDescription: (desc: string) => void;
}

function EditableTable({ description, setDescription }: EditableTableProps) {
    const [rows, setRows] = useState<string[][]>(() => {
        if (!description) return [["", ""]];
        return description
            .split("\n")
            .map((row: string) => {
                const cols = row.split(",");
                return [cols[0] || "", cols[1] || ""];
            });
    });

    const [selectedRow, setSelectedRow] = useState<number | null>(null);

    function updateCell(rowIndex: number, colIndex: number, value: string) {
        const newRows = [...rows];
        newRows[rowIndex][colIndex] = value;
        setRows(newRows);
        setDescription(newRows.map((r) => r.join(",")).join("\n"));
    }

    function addRow() {
        setRows([...rows, ["", ""]]);
    }

    function removeRow() {
        if (selectedRow === null) return;
        const newRows = rows.filter((_, i) => i !== selectedRow);
        setRows(newRows);
        setDescription(newRows.map((r) => r.join(",")).join("\n"));
        setSelectedRow(null);
    }

    return (
        <div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Details</TableHead>
                        <TableHead>Specifications</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row, rIdx) => (
                        <TableRow
                            key={rIdx}
                            className={selectedRow === rIdx ? "bg-gray-100" : ""}
                            onClick={() => setSelectedRow(rIdx)}
                            style={{ cursor: "pointer" }}
                        >
                            {row.map((cell, cIdx) => (
                                <TableCell key={cIdx} className="p-0">
                                    <input
                                        className="w-full p-1 border-none outline-none"
                                        value={cell}
                                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <div className="flex justify-end mt-2 gap-2">
                <Button onClick={addRow} aria-label="Add Row" size="sm">
                    <Plus className="h-5 w-5" />
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={removeRow}
                    disabled={selectedRow === null}
                    aria-label="Remove Selected Row"
                >
                    <Trash2 className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}

export default EditableTable;
