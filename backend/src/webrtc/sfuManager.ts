/**
 * SFU Manager - Abstraction layer for WebRTC Selective Forwarding Unit
 * 
 * Supports multiple SFU backends:
 * - LiveKit Cloud (production-ready, managed)
 * - Mediasoup (self-hosted, open-source)
 * - Mock (testing/development)
 */

import { EventEmitter } from 'events';
import {
  ISFUManager,
  ISFUEventEmitter,
  SFUConfig,
  VoiceRoom,
  VoiceParticipant,
  SFUEvent,
  SFUProvider,
} from './sfuTypes';
import logger from '../utils/logger';

/**
 * Mock SFU Implementation (for development/testing)
 * Replace with actual implementation based on config
 */
class MockSFUImplementation extends EventEmitter implements ISFUManager {
  private rooms: Map<string, VoiceRoom> = new Map();
  private config: SFUConfig;

  constructor(config: SFUConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Mock SFU Manager initialized');
  }

  async shutdown(): Promise<void> {
    this.rooms.clear();
    logger.info('🛑 Mock SFU Manager shutdown');
  }

  async createVoiceRoom(roomId: string): Promise<VoiceRoom> {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    const room: VoiceRoom = {
      id: roomId,
      sfuRoomId: `sfu-${roomId}`,
      participants: new Map(),
      active: true,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    logger.info(`✅ Voice room created: ${roomId}`);
    
    // Emit event through proper EventEmitter interface
    this.emit('sfu-event', {
      type: 'room-created',
      roomId,
      data: { sfuRoomId: room.sfuRoomId },
    } as SFUEvent);

    return room;
  }

  async deleteVoiceRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    // Disconnect all participants
    for (const participantId of room.participants.keys()) {
      await this.removeParticipant(roomId, participantId);
    }

    this.rooms.delete(roomId);
    logger.info(`🗑️ Voice room deleted: ${roomId}`);
    
    // Emit event through proper EventEmitter interface
    this.emit('sfu-event', {
      type: 'room-deleted',
      roomId,
    } as SFUEvent);
  }

  async addParticipant(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<VoiceParticipant> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (room.participants.has(participantId)) {
      throw new Error(`Participant ${participantId} already in room`);
    }

    const participant: VoiceParticipant = {
      id: participantId,
      name,
      sfuParticipantId: `p-${participantId}`,
      muted: false,
      joinedAt: Date.now(),
    };

    room.participants.set(participantId, participant);
    logger.info(
      `👤 Participant joined room: ${participantId} in ${roomId}`
    );
    
    // Emit event through proper EventEmitter interface
    this.emit('sfu-event', {
      type: 'participant-joined',
      roomId,
      participantId,
      data: { name, sfuParticipantId: participant.sfuParticipantId },
    } as SFUEvent);

    return participant;
  }

  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const participant = room.participants.get(participantId);
    if (!participant) {
      throw new Error(`Participant ${participantId} not in room`);
    }

    room.participants.delete(participantId);
    logger.info(
      `👋 Participant left room: ${participantId} from ${roomId}`
    );
    
    // Emit event through proper EventEmitter interface
    this.emit('sfu-event', {
      type: 'participant-left',
      roomId,
      participantId,
    } as SFUEvent);
  }

  async getJoinToken(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<string> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    // Mock token - in real impl would be signed JWT or provider token
    const token = Buffer.from(
      JSON.stringify({
        roomId,
        participantId,
        name,
        exp: Date.now() + 3600000, // 1 hour
      })
    ).toString('base64');

    logger.debug(`🔑 Join token generated for ${participantId} in ${roomId}`);
    return token;
  }

  async getParticipants(roomId: string): Promise<VoiceParticipant[]> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    return Array.from(room.participants.values());
  }

  async roomExists(roomId: string): Promise<boolean> {
    return this.rooms.has(roomId);
  }

  async getRoom(roomId: string): Promise<VoiceRoom | null> {
    return this.rooms.get(roomId) || null;
  }

  async updateParticipantMute(
    roomId: string,
    participantId: string,
    muted: boolean
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const participant = room.participants.get(participantId);
    if (!participant) {
      throw new Error(`Participant ${participantId} not in room`);
    }

    participant.muted = muted;
    const eventType = muted ? 'participant-muted' : 'participant-unmuted';
    logger.debug(`🔇 Participant ${participantId} muted: ${muted}`);
    
    // Emit event through proper EventEmitter interface
    this.emit('sfu-event', {
      type: eventType,
      roomId,
      participantId,
      data: { muted },
    } as SFUEvent);
  }

  async getAllRooms(): Promise<VoiceRoom[]> {
    return Array.from(this.rooms.values());
  }

  async healthCheck(): Promise<boolean> {
    // Mock always healthy
    return true;
  }
}

/**
 * Main SFU Manager - Factory for different implementations
 */
export class SFUManager extends EventEmitter implements ISFUManager {
  private implementation: ISFUManager;
  private config: SFUConfig;

  constructor(config: SFUConfig) {
    super();
    this.config = config;

    // Create appropriate implementation based on provider
    switch (config.provider) {
      case 'mock':
        this.implementation = new MockSFUImplementation(config);
        break;
      case 'livekit':
        logger.warn(
          '⚠️ LiveKit not yet implemented. Using mock implementation. Set SFU_PROVIDER=mock'
        );
        this.implementation = new MockSFUImplementation(config);
        break;
      case 'mediasoup':
        logger.warn(
          '⚠️ Mediasoup not yet implemented. Using mock implementation. Set SFU_PROVIDER=mock'
        );
        this.implementation = new MockSFUImplementation(config);
        break;
      default:
        throw new Error(`Unknown SFU provider: ${config.provider}`);
    }

    // Forward events from implementation
    (this.implementation as any).on('error', (event: SFUEvent) =>
      this.emit('sfu-event', event)
    );
    (this.implementation as any).on('participant-joined', (event: SFUEvent) =>
      this.emit('sfu-event', event)
    );
    (this.implementation as any).on('participant-left', (event: SFUEvent) =>
      this.emit('sfu-event', event)
    );
    (this.implementation as any).on('participant-muted', (event: SFUEvent) =>
      this.emit('sfu-event', event)
    );
    (this.implementation as any).on('participant-unmuted', (event: SFUEvent) =>
      this.emit('sfu-event', event)
    );
  }

  async initialize(): Promise<void> {
    await this.implementation.initialize();
  }

  async shutdown(): Promise<void> {
    await this.implementation.shutdown();
  }

  async createVoiceRoom(roomId: string): Promise<VoiceRoom> {
    return this.implementation.createVoiceRoom(roomId);
  }

  async deleteVoiceRoom(roomId: string): Promise<void> {
    await this.implementation.deleteVoiceRoom(roomId);
  }

  async addParticipant(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<VoiceParticipant> {
    return this.implementation.addParticipant(roomId, participantId, name);
  }

  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    await this.implementation.removeParticipant(roomId, participantId);
  }

  async getJoinToken(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<string> {
    return this.implementation.getJoinToken(roomId, participantId, name);
  }

  async getParticipants(roomId: string): Promise<VoiceParticipant[]> {
    return this.implementation.getParticipants(roomId);
  }

  async roomExists(roomId: string): Promise<boolean> {
    return this.implementation.roomExists(roomId);
  }

  async getRoom(roomId: string): Promise<VoiceRoom | null> {
    return this.implementation.getRoom(roomId);
  }

  async updateParticipantMute(
    roomId: string,
    participantId: string,
    muted: boolean
  ): Promise<void> {
    await this.implementation.updateParticipantMute(
      roomId,
      participantId,
      muted
    );
  }

  async getAllRooms(): Promise<VoiceRoom[]> {
    return this.implementation.getAllRooms();
  }

  async healthCheck(): Promise<boolean> {
    return this.implementation.healthCheck();
  }
}

// Singleton instance
let sfuManager: SFUManager | null = null;

/**
 * Get or create SFU manager singleton
 */
export function getSFUManager(
  config?: SFUConfig
): SFUManager {
  if (!sfuManager) {
    const finalConfig = config || {
      provider: (process.env.SFU_PROVIDER as SFUProvider) || 'mock',
      roomTTL: parseInt(process.env.SFU_ROOM_TTL || '0'),
      providerConfig: {},
    };
    sfuManager = new SFUManager(finalConfig);
  }
  return sfuManager;
}
