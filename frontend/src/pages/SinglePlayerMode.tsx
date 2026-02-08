import { useState, useEffect } from "react";
import EventArea from '../components/GameUI/EventArea';
import PlayingArea from '../components/GameUI/PlayingArea';
import GameOverScreen from '../components/GameUI/GameOverScreen';
import {
  initializeGame,
  startRound,
  playTurn,
  refillChambers,
  skipIfChained,
  nextRound
} from "../../../shared/logic/gameEngine";

import type { ActionMessage, ItemType, Contestant, GameState } from "../../../shared/types/types";
import TutorialPrompt from "../components/GameUI/TutorialPrompt";
import { useNavigate } from "react-router-dom";
import { useAiWorker } from "../hooks/useAiWorker";


function SinglePlayerMode() {
  const [game, setGame] = useState<GameState | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [gameMessage, setGameMessage] = useState<string | null>(null);
  const [canStealItem, setCanStealItem] = useState<boolean>(false);
  const [canDrink, setCanDrink] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState<boolean>(false);
  const [hasMadeTutorialChoice, setHasMadeTutorialChoice] = useState<boolean>(false);
  const [countdown, setCountdown] = useState(9);
  const navigate = useNavigate();
  const { runAiTurn } = useAiWorker();

  useEffect(()=>{
    if(!localStorage.getItem("hasSeenTutorial")) {
      setShowTutorialPrompt(true);
    } else {
      setHasMadeTutorialChoice(true);
    }
  },[])


  const handleCancelTutorial = () => {
    localStorage.setItem("hasSeenTutorial", "true");
    setHasMadeTutorialChoice(true);
    setShowTutorialPrompt(false);
  }

  const handleStartTutorial = () => {
    localStorage.setItem("hasSeenTutorial", "true");
    setHasMadeTutorialChoice(true);
    setShowTutorialPrompt(false);
    navigate('/tutorial')
  }


  useEffect(()=>{
    if(!game || game.gameState == 'loading' || game.gameState == 'game_over') return;
    const active = game.players[game.activePlayerIndex]
    const introMessage: ActionMessage = {
      type: 'turn',
      userId: active.id,
      result: `It is ${active.name}'s turn`,
    };
    if(game.activePlayerIndex === 0){
      triggerEvent(introMessage,2000,()=>{
        handlePlayerTurn(game);
      })
    }else{
      triggerEvent(introMessage,2000,()=>{
        handleAITurn(game);
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[game?.activePlayerIndex]);

  useEffect(() => {
  if (!game || game.activePlayerIndex !== 0) return;
  handlePlayerTurn(game);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [game?.players[0].statusEffects?.join(",")]);


  // Utility to trigger an event and pause game logic until EventArea finishes
  function triggerEvent(action: ActionMessage, delay: number, next?: () => void) {
    setActionMessage(action); // Show the message
    setCanDrink(false) // disable player interaction when event
    setTimeout(() => {
      if (next) next();       // Continue the game logic after delay
    }, delay);
  }


  function checkDeathsAndAdvance(game: GameState): boolean {
    const deadPlayers = game.players.filter(p => p.lives <= 0);
    if (deadPlayers.length > 0) {
      setLoading(true);
      const nextround = game.currentRound.round + 1;
      const updatedGame = nextRound(game, nextround);
      const {holyGoblets, poisnousGoblets} = updatedGame.currentRound;
      if (updatedGame.gameState !== "game_over") {
        setGameMessage(`${deadPlayers.map(p => p.name).join(', ')} lost the round. Round ${nextround} starts with ${poisnousGoblets} poisoned and ${holyGoblets} holy goblets.`);
        setTimeout(() => {
          setLoading(false);
          // check if after new round turn is human's
          if (!updatedGame.players[updatedGame.activePlayerIndex].isAI) setCanDrink(true);
          setGame(updatedGame);
        }, 5000);
      } else {
        setGame(updatedGame);
      }
      return true;
    } 
    return false;
  }

  useEffect(() => {

    if (!hasMadeTutorialChoice) return;
    setLoading(true);
    const humanPlayer: Contestant = {
      id: "human",
      name: "You",
      lives: 3,
      items: [],
      isAI: false,
      isOnline: true,
      statusEffects: [],
    };

    const automatonPlayer: Contestant = {
      id: "Revenant",
      name: "Revenant",
      lives: 3,
      items: [],
      isAI: true,
      isOnline: false,
      statusEffects: [],
    };


    const gamePlayers = [humanPlayer, automatonPlayer];
    const initialized = initializeGame(gamePlayers);
    const started = startRound(initialized, 1);
    // fetch round config
    const { poisnousGoblets, holyGoblets } = started.currentRound;
    const roundStartMessage: ActionMessage = {
      type: 'announce',
      result: `Round ${started.currentRound.round} starts with ${poisnousGoblets} poisoned and ${holyGoblets} holy goblets.`
    };
    setGameMessage(roundStartMessage.result ?? "");


      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        setLoading(false);
        setGame(started);
      }, 10000);
  }, [hasMadeTutorialChoice]);

  


  function handlePlayerTurn(game:GameState){
    const active = game.players[game.activePlayerIndex];


    // check if round is over 
    const advanceRound = checkDeathsAndAdvance(game);
    if(advanceRound) return;

    // check if player is chained
    const skipResult = skipIfChained(game, active);
    if (skipResult) {
      const { updatedGame, actionMessage } = skipResult;
      triggerEvent(actionMessage,5000, ()=>{
        setGame(updatedGame); 
      });
      return;
    }

    // player status is thief 
    if (active.statusEffects.includes("thief")) {
      setCanStealItem(true);
      return;
    }

    // check if all goblets are over
    if (game.gobletsRemaining === 0 && game.gameState === "playing") {
      const updatedGame = refillChambers(game);
      const message: ActionMessage = {
        type: 'refill',
        userId: game.players[game.activePlayerIndex].id,
        result: `Guard refills the goblets. It has ${updatedGame.currentRound.holyGoblets} holy and ${updatedGame.currentRound.poisnousGoblets} poisoned goblets.`
        };
      triggerEvent(message,5000,()=>{
        setGame(updatedGame);
        handlePlayerTurn(updatedGame);
      });
      return;
    }

    setCanDrink(true);
  }

  async function handleAITurn(game:GameState){
    setCanDrink(false);
    const active = game.players[game.activePlayerIndex];

    // check if round is over 
    const advanceRound = checkDeathsAndAdvance(game);
    if(advanceRound) return;

    // check if player is chained
    const skipResult = skipIfChained(game, active);
    if (skipResult) {
      const { updatedGame, actionMessage } = skipResult;
      triggerEvent(actionMessage,5000, ()=>{
        setGame(updatedGame); 
      });
      return;
    }

    // check if all goblets are over
    if (game.gobletsRemaining === 0 && game.gameState === "playing") {
      const updatedGame = refillChambers(game);
      const message: ActionMessage = {
        type: 'refill',
        userId: game.players[game.activePlayerIndex].id,
        result: `Guard refills the goblets. It has ${updatedGame.currentRound.holyGoblets} holy and ${updatedGame.currentRound.poisnousGoblets} poisoned goblets.`
        };
      triggerEvent(message,5000,()=>{
        setGame(updatedGame);
        handleAITurn(updatedGame);
      });
      return;
    }

    const {updatedGame,actionMessage} = await runAiTurn(game);
    triggerEvent(actionMessage,5000,()=>{
      setGame(updatedGame);

      // Only continue turn if AI used item and it's still their turn
      const AIUsedArtifact = actionMessage.type === "artifact_used"
      const AISurvivedSelfShot = actionMessage.type === 'drink' && actionMessage.targetId == actionMessage.userId && actionMessage.result === 'HOLY'
      if ( (AIUsedArtifact || AISurvivedSelfShot)  && updatedGame.players[updatedGame.activePlayerIndex].isAI) {
        handleAITurn(updatedGame); // Recursively call for next step
      }
    })

  }


const handleDrink = (targetId: string) => {
  if (!game || game.gameState !== "playing") return;

  const { updatedGame, actionMessage } = playTurn(game, {
    type: "drink",
    targetPlayerId: targetId
  });

  triggerEvent(actionMessage, 5000, () => {
    const roundEnded = checkDeathsAndAdvance(updatedGame);
    if (roundEnded) return;

    if (updatedGame.gobletsRemaining === 0 && updatedGame.gameState === "playing") {
      const refilledGame = refillChambers(updatedGame);
      const refillMsg: ActionMessage = {
        type: 'refill',
        userId: updatedGame.players[updatedGame.activePlayerIndex].id,
        result: `Guard refills the goblets. It has ${refilledGame.currentRound.holyGoblets} holy and ${refilledGame.currentRound.poisnousGoblets} poisoned goblets.`
      };
      triggerEvent(refillMsg, 5000, () => {
        setGame(refilledGame);
        setCanDrink(true);
      });
    } else {
      setGame(updatedGame);
      setCanDrink(true);
    }
  });
};


  const handleUseItem = (item: ItemType, targetId: string) => {
    if (!game || game.gameState !== "playing") return;

    const { updatedGame, actionMessage } = playTurn(game, {
      type: "use_item",
      itemType: item,
      targetPlayerId: targetId
    });

    triggerEvent(actionMessage,5000,()=>{
      setGame(updatedGame);
      setCanDrink(true);
    });
  };

  const handleStealItem = (item: ItemType, targetId: string) => {
    if (!game) return;
    setCanStealItem(false);
    const { updatedGame, actionMessage } = playTurn(game, {
      type: "use_item",
      itemType: item,
      targetPlayerId: targetId
    });

    // again check thief status of updated game
    const isThief = updatedGame.players[game.activePlayerIndex].statusEffects.includes('thief');
    
    triggerEvent(actionMessage,5000,()=>{
      // edge case: check if user has again got thief status for stealing thief's tooth from opponent
      if (isThief){
        setCanStealItem(true);
        setCanDrink(false);
      } 
      else {
        setCanStealItem(false);
        setCanDrink(true);
      } 
      setGame(updatedGame);
    });
  };

if (game?.gameState === "game_over") {
  return (
    <GameOverScreen
      scoreChart={game.scoreChart}
      onRestart={() => {
        window.location.reload();
      }}
    />
  );
}


if (loading) return (
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
        <span className="text-red-600 font-cinzel font-bold">Remember — </span> 
        <span className="font-bold">{gameMessage}</span>
      </p>
      <p className="italic">
        Choose wisely... <span className="text-red-700">I’d hate to see you die too soon.</span>
      </p>
      {/* Countdown */}
        <p className="text-2xl text-red-700 font-bold mb-4">The Game begins in... {countdown}</p>
    </div>
  </div>
);



  return (
    <div className="flex w-full h-screen bg-black text-white">


    {showTutorialPrompt && (
      <div
        className="fixed inset-0 z-10 flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: "url('/game_ui/intro.webp')" }}
      >
        <TutorialPrompt onCancel={handleCancelTutorial} onStart={handleStartTutorial} />
      </div>
    )}

      {/* Mobile view  */}
      {/* Left Panel - Game Scene */}
      <div className={` ${ canDrink || canStealItem ? 'w-[100%]' : 'w-0'} lg:hidden relative bg-table-pattern`}>
        {game && game.players && gameMessage &&
          <PlayingArea
            currentPlayerId={game.players[game.activePlayerIndex].id}
            handleDrink={handleDrink}
            handleStealItem={handleStealItem}
            canStealItem={canStealItem}
            canDrink={canDrink}
            myPlayerId={game.players[0].id}
            handleUseItem={handleUseItem}
            players={game.players}
            scoreChart={game.scoreChart}

          />
        }
      </div>

      {/* Right Panel - Event Log / Animations */}
      <div className={` ${ !canDrink && !canStealItem ? 'w-[100%]' : 'w-0'}  lg:hidden overflow-y-auto bg-zinc-900 border-l border-gray-700`}>
        {game && actionMessage &&
          <EventArea
            myPlayerId={game.players[0].id}
            players={game.players}
            actionMessage={actionMessage}
          />
        }
      </div>


      {/* Desktop view  */}
      {/* Left Panel - Game Scene */}
      <div className={` w-[60%] hidden lg:flex relative bg-table-pattern`}>
        {game && game.players && gameMessage &&
          <PlayingArea
            handleDrink={handleDrink}
            handleStealItem={handleStealItem}
            canStealItem={canStealItem}
            canDrink={canDrink}
            myPlayerId={game.players[0].id}
            handleUseItem={handleUseItem}
            players={game.players}
            currentPlayerId={game.players[game.activePlayerIndex].id}
            scoreChart={game.scoreChart}

          />
        }
      </div>

      {/* Right Panel - Event Log / Animations */}
      <div className={`w-[40%] hidden lg:flex overflow-y-auto bg-zinc-900 border-l border-gray-700`}>
        {game && actionMessage &&
          <EventArea
            myPlayerId={game.players[0].id}
            players={game.players}
            actionMessage={actionMessage}
          />
        }
      </div>

      
    </div>
  );
}

export default SinglePlayerMode;
