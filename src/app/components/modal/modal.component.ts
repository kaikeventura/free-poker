import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="modalService.state().isOpen" class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-opacity" aria-modal="true" role="dialog">
      <div class="relative w-full max-w-md p-4 h-auto">
        <!-- Modal content -->
        <div class="relative bg-white rounded-lg shadow-xl transform transition-all scale-100">

          <!-- Header -->
          <div class="flex items-center justify-between p-4 md:p-5 border-b rounded-t">
            <h3 class="text-xl font-semibold text-gray-900">
              {{ modalService.state().title }}
            </h3>
            <button (click)="close()" type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center">
              <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
              </svg>
              <span class="sr-only">Fechar modal</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-4 md:p-5 space-y-4">
            <p class="text-base leading-relaxed text-gray-500">
              {{ modalService.state().message }}
            </p>
          </div>

          <!-- Footer -->
          <div class="flex items-center p-4 md:p-5 border-t border-gray-200 rounded-b justify-end gap-3">
            <button
              *ngIf="modalService.state().type === 'confirm'"
              (click)="resolve(false)"
              type="button"
              class="py-2.5 px-5 ms-3 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100"
            >
              {{ modalService.state().cancelLabel || 'Cancelar' }}
            </button>

            <button
              (click)="resolve(true)"
              type="button"
              class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
            >
              {{ modalService.state().confirmLabel || 'OK' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  modalService = inject(ModalService);

  close() {
    this.modalService.resolve(false);
  }

  resolve(result: boolean) {
    this.modalService.resolve(result);
  }
}
