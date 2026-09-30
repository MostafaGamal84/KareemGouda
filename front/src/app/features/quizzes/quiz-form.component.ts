import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { ToastService } from '../../core/services/toast.service';
import { QuizQuestionsComponent } from './quiz-questions.component';
import { QuizAccessComponent } from './quiz-access.component';
import { of, switchMap } from 'rxjs';
import { MultiSelectComponent, MultiSelectOption } from '../../shared/multi-select.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, QuizQuestionsComponent, QuizAccessComponent, MultiSelectComponent],
  template: `
    <div class="card test-form-card">
      <div class="form-head">
        <div>
          <p class="eyebrow">Test Builder</p>
          <h2>{{ id ? 'Edit Test' : 'Create Test' }}</h2>
        </div>
        <button type="button" class="secondary" (click)="cancel()">Back</button>
      </div>

      <div class="stepper">
        <div class="stepper-progress">
          <div class="stepper-bar" [style.width.%]="(currentStep / 4) * 100"></div>
        </div>
        <div class="stepper-steps">
          <button type="button" class="stepper-step" [class.active]="currentStep >= 1" [class.current]="currentStep === 1" (click)="goToStep(1)">
            <span class="step-number">1</span>
            <span class="step-label">Basic Info</span>
          </button>
          <button type="button" class="stepper-step" [class.active]="currentStep >= 2" [class.current]="currentStep === 2" (click)="goToStep(2)">
            <span class="step-number">2</span>
            <span class="step-label">Settings</span>
          </button>
          <button type="button" class="stepper-step" [class.active]="currentStep >= 3" [class.current]="currentStep === 3" (click)="goToStep(3)">
            <span class="step-number">3</span>
            <span class="step-label">Access</span>
          </button>
          <button type="button" class="stepper-step" [class.active]="currentStep >= 4" [class.current]="currentStep === 4" (click)="goToStep(4)">
            <span class="step-number">4</span>
            <span class="step-label">Questions</span>
          </button>
        </div>
      </div>

      @if (currentStep === 1) {
        <div class="step-content">
          <h3>Basic Information</h3>
          <div class="form-grid">
            <div class="field span-2">
              <label for="test-title">Title *</label>
              <input id="test-title" name="testTitle" [(ngModel)]="model.title" placeholder="Unit 1 Midterm" />
            </div>

            <div class="field span-2">
              <label for="test-description">Description</label>
              <textarea id="test-description" name="testDescription" rows="3" [(ngModel)]="model.description" placeholder="What this test covers"></textarea>
            </div>

            <div class="field span-2">
              <label>Categories *</label>
              <app-multi-select
                [options]="categoryOptions"
                [initialValues]="model.categories"
                placeholder="Select categories"
                searchPlaceholder="Search categories..."
                [allowCustom]="true"
                (selectionChange)="onCategorySelectionChange($event)" />
            </div>
          </div>

        </div>
      }

      @if (currentStep === 2) {
        <div class="step-content">
          <h3>Test Settings</h3>
          <div class="form-grid">
            <div class="field">
              <label for="explanation-timing">Answer explanation</label>
              <select id="explanation-timing" name="explanationTiming" [(ngModel)]="model.showExplanationAfterEachAnswer">
                <option [ngValue]="false">After the exam</option>
                <option [ngValue]="true">After each answer</option>
              </select>
            </div>
            <div class="field">
              <label for="test-duration">Duration (minutes)</label>
              <input id="test-duration" name="testDurationMinutes" type="number" min="0" [(ngModel)]="model.durationMinutes" placeholder="60" />
              <small class="inline-note">0 or empty = no limit</small>
            </div>

            <div class="field">
              <label for="test-total-marks">Total marks</label>
              <input id="test-total-marks" name="testTotalMarks" type="number" min="0" [(ngModel)]="model.totalMarks" placeholder="Auto" />
            </div>

            @if (model.examMode !== 1) {
              <div class="field">
                <label for="test-status">Status</label>
                <select id="test-status" name="testStatus" [(ngModel)]="model.isPublished">
                  <option [ngValue]="false">Draft</option>
                  <option [ngValue]="true">Published</option>
                </select>
              </div>
            } @else {
              <div class="field">
                <label>Status</label>
                <p class="inline-note">Live delivery: visibility is controlled by sessions, not publish.</p>
              </div>
            }

            <div class="field">
              <label for="test-cover-image">Cover Image</label>
              <input id="test-cover-image" name="testCoverImage" type="file" accept="image/*" (change)="onCoverFileSelected($event)" />
            </div>
          </div>

          @if (coverPreviewUrl) {
            <div class="cover-preview">
              <img [src]="coverPreviewUrl" alt="Cover preview" class="preview-image" />
              <button type="button" class="secondary" (click)="removeCoverImage()">Remove</button>
            </div>
          }

          <div class="step-2-actions" style="margin-top: 20px; display: flex; gap: 12px; align-items: center;">
            <button 
              type="button" 
              (click)="saveAndGoToStep(3)" 
              [disabled]="saving || isStepIncomplete(2)">
              {{ saving ? 'Saving...' : 'Next: Access Settings' }}
            </button>
          </div>
        </div>
      }

      @if (currentStep === 3) {
        <div class="step-content">
          <h3>Access Settings</h3>
          @if (id) {
            <app-quiz-access [quizId]="id" (accessChanged)="onAccessChanged()" (goToQuestions)="saveAndGoToStep(4)"></app-quiz-access>
          }
        </div>
      }

      @if (currentStep === 4) {
        <div class="step-content step-content-questions">
          <h3>Questions</h3>
          <app-quiz-questions
            [quizId]="id || 0"
            [quizTitle]="model.title"
            [questions]="questions"
            (questionsChanged)="loadQuestions(true)">
          </app-quiz-questions>
        </div>
      }

      <div class="action-row">
        @if (currentStep > 1) {
          <button type="button" class="secondary" (click)="prevStep()">Previous</button>
        }
        
        @if (currentStep === 1) {
          <button 
            type="button" 
            (click)="nextStep()" 
            [disabled]="isStepIncomplete(currentStep)">
            Next
          </button>
        }
        
        @if (currentStep === 3) {
          <button type="button" (click)="saveAndGoToStep(4)" [disabled]="saving">{{ saving ? 'Saving...' : 'Next: Questions' }}</button>
        }

        @if (currentStep === 4) {
          <button type="button" class="secondary" (click)="saveAll()" [disabled]="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
        }
        
        <button type="button" class="secondary" (click)="cancel()">Cancel</button>
      </div>

      @if (stepError) {
        <div class="step-error-message">{{ stepError }}</div>
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .test-form-card {
      display: grid;
      gap: 16px;
    }

    .stepper {
      margin: 16px 0;
    }

    .stepper-progress {
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      margin-bottom: 12px;
    }

    .stepper-bar {
      height: 100%;
      background: var(--primary);
      border-radius: 2px;
    }

    .stepper-steps {
      display: flex;
      justify-content: space-between;
    }

    .stepper-step {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .stepper-step.active {
      color: var(--text);
    }

    .stepper-step.current {
      background: var(--surface-elevated);
    }

    .step-number {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--surface);
      border: 2px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.75rem;
      flex-shrink: 0;
    }

    .stepper-step.active .step-number {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-contrast);
    }

    .step-label {
      font-weight: 500;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .step-content {
      padding: 16px 0;
    }

    .step-content-questions {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 16px;
      min-height: 0;
      height: calc(100vh - 260px);
    }

    .step-content-questions h3 {
      margin-bottom: 0;
    }

    .step-content-questions app-quiz-questions {
      display: block;
      height: 100%;
      min-height: 0;
    }

    .step-content h3 {
      margin: 0 0 16px;
      color: var(--text);
    }

    .form-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .form-head h2 {
      margin: 0;
    }

    .intro-copy {
      margin: 6px 0 0;
      max-width: 58ch;
    }

    .form-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .span-2 {
      grid-column: span 2;
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .category-entry {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .step-error {
      color: var(--danger);
      font-size: 0.85rem;
      font-weight: 500;
    }

    .step-error-message {
      color: var(--danger);
      background: var(--danger-tint);
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      border: 1px solid var(--danger-border);
    }

    .info-text {
      color: var(--text-soft);
      font-size: 0.9rem;
      padding: 12px;
      background: var(--surface-soft);
      border-radius: 8px;
    }

    .category-chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text);
      box-shadow: none;
    }

    .chip span {
      color: var(--muted);
      font-size: 0.78rem;
    }

    .chip-selected {
      border-color: var(--input-focus-border);
      background: var(--ring);
    }

    .suggestion-block,
    .cover-preview {
      display: grid;
      gap: 8px;
    }

    .suggestion-label {
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .preview-image {
      width: min(220px, 100%);
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      object-fit: cover;
    }

    .action-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    @media (max-width: 600px) {
      .step-content-questions {
        height: auto;
      }

      .stepper-steps {
        justify-content: space-between;
        overflow-x: auto;
      }

      .step-label {
        display: none;
      }

      .stepper-step {
        padding: 6px;
      }

      .step-number {
        width: 28px;
        height: 28px;
        font-size: 0.85rem;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .span-2 {
        grid-column: auto;
      }

      .category-entry {
        grid-template-columns: 1fr;
      }

      .tab-nav {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0;
        margin-top: 16px;
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
        border-bottom-color: var(--primary);
      }
    }
  `]
})
export class QuizFormComponent implements OnInit {
  @ViewChild(QuizAccessComponent) quizAccess?: QuizAccessComponent;

  id?: number;
  loading = false;
  saving = false;
  error = '';
  categoryInput = '';
  coverPreviewUrl = '';
  existingCategories: string[] = [];
  categoryOptions: MultiSelectOption[] = [];
  activeTab = 'questions';
  questions: any[] = [];
  currentStep = 1;
  stepError = '';
  showCategorySuggestions = false;
  accessSaved = false;
  private selectedCoverFile: File | null = null;

  model: any = {
    title: '',
    description: '',
    durationMinutes: 60,
    showExplanationAfterEachAnswer: false,
    totalMarks: null,
    isPublished: false,
    examMode: null as number | null,
    mode: 1,
    categories: [] as string[]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: QuizService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadCategorySuggestions();

    const rawId = this.route.snapshot.paramMap.get('id');
    this.id = rawId ? Number(rawId) : undefined;
    if (!this.id) {
      return;
    }

    this.service.getById(this.id).subscribe((res: any) => {
      this.model = {
        title: res.title,
        description: res.description,
        durationMinutes: res.durationMinutes,
        showExplanationAfterEachAnswer: res.showExplanationAfterEachAnswer ?? false,
        totalMarks: res.totalMarks ?? null,
        isPublished: !!res.isPublished,
        examMode: res.examMode !== undefined && res.examMode !== null ? Number(res.examMode) : null,
        mode: 1,
        categories: (res.categories || []).map((item: any) => String(item?.name ?? '')).filter(Boolean)
      };
      this.coverPreviewUrl = res.coverImageUrl || '';
      this.questions = res.questions || [];
    });
  }

  loadQuestions(skipLoading: boolean = false): void {
    if (!this.id) return;
    this.service.getById(this.id, { skipLoading }).subscribe((res: any) => {
      this.questions = res.questions || [];
    });
  }

  save(): void {
    this.error = '';

    if (!this.model.title?.trim()) {
      this.error = 'Test title is required.';
      return;
    }

    if (!this.model.categories.length) {
      this.error = 'At least one category is required.';
      return;
    }

    this.loading = true;
    const payload = {
      ...this.model,
      title: String(this.model.title || '').trim(),
      description: String(this.model.description || '').trim(),
      totalMarks: this.normalizeOptionalNumber(this.model.totalMarks),
      durationMinutes: this.normalizeNumber(this.model.durationMinutes, 0),
      showExplanationAfterEachAnswer: this.model.showExplanationAfterEachAnswer,
      categories: this.model.categories
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request$.pipe(
      switchMap((quiz: any) => {
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        if (!this.selectedCoverFile || !quizId) {
          return of(quiz);
        }

        return this.service.uploadCoverImage(quizId, this.selectedCoverFile).pipe(
          switchMap(() => of(quiz))
        );
      })
    ).subscribe({
      next: (quiz: any) => {
        this.loading = false;
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        this.router.navigate(quizId ? ['/quizzes', quizId] : ['/quizzes']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Save failed';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/quizzes']);
  }

  addCategoryFromInput(event?: Event): void {
    event?.preventDefault();
    const value = String(this.categoryInput || '').trim();
    if (!value) {
      return;
    }

    if (!this.model.categories.some((item: string) => item.toLowerCase() === value.toLowerCase())) {
      this.model.categories = [...this.model.categories, value];
    }

    this.categoryInput = '';
  }

  handleCategorySeparators(event: KeyboardEvent): void {
    if (event.key !== ',') {
      return;
    }

    event.preventDefault();
    this.addCategoryFromInput();
  }

  removeCategory(category: string): void {
    this.model.categories = this.model.categories.filter((item: string) => item !== category);
  }

  applySuggestedCategory(category: string): void {
    if (this.model.categories.some((item: string) => item.toLowerCase() === category.toLowerCase())) {
      return;
    }

    this.model.categories = [...this.model.categories, category];
  }

  onCategorySelectionChange(categories: any[]): void {
    this.model.categories = categories.map(value => String(value)).filter(Boolean);
  }

  get suggestedCategoryList(): string[] {
    return this.existingCategories.filter((category) =>
      !this.model.categories.some((item: string) => item.toLowerCase() === category.toLowerCase())
    );
  }

  onCoverFileSelected(event: Event): void {
    this.error = '';
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!file) {
      this.selectedCoverFile = null;
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedCoverFile = null;
      this.error = 'Only JPG, PNG, or WEBP images are allowed.';
      input.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.selectedCoverFile = null;
      this.error = 'Image size must be 5 MB or less.';
      input.value = '';
      return;
    }

    this.selectedCoverFile = file;
    this.coverPreviewUrl = URL.createObjectURL(file);
  }

  private loadCategorySuggestions(): void {
    this.service.getCategories().subscribe({
      next: (items) => {
        this.existingCategories = items.map((item) => item.name).filter(Boolean);
        this.categoryOptions = this.existingCategories.map(category => ({ value: category, label: category }));
      },
      error: () => {}
    });
  }

  private normalizeNumber(value: any, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(fallback, Math.floor(parsed));
  }

  private normalizeOptionalNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }

  canProceed(): boolean {
    this.stepError = '';
    
    if (this.currentStep === 1) {
      if (!this.model.title?.trim()) {
        this.stepError = 'Title is required';
        return false;
      }
      if (this.model.categories.length === 0) {
        this.stepError = 'At least one category is required';
        return false;
      }
      return true;
    }
    
    if (this.currentStep === 2) {
      const duration = Number(this.model.durationMinutes);
      const totalMarks = Number(this.model.totalMarks);
      
      if (this.model.durationMinutes && (duration < 0 || duration > 480)) {
        this.stepError = 'Duration must be between 0 and 480 minutes';
        return false;
      }
      if (this.model.totalMarks && (totalMarks < 0 || !Number.isFinite(totalMarks))) {
        this.stepError = 'Total marks must be a positive number';
        return false;
      }
      return true;
    }
    
    return true;
  }

  isStepIncomplete(step: number): boolean {
    if (step === 1) {
      return !this.model.title?.trim() || this.model.categories.length === 0;
    }
    if (step === 2) {
      if (this.model.durationMinutes !== null && this.model.durationMinutes !== '') {
        const duration = Number(this.model.durationMinutes);
        if (duration < 0 || duration > 480 || isNaN(duration)) return true;
      }
      if (this.model.totalMarks !== null && this.model.totalMarks !== '') {
        const marks = Number(this.model.totalMarks);
        if (marks < 0 || isNaN(marks)) return true;
      }
    }
    return false;
  }

  onAccessChanged(): void {
    this.accessSaved = true;
  }

  nextStep(): void {
    if (this.canProceed() && this.currentStep < 4) {
      this.currentStep++;
    }
  }

  saveAndNext(): void {
    if (this.isStepIncomplete(2)) return;
    
    this.saving = true;
    this.error = '';
    
    const payload = {
      ...this.model,
      title: String(this.model.title || '').trim(),
      description: String(this.model.description || '').trim(),
      totalMarks: this.normalizeOptionalNumber(this.model.totalMarks),
      durationMinutes: this.normalizeNumber(this.model.durationMinutes, 0),
      showExplanationAfterEachAnswer: this.model.showExplanationAfterEachAnswer,
      categories: this.model.categories
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request$.pipe(
      switchMap((quiz: any) => {
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        if (!this.selectedCoverFile || !quizId) {
          return of(quiz);
        }
        return this.service.uploadCoverImage(quizId, this.selectedCoverFile).pipe(
          switchMap(() => of(quiz))
        );
      })
    ).subscribe({
      next: (quiz: any) => {
        this.saving = false;
        this.id = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        this.accessSaved = true;
        this.loadQuestions();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save test settings';
      }
    });
  }

  saveAndContinue(): void {
    this.saveAndNext();
  }

  saveAndFinish(): void {
    if (this.isStepIncomplete(2)) return;
    
    this.saving = true;
    this.error = '';
    
    const payload = {
      ...this.model,
      title: String(this.model.title || '').trim(),
      description: String(this.model.description || '').trim(),
      totalMarks: this.normalizeOptionalNumber(this.model.totalMarks),
      durationMinutes: this.normalizeNumber(this.model.durationMinutes, 0),
      showExplanationAfterEachAnswer: this.model.showExplanationAfterEachAnswer,
      categories: this.model.categories
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request$.pipe(
      switchMap((quiz: any) => {
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        if (!this.selectedCoverFile || !quizId) {
          return of(quiz);
        }
        return this.service.uploadCoverImage(quizId, this.selectedCoverFile).pipe(
          switchMap(() => of(quiz))
        );
      })
    ).subscribe({
      next: (quiz: any) => {
        this.saving = false;
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        this.toast.show('Test saved successfully', 'success');
        this.router.navigate(quizId ? ['/quizzes', quizId] : ['/quizzes']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save test';
      }
    });
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  goToStep(step: number): void {
    if (!(step <= this.currentStep || this.id)) {
      return;
    }
    if (this.currentStep === 3 && step === 4 && this.id && this.quizAccess) {
      this.saving = true;
      this.quizAccess.persistAccessSettings().subscribe({
        next: () => {
          this.saving = false;
          this.currentStep = step;
        },
        error: (err: unknown) => {
          this.saving = false;
          const httpErr = err as { error?: { message?: string } };
          this.toast.show(httpErr?.error?.message || 'Failed to save access settings', 'error');
        }
      });
      return;
    }
    this.currentStep = step;
  }

  saveAndGoToStep(step: number): void {
    if (this.isStepIncomplete(2)) return;

    const persistAccessFirst =
      this.currentStep === 3 && step === 4 && !!this.id && !!this.quizAccess;

    this.saving = true;
    this.error = '';

    const payload = {
      ...this.model,
      title: String(this.model.title || '').trim(),
      description: String(this.model.description || '').trim(),
      totalMarks: this.normalizeOptionalNumber(this.model.totalMarks),
      durationMinutes: this.normalizeNumber(this.model.durationMinutes, 0),
      showExplanationAfterEachAnswer: this.model.showExplanationAfterEachAnswer,
      categories: this.model.categories
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);

    const runQuizSave = (): void => {
      request$
        .pipe(
          switchMap((quiz: any) => {
            const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
            if (!this.selectedCoverFile || !quizId) {
              return of(quiz);
            }
            return this.service.uploadCoverImage(quizId, this.selectedCoverFile).pipe(switchMap(() => of(quiz)));
          })
        )
        .subscribe({
          next: (quiz: any) => {
            this.saving = false;
            const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
            this.id = quizId;
            this.currentStep = step;
            this.loadQuestions();
          },
          error: (err: unknown) => {
            this.saving = false;
            const httpErr = err as { error?: { message?: string } };
            this.error = httpErr?.error?.message || 'Failed to save test settings';
          }
        });
    };

    if (persistAccessFirst && this.quizAccess) {
      this.quizAccess.persistAccessSettings().subscribe({
        next: () => runQuizSave(),
        error: (err: unknown) => {
          this.saving = false;
          const httpErr = err as { error?: { message?: string } };
          this.error = httpErr?.error?.message || 'Failed to save access settings';
        }
      });
      return;
    }

    runQuizSave();
  }

  removeCoverImage(): void {
    this.coverPreviewUrl = '';
    this.selectedCoverFile = null;
  }

  saveAll(): void {
    this.error = '';

    if (!this.model.title?.trim()) {
      this.error = 'Test title is required.';
      return;
    }

    if (!this.model.categories.length) {
      this.error = 'At least one category is required.';
      return;
    }

    this.saving = true;
    const payload = {
      ...this.model,
      title: String(this.model.title || '').trim(),
      description: String(this.model.description || '').trim(),
      totalMarks: this.normalizeOptionalNumber(this.model.totalMarks),
      durationMinutes: this.normalizeNumber(this.model.durationMinutes, 0),
      showExplanationAfterEachAnswer: this.model.showExplanationAfterEachAnswer,
      categories: this.model.categories
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request$.pipe(
      switchMap((quiz: any) => {
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        if (!this.selectedCoverFile || !quizId) {
          return of(quiz);
        }
        return this.service.uploadCoverImage(quizId, this.selectedCoverFile).pipe(
          switchMap(() => of(quiz))
        );
      })
    ).subscribe({
      next: (quiz: any) => {
        this.saving = false;
        const quizId = Number(quiz?.id ?? quiz?.Id ?? this.id ?? 0);
        this.toast?.show?.('Test saved successfully', 'success');
        this.router.navigate(quizId ? ['/quizzes', quizId] : ['/quizzes']);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save test';
      }
    });
  }
}
