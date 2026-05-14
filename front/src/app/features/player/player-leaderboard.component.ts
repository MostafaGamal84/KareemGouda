import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { SignalrService } from '../../core/services/signalr.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" style="max-width:760px;margin:auto;">
      <h2>Live Leaderboard</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
          <tbody>
            @for (item of items; track item.participantId) {
              <tr><td>{{ item.rank }}</td><td>{{ item.displayName }}</td><td>{{ item.totalScore }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PlayerLeaderboardComponent implements OnInit, OnDestroy {
  items: any[] = [];
  sessionId = 0;

  constructor(
    private route: ActivatedRoute,
    private leaderboard: LeaderboardService,
    private signalr: SignalrService
  ) {}

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    this.load();
    this.initRealtime();
  }

  ngOnDestroy(): void {
    this.signalr.off('leaderboardUpdated');
    this.signalr.off('playerJoined');
    this.signalr.leaveSessionGroup(this.sessionId);
    this.signalr.disconnect();
  }

  private load(): void {
    this.leaderboard.bySession(this.sessionId).subscribe((res: any) => this.items = res || []);
  }

  private async initRealtime(): Promise<void> {
    try {
      await this.signalr.connect();
      await this.signalr.joinSessionGroup(this.sessionId);

      this.signalr.on('leaderboardUpdated', (payload: any) => {
        this.items = payload || [];
      });
      this.signalr.on('playerJoined', () => this.load());
    } catch {}
  }
}

