import { roomManager } from "./roomManager";
import type { RoomData, PlayerConnectionState } from "../../../shared/types/types";
import logger from "../utils/logger";

const DISCONNECT_GRACE_MS = 60_000;

class ConnectionManager {
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private onAutoRemove:
    | ((roomId: string, playerId: string, roomData?: RoomData) => void)
    | null = null;

  setAutoRemoveHandler(
    handler: (roomId: string, playerId: string, roomData?: RoomData) => void
  ) {
    this.onAutoRemove = handler;
  }

  private getTimerKey(roomId: string, playerId: string): string {
    return `${roomId}:${playerId}`;
  }

  private upsertConnectionState(
    room: RoomData,
    state: PlayerConnectionState
  ): PlayerConnectionState[] {
    const states = room.connectionStates ?? [];
    const index = states.findIndex((s) => s.playerId === state.playerId);

    if (index === -1) {
      return [...states, state];
    }

    const updated = [...states];
    updated[index] = { ...states[index], ...state };
    return updated;
  }

  private clearDisconnectTimer(roomId: string, playerId: string) {
    const key = this.getTimerKey(roomId, playerId);
    const timer = this.disconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(key);
    }
  }

  private setDisconnectTimer(roomId: string, playerId: string) {
    const key = this.getTimerKey(roomId, playerId);
    this.clearDisconnectTimer(roomId, playerId);

    const timer = setTimeout(async () => {
      try {
        logger.warn(`Disconnect grace period expired for ${playerId} in room ${roomId}`);
        const updatedRoom = await roomManager.leaveRoom(roomId, playerId);
        this.onAutoRemove?.(roomId, playerId, updatedRoom);
      } catch (error) {
        logger.error("Failed to auto-remove disconnected player:", error);
      } finally {
        this.disconnectTimers.delete(key);
      }
    }, DISCONNECT_GRACE_MS);

    this.disconnectTimers.set(key, timer);
  }

  async handleDisconnect(roomId: string, socketId: string): Promise<RoomData | null> {
    const room = await roomManager.getRoom(roomId);
    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) {
      return room;
    }

    room.connectionStates = this.upsertConnectionState(room, {
      playerId: player.id,
      socketId,
      status: "disconnected",
      disconnectedAt: Date.now(),
    });

    await roomManager.updateRoom(roomId, room);
    await roomManager.refreshRoom(roomId);

    this.setDisconnectTimer(roomId, player.id);
    return room;
  }

  async handleReconnect(roomId: string, playerId: string, socketId: string): Promise<RoomData | null> {
    const room = await roomManager.getRoom(roomId);
    if (!room) {
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return null;
    }

    const currentState = room.connectionStates?.find(
      (state) => state.playerId === playerId
    );
    if (currentState?.status === "connected" && currentState.socketId !== socketId) {
      logger.warn(`Reconnect denied: player ${playerId} already connected`);
      return null;
    }

    player.socketId = socketId;

    room.connectionStates = this.upsertConnectionState(room, {
      playerId,
      socketId,
      status: "connected",
      disconnectedAt: undefined,
    });

    await roomManager.updateRoom(roomId, room);
    this.clearDisconnectTimer(roomId, playerId);

    return room;
  }
}

export const connectionManager = new ConnectionManager();
