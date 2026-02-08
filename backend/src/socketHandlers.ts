import { Server } from "socket.io";
import { z } from "zod";
import { roomManager } from "./rooms/roomManager";
import { connectionManager } from "./rooms/connectionManager";
import { playTurn, initializeGame, startRound } from "../../shared/logic/gameEngine";
import { ActionMessage, Contestant, Player, StatusEffect } from "../../shared/types/types";
import { handlePlayerTurn } from "./rooms/turnManager";
import { ActionSchema, CreateRoomSchema, JoinRoomSchema } from "./schemas/validation";
import { getEnv } from "./config/env";
import logger from "./utils/logger";

const RoomIdSchema = z.string().trim().min(1).max(50);
const StartGameSchema = z.object({ roomId: RoomIdSchema });
const GameReadySchema = z.object({ roomId: RoomIdSchema });
const LeaveRoomSchema = z.object({
  roomId: RoomIdSchema,
  playerId: z.string().min(1),
});
const KickPlayerSchema = z.object({
  roomId: RoomIdSchema,
  targetPlayerId: z.string().min(1),
});
const ReconnectRoomSchema = z.object({
  roomId: RoomIdSchema,
  playerId: z.string().min(1),
});
const PlayerActionSchema = z.object({
  roomId: RoomIdSchema,
  action: ActionSchema,
  delay: z.number().int().min(0).max(30000),
});
const VoiceOfferSchema = z.object({
  to: z.string().min(1),
  offer: z.unknown(),
});
const VoiceAnswerSchema = z.object({
  to: z.string().min(1),
  answer: z.unknown(),
});
const VoiceCandidateSchema = z.object({
  to: z.string().min(1),
  candidate: z.unknown(),
});

export function registerSocketHandlers(io: Server) {
  const metricsEnabled = getEnv().METRICS_MODE;

  connectionManager.setAutoRemoveHandler(async (roomId, playerId, roomData) => {
    io.to(roomId).emit("room_update", roomData ?? null);

    if (!roomData?.gameState) {
      return;
    }

    if (roomData.gameState.players.length === 1) {
      const actionMessage: ActionMessage = {
        type: "message",
        result: "GAME OVER!",
      };
      roomData.gameState.gameState = "game_over";
      await roomManager.updateGameState(roomId, roomData.gameState);
      io.to(roomId).emit("game_update", roomData.gameState, actionMessage, 5000);
      return;
    }

    const actionMessage: ActionMessage = {
      type: "announce",
      userId: playerId,
      result: "Player removed due to disconnect.",
    };
    io.to(roomId).emit("game_update", roomData.gameState, actionMessage, 5000);
  });

  io.on("connection", (socket) => {
    logger.info(`⚡ New client connected: ${socket.id}`);
    socket.emit("connected", socket.id);

    socket.on("create_room", async (payload) => {
        const parsed = CreateRoomSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid create_room payload.",
            issues: parsed.error.issues,
          });
          return;
        }

        const { host, maxPlayer, isPrivate, password, voiceChatEnabled } = parsed.data;
        const roomId = Math.random().toString(36).substring(2, 8);
        logger.info(`Creating room: ${roomId} by ${host.name}`);
        const player: Player = {
          id: host.id,
          name: host.name,
          socketId: socket.id,
        }
        const roomPassword = password ?? "";
        await roomManager.createRoom(roomId, player, maxPlayer, isPrivate, roomPassword, voiceChatEnabled);
        socket.join(roomId);

        const roomData = await roomManager.getRoom(roomId);
        io.to(roomId).emit("room_update", roomData); // broadcast to all in room
        socket.emit("room_created", roomData); // send only to creator
        if(!isPrivate) {
          const publicRooms = await roomManager.getPublicRooms();
          io.emit("public_rooms", publicRooms)
        }
    });

    socket.on("join_room", async (payload) => {
    const parsed = JoinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        message: "Invalid join_room payload.",
        issues: parsed.error.issues,
      });
      return;
    }

    try {
        const { roomId, player, password } = parsed.data;
        const newPlayer: Player = {
          id: player.id,
          name: player.name,
          socketId: socket.id,
        }
        await roomManager.joinRoom(roomId, newPlayer, password);
        socket.join(roomId);

        const room = await roomManager.getRoom(roomId);
        const isVoiceChatEnabled = room?.voiceChatEnabled;
        if(isVoiceChatEnabled) {
          socket.to(roomId).emit("voice-user-joined", { userId: socket.id });
        }

        io.to(roomId).emit("room_update", room);
    } catch (error: any) {
        logger.error(`Join room error for socket ${socket.id}:`, error.message);
        socket.emit("error", { message: error.message });
    }
    });

    socket.on("leave_room", async (payload) => {
    const parsed = LeaveRoomSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("error", {
        message: "Invalid leave_room payload.",
        issues: parsed.error.issues,
      });
      return;
    }

    const { roomId, playerId } = parsed.data;
    const roomData = await roomManager.getRoom(roomId);
    const leavingPlayer = roomData?.players.find(p => p.id === playerId)?.name ?? "A player";

    const newRoomData = await roomManager.leaveRoom(roomId, playerId);
    
    if (roomData?.voiceChatEnabled) socket.to(roomId).emit("leave-voice", socket.id);
    socket.leave(roomId);

    io.to(roomId).emit("room_update", newRoomData ?? null);
    if (newRoomData?.gameState) {
      if( newRoomData.gameState.players.length === 1) { 
        const actionMessage: ActionMessage = {
          type: "message",
          result: `GAME OVER!`,
        };
        newRoomData.gameState.gameState = 'game_over';
        io.to(roomId).emit("game_update", newRoomData.gameState, actionMessage, 5000);
      } else {
        const actionMessage: ActionMessage = {
          type: "announce",
          userId: playerId,
          result: `${leavingPlayer} has left the game.`,
          };
          io.to(roomId).emit("game_update", newRoomData.gameState, actionMessage, 5000);
      }
    }
    });

    socket.on("kick_player", async (payload) => {
      const parsed = KickPlayerSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", {
          message: "Invalid kick_player payload.",
          issues: parsed.error.issues,
        });
        return;
      }

      const { roomId, targetPlayerId } = parsed.data;
      const room = await roomManager.getRoom(roomId);
      if (!room) return;

      // Check if requester is the host
      const host = room.host;
      const requestingPlayer = room.players.find((p: Player) => p.socketId === socket.id);
      if (!requestingPlayer || requestingPlayer.id !== host.id) {
        socket.emit("error", { message: "Only the host can kick players." });
        return;
      }

      const targetPlayer = room.players.find((p: Player) => p.id === targetPlayerId);
      if (!targetPlayer) return;

      
      // Remove them from the room
      const newRoomData = await roomManager.leaveRoom(roomId, targetPlayerId);

      // Inform the kicked player (if connected)
      io.to(targetPlayer.socketId).emit("kicked");

      // remove voice 
      if(room.voiceChatEnabled) io.to(roomId).emit("leave-voice", targetPlayer.socketId);

      // remove from socket
      io.sockets.sockets.get(targetPlayer.socketId)?.leave(roomId);

      const updatedRoom = await roomManager.getRoom(roomId);
      io.to(roomId).emit("room_update", updatedRoom);

      if (newRoomData?.gameState) {
        if (newRoomData.gameState.players.length  === 1) {
          const actionMessage: ActionMessage = {
            type: "message",
            result: `GAME OVER!`,
          };
          newRoomData.gameState.gameState = 'game_over';
          io.to(roomId).emit("game_update", newRoomData.gameState, actionMessage, 5000);
        } else {
          const actionMessage: ActionMessage = {
            type: "announce",
            userId: requestingPlayer.id,
            result: `${targetPlayer.name} has been kicked out.`,
          };
          io.to(roomId).emit("game_update", newRoomData.gameState, actionMessage, 5000);
        }
      }

    });


    socket.on("fetch_rooms", async () => {
    logger.debug("Fetching public rooms...");
    const publicRooms = await roomManager.getPublicRooms();

    socket.emit("public_rooms", publicRooms);
    });

    socket.on("reconnect_room", async (payload) => {
      const parsed = ReconnectRoomSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", {
          message: "Invalid reconnect_room payload.",
          issues: parsed.error.issues,
        });
        return;
      }

      const { roomId, playerId } = parsed.data;
      const room = await connectionManager.handleReconnect(roomId, playerId, socket.id);
      if (!room) {
        socket.emit("reconnect_failed", { message: "Unable to reconnect to room." });
        return;
      }

      socket.join(roomId);
      if (room.voiceChatEnabled) {
        socket.to(roomId).emit("voice-user-joined", { userId: socket.id });
      }

      const playerName = room.players.find((p) => p.id === playerId)?.name ?? "Player";
      io.to(roomId).emit("room_update", room);

      if (room.gameState) {
        const actionMessage: ActionMessage = {
          type: "announce",
          userId: playerId,
          result: `${playerName} reconnected.`,
        };
        io.to(roomId).emit("game_update", room.gameState, actionMessage, 3000);

        const active = room.gameState.players[room.gameState.activePlayerIndex];
        if (active.id === playerId) {
          const turnMessage: ActionMessage = {
            type: "turn",
            userId: active.id,
            result: `It is ${active.name}'s turn.`,
          };
          io.to(roomId).emit("game_update", room.gameState, turnMessage, 2000);
        }
      }

      socket.emit("reconnect_success", { roomId });
    });


    socket.on("start_game", async (payload)=>{
        const parsed = StartGameSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid start_game payload.",
            issues: parsed.error.issues,
          });
          return;
        }
        const { roomId } = parsed.data;
        const room = await roomManager.getRoom(roomId);
        if(!room){
          logger.warn(`Start game failed: room ${roomId} not found`);
          return;
        } 
        const players = room.players;
        const gamePlayers: Contestant[] = players.map((p : Player) => ({
          id: p.id,
          name: p.name,
          lives: 3,
          items: [],
          isAI: false,
          isOnline: true,
          statusEffects: [],
        }));

        const initialized = initializeGame(gamePlayers);
        const started = startRound(initialized, 1);
        room.gameState = started;
        await roomManager.updateGameState(roomId, started);

        io.to(roomId).emit("game_started", room);


      });

    socket.on("game_ready", async (payload) =>{
        const parsed = GameReadySchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid game_ready payload.",
            issues: parsed.error.issues,
          });
          return;
        }
        const { roomId } = parsed.data;
        const room = await roomManager.getRoom(roomId);
        const game = room?.gameState;
        if(!room || !game) return;
        const { poisnousGoblets, holyGoblets } = game.currentRound;
        const currentTurnId = room.gameState?.players[room.gameState.activePlayerIndex].id;
        const roundStartMessage: ActionMessage = {
          type: 'announce',
          userId: currentTurnId,
          result: `Round ${game.currentRound.round} starts with ${poisnousGoblets} poisoned and ${holyGoblets} holy goblets.`
        };

        io.to(roomId).emit("game_update", game, roundStartMessage, 10000);

        setTimeout(async () => {
          const room = await roomManager.getRoom(roomId);
          if(!room || !room.gameState) return;    

          const active = room.gameState.players[room.gameState.activePlayerIndex];

            const turnMessage: ActionMessage = {
              type: "turn",
              userId: active.id,
              result: `It is ${active.name}'s turn.`,
            };

          io.to(roomId).emit("game_update",room.gameState, turnMessage, 2000);


          const result = await handlePlayerTurn(roomId, room.gameState)
          if(!result) return;
          room.gameState = result.game;
          await roomManager.updateGameState(roomId, result.game);
          
          setTimeout(() => {
            const messageType = result.actionMessage.type;
            if (messageType === 'refill' || messageType === 'error' || messageType === 'announce' || messageType === 'skip') {            
              io.to(roomId).emit("game_update", room.gameState, result.actionMessage, result.delay)
            }

          }, 2500);

        }, 10000);
    })

    socket.on("player_action", async (payload) => {
      const parsed = PlayerActionSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit("error", {
          message: "Invalid player_action payload.",
          issues: parsed.error.issues,
        });
        return;
      }

      const { roomId, action, delay } = parsed.data;
      const room = await roomManager.getRoom(roomId);
      if(!room || !room.gameState) return;

      if(action.type === 'steal') {
        if (!action.itemType || !action.targetPlayerId) {
          return;
        }
        const currentGame = room.gameState;
        const activePlayer = currentGame.players[currentGame.activePlayerIndex];
        const targetPlayer = currentGame.players.find((player: Contestant) => player.id === action.targetPlayerId);
        if (!targetPlayer) return;
        const itemIndex = targetPlayer.items.indexOf(action.itemType);
        if (itemIndex === -1) return;

        // simulating stealing by moving the item from target to active player inventory
        targetPlayer.items.splice(itemIndex, 1);
        activePlayer.items.push(action.itemType);

        // Remove "thief" status effect
        activePlayer.statusEffects = activePlayer.statusEffects.filter((effect: StatusEffect) => effect !== "thief");

      }

      const { updatedGame, actionMessage } = playTurn(room.gameState, action);
      room.gameState = updatedGame;
      await roomManager.updateGameState(roomId, updatedGame);

      io.to(roomId).emit("game_update", updatedGame, actionMessage, delay);

      setTimeout(async () => {
          const room = await roomManager.getRoom(roomId);
          if(!room || !room.gameState) return;    

          const active = room.gameState.players[room.gameState.activePlayerIndex];

            const turnMessage: ActionMessage = {
              type: "turn",
              userId: active.id,
              result: `It is ${active.name}'s turn.`,
            };

          io.to(roomId).emit("game_update",room.gameState, turnMessage, 2000);

          const result = await handlePlayerTurn(roomId, room.gameState)
          if(!result) return;
          room.gameState = result.game;
          await roomManager.updateGameState(roomId, result.game);

        setTimeout(() => {
            const messageType = result.actionMessage.type;
            if (messageType === 'refill' || messageType === 'error' || messageType === 'announce' || messageType === 'skip' || messageType === 'message') {
              io.to(roomId).emit("game_update", room.gameState, result.actionMessage, result.delay)
            }
          },2500);

      }, delay);
    });
    

    // Voice Chat Signaling

      socket.on("voice-offer", (payload) => {
        const parsed = VoiceOfferSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid voice-offer payload.",
            issues: parsed.error.issues,
          });
          return;
        }
        const { to, offer } = parsed.data;
        logger.debug(`🎤 Sending voice offer to ${to}`);
        io.to(to).emit("voice-offer", { from: socket.id, offer });
      });

      socket.on("voice-answer", (payload) => {
        const parsed = VoiceAnswerSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid voice-answer payload.",
            issues: parsed.error.issues,
          });
          return;
        }
        const { to, answer } = parsed.data;
        logger.debug(`Sending voice answer to ${to}`);
        io.to(to).emit("voice-answer", { from: socket.id, answer });
      });

      socket.on("voice-candidate", (payload) => {
        const parsed = VoiceCandidateSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit("error", {
            message: "Invalid voice-candidate payload.",
            issues: parsed.error.issues,
          });
          return;
        }
        const { to, candidate } = parsed.data;
        io.to(to).emit("voice-candidate", { from: socket.id, candidate });
      });

    if (metricsEnabled) {
      // ===== LATENCY MEASUREMENT: Ping/Pong for Socket.IO RTT =====
      socket.on("latency_ping", (timestamp: number) => {
        socket.emit("latency_pong", timestamp);
      });
    }

    socket.on("disconnecting", async () => {
      logger.info(`⚡ Client disconnected: ${socket.id}`);
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      for (const roomId of rooms) {
        socket.to(roomId).emit('leave-voice', socket.id)
        
        const updatedRoom = await connectionManager.handleDisconnect(roomId, socket.id);
        if (updatedRoom) {
          io.to(roomId).emit("room_update", updatedRoom);

          const disconnectedPlayer = updatedRoom.players.find(
            (p) => p.socketId === socket.id
          );
          if (updatedRoom.gameState && disconnectedPlayer) {
            const actionMessage: ActionMessage = {
              type: "announce",
              userId: disconnectedPlayer.id,
              result: `${disconnectedPlayer.name} disconnected. Reconnecting...`,
            };
            io.to(roomId).emit("game_update", updatedRoom.gameState, actionMessage, 3000);

            const active = updatedRoom.gameState.players[updatedRoom.gameState.activePlayerIndex];
            if (active.id === disconnectedPlayer.id) {
              const pauseMessage: ActionMessage = {
                type: "announce",
                userId: active.id,
                result: `Waiting for ${active.name} to reconnect...`,
              };
              io.to(roomId).emit("game_update", updatedRoom.gameState, pauseMessage, 3000);
            }
          }
        }
      }
    });
  });
}


