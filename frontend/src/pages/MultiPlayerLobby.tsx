import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createRoom,
  onRoomCreate,
  onRoomUpdate,
  fetchPublicRooms,
  onPublicRoomsReceived,
  joinRoom,
  onError,
  leaveRoom,
  startGame,
  onGameStarted,
  kickPlayer,
  onKicked,
} from "../utils/socket";
import type { PublicRoomData, RoomData } from "../../../shared/types/types";
import { useSocket } from "../contexts/SocketContext";
import { FaMicrophone, FaMicrophoneSlash, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import { useNavigationBlocker } from "../hooks/useNavigationBlocker";
import ConfirmLeaveModal from "../components/GameUI/ConfirmLeaveModal";
import { useVoiceChatContext } from "../contexts/VoiceChatContext";
import { FaUserSlash } from "react-icons/fa6";
import { useSound } from "../hooks/sound";
import ReconnectingModal from "../components/ReconnectingModal";
import {
  clearStoredRoomId,
  getOrCreatePlayerId,
  setStoredRoomId,
} from "../utils/reconnection";




const MultiplayerLobby = ({
  setRoomData,
  setMyPlayerId,
}: {
  setRoomData: (roomData: RoomData) => void;
  setMyPlayerId: (myPlayerId: string | null) => void;
}) => {
  const [mode, setMode] = useState<"default" | "create" | "join">("default");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomData[]>([]);
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false);
  const shouldBlockRef = useRef(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasBeenKicked, setHasBeenKicked] = useState(false);
  const navigate = useNavigate();
  const {socket, isReconnecting} = useSocket();
  const {muteMap, setUserMuted} = useVoiceChatContext();
  const playSelectSound = useSound("/sounds/select.wav");

  const {isModalOpen, confirmLeave, cancelLeave} = useNavigationBlocker(
    {
    shouldBlock: () => mode === "create" && shouldBlockRef.current,
    onConfirm: () => {
      if (room && playerId) {
        leaveRoom(socket, room.id, playerId);
        setRoom(null);
        setMyPlayerId(null);
        setMode("default");
        clearStoredRoomId();
      }
    }});

    useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (room && playerId && shouldBlockRef.current) {
          e.preventDefault();
          e.returnValue = "";
        }
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [room, playerId, voiceChatEnabled, socket]);


  useEffect(() => {
    if (!socket.connected) socket.connect();

    onRoomCreate(socket, (roomData) => {
      setVoiceChatEnabled(roomData.voiceChatEnabled)
      setRoom(roomData);
      setRoomData(roomData);
      setStoredRoomId(roomData.id);
      setMode("create");
    });

    onRoomUpdate(socket, (roomData) => {
      setVoiceChatEnabled(roomData.voiceChatEnabled);
      setRoom(roomData);
      setRoomData(roomData);
      setMode(roomData ? "create" : "default");
      if (roomData?.id) {
        setStoredRoomId(roomData.id);
      } else {
        clearStoredRoomId();
      }
    });

    onKicked(socket, ()=> {
      setMode("default");
      setRoom(null);
      setVoiceChatEnabled(false);
      setMyPlayerId(null);
      clearStoredRoomId();
      setHasBeenKicked(true);
      setTimeout(()=>{
        setHasBeenKicked(false);
      },5000)
    })

    onPublicRoomsReceived(socket, (rooms) => {
      setPublicRooms(rooms);
    });

    onError(socket, (error) => setErrorMessage(error.message));

    onGameStarted(socket, (roomData) => {
      shouldBlockRef.current = false;
      setRoomData(roomData);
      navigate("/multiplayer");
    });

    return () => {
      socket.off("kicked");
      socket.off("game_started");
      socket.off("room_created");
      socket.off("room_update");
      socket.off("public_rooms");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreateRoom() {
    if (!name || (isPrivate && !password)) {
      setErrorMessage(isPrivate ? "Please enter name and password" : "Please enter name");
      return;
    }
    const playerId = getOrCreatePlayerId();
    const host = { id: playerId, name };
    setPlayerId(host.id);
    setMyPlayerId(host.id);
    createRoom(socket, host, maxPlayers, isPrivate, password, voiceChatEnabled);
  }

  function handlePublicRooms() {
    setMode("join");
    fetchPublicRooms(socket);
  }

  function handleJoinRoom(roomId: string, name: string, password?: string, isPrivate = false) {
    if (!name || (isPrivate && !password)) {
      setErrorMessage(isPrivate ? "Please enter name and password" : "Please enter name");
      return;
    }
    const playerId = getOrCreatePlayerId();
    const player = { id: playerId, name };
    setPlayerId(player.id);
    setMyPlayerId(player.id);
    joinRoom(socket,roomId, player, password);
  }

  function handleLeaveRoom() {
    if (!room || !playerId) return;
    leaveRoom(socket, room.id, playerId);
    setRoom(null);
    setRoomId("");
    setMode("default");
    clearStoredRoomId();
  }

  function handleKick(targetPlayerId : string) {
    if(room) kickPlayer(socket, room.id, targetPlayerId)
  }

  function handleStartGame() {
    if (room) startGame(socket, room.id);
  }

  return (
    <div className="relative flex items-center justify-center w-full min-h-screen overflow-auto">

      <ReconnectingModal isOpen={isReconnecting} />

      <ConfirmLeaveModal
        isOpen={isModalOpen}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
      {/* Background and Overlay */}
      <img
        src="/game_ui/homescreen.jpg"
        alt="Background"
        className="fixed inset-0 w-full h-full object-cover z-0"
      />
      <div className="fixed inset-0 bg-black/60 z-10" />

      {/* Main Container */}
      <div className="relative z-20 max-w-3xl mx-auto p-6 text-white font-medievalsharp">

       {/* Kick message  */}
       
      { hasBeenKicked && 
      <div className="fixed top-4 left-1/2 -translate-x-1/2 
        w-full max-w-[500px] mx-4 
        bg-[#2a2a2a] border-[6px] border-[#363636] p-4 
        shadow-[inset_0_0_8px_#000] text-yellow-400 text-2xl sm:text-3xl 
        font-medievalsharp flex items-center justify-center 
        text-center z-10 ">
        You have been kicked out of the room.
      </div>
      }

        <div className="relative">
          {/* Glowing Corners */}
          <div className="absolute w-2 h-2 bg-white top-[6px] left-[6px] shadow-[0_0_6px_#ffffff]" />
          <div className="absolute w-2 h-2 bg-white top-[6px] right-[6px] shadow-[0_0_6px_#ffffff]" />
          <div className="absolute w-2 h-2 bg-white bottom-[6px] left-[6px] shadow-[0_0_6px_#ffffff]" />
          <div className="absolute w-2 h-2 bg-white bottom-[6px] right-[6px] shadow-[0_0_6px_#ffffff]" />

          {/* Main Box */}
          <div className="bg-[#2a2a2a] border-[6px] border-[#363636] shadow-[inset_0_0_8px_#000] p-8 space-y-6">

            {/* Close Button */}
            <button
              onClick={()=> {
                playSelectSound();
                navigate("/")
              }}
              className="absolute top-3 right-4 text-white text-4xl hover:text-yellow-300"
              aria-label="Close Kick Player Settings"
            >
              &times;
            </button>

            <h1 className="text-3xl font-bold text-center text-yellow-400 tracking-wide font-cinzel">
              Multiplayer Lobby
            </h1>

            {/* ROOM ACTIVE */}
            {room ? (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-yellow-400">Room ID: {room.id}</h2>
                  <p className="text-sm text-gray-300">
                    {room.isPrivate ? "🔒 Private Room" : "🌐 Public Room"}
                  </p>
                </div>

                <div className="border border-zinc-700 p-4 rounded bg-zinc-800">
                  <h3 className="text-lg font-semibold mb-2">Players</h3>
                  <ul className="space-y-2">
                    {room.players.map((player) =>{
                      const isMuted = muteMap[player.socketId] ?? false;
                      const connectionStatus = room.connectionStates?.find(
                        (state) => state.playerId === player.id
                      )?.status;
                      const isReconnecting =
                        connectionStatus && connectionStatus !== "connected";
                      return (
                     <li key={player.id} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`${player.id === playerId ? 'text-green-400' : ''}`}>
                          {player.name}
                        </span>
                        {isReconnecting && (
                          <span className="text-xs font-semibold text-amber-400">
                            (reconnecting)
                          </span>
                        )}
                        {player.id === room.host.id && (
                          <span className="text-yellow-400 text-xs font-semibold">(host)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {voiceChatEnabled && (
                          player.id === playerId ? (
                            <button
                              onClick={() => setUserMuted(player.socketId, !isMuted)}
                              className="text-green-400 hover:text-green-600"
                              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                              title={isMuted ? "Unmute microphone" : "Mute microphone"}
                            >
                              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                            </button>
                          ) : (
                            <button
                              onClick={() => setUserMuted(player.socketId, !isMuted)}
                              className="text-yellow-400 hover:text-yellow-600"
                              aria-label={isMuted ? "Unmute speaker" : "Mute speaker"}
                              title={isMuted ? "Unmute speaker" : "Mute speaker"}
                            >
                              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                            </button>
                          )
                        )}

                        {/* 🔴 Kick button for host (excluding self) */}
                        {room.host.id === playerId && player.id !== playerId && (
                          <button
                            onClick={() => handleKick(player.id)}
                            className="text-red-500 hover:text-red-700"
                            aria-label="Kick player"
                            title="Kick player"
                          >
                            <FaUserSlash />
                          </button>
                        )}
                      </div>
                    </li>
                    )
                    })}
                  </ul>
                </div>

                {room.host.id === playerId && (
                  <button
                    onClick={handleStartGame}
                    disabled={room.players.length < 2}
                    className={`py-2 px-4 rounded  font-semibold w-full font-cinzel ${
                      room.players.length > 1?  "bg-green-500 hover:bg-green-600 text-black" : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Start Game
                  </button>
                )}

                <button
                  onClick={handleLeaveRoom}
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Leave Room
                </button>
              </>
            ) : mode === "create" ? (
              <>
              {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-4 py-2 text-white rounded bg-zinc-800"
                />
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="px-4 py-2 text-white rounded bg-zinc-800"
                >
                  {[2, 3, 4].map((count) => (
                    <option key={count} value={count}>
                      Max Players: {count}
                    </option>
                  ))}
                </select>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  Make Room Private
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={voiceChatEnabled}
                    onChange={(e) => setVoiceChatEnabled(e.target.checked)}
                  />
                  Enable Voice Chat
                </label>
                {isPrivate && (
                  <input
                    type="password"
                    placeholder="Room Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className= "w-full px-4 py-2 text-white rounded bg-zinc-800"
                  />
                )}
                <button
                  onClick={handleCreateRoom}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-black  py-2 px-4 rounded font-cinzel font-semibold"
                >
                  Create Game
                </button>
                <button
                  onClick={() => {
                    setMode("default")
                    setErrorMessage("");
                  }}
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Cancel
                </button>
              </>
            ) : mode === "join" ? (
              <>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-4 w-full py-2 text-white rounded bg-zinc-800"
                />
                {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}

                <div className="border border-zinc-700 p-4 rounded">
                  <h2 className="text-lg font-semibold text-yellow-400 font-cinzel">Private Room</h2>
                  <div className="flex flex-col lg:flex-row items-center  justify-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Room ID"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="w-full px-4  py-2 text-white rounded bg-zinc-800 "
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 text-white rounded bg-zinc-800 "
                    />
                    <button
                    onClick={() => handleJoinRoom(roomId, name, password, true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs sm:text-sm px-3 py-1 rounded font-cinzel font-semibold"
                  >
                    Join
                  </button>
                  </div>
                </div>

                <div className="border border-zinc-700 p-4 rounded">
                  <h2 className="text-lg font-semibold text-green-400 mb-2 font-cinzel">Public Rooms</h2>

                  <div className="flex flex-col gap-3">
                    {publicRooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-zinc-800 px-4 py-3 rounded"
                      >
                        <span className="text-white font-cinzel text-sm sm:text-base">
                          {room.host.name}
                        </span>
                        <span className="text-gray-300 text-xs sm:text-sm font-mono">
                          {room.id}
                        </span>
                        <span className="text-sm text-gray-400">
                          {room.playersActive}/{room.maxPlayers}
                        </span>
                        <span className="text-yellow-400 text-lg">
                          {room.voiceChatEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
                        </span>
                        <button
                          onClick={() => handleJoinRoom(room.id, name)}
                          className="bg-green-400 hover:bg-green-600 text-black text-xs sm:text-sm px-3 py-1 rounded font-cinzel font-semibold"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>


                <button
                  onClick={() => setMode("default")}
                  className="text-sm text-gray-400 hover:text-white underline"
                >
                  Back
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4">
                <button
                  onClick={() => {
                    playSelectSound();
                    setMode("create")
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black  py-2 px-4 w-full rounded font-cinzel font-semibold"
                >
                  Create Room
                </button>
                <button
                  onClick={()=> {
                    playSelectSound();
                    handlePublicRooms();
                  }}
                  className="bg-zinc-900 hover:bg-zinc-700 text-white  py-2 px-4 w-full rounded font-cinzel font-semibold"
                >
                  Join Room
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;
