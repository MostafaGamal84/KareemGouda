import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-shell">
      <div class="auth-panel">
        <section class="auth-hero">
          <div class="auth-brand">
            <img src="/logo.jpeg" alt="GOUDAPREP logo" class="auth-brand-logo" />
            <div class="auth-brand-copy">
              <p class="auth-eyebrow">GOUDAPREP</p>
              <h1>Welcome back to GOUDAPREP.</h1>
            </div>
          </div>
          <p class="auth-subtitle">
            Sign in to continue your prep, manage tests, and keep every session organized in one place.
          </p>

          <div class="auth-chip-row">
            <span>Test management</span>
            <span>Student access</span>
            <span>Focused practice</span>
          </div>
        </section>

        <section class="auth-form-wrap">
          <div class="auth-form auth-form-wide">
            <p class="auth-form-kicker">GOUDAPREP</p>
            <h2>Sign in</h2>
            <p class="auth-form-sub">Continue to your dashboard and pick up where you left off.</p>

            <div class="guest-join guest-join-prominent">
              <p class="guest-join-title">Join with session code</p>
              <p class="guest-join-sub">Public live sessions only — no account needed.</p>
              <div class="field">
                <label for="guest-join-code">Session code</label>
                <input
                  id="guest-join-code"
                  name="guestJoinCode"
                  [(ngModel)]="guestJoinCode"
                  (ngModelChange)="guestJoinHint = ''"
                  type="text"
                  autocomplete="off"
                  placeholder="e.g. PQB2M4"
                  (keyup.enter)="goToGuestJoin()"
                />
              </div>
              @if (guestJoinHint) {
                <p class="guest-join-hint">{{ guestJoinHint }}</p>
              }
              <button type="button" class="secondary-btn guest-join-primary" [disabled]="guestJoinBusy" (click)="goToGuestJoin()">
                {{ guestJoinBusy ? 'Opening…' : 'Continue as guest' }}
              </button>
            </div>

            <p class="auth-divider" role="presentation"><span>Or sign in with email</span></p>

            <div class="field">
              <label for="login-email">Email</label>
              <input
                id="login-email"
                name="loginEmail"
                [(ngModel)]="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div class="field">
              <label for="login-password">Password</label>
              <input
                id="login-password"
                name="loginPassword"
                [(ngModel)]="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
              />
            </div>

            <button class="submit-btn" [disabled]="loading" (click)="login()">
              {{ loading ? 'Signing in...' : 'Login' }}
            </button>

            @if (rejectedStatus) {
              <div class="rejected-notice">
                <div class="rejected-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <h4>Registration Rejected</h4>
                <p>Your registration request has been rejected.</p>
                <p class="rejected-note">Please contact the administrator for more information.</p>
              </div>
            }

            @if (error) { <div class="alert">{{ error }}</div> }

            <p class="auth-switch">
              New here?
              <a routerLink="/auth/register">Create account</a>
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

    .rejected-notice {
      margin-top: 20px;
      padding: 20px;
      background: var(--danger-tint);
      border: 1px solid var(--danger-border);
      border-radius: 14px;
      text-align: center;
    }

    .rejected-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--danger);
      margin-bottom: 12px;
    }

    .rejected-icon svg {
      width: 24px;
      height: 24px;
      color: white;
    }

    .rejected-notice h4 {
      margin: 0 0 8px;
      color: var(--danger);
      font-size: 1.1rem;
    }

    .rejected-notice p {
      margin: 0 0 8px;
      color: var(--text);
    }

    .rejected-note {
      font-size: 0.9rem;
      color: var(--muted) !important;
    }

    .guest-join-prominent {
      margin: 18px 0 20px;
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid var(--accent-wine-line, rgba(122, 30, 46, 0.2));
      background: var(--surface-soft, rgba(122, 30, 46, 0.06));
      box-shadow: 0 8px 24px -18px var(--accent-wine-glow, rgba(122, 30, 46, 0.35));
    }

    .guest-join-title {
      margin: 0 0 8px;
      font-weight: 700;
      font-size: 1rem;
      line-height: 1.35;
    }

    .guest-join-sub {
      margin: 0 0 14px;
      font-size: 0.84rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .guest-join-hint {
      margin: -6px 0 10px;
      font-size: 0.82rem;
      color: var(--danger, #c62828);
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
    }

    .auth-divider::before,
    .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--accent-wine-line, rgba(0,0,0,0.1));
    }

    .auth-divider span {
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .secondary-btn {
      margin-top: 4px;
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid var(--accent-wine-line, rgba(0,0,0,0.12));
      background: transparent;
      font-weight: 600;
      cursor: pointer;
    }

    .guest-join-primary {
      background: var(--primary, #7a1e2e);
      color: var(--primary-contrast, #fff);
      border-color: transparent;
    }

    .guest-join-primary:hover:not(:disabled) {
      filter: brightness(1.05);
    }

    .secondary-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 520px) {
      .auth-brand-logo {
        border-radius: 18px;
        padding: 10px;
      }
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = false;
  error = '';
  rejectedStatus = false;
  guestJoinCode = '';
  guestJoinBusy = false;
  guestJoinHint = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  private safeInternalReturnUrl(raw: string | null): string | null {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    const t = raw.trim();
    if (!t.startsWith('/') || t.startsWith('//') || t.includes('://')) {
      return null;
    }
    return t;
  }

  goToGuestJoin(): void {
    const code = (this.guestJoinCode || '').trim();
    if (!code) {
      this.guestJoinHint = 'Enter the session code from your host.';
      return;
    }
    this.guestJoinHint = '';
    this.guestJoinBusy = true;
    this.router.navigate(['/player/join', code.toUpperCase()]).finally(() => {
      this.guestJoinBusy = false;
    });
  }

  login(): void {
    this.loading = true;
    this.error = '';
    this.rejectedStatus = false;

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        const userStatus = res?.status ?? this.auth.status();
        
        if (userStatus === 0) {
          this.router.navigate(['/auth/pending-status']);
          return;
        }
        
        if (userStatus === 2) {
          this.rejectedStatus = true;
          this.auth.logout();
          return;
        }

        const returnUrl = this.safeInternalReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
          return;
        }

        const role = this.auth.role();
        if (role === 'Player') {
          this.router.navigate(['/player/history']);
        } else if (role === 'Admin' || role === 'Host') {
          this.router.navigate(['/questions']);
        } else {
          this.router.navigate(['/test-mode']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Login failed';
      }
    });
  }
}
