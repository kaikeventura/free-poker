import { Injectable, signal, computed, effect, inject } from '@angular/core';
import Peer, { DataConnection } from 'peerjs';
import { ModalService } from './modal.service';

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
  private modalService = inject(ModalService);

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

  // Event for kick notification (to be handled by component/UI)
  readonly kicked = signal<boolean>(false);

  constructor() {
    // Restore preferences and state from localStorage
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('poker_name');
      if (savedName) this.myName.set(savedName);

      const savedSystem = localStorage.getItem('poker_system');
      if (savedSystem) this.votingSystem.set(savedSystem as VotingSystemType);

      const savedOptions = localStorage.getItem('poker_options');
      if (savedOptions) this.customOptions.set(JSON.parse(savedOptions));

      // Restore Host State if available
      const savedIsHost = localStorage.getItem('poker_is_host');
      if (savedIsHost === 'true') {
        this.isHost.set(true);

        const savedParticipants = localStorage.getItem('poker_participants');
        if (savedParticipants) this.participants.set(JSON.parse(savedParticipants));

        const savedRevealed = localStorage.getItem('poker_revealed');
        if (savedRevealed) this.revealed.set(savedRevealed === 'true');
      }

      // Cleanup on unload to free Peer ID
      window.addEventListener('beforeunload', () => {
        this.peer?.destroy();
      });
    }

    // Auto-save effects
    effect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('poker_name', this.myName());
        localStorage.setItem('poker_system', this.votingSystem());
        localStorage.setItem('poker_options', JSON.stringify(this.customOptions()));

        // Save Host State
        if (this.isHost()) {
            localStorage.setItem('poker_is_host', 'true');
            localStorage.setItem('poker_participants', JSON.stringify(this.participants()));
            localStorage.setItem('poker_revealed', String(this.revealed()));
            if (this.myPeerId()) {
                localStorage.setItem('poker_host_id', this.myPeerId()!);
            }
        } else {
            // If I'm not host anymore (or never was), clear host-specific state to avoid confusion
            // But be careful not to clear it just because isHost is false during init
        }
      }
    });
  }

  // Initialize Peer with Retry Logic
  initPeer(id?: string, retryCount = 0): Promise<string> {
    return new Promise((resolve, reject) => {
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
        this.isConnected.set(true);
        resolve(peerId);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.error('Peer error:', err);

        // If ID is taken and we are trying to restore session (id is present)
        if (err.type === 'unavailable-id' && id && retryCount < 3) {
            console.log(`ID ${id} is taken. Retrying in 1s... (Attempt ${retryCount + 1})`);
            setTimeout(() => {
                this.initPeer(id, retryCount + 1).then(resolve).catch(reject);
            }, 1000);
            return;
        }

        reject(err);
      });

      this.peer.on('disconnected', () => {
          this.isConnected.set(false);
          // Try to reconnect?
          // this.peer?.reconnect();
      });
    });
  }

  // --- Host Logic ---

  startHosting(name: string, system: VotingSystemType = 'fibonacci', options: string[] = []) {
    this.isHost.set(true);
    this.myName.set(name);
    this.votingSystem.set(system);
    this.customOptions.set(options);

    // Initial participant (Host)
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
      // Send current state to new participant immediately
      this.broadcastState();
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data as Message, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      // Optional: Remove participant on disconnect?
      // Usually in Planning Poker we might want to keep them in the list as "offline"
      // or remove them. For simplicity, let's remove.
      this.removeParticipant(conn.peer);
    });

    conn.on('error', (err) => {
        console.error('Connection error with peer ' + conn.peer, err);
    });
  }

  private removeParticipant(peerId: string) {
    this.participants.update(prev => prev.filter(p => p.id !== peerId));
    this.broadcastState();
  }

  kickParticipant(peerId: string) {
    if (!this.isHost()) return;

    const conn = this.connections.get(peerId);
    if (conn) {
      // Send KICK message before closing
      conn.send({ type: 'KICK' });

      // Close connection after a short delay to ensure message is sent
      setTimeout(() => {
        conn.close();
        this.connections.delete(peerId);
      }, 100);
    }

    this.removeParticipant(peerId);
  }

  // --- Client Logic ---

  connectToHost(hostId: string, name: string) {
    if (!this.peer) return;
    this.myName.set(name);
    this.isHost.set(false);
    this.kicked.set(false);

    // Clear host storage if I am becoming a client
    if (typeof window !== 'undefined') {
        localStorage.removeItem('poker_is_host');
    }

    const conn = this.peer.connect(hostId, { reliable: true });
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
      if (!this.kicked()) {
          this.modalService.alert('Desconectado', 'A conexão com o Host foi perdida.');
      }
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

          this.participants.update(prev => {
             // Check if already exists by ID
             const indexById = prev.findIndex(p => p.id === senderId);
             if (indexById !== -1) {
                 const updated = [...prev];
                 updated[indexById] = { ...updated[indexById], name: msg.payload.name };
                 return updated;
             }

             // Check if exists by Name (Deduplication Logic)
             const indexByName = prev.findIndex(p => p.name === msg.payload.name);
             if (indexByName !== -1) {
                 // Found a participant with the same name!
                 // Assume it's the same person reconnecting with a new Peer ID.
                 // Update their ID to the new one.
                 const updated = [...prev];
                 const oldParticipant = updated[indexByName];

                 // We update the ID, but keep the vote and status if possible
                 updated[indexByName] = {
                     ...oldParticipant,
                     id: senderId, // Update to new ID
                     status: 'waiting' // Maybe reset status or keep it? Let's reset to be safe or keep if you prefer persistence
                 };
                 return updated;
             }

             // New participant
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

      case 'KICK':
          if (!this.isHost()) {
              this.kicked.set(true);
              this.isConnected.set(false);
              this.hostConnection = null;
              this.modalService.alert('Removido', 'Você foi removido da sala pelo Host.');
              // Navigation will be handled by component or user action
          }
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
