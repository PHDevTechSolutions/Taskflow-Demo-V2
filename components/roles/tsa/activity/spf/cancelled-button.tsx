"use client";

import React from "react";
import { XCircle } from "lucide-react";

interface CancelledButtonProps {
    onClick?: () => void;
    disabled?: boolean;
}

export const CancelledButton: React.FC<CancelledButtonProps> = ({ onClick, disabled = false }) => {
    return (
        <button
            title="Cancel"
            onClick={onClick}
            disabled={disabled}
            className="p-1.5 border border-zinc-200 rounded-none text-zinc-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <XCircle className="w-3.5 h-3.5" />
        </button>
    );
};
