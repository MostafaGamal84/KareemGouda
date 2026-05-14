import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';
import { PdfQuizQuestionBlock, QuestionPdfExportService } from '../../core/services/question-pdf-export.service';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PaginationControlsComponent],
  template: `
    <div class="card list-shell">
      <div class="list-head">
        <div>
          <p class="eyebrow">Test Library</p>
          <h2>Tests</h2>
        </div>
        <div class="head-actions">
          <label class="import-btn">
            <input type="file" accept=".xlsx,.xls" (change)="onFileSelected($event)" hidden />
            <span>Import Excel</span>
          </label>
          <a routerLink="/quizzes/new"><button type="button">New Test</button></a>
        </div>
      </div>

      <div class="filter-bar">
        <button type="button" class="filter-icon-btn" (click)="toggleFilterPopup(); $event.stopPropagation()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>Filters</span>
        </button>
        @if (search || category || published !== null) {
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
                <input type="text" [(ngModel)]="tempSearch" placeholder="Search title or description" />
              </div>
              <div class="field">
                <label>Category</label>
                <input type="text" [(ngModel)]="tempCategory" placeholder="Unit 1" />
              </div>
              <div class="field">
                <label>Status</label>
                <select [(ngModel)]="tempPublished">
                  <option [ngValue]="null">All</option>
                  <option [ngValue]="true">Published</option>
                  <option [ngValue]="false">Draft</option>
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

      @if (error) { <div class="alert">{{ error }}</div> }

      @if (selectedIds.size > 0) {
        <div class="bulk-actions-stack">
          <div class="bulk-actions-bar">
            <span class="selection-count">{{ selectedIds.size }} selected</span>
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
                  <button type="button" class="open-bulk-category-btn" (click)="openBulkCategoryPanel(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9"></path>
                      <path d="M21 3v6h-6"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                    Add Category
                  </button>
                  <button type="button" class="open-bulk-category-btn" (click)="openBulkCategoryPanel(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9"></path>
                      <path d="M21 3v6h-6"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                    Remove Category
                  </button>
                  <button type="button" (click)="bulkDuplicate(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Duplicate
                  </button>
                  <button type="button" (click)="bulkExport(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export Excel
                  </button>
                  <button type="button" [disabled]="exportingPdf" (click)="bulkExportPdf(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    {{ exportingPdf ? 'PDF…' : 'Export PDF' }}
                  </button>
                  <button type="button" (click)="bulkPublish(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Publish
                  </button>
                  <button type="button" (click)="bulkUnpublish(); closeBulkDropdown()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    Unpublish
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
                  <strong>Manage categories for selected tests</strong>
                  <p>Choose an existing category or type a new one, then add or remove it.</p>
                </div>
                <button type="button" class="secondary bulk-category-close-btn" (click)="closeBulkCategoryPanel()">Close</button>
              </div>

              <div class="bulk-category-form">
                <div class="field">
                  <label for="bulk-category-input">Category name</label>
                  <input
                    id="bulk-category-input"
                    type="text"
                    [(ngModel)]="bulkCategoryInput"
                    placeholder="Unit 1"
                    list="bulk-category-options"
                    (keydown.enter)="bulkAddCategory($event)" />
                  <datalist id="bulk-category-options">
                    @for (category of bulkCategorySuggestions; track category) {
                      <option [value]="category"></option>
                    }
                  </datalist>
                </div>

                <div class="bulk-category-actions">
                  <button type="button" class="secondary" (click)="closeBulkCategoryPanel()">Cancel</button>
                  <button type="button" (click)="bulkAddCategory()" [disabled]="bulkCategorySaving">
                    {{ bulkCategorySaving ? 'Applying...' : 'Apply Category' }}
                  </button>
                  <button type="button" class="secondary" (click)="bulkRemoveCategory()" [disabled]="bulkCategorySaving">
                    {{ bulkCategorySaving ? 'Removing...' : 'Remove Category' }}
                  </button>
                </div>
              </div>

              @if (bulkCategorySuggestions.length) {
                <div class="bulk-category-suggestions">
                  @for (category of bulkCategorySuggestions; track category) {
                    <button type="button" class="bulk-category-chip" (click)="useBulkCategorySuggestion(category)">{{ category }}</button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <div class="table-wrap desktop-table">
        <table>
          <thead>
            <tr><th style="width: 40px;"><input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll()" /></th><th>Test</th><th>Categories</th><th>Questions</th><th>Marks</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            @for (quiz of items; track quiz.id) {
              <tr [class.selected-row]="selectedIds.has(quiz.id)">
                <td><input type="checkbox" [checked]="selectedIds.has(quiz.id)" (change)="toggleSelect(quiz.id)" /></td>
                <td>
                  <strong>{{ quiz.title }}</strong>
                  @if (quiz.description) {
                    <div class="cell-copy">{{ quiz.description }}</div>
                  }
                </td>
                <td>{{ categoryLabel(quiz) }}</td>
                <td>{{ quiz.questionsCount }}</td>
                <td>{{ marksLabel(quiz) }}</td>
                <td>{{ quiz.isPublished ? 'Published' : 'Draft' }}</td>
                <td class="table-actions">
                  <div class="row-actions-desktop">
                    <button type="button" class="secondary" (click)="exportQuiz(quiz.id)">Excel</button>
                    <a [routerLink]="['/quizzes', quiz.id, 'edit']"><button type="button" class="secondary">Edit</button></a>
                    @if (!isExamLive(quiz)) {
                      <button type="button" (click)="togglePublish(quiz)">{{ quiz.isPublished ? 'Unpublish' : 'Publish' }}</button>
                    }
                    <button type="button" class="danger" (click)="remove(quiz.id)">Delete</button>
                  </div>
                  <select class="row-actions-mobile" (change)="onRowActionSelected($event, quiz.id)">
                    <option value="">Actions</option>
                    <option value="export">Excel</option>
                    <option value="edit">Edit</option>
                    @if (!isExamLive(quiz)) {
                      <option value="publish">{{ quiz.isPublished ? 'Unpublish' : 'Publish' }}</option>
                    }
                    <option value="delete">Delete</option>
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mobile-list">
            @for (quiz of items; track quiz.id) {
              <article class="mobile-item" [class.selected-row]="selectedIds.has(quiz.id)">
                <div class="mobile-item-checkbox">
                  <input type="checkbox" [checked]="selectedIds.has(quiz.id)" (change)="toggleSelect(quiz.id)" />
                </div>
                <div class="mobile-head">
              <strong>{{ quiz.title }}</strong>
              <span class="mobile-pill">{{ quiz.isPublished ? 'Published' : 'Draft' }}</span>
            </div>

            @if (quiz.description) {
              <p class="mobile-copy">{{ quiz.description }}</p>
            }

            <div class="mobile-metrics">
              <div class="mobile-metric">
                <span>Categories</span>
                <strong>{{ categoryLabel(quiz) }}</strong>
              </div>
              <div class="mobile-metric">
                <span>Questions</span>
                <strong>{{ quiz.questionsCount }}</strong>
              </div>
              <div class="mobile-metric">
                <span>Marks</span>
                <strong>{{ marksLabel(quiz) }}</strong>
              </div>
            </div>

            <div class="mobile-actions">
              <button type="button" class="secondary" (click)="exportQuiz(quiz.id)">Excel</button>
              <a [routerLink]="['/quizzes', quiz.id, 'edit']"><button type="button" class="secondary">Edit</button></a>
              @if (!isExamLive(quiz)) {
                <button type="button" (click)="togglePublish(quiz)">{{ quiz.isPublished ? 'Unpublish' : 'Publish' }}</button>
              }
              <button type="button" class="danger" (click)="remove(quiz.id)">Delete</button>
            </div>
          </article>
        }
      </div>

      @if (totalCount > 0) {
        <app-pagination-controls
          [page]="page"
          [totalPages]="totalPages"
          [pageSize]="pageSize"
          (pageChange)="goToPage($event)"
          (pageSizeChange)="onPageSizeChange($event)" />
      }
    </div>
  `,
  styles: [`
    .list-shell {
      display: grid;
      gap: 14px;
    }

    .list-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .head-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .import-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
    }

    .import-btn:hover {
      background: var(--surface-soft);
    }

    .list-head h2 {
      margin: 0;
    }

    .list-head a,
    .mobile-actions a,
    .table-actions a {
      text-decoration: none;
    }

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
      background: var(--surface-soft);
      border-color: var(--border-strong);
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
      color: var(--text);
      border-color: var(--border-strong);
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
      background: var(--surface-soft);
      color: var(--text);
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

    .filters-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(160px, 220px) auto;
      gap: 10px;
      align-items: end;
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .filter-button {
      min-height: 42px;
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
      background: var(--accent-selected-bg);
      border-radius: 12px;
      border: 1px solid var(--accent-hover-border);
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

    .bulk-category-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: end;
    }

    .bulk-category-panel input {
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

    .bulk-actions-desktop {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .bulk-actions-mobile {
      display: none;
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
    }

    .row-actions-desktop {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-height: 40px;
    }

    .row-actions-mobile {
      display: none;
      min-height: 30px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 0.85rem;
      cursor: pointer;
    }

    .bulk-actions-bar button {
      min-height: 36px;
      padding: 10px 18px;
      border: 1px solid var(--border);
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
      background: var(--surface);
      color: var(--text);
    }

    .bulk-actions-bar button:hover {
      background: var(--accent-hover-bg);
      border-color: var(--accent-hover-border);
      color: var(--accent-wine);
    }

    .bulk-actions-bar button:first-of-type {
      background: var(--accent-wine);
      color: var(--primary-contrast);
      border-color: var(--accent-wine);
    }

    .bulk-actions-bar button:first-of-type:hover {
      background: var(--primary-hover);
    }

    .bulk-actions-bar button.danger {
      background: var(--danger);
      color: white;
      border-color: var(--danger);
    }

    .bulk-actions-bar button.danger:hover {
      background: #c82333;
      border-color: #c82333;
    }

    .selected-row {
      background: var(--accent-selected-bg) !important;
      box-shadow: inset 3px 0 0 var(--accent-wine);
    }

    .mobile-item-checkbox {
      margin-bottom: 8px;
    }

    .desktop-table input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--accent-wine);
    }

    .mobile-item-checkbox input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--accent-wine);
    }

    .cell-copy,
    .mobile-copy {
      margin-top: 6px;
      color: var(--muted-strong);
      line-height: 1.45;
    }

    .table-actions {
      vertical-align: middle;
    }

    .desktop-table {
      display: block;
      min-height: 400px;
    }

    .mobile-list {
      display: none;
      gap: 10px;
      min-height: 300px;
    }

    .mobile-item {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .mobile-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
    }

    .mobile-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-soft);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .mobile-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .mobile-metric {
      min-width: 0;
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .mobile-metric span {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .mobile-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .mobile-actions a,
    .mobile-actions button {
      width: 100%;
    }

    .pagination-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding-top: 4px;
    }

    .page-info {
      color: var(--muted-strong);
      font-size: 0.9rem;
      font-weight: 600;
    }

    @media (max-width: 900px) {
      .filters-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .bulk-actions-desktop {
        display: none;
      }

      .bulk-actions-mobile {
        display: inline-block;
      }

      .row-actions-desktop {
        display: none;
      }

      .row-actions-mobile {
        display: inline-block;
      }

      .table-actions {
        min-width: 100px;
      }

      .desktop-table {
        display: block;
      }

      .mobile-list {
        display: none;
      }
    }

    @media (max-width: 520px) {
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

      .bulk-actions-mobile {
        min-height: 32px;
        padding: 6px 10px;
        font-size: 0.85rem;
      }

      .row-actions-mobile {
        min-height: 28px;
        padding: 4px 8px;
        font-size: 0.8rem;
      }

      .selection-count {
        font-size: 0.9rem;
      }

      .mobile-head {
        flex-direction: column;
        align-items: stretch;
      }

      .mobile-pill {
        width: fit-content;
      }

      .mobile-metrics,
      .mobile-actions {
        grid-template-columns: 1fr;
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
export class QuizzesListComponent implements OnInit {
  items: any[] = [];
  page = 1;
  pageSize = 10;
  totalCount = 0;
  search = '';
  category = '';
  published: boolean | null = null;
  error = '';
  selectedFile: File | null = null;
  existingCategories: string[] = [];
  selectedIds = new Set<number>();
  allSelected = false;

  showFilterPopup = false;
  showBulkDropdown = false;
  showBulkCategoryPanel = false;
  tempSearch = '';
  tempCategory = '';
  tempPublished: boolean | null = null;
  bulkCategoryInput = '';
  bulkCategorySaving = false;
  exportingPdf = false;

  constructor(
    private service: QuizService,
    private confirmDialog: ConfirmDialogService,
    private toast: ToastService,
    private pdfExport: QuestionPdfExportService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadCategorySuggestions();
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

  toggleFilterPopup(): void {
    if (!this.showFilterPopup) {
      this.tempSearch = this.search;
      this.tempCategory = this.category;
      this.tempPublished = this.published;
    }
    this.showFilterPopup = !this.showFilterPopup;
  }

  closeFilterPopup(): void {
    this.showFilterPopup = false;
  }

  applyFilters(): void {
    this.search = this.tempSearch;
    this.category = this.tempCategory;
    this.published = this.tempPublished;
    this.page = 1;
    this.closeFilterPopup();
    this.load();
  }

  cancelFilters(): void {
    this.closeFilterPopup();
  }

  clearFilters(): void {
    this.search = '';
    this.category = '';
    this.published = null;
    this.page = 1;
    this.tempSearch = '';
    this.tempCategory = '';
    this.tempPublished = null;
    this.load();
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

  openBulkCategoryPanel(): void {
    this.showBulkCategoryPanel = true;
  }

  closeBulkCategoryPanel(): void {
    this.showBulkCategoryPanel = false;
    this.bulkCategoryInput = '';
    this.bulkCategorySaving = false;
  }

  load(): void {
    this.error = '';
    this.service.getAll({
      pageNumber: this.page,
      pageSize: this.pageSize,
      search: this.search,
      category: this.category,
      isPublished: this.published,
      mode: 1
    }).subscribe({
      next: (res: any) => {
        this.items = res.items || [];
        this.totalCount = Number(res?.totalCount ?? 0);

        if (this.totalCount === 0) {
          this.page = 1;
        }

        if (this.page > this.totalPages && this.totalCount > 0) {
          this.page = this.totalPages;
          this.load();
          return;
        }

        this.clearSelection();
      },
      error: (err) => this.error = err?.error?.message || 'Failed to load tests'
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

  exportQuiz(id: number): void {
    this.service.exportQuiz(id).subscribe({
      next: () => this.toast.show('Quiz exported successfully', 'success'),
      error: (err) => this.toast.show(err?.error?.message || 'Export failed', 'error')
    });
  }

  async bulkExportPdf(): Promise<void> {
    const ids = Array.from(this.selectedIds);
    if (!ids.length || this.exportingPdf) return;
    this.exportingPdf = true;
    try {
      const sections: { title: string; blocks: PdfQuizQuestionBlock[] }[] = [];
      for (const id of ids) {
        const res = await firstValueFrom(this.service.getById(id));
        const blocks = this.pdfExport.buildQuizBlocksFromApi(res?.questions || []);
        sections.push({ title: String(res?.title || `Test ${id}`), blocks });
      }
      const withQuestions = sections.filter((s) => s.blocks.length > 0);
      if (!withQuestions.length) {
        this.toast.show('Selected tests have no questions to export.', 'error');
        return;
      }
      await this.pdfExport.exportMultipleQuizPapersPdf(
        this.pdfExport.slug(`tests_${withQuestions.length}_pdf`, 'tests_export'),
        withQuestions
      );
      this.toast.show('PDF downloaded', 'success');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? String((e as { error?: { message?: string } }).error?.message)
          : e && typeof e === 'object' && 'message' in e
            ? String((e as Error).message)
            : 'PDF export failed';
      this.toast.show(msg || 'PDF export failed', 'error');
    } finally {
      this.exportingPdf = false;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.importQuiz();
    }
  }

  importQuiz(): void {
    if (!this.selectedFile) return;

    this.service.importQuiz(this.selectedFile).subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Quiz imported successfully', 'success');
        this.load();
        this.selectedFile = null;
      },
      error: (err) => this.toast.show(err?.error?.message || 'Import failed', 'error')
    });
  }

  togglePublish(quiz: any): void {
    if (this.isExamLive(quiz)) {
      this.toast.show('Live delivery tests use sessions, not publish.', 'error');
      return;
    }
    this.service.publish(quiz.id, !quiz.isPublished).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.error = err?.error?.message || 'Status update failed';
        this.toast.show(this.error, 'error');
      }
    });
  }

  async remove(id: number): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Delete test?',
      message: 'This test and its builder configuration will be removed from the system.',
      confirmText: 'Delete',
      cancelText: 'Keep it',
      tone: 'danger'
    });

    if (!ok) return;

    this.service.delete(id).subscribe({
      next: () => this.load(),
      error: (err) => this.error = err?.error?.message || 'Delete failed'
    });
  }

  toggleSelect(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateAllSelected();
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.clearSelection();
    } else {
      this.items.forEach(q => this.selectedIds.add(q.id));
      this.allSelected = true;
    }
  }

  updateAllSelected(): void {
    this.allSelected = this.items.length > 0 && this.selectedIds.size === this.items.length;
    if (this.selectedIds.size === 0) {
      this.closeBulkDropdown();
      this.closeBulkCategoryPanel();
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.allSelected = false;
    this.closeBulkCategoryPanel();
  }

  bulkPublish(): void {
    const ids = Array.from(this.selectedIds);
    let n = 0;
    ids.forEach(id => {
      const quiz = this.items.find(q => q.id === id);
      if (quiz && !quiz.isPublished && !this.isExamLive(quiz)) {
        n++;
        this.service.publish(id, true).subscribe();
      }
    });
    setTimeout(() => {
      this.toast.show(n ? `${n} test(s) published` : 'No eligible tests to publish', n ? 'success' : 'error');
      this.clearSelection();
      this.load();
    }, 500);
  }

  bulkUnpublish(): void {
    const ids = Array.from(this.selectedIds);
    let n = 0;
    ids.forEach(id => {
      const quiz = this.items.find(q => q.id === id);
      if (quiz && quiz.isPublished && !this.isExamLive(quiz)) {
        n++;
        this.service.publish(id, false).subscribe();
      }
    });
    setTimeout(() => {
      this.toast.show(n ? `${n} test(s) unpublished` : 'No eligible tests to unpublish', n ? 'success' : 'error');
      this.clearSelection();
      this.load();
    }, 500);
  }

  async bulkDelete(): Promise<void> {
    const count = this.selectedIds.size;
    const ok = await this.confirmDialog.open({
      title: `Delete ${count} test(s)?`,
      message: `This will permanently delete the selected tests.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger'
    });

    if (!ok) return;

    const ids = Array.from(this.selectedIds);
    ids.forEach(id => {
      this.service.delete(id).subscribe();
    });
    setTimeout(() => {
      this.toast.show(`${count} tests deleted`, 'success');
      this.clearSelection();
      this.load();
    }, 500);
  }

  bulkExport(): void {
    const ids = Array.from(this.selectedIds);
    this.service.bulkExport(ids).subscribe({
      next: () => {
        this.toast.show(`${ids.length} tests exported`, 'success');
      },
      error: () => this.toast.show('Export failed', 'error')
    });
  }

  bulkDuplicate(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      return;
    }

    this.service.bulkDuplicate(ids).subscribe({
      next: (res) => {
        this.toast.show(res?.message || `${ids.length} tests duplicated`, 'success');
        this.clearSelection();
        this.load();
      },
      error: (err) => this.toast.show(err?.error?.message || 'Bulk duplicate failed', 'error')
    });
  }

  bulkAddCategory(event?: Event): void {
    this.bulkUpdateCategory('add', event);
  }

  bulkRemoveCategory(event?: Event): void {
    this.bulkUpdateCategory('remove', event);
  }

  private bulkUpdateCategory(action: 'add' | 'remove', event?: Event): void {
    event?.preventDefault();

    const ids = Array.from(this.selectedIds);
    const categoryName = String(this.bulkCategoryInput || '').trim();

    if (!categoryName) {
      this.toast.show('Enter a category name first', 'error');
      return;
    }

    if (ids.length === 0) {
      return;
    }

    this.bulkCategorySaving = true;
    const request = action === 'add'
      ? this.service.bulkAddCategory(ids, categoryName)
      : this.service.bulkRemoveCategory(ids, categoryName);

    request.subscribe({
      next: (res) => {
        this.bulkCategorySaving = false;
        if (action === 'add' && !this.existingCategories.some((item) => item.toLowerCase() === categoryName.toLowerCase())) {
          this.existingCategories = [...this.existingCategories, categoryName].sort((a, b) => a.localeCompare(b));
        }

        this.loadCategorySuggestions();
        this.toast.show(
          res?.message || (action === 'add' ? 'Category added successfully' : 'Category removed successfully'),
          'success'
        );
        this.clearSelection();
        this.load();
      },
      error: (err) => {
        this.bulkCategorySaving = false;
        this.toast.show(
          err?.error?.message || (action === 'add' ? 'Failed to add category' : 'Failed to remove category'),
          'error'
        );
      }
    });
  }

  useBulkCategorySuggestion(category: string): void {
    this.bulkCategoryInput = category;
  }

  get bulkCategorySuggestions(): string[] {
    const searchValue = String(this.bulkCategoryInput || '').trim().toLowerCase();
    return this.existingCategories
      .filter((category) => !searchValue || category.toLowerCase().includes(searchValue))
      .slice(0, 8);
  }

  categoryLabel(item: any): string {
    const categories = Array.isArray(item?.categories) ? item.categories.map((category: any) => category?.name).filter(Boolean) : [];
    return categories.length ? categories.join(', ') : 'Uncategorized';
  }

  isExamLive(quiz: any): boolean {
    return Number(quiz?.examMode ?? quiz?.ExamMode ?? 0) === 1;
  }

  marksLabel(item: any): string {
    const totalMarks = Number(item?.totalMarks ?? 0);
    const effectiveMarks = Number(item?.effectiveTotalMarks ?? 0);
    if (totalMarks > 0) {
      return `${totalMarks} total`;
    }

    return effectiveMarks > 0 ? `${effectiveMarks} auto` : '-';
  }

  onBulkActionSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const action = select.value;
    if (!action) return;

    switch (action) {
      case 'clear':
        this.clearSelection();
        break;
      case 'duplicate':
        this.bulkDuplicate();
        break;
      case 'export':
        this.bulkExport();
        break;
      case 'exportPdf':
        void this.bulkExportPdf();
        break;
      case 'publish':
        this.bulkPublish();
        break;
      case 'unpublish':
        this.bulkUnpublish();
        break;
      case 'delete':
        this.bulkDelete();
        break;
    }
    select.value = '';
  }

  onRowActionSelected(event: Event, quizId: number): void {
    const select = event.target as HTMLSelectElement;
    const action = select.value;
    if (!action) return;

    const quiz = this.items.find(q => q.id === quizId);
    if (!quiz) return;

    switch (action) {
      case 'export':
        this.exportQuiz(quizId);
        break;
      case 'edit':
        break;
      case 'publish':
        this.togglePublish(quiz);
        break;
      case 'delete':
        this.remove(quizId);
        break;
    }
    select.value = '';
  }

  private loadCategorySuggestions(): void {
    this.service.getCategories().subscribe({
      next: (items) => {
        this.existingCategories = Array.from(
          new Set(
            items
              .map((item) => String(item?.name ?? '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
      },
      error: () => {}
    });
  }
}
