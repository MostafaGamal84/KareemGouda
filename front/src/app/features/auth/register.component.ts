import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-panel">
        <section class="auth-hero">
          <div class="auth-brand">
            <img src="/logo.jpeg" alt="GOUDAPREP logo" class="auth-brand-logo" />
            <div class="auth-brand-copy">
              <p class="auth-eyebrow">GOUDAPREP</p>
              <h1>Create your account in GOUDAPREP.</h1>
            </div>
          </div>
          <p class="auth-subtitle">
            Set up a host or player account and start managing prep, tests, and student progress from one place.
          </p>

          <div class="auth-chip-row">
            <span>Test dashboard</span>
            <span>Student access</span>
            <span>Fast onboarding</span>
          </div>

          <div class="auth-glass-card">
            <span class="auth-card-label">What you get</span>
            <h3>One platform, two roles</h3>
            <p><strong>Hosts</strong> manage tests, sessions, and reporting with a single workflow.</p>
            <p><strong>Players</strong> join, practice, and track progress with less friction.</p>
          </div>
        </section>

        <section class="auth-form-wrap">
          <div class="auth-form auth-form-wide">
            <p class="auth-form-kicker">GOUDAPREP</p>
            <h2>Create account</h2>
            <p class="auth-form-sub">Enter your details, choose a role, and continue into the platform.</p>

            <div class="split-fields">
              <div class="field">
                <label for="register-first-name">First name</label>
                <input id="register-first-name" name="registerFirstName" [(ngModel)]="firstName" placeholder="First name" />
              </div>

              <div class="field">
                <label for="register-last-name">Last name</label>
                <input id="register-last-name" name="registerLastName" [(ngModel)]="lastName" placeholder="Last name" />
              </div>
            </div>

            <div class="field">
              <label for="register-email">Email</label>
              <input id="register-email" name="registerEmail" [(ngModel)]="email" type="email" placeholder="Email" />
            </div>

            <div class="field">
              <label for="register-password">Password</label>
              <input id="register-password" name="registerPassword" [(ngModel)]="password" type="password" placeholder="Password (min 6 chars)" />
            </div>

            <div class="field">
              <label for="register-confirm-password">Confirm password</label>
              <input id="register-confirm-password" name="registerConfirmPassword" [(ngModel)]="confirmPassword" type="password" placeholder="Confirm password" />
            </div>

            <div class="field">
              <label for="register-role">Role</label>
              <select id="register-role" name="registerRole" [(ngModel)]="role">
                <option value="Host">Host</option>
                <option value="Player">Player</option>
              </select>
            </div>

            <button class="submit-btn" [disabled]="loading" (click)="register()">
              {{ loading ? 'Loading...' : 'Register' }}
            </button>

            @if (pendingApproval) {
              <div class="pending-notice">
                <div class="pending-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h4>Registration Submitted</h4>
                <p>Your account is pending approval by an administrator.</p>
                <p class="pending-note">You will be able to login once your account is approved.</p>
                <a routerLink="/auth/login" class="pending-link">Go to Login</a>
              </div>
            }

            @if (success) { <div class="success">{{ success }}</div> }
            @if (error) { <div class="alert">{{ error }}</div> }

            <p class="auth-switch">
              Already have an account?
              <a routerLink="/auth/login">Login</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .auth-brand {
      display: grid;
      gap: 16px;
      width: 100%;
      margin-bottom: 10px;
    }

    .auth-brand-logo {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 24px;
      object-fit: contain;
      box-shadow: 0 18px 40px -30px var(--accent-wine-glow), var(--shadow-card);
      border: 1px solid var(--accent-wine-line);
      background: #fff;
      padding: 14px;
      box-sizing: border-box;
    }

    .auth-brand-copy {
      width: 100%;
      display: grid;
      gap: 12px;
    }

    .auth-brand-copy h1 {
      margin: 0;
      position: relative;
      padding-bottom: 16px;
    }

    .auth-brand-copy h1::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: 0;
      width: 92px;
      height: 3px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--accent-wine), transparent);
    }

    .pending-notice {
      margin-top: 20px;
      padding: 20px;
      background: var(--warning-tint);
      border: 1px solid var(--warning-border);
      border-radius: 14px;
      text-align: center;
    }

    .pending-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--warning);
      margin-bottom: 12px;
    }

    .pending-icon svg {
      width: 24px;
      height: 24px;
      color: white;
    }

    .pending-notice h4 {
      margin: 0 0 8px;
      color: var(--warning);
      font-size: 1.1rem;
    }

    .pending-notice p {
      margin: 0 0 8px;
      color: var(--text);
    }

    .pending-note {
      font-size: 0.9rem;
      color: var(--muted) !important;
    }

    .pending-link {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 20px;
      background: var(--warning);
      color: white;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
    }

    .pending-link:hover {
      filter: brightness(1.1);
    }

    @media (max-width: 520px) {
      .auth-brand-logo {
        border-radius: 18px;
        padding: 10px;
      }
    }
  `]
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  role: 'Host' | 'Player' = 'Host';
  loading = false;
  error = '';
  success = '';
  pendingApproval = false;

  constructor(private auth: AuthService, private router: Router) {}

  register(): void {
    this.error = '';
    this.success = '';
    this.pendingApproval = false;

    if (!this.firstName.trim() || !this.lastName.trim() || !this.email.trim() || !this.password.trim()) {
      this.error = 'All fields are required';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Password confirmation does not match';
      return;
    }

    this.loading = true;

    this.auth.register({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role
    }).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.message?.includes('pending')) {
          this.pendingApproval = true;
          this.success = '';
        } else {
          this.success = 'Registration successful';
          const redirectPath = this.role === 'Player' ? '/player/history' : '/questions';
          setTimeout(() => this.router.navigate([redirectPath]), 1500);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Registration failed';
      }
    });
  }
}
