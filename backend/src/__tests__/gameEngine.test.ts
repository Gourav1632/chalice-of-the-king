import { describe, expect, test, beforeEach } from '@jest/globals';
import { initializeGame, startRound, playTurn } from '../../../shared/logic/gameEngine';
import type { Contestant, GameState } from '../../../shared/types/types';

describe('gameEngine', () => {
  let testPlayers: Contestant[];

  beforeEach(() => {
    testPlayers = [
      {
        id: 'player1',
        name: 'Alice',
        lives: 3,
        items: [],
        isAI: false,
        isOnline: true,
        statusEffects: [],
      },
      {
        id: 'player2',
        name: 'Bob',
        lives: 3,
        items: [],
        isAI: false,
        isOnline: true,
        statusEffects: [],
      },
    ];
  });

  describe('initializeGame', () => {
    test('should create initial game state with players', () => {
      const game = initializeGame(testPlayers);

      expect(game.players).toHaveLength(2);
      expect(game.players[0].id).toBe('player1');
      expect(game.players[1].id).toBe('player2');
      expect(game.gameState).toBe('loading');
      expect(game.goblets).toEqual([]);
      expect(game.scoreChart).toHaveLength(2);
      expect(game.scoreChart[0].score).toBe(0);
    });

    test('should assign random active player index', () => {
      const game = initializeGame(testPlayers);
      expect(game.activePlayerIndex).toBeGreaterThanOrEqual(0);
      expect(game.activePlayerIndex).toBeLessThan(testPlayers.length);
    });

    test('should initialize score chart correctly', () => {
      const game = initializeGame(testPlayers);
      expect(game.scoreChart[0].playerId).toBe('player1');
      expect(game.scoreChart[1].playerId).toBe('player2');
      expect(game.scoreChart[0].name).toBe('Alice');
      expect(game.scoreChart[1].name).toBe('Bob');
    });
  });

  describe('startRound', () => {
    test('should distribute goblets for round 1', () => {
      const game = initializeGame(testPlayers);
      const started = startRound(game, 1);

      expect(started.gameState).toBe('playing');
      expect(started.goblets.length).toBeGreaterThan(0);
      expect(started.gobletsRemaining).toBe(started.goblets.length);
      expect(started.currentGobletIndex).toBe(0);
    });

    test('should reset player lives and items each round', () => {
      const game = initializeGame(testPlayers);
      const started = startRound(game, 1);

      expect(started.players[0].lives).toBe(3);
      expect(started.players[1].lives).toBe(3);
      expect(started.players[0].items.length).toBeGreaterThan(0);
      expect(started.players[1].items.length).toBeGreaterThan(0);
    });

    test('should assign correct number of goblets for round 1', () => {
      const game = initializeGame(testPlayers);
      const started = startRound(game, 1);

      const poisonCount = started.goblets.filter(g => g === true).length;
      const holyCount = started.goblets.filter(g => g === false).length;

      expect(poisonCount).toBe(started.currentRound.poisnousGoblets);
      expect(holyCount).toBe(started.currentRound.holyGoblets);
    });

    test('should handle rounds beyond 3', () => {
      const game = initializeGame(testPlayers);
      const started = startRound(game, 4);
      
      expect(started.gameState).toBe('playing');
      expect(started.currentRound.round).toBe(4);
      expect(started.goblets.length).toBeGreaterThan(0);
    });
  });

  describe('playTurn - drink action', () => {
    let game: GameState;

    beforeEach(() => {
      const initialized = initializeGame(testPlayers);
      game = startRound(initialized, 1);
      game.activePlayerIndex = 0;
    });

    test('should return error if target player not found', () => {
      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'nonexistent',
      });

      expect(result.actionMessage.result).toContain('not found');
      expect(result.updatedGame).toEqual(game);
    });

    test('should decrease target lives on poisonous goblet', () => {
      // Force first goblet to be poisonous
      game.goblets[0] = true;
      const initialLives = game.players[1].lives;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player2',
      });

      expect(result.updatedGame.players[1].lives).toBe(initialLives - 1);
      expect(result.actionMessage.result).toBe('POISON');
    });

    test('should advance to next player after drinking poison', () => {
      game.goblets[0] = true;
      game.activePlayerIndex = 0;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player2',
      });

      expect(result.updatedGame.activePlayerIndex).toBe(1);
    });

    test('should award points for drinking poison (self)', () => {
      game.goblets[0] = true;
      const initialScore = game.scoreChart[0].score;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player1', // Self
      });

      expect(result.updatedGame.scoreChart[0].score).toBe(initialScore + 5);
    });

    test('should award points for giving poison to opponent', () => {
      game.goblets[0] = true;
      const initialScore = game.scoreChart[0].score;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player2',
      });

      expect(result.updatedGame.scoreChart[0].score).toBe(initialScore + 4);
    });

    test('should award points for drinking holy goblet (self)', () => {
      game.goblets[0] = false;
      const initialScore = game.scoreChart[0].score;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player1', // Self
      });

      expect(result.updatedGame.scoreChart[0].score).toBe(initialScore + 5);
      expect(result.actionMessage.result).toBe('HOLY');
    });

    test('should decrement gobletsRemaining', () => {
      const initialRemaining = game.gobletsRemaining;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player1',
      });

      expect(result.updatedGame.gobletsRemaining).toBe(initialRemaining - 1);
    });

    test('should advance currentGobletIndex', () => {
      const initialIndex = game.currentGobletIndex;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player1',
      });

      expect(result.updatedGame.currentGobletIndex).toBe(initialIndex + 1);
    });
  });

  describe('playTurn - amplified status', () => {
    let game: GameState;

    beforeEach(() => {
      const initialized = initializeGame(testPlayers);
      game = startRound(initialized, 1);
      game.activePlayerIndex = 0;
      game.players[0].statusEffects = ['amplified'];
    });

    test('should deal double damage with amplified status', () => {
      game.goblets[0] = true;
      const initialLives = game.players[1].lives;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player2',
      });

      expect(result.updatedGame.players[1].lives).toBe(initialLives - 2);
    });

    test('should remove amplified status after use', () => {
      game.goblets[0] = true;

      const result = playTurn(game, {
        type: 'drink',
        targetPlayerId: 'player2',
      });

      expect(result.updatedGame.players[0].statusEffects).not.toContain('amplified');
    });
  });

  describe('playTurn - use_item action', () => {
    let game: GameState;

    beforeEach(() => {
      const initialized = initializeGame(testPlayers);
      game = startRound(initialized, 1);
      game.activePlayerIndex = 0;
    });

    test('should return error if item not in inventory', () => {
      game.players[0].items = [];

      const result = playTurn(game, {
        type: 'use_item',
        itemType: 'royal_scrutiny_glass',
      });

      expect(result.actionMessage.result).toContain('not found');
    });

    test('should remove item from inventory after use', () => {
      game.players[0].items = ['sovereign_potion'];

      const result = playTurn(game, {
        type: 'use_item',
        itemType: 'sovereign_potion',
      });

      expect(result.updatedGame.players[0].items).not.toContain('sovereign_potion');
    });

    test('sovereign_potion should heal 1 life', () => {
      game.players[0].items = ['sovereign_potion'];
      game.players[0].lives = 2;

      const result = playTurn(game, {
        type: 'use_item',
        itemType: 'sovereign_potion',
      });

      expect(result.updatedGame.players[0].lives).toBe(3);
      expect(result.actionMessage.result).toBe('HEALED');
    });
  });
});
