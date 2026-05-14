import { Component, OnDestroy, OnInit, HostListener, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuizService } from '../../core/services/quiz.service';
import { GameSessionService } from '../../core/services/game-session.service';
import { StudentGroupService } from '../../core/services/student-group.service';
import { SignalrService } from '../../core/services/signalr.service';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PaginationControlsComponent],
  template: `
    <div class="card list-shell">
      <div class="list-head">
        <div>
          <p class="eyebrow">Live Delivery</p>
          <h2>Sessions</h2>
          <p class="intro-copy">Create a live session from any reusable test, then control it in real time.</p>
        </div>
      </div>

      <div class="action-bar">
        <div class="filter-bar">
          <button type="button" class="filter-icon-btn" (click)="toggleFilterPopup(); $event.stopPropagation()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filters</span>
          </button>
          @if (testSearch || categoryFilter) {
            <button type="button" class="clear-filters-btn" (click)="clearFilters()">Clear</button>
          }
        </div>
        <button type="button" class="create-btn" (click)="toggleCreatePopup()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create Session
        </button>
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
                <input type="text" [(ngModel)]="tempTestSearch" placeholder="Search tests or categories..." />
              </div>
              <div class="field">
                <label>Category</label>
                <select [(ngModel)]="tempCategoryFilter">
                  <option value="">All categories</option>
                  @for (category of categories; track category.id) {
                    <option [value]="category.name">{{ category.name }}</option>
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

      @if (showCreatePopup) {
        <div class="filter-popup-container">
          <div class="create-popup">
            <div class="filter-popup-header">
              <h4>Create Session</h4>
              <button type="button" class="close-filter-btn" (click)="closeCreatePopup()">✕</button>
            </div>
            <div class="filter-popup-body">
              <div class="field">
                <label for="create-test">Linked test *</label>
                <select id="create-test" [(ngModel)]="tempQuizId" (ngModelChange)="onCreateQuizChange($event)">
                  <option [ngValue]="0">Select a test</option>
                  @for (quiz of filteredTests(); track quiz.id) {
                    <option [ngValue]="quiz.id">{{ quiz.title }} | {{ sourceCategoryLabel(quiz) }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="create-access">Access</label>
                <select id="create-access" [(ngModel)]="tempAccessType" (ngModelChange)="onCreateAccessTypeChange($event)">
                  <option [ngValue]="2">Private</option>
                  <option [ngValue]="1">Public</option>
                </select>
                @if (tempAccessType === 2) {
                  <p class="field-hint">Private sessions require an allow list. Only those students can join, without host approval.</p>
                }
              </div>
              @if (tempAccessType === 2) {
                <div class="field span-allowlist">
                  <label>Allowed students *</label>
                  @if (allowlistLoading) {
                    <p class="muted">Loading students…</p>
                  } @else if (!tempQuizId) {
                    <p class="muted">Select a test first, then pick students.</p>
                  } @else if (!allowlistStudents.length) {
                    <p class="muted">No approved students found. Approve students under Student groups first.</p>
                  } @else {
                    <div class="allowlist-actions">
                      <button type="button" class="secondary btn-sm" (click)="selectAllAllowlist()">Select all</button>
                      <button type="button" class="secondary btn-sm" (click)="clearAllowlist()">Clear</button>
                      <span class="selected-count">{{ tempAllowedStudentIds.size }} selected</span>
                    </div>
                    <div class="allowlist-scroll">
                      @for (s of allowlistStudents; track s.id) {
                        <button
                          type="button"
                          class="allowlist-row"
                          [class.picked]="tempAllowedStudentIds.has(s.id)"
                          (click)="toggleAllowlistStudent(s.id)">
                          <span class="check">{{ tempAllowedStudentIds.has(s.id) ? '✓' : '' }}</span>
                          <span class="meta">
                            <strong>{{ s.userName }}</strong>
                            <span>{{ s.email }}</span>
                          </span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
              <div class="field">
                <label for="create-flow">Question flow</label>
                <select id="create-flow" [(ngModel)]="tempQuestionFlowMode">
                  <option [ngValue]="1">Host controlled</option>
                  <option [ngValue]="2">Timed by question</option>
                </select>
              </div>
              <div class="field">
                <label for="create-duration">Duration (minutes)</label>
                <input id="create-duration" type="number" [(ngModel)]="tempDurationMinutes" min="0" placeholder="Use test duration if empty" />
              </div>
              <div class="field">
                <label for="create-start">Start time</label>
                <input id="create-start" type="datetime-local" [(ngModel)]="tempScheduledStartAt" />
              </div>
              <div class="field">
                <label for="create-end">End time</label>
                <input id="create-end" type="datetime-local" [(ngModel)]="tempScheduledEndAt" />
              </div>
            </div>
            <div class="filter-popup-footer">
              <button type="button" class="secondary" (click)="closeCreatePopup()">Cancel</button>
              <button type="button" (click)="createSession()">Create</button>
            </div>
          </div>
        </div>
      }

      @if (error) { <div class="alert">{{ error }}</div> }

      <div class="table-wrap desktop-table">
        <table>
          <thead>
            <tr><th>Test</th><th>Categories</th><th>Schedule</th><th>Access</th><th>Status</th><th>Participants</th><th>Player join</th><th>Actions</th></tr>
          </thead>
          <tbody>
            @for (session of pagedSessions; track session.id) {
              <tr>
                <td>{{ session.quizTitle }}</td>
                <td>{{ sourceCategoryLabel(session) }}</td>
                <td>{{ scheduleLabel(session) }}</td>
                <td>{{ accessLabel(session.accessType) }}</td>
                <td>{{ statusLabel(session.status) }}</td>
                <td>{{ session.participantsCount }}</td>
                <td class="join-col">
                  <div class="join-info">
                    <div class="join-row">
                      <span class="join-lbl">Code</span>
                      <code class="join-code">{{ session.joinCode || '—' }}</code>
                    </div>
                    @if (joinHref(session)) {
                      <div class="join-row join-url-row">
                        <a class="join-url" [href]="joinHref(session)" target="_blank" rel="noopener noreferrer" [title]="joinHref(session)">{{ joinHref(session) }}</a>
                        <button type="button" class="copy-link-btn" (click)="copyJoinLink(session, $event)">Copy</button>
                      </div>
                    }
                  </div>
                </td>
                <td>
                  <a [routerLink]="['/game-sessions', session.id, 'control']"><button type="button">Control</button></a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mobile-list">
        @for (session of pagedSessions; track session.id) {
          <article class="mobile-item">
            <div class="mobile-head">
              <strong>{{ session.quizTitle }}</strong>
              <span class="mobile-pill">{{ statusLabel(session.status) }}</span>
            </div>

            <div class="mobile-copy">{{ sourceCategoryLabel(session) }}</div>

            <div class="mobile-metrics">
              <div class="mobile-metric">
                <span>Schedule</span>
                <strong>{{ scheduleLabel(session) }}</strong>
              </div>
              <div class="mobile-metric">
                <span>Access</span>
                <strong>{{ accessLabel(session.accessType) }}</strong>
              </div>
              <div class="mobile-metric">
                <span>Players</span>
                <strong>{{ session.participantsCount }}</strong>
              </div>
            </div>

            <div class="mobile-join">
              <span class="join-lbl">Join code</span>
              <code class="join-code">{{ session.joinCode || '—' }}</code>
              @if (joinHref(session)) {
                <div class="mobile-join-link-row">
                  <a class="join-url" [href]="joinHref(session)" target="_blank" rel="noopener noreferrer">Open join link</a>
                  <button type="button" class="copy-link-btn" (click)="copyJoinLink(session, $event)">Copy link</button>
                </div>
              }
            </div>

            <a [routerLink]="['/game-sessions', session.id, 'control']">
              <button type="button">Control</button>
            </a>
          </article>
        }
      </div>

      @if (sessions.length > 0) {
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
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      flex: 1 1 auto;
      min-height: calc(100dvh - 220px);
    }

    .list-shell {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 14px;
      min-height: calc(100dvh - 240px);
    }

    .list-head h2 {
      margin: 0;
    }

    .intro-copy {
      margin: 6px 0 0;
      max-width: 58ch;
    }

    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
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

    .create-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: none;
      border-radius: 10px;
      background: var(--primary);
      color: var(--primary-contrast);
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
    }

    .create-btn:hover {
      background: var(--primary-hover);
    }

    .filter-popup-container {
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
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }

    .filter-popup, .create-popup {
      display: flex;
      flex-direction: column;
      max-height: calc(100dvh - 32px);
      background: var(--dialog-panel-bg);
      border: 1px solid var(--dialog-panel-border);
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      box-shadow: var(--dialog-panel-shadow);
      overflow: hidden;
    }

    .create-popup {
      max-width: min(520px, 100%);
    }

    .filter-popup-header {
      flex: 0 0 auto;
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
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      overflow-y: auto;
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

    .field-hint {
      margin: 6px 0 0;
      font-size: 0.8rem;
      color: var(--muted-strong);
      line-height: 1.35;
    }

    .span-allowlist {
      grid-column: 1 / -1;
    }

    .allowlist-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.85rem;
    }

    .selected-count {
      margin-left: auto;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--accent-wine, #7a1e2e);
    }

    .allowlist-scroll {
      max-height: 220px;
      overflow-y: auto;
      display: grid;
      gap: 6px;
      padding: 2px;
    }

    .allowlist-row {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      font: inherit;
      color: inherit;
    }

    .allowlist-row:hover {
      border-color: var(--border-strong);
      background: var(--surface-soft);
    }

    .allowlist-row.picked {
      border-color: var(--accent-selected-border, #7a1e2e);
      background: var(--accent-selected-bg, rgba(122, 30, 46, 0.08));
    }

    .allowlist-row .check {
      width: 1.25rem;
      font-weight: 700;
      color: var(--accent-wine, #7a1e2e);
    }

    .allowlist-row .meta {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .allowlist-row .meta strong {
      font-size: 0.9rem;
    }

    .allowlist-row .meta span {
      font-size: 0.78rem;
      color: var(--muted);
      word-break: break-all;
    }

    .muted {
      color: var(--muted);
      font-size: 0.85rem;
      margin: 0;
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
      flex: 0 0 auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--border);
    }

    .session-builder {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .builder-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .span-2 {
      grid-column: span 2;
    }

    .builder-actions {
      display: flex;
      justify-content: flex-end;
    }

    .desktop-table {
      display: block;
      flex: 1 1 auto;
      min-height: max(260px, calc(100dvh - 300px));
      min-width: 0;
    }

    .desktop-table table {
      width: 100%;
    }

    .join-col {
      max-width: 280px;
      vertical-align: top;
    }

    .join-info {
      display: grid;
      gap: 8px;
      font-size: 0.82rem;
    }

    .join-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 10px;
    }

    .join-url-row {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }

    .join-lbl {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .join-code {
      font-size: 0.9rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--surface);
      border: 1px solid var(--border);
    }

    .join-url {
      color: var(--accent-wine, #7a1e2e);
      font-weight: 600;
      word-break: break-all;
      line-height: 1.35;
    }

    .copy-link-btn {
      align-self: flex-start;
      padding: 4px 10px;
      font-size: 0.78rem;
      font-weight: 600;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
      color: var(--text);
    }

    .copy-link-btn:hover {
      border-color: var(--border-strong);
    }

    .mobile-join {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px dashed var(--border);
      background: var(--surface);
    }

    .mobile-join-link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .mobile-list {
      display: none;
      gap: 10px;
      flex: 1 1 auto;
      min-height: max(260px, calc(100dvh - 300px));
    }

    .mobile-item {
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
    }

    .mobile-item a {
      text-decoration: none;
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

    .mobile-copy {
      color: var(--muted-strong);
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
      .builder-grid {
        grid-template-columns: 1fr;
      }

      .span-2 {
        grid-column: auto;
      }
    }

    @media (max-width: 760px) {
      .desktop-table {
        display: none;
      }

      .mobile-list {
        display: grid;
      }
    }

    @media (max-width: 520px) {
      .mobile-head {
        flex-direction: column;
        align-items: stretch;
      }

      .mobile-pill {
        width: fit-content;
      }

      .mobile-metrics {
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
export class GameSessionsListComponent implements OnInit, OnDestroy {
  quizzes: any[] = [];
  categories: any[] = [];
  sessions: any[] = [];
  page = 1;
  pageSize = 10;
  quizId = 0;
  accessType = 2;
  questionFlowMode = 1;
  durationMinutes: number | null = null;
  scheduledStartAt = '';
  scheduledEndAt = '';
  testSearch = '';
  categoryFilter = '';
  error = '';

  showFilterPopup = false;
  showCreatePopup = false;
  tempTestSearch = '';
  tempCategoryFilter = '';
  tempQuizId = 0;
  tempAccessType = 2;
  tempQuestionFlowMode = 1;
  tempDurationMinutes: number | null = null;
  tempScheduledStartAt = '';
  tempScheduledEndAt = '';
  tempAllowedStudentIds = new Set<number>();
  allowlistStudents: { id: number; userName: string; email: string }[] = [];
  allowlistLoading = false;

  constructor(
    private quizService: QuizService,
    private sessionService: GameSessionService,
    private studentGroupService: StudentGroupService,
    private signalr: SignalrService,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  joinHref(session: any): string {
    const stored = String(session?.joinLink || '').trim();
    if (stored) {
      return stored;
    }
    const code = String(session?.joinCode || '').trim();
    if (!code) {
      return '';
    }
    const origin = this.doc.defaultView?.location?.origin ?? '';
    const path = `/player/join/${encodeURIComponent(code)}`;
    return origin ? `${origin}${path}` : path;
  }

  copyJoinLink(session: any, ev?: Event): void {
    ev?.stopPropagation();
    ev?.preventDefault();
    const url = this.joinHref(session);
    const nav = this.doc.defaultView?.navigator;
    if (!url || !nav?.clipboard?.writeText) {
      return;
    }
    void nav.clipboard.writeText(url);
  }

  ngOnInit(): void {
    this.quizService.getAll({ mode: 1, pageNumber: 1, pageSize: 200 }).subscribe((res: any) => this.quizzes = res.items || []);
    this.quizService.getCategories().subscribe((items) => this.categories = items);
    this.load();
    this.initRealtime();
  }

  ngOnDestroy(): void {
    this.signalr.off('sessionsUpdated');
    this.signalr.off('sessionDeleted');
    this.signalr.leaveGlobalSessionsGroup();
    this.signalr.disconnect();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-popup-container') && !target.closest('.filter-icon-btn') && !target.closest('.create-btn')) {
      this.showFilterPopup = false;
      this.showCreatePopup = false;
    }
  }

  toggleFilterPopup(): void {
    if (!this.showFilterPopup) {
      this.tempTestSearch = this.testSearch;
      this.tempCategoryFilter = this.categoryFilter;
    }
    this.showFilterPopup = !this.showFilterPopup;
  }

  closeFilterPopup(): void {
    this.showFilterPopup = false;
  }

  applyFilters(): void {
    this.testSearch = this.tempTestSearch;
    this.categoryFilter = this.tempCategoryFilter;
    this.closeFilterPopup();
    this.load();
  }

  cancelFilters(): void {
    this.closeFilterPopup();
  }

  clearFilters(): void {
    this.testSearch = '';
    this.categoryFilter = '';
    this.tempTestSearch = '';
    this.tempCategoryFilter = '';
    this.load();
  }

  toggleCreatePopup(): void {
    if (!this.showCreatePopup) {
      this.tempQuizId = this.quizId;
      this.tempAccessType = this.accessType;
      this.tempQuestionFlowMode = this.questionFlowMode;
      this.tempDurationMinutes = this.durationMinutes;
      this.tempScheduledStartAt = this.scheduledStartAt;
      this.tempScheduledEndAt = this.scheduledEndAt;
      this.tempAllowedStudentIds.clear();
      this.allowlistStudents = [];
      if (this.tempAccessType === 2 && this.tempQuizId) {
        this.loadAllowlistStudents();
      }
    }
    this.showCreatePopup = !this.showCreatePopup;
  }

  closeCreatePopup(): void {
    this.showCreatePopup = false;
    this.tempAllowedStudentIds.clear();
    this.allowlistStudents = [];
  }

  onCreateAccessTypeChange(value: number): void {
    if (value !== 2) {
      this.tempAllowedStudentIds.clear();
      this.allowlistStudents = [];
      return;
    }
    if (this.tempQuizId) {
      this.loadAllowlistStudents();
    }
  }

  onCreateQuizChange(quizId: number): void {
    if (this.tempAccessType === 2 && quizId) {
      this.loadAllowlistStudents();
    }
  }

  private loadAllowlistStudents(): void {
    this.allowlistLoading = true;
    this.studentGroupService.getStudents({ pageNumber: 1, pageSize: 500, status: 1, role: 'Player' }).subscribe({
      next: (res) => {
        this.allowlistLoading = false;
        const items = res?.items ?? [];
        this.allowlistStudents = items.map((u: any) => ({
          id: Number(u?.id ?? u?.Id ?? 0),
          userName: String(u?.userName ?? u?.UserName ?? ''),
          email: String(u?.email ?? u?.Email ?? '')
        })).filter((u: { id: number }) => u.id > 0);
      },
      error: () => {
        this.allowlistLoading = false;
        this.allowlistStudents = [];
      }
    });
  }

  toggleAllowlistStudent(id: number): void {
    if (this.tempAllowedStudentIds.has(id)) {
      this.tempAllowedStudentIds.delete(id);
    } else {
      this.tempAllowedStudentIds.add(id);
    }
    this.tempAllowedStudentIds = new Set(this.tempAllowedStudentIds);
  }

  selectAllAllowlist(): void {
    this.allowlistStudents.forEach((s) => this.tempAllowedStudentIds.add(s.id));
    this.tempAllowedStudentIds = new Set(this.tempAllowedStudentIds);
  }

  clearAllowlist(): void {
    this.tempAllowedStudentIds.clear();
    this.tempAllowedStudentIds = new Set();
  }

  createSession(): void {
    if (!this.tempQuizId) {
      this.error = 'Please select a test';
      return;
    }

    if (this.tempAccessType === 2 && this.tempAllowedStudentIds.size === 0) {
      this.error = 'Select at least one allowed student for a private session.';
      return;
    }

    this.quizId = this.tempQuizId;
    this.accessType = this.tempAccessType;
    this.questionFlowMode = this.tempQuestionFlowMode;
    this.durationMinutes = this.tempDurationMinutes;
    this.scheduledStartAt = this.tempScheduledStartAt;
    this.scheduledEndAt = this.tempScheduledEndAt;

    this.create();
    this.closeCreatePopup();
  }

  load(): void {
    this.sessionService.getAll().subscribe({
      next: (res) => {
        this.sessions = res;
        this.normalizePagination();
      },
      error: (err) => this.error = err?.error?.message || 'Failed to load sessions'
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sessions.length / this.pageSize));
  }

  get pagedSessions(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.sessions.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.page = page;
  }

  onPageSizeChange(pageSize: number): void {
    if (pageSize === this.pageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.page = 1;
    this.normalizePagination();
  }

  filteredTests(): any[] {
    const search = String(this.testSearch || '').trim().toLowerCase();
    const category = String(this.categoryFilter || '').trim().toLowerCase();

    return this.quizzes.filter((quiz) => {
      const matchesSearch = !search
        || String(quiz?.title || '').toLowerCase().includes(search)
        || this.sourceCategoryLabel(quiz).toLowerCase().includes(search);
      const matchesCategory = !category || this.sourceCategoryLabel(quiz).toLowerCase().includes(category);
      return matchesSearch && matchesCategory;
    });
  }

  create(): void {
    if (!this.quizId) {
      this.error = 'Select a test first.';
      return;
    }

    this.error = '';
    this.sessionService.create({
      quizId: this.quizId,
      questionFlowMode: this.questionFlowMode,
      accessType: this.accessType,
      durationMinutes: this.normalizeOptionalNumber(this.durationMinutes),
      scheduledStartAt: this.toUtcIso(this.scheduledStartAt),
      scheduledEndAt: this.toUtcIso(this.scheduledEndAt),
      allowedUserIds: this.accessType === 2 ? Array.from(this.tempAllowedStudentIds) : undefined
    }).subscribe({
      next: () => {
        this.quizId = 0;
        this.tempAllowedStudentIds.clear();
        this.durationMinutes = null;
        this.scheduledStartAt = '';
        this.scheduledEndAt = '';
        this.load();
      },
      error: (err) => this.error = err?.error?.message || 'Failed to create session'
    });
  }

  statusLabel(v: number): string {
    return ['', 'Draft', 'Waiting', 'Live', 'Paused', 'Ended'][v] || 'Unknown';
  }

  accessLabel(v: number): string {
    return Number(v) === 1 ? 'Public' : 'Private';
  }

  scheduleLabel(session: any): string {
    const start = session?.scheduledStartAt ? new Date(session.scheduledStartAt) : null;
    const end = session?.scheduledEndAt ? new Date(session.scheduledEndAt) : null;

    if (start && end) {
      return `${start.toLocaleString()} to ${end.toLocaleString()}`;
    }

    if (start) {
      return `Starts ${start.toLocaleString()}`;
    }

    if (session?.durationMinutes) {
      return `${session.durationMinutes} min`;
    }

    return 'On demand';
  }

  sourceCategoryLabel(item: any): string {
    const categories = Array.isArray(item?.categories) ? item.categories.map((category: any) => category?.name).filter(Boolean) : [];
    return categories.length ? categories.join(', ') : 'Uncategorized';
  }

  private async initRealtime(): Promise<void> {
    try {
      await this.signalr.connect();
      await this.signalr.joinGlobalSessionsGroup();

      this.signalr.on('sessionsUpdated', (payload: any) => {
        this.upsertSession(payload);
      });
      this.signalr.on('sessionDeleted', (payload: any) => {
        this.removeSession(payload);
      });
    } catch {
      this.error = 'Live updates unavailable. Refresh manually.';
    }
  }

  private upsertSession(payload: any): void {
    if (!payload) return;

    const id = Number(payload.id ?? payload.Id ?? 0);
    if (!id) {
      this.load();
      return;
    }

    const normalized = {
      id,
      quizId: Number(payload.quizId ?? payload.QuizId ?? 0),
      quizTitle: payload.quizTitle ?? payload.QuizTitle ?? '',
      quizCoverImageUrl: payload.quizCoverImageUrl ?? payload.QuizCoverImageUrl ?? '',
      hostId: payload.hostId ?? payload.HostId ?? null,
      joinCode: payload.joinCode ?? payload.JoinCode ?? '',
      joinLink: payload.joinLink ?? payload.JoinLink ?? '',
      status: Number(payload.status ?? payload.Status ?? 0),
      accessType: Number(payload.accessType ?? payload.AccessType ?? 2),
      questionFlowMode: Number(payload.questionFlowMode ?? payload.QuestionFlowMode ?? 1),
      scheduledStartAt: payload.scheduledStartAt ?? payload.ScheduledStartAt ?? null,
      scheduledEndAt: payload.scheduledEndAt ?? payload.ScheduledEndAt ?? null,
      durationMinutes: payload.durationMinutes ?? payload.DurationMinutes ?? null,
      currentQuestionIndex: Number(payload.currentQuestionIndex ?? payload.CurrentQuestionIndex ?? 0),
      startedAt: payload.startedAt ?? payload.StartedAt ?? null,
      endedAt: payload.endedAt ?? payload.EndedAt ?? null,
      createdAt: payload.createdAt ?? payload.CreatedAt ?? null,
      participantsCount: Number(payload.participantsCount ?? payload.ParticipantsCount ?? 0),
      allowedUserIds: Array.isArray(payload?.allowedUserIds ?? payload?.AllowedUserIds)
        ? (payload.allowedUserIds ?? payload.AllowedUserIds).map((x: any) => Number(x))
        : [],
      categories: Array.isArray(payload?.categories ?? payload?.Categories)
        ? (payload.categories ?? payload.Categories).map((category: any) => ({
            id: Number(category?.id ?? category?.Id ?? 0),
            name: String(category?.name ?? category?.Name ?? '')
          }))
        : []
    };

    const index = this.sessions.findIndex((item) => Number(item.id) === id);
    if (index >= 0) {
      this.sessions[index] = { ...this.sessions[index], ...normalized };
      this.sessions = [...this.sessions];
      this.normalizePagination();
      return;
    }

    this.sessions = [normalized, ...this.sessions];
    this.normalizePagination();
  }

  private removeSession(payload: any): void {
    const id = Number(payload?.id ?? payload?.sessionId ?? payload?.Id ?? 0);
    if (!id) return;
    this.sessions = this.sessions.filter((item) => Number(item?.id) !== id);
    this.normalizePagination();
  }

  private normalizePagination(): void {
    if (this.page > this.totalPages) {
      this.page = this.totalPages;
    }

    if (!this.sessions.length) {
      this.page = 1;
    }
  }

  private toUtcIso(value: string): string | null {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private normalizeOptionalNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }
}
