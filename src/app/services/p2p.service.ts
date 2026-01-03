import { Injectable, signal, computed } from '@angular/core';
import Peer, { DataConnection } from 'peerjs';

export interface Participant {
  id: string; // Peer ID
  name: string;
  vote?: string | number | boolean | null;
  status: 'waiting' | 'voted';
}

export type VotingSystemType = 'fibonacci' | 'tshirt' | 'custom';

export interface GameState {
  revealed: boolean;
  participants: Participant[];
  votingSystem: VotingSystemType;
  customOptions?: string[];
}

export type MessageType = 'JOIN' | 'UPDATE_STATE' | 'VOTE' | 'REVEAL' | 'RESET' | 'KICK';

export interface Message {
  type: MessageType;
  payload?: any;
  senderId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class P2pService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // Only for Host
  private hostConnection: DataConnection | null = null; // Only for Client

  // State Signals
  readonly myPeerId = signal<string | null>(null);
  readonly isHost = signal<boolean>(false);
  readonly isConnected = signal<boolean>(false);

  // Game State
  readonly participants = signal<Participant[]>([]);
  readonly revealed = signal<boolean>(false);
  readonly votingSystem = signal<VotingSystemType>('fibonacci');
  readonly customOptions = signal<string[]>([]);

  readonly myName = signal<string>('Anonymous');

  constructor() {}

  // Initialize Peer
  initPeer(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Ensure we are in the browser
      if (typeof window === 'undefined') {
        reject('Cannot init peer on server');
        return;
      }

      if (id) {
        this.peer = new Peer(id);
      } else {
        this.peer = new Peer();
      }

      this.peer.on('open', (peerId) => {
        this.myPeerId.set(peerId);
        resolve(peerId);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  // --- Host Logic ---

  startHosting(name: string, system: VotingSystemType = 'fibonacci', options: string[] = []) {
    this.isHost.set(true);
    this.myName.set(name);
    this.votingSystem.set(system);
    this.customOptions.set(options);
    this.participants.set([{
      id: this.myPeerId()!,
      name: name,
      status: 'waiting',
      vote: null
    }]);
    this.isConnected.set(true);
  }

  private handleIncomingConnection(conn: DataConnection) {
    if (!this.isHost()) {
      conn.close();
      return;
    }

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.broadcastState();
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data as Message, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.removeParticipant(conn.peer);
    });
  }

  private removeParticipant(peerId: string) {
    this.participants.update(prev => prev.filter(p => p.id !== peerId));
    this.broadcastState();
  }

  // --- Client Logic ---

  connectToHost(hostId: string, name: string) {
    if (!this.peer) return;
    this.myName.set(name);
    this.isHost.set(false);

    const conn = this.peer.connect(hostId);
    this.hostConnection = conn;

    conn.on('open', () => {
      this.isConnected.set(true);
      this.sendMessage({ type: 'JOIN', payload: { name } });
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data as Message, hostId);
    });

    conn.on('close', () => {
      this.isConnected.set(false);
      this.hostConnection = null;
    });

    conn.on('error', (err) => {
        console.error('Connection error', err);
    });
  }

  // --- Messaging & State Handling ---

  private sendMessage(msg: Message) {
    if (this.isHost()) {
      // Host shouldn't call this for unicast usually, but for broadcast
    } else {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ ...msg, senderId: this.myPeerId()! });
      }
    }
  }

  private broadcast(msg: Message) {
    if (!this.isHost()) return;
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(msg);
      }
    });
  }

  private broadcastState() {
    if (!this.isHost()) return;

    // Hide votes if not revealed
    const safeParticipants = this.participants().map(p => ({
      ...p,
      vote: this.revealed() ? p.vote : ((p.vote !== null && p.vote !== undefined) ? 'HIDDEN' : null) // Send 'HIDDEN' if voted but not revealed
    }));

    const state: GameState = {
      revealed: this.revealed(),
      participants: safeParticipants,
      votingSystem: this.votingSystem(),
      customOptions: this.customOptions()
    };

    this.broadcast({ type: 'UPDATE_STATE', payload: state });
  }

  private handleMessage(msg: Message, senderId: string) {
    switch (msg.type) {
      case 'JOIN':
        if (this.isHost()) {
          const newParticipant: Participant = {
            id: senderId,
            name: msg.payload.name,
            status: 'waiting',
            vote: null
          };
          // Check if already exists
          this.participants.update(prev => {
             const exists = prev.find(p => p.id === senderId);
             if (exists) return prev.map(p => p.id === senderId ? newParticipant : p);
             return [...prev, newParticipant];
          });
          this.broadcastState();
        }
        break;

      case 'UPDATE_STATE':
        if (!this.isHost()) {
          const state = msg.payload as GameState;
          this.revealed.set(state.revealed);
          this.participants.set(state.participants);
          this.votingSystem.set(state.votingSystem);
          if (state.customOptions) {
            this.customOptions.set(state.customOptions);
          }
        }
        break;

      case 'VOTE':
        if (this.isHost()) {
          const voteValue = msg.payload.vote;
          this.participants.update(prev => prev.map(p => {
            if (p.id === senderId) {
              return { ...p, vote: voteValue, status: 'voted' };
            }
            return p;
          }));
          this.broadcastState();
        }
        break;

      case 'REVEAL':
          break;

      case 'RESET':
          break;
    }
  }

  // --- Actions ---

  vote(value: string | number) {
    if (this.isHost()) {
      this.participants.update(prev => prev.map(p => {
        if (p.id === this.myPeerId()) {
          return { ...p, vote: value, status: 'voted' };
        }
        return p;
      }));
      this.broadcastState();
    } else {
      this.sendMessage({ type: 'VOTE', payload: { vote: value } });
    }
  }

  revealCards() {
    if (!this.isHost()) return;
    this.revealed.set(true);
    this.broadcastState();
  }

  resetRound() {
    if (!this.isHost()) return;
    this.revealed.set(false);
    this.participants.update(prev => prev.map(p => ({ ...p, vote: null, status: 'waiting' })));
    this.broadcastState();
  }
}
