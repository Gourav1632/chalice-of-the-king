import { useCallback, useEffect, useRef } from "react";
import type { ActionMessage, GameState } from "../../../shared/types/types";
import {
  automatonTakeTurn,
  clearGobletMemory,
  gobletCountMemory,
  gobletMemory,
} from "../../../shared/logic/aiLogic";

type AiMemorySnapshot = {
  gobletMemory: Record<number, "poisonous" | "holy">;
  gobletCountMemory: {
    poisonousGoblets: number;
    holyGoblets: number;
  };
};

type AiWorkerResponse = {
  id: number;
  updatedGame?: GameState;
  actionMessage?: ActionMessage;
  memory?: AiMemorySnapshot;
  error?: string;
};

function getMemorySnapshot(): AiMemorySnapshot {
  return {
    gobletMemory: { ...gobletMemory },
    gobletCountMemory: {
      poisonousGoblets: gobletCountMemory.poisonousGoblets,
      holyGoblets: gobletCountMemory.holyGoblets,
    },
  };
}

function applyMemorySnapshot(snapshot: AiMemorySnapshot) {
  clearGobletMemory();
  for (const [key, value] of Object.entries(snapshot.gobletMemory)) {
    gobletMemory[Number(key)] = value;
  }
  gobletCountMemory.poisonousGoblets = snapshot.gobletCountMemory.poisonousGoblets;
  gobletCountMemory.holyGoblets = snapshot.gobletCountMemory.holyGoblets;
}

export function useAiWorker() {
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiPendingRef = useRef(
    new Map<
      number,
      {
        resolve: (result: { updatedGame: GameState; actionMessage: ActionMessage }) => void;
        reject: (error: Error) => void;
      }
    >()
  );

  useEffect(() => {
    if (!("Worker" in window)) return;

    const worker = new Worker(new URL("../workers/aiWorker.ts", import.meta.url), {
      type: "module",
    });
    aiWorkerRef.current = worker;
    const pendingMap = aiPendingRef.current;

    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const { id, updatedGame, actionMessage, memory, error } = event.data;
      const pending = pendingMap.get(id);
      if (!pending) return;
      pendingMap.delete(id);

      if (error || !updatedGame || !actionMessage || !memory) {
        pending.reject(new Error(error ?? "Invalid AI worker response"));
        return;
      }

      applyMemorySnapshot(memory);
      pending.resolve({ updatedGame, actionMessage });
    };

    worker.onerror = (event) => {
      const error = new Error(event.message);
      pendingMap.forEach(({ reject }) => reject(error));
      pendingMap.clear();
    };

    return () => {
      worker.terminate();
      aiWorkerRef.current = null;
      pendingMap.clear();
    };
  }, []);

  const runAiTurn = useCallback(async (gameState: GameState) => {
    const worker = aiWorkerRef.current;
    if (!worker) return automatonTakeTurn(gameState);

    const requestId = aiRequestIdRef.current++;
    const memory = getMemorySnapshot();

    try {
      const result = await new Promise<{
        updatedGame: GameState;
        actionMessage: ActionMessage;
      }>((resolve, reject) => {
        aiPendingRef.current.set(requestId, { resolve, reject });
        worker.postMessage({ id: requestId, game: gameState, memory });
      });
      return result;
    } catch {
      return automatonTakeTurn(gameState);
    }
  }, []);

  return { runAiTurn };
}
