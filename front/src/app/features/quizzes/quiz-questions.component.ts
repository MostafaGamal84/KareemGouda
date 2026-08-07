import { Component, OnChanges, OnInit, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QuestionService } from '../../core/services/question.service';
import { QuizService } from '../../core/services/quiz.service';
import { ToastService } from '../../core/services/toast.service';
import { QuestionPdfExportService } from '../../core/services/question-pdf-export.service';
import { firstValueFrom } from 'rxjs';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';
import { Question } from '../../core/models';
import { QuestionCategory, QuestionCategoryService } from '../../core/services/question-category.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

interface CategoryWithCount {
  id: number;
  name: string;
  description?: string;
  questionCount: number;
  selectedCount: number;
}

@Component({
  standalone: true,
  selector: 'app-quiz-questions',
  imports: [CommonModule, FormsModule, RouterLink, SafeRichTextPipe, PaginationControlsComponent],
  template: `
    <div class="quiz-questions-panel">
      <div class="panel-header">
        <div>
          <h3>Questions In This Test</h3>
          <p class="section-copy">{{ quizTitle }}</p>
        </div>
        <div class="header-actions">
          <button type="button" class="secondary" [disabled]="exportingPdf || !(questions || []).length" (click)="exportTestPdf()">
            {{ exportingPdf ? 'PDF…' : 'Export PDF' }}
          </button>
          <button type="button" class="secondary" (click)="openQuestionBrowser()">Add from Bank</button>
          <button type="button" class="secondary" (click)="openRandomSelector()">Add Random by Category</button>
          <a [routerLink]="['/questions/new']" [queryParams]="{quizId: quizId}">
            <button type="button">Create New</button>
          </a>
        </div>
      </div>

      @if ((questions || []).length) {
        <div class="question-workspace">
          <div class="question-list-frame">
            <div class="question-list">
          @for (item of pagedQuestions; track item.id; let i = $index) {
            <article class="question-card">
              <div class="question-card-head">
                <div class="question-info">
                  <span class="question-num">{{ questionPageStartIndex + i + 1 }}</span>
                  <div class="question-title-row">
                    <h4>{{ item.question?.title || item.questionTitle }}</h4>
                    <div class="question-badges">
                      <span class="badge badge-primary">{{ getTypeName(item.question?.type || 1) }}</span>
                      @if ((item.question?.categories || []).length) {
                        @for (category of item.question?.categories || []; track category.id) {
                          <span class="badge badge-info">{{ category.name }}</span>
                        }
                      } @else if (item.question?.categoryName) {
                        <span class="badge badge-info">{{ item.question.categoryName }}</span>
                      }
                      @if (item.question?.difficulty) {
                        <span class="badge badge-{{ item.question.difficulty === 'easy' ? 'success' : item.question.difficulty === 'hard' ? 'danger' : 'warning' }}">
                          {{ item.question.difficulty }}
                        </span>
                      }
                      @if (item.question?.isOwnedByQuiz) {
                        <span class="badge badge-warning">Test Owned</span>
                      }
                    </div>
                  </div>
                </div>
                <button type="button" class="danger" (click)="removeQuestion(item.id)">Remove</button>
              </div>

              @if (item.question?.imageUrl) {
                <img class="question-image" [src]="item.question.imageUrl" alt="Question illustration" />
              }

              @if (item.question?.text) {
                <div class="question-text-content">
                  <div class="rich-text-content" [innerHTML]="item.question.text | safeRichText"></div>
                </div>
              }

              @if ((item.question?.choices || []).length) {
                <div class="choices-section">
                  <h5 class="choices-title">Choices:</h5>
                  <div class="choice-stack">
                    @for (choice of item.question?.choices || []; track choice.id || choice.order) {
                      <div class="choice-row" [class.choice-correct]="choice.isCorrect">
                        <span class="choice-letter">{{ choiceLabel(choice.order - 1) }}</span>
                        @if (choice.imageUrl) {
                          <img [src]="choice.imageUrl" alt="Choice" class="choice-img" />
                        }
                        @if (choice.choiceText) {
                          <span class="choice-text">{{ choice.choiceText }}</span>
                        }
                        @if (choice.isCorrect) {
                          <span class="correct-mark">✓ Correct</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="question-settings">
                <div class="setting-item">
                  <label>Order</label>
                  <input type="number" [(ngModel)]="item.order" min="1" />
                </div>
                <div class="setting-item">
                  <label>Time (sec)</label>
                  <input type="number" [(ngModel)]="item.answerSeconds" min="0" max="300" />
                  <small>0 = unlimited</small>
                </div>
                <div class="setting-item">
                  <label>Points</label>
                  <input type="number" [(ngModel)]="item.pointsOverride" min="0" placeholder="{{ item.question?.points }}" />
                  <span class="setting-hint">Base: {{ item.question?.points || 100 }}</span>
                </div>
              </div>
            </article>
          }
            </div>
          </div>

          @if (questionTotalPages > 1 || questionPageSize !== questionPageSizeOptions[0]) {
            <app-pagination-controls
              [page]="questionPage"
              [totalPages]="questionTotalPages"
              [pageSize]="questionPageSize"
              [sizeOptions]="questionPageSizeOptions"
              (pageChange)="onQuestionPageChange($event)"
              (pageSizeChange)="onQuestionPageSizeChange($event)" />
          }

          <div class="actions-bar">
            <button type="button" (click)="saveSettings()">Save Changes</button>
          </div>
        </div>
      } @else {
        <div class="question-workspace">
          <div class="question-list-frame">
            <div class="empty-state">
              <h4>No questions yet</h4>
              <p>Add questions from the question bank or create new ones</p>
            </div>
          </div>
        </div>
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>

    @if (showQuestionBrowser) {
      <div class="modal-overlay" (click)="closeQuestionBrowser()">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Questions from Bank</h3>
            <button type="button" class="close-btn" (click)="closeQuestionBrowser()">X</button>
          </div>
          <div class="modal-body">
            <div class="browser-filters">
              <input
                type="text"
                [(ngModel)]="browserSearch"
                placeholder="Search by keyword, question text, answer, or category"
                (keyup.enter)="applyQuestionBankFilters()" />
              <select [(ngModel)]="browserCategoryId" (change)="applyQuestionBankFilters()">
                <option [ngValue]="null">All categories</option>
                @for (category of bankCategories; track category.id) {
                  <option [ngValue]="category.id">{{ category.name }} ({{ category.questionsCount }})</option>
                }
              </select>
              <button type="button" class="secondary" (click)="applyQuestionBankFilters()" [disabled]="bankLoading || questionActionLoading">
                {{ bankLoading ? 'Searching...' : 'Search' }}
              </button>
              <button type="button" class="secondary" (click)="clearQuestionBankFilters()" [disabled]="questionActionLoading || (!browserSearch && !browserCategoryId)">
                Clear
              </button>
            </div>

            @if (bankQuestions.length > 0 || bankTotalCount > 0) {
              <div class="browser-actions">
                <button type="button" class="secondary" (click)="selectAllBankQuestions()" [disabled]="bankLoading || questionActionLoading">Select All</button>
                <button type="button" class="secondary" (click)="clearBankSelection()" [disabled]="questionActionLoading">Clear</button>
                <span>{{ selectedBankQuestions.size }} selected | {{ bankTotalCount }} match(es)</span>
              </div>
            }

            <div class="bank-questions-list">
              @for (q of bankQuestions; track q.id) {
                <div class="bank-question-item" 
                     [class.selected]="selectedBankQuestions.has(q.id)"
                     [class.disabled]="isQuestionLinked(q.id)"
                     (click)="!questionActionLoading && !isQuestionLinked(q.id) && toggleBankQuestion(q.id)">
                  <div class="bank-checkbox" [class.checked]="selectedBankQuestions.has(q.id)">
                    @if (selectedBankQuestions.has(q.id)) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                  </div>
                  <div class="bank-question-content">
                    <strong>{{ q.title }}</strong>
                    @if (q.text) {
                      <div class="bank-question-text rich-text-content" [innerHTML]="q.text | safeRichText"></div>
                    }
                    <span class="bank-meta">{{ getTypeName(q.type) }} | {{ q.points }} pts</span>
                    @if ((q.categories || []).length) {
                      <span class="bank-meta">{{ categoryNames(q) }}</span>
                    } @else if (q.categoryName) {
                      <span class="bank-meta">{{ q.categoryName }}</span>
                    }
                    @if (q.quizId && !q.isOwnedByQuiz) {
                      <span class="linked-info">Linked to: {{ q.quizTitle }}</span>
                    }
                  </div>
                </div>
              }

              @if (bankQuestions.length === 0 && !bankLoading) {
                <p class="no-results">No questions found</p>
              }
            </div>

            @if (bankTotalPages > 1 || bankPageSize !== bankPageSizeOptions[0]) {
              <app-pagination-controls
                [page]="bankPage"
                [totalPages]="bankTotalPages"
                [pageSize]="bankPageSize"
                [sizeOptions]="bankPageSizeOptions"
                (pageChange)="onBankPageChange($event)"
                (pageSizeChange)="onBankPageSizeChange($event)" />
            }

            @if (bankLoading) {
              <p class="loading">Loading...</p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeQuestionBrowser()" [disabled]="questionActionLoading">Cancel</button>
            <button type="button" [disabled]="selectedBankQuestions.size === 0 || questionActionLoading" (click)="addSelectedQuestions()">
              {{ questionActionLoading ? 'Adding...' : 'Add ' + selectedBankQuestions.size + ' Question(s)' }}
            </button>
            <button type="button" [disabled]="selectedBankQuestions.size === 0 || questionActionLoading" (click)="addSelectedQuestions(true)">
              {{ questionActionLoading ? 'Adding...' : 'Add & Save' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showRandomSelector) {
      <div class="modal-overlay" (click)="closeRandomSelector()">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Random Questions by Category</h3>
            <button type="button" class="close-btn" (click)="closeRandomSelector()">X</button>
          </div>
          <div class="modal-body">
            @if (randomLoading) {
              <p class="loading">Loading categories...</p>
            } @else if (categoriesWithCounts.length === 0) {
              <p class="no-results">No categories found. Create categories for your questions first.</p>
            } @else {
              <div class="category-random-list">
                @for (cat of categoriesWithCounts; track cat.id) {
                  <div class="category-random-item">
                    <div class="category-info">
                      <strong>{{ cat.name }}</strong>
                      <span class="bank-meta">{{ cat.questionCount }} questions available</span>
                    </div>
                    <div class="category-input">
                      <input type="number"
                        [(ngModel)]="cat.selectedCount"
                        [max]="cat.questionCount"
                        min="0"
                        placeholder="0" />
                      <span class="count-label">questions</span>
                    </div>
                  </div>
                }
              </div>
              <div class="random-summary">
                <strong>Total questions selected: {{ getTotalSelected() }}</strong>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeRandomSelector()" [disabled]="questionActionLoading">Cancel</button>
            <button type="button" [disabled]="randomLoading || questionActionLoading || getTotalSelected() === 0" (click)="addRandomQuestions()">
              {{ questionActionLoading ? 'Adding...' : 'Add ' + getTotalSelected() + ' Question(s)' }}
            </button>
            <button type="button" [disabled]="randomLoading || questionActionLoading || getTotalSelected() === 0" (click)="addRandomQuestions(true)">
              {{ questionActionLoading ? 'Adding...' : 'Add & Save' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .quiz-questions-panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 0;
      height: 100%;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .panel-header h3 { margin: 0; }
    .section-copy { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .header-actions a { text-decoration: none; }

    .question-workspace {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }

    .question-list-frame {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
    }

    .question-list {
      display: grid;
      gap: 12px;
      height: 100%;
      overflow-y: auto;
      padding-right: 6px;
      scrollbar-gutter: stable;
      align-content: start;
    }

    .question-card {
      padding: 16px;
      border-radius: 16px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      display: grid;
      gap: 12px;
    }

    .question-card-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .question-info { display: flex; gap: 12px; align-items: flex-start; }

    .question-num {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .question-card-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }

    .question-info {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .question-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--primary-tint);
      color: var(--primary);
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .question-title-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .question-title-row h4 {
      margin: 0;
      font-size: 1rem;
      color: var(--text);
    }

    .question-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid transparent;
    }

    .badge-primary {
      background: var(--primary-tint);
      border-color: var(--primary-border);
      color: var(--primary);
    }

    .badge-info {
      background: var(--info-tint);
      border-color: var(--info-border);
      color: var(--info);
    }

    .badge-success {
      background: var(--success-tint);
      border-color: var(--success-border);
      color: var(--success);
    }

    .badge-warning {
      background: var(--warning-tint);
      border-color: var(--warning-border);
      color: var(--warning);
    }

    .badge-danger {
      background: var(--danger-tint);
      border-color: var(--danger-border);
      color: var(--danger);
    }

    .question-text-content {
      padding: 12px;
      background: var(--surface-soft);
      border-radius: 10px;
      margin: 12px 0;
    }

    .choices-section {
      margin: 14px 0;
    }

    .choices-title {
      margin: 0 0 8px;
      font-size: 0.85rem;
      color: var(--muted);
      font-weight: 600;
    }

    .choice-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .choice-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      font-size: 0.9rem;
    }

    .choice-correct {
      border-color: var(--success-border);
      background: var(--success-tint);
    }

    .choice-letter {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--surface-soft);
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .choice-correct .choice-letter {
      background: var(--success);
      color: white;
    }

    .choice-img {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      object-fit: cover;
    }

    .choice-text {
      flex: 1;
      color: var(--text);
    }

    .correct-mark {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--success);
      padding: 2px 8px;
      background: rgba(52, 243, 187, 0.15);
      border-radius: 4px;
    }

    .question-settings {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 14px;
      background: var(--surface-soft);
      border-radius: 10px;
      margin-top: 14px;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .setting-item label {
      font-size: 0.78rem;
      color: var(--muted);
      font-weight: 600;
    }

    .setting-item input {
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--input-bg);
      font-size: 0.9rem;
    }

    .setting-item input:focus {
      border-color: var(--input-focus-border);
      box-shadow: var(--input-focus-shadow);
    }

    .setting-hint {
      font-size: 0.72rem;
      color: var(--muted);
    }

    .question-image {
      width: min(300px, 100%);
      border-radius: 12px;
      border: 1px solid var(--border);
      margin: 10px 0;
    }

    .actions-bar {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    .empty-state {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 100%;
      padding: 48px 20px;
      border: 2px dashed var(--border);
      border-radius: 16px;
      background: var(--surface-soft);
    }

    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: var(--surface);
      border-radius: 20px;
      padding: 24px;
      min-width: 400px;
      max-width: 90vw;
      width: 700px;
      height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .modal-large { width: 700px; min-height: 500px; }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-header h3 { margin: 0; }
    .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; }

    .modal-body { flex: 1; overflow-y: auto; display: grid; gap: 12px; min-height: 0; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex-shrink: 0; }

    .browser-filters {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 220px) auto auto;
      gap: 8px;
      align-items: center;
    }
    .browser-filters input,
    .browser-filters select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
    }

    .browser-actions { display: flex; gap: 8px; align-items: center; font-size: 0.9rem; }

    .bank-questions-list {
      display: grid;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
    }

    .bank-question-item {
      display: flex;
      gap: 12px;
      padding: 14px;
      border: 2px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
      align-items: flex-start;
      background: var(--surface);
    }

    .bank-question-item:hover:not(.disabled) {
      border-color: var(--accent-hover-border);
      background: var(--accent-hover-bg);
    }

    .bank-question-item.selected {
      border-color: var(--accent-selected-border);
      background: var(--accent-selected-bg);
      box-shadow: 0 0 0 1px var(--accent-wine-soft) inset, 0 18px 30px -28px var(--accent-wine-glow);
    }

    .bank-question-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .bank-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-radius: 4px;
      background: var(--surface);
      flex-shrink: 0;
    }

    .bank-question-item.selected .bank-checkbox {
      background: var(--accent-wine);
      border-color: var(--accent-wine);
    }

    .bank-checkbox svg {
      width: 12px;
      height: 12px;
      color: white;
    }

    @media (max-width: 760px) {
      .bank-checkbox {
        width: 18px;
        height: 18px;
      }
      .bank-checkbox svg {
        width: 11px;
        height: 11px;
      }
    }

    @media (max-width: 520px) {
      .bank-checkbox {
        width: 16px;
        height: 16px;
        border-radius: 3px;
      }
      .bank-checkbox svg {
        width: 10px;
        height: 10px;
      }
    }

    .bank-question-content { 
      display: grid; 
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .bank-question-content strong {
      font-size: 0.95rem;
      color: var(--text);
    }

    .bank-question-text {
      width: 100%;
      margin: 6px 0;
      color: var(--text);
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    .bank-meta { font-size: 0.8rem; color: var(--muted); }
    .linked-info { font-size: 0.75rem; color: var(--info); font-weight: 600; }

    .bank-questions-list {
      display: grid;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
    }

    .browser-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 0;
    }

    .browser-actions button {
      padding: 6px 12px;
      font-size: 0.85rem;
    }

    .browser-actions span {
      margin-left: auto;
      font-weight: 600;
      color: var(--accent-wine);
    }

    .no-results, .loading { text-align: center; color: var(--muted); padding: 20px; }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--overlay-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: var(--dialog-panel-bg);
      border: 1px solid var(--dialog-panel-border);
      border-radius: 18px;
      padding: 24px;
      width: 100%;
      max-width: 500px;
      max-height: 100%;
      overflow-y: auto;
      box-shadow: var(--dialog-panel-shadow);
    }

    .modal-large { max-width: 600px; min-height: 400px; }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-header h3 { margin: 0; font-size: 1.1rem; }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.4rem;
      cursor: pointer;
      color: var(--muted);
      padding: 4px 8px;
      border-radius: 8px;
    }
    .close-btn:hover { background: var(--surface-soft); color: var(--text); }

    .modal-body { display: grid; gap: 14px; min-height: 0; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; flex-shrink: 0; }

    .category-random-list { display: grid; gap: 10px; }
    .category-random-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
    }
    .category-info { display: grid; gap: 4px; }
    .category-info strong { font-size: 0.95rem; }
    .category-input { display: flex; align-items: center; gap: 8px; }
    .category-input input {
      width: 80px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--input-bg);
      text-align: center;
      font-size: 0.95rem;
    }
    .category-input input:focus {
      border-color: var(--input-focus-border);
      box-shadow: var(--input-focus-shadow);
    }
    .count-label { font-size: 0.85rem; color: var(--muted); }
    .random-summary {
      padding: 14px;
      background: var(--accent-selected-bg);
      border: 1px solid var(--accent-hover-border);
      border-radius: 10px;
      text-align: center;
      font-weight: 600;
      color: var(--accent-wine);
    }

    @media (max-width: 760px) {
      .question-settings { grid-template-columns: 1fr; }
      .modal-content, .modal-large { min-width: auto; width: 95vw; }
      .browser-filters { grid-template-columns: 1fr; }
      .browser-actions { flex-wrap: wrap; }
      .question-list-frame { padding: 10px; }
      .browser-actions span {
        width: 100%;
        margin-left: 0;
      }
    }
  `]
})
export class QuizQuestionsComponent implements OnInit, OnChanges {
  @Input() quizId!: number;
  @Input() quizTitle = '';
  @Input() questions: any[] = [];
  @Output() questionsChanged = new EventEmitter<void>();

  error = '';
  showQuestionBrowser = false;
  showRandomSelector = false;
  bankQuestions: Question[] = [];
  bankCategories: QuestionCategory[] = [];
  bankLoading = false;
  browserSearch = '';
  browserCategoryId: number | null = null;
  bankPage = 1;
  bankPageSize = 20;
  readonly bankPageSizeOptions = [20, 50, 100, 500, 1000] as const;
  bankTotalCount = 0;
  selectedBankQuestions = new Set<number>();
  categoriesWithCounts: CategoryWithCount[] = [];
  randomLoading = false;
  exportingPdf = false;
  questionActionLoading = false;
  questionPage = 1;
  questionPageSize = 5;
  readonly questionPageSizeOptions = [5, 10, 20, 50, 100] as const;
  private bankRequestId = 0;

  constructor(
    private questionService: QuestionService,
    private questionCategoryService: QuestionCategoryService,
    private quizService: QuizService,
    private toast: ToastService,
    private pdfExport: QuestionPdfExportService
  ) {}

  ngOnInit(): void {
    this.loadBankCategories();
    this.ensureValidQuestionPage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questions']) {
      this.ensureValidQuestionPage();
    }
  }

  async loadQuestionBank(): Promise<void> {
    const requestId = ++this.bankRequestId;
    this.bankLoading = true;
    this.error = '';

    try {
      const params: any = {
        pageNumber: this.bankPage,
        pageSize: this.bankPageSize
      };

      const trimmedSearch = String(this.browserSearch || '').trim();
      if (trimmedSearch) {
        params.search = trimmedSearch;
      }

      if (this.browserCategoryId) {
        params.categoryId = this.browserCategoryId;
      }

      const res = await firstValueFrom(this.questionService.getAll(params, { skipLoading: true }));
      if (requestId !== this.bankRequestId) {
        return;
      }

      this.bankQuestions = Array.isArray(res?.items) ? res.items : [];
      this.bankTotalCount = Number(res?.totalCount ?? this.bankQuestions.length);
    } catch (err: any) {
      if (requestId !== this.bankRequestId) {
        return;
      }

      this.bankQuestions = [];
      this.bankTotalCount = 0;
      this.toast.error(err?.error?.message || 'Failed to load question bank');
    } finally {
      if (requestId === this.bankRequestId) {
        this.bankLoading = false;
      }
    }
  }

  loadBankCategories(): void {
    if (this.bankCategories.length > 0) {
      return;
    }

    this.questionCategoryService.getAll({ skipLoading: true }).subscribe({
      next: (categories) => {
        this.bankCategories = [...(categories || [])]
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    });
  }

  clearQuestionBankFilters(): void {
    this.browserSearch = '';
    this.browserCategoryId = null;
    this.bankPage = 1;
    void this.loadQuestionBank();
  }

  applyQuestionBankFilters(): void {
    this.bankPage = 1;
    void this.loadQuestionBank();
  }

  closeQuestionBrowser(): void {
    this.bankRequestId++;
    this.bankLoading = false;
    this.showQuestionBrowser = false;
    this.selectedBankQuestions.clear();
  }

  toggleBankQuestion(id: number): void {
    if (this.selectedBankQuestions.has(id)) {
      this.selectedBankQuestions.delete(id);
    } else {
      this.selectedBankQuestions.add(id);
    }
  }

  selectAllBankQuestions(): void {
    this.bankQuestions
      .filter(q => !this.isQuestionLinked(q.id))
      .forEach(q => this.selectedBankQuestions.add(q.id));
  }

  clearBankSelection(): void {
    this.selectedBankQuestions.clear();
  }

  get availableBankQuestionCount(): number {
    return this.bankQuestions.filter((question) => !this.isQuestionLinked(question.id)).length;
  }

  get bankTotalPages(): number {
    return Math.max(1, Math.ceil((this.bankTotalCount || 0) / this.bankPageSize));
  }

  get questionTotalPages(): number {
    return Math.max(1, Math.ceil((this.questions?.length || 0) / this.questionPageSize));
  }

  get questionPageStartIndex(): number {
    return (this.questionPage - 1) * this.questionPageSize;
  }

  get pagedQuestions(): any[] {
    const start = this.questionPageStartIndex;
    return (this.questions || []).slice(start, start + this.questionPageSize);
  }

  isQuestionLinked(questionId: number): boolean {
    return this.questions.some((q: any) => Number(q.questionId) === Number(questionId));
  }

  addSelectedQuestions(saveAndClose: boolean = false): void {
    if (this.selectedBankQuestions.size === 0 || this.questionActionLoading) return;

    const nextOrder = Math.max(...this.questions.map((q: any) => Number(q.order) || 0), 0) + 1;
    const items = Array.from(this.selectedBankQuestions).map((qId, index) => ({
      questionId: qId,
      order: nextOrder + index,
      pointsOverride: null,
      answerSeconds: null
    }));

    this.questionActionLoading = true;
    this.quizService.addQuestions(this.quizId, items, { skipLoading: true }).subscribe({
      next: async () => {
        this.closeQuestionBrowser();
        await this.refreshQuestions(true);
        if (saveAndClose) {
          this.questionsChanged.emit();
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to add questions';
        this.questionActionLoading = false;
      },
      complete: () => {
        this.questionActionLoading = false;
      }
    });
  }

  async refreshQuestions(skipLoading: boolean = false): Promise<void> {
    const res = await firstValueFrom(this.quizService.getById(this.quizId, { skipLoading }));
    this.questions = (res.questions || []).map((item: any, index: number) => ({
      ...item,
      order: Number(item?.order ?? index + 1),
      answerSeconds: Number(item?.answerSeconds ?? item?.question?.answerSeconds ?? 30),
      pointsOverride: item?.pointsOverride ?? null
    }));
    this.ensureValidQuestionPage();
  }

  removeQuestion(quizQuestionId: number): void {
    this.quizService.removeQuestion(this.quizId, quizQuestionId).subscribe({
      next: () => void this.refreshQuestions(),
      error: (err) => this.error = err?.error?.message || 'Failed to remove question'
    });
  }

  saveSettings(): void {
    const payload = this.questions.map((item: any, index: number) => ({
      questionId: Number(item.questionId),
      order: Number(item.order) || index + 1,
      pointsOverride: item.pointsOverride || null,
      answerSeconds: Number(item.answerSeconds) === 0 ? 0 : (Number(item.answerSeconds) || 30)
    }));

    this.quizService.addQuestions(this.quizId, payload).subscribe({
      next: () => {
        void this.refreshQuestions();
        this.toast.success('Settings saved');
      },
      error: (err) => this.error = err?.error?.message || 'Failed to save settings'
    });
  }

  getTypeName(type: number): string {
    const types: Record<number, string> = { 1: 'Multiple Choice', 2: 'True/False', 3: 'Short Answer' };
    return types[type] || 'Unknown';
  }

  categoryNames(question: any): string {
    const categories = Array.isArray(question?.categories)
      ? question.categories.map((category: any) => category?.name).filter(Boolean)
      : [];

    if (categories.length > 0) {
      return categories.join(', ');
    }

    return String(question?.categoryName || '');
  }

  choiceLabel(index: number): string {
    return String.fromCharCode(65 + Math.max(0, index));
  }

  onQuestionPageChange(page: number): void {
    if (page === this.questionPage) {
      return;
    }

    this.questionPage = page;
  }

  onQuestionPageSizeChange(pageSize: number): void {
    if (pageSize === this.questionPageSize) {
      return;
    }

    this.questionPageSize = pageSize;
    this.questionPage = 1;
    this.ensureValidQuestionPage();
  }

  onBankPageChange(page: number): void {
    if (page === this.bankPage || this.bankLoading) {
      return;
    }

    this.bankPage = page;
    void this.loadQuestionBank();
  }

  onBankPageSizeChange(pageSize: number): void {
    if (pageSize === this.bankPageSize || this.bankLoading) {
      return;
    }

    this.bankPageSize = pageSize;
    this.bankPage = 1;
    void this.loadQuestionBank();
  }

  async exportTestPdf(): Promise<void> {
    if (this.exportingPdf) return;
    this.exportingPdf = true;
    try {
      const res = await firstValueFrom(this.quizService.getById(this.quizId));
      const list = res?.questions || [];
      const blocks = this.pdfExport.buildQuizBlocksFromApi(list);
      if (!blocks.length) {
        this.toast.error('No questions to export');
        return;
      }
      const title = String(res?.title || this.quizTitle || 'Test');
      await this.pdfExport.exportQuizPaperPdf(
        title,
        this.pdfExport.slug(title, `test_${this.quizId}`),
        blocks
      );
      this.toast.success('PDF downloaded');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'PDF export failed';
      this.toast.error(msg);
    } finally {
      this.exportingPdf = false;
    }
  }

  openQuestionBrowser(): void {
    this.showQuestionBrowser = true;
    this.bankPage = 1;
    this.loadBankCategories();
    void this.loadQuestionBank();
  }

  openRandomSelector(): void {
    this.showRandomSelector = true;
    this.loadCategoriesWithCounts();
  }

  closeRandomSelector(): void {
    this.showRandomSelector = false;
  }

  loadCategoriesWithCounts(): void {
    this.randomLoading = true;
    this.questionService.getCategoriesWithCounts({ skipLoading: true }).subscribe({
      next: (res: any) => {
        this.randomLoading = false;
        this.categoriesWithCounts = (res || []).map((c: any) => ({
          id: Number(c.id),
          name: String(c.name || ''),
          description: c.description,
          questionCount: Number(c.questionCount || 0),
          selectedCount: 0
        }));
      },
      error: () => {
        this.randomLoading = false;
      }
    });
  }

  getTotalSelected(): number {
    return this.categoriesWithCounts.reduce((sum, c) => sum + (c.selectedCount || 0), 0);
  }

  addRandomQuestions(saveAndClose: boolean = false): void {
    if (this.questionActionLoading) return;

    const selections = this.categoriesWithCounts
      .filter(c => c.selectedCount > 0 && c.selectedCount <= c.questionCount)
      .map(c => ({ categoryId: c.id, count: c.selectedCount }));

    if (selections.length === 0) return;

    this.questionActionLoading = true;
    this.questionService.getRandomByCategory({ categorySelections: selections }, { skipLoading: true }).subscribe({
      next: (results: any) => {
        const allQuestionIds: number[] = [];
        let currentOrder = Math.max(...this.questions.map((q: any) => Number(q.order) || 0), 0);

        for (const result of results) {
          for (const q of result.questions) {
            if (!this.isQuestionLinked(q.id)) {
              allQuestionIds.push(q.id);
              currentOrder++;
            }
          }
        }

        if (allQuestionIds.length === 0) {
          this.toast.info('Selected questions are already in this test');
          this.closeRandomSelector();
          this.questionActionLoading = false;
          return;
        }

        const items = allQuestionIds.map((qId, index) => ({
          questionId: qId,
          order: currentOrder + index,
          pointsOverride: null,
          answerSeconds: null
        }));

        this.quizService.addQuestions(this.quizId, items, { skipLoading: true }).subscribe({
          next: async () => {
            this.closeRandomSelector();
            await this.refreshQuestions(true);
            this.toast.success(`Added ${items.length} random questions`);
            if (saveAndClose) {
              this.questionsChanged.emit();
            }
          },
          error: (err) => {
            this.error = err?.error?.message || 'Failed to add random questions';
            this.questionActionLoading = false;
          },
          complete: () => {
            this.questionActionLoading = false;
          }
        });
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to fetch random questions';
        this.questionActionLoading = false;
      }
    });
  }

  private ensureValidQuestionPage(): void {
    if (this.questionPage < 1) {
      this.questionPage = 1;
      return;
    }

    const totalPages = this.questionTotalPages;
    if (this.questionPage > totalPages) {
      this.questionPage = totalPages;
    }
  }
}
