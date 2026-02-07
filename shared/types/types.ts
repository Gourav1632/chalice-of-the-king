  // Status effects a player can have
  export type StatusEffect = 'chained' | 'amplified' | 'thief' | string;

  export type ActionMessage = {
    type: 'drink' | 'artifact_used' | 'skip' | 'refill' | 'message' | 'refill' | 'announce' | 'turn' | string;
    item?: ItemType;
    userId?: string;
    targetId?: string;
    result?:  string;
  };

  // All possible item types
  export type ItemType =
    | 'royal_scrutiny_glass' // use to see if the current shot is poisnous or holy
    | 'verdict_amplifier' // use to make the goblet twice poisonous or holy
    | 'crown_disavowal' // use to vaporise current goblet content 
    | 'royal_chain_order' // use to restrain an opponent, preventing them from taking actions for one turn
    | 'sovereign_potion' // use to restore 1 life
    | 'chronicle_ledger' // use to see any random future goblet
    | 'paradox_dial' // use to flip the type of the current goblet (poisnous becomes holy, holy becomes poisnous)
    | 'thiefs_tooth'
    |string
    ; // use to steal the opponent's item

  // Player/Contestant model
  export interface Contestant {
    id: string;
    name: string;
    lives: number;
    items: ItemType[];
    isAI: boolean;
    isOnline: boolean;
    statusEffects: StatusEffect[];
  }

  export type Player =  {
    id:string;
    name: string;
    socketId: string;
  }

  export type PlayerConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'abandoned';

  export interface PlayerConnectionState {
    playerId: string;
    socketId: string;
    status: PlayerConnectionStatus;
    disconnectedAt?: number;
  }

  export type Score = {
    playerId: string;
    name: string;
    score: number;
  }

  export type GameStatePhase = 'loading' | 'playing' | 'round_over' | 'game_over';

  export interface GameState {
    players: Contestant[];
    currentRound: RoundConfig;
    activePlayerIndex: number;
    goblets: boolean[];
    currentGobletIndex: number;
    gobletsRemaining: number;
    turnOrderDirection: 'clockwise' | 'counter-clockwise';
    gameState: GameStatePhase;
    scoreChart : Score[]; 
  } 

  export type RoundConfig = {
    round: number;
    poisnousGoblets: number;
    holyGoblets: number;
    lives: number;
    itemCount: number;
    suddenDeath: boolean;
  };

  export interface RoomData {
      id: string,
      host: Player,
      players: Player[],
      maxPlayers: number,
      isPrivate: boolean,
      password: string,
      gameState: GameState | null;
      voiceChatEnabled: boolean;
      connectionStates?: PlayerConnectionState[];
  }

  export interface PublicRoomData {
    id: string;
    host: Player;
    playersActive: number;
    maxPlayers: number;
    voiceChatEnabled: boolean;
}