import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GameSessionService {
  private base = `${environment.apiBaseUrl}/game-sessions`;
  constructor(private http: HttpClient) {}

  create(payload: {
    quizId: number;
    questionFlowMode: number;
    accessType: number;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    durationMinutes?: number | null;
    allowedUserIds?: number[];
  }) {
    return this.http.post<any>(this.base, payload);
  }
  getAll() { return this.http.get<any[]>(this.base).pipe(map((res) => this.toArray(res).map((item) => this.normalizeSession(item)))); }
  getById(id: number) { return this.http.get<any>(`${this.base}/${id}`).pipe(map((res) => this.normalizeSession(res))); }
  getByCode(code: string) { return this.http.get<any>(`${this.base}/by-code/${code}`).pipe(map((res) => this.normalizeSession(res))); }
  start(id: number) { return this.http.post(`${this.base}/${id}/start`, {}); }
  pause(id: number) { return this.http.post(`${this.base}/${id}/pause`, {}); }
  resume(id: number) { return this.http.post(`${this.base}/${id}/resume`, {}); }
  end(id: number) { return this.http.post(`${this.base}/${id}/end`, {}); }
  delete(id: number) { return this.http.delete(`${this.base}/${id}`); }
  state(id: number, options?: { skipLoading?: boolean }) {
    return this.http.get<any>(`${this.base}/${id}/state`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }
  nextQuestion(id: number) { return this.http.post(`${this.base}/${id}/next-question`, {}); }
  leaderboard(id: number) { return this.http.get<any[]>(`${this.base}/${id}/leaderboard`); }
  joinRequests(id: number) { return this.http.get<any[]>(`${this.base}/${id}/join-requests`); }
  approveJoinRequest(id: number, participantId: number) { return this.http.post<any>(`${this.base}/${id}/join-requests/${participantId}/approve`, {}); }
  rejectJoinRequest(id: number, participantId: number, decisionNote?: string) {
    return this.http.post<any>(`${this.base}/${id}/join-requests/${participantId}/reject`, { decisionNote: decisionNote || null });
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.$values)) return value.$values;
    return [];
  }

  private normalizeSession(item: any): any {
    return {
      id: Number(item?.id ?? item?.Id ?? 0),
      quizId: Number(item?.quizId ?? item?.QuizId ?? 0),
      quizTitle: String(item?.quizTitle ?? item?.QuizTitle ?? ''),
      quizCoverImageUrl: this.resolveAssetUrl(item?.quizCoverImageUrl ?? item?.QuizCoverImageUrl ?? ''),
      hostId: item?.hostId ?? item?.HostId ?? null,
      joinCode: String(item?.joinCode ?? item?.JoinCode ?? ''),
      joinLink: String(item?.joinLink ?? item?.JoinLink ?? ''),
      status: Number(item?.status ?? item?.Status ?? 0),
      accessType: Number(item?.accessType ?? item?.AccessType ?? 2),
      questionFlowMode: Number(item?.questionFlowMode ?? item?.QuestionFlowMode ?? 1),
      scheduledStartAt: item?.scheduledStartAt ?? item?.ScheduledStartAt ?? null,
      scheduledEndAt: item?.scheduledEndAt ?? item?.ScheduledEndAt ?? null,
      durationMinutes: item?.durationMinutes ?? item?.DurationMinutes ?? null,
      currentQuestionIndex: Number(item?.currentQuestionIndex ?? item?.CurrentQuestionIndex ?? 0),
      startedAt: item?.startedAt ?? item?.StartedAt ?? null,
      endedAt: item?.endedAt ?? item?.EndedAt ?? null,
      createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
      participantsCount: Number(item?.participantsCount ?? item?.ParticipantsCount ?? 0),
      allowedUserIds: this.toArray(item?.allowedUserIds ?? item?.AllowedUserIds).map((id: any) => Number(id)),
      categories: this.toArray(item?.categories ?? item?.Categories).map((category: any) => ({
        id: Number(category?.id ?? category?.Id ?? 0),
        name: String(category?.name ?? category?.Name ?? '')
      }))
    };
  }

  private resolveAssetUrl(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const apiRoot = environment.apiBaseUrl.replace(/\/api\/?$/i, '');
    return raw.startsWith('/') ? `${apiRoot}${raw}` : `${apiRoot}/${raw}`;
  }

  private buildHeaders(skipLoading?: boolean): HttpHeaders | undefined {
    return skipLoading ? new HttpHeaders({ 'X-Skip-Loading': 'true' }) : undefined;
  }
}
