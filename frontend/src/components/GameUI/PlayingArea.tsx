import { useState, useEffect } from "react";
import ItemSelector from "./ItemSelector";
import type { Contestant, ItemType, RoomData, Score, PlayerConnectionState } from "../../../../shared/types/types";
import Typewriter from 'typewriter-effect';
import ItemHelp from "./ItemHelp";
import MusicSelector from "./MusicSelector";
import Scoreboard from "./Scoreboard";
import { GiScrollUnfurled } from "react-icons/gi";
import { GiMusicalNotes } from "react-icons/gi";
import { IoMdHelp } from "react-icons/io";
import { IoMdArrowDropdown } from "react-icons/io";
import { FaMicrophone, FaUserSlash } from "react-icons/fa6";
import VoiceSettings from "./VoiceSettings";
import KickPlayerSettings from "./KickPlayerSettings";




const PlayingArea = ({room, connectionStates, canStealItem,canDrink,myPlayerId, players, handleUseItem, handleStealItem, handleDrink, currentPlayerId, scoreChart }: {room?: RoomData, connectionStates?: PlayerConnectionState[], canStealItem:boolean, canDrink:boolean, myPlayerId:string, players: Contestant[], handleUseItem: (item: ItemType, targetId: string) => void; handleStealItem:(item:ItemType, targetId:string) => void; handleDrink:(targetId:string)=> void; currentPlayerId : string; scoreChart : Score[]}) => {
  const [pendingTargetSelect, setPendingTargetSelect] = useState<boolean>(false);
  const [itemSelected,setItemSelected] = useState<ItemType | null> (null);
  const [showHelp, setShowHelp] = useState(false);
  const playerCount = players.length;
  const [showMusicPopup, setShowMusicPopup] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showKickPlayerSettings,setShowKickPlayerSettings] = useState(false);




  const handleUseItemAndPlayer = (item: ItemType) => {
    const selfTargetingItems: ItemType[] = [
    'royal_scrutiny_glass', // use to see if the current shot is poisnous or holy
    'verdict_amplifier', // use to make the goblet twice poisonous or holy
    'crown_disavowal', // use to vaporise current goblet content 
    'sovereign_potion' ,// use to restore 1 life
    'chronicle_ledger' ,// use to see any random future goblet
    'paradox_dial', // use to flip the type of the current goblet (poisnous becomes holy, holy becomes poisnous)
    'thiefs_tooth'
    ];

    // 2. If the item is self-targeting
    if (selfTargetingItems.includes(item)) {
      handleUseItem(item, myPlayerId);
      return;
    }
    // 1. If only 1 opponent auto target them
    const otherPlayers = players.filter(p => p.id !== myPlayerId);
    if (otherPlayers.length === 1) {
      handleUseItem(item, otherPlayers[0].id);
      return;
    }

    setItemSelected(item);
    setPendingTargetSelect(true);
  };

   const handlePlayerClick = (player: Contestant) => {

    if(pendingTargetSelect && itemSelected){
      handleUseItem(itemSelected,player.id);
      setPendingTargetSelect(false);
      setItemSelected(null);
      return;
    }
    
    handleDrink(player.id);
    
  };



  return (
    <div className="relative w-full h-screen overflow-hidden">

      <div className="absolute top-4 right-4 z-40 flex flex-col gap-4 items-end">
        {/* Help Button */}
        <button
          onClick={() => setShowHelp(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
          title="Item Help"
        >
          <IoMdHelp />
        </button>

        {/* Music Button */}
        <button
          onClick={() => setShowMusicPopup(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
          title="Music Player"
        >
          <GiMusicalNotes />

        </button>

        {/* Scoreboard Button */}
        <button
          onClick={() => setShowScoreboard(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
          title="View Scoreboard"
        >
          <GiScrollUnfurled />
        </button>

        {/* Voice settings */}
        {
          room && room.voiceChatEnabled &&
        <button
          onClick={() => setShowVoiceSettings(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
          title="Voice Settings"
        >
          <FaMicrophone />
        </button>
        }

        {/* kick player settings */}
        {
          room && room.host.id === myPlayerId &&
        <button
          onClick={() => setShowKickPlayerSettings(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-all"
          title="Kick Players"
        >
          <FaUserSlash />
        </button>
        }
      </div>

      {showHelp && <ItemHelp onClose={() => setShowHelp(false)} />}
      {showMusicPopup && <MusicSelector onClose={() => setShowMusicPopup(false)} />}
      {showScoreboard && <Scoreboard scoreChart={scoreChart} onClose={() => setShowScoreboard(false)} />}
      {showVoiceSettings && room && <VoiceSettings onClose={()=> setShowVoiceSettings(false)} players={room.players} myPlayerId={myPlayerId} />}
      {showKickPlayerSettings && room && <KickPlayerSettings roomId={room?.id} players={room.players} myPlayerId={myPlayerId} hostId={room.host.id} onClose={()=> setShowKickPlayerSettings(false)} />}


      {/* Background */}
      <img
        src="/game_scenes/courtroom.png"
        alt="courtroom"
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
      />

      {/* choice text */}
      {
        canDrink && 
        <div className="font-cinzel w-full text-2xl text-center absolute  top-[10%] transform  ">
          <Typewriter
            options={{
              strings: ['Offer or Drink yourself...'],
              autoStart: true,
              loop: false,
              deleteSpeed: 99999999,        // Disable deletion
              delay: 50,              // Typing speed (optional)
              cursor:''
            }}/>
        </div>
      }

      {/* Player Grid */}
      <div
        className={`absolute w-full    top-1/2 transform  ${
          playerCount === 2 ? "-translate-y-[10%]" : "-translate-y-[20%]"
        } flex flex-col items-center space-y-4  `}
      >
        <div className="flex w-[500px] lg:w-[575px] justify-between   ">
          <PlayerImage currentPlayerId={currentPlayerId} connectionStates={connectionStates} canDrink={canDrink} handleStealItem={handleStealItem} canStealItem={canStealItem} myPlayerId={myPlayerId} pendingTargetSelect={pendingTargetSelect} index={1} player={players[0]} onClick={handlePlayerClick} />
          {playerCount >= 2 && <PlayerImage currentPlayerId={currentPlayerId} connectionStates={connectionStates} canDrink={canDrink} handleStealItem={handleStealItem}  canStealItem={canStealItem} myPlayerId={myPlayerId}  pendingTargetSelect={pendingTargetSelect} index={2} player={players[1]} onClick={handlePlayerClick} />}
        </div>
        {playerCount > 2 && (
          <div className="flex w-[500px] lg:w-[575px] justify-between   ">
            <PlayerImage currentPlayerId={currentPlayerId} connectionStates={connectionStates} canDrink={canDrink} handleStealItem={handleStealItem}  canStealItem={canStealItem} myPlayerId={myPlayerId}  pendingTargetSelect={pendingTargetSelect} index={3} player={players[2]} onClick={handlePlayerClick} />
            {playerCount === 4 && (
              <PlayerImage currentPlayerId={currentPlayerId} connectionStates={connectionStates} canDrink={canDrink}  handleStealItem={handleStealItem} canStealItem={canStealItem} myPlayerId={myPlayerId}  pendingTargetSelect={pendingTargetSelect} index={4} player={players[3]} onClick={handlePlayerClick} />
            )}
          </div>
        )}
      </div>

      {/* Item Selector */}
      <div className="absolute w-full bottom-0 p-4">
        <ItemSelector canUseItem={canDrink} onSelect={(item) => {
            handleUseItemAndPlayer(item);
        }} 
        items={players.find(p => p.id === myPlayerId)?.items || []}
        />
      </div>


    </div>
  );
};

export default PlayingArea;
const PlayerImage = ({
  index,
  player,
  onClick,
  pendingTargetSelect,
  myPlayerId,
  canStealItem,
  canDrink,
  handleStealItem,
  currentPlayerId,
  connectionStates
}: {
  index: number;
  player: Contestant;
  onClick: (p: Contestant, e: React.MouseEvent) => void;
  pendingTargetSelect: boolean;
  myPlayerId: string;
  canStealItem: boolean;
  canDrink: boolean;
  handleStealItem: (item: ItemType, targetId: string) => void;
  currentPlayerId: string;
  connectionStates?: PlayerConnectionState[];
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  const connectionState = connectionStates?.find(cs => cs.playerId === player.id);
  const isDisconnected = connectionState?.status === 'disconnected';

  useEffect(() => {
    if (!isDisconnected || !connectionState?.disconnectedAt) {
      setTimeRemaining(null);
      return;
    }

    // Set initial time immediately
    const elapsed = Math.floor((Date.now() - connectionState.disconnectedAt) / 1000);
    const remaining = Math.max(0, 60 - elapsed);
    setTimeRemaining(remaining);

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - connectionState.disconnectedAt!) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isDisconnected, connectionState, player.id]);

  return (
  <div
    className={`relative flex-shrink-0 items-center gap-0 ${
      index % 2 === 1 ? 'flex' : 'flex flex-row-reverse'
    }`}
  >
    {/* Player Image with interactivity */}
    <div
      className={`relative ${
        pendingTargetSelect && player.id !== myPlayerId
          ? 'drop-shadow-md drop-shadow-yellow-300'
          : canDrink
          ? 'hover:drop-shadow-md hover:drop-shadow-yellow-500'
          : ''
      } ${canDrink ? 'cursor-pointer' : 'cursor-not-allowed'} text-center`}
      onClick={(e) => {
        if (!canDrink) return;
        if (pendingTargetSelect) {
          if (myPlayerId !== player.id) {
            onClick(player, e);
          }
        } else {
          onClick(player, e);
        }
      }}
    >
        {player.id === currentPlayerId && (
          <div className="absolute  -top-8 left-1/2 -translate-x-1/2 z-30 text-5xl  text-yellow-300 drop-shadow-[0_0_12px_#d4af37]">
            <IoMdArrowDropdown />
          </div>
        )}

      <img
        src={`/game_scenes/player.png`}
        alt={`Player ${player.id}`}
        className={`w-32 transition duration-300 ${
          index === 1 || index === 3 ? 'scale-x-[-1]' : ''
        } ${!canDrink ? 'grayscale opacity-60' : ''}`}
      />

      {/* Disconnect Badge and Timer */}
      {isDisconnected && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-3 py-1 rounded text-sm font-bold flex flex-col items-center gap-1 whitespace-nowrap">
          <div>Disconnected</div>
          <div className="text-yellow-300 font-semibold">{timeRemaining ?? '60'}s</div>
        </div>
      )}
    </div>

    {/* Player UI panel */}
    <div className="flex flex-col items-center gap-2 px-2 py-3 bg-[#1e1e1e]/90 shadow-[inset_0_0_10px_#000] text-white font-cinzel w-[120px]">
      {/* Name */}
      <span className="text-sm tracking-wider text-white">
        {player.name}
      </span>

      {/* Health - Souls */}
      <div className="flex flex-wrap gap-[2px]">
        {Array.from({ length: player.lives }).map((_, i) => (
          <img
            key={i}
            src="/game_ui/souls.png"
            alt="soul"
            className="w-5 h-5 drop-shadow-[0_0_6px_#000]"
          />
        ))}
      </div>

      {/* Inventory (only show for others) */}
      {player.id !== myPlayerId && (
      <div className="grid grid-cols-2 place-items-center bg-[#121212] p-1 rounded border border-[#444] w-[90px] h-[90px]">
        {Array.from({ length: 4 }).map((_, i) => {
          const item = player.items[i];
          return item ? (
            <img
              key={i}
              src={`/items/${item}.png`}
              alt={item}
              className={`w-8 h-8 object-contain border border-yellow-600 bg-zinc-800 ${
                canStealItem ? 'shadow-[0_0_8px_#cf8a09] cursor-pointer' : 'grayscale opacity-60 cursor-not-allowed'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (canStealItem) {
                  handleStealItem(item, player.id);
                }
              }}
            />
          ) : (
            <div
              key={i}
              className="w-8 h-8 border border-zinc-700 bg-zinc-900 opacity-40 rounded"
            />
          );
        })}
      </div>
      )}

    </div>
  </div>
  );
};
