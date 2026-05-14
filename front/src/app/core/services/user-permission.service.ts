import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserPermissionService {
  private base = `${environment.apiBaseUrl}/permissions`;

  constructor(private http: HttpClient) {}

  getUsersWithPermissions() {
    return this.http.get<any>(`${this.base}/users`).pipe(
      map((res: any) => Array.isArray(res) ? res : res?.items ?? [])
    );
  }

  getUserPermissions(userId: number) {
    return this.http.get<any>(`${this.base}/user/${userId}`);
  }

  setUserPermissions(userId: number, permissions: any) {
    return this.http.post(`${this.base}/user/${userId}`, { permissions });
  }

  bulkSetPermissions(userIds: number[], permissions: any) {
    return this.http.post(`${this.base}/bulk`, { userIds, permissions });
  }

  hasPermission(permissions: any, permission: string): boolean {
    return permissions[permission] === true;
  }
}
