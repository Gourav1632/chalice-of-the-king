// AppLayout.tsx
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import AppStateContext from "./contexts/AppStateContext";
import { MusicProvider } from "./providers/MusicProvider";
import type { RoomData } from "../../shared/types/types";
import { getOrCreatePlayerId } from "./utils/reconnection";

const AppLayout = () => {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedPlayerId = getOrCreatePlayerId();
    setMyPlayerId(storedPlayerId);

    // Note: We store roomId but we rely on SocketProvider to fetch fresh room data
    // via the reconnect_room handler and room_update event
  }, []);

  return (
    <AppStateContext.Provider value={{ roomData, setRoomData, myPlayerId, setMyPlayerId }}>
      <MusicProvider>
        <Outlet />
      </MusicProvider>
    </AppStateContext.Provider>
  );
};

export default AppLayout;
