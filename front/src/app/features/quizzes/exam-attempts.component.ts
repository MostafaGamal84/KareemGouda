import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuizAccessService, QuizAccessUser } from '../../core/services/quiz-access.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-exam-attempts',
  imports: [CommonModule],
  template: `
    <div class="attempts-panel">
      <h4>Student Attempts</h4>
      
      @if ((access?.accessUsers || []).length === 0) {
        <p class="empty-text">No students assigned yet</p>
      }

      <div class="attempts-list">
        @for (user of access?.accessUsers || []; track user.id) {
          <div class="attempt-item">
            <div class="user-info">
              <strong>{{ user.userName }}</strong>
              <span>{{ user.email }}</span>
            </div>
            <div class="attempt-status">
              <span class="attempts-badge" [class.exhausted]="user.attemptCount >= maxAttempts && !user.extraAttemptsApproved">
                {{ user.attemptCount }} / {{ maxAttempts }}
              </span>
              @if (user.extraAttemptsApproved) {
                <span class="extra-badge">Extra Approved</span>
              }
            </div>
            <div class="user-actions">
              @if (user.attemptCount >= maxAttempts && !user.extraAttemptsApproved) {
                <button type="button" class="secondary" (click)="onApproveExtra.emit(user.userId)">
                  Allow Extra
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .attempts-panel { display: grid; gap: 12px; }
    h4 { margin: 0; }
    .empty-text { color: var(--muted); font-size: 0.9rem; }

    .attempts-list { display: grid; gap: 8px; }

    .attempt-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      gap: 12px;
      flex-wrap: wrap;
    }

    .user-info { display: grid; gap: 2px; }
    .user-info strong { font-size: 0.9rem; }
    .user-info span { font-size: 0.8rem; color: var(--muted); }

    .attempt-status { display: flex; gap: 8px; align-items: center; }

    .attempts-badge {
      font-size: 0.8rem;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--surface-soft);
      font-weight: 600;
    }

    .attempts-badge.exhausted {
      background: var(--error-tint);
      color: var(--error);
    }

    .extra-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--success-tint);
      color: var(--success);
    }

    .user-actions { display: flex; gap: 6px; }
  `]
})
export class ExamAttemptsComponent implements OnInit {
  @Input() quizId!: number;
  @Input() maxAttempts = 1;
  access: { accessUsers: QuizAccessUser[] } | null = null;
  onApproveExtra = { emit: (userId: number) => {} };

  constructor(
    private quizAccessService: QuizAccessService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAttempts();
  }

  loadAttempts(): void {
    this.quizAccessService.getByQuizId(this.quizId).subscribe({
      next: (res) => {
        if (res) {
          this.access = res;
        }
      }
    });
  }

  approveExtra(userId: number): void {
    this.quizAccessService.approveExtraAttempts(this.quizId, userId).subscribe({
      next: () => {
        this.loadAttempts();
        this.toast.success('Extra attempts approved');
      }
    });
  }
}
