import { Injectable, signal } from '@angular/core';

export type ModalType = 'alert' | 'confirm';

export interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  // Estado reativo do modal
  readonly state = signal<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });

  // Armazena a função de resolução da Promise para confirmações
  private confirmResolver: ((value: boolean) => void) | null = null;

  constructor() {}

  alert(title: string, message: string, buttonLabel: string = 'OK') {
    this.state.set({
      isOpen: true,
      title,
      message,
      type: 'alert',
      confirmLabel: buttonLabel
    });
  }

  confirm(title: string, message: string, confirmLabel: string = 'Sim', cancelLabel: string = 'Cancelar'): Promise<boolean> {
    this.state.set({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      confirmLabel,
      cancelLabel
    });

    return new Promise<boolean>((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  close() {
    this.state.update(s => ({ ...s, isOpen: false }));
    if (this.confirmResolver) {
      this.confirmResolver(false); // Default to false if closed via backdrop or other means without explicit choice
      this.confirmResolver = null;
    }
  }

  // Chamado pelo componente quando o usuário clica nos botões
  resolve(result: boolean) {
    this.state.update(s => ({ ...s, isOpen: false }));
    if (this.confirmResolver) {
      this.confirmResolver(result);
      this.confirmResolver = null;
    }
  }
}
