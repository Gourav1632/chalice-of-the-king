
import { useEffect, useRef, useState } from "react";
import { SocketContext } from "../contexts/SocketContext";
import { Socket, io } from "socket.io-client";
import { reconnectRoom } from "../utils/socket";
import { getOrCreatePlayerId, getStoredRoomId } from "../utils/reconnection";
const URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";


export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket>(io(URL, { autoConnect: false, transports: ["websocket"] }));
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket.connected) socket.connect();

    socket.on("connected", (socketId: string) => {
      setSocketId(socketId);
      const roomId = getStoredRoomId();
      if (roomId) {
        const playerId = getOrCreatePlayerId();
        reconnectRoom(socket, roomId, playerId);
      }
    });

    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        setIsReconnecting(true);
      }
    });

    socket.on("reconnect", () => {
      setIsReconnecting(false);
      const roomId = getStoredRoomId();
      if (roomId) {
        const playerId = getOrCreatePlayerId();
        reconnectRoom(socket, roomId, playerId);
      }
    });

    socket.on("reconnect_failed", () => {
      setIsReconnecting(false);
    });


    return () => {
      socket.off("connected");
      socket.off("disconnect");
      socket.off("reconnect");
      socket.off("reconnect_failed");
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, socketId, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
};