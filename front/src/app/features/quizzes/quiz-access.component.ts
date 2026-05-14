import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizAccessService, QuizAccess, UserSummary, StudentGroup } from '../../core/services/quiz-access.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  standalone: true,
  selector: 'app-quiz-access',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="access-panel">
      <div class="panel-header">
        <h3>Exam Access Settings</h3>
        <p class="panel-desc">Configure who can take this exam and when</p>
      </div>

      <div class="access-form">
        <div class="form-row">
          <div class="field">
            <label for="exam-mode">Exam Mode</label>
            <select id="exam-mode" [(ngModel)]="form.examMode" (ngModelChange)="onExamModeChange($event)">
              <option [ngValue]="1">Live</option>
              <option [ngValue]="2">Test</option>
            </select>
            @if (form.examMode === 1) {
              <p class="field-hint">Who can join a live run is set per session (public link or private allow list), not here.</p>
            }
          </div>

          @if (form.examMode === 2) {
            <div class="field">
              <label for="access-type">Access Type</label>
              <select id="access-type" [(ngModel)]="form.accessType" (change)="onAccessTypeChange()">
                <option [ngValue]="1">Public</option>
                <option [ngValue]="2">Custom</option>
              </select>
            </div>
          }
        </div>

        <div class="form-row">
          <div class="field">
            <label for="max-attempts">Max Attempts</label>
            <input id="max-attempts" type="number" [(ngModel)]="form.maxAttempts" min="1" max="100" />
          </div>

          <div class="field">
            <label for="timer">Timer (minutes, optional)</label>
            <input id="timer" type="number" [(ngModel)]="form.timerMinutes" min="1" placeholder="Leave empty for no timer" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="start-time">Start Time (optional)</label>
            <input id="start-time" type="datetime-local" [(ngModel)]="form.scheduledStartTime" />
          </div>

          <div class="field">
            <label for="end-time">End Time (optional)</label>
            <input id="end-time" type="datetime-local" [(ngModel)]="form.scheduledEndTime" />
          </div>
        </div>
      </div>

      @if (form.examMode === 2 && form.accessType === 2) {
        <div class="users-section">
          <div class="section-header">
            <h4>Individual Students</h4>
            <button 
              type="button" 
              class="secondary" 
              (click)="openAddUsers()">
              Add Students
            </button>
          </div>

          @if (access?.accessUsers?.length) {
            <div class="users-list">
              @for (user of access?.accessUsers; track user.id) {
                <div class="user-item">
                  <div class="user-info">
                    <strong>{{ user.userName }}</strong>
                    <span>{{ user.email }}</span>
                  </div>
                  <div class="user-meta">
                    <span class="status-badge" [class]="'status-' + user.status">
                      {{ user.statusName }}
                    </span>
                    <span class="attempts-info">{{ user.attemptCount }}/{{ form.maxAttempts }} attempts</span>
                  </div>
                  <div class="user-actions">
                    @if (user.status === 1) {
                      <button type="button" class="secondary" (click)="approveUser(user.id)">Approve</button>
                    }
                    @if (user.status === 2 && user.attemptCount >= form.maxAttempts && !user.extraAttemptsApproved) {
                      <button type="button" class="secondary" (click)="approveExtraAttempts(user.userId)">Allow Retry</button>
                    }
                    <button type="button" class="danger" (click)="removeUser(user.id)">Remove</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <div class="groups-section">
          <div class="section-header">
            <h4>Student Groups</h4>
            <button 
              type="button" 
              class="secondary" 
              (click)="openAddGroups()">
              Add Groups
            </button>
          </div>

          @if (access?.accessGroups?.length) {
            <div class="groups-list">
              @for (group of access?.accessGroups; track group.id) {
                <div class="group-item">
                  <div class="group-info">
                    <strong>{{ group.groupName }}</strong>
                    <span>{{ group.membersCount }} members</span>
                  </div>
                  <button type="button" class="danger" (click)="removeGroup(group.id)">Remove</button>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (error) { <div class="alert">{{ error }}</div> }
    </div>

    @if (showAddUsers) {
      <div class="modal-overlay" (click)="closeAddUsers()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Students</h3>
            <button type="button" class="close-btn" (click)="closeAddUsers()">X</button>
          </div>
          <div class="modal-body">
            @if (availableStudents.length > 0) {
              <div class="select-actions">
                <button type="button" class="secondary btn-sm" (click)="selectAllStudents()">Select All</button>
                <button type="button" class="secondary btn-sm" (click)="clearStudentSelection()">Clear</button>
                <span class="selected-count">{{ selectedStudents.size }} selected</span>
              </div>
            }

            @if (loadingStudents) {
              <p class="loading">Loading students...</p>
            }

            <div class="select-list">
              @for (student of availableStudents; track student.id) {
                <div class="select-item" 
                     [class.selected]="selectedStudents.has(student.id)"
                     (click)="toggleStudent(student.id)">
                  <div class="select-checkbox" [class.checked]="selectedStudents.has(student.id)">
                    @if (selectedStudents.has(student.id)) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                  </div>
                  <div class="select-info">
                    <strong>{{ student.userName }}</strong>
                    <span>{{ student.email }}</span>
                  </div>
                </div>
              }
            </div>

            @if (availableStudents.length === 0 && !loadingStudents) {
              <p class="empty-text">No students available to add</p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeAddUsers()">Cancel</button>
            <button type="button" [disabled]="selectedStudents.size === 0" (click)="addSelectedStudents()">
              Add {{ selectedStudents.size }} Student(s)
            </button>
          </div>
        </div>
      </div>
    }

    @if (showAddGroups) {
      <div class="modal-overlay" (click)="closeAddGroups()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Groups</h3>
            <button type="button" class="close-btn" (click)="closeAddGroups()">X</button>
          </div>
          <div class="modal-body">
            @if (availableGroups.length > 0) {
              <div class="select-actions">
                <button type="button" class="secondary btn-sm" (click)="selectAllGroups()">Select All</button>
                <button type="button" class="secondary btn-sm" (click)="clearGroupSelection()">Clear</button>
                <span class="selected-count">{{ selectedGroups.size }} selected</span>
              </div>
            }

            @if (loadingGroups) {
              <p class="loading">Loading groups...</p>
            }

            <div class="select-list">
              @for (group of availableGroups; track group.id) {
                <div class="select-item" 
                     [class.selected]="selectedGroups.has(group.id)"
                     (click)="toggleGroup(group.id)">
                  <div class="select-checkbox" [class.checked]="selectedGroups.has(group.id)">
                    @if (selectedGroups.has(group.id)) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    }
                  </div>
                  <div class="select-info">
                    <strong>{{ group.name }}</strong>
                    <span>{{ group.membersCount }} members</span>
                  </div>
                </div>
              }
            </div>

            @if (availableGroups.length === 0 && !loadingGroups) {
              <p class="empty-text">No groups available to add</p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeAddGroups()">Cancel</button>
            <button type="button" [disabled]="selectedGroups.size === 0" (click)="addSelectedGroups()">
              Add {{ selectedGroups.size }} Group(s)
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .access-panel { display: grid; gap: 20px; }

    .panel-header h3 { margin: 0; }
    .panel-desc { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }

    .access-form { display: grid; gap: 14px; }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .field { display: grid; gap: 4px; }
    .field label { font-size: 0.85rem; font-weight: 600; color: var(--muted); }
    .field-hint { margin: 4px 0 0; font-size: 0.8rem; color: var(--muted); line-height: 1.35; }
    .field input, .field select {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      min-height: 42px;
    }

    .form-actions { display: flex; justify-content: flex-end; }

    .users-section, .groups-section {
      display: grid;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-header h4 { margin: 0; }

    .users-list, .groups-list { display: grid; gap: 8px; }

    .user-item, .group-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      gap: 12px;
      flex-wrap: wrap;
    }

    .user-info, .group-info { display: grid; gap: 2px; }
    .user-info strong, .group-info strong { font-size: 0.95rem; }
    .user-info span, .group-info span { font-size: 0.8rem; color: var(--muted); }

    .user-meta { display: flex; gap: 10px; align-items: center; }
    .status-badge {
      font-size: 0.75rem;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }

    .status-1 { background: var(--warning-tint); color: var(--warning); }
    .status-2 { background: var(--success-tint); color: var(--success); }
    .status-3 { background: var(--error-tint); color: var(--error); }

    .attempts-info { font-size: 0.8rem; color: var(--muted); }
    .user-actions { display: flex; gap: 6px; flex-wrap: wrap; }

    .empty-text { color: var(--muted); font-size: 0.9rem; }

    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: var(--overlay-bg);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 16px;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: var(--dialog-panel-bg);
      border: 1px solid var(--dialog-panel-border);
      border-radius: 18px;
      padding: 24px;
      min-width: 450px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--dialog-panel-shadow);
    }

    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }

    .modal-header h3 { margin: 0; font-size: 1.1rem; }
    .close-btn { 
      background: none; border: none; font-size: 1.4rem; cursor: pointer;
      padding: 4px 8px; border-radius: 8px; color: var(--muted);
    }
    .close-btn:hover { background: var(--surface-soft); color: var(--text); }

    .modal-body { flex: 1; overflow-y: auto; display: grid; gap: 12px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    .select-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 0;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.85rem;
    }

    .selected-count {
      margin-left: auto;
      font-weight: 600;
      color: var(--accent-wine);
    }

    .select-list {
      display: grid;
      gap: 8px;
      max-height: 350px;
      overflow-y: auto;
    }

    .select-item {
      display: flex;
      gap: 12px;
      padding: 14px;
      border: 2px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
      align-items: center;
      background: var(--surface);
    }

    .select-item:hover {
      border-color: var(--accent-hover-border);
      background: var(--accent-hover-bg);
    }

    .select-item.selected {
      border-color: var(--accent-selected-border);
      background: var(--accent-selected-bg);
      box-shadow: 0 0 0 1px var(--accent-wine-soft) inset, 0 18px 30px -28px var(--accent-wine-glow);
    }

    .select-checkbox {
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

    .select-item.selected .select-checkbox {
      background: var(--accent-wine);
      border-color: var(--accent-wine);
    }

    .select-checkbox svg {
      width: 12px;
      height: 12px;
      color: white;
    }

    @media (max-width: 760px) {
      .select-checkbox {
        width: 18px;
        height: 18px;
      }
      .select-checkbox svg {
        width: 11px;
        height: 11px;
      }
    }

    @media (max-width: 520px) {
      .select-checkbox {
        width: 16px;
        height: 16px;
        border-radius: 3px;
      }
      .select-checkbox svg {
        width: 10px;
        height: 10px;
      }
    }

    .select-info { 
      display: grid; 
      gap: 3px;
      flex: 1;
      min-width: 0;
    }

    .select-info strong {
      font-size: 0.95rem;
      color: var(--text);
    }

    .select-info span {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .loading { text-align: center; color: var(--muted); padding: 20px; }
    .empty-text { text-align: center; color: var(--muted); padding: 20px; }

    @media (max-width: 760px) {
      .form-row { grid-template-columns: 1fr; }
      .modal-content { min-width: auto; width: 95vw; }
    }
  `]
})
export class QuizAccessComponent implements OnInit {
  @Input() quizId!: number;
  @Output() accessChanged = new EventEmitter<void>();
  @Output() goToQuestions = new EventEmitter<void>();

  access: QuizAccess | null = null;
  saving = false;
  error = '';
  loadingStudents = false;
  loadingGroups = false;

  availableStudents: UserSummary[] = [];
  availableGroups: StudentGroup[] = [];
  selectedStudents = new Set<number>();
  selectedGroups = new Set<number>();

  showAddUsers = false;
  showAddGroups = false;

  form = {
    examMode: 2,
    accessType: 1,
    maxAttempts: 1,
    timerMinutes: null as number | null,
    scheduledStartTime: '',
    scheduledEndTime: ''
  };

  constructor(
    private quizAccessService: QuizAccessService,
    private confirmDialog: ConfirmDialogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAccess();
  }

  loadAccess(): void {
    if (!this.quizId) {
      return;
    }
    this.quizAccessService.getByQuizId(this.quizId).subscribe({
      next: (res) => {
        if (res) {
          this.access = res;
          const r = res as QuizAccess & { ExamMode?: number; AccessType?: number; MaxAttempts?: number };
          this.form.examMode = Number(r.examMode ?? r.ExamMode ?? 2);
          this.form.accessType = this.form.examMode === 1 ? 1 : Number(r.accessType ?? r.AccessType ?? 1);
          this.form.maxAttempts = Number(r.maxAttempts ?? r.MaxAttempts ?? 1);
          this.form.timerMinutes = r.timerMinutes ?? null;
          this.form.scheduledStartTime = res.scheduledStartTime ? this.formatDateTimeLocal(res.scheduledStartTime) : '';
          this.form.scheduledEndTime = res.scheduledEndTime ? this.formatDateTimeLocal(res.scheduledEndTime) : '';
        }
      }
    });
  }

  /** Persists current access form (used by test builder when leaving step 3 without clicking Save here). */
  persistAccessSettings(): Observable<QuizAccess> {
    const dto = this.buildSaveDto();
    return this.quizAccessService.createOrUpdate(this.quizId, dto).pipe(
      tap((res) => {
        this.access = res;
        this.accessChanged.emit();
      })
    );
  }

  onAccessTypeChange(): void {
    if (this.form.accessType === 1) {
      this.access = null;
    }
  }

  onExamModeChange(mode: number): void {
    if (mode === 1) {
      this.form.accessType = 1;
    }
  }

  private buildSaveDto() {
    const accessType = this.form.examMode === 1 ? 1 : this.form.accessType;
    return {
      examMode: this.form.examMode,
      accessType,
      maxAttempts: this.form.maxAttempts,
      timerMinutes: this.form.timerMinutes || undefined,
      scheduledStartTime: this.form.scheduledStartTime || undefined,
      scheduledEndTime: this.form.scheduledEndTime || undefined
    };
  }

  saveSettings(continueToQuestions: boolean = false): void {
    this.saving = true;
    this.error = '';

    const dto = this.buildSaveDto();

    this.quizAccessService.createOrUpdate(this.quizId, dto).subscribe({
      next: (res) => {
        this.saving = false;
        this.access = res;
        this.accessChanged.emit();
        this.toast.success('Settings saved successfully');
        
        if (continueToQuestions) {
          this.goToQuestions.emit();
        }
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save settings';
        this.toast.error(this.error);
      }
    });
  }

  closeAddUsers(): void {
    this.showAddUsers = false;
    this.selectedStudents.clear();
    this.availableStudents = [];
  }

  openAddUsers(): void {
    if (!this.access) {
      this.saveSettingsAndProceed(() => {
        this.showAddUsers = true;
        this.loadAvailableStudents();
      });
      return;
    }
    this.showAddUsers = true;
    this.loadAvailableStudents();
  }

  openAddGroups(): void {
    if (!this.access) {
      this.saveSettingsAndProceed(() => {
        this.showAddGroups = true;
        this.loadAvailableGroups();
      });
      return;
    }
    this.showAddGroups = true;
    this.loadAvailableGroups();
  }

  private saveSettingsAndProceed(callback: () => void): void {
    this.saving = true;
    this.error = '';

    const dto = this.buildSaveDto();

    this.quizAccessService.createOrUpdate(this.quizId, dto).subscribe({
      next: (res) => {
        this.saving = false;
        this.access = res;
        this.accessChanged.emit();
        callback();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save settings';
        this.toast.error(this.error);
      }
    });
  }

  loadAvailableStudents(): void {
    this.loadingStudents = true;
    this.quizAccessService.getAvailableStudents(this.quizId).subscribe({
      next: (res) => {
        this.loadingStudents = false;
        this.availableStudents = res;
      },
      error: (err) => {
        this.loadingStudents = false;
        this.toast.error(err?.error?.message || 'Failed to load available students');
      }
    });
  }

  toggleStudent(id: number): void {
    if (this.selectedStudents.has(id)) {
      this.selectedStudents.delete(id);
    } else {
      this.selectedStudents.add(id);
    }
  }

  selectAllStudents(): void {
    this.availableStudents.forEach(s => this.selectedStudents.add(s.id));
  }

  clearStudentSelection(): void {
    this.selectedStudents.clear();
  }

  addSelectedStudents(): void {
    const userIds = Array.from(this.selectedStudents);
    this.quizAccessService.addUsers(this.quizId, userIds).subscribe({
      next: (res) => {
        this.access = res;
        this.closeAddUsers();
        this.accessChanged.emit();
        this.toast.success('Students added successfully');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to add students')
    });
  }

  closeAddGroups(): void {
    this.showAddGroups = false;
    this.selectedGroups.clear();
    this.availableGroups = [];
  }

  loadAvailableGroups(): void {
    this.loadingGroups = true;
    this.quizAccessService.getAvailableGroups(this.quizId).subscribe({
      next: (res) => {
        this.loadingGroups = false;
        this.availableGroups = res;
      },
      error: (err) => {
        this.loadingGroups = false;
        this.toast.error(err?.error?.message || 'Failed to load available groups');
      }
    });
  }

  toggleGroup(id: number): void {
    if (this.selectedGroups.has(id)) {
      this.selectedGroups.delete(id);
    } else {
      this.selectedGroups.add(id);
    }
  }

  selectAllGroups(): void {
    this.availableGroups.forEach(g => this.selectedGroups.add(g.id));
  }

  clearGroupSelection(): void {
    this.selectedGroups.clear();
  }

  addSelectedGroups(): void {
    const groupIds = Array.from(this.selectedGroups);
    this.quizAccessService.addGroups(this.quizId, groupIds).subscribe({
      next: (res) => {
        this.access = res;
        this.closeAddGroups();
        this.accessChanged.emit();
        this.toast.success('Groups added successfully');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to add groups')
    });
  }

  approveUser(userAccessId: number): void {
    this.quizAccessService.updateUserStatus(this.quizId, userAccessId, 2).subscribe({
      next: (res) => {
        this.access = res;
        this.toast.success('Student approved');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to approve student')
    });
  }

  removeUser(userAccessId: number): void {
    this.confirmDialog.open({
      title: 'Remove Student',
      message: 'Are you sure you want to remove this student from the exam access list?',
      confirmText: 'Remove',
      tone: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.quizAccessService.removeUser(this.quizId, userAccessId).subscribe({
          next: (res) => {
            this.access = res;
            this.accessChanged.emit();
            this.toast.success('Student removed successfully');
          },
          error: (err) => this.toast.error(err?.error?.message || 'Failed to remove student')
        });
      }
    });
  }

  removeGroup(groupAccessId: number): void {
    this.confirmDialog.open({
      title: 'Remove Group',
      message: 'Are you sure you want to remove this group from the exam access list?',
      confirmText: 'Remove',
      tone: 'danger'
    }).then(confirmed => {
      if (confirmed) {
        this.quizAccessService.removeGroup(this.quizId, groupAccessId).subscribe({
          next: (res) => {
            this.access = res;
            this.accessChanged.emit();
            this.toast.success('Group removed successfully');
          },
          error: (err) => this.toast.error(err?.error?.message || 'Failed to remove group')
        });
      }
    });
  }

  approveExtraAttempts(userId: number): void {
    this.quizAccessService.approveExtraAttempts(this.quizId, userId).subscribe({
      next: () => {
        this.loadAccess();
        this.toast.success('Extra attempts approved');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to approve extra attempts')
    });
  }

  private formatDateTimeLocal(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  }
}
