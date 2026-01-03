import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { P2pService, VotingSystemType } from '../services/p2p.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 class="text-3xl font-bold mb-6 text-center text-blue-600">Planning Poker</h1>

        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="username">
            Seu Nome
          </label>
          <input
            id="username"
            type="text"
            [(ngModel)]="username"
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Ex: João"
          >
        </div>

        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2">Sistema de Votação</label>
          <div class="flex rounded-md shadow-sm">
            <button (click)="votingSystem = 'fibonacci'" [class.bg-blue-600]="votingSystem === 'fibonacci'" [class.text-white]="votingSystem === 'fibonacci'" class="flex-1 px-4 py-2 rounded-l-md border border-gray-300 focus:outline-none">Fibonacci</button>
            <button (click)="votingSystem = 'tshirt'" [class.bg-blue-600]="votingSystem === 'tshirt'" [class.text-white]="votingSystem === 'tshirt'" class="flex-1 px-4 py-2 border-t border-b border-gray-300 focus:outline-none">T-Shirt</button>
            <button (click)="votingSystem = 'custom'" [class.bg-blue-600]="votingSystem === 'custom'" [class.text-white]="votingSystem === 'custom'" class="flex-1 px-4 py-2 rounded-r-md border border-gray-300 focus:outline-none">Custom</button>
          </div>
        </div>

        <div *ngIf="votingSystem === 'custom'" class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="custom-options">
            Opções Customizadas (separadas por vírgula)
          </label>
          <input
            id="custom-options"
            type="text"
            [(ngModel)]="customOptions"
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Ex: 1,2,4,?,☕"
          >
        </div>

        <button
          (click)="createSession()"
          [disabled]="!username || (votingSystem === 'custom' && !customOptions)"
          class="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
        >
          Criar Nova Sessão
        </button>
      </div>
    </div>
  `
})
export class HomeComponent {
  username = '';
  votingSystem: VotingSystemType = 'fibonacci';
  customOptions = '';

  private router = inject(Router);
  private p2pService = inject(P2pService);

  async createSession() {
    if (!this.username) return;

    let options: string[] = [];
    if (this.votingSystem === 'custom') {
      if (!this.customOptions) return;
      options = this.customOptions.split(',').map(o => o.trim()).filter(o => o);
    }

    try {
      await this.p2pService.initPeer();
      this.p2pService.startHosting(this.username, this.votingSystem, options);
      this.router.navigate(['/room'], { queryParams: { hostId: this.p2pService.myPeerId() } });
    } catch (err) {
      console.error('Failed to create session', err);
      alert('Erro ao criar sessão. Verifique o console.');
    }
  }
}
