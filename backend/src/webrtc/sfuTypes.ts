/**
 * WebRTC SFU (Selective Forwarding Unit) Type Definitions
 * 
 * This module defines the abstraction layer for SFU implementations.
 * Supports multiple backends: LiveKit, Mediasoup, custom implementations.
 */

/**
 * SFU Provider Type
 * Determines which SFU backend to use
 */
export type SFUProvider = 'livekit' | 'mediasoup' | 'mock';

/**
 * Voice room participant
 */
export interface VoiceParticipant {
  /** Player ID (matches Socket.IO socketId) */
  id: string;
  /** Display name */
  name: string;
  /** SFU-specific participant ID (may differ from id) */
  sfuParticipantId: string;
  /** Is participant's audio muted */
  muted: boolean;
  /** Timestamp when joined */
  joinedAt: number;
}

/**
 * Voice room state managed by SFU
 */
export interface VoiceRoom {
  /** Room ID (matches game room ID) */
  id: string;
  /** SFU-specific room ID (may differ from id) */
  sfuRoomId: string;
  /** Participants in the room */
  participants: Map<string, VoiceParticipant>;
  /** Is room active */
  active: boolean;
  /** Timestamp when created */
  createdAt: number;
  /** SFU-specific metadata */
  sfuMetadata?: Record<string, any>;
}

/**
 * SFU Manager interface - all implementations must follow this
 */
export interface ISFUManager {
  /**
   * Initialize SFU manager
   */
  initialize(): Promise<void>;

  /**
   * Shutdown SFU manager and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Create a new voice room
   */
  createVoiceRoom(roomId: string): Promise<VoiceRoom>;

  /**
   * Delete a voice room and disconnect all participants
   */
  deleteVoiceRoom(roomId: string): Promise<void>;

  /**
   * Add a participant to a voice room
   */
  addParticipant(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<VoiceParticipant>;

  /**
   * Remove a participant from a voice room
   */
  removeParticipant(roomId: string, participantId: string): Promise<void>;

  /**
   * Get join token for participant (for WebRTC connection)
   * This token allows the participant to join the SFU room
   */
  getJoinToken(
    roomId: string,
    participantId: string,
    name: string
  ): Promise<string>;

  /**
   * Get all participants in a room
   */
  getParticipants(roomId: string): Promise<VoiceParticipant[]>;

  /**
   * Check if a room exists
   */
  roomExists(roomId: string): Promise<boolean>;

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Promise<VoiceRoom | null>;

  /**
   * Update participant mute status
   */
  updateParticipantMute(
    roomId: string,
    participantId: string,
    muted: boolean
  ): Promise<void>;

  /**
   * Get all rooms currently managed
   */
  getAllRooms(): Promise<VoiceRoom[]>;

  /**
   * Health check for SFU backend
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Event that SFU manager can emit
 */
export interface SFUEvent {
  type:
    | 'participant-joined'
    | 'participant-left'
    | 'participant-muted'
    | 'participant-unmuted'
    | 'room-created'
    | 'room-deleted'
    | 'error';
  roomId: string;
  participantId?: string;
  data?: Record<string, any>;
  error?: Error;
}

/**
 * SFU Manager event emitter interface
 */
export interface ISFUEventEmitter {
  on(event: SFUEvent['type'], listener: (event: SFUEvent) => void): void;
  off(event: SFUEvent['type'], listener: (event: SFUEvent) => void): void;
  emit(event: SFUEvent): void;
}

/**
 * SFU Configuration
 */
export interface SFUConfig {
  provider: SFUProvider;
  /** Maximum room TTL in ms (0 = no expiration) */
  roomTTL: number;
  /** Provider-specific configuration */
  providerConfig?: Record<string, any>;
}
