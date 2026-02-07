import type { ActionMessage, GameState } from "../../../shared/types/types";
import { nextRound, refillChambers, skipIfChained } from "../../../shared/logic/gameEngine";
import { roomManager } from "./roomManager";

export async function handlePlayerTurn(
  roomId: string,
  game: GameState
): Promise<{ game: GameState; actionMessage: ActionMessage; delay: number } | null> {
  const room = await roomManager.getRoom(roomId);
  if (!room || !room.gameState) {
    const message: ActionMessage = { type: "error", result: "No room found." };
    return { game, actionMessage: message, delay: 0 };
  }

  const active = game.players[game.activePlayerIndex];
  const activeConnection = room.connectionStates?.find(
    (state) => state.playerId === active.id
  );
  if (activeConnection && activeConnection.status !== "connected") {
    const message: ActionMessage = {
      type: "announce",
      userId: active.id,
      result: `${active.name} disconnected. Waiting to reconnect...`,
    };
    return { game: room.gameState, actionMessage: message, delay: 3000 };
  }

  // check if round is over
  const { actionMessage, updatedGame } = await checkDeathsAndAdvance(roomId, game);
  if (actionMessage.type === "announce" || actionMessage.type === "message") {
    return { game: updatedGame ?? room.gameState, actionMessage, delay: 5000 };
  }

  // check if player is chained
  const skipResult = skipIfChained(game, active);
  if (skipResult) {
    const { updatedGame: skippedGame, actionMessage: skippedMessage } = skipResult;
    await roomManager.updateGameState(roomId, skippedGame);
    return { game: skippedGame, actionMessage: skippedMessage, delay: 5000 };
  }

  // player status is thief
  if (active.statusEffects.includes("thief")) {
    const message: ActionMessage = { type: "canSteal" };
    return { game: room.gameState, actionMessage: message, delay: 0 };
  }

  // check if all goblets are over
  if (game.gobletsRemaining === 0 && game.gameState === "playing") {
    const updatedGameState = refillChambers(game);
    await roomManager.updateGameState(roomId, updatedGameState);
    const message: ActionMessage = {
      type: "refill",
      userId: game.players[game.activePlayerIndex].id,
      result: `Guard refills the goblets. It has ${updatedGameState.currentRound.holyGoblets} holy and ${updatedGameState.currentRound.poisnousGoblets} poisoned goblets.`,
    };
    return { game: updatedGameState, actionMessage: message, delay: 5000 };
  }

  const message: ActionMessage = { type: "canDrink" };
  return { game: room.gameState, actionMessage: message, delay: 0 };
}

export async function checkDeathsAndAdvance(roomId: string, game: GameState): Promise<{
  actionMessage: ActionMessage;
  updatedGame?: GameState;
}> {
  const deadPlayers = game.players.filter((p) => p.lives <= 0);
  const room = await roomManager.getRoom(roomId);
  if (!room) {
    const message: ActionMessage = { type: "error", result: "No room found." };
    return { actionMessage: message };
  }
  if (deadPlayers.length > 0) {
    const nextround = game.currentRound.round + 1;
    const nextGame = nextRound(game, nextround);
    await roomManager.updateGameState(roomId, nextGame);
    if (nextGame.gameState !== "game_over") {
      const currentTurnId = nextGame.players[nextGame.activePlayerIndex].id;
      const { poisnousGoblets, holyGoblets } = nextGame.currentRound;
      const message: ActionMessage = {
        type: "announce",
        userId: currentTurnId,
        result: `${deadPlayers.map((p) => p.name).join(", ")} lost the round. Round ${nextround} has ${poisnousGoblets} poisnous and ${holyGoblets} holy goblets.`,
      };
      return { actionMessage: message, updatedGame: nextGame };
    }
    const message: ActionMessage = { type: "message", result: "Game Over!" };
    return { actionMessage: message, updatedGame: nextGame };
  }
  const message: ActionMessage = {
    type: "continue",
    result: "No deaths yet.",
  };
  return { actionMessage: message, updatedGame: room.gameState ?? game };
}
