import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TestModeService } from '../../core/services/test-mode.service';
import { AuthService } from '../../core/services/auth.service';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SafeRichTextPipe],
  template: `
    <div class="attempt-shell">
      @if (!result) {
        @if (loading && !overview) {
          <div class="card loading-card">
            <h2>Preparing your exam board...</h2>
            <p>Loading test attempt data.</p>
          </div>
        }

        @if (overview) {
          <section class="card exam-topbar">
            <div>
              <p class="eyebrow">Test Mode</p>
              <h2>{{ overview.quizTitle }}</h2>
              <p class="topbar-sub">Pick any question, answer what you know first, and review the rest before finishing.</p>
            </div>

            <div class="stats-grid">
              <div class="stat-box">
                <span>Current</span>
                <strong>{{ currentDisplayNumber() }}/{{ overview.totalQuestions }}</strong>
              </div>
              <div class="stat-box">
                <span>Answered</span>
                <strong>{{ answeredQuestionsCount() }}</strong>
              </div>
              <div class="stat-box">
                <span>Remaining</span>
                <strong>{{ remainingQuestionsCount() }}</strong>
              </div>
              @if (overview.durationMinutes > 0) {
                <div class="stat-box" [class.timer-warning]="remainingSeconds <= 60 && remainingSeconds > 0" [class.timer-critical]="remainingSeconds <= 30">
                  <span>Time Left</span>
                  <strong>{{ formatTimer(remainingSeconds) }}</strong>
                </div>
              } @else {
                <div class="stat-box">
                  <span>Limit</span>
                  <strong>{{ durationLabel() }}</strong>
                </div>
              }
            </div>
          </section>

          <section class="card exam-board">
            <div class="board-head">
              <div>
                <p class="board-label">Question Navigator</p>
                <h3>Choose any question and come back later.</h3>
              </div>

            </div>

            <div class="question-map">
              @for (item of overview.questions; track item.questionIndex) {
                <button
                  type="button"
                  class="question-chip"
                  [class.question-chip-current]="item.questionIndex === currentQuestionIndex"
                  [class.question-chip-saved]="isQuestionAnswered(item.questionId)"
                  (click)="goToQuestion(item.questionIndex)">
                  {{ item.questionIndex + 1 }}
                </button>
              }
            </div>


            @if (error) {
              <div class="alert inline-message">{{ error }}</div>
            }

            @if (questionData) {
              <div class="question-panel" [class.question-panel-loading]="loadingQuestion">
                <div class="question-head">
                  <div>
                    <p class="question-kicker">Q{{ questionData.questionIndex + 1 }}</p>
                    <h3>{{ questionData.question.title }}</h3>
                  </div>
                  @if (!isEditMode && canEditQuestion()) {
                    <button type="button" class="secondary edit-question-btn" (click)="enableEditMode()">
                      <i class="pi pi-pencil"></i> Edit
                    </button>
                  }

                </div>

                @if (isEditMode) {
                  <div class="edit-question-form card">
                    <h4>Edit Question</h4>
                    <div class="field">
                      <label>Title</label>
                      <input type="text" [(ngModel)]="editForm.title" class="form-control" />
                    </div>
                    <div class="field">
                      <label>Question Text</label>
                      <textarea [(ngModel)]="editForm.text" rows="4" class="form-control"></textarea>
                    </div>
                    <div class="edit-actions">
                      <button type="button" class="secondary" (click)="cancelEdit()" [disabled]="isSavingEdit">Cancel</button>
                      <button type="button" (click)="saveEdit()" [disabled]="isSavingEdit">{{ isSavingEdit ? 'Saving...' : 'Save Changes' }}</button>
                    </div>
                  </div>
                }

                <div class="question-text rich-text-content" [innerHTML]="questionData.question.text | safeRichText"></div>

                @if (questionData.question.imageUrl) {
                  <img class="question-inline-image" [src]="questionData.question.imageUrl" alt="Question illustration" />
                }

                @if (questionData.question.type !== 3) {
                  @if (isMultipleChoiceQuestion()) {
                    <div class="saved-hint editing-hint">
                      Multiple choice: select every correct answer before moving on.
                    </div>
                  }

                  <div class="choices-grid">
                    @for (choice of questionData.question.choices; track choice.id; let idx = $index) {
                      <button
                        type="button"
                        class="choice-card"
                        [class.choice-card-selected]="isChoiceSelected(choice.id)"
                        [disabled]="isSubmitting || isFinishing"
                        (click)="selectChoice(choice.id)">
                        <span class="choice-badge">{{ choiceLabel(idx) }}</span>
                        <span class="choice-card-content">
                          @if (choice.choiceText) {
                            <span>{{ choice.choiceText }}</span>
                          }
                          @if (choice.imageUrl) {
                            <img class="choice-card-image" [src]="choice.imageUrl" [alt]="'Choice ' + choiceLabel(idx)" />
                          }
                        </span>
                      </button>
                    }
                  </div>
                }

                @if (questionData.question.type === 3) {
                  <div class="field answer-field">
                    <label for="test-attempt-answer">Your answer</label>
                    <textarea
                      id="test-attempt-answer"
                      name="testAttemptAnswer"
                      rows="5"
                      [(ngModel)]="textAnswer"
                      (ngModelChange)="onTextAnswerChange($event)"
                      [disabled]="isSubmitting || isFinishing"
                      placeholder="Write your answer here"></textarea>
                  </div>
                }

                <div class="attempt-actions two-actions">
                  <button
                    class="secondary"
                    (click)="goPrevious()"
                    [disabled]="!canGoPrevious() || isSubmitting || isFinishing || loadingQuestion">
                    Previous
                  </button>
                  <button
                    (click)="goNext()"
                    [disabled]="isSubmitting || isFinishing || loadingQuestion">
                    {{ isLastQuestion() ? (isFinishing ? 'Finishing...' : 'Finish Attempt') : 'Next Question' }}
                  </button>
                </div>

                @if (answeredQuestionsCount() === overview.totalQuestions) {
                  <div class="success finish-ready">
                    All questions are answered. You can still move back, change any answer, then finish the attempt.
                  </div>
                }
              </div>
            } @else if (loadingQuestion) {
              <div class="empty-panel">
                <h3>Loading questions...</h3>
                <p>Your exam questions are being prepared now.</p>
              </div>
            } @else {
              <div class="empty-panel">
                <h3>No question selected right now.</h3>
                <p>Select a question number above or finish the attempt if you are done.</p>
                <button class="secondary" (click)="finish()" [disabled]="isFinishing">{{ isFinishing ? 'Finishing...' : 'Finish Attempt' }}</button>
              </div>
            }
          </section>
        }
      }

      @if (result) {
        <div class="card result-card">
          <p class="eyebrow">Final Summary</p>
          <h2>{{ result.quizTitle || 'Result Summary' }}</h2>

          <div class="stats-grid result-stats">
            <div class="stat-box">
              <span>Total Score</span>
              <strong>{{ result.totalScore }}</strong>
            </div>
            <div class="stat-box">
              <span>Answered</span>
              <strong>{{ result.answeredQuestions }} / {{ result.totalQuestions }}</strong>
            </div>
            <div class="stat-box">
              <span>Correct</span>
              <strong>{{ result.correctAnswers }}</strong>
            </div>
            <div class="stat-box">
              <span>Wrong</span>
              <strong>{{ result.wrongAnswers }}</strong>
            </div>
          </div>

          <div class="result-extra">
            <p><strong>Accuracy:</strong> {{ result.accuracyPercent | number:'1.0-2' }}%</p>
            <p><strong>Duration:</strong> {{ formatDuration(result.durationSeconds) }}</p>
          </div>

          @if (reviewItems().length) {
            <div class="review-block">
              <div class="review-head">
                <div>
                  <p class="board-label">Answer Review</p>
                  <h3>Exam details and answer key</h3>
                </div>
              </div>

              <div class="review-grid">
                @for (item of reviewItems(); track item.questionId) {
                  <article
                    class="review-card"
                    [class.review-card-correct]="item.isCorrect"
                    [class.review-card-wrong]="item.isAnswered && !item.isCorrect"
                    [class.review-card-skipped]="!item.isAnswered">
                    <div class="review-card-head">
                      <div>
                        <p class="question-kicker">Q{{ item.questionIndex + 1 }}</p>
                        <h4>{{ item.questionTitle }}</h4>
                      </div>
                      <span
                        class="review-status"
                        [class.review-status-correct]="item.isCorrect"
                        [class.review-status-wrong]="item.isAnswered && !item.isCorrect"
                        [class.review-status-skipped]="!item.isAnswered">
                        {{ reviewStatusLabel(item) }}
                      </span>
                    </div>
                    <div class="review-text rich-text-content" [innerHTML]="item.questionText | safeRichText"></div>

                    <div class="review-answer">
                      <span>Your answer</span>
                      <strong>{{ item.selectedAnswerText || 'No recorded answer' }}</strong>
                    </div>

                    <div class="review-answer review-answer-correct">
                      <span>Correct answer</span>
                      <strong>{{ item.correctAnswerText || 'No answer key recorded' }}</strong>
                    </div>

                    @if (item.explanation) {
                      <div class="review-answer review-answer-correct">
                        <span>Explanation</span>
                        <strong>{{ item.explanation }}</strong>
                      </div>
                    }
                  </article>
                }
              </div>
            </div>
          } @else {
            <div class="success finish-ready" style="margin-top: 18px;">No answer details found for this attempt.</div>
          }

          <div class="row" style="margin-top:18px;">
            <button (click)="goToHistory()">My History</button>
            <button class="secondary" (click)="goToTestList()">Back To Test Mode</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .attempt-shell {
      width: min(1160px, 100%);
      max-width: 100%;
      min-width: 0;
      margin: 0 auto;
      display: grid;
      gap: 14px;
    }

    .loading-card,
    .result-card,
    .exam-topbar,
    .exam-board,
    .question-panel,
    .review-card,
    .stat-box,
    .empty-panel {
      min-width: 0;
      max-width: 100%;
      overflow: visible;
    }

    .topbar-sub {
      margin-top: 8px;
      max-width: 54ch;
    }

    .stats-grid {
      margin-top: 16px;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .stat-box {
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .stat-box span {
      display: block;
      color: var(--muted);
      font-size: 0.82rem;
      margin-bottom: 5px;
    }

    .stat-box strong {
      color: var(--text);
      font-size: 1.12rem;
    }

    .stat-box.timer-warning {
      border-color: var(--warning-border);
      background: var(--warning-tint);
    }

    .stat-box.timer-warning strong {
      color: var(--warning);
    }

    .stat-box.timer-critical {
      border-color: var(--alert-border);
      background: var(--danger-tint);
    }

    .stat-box.timer-critical strong {
      color: var(--text-danger);
    }

    .board-head,
    .question-head,
    .review-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      flex-wrap: wrap;
      min-width: 0;
    }

    .board-label,
    .question-kicker {
      margin: 0 0 6px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
      font-weight: 800;
    }

    .question-map {
      margin-top: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }

    .question-chip {
      width: 38px;
      min-width: 38px;
      height: 38px;
      min-height: 38px;
      padding: 0;
      border-radius: 999px;
      background: var(--secondary-gradient);
      border-color: var(--button-secondary-border);
      color: var(--muted-strong);
      box-shadow: none;
      font-size: 0.84rem;
    }

    .question-chip:hover {
      box-shadow: none;
      border-color: var(--button-hover-border);
      background: var(--surface-soft);
    }

    .question-chip.question-chip-current {
      background: var(--primary-gradient);
      color: #ffffff;
      border-color: var(--input-focus-border);
    }

    .question-chip.question-chip-saved {
      background: var(--success-bg);
      color: var(--success-text);
      border-color: var(--success-border);
    }

    .question-chip.question-chip-current.question-chip-saved {
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: inset 0 0 0 1px var(--success-border);
    }

    .question-chip.question-chip-draft {
      border-color: var(--warning-border);
      background: var(--warning-tint);
      color: var(--warning);
    }

    .inline-message {
      margin-top: 14px;
    }

    .question-panel {
      margin-top: 18px;
      padding: 18px;
      border-radius: 22px;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .question-panel-loading {
      opacity: 0.72;
    }

    .question-text,
    .review-text {
      margin-top: 10px;
      font-size: 1rem;
      line-height: 1.8;
    }

    .question-inline-image {
      width: min(320px, 100%);
      margin-top: 14px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .saved-hint {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--success-border);
      background: var(--success-bg);
      color: var(--success-text);
      font-size: 0.92rem;
    }

    .saved-hint.editing-hint {
      border-color: var(--warning-border);
      background: var(--warning-tint);
      color: var(--warning);
    }

    .choices-grid {
      margin-top: 18px;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      min-width: 0;
    }

    .choice-card {
      width: 100%;
      min-width: 0;
      min-height: 58px;
      padding: 12px 14px;
      border-radius: 14px;
      justify-content: flex-start;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      text-align: left;
      background: var(--secondary-gradient);
      color: var(--text-soft);
      box-shadow: none;
    }

    .choice-card:hover {
      box-shadow: none;
      background: var(--surface-soft);
      border-color: var(--button-hover-border);
    }

    .choice-card.choice-card-selected {
      border-color: var(--input-focus-border);
      background: var(--primary-gradient);
      color: #ffffff;
    }

    .choice-badge {
      width: 28px;
      min-width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--muted-strong);
      font-weight: 800;
      font-size: 0.8rem;
    }

    .choice-card.choice-card-selected .choice-badge {
      background: var(--ring-strong);
      color: #ffffff;
      border-color: var(--input-focus-border);
    }

    .choice-card-content {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .choice-card-image {
      width: min(220px, 100%);
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.08);
    }

    .answer-field {
      margin-top: 18px;
    }

    .attempt-actions {
      margin-top: 18px;
      display: grid;
      gap: 10px;
    }

    .two-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .finish-ready,
    .review-block {
      margin-top: 16px;
    }

    .empty-panel {
      margin-top: 18px;
      padding: 18px;
      border-radius: 18px;
      border: 1px dashed var(--border-strong);
      background: var(--surface-soft);
    }

    .result-extra {
      margin-top: 16px;
      display: grid;
      gap: 8px;
    }

    .review-grid {
      margin-top: 14px;
      display: grid;
      gap: 14px;
    }

    .review-card {
      padding: 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .review-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .review-card h4 {
      margin: 0;
    }

    .review-status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 82px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .review-status-correct {
      border-color: var(--success-border);
      background: var(--success-tint);
      color: var(--text-success);
    }

    .review-status-wrong {
      border-color: var(--alert-border);
      background: var(--danger-tint);
      color: var(--text-danger);
    }

    .review-status-skipped {
      border-color: var(--warning-border);
      background: var(--warning-tint);
      color: var(--warning);
    }

    .review-answer {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--alert-border);
      background: var(--danger-tint);
    }

    .review-answer span {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
      margin-bottom: 4px;
    }

    .review-answer strong {
      color: var(--text);
    }

    .review-answer-correct {
      border-color: var(--success-border);
      background: var(--success-tint);
    }

    @media (max-width: 980px) {
      .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .choices-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .stats-grid,
      .two-actions {
        grid-template-columns: 1fr;
      }

      .question-panel,
      .exam-topbar,
      .exam-board,
      .result-card {
        padding: 12px;
      }

      .question-map {
        gap: 6px;
      }

      .review-card-head {
        flex-direction: column;
        align-items: stretch;
      }

      .review-status {
        width: fit-content;
      }

      .question-chip {
        width: 28px;
        min-width: 28px;
        height: 28px;
        min-height: 28px;
        font-size: 0.8rem;
      }

      .exam-header h2,
      .exam-timer {
        font-size: 1rem;
      }

      .exam-timer {
        padding: 6px 10px;
      }

      .question-text {
        font-size: 0.95rem;
      }

      .answer-option {
        padding: 10px 12px;
        font-size: 0.9rem;
      }

      .result-card h2 {
        font-size: 1.2rem;
      }

      .result-card .score-value {
        font-size: 2rem;
      }

      .result-card .score-label {
        font-size: 0.85rem;
      }
    }

    @media (max-width: 480px) {
      .question-panel,
      .exam-topbar,
      .exam-board,
      .result-card {
        padding: 10px;
      }

      .question-chip {
        width: 24px;
        min-width: 24px;
        height: 24px;
        min-height: 24px;
        font-size: 0.7rem;
      }

      .question-text {
        font-size: 0.88rem;
      }

      .answer-option {
        padding: 8px 10px;
        font-size: 0.85rem;
      }

      .result-card .score-value {
        font-size: 1.8rem;
      }
    }
  `]
})
export class TestModeAttemptComponent implements OnInit, OnDestroy {
  attemptId = 0;
  overview: any;
  questionData: any;
  result: any;
  error = '';
  loading = false;
  loadingQuestion = false;
  isSubmitting = false;
  isFinishing = false;
  currentQuestionIndex = 0;
  selectedChoiceIds: number[] = [];
  textAnswer = '';
  isEditMode = false;
  isSavingEdit = false;
  editForm = { title: '', text: '' };
  private questionsCache: any[] = [];
  private draftChoices = new Map<number, number[]>();
  private draftTexts = new Map<number, string>();
  private timerInterval: any = null;
  remainingSeconds = 0;

  constructor(
    private route: ActivatedRoute,
    private service: TestModeService,
    private router: Router,
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.attemptId = Number(this.route.snapshot.paramMap.get('attemptId'));
    this.loadAttempt();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  loadAttempt(preferredIndex?: number | null): void {
    this.loading = true;
    this.error = '';

    this.service.overview(this.attemptId).subscribe({
      next: (res) => {
        this.loading = false;

        if (res?.isFinished) {
          this.overview = null;
          this.questionData = null;
          this.questionsCache = [];
          this.stopTimer();
          this.loadResult();
          return;
        }

        this.overview = res;
        this.initializeTimer();

        if (!this.overview?.questions?.length) {
          this.questionsCache = [];
          this.questionData = null;
          return;
        }

        this.loadQuestions(preferredIndex);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load attempt';
      }
    });
  }

  goToQuestion(index: number): void {
    if (this.loadingQuestion || this.isSubmitting || this.isFinishing || index === this.currentQuestionIndex) {
      return;
    }

    this.moveWithAutoSave(() => this.setCurrentQuestion(index));
  }

  goPrevious(): void {
    if (!this.canGoPrevious()) {
      return;
    }

    this.moveWithAutoSave(() => this.setCurrentQuestion(this.currentQuestionIndex - 1));
  }

  goNext(): void {
    if (this.isLastQuestion()) {
      this.finish();
      return;
    }

    this.moveWithAutoSave(() => this.setCurrentQuestion(this.currentQuestionIndex + 1));
  }

  finish(): void {
    if (this.isFinishing || this.result) {
      return;
    }

    this.persistDraft();
    this.completeFinish();
  }

  selectChoice(choiceId: number): void {
    if (!this.questionData || this.questionData.question.type === 3 || this.isSubmitting || this.isFinishing) {
      return;
    }

    const questionId = Number(this.questionData.question.id);
    if (this.isMultipleChoiceQuestion()) {
      this.selectedChoiceIds = this.selectedChoiceIds.includes(choiceId)
        ? this.selectedChoiceIds.filter((id) => id !== choiceId)
        : [...this.selectedChoiceIds, choiceId];
    } else {
      this.selectedChoiceIds = [choiceId];
    }
    this.persistChoiceDraft(questionId, this.selectedChoiceIds);
    this.error = '';
  }

  onTextAnswerChange(value: string): void {
    this.textAnswer = value ?? '';
    this.persistDraft();
  }

  canGoPrevious(): boolean {
    return this.currentQuestionIndex > 0;
  }

  answeredQuestionsCount(): number {
    const questions = this.overview?.questions ?? [];
    return questions.filter((item: any) => this.isQuestionAnswered(Number(item.questionId))).length;
  }

  remainingQuestionsCount(): number {
    const total = Number(this.overview?.totalQuestions ?? this.overview?.questions?.length ?? 0);
    return Math.max(0, total - this.answeredQuestionsCount());
  }

  isQuestionAnswered(questionId: number): boolean {
    if (this.draftChoices.has(questionId)) {
      return (this.draftChoices.get(questionId) || []).length > 0;
    }

    if (this.draftTexts.has(questionId)) {
      return !!String(this.draftTexts.get(questionId) ?? '').trim();
    }

    if (this.questionData && Number(this.questionData.question?.id) === questionId) {
      return this.currentEditorHasAnswer();
    }

    const item = this.overview?.questions?.find((entry: any) => Number(entry.questionId) === questionId);
    return !!item?.isAnswered;
  }

  currentDisplayNumber(): number {
    return (this.currentQuestionIndex || 0) + 1;
  }

  durationLabel(): string {
    const minutes = Number(this.overview?.durationMinutes ?? 0);
    return minutes > 0 ? `${minutes} min` : 'No limit';
  }

  choiceLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  isLastQuestion(): boolean {
    const total = Number(this.overview?.totalQuestions ?? this.questionsCache.length ?? 0);
    return total > 0 && this.currentQuestionIndex >= total - 1;
  }

  goToHistory(): void {
    this.router.navigate(['/player/history']);
  }

  goToTestList(): void {
    this.router.navigate(['/test-mode']);
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

  reviewItems(): any[] {
    if (Array.isArray(this.result?.reviewQuestions) && this.result.reviewQuestions.length) {
      return this.result.reviewQuestions;
    }

    return Array.isArray(this.result?.incorrectQuestions) ? this.result.incorrectQuestions : [];
  }

  reviewStatusLabel(item: any): string {
    if (!item?.isAnswered) {
      return 'Skipped';
    }

    return item?.isCorrect ? 'Correct' : 'Wrong';
  }

  formatTimer(seconds: number): string {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private initializeTimer(): void {
    this.stopTimer();
    const durationMinutes = this.overview?.durationMinutes ?? 0;
    if (durationMinutes <= 0) {
      this.remainingSeconds = 0;
      return;
    }

    const timerStartedAt = this.overview?.timerStartedAt;
    const elapsedSeconds = this.overview?.elapsedSeconds ?? 0;
    const totalSeconds = durationMinutes * 60;

    if (timerStartedAt) {
      const serverStartMs = new Date(timerStartedAt + 'Z').getTime();
      const nowMs = Date.now();
      const elapsedMs = Math.max(0, nowMs - serverStartMs);
      const elapsed = Math.floor(elapsedMs / 1000);
      this.remainingSeconds = Math.max(0, totalSeconds - elapsed);
    } else {
      this.remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    }

    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        if (this.remainingSeconds <= 0) {
          this.onTimerExpired();
        }
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private onTimerExpired(): void {
    this.stopTimer();
    this.error = 'Time is up! Your exam has been automatically submitted.';
    if (!this.isFinishing && !this.result) {
      this.autoSubmit();
    }
  }

  private autoSubmit(): void {
    this.finish();
  }

  private loadQuestions(preferredIndex?: number | null): void {
    this.loadingQuestion = true;
    this.error = '';

    this.service.questions(this.attemptId).subscribe({
      next: (res) => {
        this.loadingQuestion = false;
        this.questionsCache = (Array.isArray(res) ? res : []).map((item: any) => ({
          ...item,
          question: item?.question
            ? {
                ...item.question,
                imageUrl: this.resolveAssetUrl(item.question.imageUrl ?? item.question.ImageUrl ?? ''),
                choices: Array.isArray(item.question?.choices ?? item.question?.Choices)
                  ? (item.question?.choices ?? item.question?.Choices).map((choice: any) => ({
                      ...choice,
                      imageUrl: this.resolveAssetUrl(choice?.imageUrl ?? choice?.ImageUrl ?? '')
                    }))
                  : []
              }
            : item?.question
        }));

        if (!this.questionsCache.length) {
          this.questionData = null;
          return;
        }

        const targetIndex = this.resolveTargetIndex(preferredIndex);
        if (targetIndex === null) {
          this.questionData = null;
          return;
        }

        this.setCurrentQuestion(targetIndex);
      },
      error: (err) => {
        this.loadingQuestion = false;
        this.error = err?.error?.message || 'Failed to load questions';
      }
    });
  }

  private loadResult(): void {
    this.loading = true;
    this.error = '';

    this.service.result(this.attemptId).subscribe({
      next: (res) => {
        this.loading = false;
        this.result = res;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load result';
      }
    });
  }

  private setCurrentQuestion(index: number): void {
    if (index < 0 || index >= this.questionsCache.length) {
      this.questionData = null;
      return;
    }

    this.questionData = this.questionsCache[index];
    this.currentQuestionIndex = Number(this.questionData?.questionIndex ?? index);
    this.restoreEditorState();
  }

  private moveWithAutoSave(action: () => void): void {
    this.persistDraft();
    action();
  }

  private completeFinish(): void {
    this.isFinishing = true;
    this.error = '';

    this.service.finish(this.attemptId, {
      answers: this.buildFinishPayload()
    }).subscribe({
      next: (res) => {
        this.isFinishing = false;
        this.questionData = null;
        this.result = res;
      },
      error: (err) => {
        this.isFinishing = false;
        this.error = err?.error?.message || 'Failed to finish attempt';
      }
    });
  }

  private resolveTargetIndex(preferredIndex?: number | null): number | null {
    const totalQuestions = Math.max(Number(this.overview?.totalQuestions ?? 0), this.questionsCache.length);
    if (!totalQuestions) {
      return null;
    }

    if (preferredIndex !== null && preferredIndex !== undefined && preferredIndex >= 0 && preferredIndex < totalQuestions) {
      return preferredIndex;
    }

    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < totalQuestions) {
      return this.currentQuestionIndex;
    }

    const currentIndex = Number(this.overview?.currentQuestionIndex ?? -1);
    if (currentIndex >= 0 && currentIndex < totalQuestions) {
      return currentIndex;
    }

    const firstUnanswered = this.overview?.questions?.find((x: any) => !this.isQuestionAnswered(Number(x.questionId)));
    return firstUnanswered ? Number(firstUnanswered.questionIndex) : 0;
  }

  private restoreEditorState(): void {
    if (!this.questionData?.question) {
      this.selectedChoiceIds = [];
      this.textAnswer = '';
      return;
    }

    const questionId = Number(this.questionData.question.id);
    if (Number(this.questionData.question.type) === 3) {
      this.textAnswer = this.draftTexts.has(questionId)
        ? String(this.draftTexts.get(questionId) ?? '')
        : String(this.questionData.textAnswer ?? '');
      this.selectedChoiceIds = [];
      return;
    }

    const draftChoices = this.draftChoices.get(questionId);
    const questionSelections = Array.isArray(this.questionData.selectedChoiceIds)
      ? this.questionData.selectedChoiceIds.map((value: any) => Number(value)).filter((value: number) => value > 0)
      : [];
    const fallbackChoice = Number(this.questionData.selectedChoiceId ?? 0);
    this.selectedChoiceIds = draftChoices !== undefined
      ? [...draftChoices]
      : (questionSelections.length ? questionSelections : (fallbackChoice > 0 ? [fallbackChoice] : []));
    this.textAnswer = '';
  }

  private persistDraft(): void {
    if (!this.questionData?.question) {
      return;
    }

    const questionId = Number(this.questionData.question.id);
    if (Number(this.questionData.question.type) === 3) {
      this.persistTextDraft(questionId, this.textAnswer);
      this.selectedChoiceIds = [];
      return;
    }

    this.persistChoiceDraft(questionId, this.selectedChoiceIds);
  }

  private persistChoiceDraft(questionId: number, choiceIds: number[]): void {
    const normalized = (choiceIds || []).map((value) => Number(value)).filter((value) => value > 0);
    if (normalized.length) {
      this.draftChoices.set(questionId, Array.from(new Set(normalized)));
    } else {
      this.draftChoices.delete(questionId);
    }

    this.draftTexts.delete(questionId);
  }

  private persistTextDraft(questionId: number, value: string): void {
    const nextValue = String(value ?? '');
    if (nextValue.trim()) {
      this.draftTexts.set(questionId, nextValue);
    } else {
      this.draftTexts.delete(questionId);
    }

    this.draftChoices.delete(questionId);
  }

  private buildFinishPayload(): Array<{ questionId: number; selectedChoiceId: number | null; selectedChoiceIds: number[]; textAnswer: string | null }> {
    const questionIds = new Set<number>();
    for (const item of this.overview?.questions ?? []) {
      questionIds.add(Number(item.questionId));
    }

    for (const questionId of this.draftChoices.keys()) {
      questionIds.add(questionId);
    }

    for (const questionId of this.draftTexts.keys()) {
      questionIds.add(questionId);
    }

    const answers: Array<{ questionId: number; selectedChoiceId: number | null; selectedChoiceIds: number[]; textAnswer: string | null }> = [];
    for (const questionId of questionIds) {
      const selectedChoiceIds = [...(this.draftChoices.get(questionId) || [])];
      if (selectedChoiceIds.length) {
        answers.push({
          questionId,
          selectedChoiceId: selectedChoiceIds.length === 1 ? selectedChoiceIds[0] : null,
          selectedChoiceIds,
          textAnswer: null
        });
        continue;
      }

      const textAnswer = String(this.draftTexts.get(questionId) ?? '').trim();
      if (textAnswer) {
        answers.push({ questionId, selectedChoiceId: null, selectedChoiceIds: [], textAnswer });
      }
    }

    return answers;
  }

  private currentEditorHasAnswer(): boolean {
    if (!this.questionData?.question) {
      return false;
    }

    if (Number(this.questionData.question.type) === 3) {
      return !!this.textAnswer.trim();
    }

    return this.selectedChoiceIds.length > 0;
  }

  isChoiceSelected(choiceId: number): boolean {
    return this.selectedChoiceIds.includes(Number(choiceId));
  }

  isMultipleChoiceQuestion(): boolean {
    return Number(this.questionData?.question?.type) !== 3 && Number(this.questionData?.question?.selectionMode ?? 1) === 2;
  }

  private resolveAssetUrl(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const apiRoot = environment.apiBaseUrl.replace(/\/api\/?$/i, '');
    return raw.startsWith('/') ? `${apiRoot}${raw}` : `${apiRoot}/${raw}`;
  }

  canEditQuestion(): boolean {
    return this.auth.hasPermission('EditQuestions');
  }

  enableEditMode(): void {
    if (!this.questionData?.question) return;
    this.editForm = {
      title: this.questionData.question.title || '',
      text: this.questionData.question.text || ''
    };
    this.isEditMode = true;
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.editForm = { title: '', text: '' };
  }

  saveEdit(): void {
    if (!this.questionData?.question?.id || this.isSavingEdit) return;

    this.isSavingEdit = true;
    const questionId = this.questionData.question.id;
    const dto = {
      title: this.editForm.title,
      text: this.editForm.text,
      type: this.questionData.question.type,
      categoryId: this.questionData.question.categoryId
    };

    this.http.put(`${environment.apiBaseUrl}/api/questions/${questionId}`, dto).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.isEditMode = false;
        this.questionData.question.title = this.editForm.title;
        this.questionData.question.text = this.editForm.text;
      },
      error: () => {
        this.isSavingEdit = false;
        this.error = 'Failed to save question changes';
      }
    });
  }
}





