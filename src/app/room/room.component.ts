import { Component, inject, OnInit, effect, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { P2pService } from '../services/p2p.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 p-4">
      <!-- Header -->
      <header class="bg-white shadow rounded-lg p-4 mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-xl font-bold text-gray-800">Sala de Votação</h1>
          <p class="text-sm text-gray-500" *ngIf="p2pService.isHost()">Você é o Host</p>
        </div>
        <div class="flex items-center gap-4">
           <div class="text-sm bg-blue-100 text-blue-800 py-1 px-3 rounded-full">
             {{ p2pService.myName() }}
           </div>
           <button (click)="copyLink()" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
             Copiar Link da Sala
           </button>
        </div>
      </header>

      <!-- Login Overlay if not connected -->
      <div *ngIf="!p2pService.isConnected() && !p2pService.isHost()" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <h2 class="text-2xl font-bold mb-4">Entrar na Sala</h2>
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">Seu Nome</label>
            <input type="text" [(ngModel)]="joinName" class="shadow border rounded w-full py-2 px-3">
          </div>
          <button (click)="joinRoom()" [disabled]="!joinName" class="w-full bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50">
            Entrar
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Voting Area -->
        <div class="md:col-span-2">
          <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-lg font-semibold mb-4">Escolha sua carta</h2>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
              <button
                *ngFor="let card of cards()"
                (click)="vote(card)"
                [class.bg-blue-600]="currentVote === card"
                [class.text-white]="currentVote === card"
                [class.bg-gray-100]="currentVote !== card"
                [class.hover:bg-blue-100]="currentVote !== card"
                class="h-24 rounded-lg text-2xl font-bold transition-colors duration-200 border border-gray-200 shadow-sm flex items-center justify-center"
              >
                {{ card }}
              </button>
            </div>
          </div>

          <!-- Host Controls -->
          <div *ngIf="p2pService.isHost()" class="bg-white rounded-lg shadow p-6 flex gap-4">
            <button (click)="p2pService.revealCards()" class="flex-1 bg-indigo-600 text-white font-bold py-3 px-6 rounded hover:bg-indigo-700 transition">
              Revelar Cartas
            </button>
            <button (click)="p2pService.resetRound()" class="flex-1 bg-gray-600 text-white font-bold py-3 px-6 rounded hover:bg-gray-700 transition">
              Nova Rodada
            </button>
          </div>
        </div>

        <!-- Participants List -->
        <div class="md:col-span-1">
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold mb-4">Participantes ({{ p2pService.participants().length }})</h2>
            <ul class="space-y-3">
              <li *ngFor="let p of p2pService.participants()" class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-700">{{ p.name }}</span>
                  <span *ngIf="p.id === p2pService.myPeerId()" class="text-xs text-gray-400">(Você)</span>
                </div>

                <div class="flex items-center">
                  <!-- Status / Vote Display -->
                  <ng-container *ngIf="p2pService.revealed(); else hiddenVote">
                     <span class="text-xl font-bold text-blue-600" *ngIf="p.vote !== null && p.vote !== 'HIDDEN'">{{ p.vote }}</span>
                     <span class="text-sm text-gray-400" *ngIf="p.vote === null">...</span>
                  </ng-container>

                  <ng-template #hiddenVote>
                    <span *ngIf="p.vote === 'HIDDEN' || (p.vote !== null && p.vote !== undefined)" class="text-green-500 font-bold">✔ Votou</span>
                    <span *ngIf="p.vote === null || p.vote === undefined" class="text-gray-400 text-sm">Aguardando...</span>
                  </ng-template>
                </div>
              </li>
            </ul>

            <!-- Results Summary (Only when revealed) -->
            <div *ngIf="p2pService.revealed()" class="mt-6 pt-4 border-t border-gray-200">
                <h3 class="font-semibold text-gray-700 mb-2">Média: {{ averageVote() }}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RoomComponent implements OnInit {
  p2pService = inject(P2pService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  joinName = '';
  hostId: string | null = null;
  currentVote: string | number | null = null;

  cards = computed(() => {
    const system = this.p2pService.votingSystem();
    switch (system) {
      case 'fibonacci':
        return ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'];
      case 'tshirt':
        return ['XS', 'S', 'M', 'L', 'XL', '?', '☕'];
      case 'custom':
        return this.p2pService.customOptions();
      default:
        return [];
    }
  });

  averageVote = computed(() => {
    const votes = this.p2pService.participants()
      .map(p => p.vote)
      .filter(v => typeof v === 'string' && !isNaN(Number(v)))
      .map(v => Number(v!));

    if (votes.length === 0) return 'N/A';

    const sum = votes.reduce((a, b) => a + b, 0);
    return (sum / votes.length).toFixed(1);
  });

  constructor() {
    effect(() => {
        if (!this.p2pService.revealed()) {
             const myParticipant = this.p2pService.participants().find(p => p.id === this.p2pService.myPeerId());
             if (myParticipant && (myParticipant.vote === null || myParticipant.vote === undefined)) {
                 this.currentVote = null;
             }
        }
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.hostId = params['hostId'];
      if (!this.hostId) {
        this.router.navigate(['/']);
        return;
      }
    });
  }

  async joinRoom() {
    if (!this.joinName || !this.hostId) return;

    try {
      await this.p2pService.initPeer();
      this.p2pService.connectToHost(this.hostId, this.joinName);
    } catch (err) {
      console.error('Error joining room', err);
      alert('Erro ao conectar na sala.');
    }
  }

  vote(card: string | number) {
    this.currentVote = card;
    this.p2pService.vote(card);
  }

  copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado para a área de transferência!');
    });
  }
}
