import { createContext, useContext } from "react";
import { Socket } from "socket.io-client";



export type SocketContextType = {
  socket: Socket;
  socketId: string | null;
  isReconnecting: boolean;
};

export const SocketContext = createContext<SocketContextType | null>(null);



export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
