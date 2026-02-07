// utils/socketHandlers.ts
import type { ActionMessage, GameState, PublicRoomData, RoomData } from "../../../shared/types/types";
import { Socket } from "socket.io-client";

// --- Emitters ---
export const createRoom = (
  socket: Socket,
  host: { id: string; name: string },
  maxPlayer: number,
  isPrivate: boolean,
  password: string = "",
  voiceChatEnabled: boolean
) => {
  socket.emit("create_room", { host, maxPlayer, isPrivate, password, voiceChatEnabled });
};

export const joinRoom = (
  socket: Socket,
  roomId: string,
  player: { id: string; name: string },
  password?: string
) => {
  socket.emit("join_room", { roomId, player, password });
};

export const fetchPublicRooms = (socket: Socket) => {
  socket.emit("fetch_rooms");
};

export const emitPlayerAction = (
  socket: Socket,
  roomId: string,
  action: ActionMessage,
  delay: number
) => {
  socket.emit("player_action", { roomId, action, delay });
};

export const leaveRoom = (
  socket: Socket,
  roomId: string,
  playerId: string,
) => {
  socket.emit("leave_room", { roomId, playerId });
};

export const kickPlayer = (
  socket: Socket,
  roomId: string,
  targetPlayerId: string,
) => {
  socket.emit("kick_player", {roomId, targetPlayerId})
};

export const startGame = (socket: Socket, roomId: string) => {
  socket.emit("start_game", { roomId });
};

export const gameReady = (socket: Socket, roomId: string) => {
  socket.emit("game_ready", { roomId });
};

export const reconnectRoom = (
  socket: Socket,
  roomId: string,
  playerId: string
) => {
  socket.emit("reconnect_room", { roomId, playerId });
};


// voice chat related emitters

export const sendVoiceAnswer = (
  socket: Socket,
  to: string,
  answer: RTCSessionDescriptionInit
) => {
  socket.emit("voice-answer", { to, answer });
};

export const sendVoiceOffer = (
  socket: Socket,
  to: string,
  offer: RTCSessionDescriptionInit
) => {
  socket.emit("voice-offer", { to, offer });
};

export const sendVoiceCandidate = (
  socket: Socket,
  to: string,
  candidate: RTCIceCandidate
) => {
  socket.emit("voice-candidate", { to, candidate });
};




// --- Listeners ---
export const onGameUpdate = (
  socket: Socket,
  callback: (game: GameState, action: ActionMessage, delay: number) => void
) => {
  socket.on("game_update", callback);
};

export const onKicked = (
  socket: Socket,
  callback: () => void
) => {
  socket.on("kicked", callback);
}

export const onRoomUpdate = (
  socket: Socket,
  callback: (roomData: RoomData) => void
) => {
  socket.on("room_update", callback);
};

export const onError = (
  socket: Socket,
  callback: (err: { message: string }) => void
) => {
  socket.on("error", callback);
};

export const onRoomCreate = (
  socket: Socket,
  callback: (roomData: RoomData) => void
) => {
  socket.on("room_created", callback);
};

export const onPublicRoomsReceived = (
  socket: Socket,
  callback: (publicRooms: PublicRoomData[]) => void
) => {
  socket.on("public_rooms", callback);
};

export const onGameStarted = (
  socket: Socket,
  callback: (roomData: RoomData) => void
) => {
  socket.on("game_started", callback);
};

export const onReconnectSuccess = (
  socket: Socket,
  callback: (data: { roomId: string }) => void
) => {
  socket.on("reconnect_success", callback);
};

export const onReconnectFailed = (
  socket: Socket,
  callback: (data: { message: string }) => void
) => {
  socket.on("reconnect_failed", callback);
};


// voice chat related listeners

export const onVoiceOffer = (
  socket: Socket,
  callback: (data: { from: string; offer: RTCSessionDescriptionInit }) => void
) => {
  socket.on("voice-offer", callback);
};

export const onVoiceAnswer = (
  socket: Socket,
  callback: (data: { from: string; answer: RTCSessionDescriptionInit }) => void
) => {
  socket.on("voice-answer", callback);
};

export const onVoiceCandidate = (
  socket: Socket,
  callback: (data: { from: string; candidate: RTCIceCandidate }) => void
) => {
  socket.on("voice-candidate", callback);
};

export const onVoiceUserJoined = (
  socket: Socket,
  callback: (data: { userId: string }) => void
) => {
  socket.on("voice-user-joined", callback);
};

export const onVoiceLeave = (
  socket: Socket,
  callback: (userId: string) => void
) => {
  socket.on("leave-voice", callback);
};




export const clearSocketListeners = (socket: Socket) => {
  socket.off("kicked");
  socket.off("room_created");
  socket.off("public_rooms");
  socket.off("game_started");
  socket.off("game_update");
  socket.off("room_update");
  socket.off("error");
  socket.off("voice-offer");
  socket.off("voice-answer");
  socket.off("voice-candidate");
  socket.off("voice-user-joined");
  socket.off("leave-voice");
  socket.off("reconnect_success");
  socket.off("reconnect_failed");

};


