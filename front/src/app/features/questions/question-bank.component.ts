import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { QuestionService } from '../../core/services/question.service';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionCategoryService, QuestionCategory } from '../../core/services/question-category.service';
import { ToastService } from '../../core/services/toast.service';
import { PagedResult, Question } from '../../core/models';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import { QuestionPdfExportService } from '../../core/services/question-pdf-export.service';
import { SafeRichTextPipe } from '../../shared/safe-rich-text.pipe';
import { concatMap, firstValueFrom, from } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaginationControlsComponent, SafeRichTextPipe],
  template: `
    <div class="question-bank-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Question Bank</p>
          <h2>Questions Library</h2>
          <p class="header-desc">Browse, create, and assign questions to tests</p>
        </div>
        <div class="header-actions">
          <input
            #questionImportInput
            type="file"
            accept=".xlsx,.xls"
            [disabled]="importing"
            (change)="onFileSelected($event)"
            hidden />
          <button type="button" class="secondary" [disabled]="importing" (click)="questionImportInput.click()">
            {{ importing ? 'Importing...' : 'Import Excel' }}
          </button>
          <button type="button" class="secondary" (click)="openCategoryManager()">Manage Categories</button>
          <a routerLink="/questions/new"><button type="button">Create Question</button></a>
        </div>
      </div>

      <div class="filter-bar">
        <button type="button" class="filter-icon-btn" (click)="toggleFilterPopup(); $event.stopPropagation()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>Filters</span>
        </button>
        @if (searchTerm || typeFilter || modeFilter || categoryFilter) {
          <button type="button" class="clear-filters-btn" (click)="clearFilters()">Clear</button>
        }
      </div>

      @if (showFilterPopup) {
        <div class="filter-popup-container">
          <div class="filter-popup">
            <div class="filter-popup-header">
              <h4>Filters</h4>
              <button type="button" class="close-filter-btn" (click)="cancelFilters()">✕</button>
            </div>
            <div class="filter-popup-body">
              <div class="field">
                <label>Search</label>
                <input type="text" [(ngModel)]="tempSearchTerm" placeholder="Search questions..." />
              </div>
              <div class="field">
                <label>Type</label>
                <select [(ngModel)]="tempTypeFilter">
                  <option [ngValue]="0">All Types</option>
                  <option [ngValue]="1">Multiple Choice</option>
                  <option [ngValue]="2">True/False</option>
                  <option [ngValue]="3">Short Answer</option>
                </select>
              </div>
              <div class="field">
                <label>Mode</label>
                <select [(ngModel)]="tempModeFilter">
                  <option [ngValue]="0">All Modes</option>
                  <option [ngValue]="1">Single Answer</option>
                  <option [ngValue]="2">Multiple Answers</option>
                </select>
              </div>
              <div class="field">
                <label>Category</label>
                <select [(ngModel)]="tempCategoryFilter">
                  <option [ngValue]="0">All Categories</option>
                  @for (cat of categories; track cat.id) {
                    <option [ngValue]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="filter-popup-footer">
              <button type="button" class="secondary" (click)="cancelFilters()">Cancel</button>
              <button type="button" (click)="applyFilters()">Apply</button>
            </div>
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading-state">
          <p>Loading questions...</p>
        </div>
      }

      @if (selectedQuestions.size > 0) {
        <div class="bulk-actions-stack">
          <div class="bulk-actions-bar">
            <span class="selection-count">{{ selectedQuestions.size }} selected</span>
            <button type="button" class="clear-selection-btn" (click)="clearSelection()">Clear</button>
            <div class="bulk-dropdown-container">
              <button type="button" class="bulk-dropdown-toggle" (click)="toggleBulkDropdown(); $event.stopPropagation()">
                Actions
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              @if (showBulkDropdown) {
                <div class="bulk-dropdown-menu">
                  <button type="button" class="open-bulk-category-btn" (click)="openBulkCategoryPanel('add'); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9"></path>
                      <path d="M21 3v6h-6"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                    Add Category
                  </button>
                  <button type="button" class="open-bulk-category-btn" (click)="openBulkCategoryPanel('remove'); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9"></path>
                      <path d="M21 3v6h-6"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                    Remove Category
                  </button>
                  <button type="button" (click)="openBulkSettings('duration'); closeBulkDropdown()">
                    Edit Duration
                  </button>
                  <button type="button" (click)="openBulkSettings('points'); closeBulkDropdown()">
                    Edit Points
                  </button>
                  <button type="button" (click)="bulkExport(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export Excel
                  </button>
                  <button type="button" [disabled]="exportingPdf" (click)="exportBankPdfSelected(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    {{ exportingPdf ? 'PDF…' : 'Export PDF' }}
                  </button>
                  <button type="button" (click)="bulkDuplicate(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Duplicate
                  </button>
                  <button type="button" (click)="showAssignModal = true; closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Assign to Test
                  </button>
                  <button type="button" class="danger" (click)="bulkDelete(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete
                  </button>
                </div>
              }
            </div>
          </div>

          @if (showBulkCategoryPanel) {
            <div class="bulk-category-panel" (click)="$event.stopPropagation()">
              <div class="bulk-category-panel-header">
                <div>
                  @if (bulkCategoryPanelMode === 'add') {
                    <strong>Add categories to selected questions</strong>
                    <p>Type a name and press Enter or Add, pick from existing when shown, then apply. Order is preserved; duplicates are skipped.</p>
                  } @else {
                    <strong>Remove categories from selected questions</strong>
                    <p>Tap one or more categories to remove them from the selected questions only, or use remove all to clear every category link.</p>
                  }
                </div>
                <button type="button" class="secondary bulk-category-close-btn" (click)="closeBulkCategoryPanel()">Close</button>
              </div>

              @if (bulkCategoryPanelMode === 'add') {
                <div class="field bulk-add-category-stack">
                  <label for="bulk-panel-cat-input" class="bulk-categories-field-label">Categories *</label>
                  <div class="bulk-panel-category-toolbar">
                    <div class="bulk-panel-category-input-group">
                      <input
                        id="bulk-panel-cat-input"
                        name="bulkPanelCategoryInput"
                        type="text"
                        [(ngModel)]="bulkPanelInput"
                        placeholder="Type category and press Enter"
                        list="bulk-panel-category-datalist"
                        (keydown.enter)="addBulkPanelCategoryFromInput($event)"
                        (keydown)="handleBulkPanelCategorySeparators($event)"
                        (blur)="addBulkPanelCategoryOnBlur()" />
                      <datalist id="bulk-panel-category-datalist">
                        @for (cat of categories; track cat.id) {
                          <option [value]="cat.name"></option>
                        }
                      </datalist>
                      <button type="button" class="secondary bulk-panel-add-btn" (click)="addBulkPanelCategoryFromInput()">Add</button>
                    </div>
                    <button
                      type="button"
                      class="secondary bulk-panel-show-existing-btn"
                      (click)="toggleBulkPanelShowExisting(); $event.stopPropagation()">
                      {{ bulkPanelShowExisting ? 'Hide existing categories' : 'Show existing categories' }}
                    </button>
                  </div>
                  @if (bulkPanelPicked.length) {
                    <div class="bulk-panel-picked-chips">
                      @for (cat of bulkPanelPicked; track trackBulkPanelPicked($index, cat)) {
                        <button type="button" class="chip chip-selected" (click)="removeBulkPanelCategory(cat); $event.stopPropagation()">
                          {{ cat.name }} <span class="chip-remove" aria-hidden="true">×</span>
                        </button>
                      }
                    </div>
                  }
                  @if (bulkPanelShowExisting && bulkPanelSuggestedCategories.length) {
                    <div class="bulk-panel-existing-section">
                      <span class="bulk-panel-existing-label">Or choose existing</span>
                      <div class="bulk-panel-suggestion-chips">
                        @for (cat of bulkPanelSuggestedCategories; track cat.id) {
                          <button type="button" class="chip" (click)="selectBulkPanelCategory(cat)">{{ cat.name }}</button>
                        }
                      </div>
                    </div>
                  }
                </div>
                <div class="bulk-category-actions bulk-category-actions-row">
                  <button type="button" class="secondary" (click)="closeBulkCategoryPanel()">Cancel</button>
                  <button type="button" (click)="bulkAddCategory()" [disabled]="bulkCategorySaving">
                    {{ bulkCategorySaving ? 'Applying...' : 'Apply categories' }}
                  </button>
                </div>
              } @else {
                <div class="field bulk-remove-category-stack">
                  <div class="bulk-remove-all-row">
                    <button
                      type="button"
                      class="bulk-remove-all-toggle"
                      [class.bulk-remove-all-active]="bulkRemoveAllMode"
                      (click)="toggleBulkRemoveAllMode(); $event.stopPropagation()">
                      {{ bulkRemoveAllMode ? 'Cancel remove all' : 'Remove ALL categories from selected questions' }}
                    </button>
                  </div>
                  @if (bulkRemoveAllMode) {
                    <p class="bulk-remove-all-warning">Every category will be unlinked from the selected questions. This cannot be undone from here.</p>
                  } @else if (categories.length) {
                    <span class="bulk-remove-picks-label">Tap categories to remove</span>
                    <div class="bulk-remove-pick-grid">
                      @for (cat of categories; track cat.id) {
                        <button
                          type="button"
                          class="chip bulk-remove-pick-chip"
                          [class.chip-selected]="bulkRemoveSelectedIds.has(cat.id)"
                          (click)="toggleBulkRemoveCategoryId(cat.id); $event.stopPropagation()">
                          {{ cat.name }}
                        </button>
                      }
                    </div>
                  } @else {
                    <p class="bulk-remove-empty">No categories in the catalog.</p>
                  }
                </div>
                <div class="bulk-category-actions bulk-category-actions-row">
                  <button type="button" class="secondary" (click)="closeBulkCategoryPanel()">Cancel</button>
                  <button
                    type="button"
                    class="secondary"
                    (click)="executeBulkRemove()"
                    [disabled]="bulkCategorySaving || (!bulkRemoveAllMode && bulkRemoveSelectedIds.size === 0)">
                    {{ bulkCategorySaving ? 'Removing...' : (bulkRemoveAllMode ? 'Remove all' : 'Remove selected') }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (!loading && questions.length === 0) {
        <div class="empty-state">
          <h4>No questions found</h4>
          <p>Create your first question to get started</p>
          <a routerLink="/questions/new"><button type="button">Create Question</button></a>
        </div>
      }

      @if (!loading && questions.length > 0) {
        <div class="filter-bar">
          <label style="display: inline-flex; align-items: center; gap: 10px; font-weight: 600; color: var(--text); cursor: pointer;">
            <input
              type="checkbox"
              style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-wine);"
              [checked]="allSelected"
              [indeterminate]="selectedQuestionsOnPageCount > 0 && !allSelected"
              (change)="toggleSelectAll()" />
            <span>Select All</span>
          </label>
          <span class="page-info">{{ selectedQuestionsOnPageCount }} / {{ questions.length }} on this page</span>
        </div>

        <div class="questions-list">
          @for (q of questions; track q.id) {
            <article class="question-row" [class.selected]="selectedQuestions.has(q.id)" (click)="toggleQuestion(q.id)">
              <div class="row-select">
                <input type="checkbox" [checked]="selectedQuestions.has(q.id)" (click)="$event.stopPropagation()" (change)="toggleQuestion(q.id)" />
              </div>
              
              <div class="row-content">
                <div class="row-main">
                  <div class="row-title">{{ q.title }}</div>
                  <div class="row-text rich-text-content" [innerHTML]="q.text | safeRichText"></div>
                  
                  @if (q.choices && q.choices.length > 0) {
                    <div class="row-choices">
                      @for (choice of q.choices; track choice.id || choice.order) {
                        <span class="choice-chip" [class.correct]="choice.isCorrect">
                          @if (choice.imageUrl) {
                            <img [src]="choice.imageUrl" alt="" class="choice-icon" />
                          }
                          {{ choice.choiceText || 'Image' }}
                          @if (choice.isCorrect) {
                            <span class="check-icon">✓</span>
                          }
                        </span>
                      }
                    </div>
                  }
                </div>
                
                <div class="row-meta">
                  <div class="meta-item" title="Question type">
                    <span class="meta-label">Type:</span>
                    <span class="meta-badge type-badge">{{ getTypeName(q.type) }}</span>
                  </div>
                  <div class="meta-item" title="Points for correct answer">
                    <span class="meta-label">Points:</span>
                    <span class="meta-badge">{{ q.points }}</span>
                  </div>
                  <div class="meta-item" title="Time to answer in seconds">
                    <span class="meta-label">Time:</span>
                    <span class="meta-badge">{{ q.answerSeconds }}s</span>
                  </div>
                  @if (q.difficulty) {
                    <div class="meta-item" title="Difficulty level">
                      <span class="meta-label">Difficulty:</span>
                      <span class="meta-badge difficulty-{{ q.difficulty.toLowerCase() }}">{{ q.difficulty }}</span>
                    </div>
                  }
                  @if ((q.categories || []).length > 0) {
                    @for (category of q.categories || []; track category.id) {
                      <div class="meta-item" title="Question category">
                        <span class="meta-label">Category:</span>
                        <span class="meta-badge category-badge">{{ category.name }}</span>
                      </div>
                    }
                  } @else if (q.categoryName) {
                    <div class="meta-item" title="Question category">
                      <span class="meta-label">Category:</span>
                      <span class="meta-badge category-badge">{{ q.categoryName }}</span>
                    </div>
                  }
                  @if (q.quizTitle) {
                    <div class="meta-item" title="Assigned to this test">
                      <span class="meta-label">Test:</span>
                      <span class="meta-badge linked-badge">{{ q.quizTitle }}</span>
                    </div>
                  }
                  @if (q.quizId && !q.quizTitle) {
                    <div class="meta-item" title="Question is linked to a test">
                      <span class="meta-label">Status:</span>
                      <span class="meta-badge linked-badge">Linked</span>
                    </div>
                  }
                  @if (q.isOwnedByQuiz) {
                    <div class="meta-item" title="Question belongs to a test and cannot be moved">
                      <span class="meta-label">Ownership:</span>
                      <span class="meta-badge owned-badge">Test Owned</span>
                    </div>
                  }
                </div>
              </div>
              
              <div class="row-actions" (click)="$event.stopPropagation()">
                <a [routerLink]="['/questions', q.id, 'edit']"><button type="button" class="secondary btn-sm">Edit</button></a>
                <button type="button" class="secondary btn-sm" (click)="assignQuestion(q)">Assign</button>
                <button type="button" class="secondary btn-sm btn-danger" (click)="deleteQuestion(q)">Delete</button>
              </div>
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

    @if (showCategoryManager) {
      <div class="modal-overlay" (click)="closeCategoryManager()">
        <div class="modal-content category-manager-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Manage Categories</h3>
              <p class="category-manager-hint">Create a category or remove one from the question bank.</p>
            </div>
            <button type="button" class="close-btn" (click)="closeCategoryManager()">&times;</button>
          </div>

          <div class="category-create-row">
            <input
              type="text"
              [(ngModel)]="newCategoryName"
              placeholder="New category name"
              maxlength="100"
              [disabled]="categorySaving"
              (keydown.enter)="createCategory()" />
            <button type="button" (click)="createCategory()" [disabled]="categorySaving || !newCategoryName.trim()">
              {{ categorySaving ? 'Adding...' : 'Add' }}
            </button>
          </div>

          <div class="category-manager-list">
            @for (category of categories; track category.id) {
              <div class="category-manager-item">
                <div>
                  <strong>{{ category.name }}</strong>
                  <small>{{ category.questionsCount || 0 }} question(s)</small>
                </div>
                <button
                  type="button"
                  class="secondary btn-danger btn-sm"
                  (click)="deleteCategory(category)"
                  [disabled]="deletingCategoryId === category.id">
                  {{ deletingCategoryId === category.id ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            } @empty {
              <p class="category-manager-empty">No categories yet. Add the first one above.</p>
            }
          </div>
        </div>
      </div>
    }

    @if (showAssignModal) {
      <div class="modal-overlay" (click)="closeAssignModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Assign Questions to Test</h3>
            <button type="button" class="close-btn" (click)="closeAssignModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="selected-info">
              <span class="count-badge">{{ selectedQuestions.size }}</span> question(s) selected
            </div>

            <div class="field">
              <label for="assign-quiz">Select Test</label>
              <select id="assign-quiz" [(ngModel)]="selectedQuizId">
                <option [ngValue]="0">Choose a test...</option>
                @for (quiz of availableQuizzes; track quiz.id) {
                  <option [ngValue]="quiz.id">{{ quiz.title }}</option>
                }
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeAssignModal()">Cancel</button>
            <button type="button" [disabled]="selectedQuestions.size === 0 || selectedQuizId === 0" (click)="assignSelectedToQuiz()">
              Assign
            </button>
          </div>
        </div>
      </div>
    }

    @if (showBulkSettingsModal) {
      <div class="modal-overlay" (click)="closeBulkSettings()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ bulkSettingsMode === 'points' ? 'Edit points' : 'Edit duration' }}</h3>
            <button type="button" class="close-btn" (click)="closeBulkSettings()">×</button>
          </div>
          <div class="modal-body">
            <p>This value will be applied to {{ selectedQuestions.size }} selected question(s).</p>
            <div class="field">
              <label for="bulk-settings-value">
                {{ bulkSettingsMode === 'points' ? 'Points' : 'Answer time (seconds)' }}
              </label>
              <input
                id="bulk-settings-value"
                type="number"
                [(ngModel)]="bulkSettingsValue"
                [min]="bulkSettingsMode === 'points' ? 1 : 0"
                [max]="bulkSettingsMode === 'points' ? null : 300" />
              @if (bulkSettingsMode === 'duration') {
                <small>Use 0 for unlimited time; otherwise enter 5–300 seconds.</small>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeBulkSettings()" [disabled]="bulkSettingsSaving">Cancel</button>
            <button type="button" (click)="applyBulkSettings()" [disabled]="bulkSettingsSaving">
              {{ bulkSettingsSaving ? 'Applying...' : 'Apply' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .question-bank-page {
      display: grid;
      gap: 20px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-header h2 { margin: 0; }
    .header-desc { margin: 4px 0 0; color: var(--muted); }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .header-actions a { text-decoration: none; }

    .filter-bar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-icon-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
    }

    .filter-icon-btn:hover {
      background: var(--accent-hover-bg);
      border-color: var(--accent-hover-border);
      color: var(--accent-hover-text);
    }

    .clear-filters-btn {
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface-soft);
      color: var(--muted);
      font-size: 0.85rem;
      cursor: pointer;
    }

    .clear-filters-btn:hover {
      color: var(--accent-wine);
      border-color: var(--accent-hover-border);
      background: var(--accent-hover-bg);
    }

    .filter-popup-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--overlay-bg);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 1000;
      padding: 60px 16px 16px;
      backdrop-filter: blur(4px);
    }

    .filter-popup {
      background: var(--dialog-panel-bg);
      border: 1px solid var(--dialog-panel-border);
      border-radius: 16px;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--dialog-panel-shadow);
      overflow: hidden;
    }

    .filter-popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .filter-popup-header h4 {
      margin: 0;
      font-size: 1rem;
    }

    .close-filter-btn {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      color: var(--muted);
      padding: 4px 8px;
      border-radius: 6px;
    }

    .close-filter-btn:hover {
      background: var(--accent-hover-bg);
      color: var(--accent-wine);
    }

    .filter-popup-body {
      display: grid;
      gap: 14px;
      padding: 20px;
    }

    .filter-popup-body .field {
      display: grid;
      gap: 6px;
    }

    .filter-popup-body label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .filter-popup-body select, 
    .filter-popup-body input {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--input-bg);
      font-size: 0.9rem;
      width: 100%;
    }

    .filter-popup-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--border);
    }

    .search-field { flex: 1; min-width: 180px; }
    .field { display: grid; gap: 6px; }
    .field select, .field input {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      min-height: 42px;
      font-size: 0.9rem;
    }

    .loading-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--muted);
    }

    .empty-state {
      text-align: center;
      padding: 48px 20px;
      border: 2px dashed var(--border);
      border-radius: 16px;
      background: var(--surface-soft);
    }

    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 400px;
    }

.question-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
    }

    .question-row:hover {
      border-color: var(--accent-hover-border);
      background: var(--accent-hover-bg);
      box-shadow: 0 16px 28px -24px var(--accent-wine-glow);
    }

    .question-row.selected {
      border-color: var(--accent-selected-border);
      background: var(--accent-selected-bg);
      box-shadow: 0 0 0 1px var(--accent-wine-soft) inset, 0 20px 34px -28px var(--accent-wine-glow);
    }

    .row-select {
      padding-top: 2px;
    }

    .row-select input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--accent-wine);
    }

    .row-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .row-main {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .row-title {
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--text);
    }

    .row-text {
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .row-choices {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .choice-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 0.8rem;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      color: var(--muted);
    }

    .choice-chip.correct {
      background: var(--success-tint);
      border-color: var(--success-border);
      color: var(--success);
    }

    .choice-icon {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      object-fit: cover;
    }

    .check-icon {
      font-weight: 700;
      margin-left: 2px;
    }

    .row-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-label {
      font-size: 0.72rem;
      color: var(--muted);
      font-weight: 600;
    }

    .meta-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 0.72rem;
      font-weight: 600;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    .type-badge {
      background: var(--primary-tint);
      border-color: var(--primary-border);
      color: var(--primary);
    }

    .linked-badge {
      background: var(--info-tint);
      border-color: var(--info-border);
      color: var(--info);
    }

    .owned-badge {
      background: var(--warning-tint);
      border-color: var(--warning-border);
      color: var(--warning);
    }

    .difficulty-easy {
      background: var(--success-tint);
      border-color: var(--success-border);
      color: var(--success);
    }

    .difficulty-medium {
      background: var(--warning-tint);
      border-color: var(--warning-border);
      color: var(--warning);
    }

    .difficulty-hard {
      background: var(--danger-tint);
      border-color: var(--danger-border);
      color: var(--danger);
    }

    .category-badge {
      background: var(--primary-tint);
      border-color: var(--primary-border);
      color: var(--primary);
    }

    .row-actions {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .btn-sm {
      padding: 6px 10px;
      font-size: 0.78rem;
      min-height: 32px;
    }

    .btn-danger:hover {
      border-color: var(--danger-border);
      color: var(--danger);
    }

    .bulk-actions-stack {
      display: grid;
      gap: 12px;
    }

    .bulk-actions-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      border-radius: 12px;
      background: var(--accent-selected-bg);
      border: 1px solid var(--accent-hover-border);
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .selection-count {
      font-weight: 600;
      color: var(--text);
      margin-right: auto;
      white-space: nowrap;
    }

    .clear-selection-btn {
      padding: 8px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.85rem;
      cursor: pointer;
    }

    .clear-selection-btn:hover {
      background: var(--accent-hover-bg);
      border-color: var(--accent-hover-border);
      color: var(--accent-wine);
    }

    .bulk-dropdown-container {
      position: relative;
    }

    .bulk-dropdown-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: 1px solid var(--border);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
      background: var(--accent-wine);
      color: var(--primary-contrast);
      border-color: var(--accent-wine);
      border-radius: 10px;
    }

    .bulk-dropdown-toggle:hover {
      background: var(--primary-hover);
    }

    .bulk-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 200px;
      background: var(--dialog-panel-bg);
      border: 1px solid var(--dialog-panel-border);
      border-radius: 12px;
      box-shadow: var(--dialog-panel-shadow);
      z-index: 100;
      overflow: hidden;
    }

    .bulk-dropdown-menu button {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 16px;
      border: none;
      background: transparent;
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
      text-align: left;
      border-radius: 0;
    }

    .bulk-dropdown-menu button:hover {
      background: var(--accent-hover-bg);
      color: var(--accent-hover-text);
    }

    .bulk-dropdown-menu button.danger {
      color: var(--danger);
    }

    .bulk-dropdown-menu button.danger:hover {
      background: var(--danger-tint);
    }

    .bulk-category-panel {
      display: grid;
      gap: 14px;
      padding: 16px 18px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }

    .bulk-category-panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .bulk-category-panel-header strong {
      display: block;
      margin-bottom: 4px;
    }

    .bulk-category-panel-header p {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .bulk-add-category-stack {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .bulk-categories-field-label {
      font-size: var(--font-size-label, 0.85rem);
      font-weight: 700;
      color: var(--muted-strong);
    }

    .bulk-panel-category-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 10px;
      min-width: 0;
    }

    .bulk-panel-category-input-group {
      display: flex;
      flex: 1 1 220px;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .bulk-panel-category-input-group input[type="text"] {
      flex: 1 1 auto;
      min-width: 0;
      width: auto !important;
      max-width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      min-height: 44px;
      font-size: 0.95rem;
    }

    .bulk-panel-add-btn {
      flex-shrink: 0;
      padding: 8px 14px;
      font-size: 0.85rem;
      min-height: 44px;
    }

    .bulk-panel-show-existing-btn {
      flex: 1 1 200px;
      min-height: 44px;
      white-space: normal;
      text-align: center;
      line-height: 1.25;
    }

    .bulk-panel-picked-chips,
    .bulk-panel-suggestion-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .bulk-panel-existing-section {
      display: grid;
      gap: 6px;
      margin-top: 4px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }

    .bulk-panel-existing-label {
      font-size: 0.8rem;
      color: var(--muted);
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

    .chip-remove {
      font-size: 1rem;
      line-height: 1;
      opacity: 0.85;
    }

    .bulk-category-actions-row {
      justify-content: flex-end;
      margin-top: 4px;
    }

    .bulk-remove-category-stack {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .bulk-remove-all-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .bulk-remove-all-toggle {
      flex: 1 1 auto;
      min-height: 44px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      line-height: 1.3;
    }

    .bulk-remove-all-toggle:hover {
      border-color: var(--danger-border);
      background: var(--danger-tint);
      color: var(--danger);
    }

    .bulk-remove-all-active {
      border-color: var(--danger-border);
      background: var(--danger-tint);
      color: var(--danger);
    }

    .bulk-remove-all-warning {
      margin: 0;
      font-size: 0.88rem;
      color: var(--warning);
      line-height: 1.45;
    }

    .bulk-remove-picks-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .bulk-remove-pick-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
      padding: 2px 0;
    }

    .bulk-remove-pick-chip {
      font-weight: 600;
    }

    .bulk-remove-empty {
      margin: 0;
      font-size: 0.88rem;
      color: var(--muted);
    }

    .bulk-category-form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      align-items: stretch;
      min-width: 0;
    }

    .bulk-category-input-field {
      min-width: 0;
    }

    .bulk-category-actions-only {
      justify-content: flex-end;
    }

    .bulk-category-panel .bulk-category-input-field input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--input-bg);
      font-size: 0.9rem;
    }

    .bulk-category-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bulk-category-suggestions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .bulk-category-chip {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-soft);
      color: var(--text);
      font-size: 0.85rem;
      cursor: pointer;
    }

    .bulk-category-chip:hover {
      border-color: var(--accent-hover-border);
      background: var(--accent-hover-bg);
      color: var(--accent-wine);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .page-info {
      color: var(--muted);
      font-size: 0.9rem;
    }

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
      max-width: 440px;
      box-shadow: var(--dialog-panel-shadow);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-header h3 { margin: 0; font-size: 1.1rem; }
    .category-manager-modal { max-width: 560px; }
    .category-manager-hint { margin: 4px 0 0; color: var(--muted); font-size: 0.85rem; }
    .category-create-row { display: flex; gap: 8px; margin-bottom: 18px; }
    .category-create-row input {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--input-bg);
      color: var(--text);
    }
    .category-manager-list {
      display: grid;
      gap: 8px;
      max-height: min(430px, 55vh);
      overflow-y: auto;
    }
    .category-manager-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface-soft);
    }
    .category-manager-item > div { display: grid; gap: 3px; min-width: 0; }
    .category-manager-item strong { overflow-wrap: anywhere; }
    .category-manager-item small { color: var(--muted); }
    .category-manager-empty { margin: 10px 0; text-align: center; color: var(--muted); }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.4rem;
      cursor: pointer;
      color: var(--muted);
      padding: 4px 8px;
      border-radius: 8px;
    }
    .close-btn:hover {
      background: var(--surface-soft);
      color: var(--text);
    }

    .modal-body { display: grid; gap: 14px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

    .selected-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--accent-selected-bg);
      border: 1px solid var(--accent-hover-border);
      border-radius: 10px;
      font-weight: 600;
      color: var(--accent-wine);
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--accent-wine);
      color: white;
      font-size: 0.85rem;
    }

    @media (max-width: 900px) {
      .question-row {
        flex-direction: column;
        gap: 12px;
      }
      .row-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }

    @media (max-width: 600px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
      }
      .header-actions {
        flex-direction: column;
      }
      .row-actions {
        flex-wrap: wrap;
      }
      .row-title {
        font-size: 0.9rem;
      }
      .row-text {
        font-size: 0.82rem;
      }
      .bulk-actions-bar {
        gap: 8px;
        padding: 10px 12px;
      }
      .bulk-category-panel {
        padding: 14px 12px;
      }
      .bulk-category-form {
        grid-template-columns: 1fr;
      }
      .bulk-panel-category-toolbar {
        flex-direction: column;
      }
      .bulk-panel-show-existing-btn {
        flex: 1 1 auto;
      }
    }
  `]
})
export class QuestionBankComponent implements OnInit {
  questions: any[] = [];
  categories: any[] = [];
  loading = false;
  importing = false;
  error = '';
  searchTerm = '';
  typeFilter = 0;
  modeFilter = 0;
  categoryFilter = 0;
  page = 1;
  pageSize = 10;
  totalPages = 1;
  totalQuestions = 0;
  exportingPdf = false;

  selectedQuestions = new Set<number>();
  allSelected = false;
  showAssignModal = false;
  showCategoryManager = false;
  newCategoryName = '';
  categorySaving = false;
  deletingCategoryId: number | null = null;
  selectedQuizId = 0;
  availableQuizzes: any[] = [];

  showBulkDropdown = false;
  showBulkCategoryPanel = false;
  showFilterPopup = false;
  tempSearchTerm = '';
  tempTypeFilter = 0;
  tempModeFilter = 0;
  tempCategoryFilter = 0;
  bulkCategorySaving = false;
  bulkCategoryPanelMode: 'add' | 'remove' = 'add';
  bulkPanelPicked: QuestionCategory[] = [];
  bulkPanelInput = '';
  bulkPanelShowExisting = false;
  bulkRemoveAllMode = false;
  bulkRemoveSelectedIds = new Set<number>();
  showBulkSettingsModal = false;
  bulkSettingsMode: 'points' | 'duration' = 'points';
  bulkSettingsValue: number | null = null;
  bulkSettingsSaving = false;

  constructor(
    private questionService: QuestionService,
    private quizService: QuizService,
    private categoryService: QuestionCategoryService,
    private router: Router,
    private toast: ToastService,
    private pdfExport: QuestionPdfExportService
  ) {}

  ngOnInit(): void {
    this.loadQuestions();
    this.loadAvailableQuizzes();
    this.loadCategories();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.bulk-dropdown-container')) {
      this.showBulkDropdown = false;
    }
    if (!target.closest('.bulk-category-panel') && !target.closest('.open-bulk-category-btn')) {
      this.showBulkCategoryPanel = false;
    }
    if (!target.closest('.filter-popup-container') && !target.closest('.filter-icon-btn')) {
      this.showFilterPopup = false;
    }
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (cats) => this.categories = cats,
      error: () => {}
    });
  }

  openCategoryManager(): void {
    this.newCategoryName = '';
    this.showCategoryManager = true;
    this.loadCategories();
  }

  closeCategoryManager(): void {
    if (this.categorySaving || this.deletingCategoryId !== null) return;
    this.showCategoryManager = false;
    this.newCategoryName = '';
  }

  createCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name || this.categorySaving) return;

    if (this.categories.some((category) => category.name.trim().toLowerCase() === name.toLowerCase())) {
      this.toast.show('This category already exists', 'error');
      return;
    }

    this.categorySaving = true;
    this.categoryService.create({ name }).subscribe({
      next: (category) => {
        this.categorySaving = false;
        this.newCategoryName = '';
        this.categories = [...this.categories, category].sort((a, b) => a.name.localeCompare(b.name));
        this.toast.show('Category added successfully', 'success');
      },
      error: (err) => {
        this.categorySaving = false;
        this.toast.show(err?.error?.message || 'Failed to add category', 'error');
      }
    });
  }

  deleteCategory(category: QuestionCategory): void {
    if (this.deletingCategoryId !== null) return;

    const usage = category.questionsCount || 0;
    const warning = usage > 0
      ? `Delete "${category.name}"? It will be removed from ${usage} question(s).`
      : `Delete "${category.name}"?`;
    if (!confirm(warning)) return;

    this.deletingCategoryId = category.id;
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.deletingCategoryId = null;
        this.categories = this.categories.filter((item) => item.id !== category.id);
        this.bulkPanelPicked = this.bulkPanelPicked.filter((item) => item.id !== category.id);
        this.bulkRemoveSelectedIds.delete(category.id);
        if (this.categoryFilter === category.id || this.tempCategoryFilter === category.id) {
          this.categoryFilter = 0;
          this.tempCategoryFilter = 0;
        }
        this.loadQuestions();
        this.toast.show('Category deleted successfully', 'success');
      },
      error: (err) => {
        this.deletingCategoryId = null;
        this.toast.show(err?.error?.message || 'Failed to delete category', 'error');
      }
    });
  }

  loadQuestions(): void {
    this.loading = true;
    this.error = '';

    const params: any = {
      pageNumber: this.page,
      pageSize: this.pageSize
    };
    if (this.searchTerm) params.search = this.searchTerm;
    if (this.typeFilter) params.type = this.typeFilter;
    if (this.modeFilter) params.selectionMode = this.modeFilter;
    if (this.categoryFilter) params.categoryId = this.categoryFilter;

    this.questionService.getAll(params).subscribe({
      next: (res: PagedResult<Question>) => {
        this.loading = false;
        this.questions = res.items;
        this.totalQuestions = res.totalCount;
        this.totalPages = Math.max(1, Math.ceil(res.totalCount / this.pageSize));
        if (this.page > this.totalPages && res.totalCount > 0) {
          this.page = this.totalPages;
          this.loadQuestions();
          return;
        }
        this.updateAllSelected();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load questions';
      }
    });
  }

  loadAvailableQuizzes(): void {
    this.quizService.getAll({ mode: 1, pageNumber: 1, pageSize: 200 }).subscribe({
      next: (res: any) => {
        this.availableQuizzes = res.items || [];
      }
    });
  }

  toggleQuestion(id: number): void {
    if (this.selectedQuestions.has(id)) {
      this.selectedQuestions.delete(id);
    } else {
      this.selectedQuestions.add(id);
    }

    this.updateAllSelected();
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.questions.forEach((question) => this.selectedQuestions.delete(question.id));
    } else {
      this.questions.forEach((question) => this.selectedQuestions.add(question.id));
    }

    this.updateAllSelected();
  }

  assignQuestion(question: Question): void {
    this.selectedQuestions.clear();
    this.selectedQuestions.add(question.id);
    this.updateAllSelected();
    this.showAssignModal = true;
  }

  toggleBulkDropdown(): void {
    this.showBulkDropdown = !this.showBulkDropdown;
    if (this.showBulkDropdown) {
      this.showBulkCategoryPanel = false;
    }
  }

  closeBulkDropdown(): void {
    this.showBulkDropdown = false;
  }

  openBulkCategoryPanel(mode: 'add' | 'remove' = 'add'): void {
    this.bulkCategoryPanelMode = mode;
    this.bulkPanelPicked = [];
    this.bulkPanelInput = '';
    this.bulkPanelShowExisting = false;
    this.bulkRemoveAllMode = false;
    this.bulkRemoveSelectedIds = new Set();
    this.showBulkCategoryPanel = true;
  }

  closeBulkCategoryPanel(): void {
    this.showBulkCategoryPanel = false;
    this.bulkCategorySaving = false;
    this.bulkPanelPicked = [];
    this.bulkPanelInput = '';
    this.bulkPanelShowExisting = false;
    this.bulkRemoveAllMode = false;
    this.bulkRemoveSelectedIds = new Set();
  }

  toggleBulkRemoveAllMode(): void {
    this.bulkRemoveAllMode = !this.bulkRemoveAllMode;
    if (this.bulkRemoveAllMode) {
      this.bulkRemoveSelectedIds = new Set();
    }
  }

  toggleBulkRemoveCategoryId(categoryId: number): void {
    if (this.bulkRemoveAllMode) {
      return;
    }
    if (this.bulkRemoveSelectedIds.has(categoryId)) {
      this.bulkRemoveSelectedIds.delete(categoryId);
    } else {
      this.bulkRemoveSelectedIds.add(categoryId);
    }
    this.bulkRemoveSelectedIds = new Set(this.bulkRemoveSelectedIds);
  }

  executeBulkRemove(): void {
    const ids = Array.from(this.selectedQuestions);
    if (ids.length === 0) {
      return;
    }

    if (this.bulkRemoveAllMode) {
      if (!confirm('Remove all categories from the selected questions?')) {
        return;
      }

      this.bulkCategorySaving = true;
      this.questionService.bulkRemoveCategory(ids, null).subscribe({
        next: (res) => {
          this.bulkCategorySaving = false;
          this.loadCategories();
          this.toast.show(res?.message || 'Categories removed successfully', 'success');
          this.clearSelection();
          this.loadQuestions();
        },
        error: (err) => {
          this.bulkCategorySaving = false;
          this.toast.show(err?.error?.message || 'Failed to remove categories', 'error');
        }
      });
      return;
    }

    const names = Array.from(this.bulkRemoveSelectedIds)
      .map((cid) => this.categories.find((c) => Number(c?.id) === Number(cid))?.name)
      .filter((n): n is string => !!String(n ?? '').trim());

    if (names.length === 0) {
      this.toast.show('Select at least one category', 'error');
      return;
    }

    this.bulkCategorySaving = true;
    from(names)
      .pipe(concatMap((name) => this.questionService.bulkRemoveCategory(ids, name)))
      .subscribe({
        next: () => {},
        complete: () => {
          this.bulkCategorySaving = false;
          this.loadCategories();
          this.toast.show(
            names.length > 1 ? `Removed ${names.length} categories` : 'Category removed successfully',
            'success'
          );
          this.clearSelection();
          this.loadQuestions();
        },
        error: (err) => {
          this.bulkCategorySaving = false;
          this.toast.show(err?.error?.message || 'Failed to remove category', 'error');
        }
      });
  }

  trackBulkPanelPicked(index: number, cat: QuestionCategory): string {
    return `${cat.id}-${cat.name}-${index}`;
  }

  get bulkPanelSuggestedCategories(): QuestionCategory[] {
    return this.categories.filter(
      (c) =>
        !this.bulkPanelPicked.some(
          (p) =>
            (p.id > 0 && p.id === c.id) ||
            p.name.trim().toLowerCase() === c.name.trim().toLowerCase()
        )
    );
  }

  toggleBulkPanelShowExisting(): void {
    this.bulkPanelShowExisting = !this.bulkPanelShowExisting;
  }

  addBulkPanelCategoryFromInput(event?: Event): void {
    event?.preventDefault();
    const value = String(this.bulkPanelInput || '').trim();
    if (!value) {
      return;
    }

    const existing = this.categories.find((c) => c.name.trim().toLowerCase() === value.toLowerCase());
    if (existing) {
      this.addToBulkPanelPicked(existing);
    } else {
      const stub: QuestionCategory = {
        id: 0,
        name: value,
        description: '',
        color: 0,
        questionsCount: 0
      };
      this.addToBulkPanelPicked(stub);
    }

    this.bulkPanelInput = '';
  }

  handleBulkPanelCategorySeparators(event: KeyboardEvent): void {
    if (event.key === ',') {
      event.preventDefault();
      this.addBulkPanelCategoryFromInput();
    }
  }

  addBulkPanelCategoryOnBlur(): void {
    const value = String(this.bulkPanelInput || '').trim();
    if (!value) {
      return;
    }
    this.addBulkPanelCategoryFromInput();
  }

  selectBulkPanelCategory(cat: QuestionCategory): void {
    this.addToBulkPanelPicked(cat);
    this.bulkPanelInput = '';
  }

  removeBulkPanelCategory(cat: QuestionCategory): void {
    this.bulkPanelPicked = this.bulkPanelPicked.filter(
      (p) =>
        !(
          p.id === cat.id &&
          p.name.trim().toLowerCase() === cat.name.trim().toLowerCase()
        )
    );
  }

  private addToBulkPanelPicked(cat: QuestionCategory): void {
    if (
      this.bulkPanelPicked.some(
        (p) =>
          (p.id > 0 && p.id === cat.id) ||
          p.name.trim().toLowerCase() === cat.name.trim().toLowerCase()
      )
    ) {
      return;
    }
    this.bulkPanelPicked = [...this.bulkPanelPicked, cat];
  }

  private collectBulkAddCategoryNames(): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const cat of this.bulkPanelPicked) {
      const name = String(cat?.name ?? '').trim();
      if (!name) {
        continue;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(name);
    }
    return ordered;
  }

  toggleFilterPopup(): void {
    if (!this.showFilterPopup) {
      this.tempSearchTerm = this.searchTerm;
      this.tempTypeFilter = this.typeFilter;
      this.tempModeFilter = this.modeFilter;
      this.tempCategoryFilter = this.categoryFilter;
    }
    this.showFilterPopup = !this.showFilterPopup;
  }

  closeFilterPopup(): void {
    this.showFilterPopup = false;
  }

  applyFilters(): void {
    this.searchTerm = this.tempSearchTerm;
    this.typeFilter = this.tempTypeFilter;
    this.modeFilter = this.tempModeFilter;
    this.categoryFilter = this.tempCategoryFilter;
    this.page = 1;
    this.closeFilterPopup();
    this.loadQuestions();
  }

  cancelFilters(): void {
    this.closeFilterPopup();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.typeFilter = 0;
    this.modeFilter = 0;
    this.categoryFilter = 0;
    this.tempSearchTerm = '';
    this.tempTypeFilter = 0;
    this.tempModeFilter = 0;
    this.tempCategoryFilter = 0;
    this.page = 1;
    this.loadQuestions();
  }

  closeAllDropdowns(): void {
    this.showBulkDropdown = false;
    this.showBulkCategoryPanel = false;
  }

  assignSelectedToQuiz(): void {
    if (this.selectedQuestions.size === 0 || this.selectedQuizId === 0) return;

    const questionIds = Array.from(this.selectedQuestions);
    const items = questionIds.map((qId, index) => ({
      questionId: qId,
      order: index + 1,
      pointsOverride: null,
      answerSeconds: null
    }));

    this.quizService.addQuestions(this.selectedQuizId, items).subscribe({
      next: () => {
        this.closeAssignModal();
        this.loadQuestions();
        this.toast.success('Questions assigned successfully');
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to assign questions';
      }
    });
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.selectedQuizId = 0;
    this.selectedQuestions.clear();
    this.updateAllSelected();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    this.loadQuestions();
  }

  onPageSizeChange(pageSize: number): void {
    if (pageSize === this.pageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.page = 1;
    this.loadQuestions();
  }

  getTypeName(type: number): string {
    const types: Record<number, string> = { 1: 'Multiple Choice', 2: 'True/False', 3: 'Short Answer' };
    return types[type] || 'Unknown';
  }

  async exportBankPdfSelected(): Promise<void> {
    if (!this.selectedQuestions.size || this.exportingPdf) return;
    this.exportingPdf = true;
    try {
      const ids = Array.from(this.selectedQuestions);
      const loaded: Question[] = [];
      for (const id of ids) {
        let q = this.questions.find((x) => x.id === id);
        if (!q) {
          q = await firstValueFrom(this.questionService.getById(id));
        }
        loaded.push(q);
      }
      await this.pdfExport.exportQuestionsDetailPdf(
        `Selected questions (${loaded.length})`,
        this.pdfExport.slug(`questions_selected_${loaded.length}`, 'questions'),
        loaded
      );
      this.toast.success('PDF downloaded');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'PDF export failed';
      this.toast.error(msg);
    } finally {
      this.exportingPdf = false;
    }
  }

  getFullQuestionText(text: string): string {
    return String(text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }

  get selectedQuestionsOnPageCount(): number {
    return this.questions.filter((question) => this.selectedQuestions.has(question.id)).length;
  }

  updateAllSelected(): void {
    this.allSelected = this.questions.length > 0 && this.questions.every((question) => this.selectedQuestions.has(question.id));

    if (this.selectedQuestions.size === 0) {
      this.closeBulkDropdown();
      this.closeBulkCategoryPanel();
    }
  }

  deleteQuestion(question: any): void {
    if (confirm(`Delete question "${question.title}"?`)) {
      this.questionService.delete(question.id).subscribe({
        next: () => {
          this.questions = this.questions.filter(q => q.id !== question.id);
          this.selectedQuestions.delete(question.id);
          this.updateAllSelected();
          this.toast.success('Question deleted');
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Failed to delete question');
        }
      });
    }
  }

  clearSelection(): void {
    this.selectedQuestions.clear();
    this.allSelected = false;
    this.closeBulkDropdown();
    this.closeBulkCategoryPanel();
    this.closeBulkSettings();
  }

  bulkDelete(): void {
    if (!confirm(`Delete ${this.selectedQuestions.size} questions?`)) return;
    const ids = Array.from(this.selectedQuestions);
    this.questionService.bulkDelete(ids).subscribe({
      next: () => {
        this.toast.show(`${ids.length} questions deleted`, 'success');
        this.clearSelection();
        this.loadQuestions();
      },
      error: (err) => this.toast.show(err?.error?.message || 'Bulk delete failed', 'error')
    });
  }

  bulkDuplicate(): void {
    const ids = Array.from(this.selectedQuestions);
    let completed = 0;
    ids.forEach(id => {
      this.questionService.duplicate(id).subscribe({ next: () => completed++, error: () => completed++ });
    });
    const checkInterval = setInterval(() => { 
      if (completed >= ids.length) { 
        clearInterval(checkInterval); 
        this.toast.show(`${ids.length} questions duplicated`, 'success'); 
        this.clearSelection(); 
        this.loadQuestions(); 
      } 
    }, 500);
  }

  bulkAddCategory(event?: Event): void {
    event?.preventDefault();

    const ids = Array.from(this.selectedQuestions);
    const names = this.collectBulkAddCategoryNames();

    if (names.length === 0) {
      this.toast.show('Add at least one category (type a name or pick from existing)', 'error');
      return;
    }

    if (ids.length === 0) {
      return;
    }

    this.bulkCategorySaving = true;
    from(names)
      .pipe(concatMap((name) => this.questionService.bulkAddCategory(ids, name)))
      .subscribe({
        next: () => {},
        complete: () => {
          this.bulkCategorySaving = false;
          this.loadCategories();
          this.toast.show(
            names.length > 1 ? `Applied ${names.length} categories` : 'Category added successfully',
            'success'
          );
          this.clearSelection();
          this.loadQuestions();
        },
        error: (err) => {
          this.bulkCategorySaving = false;
          this.toast.show(err?.error?.message || 'Failed to add category', 'error');
        }
      });
  }

  openBulkSettings(mode: 'points' | 'duration'): void {
    this.bulkSettingsMode = mode;
    this.bulkSettingsValue = mode === 'points' ? 1 : 30;
    this.showBulkSettingsModal = true;
    this.error = '';
  }

  closeBulkSettings(): void {
    if (this.bulkSettingsSaving) {
      return;
    }

    this.showBulkSettingsModal = false;
    this.bulkSettingsValue = null;
  }

  applyBulkSettings(): void {
    const ids = Array.from(this.selectedQuestions);
    const value = Number(this.bulkSettingsValue);
    if (ids.length === 0) {
      this.closeBulkSettings();
      return;
    }

    if (!Number.isInteger(value)) {
      this.toast.error('Enter a whole number.');
      return;
    }

    if (this.bulkSettingsMode === 'points' && value <= 0) {
      this.toast.error('Points must be greater than 0.');
      return;
    }

    if (this.bulkSettingsMode === 'duration' && value !== 0 && (value < 5 || value > 300)) {
      this.toast.error('Duration must be 0 (unlimited) or between 5 and 300 seconds.');
      return;
    }

    const settings = this.bulkSettingsMode === 'points'
      ? { points: value }
      : { answerSeconds: value };

    this.bulkSettingsSaving = true;
    this.questionService.bulkUpdateSettings(ids, settings).subscribe({
      next: (result) => {
        this.bulkSettingsSaving = false;
        this.showBulkSettingsModal = false;
        this.bulkSettingsValue = null;
        this.toast.success(result?.message || `Updated ${ids.length} questions`);
        this.clearSelection();
        this.loadQuestions();
      },
      error: (err) => {
        this.bulkSettingsSaving = false;
        this.toast.error(err?.error?.message || 'Failed to update questions');
      }
    });
  }

  bulkExport(): void {
    const ids = Array.from(this.selectedQuestions);
    this.questionService.bulkExportQuestions(ids).subscribe({
      next: () => this.toast.show(`${ids.length} questions exported`, 'success'),
      error: () => this.toast.show('Export failed', 'error')
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.importing = true;
    this.questionService.importExcel(file).subscribe({
      next: (res) => {
        this.importing = false;
        input.value = '';
        this.loadCategories();
        this.page = 1;
        this.loadQuestions();
        this.toast.show(res?.message || 'Questions imported successfully', 'success');
      },
      error: (err) => {
        this.importing = false;
        input.value = '';
        this.toast.show(err?.error?.message || 'Import failed', 'error');
      }
    });
  }
}
