import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pending-page">
      <div class="pending-card">
        <div class="icon-wrapper">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>Registration Pending Approval</h2>
        <p>Your registration is currently waiting for administrator approval.</p>
        <p class="hint">You will be able to access exams once your account is approved.</p>
        <div class="actions">
          <button type="button" class="secondary" (click)="goToHome()">Go to Home</button>
          <button type="button" (click)="logout()">Logout</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pending-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: var(--surface-soft);
    }

    .pending-card {
      background: var(--surface);
      border-radius: 24px;
      padding: 40px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      display: grid;
      gap: 16px;
    }

    .icon-wrapper {
      display: flex;
      justify-content: center;
      color: var(--warning);
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .hint {
      font-size: 0.9rem;
      padding: 12px;
      background: var(--info-tint);
      border-radius: 12px;
      border: 1px solid var(--info-border);
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 8px;
    }

    @media (max-width: 500px) {
      .pending-card { padding: 24px; }
      .actions { flex-direction: column; }
    }
  `]
})
export class PendingRegistrationComponent {
  constructor(private auth: AuthService, private router: Router) {}

  goToHome(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
  }
}
