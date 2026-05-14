import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-pending-status',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="pending-shell">
      <div class="pending-card">
        <div class="pending-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h1>Account Pending Approval</h1>
        <p>Your account is awaiting approval by an administrator.</p>
        <p class="pending-detail">You will be able to login once your account is approved.</p>
        
        <div class="pending-actions">
          <a routerLink="/auth/login" class="btn-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Login
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pending-shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
      padding: 20px;
    }

    .pending-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .pending-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--warning-tint);
      margin-bottom: 24px;
    }

    .pending-icon svg {
      width: 40px;
      height: 40px;
      color: var(--warning);
    }

    h1 {
      margin: 0 0 16px;
      font-size: 1.6rem;
      color: var(--warning);
    }

    p {
      margin: 0 0 12px;
      color: var(--text);
      line-height: 1.6;
    }

    .pending-detail {
      color: var(--muted);
      font-size: 0.95rem;
    }

    .pending-actions {
      margin-top: 32px;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: var(--warning);
      color: white;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
    }

    .btn-back:hover {
      opacity: 0.9;
    }

    .btn-back svg {
      width: 18px;
      height: 18px;
    }
  `]
})
export class PendingStatusComponent {}
