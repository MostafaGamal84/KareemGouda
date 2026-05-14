import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { QuizQuestionsComponent } from './quiz-questions.component';
import { QuizAccessComponent } from './quiz-access.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QuizQuestionsComponent, QuizAccessComponent],
  template: `
    <div class="details-shell">
      @if (quiz) {
        <section class="card hero-card">
          <div class="hero-head">
            <div>
              <p class="eyebrow">Test Settings</p>
              @if (isEditingTitle) {
                <input type="text" [(ngModel)]="editTitle" class="form-control title-input" (blur)="saveTitle()" (keyup.enter)="saveTitle()" />
              } @else {
                <h2 (click)="startEditTitle()">{{ quiz.title }}</h2>
              }
              @if (isEditingDesc) {
                <textarea [(ngModel)]="editDesc" class="form-control" rows="2" (blur)="saveDesc()" placeholder="No description"></textarea>
              } @else {
                <p class="hero-copy" (click)="startEditDesc()">{{ quiz.description || 'Click to add description' }}</p>
              }
            </div>

            <div class="hero-actions">
              <a [routerLink]="['/quizzes', quiz.id, 'edit']"><button type="button">Edit</button></a>
              @if (!isExamLive(quiz)) {
                <button type="button" (click)="togglePublish()">{{ quiz.isPublished ? 'Unpublish' : 'Publish' }}</button>
              }
              @if (auth.hasPermission('DeleteTests')) {
                <button type="button" class="danger" (click)="deleteQuiz()">Delete</button>
              }
              <a routerLink="/quizzes"><button type="button" class="secondary">Back</button></a>
            </div>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <span>Status</span>
              <strong>{{ quiz.isPublished ? 'Published' : 'Draft' }}</strong>
            </div>
            <div class="metric-card">
              <span>Duration</span>
              @if (isEditingDuration) {
                <input type="number" [(ngModel)]="editDuration" class="form-control duration-input" (blur)="saveDuration()" (keyup.enter)="saveDuration()" min="0" />
              } @else {
                <strong (click)="startEditDuration()">{{ quiz.durationMinutes ? quiz.durationMinutes + ' min' : 'No limit' }}</strong>
              }
            </div>
            <div class="metric-card">
              <span>Questions</span>
              <strong>{{ quiz.questions?.length || 0 }}</strong>
            </div>
            <div class="metric-card">
              <span>Marks</span>
              <strong>{{ marksLabel() }}</strong>
            </div>
          </div>

          <div class="tab-nav">
            <button type="button" [class.active]="activeTab === 'questions'" (click)="activeTab = 'questions'">Questions</button>
            <button type="button" [class.active]="activeTab === 'access'" (click)="activeTab = 'access'">Access Settings</button>
          </div>
        </section>

        @if (activeTab === 'questions') {
          <app-quiz-questions
            [quizId]="quiz.id"
            [quizTitle]="quiz.title"
            [questions]="quiz.questions || []"
            (questionsChanged)="load()">
          </app-quiz-questions>
        }

        @if (activeTab === 'access') {
          <section class="card access-card">
            <app-quiz-access [quizId]="quiz.id" (accessChanged)="load()"></app-quiz-access>
          </section>
        }
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .details-shell {
      display: grid;
      gap: 14px;
      min-width: 0;
    }

    .hero-card,
    .access-card {
      display: grid;
      gap: 14px;
    }

    .hero-head,
    .section-head,
    .question-card-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .hero-head h2,
    .section-head h3 {
      margin: 0;
    }

    .hero-head h2, .hero-head strong, .hero-head .metric-card span {
      cursor: pointer;
    }

    .hero-head h2:hover, .hero-head strong:hover {
      color: var(--primary);
    }

    .title-input, .duration-input {
      font-size: inherit;
      font-weight: inherit;
      padding: 4px 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      color: var(--text);
    }

    .hero-copy,
    .section-copy {
      margin: 6px 0 0;
      max-width: 64ch;
      cursor: pointer;
    }

    .hero-copy:hover {
      color: var(--text-soft);
    }

    .hero-actions,
    .builder-actions,
    .bulk-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .hero-actions a {
      text-decoration: none;
    }

    .hero-metrics {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .metric-card {
      min-width: 0;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .metric-card span {
      display: block;
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tab-nav {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0;
    }

    .tab-nav button {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-weight: 600;
      color: var(--muted);
    }

    .tab-nav button:hover {
      color: var(--text);
    }

    .tab-nav button.active {
      color: var(--text);
      border-bottom-color: var(--input-focus-border);
    }

    @media (max-width: 900px) {
      .hero-metrics,
      .question-settings,
      .source-filters {
        grid-template-columns: 1fr;
      }

      .tab-nav {
        overflow-x: auto;
      }
    }
  `]
})
export class QuizDetailsComponent implements OnInit {
  quiz: any;
  activeTab = 'questions';
  error = '';
  private id = 0;
  
  isEditingTitle = false;
  editTitle = '';
  isEditingDesc = false;
  editDesc = '';
  isEditingDuration = false;
  editDuration = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    public auth: AuthService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  async deleteQuiz(): Promise<void> {
    const ok = await this.confirmDialog.open({ title: 'Delete this test?', message: 'This test will be permanently removed.', confirmText: 'Delete', cancelText: 'Cancel', tone: 'danger' });
    if (!ok) return;
    
    this.quizService.delete(this.id).subscribe({
      next: () => {
        this.toast.show('Test deleted', 'success');
        this.router.navigate(['/quizzes']);
      },
      error: () => this.toast.show('Failed to delete test', 'error')
    });
  }

  load(): void {
    this.error = '';
    this.quizService.getById(this.id).subscribe({
      next: (res) => {
        this.quiz = res;
        this.quiz.questions = (this.quiz.questions || []).map((item: any, index: number) => ({
          ...item,
          order: Number(item?.order ?? index + 1),
          answerSeconds: Number(item?.answerSeconds ?? item?.question?.answerSeconds ?? 30),
          pointsOverride: item?.pointsOverride ?? null
        }));
      },
      error: (err) => this.error = err?.error?.message || 'Failed to load test'
    });
  }

  marksLabel(): string {
    const total = Number(this.quiz?.totalMarks ?? 0);
    const effective = Number(this.quiz?.effectiveTotalMarks ?? 0);
    return total > 0 ? `${total}` : `${effective || 0}`;
  }

  startEditTitle(): void {
    this.editTitle = this.quiz?.title || '';
    this.isEditingTitle = true;
  }

  saveTitle(): void {
    if (this.editTitle.trim()) {
      this.quizService.update(this.id, { title: this.editTitle.trim() }).subscribe({
        next: () => {
          this.quiz.title = this.editTitle;
          this.toast.show('Title updated', 'success');
        },
        error: () => this.toast.show('Failed to update title', 'error')
      });
    }
    this.isEditingTitle = false;
  }

  startEditDesc(): void {
    this.editDesc = this.quiz?.description || '';
    this.isEditingDesc = true;
  }

  saveDesc(): void {
    this.quizService.update(this.id, { description: this.editDesc.trim() }).subscribe({
      next: () => {
        this.quiz.description = this.editDesc;
        this.toast.show('Description updated', 'success');
      },
      error: () => this.toast.show('Failed to update description', 'error')
    });
    this.isEditingDesc = false;
  }

  startEditDuration(): void {
    this.editDuration = this.quiz?.durationMinutes || 0;
    this.isEditingDuration = true;
  }

  saveDuration(): void {
    this.quizService.update(this.id, { durationMinutes: this.editDuration }).subscribe({
      next: () => {
        this.quiz.durationMinutes = this.editDuration;
        this.toast.show('Duration updated', 'success');
      },
      error: () => this.toast.show('Failed to update duration', 'error')
    });
    this.isEditingDuration = false;
  }

  isExamLive(quiz: any): boolean {
    return Number(quiz?.examMode ?? quiz?.ExamMode ?? 0) === 1;
  }

  togglePublish(): void {
    if (this.quiz && this.isExamLive(this.quiz)) {
      this.toast.show('Live delivery tests use sessions, not publish.', 'error');
      return;
    }
    this.quizService.togglePublish(this.id).subscribe({
      next: () => {
        this.quiz.isPublished = !this.quiz.isPublished;
        this.toast.show(this.quiz.isPublished ? 'Test published' : 'Test unpublished', 'success');
      },
      error: (err) => this.toast.show(err?.error?.message || 'Failed to update status', 'error')
    });
  }
}
