import { v4 as uuidv4 } from "uuid";

const PLAYER_ID_KEY = "playerId";
const ROOM_ID_KEY = "roomId";

export const getOrCreatePlayerId = (): string => {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const newId = uuidv4();
  localStorage.setItem(PLAYER_ID_KEY, newId);
  return newId;
};

export const getStoredRoomId = (): string | null => {
  return localStorage.getItem(ROOM_ID_KEY);
};

export const setStoredRoomId = (roomId: string) => {
  localStorage.setItem(ROOM_ID_KEY, roomId);
};

export const clearStoredRoomId = () => {
  localStorage.removeItem(ROOM_ID_KEY);
};
