import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResultsService } from '../../core/services/results.service';
import { GameSessionService } from '../../core/services/game-session.service';
import { catchError, forkJoin, of } from 'rxjs';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationControlsComponent],
  template: `
    <div class="results-shell">
      <div class="card panel">
        <h2>Results & Analytics</h2>
        <p class="sub">Track leaderboard performance and per-question insights for any live session.</p>

        <div class="controls">
          <div class="field">
            <label for="session-select">Select session</label>
            <select
              id="session-select"
              name="sessionSelect"
              [(ngModel)]="sessionId"
              [disabled]="loadingSessions || !sessions.length"
            >
              <option [ngValue]="null">Choose session</option>
              @for (s of sessions; track s.id) {
                <option [ngValue]="s.id">
                  #{{ s.id }} - {{ s.quizTitle }} ({{ statusLabel(s.status) }})
                </option>
              }
            </select>
          </div>

          <div class="actions">
            <button class="secondary" [disabled]="loadingSessions" (click)="refreshSessions()">
              {{ loadingSessions ? 'Refreshing...' : 'Refresh Sessions' }}
            </button>
            <button [disabled]="loadingResults || !sessionId" (click)="loadSessionResults()">
              {{ loadingResults ? 'Loading...' : 'Load Session Results' }}
            </button>
          </div>
        </div>
      </div>

      @if (session) {
        <div class="summary-grid">
          <div class="card summary-card">
            <p>Quiz</p>
            <h3>{{ session.quizTitle }}</h3>
          </div>
          <div class="card summary-card">
            <p>Status</p>
            <h3>{{ statusLabel(session.status) }}</h3>
          </div>
          <div class="card summary-card">
            <p>Participants</p>
            <h3>{{ session.participantsCount }}</h3>
          </div>
          <div class="card summary-card">
            <p>Flow</p>
            <h3>{{ flowModeLabel(session.questionFlowMode) }}</h3>
          </div>
        </div>
      }

      @if (participants.length) {
        <div class="card panel">
          <h3>Leaderboard Snapshot</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Avg Time (ms)</th></tr></thead>
              <tbody>
                @for (p of pagedParticipants; track p.participantId; let idx = $index) {
                  <tr>
                    <td>{{ (participantsPage - 1) * participantsPageSize + idx + 1 }}</td>
                    <td>{{ p.displayName }}</td>
                    <td>{{ p.totalScore }}</td>
                    <td>{{ p.correctAnswers }}</td>
                    <td>{{ p.wrongAnswers }}</td>
                    <td>{{ p.averageResponseTimeMs | number:'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination-controls
            [page]="participantsPage"
            [totalPages]="participantsTotalPages"
            [pageSize]="participantsPageSize"
            (pageChange)="goToParticipantsPage($event)"
            (pageSizeChange)="onParticipantsPageSizeChange($event)" />
        </div>
      }

      @if (analysis.length) {
        <div class="card panel">
          <h3>Questions Analysis</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Question</th><th>Correct</th><th>Wrong</th><th>Success %</th><th>Avg Time (ms)</th></tr></thead>
              <tbody>
                @for (a of pagedAnalysis; track a.questionId) {
                  <tr>
                    <td>{{ a.questionTitle }}</td>
                    <td>{{ a.correctCount }}</td>
                    <td>{{ a.wrongCount }}</td>
                    <td>{{ successRate(a) | number:'1.0-1' }}%</td>
                    <td>{{ a.averageResponseTimeMs | number:'1.0-0' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination-controls
            [page]="analysisPage"
            [totalPages]="analysisTotalPages"
            [pageSize]="analysisPageSize"
            (pageChange)="goToAnalysisPage($event)"
            (pageSizeChange)="onAnalysisPageSizeChange($event)" />
        </div>
      }

      @if (!loadingResults && sessionId && !participants.length && !analysis.length && !error) {
        <div class="alert">No answers yet for this session.</div>
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .results-shell {
      display: grid;
      gap: 14px;
    }

    .panel {
      padding: clamp(14px, 2.2vw, 18px);
    }

    .sub {
      color: var(--muted);
      margin-bottom: 12px;
    }

    .controls {
      display: flex;
      gap: 12px;
      align-items: end;
      flex-wrap: wrap;
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: min(380px, 100%);
      flex: 1 1 340px;
    }

    .field label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--muted-strong);
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .actions button {
      min-height: 42px;
    }

    .summary-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .summary-card p {
      margin: 0;
      color: var(--muted);
      font-size: 0.84rem;
      font-weight: 700;
    }

    .summary-card h3 {
      margin: 3px 0 0;
      font-size: 1.2rem;
      color: var(--text);
      line-height: 1.25;
      word-break: break-word;
    }

    h3 {
      margin-bottom: 10px;
    }

    .pagination-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .page-info {
      color: var(--muted-strong);
      font-size: 0.9rem;
      font-weight: 600;
    }

    @media (max-width: 980px) {
      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 620px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .actions {
        width: 100%;
      }

      .actions button {
        width: 100%;
      }

      .pagination-bar {
        align-items: stretch;
      }

      .pagination-bar button,
      .page-info {
        width: 100%;
        text-align: center;
      }
    }
  `]
})
export class ResultsDashboardComponent implements OnInit {
  sessionId: number | null = null;
  sessions: any[] = [];
  session: any;
  participants: any[] = [];
  analysis: any[] = [];
  participantsPage = 1;
  participantsPageSize = 10;
  analysisPage = 1;
  analysisPageSize = 10;
  error = '';
  loadingSessions = false;
  loadingResults = false;

  constructor(private results: ResultsService, private sessionsService: GameSessionService) {}

  ngOnInit(): void {
    this.refreshSessions();
  }

  refreshSessions(): void {
    this.loadingSessions = true;
    this.error = '';

    this.sessionsService.getAll().subscribe({
      next: (res) => {
        const list = this.toArray(res).sort((a: any, b: any) => {
          const aDate = new Date(a?.createdAt ?? '').getTime();
          const bDate = new Date(b?.createdAt ?? '').getTime();
          return bDate - aDate;
        });

        this.sessions = list;
        this.loadingSessions = false;

        if (!this.sessions.length) {
          this.sessionId = null;
          this.session = null;
          this.participants = [];
          this.analysis = [];
          this.error = 'No game sessions found yet.';
          return;
        }

        if (!this.sessionId || !this.sessions.some((x) => Number(x?.id) === this.sessionId)) {
          this.sessionId = Number(this.sessions[0]?.id ?? 0) || null;
        }

        if (this.sessionId) {
          this.loadSessionResults();
        }
      },
      error: (err) => {
        this.loadingSessions = false;
        this.error = err?.error?.message || 'Failed to load sessions list';
      }
    });
  }

  loadSessionResults(): void {
    if (!this.sessionId) return;

    const targetSessionId = this.sessionId;
    this.error = '';
    this.loadingResults = true;
    this.session = null;
    this.participants = [];
    this.analysis = [];

    forkJoin({
      session: this.results.session(targetSessionId),
      participants: this.results.sessionParticipants(targetSessionId).pipe(catchError(() => of([]))),
      analysis: this.results.sessionQuestionsAnalysis(targetSessionId).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ session, participants, analysis }) => {
        this.loadingResults = false;
        this.session = session;
        this.participants = this.toArray(participants);
        this.analysis = this.toArray(analysis);
        this.participantsPage = 1;
        this.analysisPage = 1;
      },
      error: (err) => {
        this.loadingResults = false;
        this.error = err?.error?.message || 'Failed to load session summary';
      }
    });
  }

  statusLabel(value: number): string {
    return ['', 'Draft', 'Waiting', 'Live', 'Paused', 'Ended'][Number(value)] || 'Unknown';
  }

  flowModeLabel(value: number): string {
    return Number(value) === 2 ? 'Timed By Question' : 'Host Controlled';
  }

  successRate(item: any): number {
    const correct = Number(item?.correctCount ?? 0);
    const wrong = Number(item?.wrongCount ?? 0);
    const total = correct + wrong;
    return total > 0 ? (correct / total) * 100 : 0;
  }

  get participantsTotalPages(): number {
    return Math.max(1, Math.ceil(this.participants.length / this.participantsPageSize));
  }

  get pagedParticipants(): any[] {
    const start = (this.participantsPage - 1) * this.participantsPageSize;
    return this.participants.slice(start, start + this.participantsPageSize);
  }

  get analysisTotalPages(): number {
    return Math.max(1, Math.ceil(this.analysis.length / this.analysisPageSize));
  }

  get pagedAnalysis(): any[] {
    const start = (this.analysisPage - 1) * this.analysisPageSize;
    return this.analysis.slice(start, start + this.analysisPageSize);
  }

  goToParticipantsPage(page: number): void {
    if (page < 1 || page > this.participantsTotalPages || page === this.participantsPage) {
      return;
    }

    this.participantsPage = page;
  }

  onParticipantsPageSizeChange(pageSize: number): void {
    if (pageSize === this.participantsPageSize) {
      return;
    }

    this.participantsPageSize = pageSize;
    this.participantsPage = 1;
  }

  goToAnalysisPage(page: number): void {
    if (page < 1 || page > this.analysisTotalPages || page === this.analysisPage) {
      return;
    }

    this.analysisPage = page;
  }

  onAnalysisPageSizeChange(pageSize: number): void {
    if (pageSize === this.analysisPageSize) {
      return;
    }

    this.analysisPageSize = pageSize;
    this.analysisPage = 1;
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.$values)) return value.$values;
    return [];
  }
}

