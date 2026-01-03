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
    // PASSO 2.1: Recuperar dados do localStorage no construtor
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('poker_name');
      if (savedName) this.myName.set(savedName);

      const savedSystem = localStorage.getItem('poker_system');
      if (savedSystem) this.votingSystem.set(savedSystem as VotingSystemType);

      const savedOptions = localStorage.getItem('poker_options');
      if (savedOptions) this.customOptions.set(JSON.parse(savedOptions));

      const savedIsHost = localStorage.getItem('poker_is_host');
      if (savedIsHost === 'true') {
        this.isHost.set(true);
        const savedParticipants = localStorage.getItem('poker_participants');
        if (savedParticipants) this.participants.set(JSON.parse(savedParticipants));
        const savedRevealed = localStorage.getItem('poker_revealed');
        if (savedRevealed) this.revealed.set(savedRevealed === 'true');
      }

      window.addEventListener('beforeunload', () => this.peer?.destroy());
    }

    // PASSO 2.2: Salvar automaticamente com 'effect'
    effect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('poker_name', this.myName());
        localStorage.setItem('poker_system', this.votingSystem());
        localStorage.setItem('poker_options', JSON.stringify(this.customOptions()));

        if (this.isHost()) {
            localStorage.setItem('poker_is_host', 'true');
            localStorage.setItem('poker_participants', JSON.stringify(this.participants()));
            localStorage.setItem('poker_revealed', String(this.revealed()));
            if (this.myPeerId()) {
                localStorage.setItem('poker_host_id', this.myPeerId()!);
            }
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

        if (err.type === 'unavailable-id' && id && retryCount < 5) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`ID ${id} is taken. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
            setTimeout(() => {
                this.initPeer(id, retryCount + 1).then(resolve).catch(reject);
            }, delay);
            return;
        }

        reject(err);
      });

      this.peer.on('disconnected', () => {
          this.isConnected.set(false);
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
      conn.send({ type: 'KICK' });
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

    const safeParticipants = this.participants().map(p => ({
      ...p,
      vote: this.revealed() ? p.vote : ((p.vote !== null && p.vote !== undefined) ? 'HIDDEN' : null)
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
             const indexById = prev.findIndex(p => p.id === senderId);
             if (indexById !== -1) {
                 const updated = [...prev];
                 updated[indexById] = { ...updated[indexById], name: msg.payload.name };
                 return updated;
             }

             const indexByName = prev.findIndex(p => p.name === msg.payload.name);
             if (indexByName !== -1) {
                 const updated = [...prev];
                 const oldParticipant = updated[indexByName];
                 updated[indexByName] = {
                     ...oldParticipant,
                     id: senderId,
                     status: 'waiting'
                 };
                 return updated;
             }

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
