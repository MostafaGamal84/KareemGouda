import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TestModeService } from '../../core/services/test-mode.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

@Component({
  standalone: true,
  imports: [CommonModule, PaginationControlsComponent],
  template: `
    <div class="card test-card">
      <h2>Test Mode</h2>
      <p class="sub">Select a published test quiz and start attempt.</p>

      @if (loading) {
        <p class="muted">Loading quizzes...</p>
      }

      @if (!loading && quizzes.length === 0 && !error) {
        <div class="alert">No published test quizzes found.</div>
      }

      @if (quizzes.length > 0) {
        <div class="table-wrap desktop-table">
          <table>
            <thead><tr><th>Quiz</th><th>Duration</th><th></th></tr></thead>
            <tbody>
              @for (q of quizzes; track q.id) {
                <tr>
                  <td>{{ q.title }}</td>
                  <td>{{ q.durationMinutes }} min</td>
                  <td><button (click)="start(q.id)">Start</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="mobile-list">
          @for (q of quizzes; track q.id) {
            <article class="mobile-item">
              <h3>{{ q.title }}</h3>
              <p>{{ q.durationMinutes }} min</p>
              <button (click)="start(q.id)">Start</button>
            </article>
          }
        </div>

        <app-pagination-controls
          [page]="page"
          [totalPages]="totalPages"
          [pageSize]="pageSize"
          (pageChange)="goToPage($event)"
          (pageSizeChange)="onPageSizeChange($event)" />
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .test-card {
      max-width: 980px;
      margin: 0 auto;
      min-width: 0;
    }

    .sub {
      margin-bottom: 12px;
    }

    .muted {
      color: var(--muted);
    }

    .mobile-list {
      display: none;
      gap: 10px;
      min-width: 0;
      min-height: 300px;
    }

    .table-wrap {
      min-height: 400px;
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

    @media (max-width: 760px) {
      .desktop-table {
        display: none;
      }

      .mobile-list {
        display: grid;
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
export class TestModeListComponent implements OnInit {
  quizzes: any[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  error = '';
  loading = false;

  constructor(private testService: TestModeService, private router: Router) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.testService.quizzes({ pageNumber: this.page, pageSize: this.pageSize }).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.quizzes = res.items || [];
        this.totalCount = Number(res?.totalCount ?? 0);

        if (this.totalCount === 0) {
          this.page = 1;
        }

        if (this.page > this.totalPages && this.totalCount > 0) {
          this.page = this.totalPages;
          this.load();
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load quizzes';
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.page = page;
    this.load();
  }

  onPageSizeChange(pageSize: number): void {
    if (pageSize === this.pageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.page = 1;
    this.load();
  }

  start(quizId: number): void {
    this.error = '';
    this.testService.start(quizId).subscribe({
      next: (res) => {
        const allowed = res?.allowed ?? res?.Allowed ?? true;
        if (allowed === false) {
          this.error = res?.message || 'You have reached the maximum number of attempts.';
          return;
        }
        const attemptId = res?.attemptId ?? res?.AttemptId ?? 0;
        if (attemptId > 0) {
          this.router.navigate(['/test-mode/attempt', attemptId]);
        }
      },
      error: (err) => this.error = err?.error?.message || 'Failed to start attempt'
    });
  }
}



