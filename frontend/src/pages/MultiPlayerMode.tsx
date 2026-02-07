import { useState, useEffect, useContext } from "react";
import EventArea from '../components/GameUI/EventArea';
import PlayingArea from '../components/GameUI/PlayingArea';
import type { ActionMessage, ItemType, GameState, RoomData } from "../../../shared/types/types";
import { emitPlayerAction, gameReady, leaveRoom, onGameUpdate, onKicked, onRoomUpdate } from "../utils/socket";
import { useSocket } from "../contexts/SocketContext";
import { useNavigationBlocker } from "../hooks/useNavigationBlocker";
import ConfirmLeaveModal from "../components/GameUI/ConfirmLeaveModal";
import GameOverScreen from "../components/GameUI/GameOverScreen";
import { useNavigate } from "react-router-dom";
import ReconnectingModal from "../components/ReconnectingModal";
import { clearStoredRoomId } from "../utils/reconnection";
import AppStateContext from "../contexts/AppStateContext";

function MultiPlayerMode({room, myPlayerId}:{room: RoomData | null, myPlayerId: string | null}) {
  
  const [game, setGame] = useState<GameState | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [gameMessage, setGameMessage] = useState<string | null>("gamme message tmp");
  const [canStealItem, setCanStealItem] = useState<boolean>(false);
  const [canDrink, setCanDrink] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showEventArea, setShowEventArea] = useState<boolean>(true);
  const [hasBeenKicked, setHasBeenKicked] = useState<boolean>(false);
  const {socket, isReconnecting} = useSocket();
  const navigate = useNavigate();

  const state = useContext(AppStateContext);
  const { setRoomData } = state || {};

  const { isModalOpen, confirmLeave, cancelLeave } = useNavigationBlocker(
    {
    shouldBlock: () =>  true,
    onConfirm: () => {
      leaveRoom(socket, room?.id ?? "", myPlayerId ?? "");
      clearStoredRoomId();
      navigate('/')
    }
  });  

  // Listen for room updates (both for reconnection and active gameplay)
  useEffect(() => {
    if (!myPlayerId) return;

    onRoomUpdate(socket, (updatedRoom) => {
      if (setRoomData) {
        setRoomData(updatedRoom);
      }
    });

    return () => {
      socket.off("room_update");
    };
  }, [myPlayerId, socket, setRoomData]);

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // Show browser's native confirm dialog
    e.preventDefault();
    e.returnValue = ''; // Required for Chrome
  };

  const handleUnload = () => {
    // This only runs if user actually confirms (reloads or closes tab)
    return;
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("unload", handleUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
    window.removeEventListener("unload", handleUnload);
  };
}, [room, myPlayerId, socket]);

  
useEffect(() => {
  if (!room?.id) return;

  function updateTurnState(gameState: GameState) {
    const currentTurn = gameState.players[gameState.activePlayerIndex];
    const isMyTurn = myPlayerId === currentTurn.id;
    const isThief = currentTurn.statusEffects.includes("thief");
    
    if (!isMyTurn) {
      setCanDrink(false);
    } else {
      if (isThief){
        setCanDrink(false);
        setCanStealItem(true);
      } 
      else {
        setCanDrink(true);
        setCanStealItem(false);
      } 
    }
    setShowEventArea(false);
  }

  onGameUpdate(socket,(gameState, action, delay) => {
      if (gameState.gobletsRemaining === 0) {
        setCanDrink(false);
        setCanStealItem(false);
        setActionMessage(null);
      }

      if (gameState.gameState === 'game_over') {
        setCanDrink(false);
        setCanStealItem(false);
        setActionMessage(null); // Ensure EventArea is not rendered
        setGame(gameState); // Trigger GameOverScreen
        return;
      }
    if (action.type === "announce" && action.result) {
      // Skip showing disconnect-related announcements (they'll be shown on player image)
      if (action.result.includes("Waiting")) {
        setGame(gameState);
        updateTurnState(gameState);
        return;
      }

      setLoading(true);
      setGameMessage(action.result);
      setTimeout(() => {
        setLoading(false);
        setGame(gameState);
        updateTurnState(gameState); // ✅ ensure proper turn state
      }, delay);
    }  else {
      triggerEvent(action, delay, () => {
        setGame(gameState);
        updateTurnState(gameState); // ✅ ensure proper turn state
      });
    }
  });

    onKicked(socket, ()=> {
      setGame(null);
      setHasBeenKicked(true);
      clearStoredRoomId();
    })

  gameReady(socket,room.id);

  return () => {
    socket.off("kicked");
    socket.off("game_update");
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [room?.id, myPlayerId]);



  // Utility to trigger an event and pause game logic until EventArea finishes
  function triggerEvent(action: ActionMessage, delay: number, next?: () => void) {
    setShowEventArea(true);
    setActionMessage(action); // Show the message
    setCanDrink(false) // disable player interaction when event
    setTimeout(() => {
      if (next) next();       // Continue the game logic after delay
    }, delay);
  }



  const handleDrink = (targetId: string) => {
    if (!room || !room.gameState) return;
    // immediately setting the can drink and can steal to false to prevent spamming, without wait for server game update
    setCanDrink(false);
    setCanStealItem(false);
    const actionMessage = {
      type: "drink",
      targetPlayerId: targetId
    };
    
    emitPlayerAction(socket, room?.id, actionMessage ,5000);

  };

  const handleUseItem = (item: ItemType, targetId: string) => {
    if (!room || !room.gameState) return;
    // immediately setting the can drink and can steal to false to prevent spamming, without wait for server game update
    setCanDrink(false);
    setCanStealItem(false);
    const actionMessage  = {
      type: "use_item",
      itemType: item,
      targetPlayerId: targetId
    };

    emitPlayerAction(socket, room.id, actionMessage, 5000);
  };

  const handleStealItem = (item: ItemType, targetId: string) => {
    if (!room || !room.gameState) return;
    setCanStealItem(false);
    setCanDrink(false);
    const  actionMessage  = {
      type: "use_item",
      itemType: item,
      targetPlayerId: targetId
    };

    emitPlayerAction(socket, room.id, actionMessage, 5000);
  };

if (game?.gameState === "game_over") {
  return (
    <div>
      <GameOverScreen
       isMultiplayer={true}
       scoreChart={game.scoreChart}
       onRestart={() => {
       }}
      />
      <ConfirmLeaveModal
        isOpen={isModalOpen}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

if (!room || !myPlayerId || hasBeenKicked) {
  return (
    <>
      <ReconnectingModal isOpen={isReconnecting} />
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white font-medievalsharp text-center px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-yellow-400">Oops!</h1>
        <p className="text-xl md:text-2xl mb-6">
          {hasBeenKicked ? `You have been kicked out by the host.` : `Looks like you've entered an area you weren't supposed to.`}
        </p>
        <p className="text-md md:text-lg text-gray-300 mb-10">
          Please go back and join or create a new room to continue your journey.
        </p>
        <button
          onClick={()=> navigate("/")}
          className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 transition-colors rounded text-black font-bold text-lg"
        >
          Return Home
        </button>

        <ConfirmLeaveModal
          isOpen={isModalOpen}
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />

      </div>
    </>
  );
}


if (loading) return (
  <>
    <ReconnectingModal isOpen={isReconnecting} />
    <div
      className="fixed p-4 inset-0 w-full h-full z-0 bg-cover bg-center flex items-center justify-center font-medievalsharp"
      style={{ backgroundImage: "url('/game_ui/intro.webp')" }}
    >
      {/* Main parchment box */}
      <div
        className="relative px-10 py-8 text-black text-center text-3xl md:text-4xl leading-relaxed font-medium shadow-xl max-w-4xl w-full border-[4px] border-[#c49b38] rounded-none"
        style={{
    backgroundColor: 'rgba(225, 201, 122, 0.7)', // slightly see-through
    boxShadow: 'inset 0 0 25px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.35)'
  }}

      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-6 h-6 bg-[#c49b38]" />
        <div className="absolute top-0 right-0 w-6 h-6 bg-[#c49b38]" />
        <div className="absolute bottom-0 left-0 w-6 h-6 bg-[#c49b38]" />
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-[#c49b38]" />

        {/* Text Content */}
        <p className="mb-4">
          <span className="text-red-600 font-bold">Remember —</span> {gameMessage}
        </p>
        <p className="italic">
          Choose wisely... <span className="text-red-700">I’d hate to see you die too soon.</span>
        </p>
      </div>
    </div>
  </>
);



return (
  <>
  <ReconnectingModal isOpen={isReconnecting} />
  <div className="flex w-full h-screen bg-black text-white">

      <ConfirmLeaveModal
        isOpen={isModalOpen}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

{/* Mobile view - Game Scene */}
<div className="w-[100%] lg:hidden relative bg-table-pattern">
  {game && game.players && myPlayerId &&
    <PlayingArea
      room={room}
      connectionStates={room?.connectionStates}
      handleDrink={handleDrink}
      handleStealItem={handleStealItem}
      canStealItem={canStealItem}
      canDrink={canDrink}
      myPlayerId={myPlayerId}
      handleUseItem={handleUseItem}
      players={game.players}
      currentPlayerId={game.players[game.activePlayerIndex].id}
      scoreChart={game.scoreChart}
    />
  }
  
  {/* Overlay EventArea when needed */}
  {game && myPlayerId && showEventArea && actionMessage && (
    <div className="absolute inset-0 z-50 bg-zinc-900 bg-opacity-95 overflow-y-auto border-l border-gray-700">
      <EventArea
        myPlayerId={myPlayerId}
        players={game.players}
        actionMessage={actionMessage}
      />
    </div>
  )}
</div>



      {/* Desktop view  */}
      {/* Left Panel - Game Scene */}
      <div className={` w-[60%] hidden lg:flex relative bg-table-pattern`}>
        {game && game.players && myPlayerId && 
          <PlayingArea
            room={room}
            connectionStates={room?.connectionStates}
            handleDrink={handleDrink}
            handleStealItem={handleStealItem}
            canStealItem={canStealItem}
            canDrink={canDrink}
            myPlayerId={myPlayerId}
            handleUseItem={handleUseItem}
            players={game.players}
            currentPlayerId={game.players[game.activePlayerIndex].id}
            scoreChart={game.scoreChart}

          />
        }
      </div>

      {/* Right Panel - Event Log / Animations */}
      <div className={`w-[40%] hidden lg:flex overflow-y-auto bg-zinc-900 border-l border-gray-700`}>
        {game && actionMessage && myPlayerId &&
          <EventArea
            myPlayerId={myPlayerId}
            players={game.players}
            actionMessage={actionMessage}
          />
        }
      </div>
    </div>
    </>
  );
}



export default MultiPlayerMode;
