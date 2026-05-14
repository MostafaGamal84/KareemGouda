import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuizAccess {
  id: number;
  quizId: number;
  examMode: number;
  examModeName: string;
  accessType: number;
  accessTypeName: string;
  maxAttempts: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  timerMinutes?: number;
  accessUsers: QuizAccessUser[];
  accessGroups: QuizAccessGroup[];
}

export interface QuizAccessUser {
  id: number;
  userId: number;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: number;
  statusName: string;
  requestedAt: string;
  approvedAt?: string;
  attemptCount: number;
  extraAttemptsApproved: boolean;
}

export interface QuizAccessGroup {
  id: number;
  studentGroupId: number;
  groupName: string;
  membersCount: number;
}

export interface AttemptCheckResult {
  canStart: boolean;
  blockReason?: string;
  attemptCount: number;
  maxAttempts: number;
  remainingAttempts: number;
  extraAttemptsApproved: boolean;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  timerMinutes?: number;
}

export interface UserSummary {
  id: number;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: number;
}

export interface StudentGroup {
  id: number;
  name: string;
  description?: string;
  membersCount: number;
  activeMembersCount: number;
  pendingMembersCount: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class QuizAccessService {
  private readonly baseUrl = `${environment.apiBaseUrl}/quiz-access`;

  constructor(private http: HttpClient) {}

  getByQuizId(quizId: number): Observable<QuizAccess | null> {
    return this.http.get<QuizAccess>(`${this.baseUrl}/quiz/${quizId}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err)))
    );
  }

  createOrUpdate(quizId: number, dto: {
    examMode: number;
    accessType: number;
    maxAttempts: number;
    scheduledStartTime?: string;
    scheduledEndTime?: string;
    timerMinutes?: number;
  }): Observable<QuizAccess> {
    return this.http.post<QuizAccess>(`${this.baseUrl}/quiz/${quizId}`, dto);
  }

  addUsers(quizId: number, userIds: number[]): Observable<QuizAccess> {
    return this.http.post<QuizAccess>(`${this.baseUrl}/quiz/${quizId}/users`, { userIds });
  }

  removeUser(quizId: number, userAccessId: number): Observable<QuizAccess> {
    return this.http.delete<QuizAccess>(`${this.baseUrl}/quiz/${quizId}/users/${userAccessId}`);
  }

  updateUserStatus(quizId: number, userAccessId: number, status: number): Observable<QuizAccess> {
    return this.http.put<QuizAccess>(`${this.baseUrl}/quiz/${quizId}/users/${userAccessId}/status`, { status });
  }

  addGroups(quizId: number, groupIds: number[]): Observable<QuizAccess> {
    return this.http.post<QuizAccess>(`${this.baseUrl}/quiz/${quizId}/groups`, { groupIds });
  }

  removeGroup(quizId: number, groupAccessId: number): Observable<QuizAccess> {
    return this.http.delete<QuizAccess>(`${this.baseUrl}/quiz/${quizId}/groups/${groupAccessId}`);
  }

  approveExtraAttempts(quizId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/quiz/${quizId}/extra-attempts`, { userId });
  }

  checkAttempt(quizId: number): Observable<AttemptCheckResult> {
    return this.http.get<AttemptCheckResult>(`${this.baseUrl}/quiz/${quizId}/check`);
  }

  getAvailableStudents(quizId: number): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.baseUrl}/quiz/${quizId}/available-students`);
  }

  getAvailableGroups(quizId: number): Observable<StudentGroup[]> {
    return this.http.get<StudentGroup[]>(`${this.baseUrl}/quiz/${quizId}/available-groups`);
  }
}
