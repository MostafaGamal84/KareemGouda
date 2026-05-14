import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StudentGroupService {
  private readonly baseUrl = `${environment.apiBaseUrl}/student-groups`;

  constructor(private http: HttpClient) {}

  getAll(params: { pageNumber?: number; pageSize?: number; search?: string }): Observable<PagedResult<any>> {
    let httpParams = new HttpParams()
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 10));
    if (params.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<PagedResult<any>>(this.baseUrl, { params: httpParams });
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  create(dto: { name: string; description?: string }): Observable<any> {
    return this.http.post<any>(this.baseUrl, dto);
  }

  update(id: number, dto: { name: string; description?: string }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  addMembers(groupId: number, userIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${groupId}/members`, { userIds });
  }

  removeMember(groupId: number, memberId: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${groupId}/members/${memberId}`);
  }

  updateMemberStatus(groupId: number, memberId: number, status: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${groupId}/members/${memberId}/status`, { status });
  }

  getStudents(params: { pageNumber?: number; pageSize?: number; search?: string; status?: number; groupId?: number; role?: string }): Observable<PagedResult<any>> {
    let httpParams = new HttpParams()
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 10));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status !== null && params.status !== undefined) httpParams = httpParams.set('status', String(params.status));
    if (params.groupId !== null && params.groupId !== undefined) httpParams = httpParams.set('groupId', String(params.groupId));
    if (params.role) httpParams = httpParams.set('role', params.role);
    return this.http.get<PagedResult<any>>(`${this.baseUrl}/students`, { params: httpParams });
  }

  approveStudent(userId: number, status: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/students/approve`, { userId, status });
  }

  bulkApprove(userIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/students/bulk-approve`, userIds);
  }

  bulkReject(userIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/students/bulk-reject`, userIds);
  }
}
