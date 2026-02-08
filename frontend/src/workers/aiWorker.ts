import type { ActionMessage, GameState } from "../../../shared/types/types";
import { automatonTakeTurn, gobletCountMemory, gobletMemory } from "../../../shared/logic/aiLogic";

type AiMemorySnapshot = {
  gobletMemory: Record<number, "poisonous" | "holy">;
  gobletCountMemory: {
    poisonousGoblets: number;
    holyGoblets: number;
  };
};

type AiWorkerRequest = {
  id: number;
  game: GameState;
  memory: AiMemorySnapshot;
};

type AiWorkerResponse = {
  id: number;
  updatedGame?: GameState;
  actionMessage?: ActionMessage;
  memory?: AiMemorySnapshot;
  error?: string;
};

function applyMemorySnapshot(snapshot: AiMemorySnapshot) {
  for (const key in gobletMemory) {
    delete gobletMemory[Number(key)];
  }
  for (const [key, value] of Object.entries(snapshot.gobletMemory)) {
    gobletMemory[Number(key)] = value;
  }
  gobletCountMemory.poisonousGoblets = snapshot.gobletCountMemory.poisonousGoblets;
  gobletCountMemory.holyGoblets = snapshot.gobletCountMemory.holyGoblets;
}

function getMemorySnapshot(): AiMemorySnapshot {
  return {
    gobletMemory: { ...gobletMemory },
    gobletCountMemory: {
      poisonousGoblets: gobletCountMemory.poisonousGoblets,
      holyGoblets: gobletCountMemory.holyGoblets,
    },
  };
}

const ctx = self as unknown as {
  postMessage: (message: AiWorkerResponse) => void;
  onmessage: (event: MessageEvent<AiWorkerRequest>) => void;
};

ctx.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { id, game, memory } = event.data;
  try {
    // Sync AI memory from the main thread before computing.
    applyMemorySnapshot(memory);
    const { updatedGame, actionMessage } = automatonTakeTurn(game);
    const response: AiWorkerResponse = {
      id,
      updatedGame,
      actionMessage,
      memory: getMemorySnapshot(),
    };
    ctx.postMessage(response);
  } catch (error) {
    const response: AiWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : "Unknown AI worker error",
    };
    ctx.postMessage(response);
  }
};
