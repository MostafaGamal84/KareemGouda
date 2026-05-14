import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EditorModule } from 'primeng/editor';
import { QuestionService } from '../../core/services/question.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionCategoryService, QuestionCategory } from '../../core/services/question-category.service';
import { ToastService } from '../../core/services/toast.service';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';
import { forkJoin, of, switchMap } from 'rxjs';

type QuestionMode = 'single' | 'multiple' | 'truefalse' | 'short';
type EditableChoice = {
  id?: number;
  clientKey: string;
  choiceText: string;
  imageUrl?: string;
  hasImage?: boolean;
  isCorrect: boolean;
  order: number;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, EditorModule, SafeRichTextPipe],
  template: `
    <div class="card question-form-card">
      <div class="form-head">
        <div>
          <p class="eyebrow">Question Bank</p>
          <h2>{{ id ? 'Edit Question' : 'Create Question' }}</h2>
        </div>
        <button type="button" class="secondary" (click)="goBack()">Back</button>
      </div>

      <div class="form-grid">
        <div class="field span-2">
          <label for="question-title">Title</label>
          <input id="question-title" name="questionTitle" [(ngModel)]="model.title" placeholder="Photosynthesis definition" />
        </div>

        <div class="field">
          <label for="question-mode">Answer format</label>
          <select id="question-mode" name="questionMode" [(ngModel)]="questionMode" (change)="applyQuestionMode()">
            <option value="single">Single Choice</option>
            <option value="multiple">Multiple Choice</option>
            <option value="truefalse">True / False</option>
            <option value="short">Short Answer</option>
          </select>
        </div>

        <div class="field">
          <label for="question-points">Points</label>
          <input id="question-points" name="questionPoints" type="number" [(ngModel)]="model.points" min="1" />
        </div>

        <div class="field">
          <label for="question-answer-seconds">Answer time (sec)</label>
          <input id="question-answer-seconds" name="questionAnswerSeconds" type="number" [(ngModel)]="model.answerSeconds" min="5" max="300" />
        </div>

        <div class="field">
          <label for="question-difficulty">Difficulty (optional)</label>
          <input id="question-difficulty" name="questionDifficulty" [(ngModel)]="model.difficulty" placeholder="Easy / Medium / Hard" />
        </div>

        <div class="field">
          <label for="question-category-input">Categories (optional)</label>
          <div class="category-selector">
            <input
              id="question-category-input"
              name="questionCategoryInput"
              [(ngModel)]="categoryInput"
              placeholder="Type category then press Enter or comma"
              list="category-suggestions"
              (keydown.enter)="addCategoryFromInput($event)"
              (keydown)="handleCategorySeparators($event)"
              (blur)="addCategoryOnBlur()" />
            <datalist id="category-suggestions">
              @for (cat of categories; track cat.id) {
                <option [value]="cat.name"></option>
              }
            </datalist>
            <button type="button" class="secondary btn-sm" (click)="addCategoryFromInput()">Add</button>
          </div>
          @if (selectedCategories.length) {
            <div class="suggestion-chips">
              @for (cat of selectedCategories; track cat.id) {
                <button type="button" class="chip chip-selected" (click)="removeCategory(cat.id)">
                  {{ cat.name }} <span>x</span>
                </button>
              }
            </div>
          }
          @if (suggestedCategoryList.length) {
            <div class="category-suggestions">
              <span class="suggestion-label">Or choose existing:</span>
              <div class="suggestion-chips">
                @for (cat of suggestedCategoryList; track cat.id) {
                  <button type="button" class="chip" (click)="selectCategory(cat)">
                    {{ cat.name }}
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <div class="field span-2">
          <label for="question-image">Image (optional)</label>
          <input id="question-image" name="questionImage" type="file" accept="image/png,image/jpeg,image/webp" (change)="onImageSelected($event)" />
          <small class="inline-note">Upload an image to display below the question text.</small>
        </div>

        <div class="field span-2 editor-field">
          <label for="question-text-editor">Question text</label>
          <p-editor
            [(ngModel)]="model.text"
            name="questionText"
            styleClass="question-editor"
            [style]="{ height: '320px' }"
            [formats]="editorFormats"
            placeholder="Write the question exactly as students should see it"
            (onInit)="onEditorInit($event)">
            <ng-template pTemplate="header">
              <span class="ql-formats">
                <select class="ql-header" aria-label="Text style">
                  <option value="1">Heading</option>
                  <option value="2">Subheading</option>
                  <option selected></option>
                </select>
                <select class="ql-font" aria-label="Font family">
                  <option selected></option>
                  <option value="serif"></option>
                  <option value="monospace"></option>
                </select>
              </span>
              <span class="ql-formats">
                <button type="button" class="ql-bold" aria-label="Bold"></button>
                <button type="button" class="ql-italic" aria-label="Italic"></button>
                <button type="button" class="ql-underline" aria-label="Underline"></button>
              </span>
              <span class="ql-formats">
                <select class="ql-color" aria-label="Text color"></select>
                <select class="ql-background" aria-label="Highlight color"></select>
              </span>
              <span class="ql-formats">
                <button type="button" class="ql-list" value="ordered" aria-label="Ordered list"></button>
                <button type="button" class="ql-list" value="bullet" aria-label="Bullet list"></button>
                <button type="button" class="ql-link" aria-label="Insert link"></button>
                <button type="button" class="ql-clean" aria-label="Clear formatting"></button>
              </span>
            </ng-template>
          </p-editor>
        </div>

        <div class="field span-2">
          <label for="question-explanation">Explanation (optional)</label>
          <textarea id="question-explanation" name="questionExplanation" rows="4" [(ngModel)]="model.explanation" placeholder="Explain why this answer is correct"></textarea>
        </div>
      </div>

      @if (imagePreviewUrl) {
        <div class="preview-block">
          <span class="preview-label">Image preview</span>
          <img class="question-image" [src]="imagePreviewUrl" alt="Question preview" />
        </div>
      }

      @if (hasMeaningfulRichText(model.text)) {
        <div class="question-preview">
          <span class="preview-label">Student preview</span>
          <div class="rich-text-content" [innerHTML]="model.text | safeRichText"></div>
        </div>
      }

      @if (questionMode !== 'short') {
        <div class="choice-section">
          <div class="section-head">
            <div>
              <h3>Choices</h3>
              <p class="section-copy">{{ choiceGuidance() }}</p>
            </div>
            @if (questionMode === 'single' || questionMode === 'multiple') {
              <button type="button" class="secondary" (click)="addChoice()">Add choice</button>
            }
          </div>

          @for (choice of model.choices; track choice.id || choice.clientKey) {
            <div class="choice-row">
              <span class="choice-code">{{ choiceLabel($index) }}</span>
              <div class="choice-editor">
                <input
                  [name]="'questionChoice' + $index"
                  [(ngModel)]="choice.choiceText"
                  [placeholder]="'Choice ' + choiceLabel($index) + ' text (optional if image uploaded)'" />
                <div class="choice-upload-row">
                  <input
                    [id]="'questionChoiceImage' + $index"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    (change)="onChoiceImageSelected($index, $event)" />
                  <small class="inline-note">You can use text, image, or both for this answer.</small>
                </div>

                @if (choice.imageUrl) {
                  <img class="choice-preview-image" [src]="choice.imageUrl" [alt]="'Choice ' + choiceLabel($index) + ' preview'" />
                }
              </div>

              @if (usesSingleCorrect()) {
                <button 
                  type="button" 
                  class="correct-mark" 
                  [class.correct]="choice.isCorrect"
                  (click)="setSingleCorrectChoice($index)">
                  {{ choice.isCorrect ? '✓ Correct' : 'Mark as Correct' }}
                </button>
              } @else {
                <button 
                  type="button" 
                  class="correct-mark" 
                  [class.correct]="choice.isCorrect"
                  (click)="choice.isCorrect = !choice.isCorrect">
                  {{ choice.isCorrect ? '✓ Correct' : 'Mark as Correct' }}
                </button>
              }

              @if (questionMode === 'single' || questionMode === 'multiple') {
                <button type="button" class="danger" (click)="removeChoice($index)">Remove</button>
              }
            </div>
          }
        </div>
      }

      @if (questionMode === 'short') {
        <div class="field">
          <label for="question-short-answer-key">Expected answer</label>
          <input id="question-short-answer-key" name="questionShortAnswerKey" [(ngModel)]="shortAnswerKey" placeholder="Expected answer" />
        </div>
      }

      <div class="action-row">
        <button type="button" [disabled]="loading" (click)="save()">{{ loading ? 'Saving...' : 'Save Question' }}</button>
        <button type="button" class="secondary" [disabled]="loading" (click)="goBack()">Cancel</button>
      </div>

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>
  `,
  styles: [`
    .question-form-card {
      display: grid;
      gap: 16px;
    }

    .form-head,
    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .form-head h2,
    .section-head h3 {
      margin: 0;
    }

    .form-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .span-2 {
      grid-column: span 2;
    }

    .field,
    .preview-block,
    .question-preview,
    .choice-section {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .editor-field {
      gap: 10px;
    }

    .preview-label {
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .question-image {
      width: min(320px, 100%);
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .question-preview {
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .section-copy {
      margin: 6px 0 0;
      max-width: 56ch;
    }

    .choice-row {
      display: grid;
      gap: 10px;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: start;
    }

    .choice-code {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      font-weight: 700;
    }

    .choice-editor,
    .choice-upload-row {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .choice-preview-image {
      width: min(220px, 100%);
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .correct-mark {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      font-size: 0.85rem;
      transition: all 0.15s ease;
    }

    .correct-mark:hover {
      background: var(--surface-soft);
      color: var(--text);
    }

    .correct-mark input[type="radio"],
    .correct-mark input[type="checkbox"] {
      display: none;
    }

    .correct-mark.correct {
      background: var(--primary-tint);
      border-color: var(--primary);
      color: var(--primary);
    }

    @media (max-width: 820px) {
      .correct-mark {
        padding: 5px 8px;
        font-size: 0.8rem;
      }
    }

    @media (max-width: 520px) {
      .correct-mark {
        padding: 4px 6px;
        font-size: 0.75rem;
      }
    }

    .action-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .choice-row input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--primary);
    }

    @media (max-width: 820px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .span-2 {
        grid-column: auto;
      }

      .choice-row {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      .choice-code {
        width: 100%;
        border-radius: 14px;
      }

      .correct-mark {
        padding: 5px 8px;
        font-size: 0.8rem;
      }
    }

    @media (max-width: 520px) {
      .correct-mark {
        padding: 4px 6px;
        font-size: 0.75rem;
      }
    }

    .category-selector {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .category-selector input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      min-height: 44px;
      font-size: 0.95rem;
    }

    .category-suggestions {
      margin-top: 10px;
      display: grid;
      gap: 6px;
    }

    .suggestion-label {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .suggestion-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text);
      box-shadow: none;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .chip:hover {
      border-color: var(--primary-border);
      background: var(--primary-tint);
    }

    .chip-selected {
      border-color: var(--primary-border);
      background: var(--primary-tint);
      color: var(--primary);
      font-weight: 600;
    }

    .btn-sm {
      padding: 8px 14px;
      font-size: 0.85rem;
    }
  `]
})
export class QuestionFormComponent implements OnInit {
  id?: number;
  loading = false;
  error = '';
  shortAnswerKey = '';
  questionMode: QuestionMode = 'single';
  imagePreviewUrl = '';
  targetQuizId?: number;
  categories: QuestionCategory[] = [];
  selectedCategories: QuestionCategory[] = [];
  private nextChoiceKey = 1;
  private selectedImageFile: File | null = null;
  private selectedChoiceImageFiles = new Map<string, File>();
  readonly editorFormats = ['header', 'font', 'bold', 'italic', 'underline', 'color', 'background', 'list', 'link', 'clean'];

  model: any = {
    title: '',
    text: '',
    type: 1,
    selectionMode: 1,
    difficulty: '',
    explanation: '',
    points: 100,
    answerSeconds: 30,
    categoryIds: [] as number[],
    choices: this.createDefaultChoices()
  };

  categoryInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: QuestionService,
    private quizService: QuizService,
    private categoryService: QuestionCategoryService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    this.id = rawId ? Number(rawId) : undefined;
    this.targetQuizId = Number(this.route.snapshot.queryParamMap.get('quizId')) || undefined;
    
    this.loadCategories();

    if (!this.id) {
      this.applyQuestionMode();
      return;
    }

    this.service.getById(this.id).subscribe((res: any) => {
      this.model = {
        ...res,
        text: String(res?.text ?? ''),
        explanation: String(res?.explanation ?? ''),
        answerSeconds: Number(res?.answerSeconds ?? 30),
        categoryIds: this.resolveCategoryIdsFromQuestion(res),
        choices: this.hydrateChoices(res?.choices || [])
      };
      this.questionMode = this.resolveQuestionMode(res);
      this.imagePreviewUrl = res.imageUrl || '';
      this.selectedCategories = this.resolveSelectedCategories(res);
      if (this.questionMode === 'short') {
        this.shortAnswerKey = this.model.choices?.find((item: any) => item.isCorrect)?.choiceText || '';
      }
      this.applyQuestionMode(false);
    });
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.syncSelectedCategoriesWithCatalog();
      },
      error: () => {}
    });
  }

  addCategoryFromInput(event?: Event): void {
    event?.preventDefault();
    const value = String(this.categoryInput || '').trim();
    if (!value) return;

    const existing = this.categories.find(c => c.name.toLowerCase() === value.toLowerCase());
    if (existing) {
      this.addSelectedCategory(existing);
    } else {
      this.categoryService.create({ name: value }).subscribe({
        next: (newCat: QuestionCategory) => {
          this.categories = [...this.categories, newCat];
          this.addSelectedCategory(newCat);
        },
        error: () => {}
      });
    }

    this.categoryInput = '';
  }

  handleCategorySeparators(event: KeyboardEvent): void {
    if (event.key === ',') {
      event.preventDefault();
      this.addCategoryFromInput();
    }
  }

  removeCategory(categoryId?: number): void {
    this.selectedCategories = categoryId
      ? this.selectedCategories.filter((category) => category.id !== categoryId)
      : [];
    this.model.categoryIds = this.selectedCategories.map((category) => category.id);
    this.categoryInput = '';
  }

  selectCategory(cat: QuestionCategory): void {
    this.addSelectedCategory(cat);
    this.categoryInput = '';
  }

  get suggestedCategoryList(): QuestionCategory[] {
    return this.categories.filter((category) =>
      !this.selectedCategories.some((selectedCategory) => selectedCategory.id === category.id)
    );
  }

  addCategoryOnBlur(): void {
    const value = String(this.categoryInput || '').trim();
    if (!value) return;
    this.addCategoryFromInput();
  }

  private addSelectedCategory(category: QuestionCategory): void {
    if (this.selectedCategories.some((item) => item.id === category.id)) {
      return;
    }

    this.selectedCategories = [...this.selectedCategories, category];
    this.model.categoryIds = this.selectedCategories.map((item) => item.id);
  }

  private syncSelectedCategoriesWithCatalog(): void {
    if (!this.selectedCategories.length) {
      return;
    }

    this.selectedCategories = this.selectedCategories.map((selectedCategory) =>
      this.categories.find((category) => category.id === selectedCategory.id) ?? selectedCategory
    );
    this.model.categoryIds = this.selectedCategories.map((category) => category.id);
  }

  private resolveSelectedCategories(question: any): QuestionCategory[] {
    const categoryItems = Array.isArray(question?.categories) ? question.categories : [];
    const categories = categoryItems
      .map((category: any) => ({
        id: Number(category?.id ?? 0),
        name: String(category?.name ?? '').trim(),
        description: category?.description,
        color: Number(category?.color ?? 0),
        questionsCount: Number(category?.questionsCount ?? 0)
      }))
      .filter((category: QuestionCategory) => category.id > 0 && !!category.name);

    if (categories.length > 0) {
      return categories;
    }

    const categoryId = Number(question?.categoryId ?? 0);
    const categoryName = String(question?.categoryName ?? '').trim();
    return categoryId > 0 && categoryName
      ? [{ id: categoryId, name: categoryName, description: '', color: 0, questionsCount: 0 }]
      : [];
  }

  private resolveCategoryIdsFromQuestion(question: any): number[] {
    return this.resolveSelectedCategories(question).map((category) => category.id);
  }

  applyQuestionMode(resetChoices = true): void {
    if (this.questionMode === 'single') {
      this.model.type = 1;
      this.model.selectionMode = 1;
      if (resetChoices && this.model.choices.length < 2) {
        this.model.choices = this.createDefaultChoices();
        this.selectedChoiceImageFiles.clear();
      }
    }

    if (this.questionMode === 'multiple') {
      this.model.type = 1;
      this.model.selectionMode = 2;
      if (resetChoices && this.model.choices.length < 2) {
        this.model.choices = this.createDefaultChoices();
        this.selectedChoiceImageFiles.clear();
      }
    }

    if (this.questionMode === 'truefalse') {
      this.model.type = 2;
      this.model.selectionMode = 1;
      if (resetChoices || this.model.choices.length !== 2) {
        this.model.choices = [
          this.createChoice({ choiceText: 'True', isCorrect: true, order: 1 }),
          this.createChoice({ choiceText: 'False', isCorrect: false, order: 2 })
        ];
        this.selectedChoiceImageFiles.clear();
      }
    }

    if (this.questionMode === 'short') {
      this.model.type = 3;
      this.model.selectionMode = 1;
      this.model.choices = [];
      this.selectedChoiceImageFiles.clear();
    }

    this.reindexChoices();
  }

  addChoice(): void {
    this.model.choices.push(this.createChoice({ isCorrect: false, order: this.model.choices.length + 1 }));
  }

  removeChoice(index: number): void {
    if (this.model.choices.length <= 2) {
      return;
    }

    const removedChoice = this.model.choices[index];
    if (removedChoice?.clientKey) {
      this.selectedChoiceImageFiles.delete(removedChoice.clientKey);
    }

    this.model.choices.splice(index, 1);
    if (this.usesSingleCorrect() && !this.model.choices.some((item: any) => item.isCorrect)) {
      this.model.choices[0].isCorrect = true;
    }
    this.reindexChoices();
  }

  setSingleCorrectChoice(index: number): void {
    this.model.choices = this.model.choices.map((choice: any, currentIndex: number) => ({
      ...choice,
      isCorrect: currentIndex === index
    }));
  }

  save(): void {
    this.loading = true;
    this.error = '';
    this.model.answerSeconds = this.normalizeBetween(this.model.answerSeconds, 5, 300, 30);
    this.model.points = this.normalizeBetween(this.model.points, 1, 100000, 100);
    this.model.text = this.normalizeRichText(this.model.text);
    this.model.explanation = String(this.model.explanation || '').trim();

    if (!this.model.title?.trim()) {
      this.fail('Question title is required');
      return;
    }

    if (!this.hasMeaningfulRichText(this.model.text)) {
      this.fail('Question text is required');
      return;
    }

    if (this.questionMode === 'short') {
      const normalizedKey = (this.shortAnswerKey || '').trim();
      if (!normalizedKey) {
        this.fail('Short answer key is required');
        return;
      }

      this.model.choices = [this.createChoice({ choiceText: normalizedKey, isCorrect: true, order: 1 })];
    } else {
      this.reindexChoices();
      if (!this.model.choices.every((choice: EditableChoice) => this.choiceHasContent(choice))) {
        this.fail('Every choice must have text or an image');
        return;
      }

      if (this.usesSingleCorrect() && this.model.choices.filter((choice: any) => choice.isCorrect).length !== 1) {
        this.fail('Select exactly one correct answer');
        return;
      }

      if (!this.usesSingleCorrect() && this.model.choices.filter((choice: any) => choice.isCorrect).length === 0) {
        this.fail('Select at least one correct answer');
        return;
      }
    }

    const payload = {
      title: String(this.model.title || '').trim(),
      text: this.model.text,
      type: this.model.type,
      selectionMode: this.model.selectionMode,
      difficulty: String(this.model.difficulty || '').trim() || null,
      explanation: this.model.explanation || null,
      points: this.model.points,
      answerSeconds: this.model.answerSeconds,
      categoryId: this.selectedCategories[0]?.id ?? null,
      categoryIds: this.selectedCategories.map((category) => category.id),
      quizId: this.targetQuizId || null,
      choices: (this.model.choices || []).map((choice: EditableChoice) => ({
        id: Number(choice.id ?? 0),
        choiceText: String(choice.choiceText || '').trim(),
        hasImage: Boolean(choice.hasImage || choice.imageUrl),
        isCorrect: choice.isCorrect,
        order: choice.order
      }))
    };

    const request$ = this.id ? this.service.update(this.id, payload) : this.service.create(payload);
    request$.pipe(
      switchMap((question: any) => {
        const questionId = Number(question?.id ?? this.id ?? 0);
        if (!questionId) {
          return of(question);
        }

        const uploadRequests: any[] = [];
        if (this.selectedImageFile) {
          uploadRequests.push(this.service.uploadImage(questionId, this.selectedImageFile));
        }

        const savedChoices = Array.isArray(question?.choices) ? question.choices : [];
        for (const localChoice of this.model.choices as EditableChoice[]) {
          const file = this.selectedChoiceImageFiles.get(localChoice.clientKey);
          if (!file) {
            continue;
          }

          const savedChoice = savedChoices.find((item: any) => Number(item?.id ?? 0) === Number(localChoice.id ?? 0))
            ?? savedChoices.find((item: any) => Number(item?.order ?? 0) === Number(localChoice.order ?? 0));
          const choiceId = Number(savedChoice?.id ?? 0);
          if (choiceId > 0) {
            uploadRequests.push(this.service.uploadChoiceImage(questionId, choiceId, file));
          }
        }

        if (uploadRequests.length) {
          return forkJoin(uploadRequests).pipe(switchMap(() => of(question)));
        }
        return of(question);
      }),
      switchMap((question: any) => {
        const questionId = Number(question?.id ?? this.id ?? 0);
        if (!questionId || !this.targetQuizId || this.id) {
          return of(question);
        }
        return this.quizService.addQuestions(this.targetQuizId, [{
          questionId: questionId,
          order: 1,
          pointsOverride: null,
          answerSeconds: null
        }]).pipe(
          switchMap(() => of(question))
        );
      })
    ).subscribe({
      next: () => {
        this.loading = false;
        if (this.targetQuizId && !this.id) {
          this.router.navigate(['/quizzes', this.targetQuizId]);
        } else {
          this.router.navigate(['/questions']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Save failed';
      }
    });
  }

  goBack(): void {
    if (this.targetQuizId) {
      this.router.navigate(['/quizzes', this.targetQuizId]);
    } else {
      this.router.navigate(['/questions']);
    }
  }

  usesSingleCorrect(): boolean {
    return this.questionMode !== 'multiple';
  }

  choiceGuidance(): string {
    if (this.questionMode === 'multiple') {
      return 'Mark every correct answer. Students will need to select the complete correct set.';
    }

    if (this.questionMode === 'truefalse') {
      return 'Choose whether True or False is the correct answer.';
    }

    return 'Mark the single correct answer for this question.';
  }

  choiceLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  onImageSelected(event: Event): void {
    this.error = '';
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!file) {
      this.selectedImageFile = null;
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedImageFile = null;
      this.error = 'Only JPG, PNG, or WEBP images are allowed.';
      input.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.selectedImageFile = null;
      this.error = 'Image size must be 5 MB or less.';
      input.value = '';
      return;
    }

    this.selectedImageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  onChoiceImageSelected(index: number, event: Event): void {
    this.error = '';
    const choice = this.model.choices?.[index] as EditableChoice | undefined;
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!choice?.clientKey || !file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.selectedChoiceImageFiles.delete(choice.clientKey);
      this.error = 'Only JPG, PNG, or WEBP images are allowed for answers.';
      input.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.selectedChoiceImageFiles.delete(choice.clientKey);
      this.error = 'Answer image size must be 5 MB or less.';
      input.value = '';
      return;
    }

    this.selectedChoiceImageFiles.set(choice.clientKey, file);
    choice.hasImage = true;
    choice.imageUrl = URL.createObjectURL(file);
  }

  hasMeaningfulRichText(value: string | null | undefined): boolean {
    return this.extractPlainText(value).length > 0;
  }

  onEditorInit(quill: any): void {
    this.quillInstance = quill;

    quill.root.addEventListener('paste', (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          this.showImagePasteError();
          return;
        }
      }
    });

    quill.root.addEventListener('drop', (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          this.showImagePasteError();
          return;
        }
      }
    });

    quill.clipboard.addMatcher('IMG', () => {
      this.showImagePasteError();
      return new quill.constructor.Immutable('');
    });
  }

  private quillInstance: any;

  private showImagePasteError(): void {
    this.toast.error('Pasting images into the text editor is not allowed. Use the Image button above to upload images.');
    this.quillInstance?.root?.blur();
  }

  private resolveQuestionMode(question: any): QuestionMode {
    const type = Number(question?.type ?? 1);
    const selectionMode = Number(question?.selectionMode ?? 1);
    if (type === 3) return 'short';
    if (type === 2) return 'truefalse';
    return selectionMode === 2 ? 'multiple' : 'single';
  }

  private fail(message: string): void {
    this.loading = false;
    this.error = message;
  }

  private normalizeBetween(value: any, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private normalizeRichText(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  private extractPlainText(value: string | null | undefined): string {
    return String(value ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private reindexChoices(): void {
    this.model.choices = (this.model.choices || []).map((choice: any, index: number) => ({
      ...choice,
      order: index + 1
    }));
  }

  private choiceHasContent(choice: EditableChoice): boolean {
    return Boolean(String(choice.choiceText || '').trim() || choice.hasImage || choice.imageUrl);
  }

  private hydrateChoices(rawChoices: any[]): EditableChoice[] {
    return (rawChoices || []).map((choice: any, index: number) => this.createChoice({
      id: Number(choice?.id ?? 0) || undefined,
      choiceText: String(choice?.choiceText ?? ''),
      imageUrl: String(choice?.imageUrl ?? ''),
      hasImage: Boolean(choice?.hasImage ?? choice?.imageUrl),
      isCorrect: Boolean(choice?.isCorrect ?? false),
      order: Number(choice?.order ?? index + 1)
    }));
  }

  private createDefaultChoices(): EditableChoice[] {
    return [
      this.createChoice({ choiceText: '', isCorrect: true, order: 1 }),
      this.createChoice({ choiceText: '', isCorrect: false, order: 2 }),
      this.createChoice({ choiceText: '', isCorrect: false, order: 3 }),
      this.createChoice({ choiceText: '', isCorrect: false, order: 4 })
    ];
  }

  private createChoice(partial: Partial<EditableChoice>): EditableChoice {
    return {
      id: partial.id,
      clientKey: partial.clientKey || `choice-${this.nextChoiceKey++}`,
      choiceText: String(partial.choiceText ?? ''),
      imageUrl: partial.imageUrl || '',
      hasImage: Boolean(partial.hasImage ?? partial.imageUrl),
      isCorrect: Boolean(partial.isCorrect),
      order: Number(partial.order ?? 1)
    };
  }
}
