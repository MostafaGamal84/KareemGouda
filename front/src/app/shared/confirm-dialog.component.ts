import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialog.state(); as state) {
      <div class="confirm-overlay" (click)="cancel()">
        <section class="confirm-panel" [class.confirm-panel-danger]="state.tone === 'danger'" (click)="$event.stopPropagation()">
          <div class="confirm-badge" [class.confirm-badge-danger]="state.tone === 'danger'">
            {{ state.tone === 'danger' ? 'Warning' : 'Confirm' }}
          </div>

          <h3>{{ state.title }}</h3>
          <p>{{ state.message }}</p>

          <div class="confirm-actions">
            <button type="button" class="secondary" (click)="cancel()">{{ state.cancelText }}</button>
            <button type="button" [class.danger]="state.tone === 'danger'" (click)="confirm()">{{ state.confirmText }}</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
    }

    .confirm-overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 18px;
      background: var(--overlay-bg);
      backdrop-filter: blur(10px);
      pointer-events: auto;
    }

    .confirm-panel {
      width: min(440px, calc(100vw - 24px));
      padding: 22px;
      border-radius: 24px;
      border: 1px solid var(--dialog-panel-border);
      background: var(--dialog-panel-bg);
      box-shadow: var(--dialog-panel-shadow);
    }

    .confirm-panel-danger {
      border-color: var(--dialog-danger-border);
      background: var(--dialog-danger-bg);
    }

    .confirm-badge {
      display: inline-flex;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--dialog-badge-border);
      background: var(--dialog-badge-bg);
      color: var(--dialog-badge-text);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .confirm-badge-danger {
      border-color: var(--dialog-danger-badge-border);
      background: var(--dialog-danger-badge-bg);
      color: var(--dialog-danger-badge-text);
    }

    h3 {
      margin: 0;
      font-size: 1.3rem;
      color: var(--text);
    }

    p {
      margin: 10px 0 0;
      color: var(--text-soft);
      line-height: 1.7;
    }

    .confirm-actions {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .confirm-actions button {
      min-width: 108px;
    }

    @media (max-width: 520px) {
      .confirm-panel {
        padding: 18px;
        border-radius: 20px;
      }

      .confirm-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .confirm-actions button {
        width: 100%;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.state()) {
      this.dialog.cancel();
    }
  }

  confirm(): void {
    this.dialog.confirm();
  }

  cancel(): void {
    this.dialog.cancel();
  }
}


