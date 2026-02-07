// backend/src/rooms/roomManager.ts
import { GameState, Player, RoomData } from "../../../shared/types/types";
import { roomRepository } from "../repositories/roomRepository";
import logger from "../utils/logger";

/**
 * RoomManager - Refactored to use Redis for distributed state management
 * All methods are now async to support Redis operations
 */
class RoomManager {
  /**
   * Create a new room and persist to Redis
   */
  async createRoom(
    roomId: string, 
    host: Player, 
    maxPlayers: number, 
    isPrivate: boolean, 
    password: string, 
    voiceChatEnabled: boolean = false
  ): Promise<void> {
    // Check if room already exists
    const exists = await roomRepository.roomExists(roomId);
    if (exists) {
      throw new Error('Room already exists');
    }

    const roomData: RoomData = {
      id: roomId,
      host: host,
      players: [host],
      maxPlayers: maxPlayers,
      isPrivate: isPrivate,
      password: password,
      gameState: null,
      voiceChatEnabled: voiceChatEnabled,
      connectionStates: [
        {
          playerId: host.id,
          socketId: host.socketId,
          status: "connected",
        },
      ],
    };

    await roomRepository.saveRoom(roomId, roomData);
    logger.info(`Room created: ${roomId} (host: ${host.name})`);
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, player: Player, password?: string): Promise<void> {
    const room = await roomRepository.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found. Please refresh to fetch new rooms.');
    }

    if (room.isPrivate && password !== room.password) {
      throw new Error('Incorrect password');
    }

    const alreadyJoined = room.players.some(p => p.id === player.id);
    if (alreadyJoined) {
      throw new Error('Player already in room');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    room.players.push(player);
    room.connectionStates = [
      ...(room.connectionStates ?? []),
      {
        playerId: player.id,
        socketId: player.socketId,
        status: "connected",
      },
    ];
    await roomRepository.saveRoom(roomId, room);
    logger.info(`Player ${player.name} joined room: ${roomId}`);
  }

  /**
   * Leave a room and handle cleanup
   */
  async leaveRoom(roomId: string, playerId: string): Promise<RoomData | undefined> {
    const room = await roomRepository.getRoom(roomId);
    if (!room) {
      logger.warn(`Leave room failed: Room ${roomId} not found`);
      return undefined;
    }

    // If gameState exists, handle removal from game logic
    if (room.gameState) {
      const gamePlayers = room.gameState.players;
      const indexOfLeavingPlayer = gamePlayers.findIndex(p => p.id === playerId);
      const currentIndex = room.gameState.activePlayerIndex;

      // Remove player from gameState
      room.gameState.players = gamePlayers.filter(p => p.id !== playerId);

      // Update turn if necessary
      if (indexOfLeavingPlayer === currentIndex) {
        room.gameState.activePlayerIndex %= room.gameState.players.length;
      } else if (indexOfLeavingPlayer < currentIndex) {
        room.gameState.activePlayerIndex -= 1;
      }
    }

    // Remove from general player list
    room.players = room.players.filter(p => p.id !== playerId);
    room.connectionStates = (room.connectionStates ?? []).filter(
      (state) => state.playerId !== playerId
    );

    // Remove room if empty
    if (room.players.length === 0) {
      await roomRepository.deleteRoom(roomId);
      logger.info(`Room deleted (empty): ${roomId}`);
      return undefined;
    }

    // Reassign host if host left
    if (room.host.id === playerId) {
      room.host = room.players[0];
      logger.info(`New host assigned in room ${roomId}: ${room.host.name}`);
    }

    await roomRepository.saveRoom(roomId, room);
    logger.info(`Player ${playerId} left room: ${roomId}`);
    return room;
  }

  /**
   * Get all public rooms that are open for joining
   */
  async getPublicRooms() {
    const publicRooms = await roomRepository.getPublicRooms();
    
    // Filter out full rooms and rooms with active games
    const availableRooms = [];
    
    for (const publicRoom of publicRooms) {
      const room = await roomRepository.getRoom(publicRoom.id);
      
      if (room && room.players.length < room.maxPlayers && room.gameState === null) {
        availableRooms.push(publicRoom);
      }
    }

    return availableRooms;
  }

  /**
   * Get a specific room by ID
   */
  async getRoom(roomId: string): Promise<RoomData | undefined> {
    const room = await roomRepository.getRoom(roomId);
    return room ?? undefined;
  }

  /**
   * Get all rooms (for admin/debugging)
   */
  async getAllRooms(): Promise<[string, RoomData][]> {
    const roomIds = await roomRepository.getAllRoomIds();
    const rooms: [string, RoomData][] = [];

    for (const roomId of roomIds) {
      const room = await roomRepository.getRoom(roomId);
      if (room) {
        rooms.push([roomId, room]);
      }
    }

    return rooms;
  }

  /**
   * Update game state for a room
   */
  async updateGameState(roomId: string, gameState: GameState): Promise<void> {
    const room = await roomRepository.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    room.gameState = gameState;
    await roomRepository.saveRoom(roomId, room);
    logger.debug(`Game state updated for room: ${roomId}`);
  }

  /**
   * Update room data (full overwrite)
   */
  async updateRoom(roomId: string, roomData: RoomData): Promise<void> {
    await roomRepository.saveRoom(roomId, roomData);
    logger.debug(`Room updated: ${roomId}`);
  }

  /**
   * Remove a room completely
   */
  async removeRoom(roomId: string): Promise<void> {
    await roomRepository.deleteRoom(roomId);
    logger.info(`Room removed: ${roomId}`);
  }

  /**
   * Check if a player exists in a room
   */
  async playerExists(roomId: string, playerId: string): Promise<boolean> {
    const room = await roomRepository.getRoom(roomId);
    return !!room?.players.some(p => p.id === playerId);
  }

  /**
   * Check if a room exists
   */
  async roomExists(roomId: string): Promise<boolean> {
    return await roomRepository.roomExists(roomId);
  }

  /**
   * Refresh room TTL (to keep active rooms alive)
   */
  async refreshRoom(roomId: string): Promise<void> {
    await roomRepository.refreshRoomTTL(roomId);
  }
}

export const roomManager = new RoomManager();
