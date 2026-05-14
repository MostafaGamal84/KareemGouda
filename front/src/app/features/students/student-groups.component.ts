import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentGroupService } from '../../core/services/student-group.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { PagedResult } from '../../core/models';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationControlsComponent],
  template: `
    <div class="groups-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Student Groups</p>
          <h2>Manage Groups</h2>
          <p class="header-desc">Organize students into groups for easy exam assignment</p>
        </div>
        <button type="button" (click)="showCreateModal = true">Create Group</button>
      </div>

      <div class="filters-bar">
        <div class="field search-field">
          <input type="text" [(ngModel)]="searchTerm" placeholder="Search groups..." (keyup.enter)="loadGroups()" />
        </div>
      </div>

      @if (loading) {
        <p class="loading-text">Loading groups...</p>
      }

      @if (!loading && groups.length === 0) {
        <div class="empty-state">
          <h4>No groups yet</h4>
          <p>Create your first group to organize students</p>
          <button type="button" (click)="showCreateModal = true">Create Group</button>
        </div>
      }

      @if (!loading && groups.length > 0) {
        <div class="groups-grid">
          @for (group of groups; track group.id) {
            <article class="group-card">
              <div class="card-header">
                <div>
                  <h3>{{ group.name }}</h3>
                  @if (group.description) {
                    <p class="group-desc">{{ group.description }}</p>
                  }
                </div>
                <div class="card-actions">
                  <button type="button" class="secondary" (click)="openMembersModal(group)">Members ({{ group.membersCount }})</button>
                  <button type="button" class="secondary" (click)="editGroup(group)">Edit</button>
                  <button type="button" class="danger" (click)="deleteGroup(group.id)">Delete</button>
                </div>
              </div>
              <div class="card-stats">
                <span class="stat">
                  <strong>{{ group.activeMembersCount }}</strong> Active
                </span>
                <span class="stat">
                  <strong>{{ group.pendingMembersCount }}</strong> Pending
                </span>
                <span class="stat">
                  <strong>{{ group.membersCount }}</strong> Total
                </span>
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
    </div>

    @if (showCreateModal) {
      <div class="modal-overlay" (click)="closeCreateModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingGroup ? 'Edit Group' : 'Create Group' }}</h3>
            <button type="button" class="close-btn" (click)="closeCreateModal()">X</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label for="group-name">Group Name</label>
              <input id="group-name" type="text" [(ngModel)]="groupForm.name" placeholder="e.g., Class A" />
            </div>
            <div class="field">
              <label for="group-desc">Description (optional)</label>
              <textarea id="group-desc" [(ngModel)]="groupForm.description" rows="3" placeholder="Group description"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeCreateModal()">Cancel</button>
            <button type="button" [disabled]="!groupForm.name.trim()" (click)="saveGroup()">
              {{ editingGroup ? 'Update' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showMembersModal && selectedGroup) {
      <div class="modal-overlay" (click)="closeMembersModal()">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ selectedGroup.name }} - Members</h3>
            <button type="button" class="close-btn" (click)="closeMembersModal()">X</button>
          </div>
          <div class="modal-body">
            <div class="members-actions">
              <button type="button" class="secondary" (click)="openAddMembers()">Add Students</button>
            </div>

            @if (selectedGroupMembers.length === 0) {
              <p class="no-members">No members in this group</p>
            }

            <div class="members-list">
              @for (member of selectedGroupMembers; track member.id) {
                <div class="member-item">
                  <div class="member-info">
                    <strong>{{ member.userName }}</strong>
                    <span>{{ member.email }}</span>
                  </div>
                  <div class="member-actions">
                    <button type="button" class="danger" (click)="removeMember(member.id)">Remove</button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    @if (showAddMembers) {
      <div class="modal-overlay" (click)="closeAddMembers()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Students to {{ selectedGroup?.name }}</h3>
            <button type="button" class="close-btn" (click)="closeAddMembers()">X</button>
          </div>
          <div class="modal-body">
            <div class="field search-field">
              <input type="text" [(ngModel)]="studentSearch" placeholder="Search students..." (input)="onStudentSearch()" />
            </div>

            @if (availableStudents.length > 0) {
              <div class="student-list">
                @for (student of availableStudents; track student.id) {
                  <label class="student-item">
                    <input type="checkbox" [checked]="selectedStudents.has(student.id)" (change)="toggleStudent(student.id)" />
                    <div class="student-info">
                      <strong>{{ student.userName }}</strong>
                      <span>{{ student.email }}</span>
                    </div>
                  </label>
                }
              </div>
            } @else if (!studentLoading) {
              <p class="no-results">No active students available</p>
            }

            @if (studentLoading) {
              <p class="loading">Loading...</p>
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" (click)="closeAddMembers()">Cancel</button>
            <button type="button" [disabled]="selectedStudents.size === 0" (click)="addSelectedStudents()">
              Add {{ selectedStudents.size }} Student(s)
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .groups-page { display: grid; gap: 16px; }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .page-header h2 { margin: 0; }
    .header-desc { margin: 4px 0 0; color: var(--muted); }

    .filters-bar { display: flex; gap: 12px; }
    .search-field { flex: 1; display: flex; gap: 8px; }
    .search-field input { flex: 1; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; }
    .field { display: grid; gap: 4px; }
    .field input, .field textarea, .field select {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
    }

    .loading-text { color: var(--muted); text-align: center; padding: 40px; }

    .empty-state {
      text-align: center;
      padding: 40px;
      border: 1px dashed var(--border-strong);
      border-radius: 18px;
      background: var(--surface-soft);
    }

    .groups-grid { display: grid; gap: 14px; }

    .group-card {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      display: grid;
      gap: 12px;
    }

    .card-header { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .card-header h3 { margin: 0; }
    .group-desc { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }
    .card-actions { display: flex; gap: 6px; flex-wrap: wrap; }

    .card-stats { display: flex; gap: 16px; }
    .stat { font-size: 0.85rem; color: var(--muted); }
    .stat strong { color: var(--text); }

    .pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 16px; }

    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: var(--surface);
      border-radius: 20px;
      padding: 24px;
      min-width: 400px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .modal-large { width: 600px; }

    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
    }

    .modal-header h3 { margin: 0; }
    .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; }

    .modal-body { flex: 1; overflow-y: auto; display: grid; gap: 12px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    .members-actions { display: flex; gap: 8px; }
    .members-list { display: grid; gap: 8px; }

    .member-item {
      display: flex; justify-content: space-between; gap: 12px;
      padding: 12px; border: 1px solid var(--border); border-radius: 10px;
      align-items: center;
    }

    .member-info { display: grid; gap: 2px; }
    .member-info strong { font-size: 0.95rem; }
    .member-info span { font-size: 0.8rem; color: var(--muted); }

    .member-status {
      font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;
      font-weight: 600; width: fit-content;
    }

    .status-0 { background: var(--warning-tint); color: var(--warning); }
    .status-1 { background: var(--success-tint); color: var(--success); }
    .status-2 { background: var(--error-tint); color: var(--error); }

    .member-actions { display: flex; gap: 6px; }

    .student-list { display: grid; gap: 8px; max-height: 300px; overflow-y: auto; }

    .student-item {
      display: flex; gap: 10px; padding: 10px;
      border: 1px solid var(--border); border-radius: 8px;
      cursor: pointer; align-items: center;
    }

    .student-item:hover { background: var(--surface-soft); }
    .student-info { display: grid; gap: 2px; }
    .student-info strong { font-size: 0.9rem; }
    .student-info span { font-size: 0.8rem; color: var(--muted); }

    .student-item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--primary);
    }

    @media (max-width: 760px) {
      .student-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
      }
    }

    @media (max-width: 520px) {
      .student-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
      }
    }

    .no-members, .no-results, .loading { text-align: center; color: var(--muted); padding: 20px; }

    @media (max-width: 760px) {
      .modal-content, .modal-large { min-width: auto; width: 95vw; }
      .card-header { flex-direction: column; }
      .card-actions { width: 100%; }
      .card-actions button { flex: 1; }
    }
  `]
})
export class StudentGroupsComponent implements OnInit {
  groups: any[] = [];
  loading = false;
  searchTerm = '';
  page = 1;
  pageSize = 20;
  totalPages = 1;

  showCreateModal = false;
  editingGroup: any = null;
  groupForm = { name: '', description: '' };

  showMembersModal = false;
  selectedGroup: any = null;
  selectedGroupMembers: any[] = [];

  showAddMembers = false;
  availableStudents: any[] = [];
  studentLoading = false;
  studentSearch = '';
  selectedStudents = new Set<number>();

  constructor(
    private service: StudentGroupService,
    private confirmDialog: ConfirmDialogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.loading = true;
    this.service.getAll({ pageNumber: this.page, pageSize: this.pageSize, search: this.searchTerm }).subscribe({
      next: (res: PagedResult<any>) => {
        this.loading = false;
        this.groups = res.items;
        this.totalPages = Math.max(1, Math.ceil(res.totalCount / this.pageSize));
        if (this.page > this.totalPages && res.totalCount > 0) {
          this.page = this.totalPages;
          this.loadGroups();
          return;
        }
      },
      error: () => this.loading = false
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    this.loadGroups();
  }

  onPageSizeChange(pageSize: number): void {
    if (pageSize === this.pageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.page = 1;
    this.loadGroups();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.editingGroup = null;
    this.groupForm = { name: '', description: '' };
  }

  editGroup(group: any): void {
    this.editingGroup = group;
    this.groupForm = { name: group.name, description: group.description || '' };
    this.showCreateModal = true;
  }

  saveGroup(): void {
    if (!this.groupForm.name.trim()) return;

    if (this.editingGroup) {
      this.service.update(this.editingGroup.id, this.groupForm).subscribe({
        next: () => {
          this.closeCreateModal();
          this.loadGroups();
          this.toast.success('Group updated successfully');
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to update group')
      });
    } else {
      this.service.create(this.groupForm).subscribe({
        next: () => {
          this.closeCreateModal();
          this.loadGroups();
          this.toast.success('Group created successfully');
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to create group')
      });
    }
  }

  async deleteGroup(id: number): Promise<void> {
    const confirmed = await this.confirmDialog.open({
      title: 'Delete Group',
      message: 'Are you sure you want to delete this group? This action cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger'
    });
    if (confirmed) {
      this.service.delete(id).subscribe({
        next: () => {
          this.loadGroups();
          this.toast.success('Group deleted successfully');
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to delete group')
      });
    }
  }

  openMembersModal(group: any): void {
    this.selectedGroup = group;
    this.service.getById(group.id).subscribe({
      next: (res) => {
        this.selectedGroupMembers = res.members || [];
        this.showMembersModal = true;
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to load group members')
    });
  }

  closeMembersModal(): void {
    this.showMembersModal = false;
    this.selectedGroup = null;
    this.selectedGroupMembers = [];
  }

  approveMember(memberId: number): void {
    this.service.updateMemberStatus(this.selectedGroup.id, memberId, 1).subscribe({
      next: (res) => {
        this.selectedGroupMembers = res.members || [];
        this.selectedGroup = res;
        this.updateGroupInList(res);
        this.toast.success('Member approved');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to approve member')
    });
  }

  suspendMember(memberId: number): void {
    this.service.updateMemberStatus(this.selectedGroup.id, memberId, 0).subscribe({
      next: (res) => {
        this.selectedGroupMembers = res.members || [];
        this.selectedGroup = res;
        this.updateGroupInList(res);
        this.toast.success('Member suspended');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to suspend member')
    });
  }

  async removeMember(memberId: number): Promise<void> {
    const confirmed = await this.confirmDialog.open({
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the group?',
      confirmText: 'Remove',
      tone: 'danger'
    });
    if (confirmed) {
      this.service.removeMember(this.selectedGroup.id, memberId).subscribe({
        next: (res) => {
          this.selectedGroupMembers = res.members || [];
          this.selectedGroup = res;
          this.updateGroupInList(res);
          this.toast.success('Member removed');
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to remove member')
      });
    }
  }

  closeAddMembers(): void {
    this.showAddMembers = false;
    this.availableStudents = [];
    this.selectedStudents.clear();
    this.studentSearch = '';
  }

  openAddMembers(): void {
    this.showAddMembers = true;
    this.studentSearch = '';
    this.selectedStudents.clear();
    this.availableStudents = [];
    this.loadStudents();
  }

  loadStudents(): void {
    this.studentLoading = true;
    const params: any = { pageNumber: 1, pageSize: 100, search: this.studentSearch || undefined, status: 1, role: 'Player' };
    this.service.getStudents(params).subscribe({
      next: (res: any) => {
        this.studentLoading = false;
        const existingMemberIds = this.selectedGroupMembers.map((m: any) => m.userId || m.id);
        this.availableStudents = (res.items || []).filter((s: any) => !existingMemberIds.includes(s.id));
      },
      error: (err) => {
        this.studentLoading = false;
        this.toast.error(err?.error?.message || 'Failed to load available students');
      }
    });
  }

  onStudentSearch(): void {
    this.loadStudents();
  }

  toggleStudent(id: number): void {
    if (this.selectedStudents.has(id)) {
      this.selectedStudents.delete(id);
    } else {
      this.selectedStudents.add(id);
    }
  }

  addSelectedStudents(): void {
    const userIds = Array.from(this.selectedStudents);
    this.service.addMembers(this.selectedGroup.id, userIds).subscribe({
      next: (res) => {
        this.closeAddMembers();
        this.selectedGroupMembers = res.members || [];
        this.selectedGroup = res;
        this.updateGroupInList(res);
        this.toast.success('Students added successfully');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to add students')
    });
  }

  private updateGroupInList(updatedGroup: any): void {
    const index = this.groups.findIndex(g => g.id === updatedGroup.id);
    if (index !== -1) {
      this.groups[index] = { ...this.groups[index], ...updatedGroup };
    }
  }

  getStatusName(status: number): string {
    const names: Record<number, string> = { 0: 'Pending', 1: 'Active', 2: 'Rejected' };
    return names[status] || 'Unknown';
  }
}
