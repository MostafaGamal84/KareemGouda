import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'Host' | 'Player';
}

export interface AuthResponse {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  token: string;
  roles: string[];
  status: number;
}

export enum UserStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'quiz_token';
  private readonly roleKey = 'quiz_role';
  private readonly userIdKey = 'quiz_user_id';
  private readonly statusKey = 'quiz_status';
  private readonly firstNameKey = 'quiz_first_name';
  private readonly lastNameKey = 'quiz_last_name';
  private readonly isBrowser: boolean;
  readonly token = signal<string | null>(null);
  readonly role = signal<string | null>(null);
  readonly userId = signal<number | null>(null);
  readonly status = signal<number>(1);
  readonly firstName = signal<string | null>(null);
  readonly lastName = signal<string | null>(null);
  readonly permissions = signal<{ [key: string]: boolean }>({});

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    const storedToken = this.readStorage(this.tokenKey);
    const storedRole = this.readStorage(this.roleKey);
    const storedUserId = this.readStorage(this.userIdKey);
    const storedStatus = this.readStorage(this.statusKey);
    const storedFirstName = this.readStorage(this.firstNameKey);
    const storedLastName = this.readStorage(this.lastNameKey);
    const hasValidStoredToken = !!storedToken && !this.isTokenExpired(storedToken);

    this.token.set(hasValidStoredToken ? storedToken : null);
    this.role.set(hasValidStoredToken ? storedRole : null);
    this.userId.set(storedUserId ? parseInt(storedUserId, 10) : null);
    this.status.set(storedStatus ? parseInt(storedStatus, 10) : 1);
    this.firstName.set(storedFirstName || null);
    this.lastName.set(storedLastName || null);

    if (storedToken && !hasValidStoredToken) {
      this.clearSession();
    }

    if (hasValidStoredToken && !storedRole) {
      const extracted = this.extractRole(storedToken);
      if (extracted) {
        this.writeStorage(this.roleKey, extracted);
        this.role.set(extracted);
      }
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        const token = (res as any)?.token ?? (res as any)?.Token;
        if (token) {
          this.setSession(token, this.pickRoleFromResponse(res), (res as any)?.id, (res as any)?.status);
          const first = ((res as any)?.firstName || '').trim();
          const last = ((res as any)?.lastName || '').trim();
          this.firstName.set(first || null);
          this.lastName.set(last || null);
          this.writeStorage(this.firstNameKey, first || '');
          this.writeStorage(this.lastNameKey, last || '');
        }
      })
    );
  }

  getFullName(): string {
    const first = this.firstName();
    const last = this.lastName();
    return first && last ? `${first} ${last}` : first || last || '';
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, payload).pipe(
      tap((res) => {
        const token = (res as any)?.token ?? (res as any)?.Token;
        if (token) {
          this.setSession(token, this.pickRoleFromResponse(res), (res as any)?.id, (res as any)?.status);
        }
      })
    );
  }

  setSession(token: string, roleFromResponse?: string | null, userId?: number, status?: number): void {
    this.writeStorage(this.tokenKey, token);
    this.token.set(token);

    const role = roleFromResponse || this.extractRole(token);
    if (role) {
      this.writeStorage(this.roleKey, role);
      this.role.set(role);
    } else {
      this.removeStorage(this.roleKey);
      this.role.set(null);
    }

    if (userId) {
      this.writeStorage(this.userIdKey, String(userId));
      this.userId.set(userId);
      this.loadPermissions(userId);
    }

    if (status !== undefined) {
      this.writeStorage(this.statusKey, String(status));
      this.status.set(status);
    }
  }

  loadPermissions(userId: number): void {
    if (this.role() === 'Admin') {
      const allPerms: { [key: string]: boolean } = {
        'AddQuestions': true, 'EditQuestions': true, 'DeleteQuestions': true,
        'AddTests': true, 'EditTests': true, 'DeleteTests': true,
        'ViewStudentResults': true, 'ApproveRejectUsers': true,
        'AddRemoveStudentsToGroups': true, 'ManageLiveClasses': true
      };
      this.permissions.set(allPerms);
      return;
    }

    this.http.get<any>(`${environment.apiBaseUrl}/permissions/user/${userId}`).subscribe({
      next: (perms) => this.permissions.set(perms || {}),
      error: () => this.permissions.set({})
    });
  }

  hasPermission(permission: string): boolean {
    return this.permissions()[permission] === true;
  }

  logout(): void {
    this.removeStorage(this.tokenKey);
    this.removeStorage(this.roleKey);
    this.removeStorage(this.userIdKey);
    this.removeStorage(this.statusKey);
    this.removeStorage(this.firstNameKey);
    this.removeStorage(this.lastNameKey);
    if (this.isBrowser) {
      localStorage.removeItem('participant_session_id');
      localStorage.removeItem('participant_session_access_type');
    }
    this.token.set(null);
    this.role.set(null);
    this.userId.set(null);
    this.status.set(1);
    this.firstName.set(null);
    this.lastName.set(null);
    this.permissions.set({});
    this.router.navigate(['/auth/login']);
  }

  isLoggedIn(): boolean {
    const token = this.token();
    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.clearSession();
      return false;
    }

    return true;
  }

  isPending(): boolean {
    return this.status() === 0;
  }

  private extractRole(token: string): string | null {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return null;

      const payload = JSON.parse(this.decodeBase64Url(payloadPart));
      const roleValue = payload['role'] || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || null;
      if (Array.isArray(roleValue)) {
        return roleValue[0] ?? null;
      }
      return roleValue;
    } catch {
      return null;
    }
  }

  private pickRoleFromResponse(response: AuthResponse | any): string | null {
    const roles = response?.roles ?? response?.Roles;
    if (Array.isArray(roles) && roles.length > 0) {
      return String(roles[0]);
    }
    return null;
  }

  private decodeBase64Url(value: string): string {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(padded);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return true;

      const payload = JSON.parse(this.decodeBase64Url(payloadPart));
      const exp = Number(payload?.exp);

      if (!exp || Number.isNaN(exp)) {
        return false;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      return exp <= nowSeconds;
    } catch {
      return true;
    }
  }

  private readStorage(key: string): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(key);
  }

  private writeStorage(key: string, value: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(key, value);
  }

  private removeStorage(key: string): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(key);
  }

  private clearSession(): void {
    this.removeStorage(this.tokenKey);
    this.removeStorage(this.roleKey);
    this.removeStorage(this.userIdKey);
    this.removeStorage(this.statusKey);
    this.removeStorage(this.firstNameKey);
    this.removeStorage(this.lastNameKey);
    this.token.set(null);
    this.role.set(null);
    this.userId.set(null);
    this.status.set(1);
    this.firstName.set(null);
    this.lastName.set(null);
  }
}

