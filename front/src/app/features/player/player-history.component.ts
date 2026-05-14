import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ResultsService } from '../../core/services/results.service';
import { TestModeService } from '../../core/services/test-mode.service';
import { catchError, forkJoin, of } from 'rxjs';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

@Component({
  standalone: true,
  imports: [CommonModule, PaginationControlsComponent],
  template: `
    <div class="card history-shell">
      <h2 class="history-title">My History</h2>

      @if (loading) {
        <p>Loading history...</p>
      }

      @if (!loading && !error && items.length === 0 && testItems.length === 0) {
        <div class="alert">No history yet.</div>
      }

      @if (items.length > 0) {
        <section class="history-section">
          <h3>Live Sessions</h3>

          <div class="history-summary">
            <div class="card history-summary-card">
              <p>Sessions Played</p>
              <h3>{{ items.length }}</h3>
            </div>
            <div class="card history-summary-card">
              <p>Average Score</p>
              <h3>{{ averageScore | number:'1.0-2' }}</h3>
            </div>
            <div class="card history-summary-card">
              <p>Best Rank</p>
              <h3>{{ bestRank }}</h3>
            </div>
          </div>

          <div class="table-wrap history-table">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Rank</th>
                  <th>Correct / Wrong</th>
                  <th>Avg Response</th>
                  <th>Joined At</th>
                </tr>
              </thead>
              <tbody>
                @for (item of pagedItems; track item.sessionId) {
                  <tr>
                    <td>{{ item.quizTitle }}</td>
                    <td>{{ statusLabel(item.sessionStatus) }}</td>
                    <td>{{ item.totalScore }}</td>
                    <td>
                      @if (item.rank) {
                        {{ item.rank }}/{{ item.totalParticipants }}
                      } @else {
                        -
                      }
                    </td>
                    <td>{{ item.correctAnswers }} / {{ item.wrongAnswers }}</td>
                    <td>{{ item.averageResponseTimeMs | number:'1.0-0' }} ms</td>
                    <td>{{ item.joinedAt | date:'short' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination-controls
            [page]="livePage"
            [totalPages]="liveTotalPages"
            [pageSize]="livePageSize"
            (pageChange)="goToLivePage($event)"
            (pageSizeChange)="onLivePageSizeChange($event)" />

          <div class="history-mobile-list">
            @for (item of pagedItems; track item.sessionId) {
              <article class="card history-item-card">
                <div class="history-item-head">
                  <strong>{{ item.quizTitle }}</strong>
                  <span class="history-pill">{{ statusLabel(item.sessionStatus) }}</span>
                </div>

                <div class="history-item-grid">
                  <div class="history-metric">
                    <span>Score</span>
                    <strong>{{ item.totalScore }}</strong>
                  </div>
                  <div class="history-metric">
                    <span>Rank</span>
                    <strong>
                      @if (item.rank) {
                        {{ item.rank }}/{{ item.totalParticipants }}
                      } @else {
                        -
                      }
                    </strong>
                  </div>
                  <div class="history-metric">
                    <span>Correct / Wrong</span>
                    <strong>{{ item.correctAnswers }} / {{ item.wrongAnswers }}</strong>
                  </div>
                  <div class="history-metric">
                    <span>Avg Response</span>
                    <strong>{{ item.averageResponseTimeMs | number:'1.0-0' }} ms</strong>
                  </div>
                  <div class="history-metric history-metric-wide">
                    <span>Joined At</span>
                    <strong>{{ item.joinedAt | date:'short' }}</strong>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>
      }

      @if (testItems.length > 0) {
        <section class="history-section">
          <h3>Test Mode Attempts</h3>

          <div class="history-summary">
            <div class="card history-summary-card">
              <p>Attempts</p>
              <h3>{{ testItems.length }}</h3>
            </div>
            <div class="card history-summary-card">
              <p>Average Test Score</p>
              <h3>{{ averageTestScore | number:'1.0-2' }}</h3>
            </div>
            <div class="card history-summary-card">
              <p>Best Accuracy</p>
              <h3>{{ bestAccuracy | number:'1.0-2' }}%</h3>
            </div>
          </div>

          <div class="table-wrap history-table">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Score</th>
                  <th>Correct / Wrong</th>
                  <th>Answered</th>
                  <th>Accuracy</th>
                  <th>Duration</th>
                  <th>Finished At</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                @for (item of pagedTestItems; track item.attemptId) {
                  <tr>
                    <td>{{ item.quizTitle }}</td>
                    <td>{{ item.totalScore }}</td>
                    <td>{{ item.correctAnswers }} / {{ item.wrongAnswers }}</td>
                    <td>{{ item.answeredQuestions }} / {{ item.totalQuestions }}</td>
                    <td>{{ item.accuracyPercent | number:'1.0-2' }}%</td>
                    <td>{{ formatDuration(item.durationSeconds) }}</td>
                    <td>{{ item.endedAt | date:'short' }}</td>
                    <td>
                      <button type="button" class="secondary history-review-button" (click)="reviewAttempt(item.attemptId)">
                        Review Answers
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <app-pagination-controls
            [page]="testPage"
            [totalPages]="testTotalPages"
            [pageSize]="testPageSize"
            (pageChange)="goToTestPage($event)"
            (pageSizeChange)="onTestPageSizeChange($event)" />

          <div class="history-mobile-list">
            @for (item of pagedTestItems; track item.attemptId) {
              <article class="card history-item-card">
                <div class="history-item-head">
                  <strong>{{ item.quizTitle }}</strong>
                  <span class="history-pill">{{ item.accuracyPercent | number:'1.0-2' }}%</span>
                </div>

                <div class="history-item-grid">
                  <div class="history-metric">
                    <span>Score</span>
                    <strong>{{ item.totalScore }}</strong>
                  </div>
                  <div class="history-metric">
                    <span>Correct / Wrong</span>
                    <strong>{{ item.correctAnswers }} / {{ item.wrongAnswers }}</strong>
                  </div>
                  <div class="history-metric">
                    <span>Answered</span>
                    <strong>{{ item.answeredQuestions }} / {{ item.totalQuestions }}</strong>
                  </div>
                  <div class="history-metric">
                    <span>Duration</span>
                    <strong>{{ formatDuration(item.durationSeconds) }}</strong>
                  </div>
                  <div class="history-metric history-metric-wide">
                    <span>Finished At</span>
                    <strong>{{ item.endedAt | date:'short' }}</strong>
                  </div>
                </div>

                <button type="button" class="secondary history-review-button history-review-button-full" (click)="reviewAttempt(item.attemptId)">
                  Review Answers
                </button>
              </article>
            }
          </div>
        </section>
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .history-shell {
      padding: clamp(14px, 3vw, 20px);
    }

    .history-title {
      margin-bottom: 8px;
    }

    .history-section + .history-section {
      margin-top: 18px;
    }

    .history-section h3 {
      margin: 0 0 12px;
      font-size: clamp(1.08rem, 3vw, 1.35rem);
    }

    .history-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 10px 0 14px;
    }

    .history-summary-card {
      padding: 16px;
    }

    .history-summary-card p {
      margin: 0;
    }

    .history-summary-card h3 {
      margin: 4px 0 0;
      font-size: 1.45rem;
    }

    .history-mobile-list {
      display: none;
    }

    .history-item-card {
      padding: 14px;
    }

    .history-item-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .history-item-head strong {
      min-width: 0;
      font-size: 0.98rem;
      line-height: 1.45;
    }

    .history-pill {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text-soft);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .history-item-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    .history-metric {
      min-width: 0;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .history-metric span {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .history-metric strong {
      display: block;
      color: var(--text);
      line-height: 1.45;
    }

    .history-metric-wide {
      grid-column: 1 / -1;
    }

    .history-review-button {
      min-height: 34px;
      padding: 7px 10px;
      min-width: 124px;
      font-size: 0.84rem;
    }

    .history-review-button-full {
      width: 100%;
      margin-top: 12px;
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

    @media (max-width: 900px) {
      .history-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .history-shell {
        padding: 14px;
      }

      .history-table {
        display: none;
      }

      .history-mobile-list {
        display: grid;
        gap: 10px;
      }
    }

    @media (max-width: 560px) {
      .history-summary {
        grid-template-columns: 1fr;
        gap: 8px;
        margin: 8px 0 12px;
      }

      .history-summary-card,
      .history-item-card {
        padding: 12px;
      }

      .history-item-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .history-item-head {
        flex-direction: column;
        align-items: stretch;
      }

      .history-pill {
        width: fit-content;
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
export class PlayerHistoryComponent implements OnInit {
  items: any[] = [];
  testItems: any[] = [];
  livePage = 1;
  livePageSize = 10;
  testPage = 1;
  testPageSize = 10;
  loading = false;
  error = '';
  averageScore = 0;
  bestRank = '-';
  averageTestScore = 0;
  bestAccuracy = 0;

  constructor(
    private resultsService: ResultsService,
    private testModeService: TestModeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = '';

    const sessions$ = this.resultsService.playerHistory().pipe(
      catchError((err) => {
        this.error = err?.error?.message || 'Failed to load history';
        return of([]);
      })
    );

    const tests$ = this.testModeService.history().pipe(
      catchError((err) => {
        if (!this.error) {
          this.error = err?.error?.message || 'Failed to load history';
        }
        return of([]);
      })
    );

    forkJoin({ sessions: sessions$, tests: tests$ }).subscribe({
      next: ({ sessions, tests }) => {
        this.items = (sessions || []).sort((a: any, b: any) => {
          const aDate = new Date(a?.joinedAt ?? '').getTime();
          const bDate = new Date(b?.joinedAt ?? '').getTime();
          return bDate - aDate;
        });

        this.testItems = (tests || []).sort((a: any, b: any) => {
          const aDate = new Date(a?.endedAt ?? a?.startedAt ?? '').getTime();
          const bDate = new Date(b?.endedAt ?? b?.startedAt ?? '').getTime();
          return bDate - aDate;
        });

        this.livePage = 1;
        this.testPage = 1;

        this.loading = false;
        this.calculateSummary();
        this.calculateTestSummary();
      },
      error: () => this.loading = false
    });
  }

  reviewAttempt(attemptId: number): void {
    this.router.navigate(['/test-mode/attempt', attemptId]);
  }

  statusLabel(value: number): string {
    return ['', 'Draft', 'Waiting', 'Live', 'Paused', 'Ended'][Number(value)] || 'Unknown';
  }

  private calculateSummary(): void {
    if (!this.items.length) {
      this.averageScore = 0;
      this.bestRank = '-';
      return;
    }

    this.averageScore = this.items.reduce((sum, x) => sum + Number(x?.totalScore ?? 0), 0) / this.items.length;

    const ranks = this.items
      .map((x) => Number(x?.rank ?? 0))
      .filter((x) => x > 0);
    this.bestRank = ranks.length ? String(Math.min(...ranks)) : '-';
  }

  private calculateTestSummary(): void {
    if (!this.testItems.length) {
      this.averageTestScore = 0;
      this.bestAccuracy = 0;
      return;
    }

    this.averageTestScore = this.testItems.reduce((sum, x) => sum + Number(x?.totalScore ?? 0), 0) / this.testItems.length;
    this.bestAccuracy = Math.max(...this.testItems.map((x) => Number(x?.accuracyPercent ?? 0)));
  }

  formatDuration(value?: number | null): string {
    if (!value || value <= 0) {
      return '-';
    }

    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get liveTotalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.livePageSize));
  }

  get pagedItems(): any[] {
    const start = (this.livePage - 1) * this.livePageSize;
    return this.items.slice(start, start + this.livePageSize);
  }

  get testTotalPages(): number {
    return Math.max(1, Math.ceil(this.testItems.length / this.testPageSize));
  }

  get pagedTestItems(): any[] {
    const start = (this.testPage - 1) * this.testPageSize;
    return this.testItems.slice(start, start + this.testPageSize);
  }

  goToLivePage(page: number): void {
    if (page < 1 || page > this.liveTotalPages || page === this.livePage) {
      return;
    }

    this.livePage = page;
  }

  onLivePageSizeChange(pageSize: number): void {
    if (pageSize === this.livePageSize) {
      return;
    }

    this.livePageSize = pageSize;
    this.livePage = 1;
  }

  goToTestPage(page: number): void {
    if (page < 1 || page > this.testTotalPages || page === this.testPage) {
      return;
    }

    this.testPage = page;
  }

  onTestPageSizeChange(pageSize: number): void {
    if (pageSize === this.testPageSize) {
      return;
    }

    this.testPageSize = pageSize;
    this.testPage = 1;
  }
}
