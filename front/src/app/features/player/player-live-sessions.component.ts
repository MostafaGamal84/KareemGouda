import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlayerService } from '../../core/services/player.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card list-card">
      <h2>Live sessions</h2>
      <p class="sub">Sessions that are not ended yet, for quizzes set to live delivery. Join if you are allowed.</p>

      @if (loading) {
        <p class="muted">Loading…</p>
      } @else if (error) {
        <div class="alert">{{ error }}</div>
      } @else if (!sessions.length) {
        <p class="muted">No active live sessions right now.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Status</th>
                <th>Access</th>
                <th>Can join</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sessions; track s.sessionId) {
                <tr>
                  <td>{{ s.quizTitle }}</td>
                  <td>{{ statusLabel(s.status) }}</td>
                  <td>{{ s.accessType === 1 ? 'Public' : 'Private' }}</td>
                  <td>
                    <span [class.ok]="s.canJoin" [class.no]="!s.canJoin">{{ s.canJoin ? 'Yes' : 'No' }}</span>
                    @if (s.joinHint) {
                      <div class="hint">{{ s.joinHint }}</div>
                    }
                  </td>
                  <td>
                    <a [routerLink]="['/player/join', s.joinCode]" class="join-link">Open join</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .list-card { max-width: 960px; margin: 0 auto; }
    .sub { color: var(--muted); margin-bottom: 14px; }
    .muted { color: var(--muted); }
    .hint { font-size: 0.8rem; color: var(--muted); margin-top: 4px; max-width: 36ch; }
    .ok { color: var(--success, #2e7d32); font-weight: 600; }
    .no { color: var(--muted); font-weight: 600; }
    .join-link { font-weight: 600; }
    .table-wrap { overflow-x: auto; }
    th, td { padding: 10px 8px; text-align: left; vertical-align: top; }
  `]
})
export class PlayerLiveSessionsComponent implements OnInit {
  sessions: any[] = [];
  loading = false;
  error = '';

  constructor(private player: PlayerService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.player.liveSessionsBrowse().subscribe({
      next: (rows) => {
        this.loading = false;
        const list = Array.isArray(rows) ? rows : [];
        this.sessions = list.map((r: any) => ({
          sessionId: Number(r?.sessionId ?? r?.SessionId ?? 0),
          quizId: Number(r?.quizId ?? r?.QuizId ?? 0),
          quizTitle: String(r?.quizTitle ?? r?.QuizTitle ?? ''),
          status: Number(r?.status ?? r?.Status ?? 0),
          accessType: Number(r?.accessType ?? r?.AccessType ?? 2),
          joinCode: String(r?.joinCode ?? r?.JoinCode ?? ''),
          joinLink: String(r?.joinLink ?? r?.JoinLink ?? ''),
          canJoin: Boolean(r?.canJoin ?? r?.CanJoin ?? false),
          joinHint: r?.joinHint ?? r?.JoinHint ?? ''
        }));
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load sessions';
      }
    });
  }

  statusLabel(v: number): string {
    return ['', 'Draft', 'Waiting', 'Live', 'Paused', 'Ended'][v] || 'Unknown';
  }
}
