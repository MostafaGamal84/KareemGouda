import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlayerService } from '../../core/services/player.service';
import { GameSessionService } from '../../core/services/game-session.service';
import { AuthService } from '../../core/services/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="center-stage">
      <div class="card spotlight-card narrow-card">
        <p class="eyebrow">Live access</p>
        <h2>Join Live Session</h2>
        <p class="page-intro">Enter the session code and the name that should appear on the live leaderboard.</p>

        <div class="col">
          <div class="field">
            <label for="player-join-code">Join code</label>
            <input id="player-join-code" name="playerJoinCode" [(ngModel)]="joinCode" (blur)="refreshSessionPreview()" />
          </div>

          <div class="field">
            <label for="player-display-name">Display name</label>
            <input id="player-display-name" name="playerDisplayName" [(ngModel)]="displayName" placeholder="Display name" />
          </div>

          @if (sessionPreview?.accessType === 1) {
            <div class="field">
              <label for="player-email">Email</label>
              <input id="player-email" type="email" name="playerEmail" [(ngModel)]="email" placeholder="you@school.edu" autocomplete="email" />
              <p class="hint">Required for public sessions so the host can identify you.</p>
            </div>
          } @else if (sessionPreview?.accessType === 2) {
            @if (auth.isLoggedIn()) {
              <p class="hint">This session is private. Your account must be on the host's allow list, or the host may need to approve your join request.</p>
            } @else {
              <p class="hint">This session is private. <a [routerLink]="['/auth/login']" [queryParams]="{ returnUrl: joinReturnUrl() }">Sign in</a> to join.</p>
            }
          }

          <button [disabled]="joinDisabled()" (click)="join()">{{ loading ? 'Joining...' : 'Join session' }}</button>
        </div>

        @if (error) { <div class="alert" style="margin-top:12px;">{{ error }}</div> }
      </div>
    </div>
  `,
  styles: [`
    .hint { margin: 6px 0 0; font-size: 0.82rem; color: var(--muted); line-height: 1.35; }
    .hint a { color: var(--accent-wine, #7b1fa2); font-weight: 600; }
  `]
})
export class PlayerJoinComponent implements OnInit {
  joinCode = '';
  displayName = '';
  email = '';
  loading = false;
  error = '';
  sessionPreview: { accessType: number } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: PlayerService,
    private gameSessions: GameSessionService,
    readonly auth: AuthService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  joinReturnUrl(): string {
    const code = (this.joinCode || '').trim();
    if (code) {
      return `/player/join/${encodeURIComponent(code.toUpperCase())}`;
    }
    return '/player/join';
  }

  joinDisabled(): boolean {
    if (this.loading) {
      return true;
    }
    if (this.sessionPreview?.accessType === 2 && !this.auth.isLoggedIn()) {
      return true;
    }
    return false;
  }

  ngOnInit(): void {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.joinCode = code;
      this.refreshSessionPreview();
    }
  }

  refreshSessionPreview(): void {
    const code = (this.joinCode || '').trim();
    if (!code) {
      this.sessionPreview = null;
      return;
    }
    this.gameSessions.getByCode(code.toUpperCase()).subscribe({
      next: (s) => {
        this.sessionPreview = { accessType: Number(s?.accessType ?? 2) };
      },
      error: () => {
        this.sessionPreview = null;
      }
    });
  }

  join(): void {
    this.loading = true;
    this.error = '';

    const code = (this.joinCode || '').trim();
    if (!code) {
      this.loading = false;
      this.error = 'Enter a join code.';
      return;
    }

    this.gameSessions.getByCode(code.toUpperCase()).subscribe({
      next: (s) => {
        const accessType = Number(s?.accessType ?? 2);
        this.sessionPreview = { accessType };

        const payload: { joinCode: string; displayName: string; email?: string } = {
          joinCode: this.joinCode.trim(),
          displayName: this.displayName
        };

        if (accessType === 1) {
          const em = (this.email || '').trim();
          if (!em || !em.includes('@')) {
            this.loading = false;
            this.error = 'Enter a valid email for this public session.';
            return;
          }
          payload.email = em;
        }

        this.service.join(payload).subscribe({
          next: (res) => {
            this.loading = false;
            if (isPlatformBrowser(this.platformId)) {
              localStorage.setItem('participant_id', String(res.participantId));
              localStorage.setItem('participant_token', res.participantToken);
              localStorage.setItem('participant_display_name', res.displayName || this.displayName);
              localStorage.setItem('participant_join_status', String(res.joinStatus ?? 1));
              if (accessType === 1) {
                localStorage.setItem('participant_session_id', String(res.sessionId));
                localStorage.setItem('participant_session_access_type', '1');
              } else {
                localStorage.removeItem('participant_session_id');
                localStorage.removeItem('participant_session_access_type');
              }
            }
            this.router.navigate(['/player/session', res.sessionId, 'waiting-room']);
          },
          error: (err) => {
            this.loading = false;
            this.error = err?.error?.message || 'Join failed';
          }
        });
      },
      error: () => {
        this.loading = false;
        this.error = 'Session not found. Check the join code.';
      }
    });
  }
}
