import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private base = `${environment.apiBaseUrl}/player`;
  constructor(private http: HttpClient) {}

  join(payload: any) { return this.http.post<any>(`${this.base}/join`, payload); }
  liveSessionsBrowse(options?: { skipLoading?: boolean }) {
    return this.http.get<any[]>(`${this.base}/live-sessions`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }
  waitingRoom(sessionId: number, options?: { skipLoading?: boolean }) {
    return this.http.get<any>(`${this.base}/session/${sessionId}/waiting-room`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }
  participantStatus(sessionId: number, participantId: number, token?: string, options?: { skipLoading?: boolean }) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return this.http.get<any>(`${this.base}/session/${sessionId}/participant/${participantId}/status${query}`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }
  currentQuestion(
    sessionId: number,
    navigation?: { questionIndex: number; participantId: number; token: string },
    options?: { skipLoading?: boolean }
  ) {
    let params = new HttpParams();
    if (navigation) {
      params = params
        .set('questionIndex', navigation.questionIndex)
        .set('participantId', navigation.participantId)
        .set('token', navigation.token);
    }
    return this.http.get<any>(`${this.base}/session/${sessionId}/current-question`, {
      headers: this.buildHeaders(options?.skipLoading),
      params
    });
  }
  submitAnswer(sessionId: number, payload: any) { return this.http.post(`${this.base}/session/${sessionId}/submit-answer`, payload); }
  leave(sessionId: number, payload: { participantId: number; participantToken: string }) {
    return this.http.post(`${this.base}/session/${sessionId}/leave`, payload);
  }
  completeTest(sessionId: number, payload: { participantId: number; participantToken: string }) {
    return this.http.post(`${this.base}/session/${sessionId}/complete-test`, payload);
  }
  leaderboard(sessionId: number, options?: { skipLoading?: boolean }) {
    return this.http.get<any[]>(`${this.base}/session/${sessionId}/leaderboard`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }
  result(sessionId: number, participantId: number, options?: { skipLoading?: boolean }) {
    return this.http.get<any>(`${this.base}/session/${sessionId}/result/${participantId}`, {
      headers: this.buildHeaders(options?.skipLoading)
    });
  }

  private buildHeaders(skipLoading?: boolean): HttpHeaders | undefined {
    return skipLoading ? new HttpHeaders({ 'X-Skip-Loading': 'true' }) : undefined;
  }
}
