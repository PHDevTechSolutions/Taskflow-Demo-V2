"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import Lottie from "lottie-react";
import noInternetAnimation from "../../public/animation/No internet.json";

function TicTacToe() {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [xIsNext, setXIsNext] = useState(true);
    const winner = calculateWinner(board);

    function handleClick(index: number) {
        if (board[index] || winner) return;
        const newBoard = [...board];
        newBoard[index] = xIsNext ? "X" : "O";
        setBoard(newBoard);
        setXIsNext(!xIsNext);
    }

    function reset() {
        setBoard(Array(9).fill(null));
        setXIsNext(true);
    }

    return (
        <div className="flex flex-col items-center gap-2 mt-4">
            <div className="grid grid-cols-3 gap-1">
                {board.map((cell, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleClick(idx)}
                        className="w-12 h-12 text-lg font-bold border flex items-center justify-center hover:bg-gray-200"
                    >
                        {cell}
                    </button>
                ))}
            </div>
            <div className="mt-2 text-sm">
                {winner ? `Winner: ${winner}` : `Next: ${xIsNext ? "X" : "O"}`}
            </div>
            <button onClick={reset} className="mt-2 px-2 py-1 text-xs border rounded hover:bg-gray-100">
                Reset
            </button>
        </div>
    );
}

function calculateWinner(squares: (string | null)[]) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let [a, b, c] of lines) {
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
}

export function OfflineDialog() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        function handleOnline() { setIsOffline(false); }
        function handleOffline() { setIsOffline(true); }

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        setIsOffline(!navigator.onLine);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return (
        <Dialog open={isOffline} onOpenChange={() => { /* prevent closing */ }}>
            <DialogContent className="rounded-none flex flex-col items-center justify-center gap-4 p-6">
                <Lottie animationData={noInternetAnimation} loop className="w-60 h-60" />
                <DialogHeader className="text-center">
                    <DialogTitle>No Internet Connection</DialogTitle>
                    <DialogDescription>
                        Please check your network connection and try again.
                    </DialogDescription>
                </DialogHeader>
                {/* Offline Game */}
                <TicTacToe />
            </DialogContent>
        </Dialog>
    );
}