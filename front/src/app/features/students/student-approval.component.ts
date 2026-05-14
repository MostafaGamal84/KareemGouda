import { Component, HostListener, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentGroupService } from '../../core/services/student-group.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { PagedResult } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { UserPermissionService } from '../../core/services/user-permission.service';
import { MultiSelectComponent } from '../../shared/multi-select.component';
import { PaginationControlsComponent } from '../../shared/pagination-controls.component';

interface ManagedUser {
  id: number;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status: number;
  registerTime: string;
  groups: string[];
}

type PermissionMap = { [key: string]: boolean };

@Component({
  standalone: true,
  selector: 'app-student-approval',
  imports: [CommonModule, FormsModule, MultiSelectComponent, PaginationControlsComponent],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">User Management</p>
          <h2>Users Management</h2>
          <p class="header-desc">Approve users, filter by role and activation state, and manage permissions from one place.</p>
        </div>
      </div>

      <div class="filters-panel card">
        <div class="filters-grid">
          <div class="field field-search">
            <label for="users-search">Search</label>
            <input id="users-search" type="text" [(ngModel)]="searchTerm" placeholder="Name, username, or email" (keyup.enter)="reloadFromFirstPage()" />
          </div>

          <div class="field">
            <label for="users-role">User Type</label>
            <select id="users-role" [(ngModel)]="roleFilter" (change)="reloadFromFirstPage()">
              <option value="">All Users</option>
              <option value="Player">Players</option>
              <option value="Host">Hosts</option>
              <option value="Admin">Admins</option>
            </select>
          </div>

          <div class="field">
            <label for="users-group">Group</label>
            <select id="users-group" [(ngModel)]="groupFilter" (change)="reloadFromFirstPage()">
              <option [ngValue]="null">All Groups</option>
              @for (group of groups; track group.id) {
                <option [ngValue]="group.id">{{ group.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="users-state">Activation</label>
            <select id="users-state" [(ngModel)]="statusFilter" (change)="reloadFromFirstPage()">
              <option [ngValue]="null">All States</option>
              <option [ngValue]="0">Pending / Not Active</option>
              <option [ngValue]="1">Active</option>
              <option [ngValue]="2">Rejected / Disabled</option>
            </select>
          </div>
        </div>
      </div>

      @if (selectedIds.size > 0) {
        <div class="bulk-actions-bar">
          <span>{{ selectedIds.size }} selected</span>

          @if (canManageApproval()) {
            <button type="button" class="success-btn" (click)="bulkApprove()">Approve</button>
            <button type="button" class="secondary" (click)="bulkSuspend()">Set Pending</button>
            <button type="button" class="danger" (click)="bulkReject()">Reject</button>
          }

          @if (isAdmin()) {
            <div class="permission-dropdown bulk-dropdown" (click)="$event.stopPropagation()">
              <button type="button" class="secondary permission-trigger" (click)="toggleBulkPermissions($event)">
                {{ bulkPermissionSummary() }}
              </button>

              @if (bulkPermissionsOpen) {
                <div class="permission-menu">
                  <div class="permission-menu-head">
                    <strong>Bulk Permissions</strong>
                    <button type="button" class="secondary permission-clear" (click)="clearBulkPermissions($event)">Clear</button>
                  </div>

                  @for (permission of permissionOptions; track permission.key) {
                    <label class="permission-option">
                      <input
                        type="checkbox"
                        [checked]="bulkPermissionDraft[permission.key]"
                        (change)="toggleBulkPermission(permission.key)" />
                      <span>{{ permission.label }}</span>
                    </label>
                  }
                </div>
              }
            </div>

            <button type="button" class="secondary" (click)="applyBulkPermissions()">Apply Permissions</button>
          }
        </div>
      }

      @if (loading) {
        <p class="loading-text">Loading users...</p>
      }

      @if (!loading && users.length === 0) {
        <div class="empty-state">
          <h4>No users found</h4>
          <p>Try changing the filters or search term.</p>
        </div>
      }

      @if (!loading && users.length > 0) {
        <div class="users-table">
          <table>
            <thead>
              <tr>
                <th class="col-check">
                  <input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll()" />
                </th>
                <th>User</th>
                <th>Type</th>
                <th>Groups</th>
                <th>Activation</th>
                <th>Permissions</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users; track user.id) {
                <tr [class.selected]="selectedIds.has(user.id)">
                  <td class="col-check">
                    <input type="checkbox" [checked]="selectedIds.has(user.id)" (change)="toggleSelect(user.id)" />
                  </td>
                  <td>
                    <div class="user-name">
                      <strong>{{ displayName(user) }}</strong>
                      <span>{{ user.userName }}</span>
                      <small>{{ user.email }}</small>
                    </div>
                  </td>
                  <td>
                    <span class="role-badge">{{ user.role || 'Unknown' }}</span>
                  </td>
                  <td>
                    <div class="groups-list">
                      @for (group of user.groups; track group) {
                        <span class="group-chip">{{ group }}</span>
                      }
                      @if (user.groups.length === 0) {
                        <span class="no-groups">No groups</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="status-badge" [class]="'status-' + user.status">
                      {{ getStatusName(user.status) }}
                    </span>
                  </td>
                  <td>
                    @if (isAdmin() && user.role !== 'Admin') {
                      <app-multi-select
                        [options]="permissionOptionsForSelect()"
                        [placeholder]="permissionSummary(user)"
                        [initialValues]="getSelectedPermissions(user.id)"
                        (selectionChange)="onPermissionsChange(user.id, $event)">
                      </app-multi-select>
                    } @else {
                      <span class="permission-summary">{{ permissionSummary(user) }}</span>
                    }
                  </td>
                  <td>{{ user.registerTime | date:'short' }}</td>
                  <td>
                    <div class="action-buttons">
                      @if (canManageApproval()) {
                        @if (user.status === 0) {
                          <button type="button" class="success-btn" (click)="setUserStatus(user.id, 1)">Approve</button>
                          <button type="button" class="danger" (click)="setUserStatus(user.id, 2, true)">Reject</button>
                        } @else if (user.status === 1) {
                          <button type="button" class="secondary" (click)="setUserStatus(user.id, 0, true)">Set Pending</button>
                        } @else {
                          <button type="button" class="secondary" (click)="setUserStatus(user.id, 1)">Reactivate</button>
                        }
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

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
    .users-page { display: grid; gap: 16px; }
    .page-header h2 { margin: 0; }
    .header-desc { margin: 4px 0 0; color: var(--muted); }

    .filters-panel { padding: 16px; }
    .filters-grid {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(160px, 1fr));
      gap: 12px;
      align-items: end;
    }
    .field { display: grid; gap: 6px; }
    .field label { font-size: 0.8rem; color: var(--muted); font-weight: 700; }
    .field input, .field select {
      min-height: 42px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .bulk-actions-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .bulk-actions-bar span { margin-right: auto; font-weight: 700; }

    .loading-text { color: var(--muted); text-align: center; padding: 40px; }
    .empty-state {
      text-align: center;
      padding: 40px;
      border: 1px dashed var(--border-strong);
      background: var(--surface-soft);
    }

    .users-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { width: 100%; min-width: 600px; border-collapse: collapse; background: var(--surface); }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    th {
      background: var(--surface-soft);
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    tr:last-child td { border-bottom: none; }
    tr.selected { background: var(--info-tint); }

    .user-name { display: flex; gap: 4px; flex-wrap: wrap; align-items: baseline; }
    .user-name strong { font-size: 0.95rem; }
    .user-name span, .user-name small { color: var(--muted); font-size: 0.8rem; }
    .user-name small { display: block; }

    .role-badge, .status-badge, .group-chip, .permission-summary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      font-size: 0.78rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .role-badge { color: var(--text); }
    .status-0 { background: var(--warning-tint); color: var(--warning); border-color: var(--warning-border); }
    .status-1 { background: var(--success-tint); color: var(--success); border-color: var(--success-border); }
    .status-2 { background: var(--danger-tint); color: var(--danger); border-color: var(--danger-border); }

    .groups-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .group-chip { color: var(--info); border-color: var(--info-border); background: var(--info-tint); }
    .no-groups { font-size: 0.8rem; color: var(--muted); }

    app-multi-select {
      width: 100%;
      display: block;
    }

    .permission-summary {
      font-size: 0.85rem;
    }

    .success-btn {
      border: 1px solid var(--success-border);
      background: var(--success-tint);
      color: var(--success);
    }
    .col-check { width: 42px; text-align: center; }
    .col-check input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--primary);
    }

    @media (max-width: 760px) {
      .col-check input[type="checkbox"] {
        width: 18px;
        height: 18px;
      }
    }

    @media (max-width: 520px) {
      .col-check input[type="checkbox"] {
        width: 16px;
        height: 16px;
      }
    }

    .pagination { display: flex; justify-content: center; align-items: center; gap: 12px; padding: 12px; }

    @media (max-width: 1100px) {
      .filters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .field-search { grid-column: 1 / -1; }
    }

    @media (max-width: 760px) {
      .filters-grid { grid-template-columns: 1fr; }
      .bulk-actions-bar { align-items: stretch; flex-wrap: wrap; }
      .bulk-actions-bar span { margin-right: 0; width: 100%; }
      table { font-size: 0.8rem; min-width: 550px; }
      th, td { padding: 8px; }
      th { font-size: 0.65rem; }
      .user-name { gap: 3px; }
      .user-name strong { font-size: 0.85rem; }
      .user-name span, .user-name small { font-size: 0.7rem; }
    }

    @media (max-width: 520px) {
      table { font-size: 0.7rem; min-width: 500px; }
      th, td { padding: 6px; }
      th { font-size: 0.6rem; }
      .col-check { width: 28px; }
      .col-check input[type="checkbox"] {
        width: 14px;
        height: 14px;
      }
      .user-name { flex-direction: column; gap: 2px; }
      .user-name strong { font-size: 0.8rem; }
      .user-name span, .user-name small { font-size: 0.65rem; }
      .user-name strong { font-size: 0.85rem; }
      .user-name span, .user-name small { font-size: 0.7rem; }
    }
  `]
})
export class StudentApprovalComponent implements OnInit {
  private readonly service = inject(StudentGroupService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly permissionService = inject(UserPermissionService);
  readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.role() === 'Admin');
  readonly canManageApproval = computed(() => this.auth.role() === 'Admin' || this.auth.hasPermission('ApproveRejectUsers'));

  users: ManagedUser[] = [];
  groups: any[] = [];
  loading = false;
  searchTerm = '';
  groupFilter: number | null = null;
  roleFilter = '';
  statusFilter: number | null = null;
  page = 1;
  pageSize = 20;
  totalPages = 1;
  selectedIds = new Set<number>();
  allSelected = false;

  permissionMaps: Record<number, PermissionMap> = {};
  userPermissionDrafts: Record<number, PermissionMap> = {};
  openPermissionUserId: number | null = null;
  bulkPermissionsOpen = false;

  readonly permissionOptions = [
    { key: 'AddQuestions', label: 'Add Questions' },
    { key: 'EditQuestions', label: 'Edit Questions' },
    { key: 'DeleteQuestions', label: 'Delete Questions' },
    { key: 'AddTests', label: 'Add Tests' },
    { key: 'EditTests', label: 'Edit Tests' },
    { key: 'DeleteTests', label: 'Delete Tests' },
    { key: 'ViewStudentResults', label: 'View Student Results' },
    { key: 'ApproveRejectUsers', label: 'Approve / Reject Users' },
    { key: 'AddRemoveStudentsToGroups', label: 'Manage Student Groups' },
    { key: 'ManageLiveClasses', label: 'Manage Live Classes' }
  ];

  readonly permissionOptionsForSelect = computed(() => 
    this.permissionOptions.map(p => ({ value: p.key, label: p.label }))
  );

  readonly permissionKeys = this.permissionOptions.map(permission => permission.key);
  bulkPermissionDraft: PermissionMap = this.createEmptyPermissionMap();

  @HostListener('document:click')
  closePermissionMenus(): void {
    this.openPermissionUserId = null;
    this.bulkPermissionsOpen = false;
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadUsers();
    if (this.isAdmin()) {
      this.loadAllPermissions();
    }
  }

  loadGroups(): void {
    this.service.getAll({ pageNumber: 1, pageSize: 100 }).subscribe({
      next: (res: any) => { this.groups = res.items || []; }
    });
  }

  reloadFromFirstPage(): void {
    this.page = 1;
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    const params: any = {
      pageNumber: this.page,
      pageSize: this.pageSize,
      search: this.searchTerm || undefined,
      role: this.roleFilter || undefined
    };

    if (this.statusFilter !== null) params.status = this.statusFilter;
    if (this.groupFilter !== null) params.groupId = this.groupFilter;

    this.service.getStudents(params).subscribe({
      next: (res: PagedResult<any>) => {
        const nextTotalPages = Math.max(1, Math.ceil(res.totalCount / this.pageSize));
        if (this.page > nextTotalPages && res.totalCount > 0) {
          this.page = nextTotalPages;
          this.loadUsers();
          return;
        }

        this.loading = false;
        this.users = (res.items || []) as ManagedUser[];
        this.totalPages = nextTotalPages;
        this.clearSelection();
        this.syncPermissionDrafts();
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(err?.error?.message || 'Failed to load users');
      }
    });
  }

  loadAllPermissions(): void {
    this.permissionService.getUsersWithPermissions().subscribe({
      next: (data: any[]) => {
        this.permissionMaps = {};
        for (const user of data || []) {
          this.permissionMaps[user.id] = this.clonePermissionMap(user.permissions || {});
        }
        this.syncPermissionDrafts();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to load permissions')
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    this.loadUsers();
  }

  onPageSizeChange(pageSize: number): void {
    if (pageSize === this.pageSize) {
      return;
    }

    this.pageSize = pageSize;
    this.page = 1;
    this.loadUsers();
  }

  async setUserStatus(userId: number, status: number, needsConfirmation = false): Promise<void> {
    if (needsConfirmation) {
      const ok = await this.confirmDialog.open({
        title: status === 2 ? 'Reject User' : 'Change Activation State',
        message: status === 2 ? 'Are you sure you want to reject this user?' : 'Are you sure you want to change this user activation state?',
        confirmText: status === 2 ? 'Reject' : 'Continue',
        tone: 'danger'
      });
      if (!ok) return;
    }

    this.service.approveStudent(userId, status).subscribe({
      next: () => {
        this.updateUserStatus(userId, status);
        this.toast.success(this.statusActionLabel(status));
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to update user status')
    });
  }

  toggleSelect(id: number): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.updateAllSelected();
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.clearSelection();
      return;
    }

    this.users.forEach(user => this.selectedIds.add(user.id));
    this.updateAllSelected();
  }

  updateAllSelected(): void {
    this.allSelected = this.users.length > 0 && this.selectedIds.size === this.users.length;
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.allSelected = false;
  }

  bulkApprove(): void {
    const ids = Array.from(this.selectedIds);
    this.service.bulkApprove(ids).subscribe({
      next: () => {
        this.toast.success(`${ids.length} users approved`);
        this.loadUsers();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Bulk approve failed')
    });
  }

  async bulkReject(): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Reject Users',
      message: `Reject ${this.selectedIds.size} selected users?`,
      confirmText: 'Reject',
      tone: 'danger'
    });
    if (!ok) return;

    const ids = Array.from(this.selectedIds);
    this.service.bulkReject(ids).subscribe({
      next: () => {
        this.toast.success(`${ids.length} users rejected`);
        this.loadUsers();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Bulk reject failed')
    });
  }

  bulkSuspend(): void {
    const ids = Array.from(this.selectedIds);
    let completed = 0;
    let failed = false;

    for (const id of ids) {
      this.service.approveStudent(id, 0).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.toast.success(`${ids.length} users moved to pending`);
            this.loadUsers();
          }
        },
        error: () => {
          if (!failed) {
            failed = true;
            this.toast.error('Bulk pending update failed');
          }
        }
      });
    }
  }

  toggleUserPermissionMenu(userId: number, event: Event): void {
    event.stopPropagation();
    this.bulkPermissionsOpen = false;
    this.openPermissionUserId = this.openPermissionUserId === userId ? null : userId;
    this.ensureUserPermissionDraft(userId);
  }

  toggleBulkPermissions(event: Event): void {
    event.stopPropagation();
    this.openPermissionUserId = null;
    this.bulkPermissionsOpen = !this.bulkPermissionsOpen;
  }

  toggleUserPermission(userId: number, permissionKey: string): void {
    const draft = this.ensureUserPermissionDraft(userId);
    draft[permissionKey] = !draft[permissionKey];
  }

  toggleBulkPermission(permissionKey: string): void {
    this.bulkPermissionDraft[permissionKey] = !this.bulkPermissionDraft[permissionKey];
  }

  clearUserPermissions(userId: number, event: Event): void {
    event.stopPropagation();
    this.userPermissionDrafts[userId] = this.createEmptyPermissionMap();
  }

  clearBulkPermissions(event: Event): void {
    event.stopPropagation();
    this.bulkPermissionDraft = this.createEmptyPermissionMap();
  }

  savePermissions(user: ManagedUser): void {
    const permissions = this.clonePermissionMap(this.ensureUserPermissionDraft(user.id));

    this.permissionService.setUserPermissions(user.id, permissions).subscribe({
      next: () => {
        this.permissionMaps[user.id] = this.clonePermissionMap(permissions);
        this.userPermissionDrafts[user.id] = this.clonePermissionMap(permissions);
        this.openPermissionUserId = null;
        this.toast.success('Permissions updated');

        const currentUserId = this.auth.userId();
        if (currentUserId === user.id) {
          this.auth.loadPermissions(user.id);
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to update permissions')
    });
  }

  applyBulkPermissions(): void {
    const userIds = Array.from(this.selectedIds).filter(id => this.users.find(user => user.id === id)?.role !== 'Admin');
    if (userIds.length === 0) {
      this.toast.info('No eligible users selected for permission update');
      return;
    }

    const permissions = this.clonePermissionMap(this.bulkPermissionDraft);
    this.permissionService.bulkSetPermissions(userIds, permissions).subscribe({
      next: () => {
        for (const userId of userIds) {
          this.permissionMaps[userId] = this.clonePermissionMap(permissions);
          this.userPermissionDrafts[userId] = this.clonePermissionMap(permissions);
        }

        this.bulkPermissionsOpen = false;
        this.toast.success(`Permissions applied to ${userIds.length} users`);

        const currentUserId = this.auth.userId();
        if (currentUserId !== null && userIds.includes(currentUserId)) {
          this.auth.loadPermissions(currentUserId);
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to apply bulk permissions')
    });
  }

  displayName(user: ManagedUser): string {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.userName;
  }

  getStatusName(status: number): string {
    const names: Record<number, string> = {
      0: 'Pending / Not Active',
      1: 'Active',
      2: 'Rejected / Disabled'
    };
    return names[status] || 'Unknown';
  }

  permissionSummary(user: ManagedUser): string {
    if (user.role === 'Admin') return 'All Permissions';
    const permissions = this.userPermissionDrafts[user.id] || this.permissionMaps[user.id];
    const count = this.countSelectedPermissions(permissions);
    return count === 0 ? 'No permissions selected' : `${count} permissions selected`;
  }

  getSelectedPermissions(userId: number): string[] {
    const permissions = this.userPermissionDrafts[userId] || this.permissionMaps[userId];
    if (!permissions) return [];
    return Object.keys(permissions).filter(key => permissions[key]);
  }

  onPermissionsChange(userId: number, selectedPermissions: any[]): void {
    this.ensureUserPermissionDraft(userId);
    const draft = this.userPermissionDrafts[userId];
    
    // Clear all and set selected
    Object.keys(draft).forEach(key => draft[key] = false);
    selectedPermissions.forEach(key => draft[key] = true);
    
    this.savePermissions({ id: userId } as ManagedUser);
  }

  bulkPermissionSummary(): string {
    const count = this.countSelectedPermissions(this.bulkPermissionDraft);
    return count === 0 ? 'Bulk Permissions' : `Bulk Permissions (${count})`;
  }

  private updateUserStatus(userId: number, status: number): void {
    const user = this.users.find(x => x.id === userId);
    if (user) user.status = status;
  }

  private statusActionLabel(status: number): string {
    if (status === 1) return 'User activated successfully';
    if (status === 2) return 'User rejected successfully';
    return 'User moved to pending successfully';
  }

  private syncPermissionDrafts(): void {
    for (const user of this.users) {
      if (user.role === 'Admin') continue;
      this.userPermissionDrafts[user.id] = this.clonePermissionMap(this.permissionMaps[user.id] || this.createEmptyPermissionMap());
    }
  }

  private ensureUserPermissionDraft(userId: number): PermissionMap {
    if (!this.userPermissionDrafts[userId]) {
      this.userPermissionDrafts[userId] = this.clonePermissionMap(this.permissionMaps[userId] || this.createEmptyPermissionMap());
    }
    return this.userPermissionDrafts[userId];
  }

  private countSelectedPermissions(permissions?: PermissionMap): number {
    return this.permissionKeys.filter(key => !!permissions?.[key]).length;
  }

  private createEmptyPermissionMap(): PermissionMap {
    const permissions: PermissionMap = {};
    for (const key of this.permissionKeys) {
      permissions[key] = false;
    }
    return permissions;
  }

  private clonePermissionMap(source: PermissionMap): PermissionMap {
    const permissions: PermissionMap = {};
    for (const key of this.permissionKeys) {
      permissions[key] = !!source[key];
    }
    return permissions;
  }
}
