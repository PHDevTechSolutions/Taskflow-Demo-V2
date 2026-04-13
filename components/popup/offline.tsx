"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Lottie from "lottie-react";
import noInternetAnimation from "../../public/animation/No internet.json";
import { RotateCcw, Wifi, WifiOff } from "lucide-react";

// ─── Game Logic ───────────────────────────────────────────────────────────────
type Cell = "X" | "O" | null;
type Board = Cell[];

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

function calculateWinner(board: Board): { winner: Cell; line: number[] } | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

/** Minimax AI — plays as "O", always optimal */
function minimax(board: Board, isMaximizing: boolean): number {
  const result = calculateWinner(board);
  if (result?.winner === "O") return 10;
  if (result?.winner === "X") return -10;
  if (isBoardFull(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = "O";
        best = Math.max(best, minimax(board, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = "X";
        best = Math.min(best, minimax(board, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function getBestMove(board: Board): number {
  let bestVal = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = "O";
      const moveVal = minimax(board, false);
      board[i] = null;
      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

// ─── TicTacToe Component ──────────────────────────────────────────────────────
function TicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [playerTurn, setPlayerTurn] = useState(true); // true = player (X), false = AI (O)
  const [aiThinking, setAiThinking] = useState(false);
  const [score, setScore] = useState({ player: 0, ai: 0, draw: 0 });
  const [gameOver, setGameOver] = useState(false);

  const result = calculateWinner(board);
  const winLine = result?.line ?? [];
  const isDraw = !result && isBoardFull(board);

  // ── AI move ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playerTurn || gameOver || result || isDraw) return;

    setAiThinking(true);
    const timeout = setTimeout(() => {
      setBoard((prev) => {
        const copy = [...prev] as Board;
        const move = getBestMove(copy);
        if (move === -1) return prev;
        copy[move] = "O";
        return copy;
      });
      setPlayerTurn(true);
      setAiThinking(false);
    }, 450); // slight delay so AI feels "thoughtful"

    return () => clearTimeout(timeout);
  }, [playerTurn, gameOver, result, isDraw]);

  // ── Track game over + update score ─────────────────────────────────────────
  useEffect(() => {
    if (result) {
      setGameOver(true);
      setScore((prev) => ({
        ...prev,
        player: result.winner === "X" ? prev.player + 1 : prev.player,
        ai: result.winner === "O" ? prev.ai + 1 : prev.ai,
      }));
    } else if (isDraw) {
      setGameOver(true);
      setScore((prev) => ({ ...prev, draw: prev.draw + 1 }));
    }
  }, [result, isDraw]);

  const handleClick = (idx: number) => {
    if (!playerTurn || board[idx] || gameOver || aiThinking) return;
    const copy = [...board] as Board;
    copy[idx] = "X";
    setBoard(copy);
    setPlayerTurn(false);
  };

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setPlayerTurn(true);
    setGameOver(false);
    setAiThinking(false);
  }, []);

  // ── Status text ─────────────────────────────────────────────────────────────
  const statusText = result
    ? result.winner === "X"
      ? "🎉 You win!"
      : "🤖 AI wins!"
    : isDraw
    ? "🤝 Draw!"
    : aiThinking
    ? "🤔 AI is thinking..."
    : playerTurn
    ? "Your turn (X)"
    : "";

  return (
    <div className="flex flex-col items-center gap-3 w-full">

      {/* Score */}
      <div className="flex gap-3 w-full">
        {[
          { label: "You", value: score.player, color: "bg-zinc-900 text-white" },
          { label: "Draw", value: score.draw, color: "bg-zinc-100 text-zinc-600" },
          { label: "AI", value: score.ai, color: "bg-red-600 text-white" },
        ].map((s) => (
          <div
            key={s.label}
            className={`flex-1 rounded-none py-2 text-center text-xs font-bold ${s.color}`}
          >
            <div className="text-lg leading-none">{s.value}</div>
            <div className="text-[10px] mt-0.5 opacity-80 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className={`text-xs font-semibold h-5 text-center transition-all ${
        result?.winner === "X" ? "text-zinc-900" :
        result?.winner === "O" ? "text-red-600" :
        isDraw ? "text-zinc-500" :
        "text-zinc-500"
      }`}>
        {statusText}
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px]">
        {board.map((cell, idx) => {
          const isWinCell = winLine.includes(idx);
          const isPlayerCell = cell === "X";
          const isAiCell = cell === "O";

          return (
            <button
              key={idx}
              onClick={() => handleClick(idx)}
              disabled={!!cell || gameOver || aiThinking || !playerTurn}
              className={`
                aspect-square w-full text-xl font-black rounded-none border
                flex items-center justify-center transition-all select-none
                ${isWinCell
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : isPlayerCell
                  ? "bg-zinc-100 text-zinc-900 border-zinc-300"
                  : isAiCell
                  ? "bg-red-50 text-red-600 border-red-200"
                  : !cell && !gameOver && playerTurn && !aiThinking
                  ? "bg-white border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                  : "bg-white border-zinc-100 cursor-not-allowed"
                }
              `}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {/* Reset */}
      <button
        onClick={reset}
        className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-900 transition-colors mt-1 font-medium"
      >
        <RotateCcw className="h-3 w-3" />
        New Game
      </button>
    </div>
  );
}

// ─── OfflineDialog Component ──────────────────────────────────────────────────
export function OfflineDialog() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // FIX: initialize from navigator.onLine immediately, not just from events
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <Dialog
      open={isOffline}
      onOpenChange={() => {
        /* intentionally uncloseble — user must reconnect */
      }}
    >
      <DialogContent className="rounded-none p-0 overflow-hidden max-w-sm gap-0 [&>button]:hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-zinc-900 px-6 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/10 rounded-full p-1.5">
                <WifiOff className="h-4 w-4 text-red-400" />
              </div>
              <DialogTitle className="text-white text-sm font-bold tracking-wide uppercase">
                No Internet Connection
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 text-xs">
              Please check your network. The app will resume automatically when
              you&apos;re back online.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── Animation ──────────────────────────────────────────────────── */}
        <div className="flex justify-center px-6 pt-4 pb-0">
          <Lottie
            animationData={noInternetAnimation}
            loop
            className="w-36 h-36"
          />
        </div>

        {/* ── Game Section ───────────────────────────────────────────────── */}
        <div className="px-6 pb-5 pt-2">
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex-1">
                Play while you wait
              </p>
              <span className="text-[9px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-semibold uppercase tracking-wide">
                You vs AI
              </span>
            </div>
            <TicTacToe />
          </div>
        </div>

        {/* ── Footer status ──────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-zinc-100 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-zinc-400 font-medium">
            Waiting for connection...
          </span>
          <Wifi className="h-3 w-3 text-zinc-300 ml-auto" />
        </div>

      </DialogContent>
    </Dialog>
  );
}