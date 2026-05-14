import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private base = `${environment.apiBaseUrl}/player`;
  constructor(private http: HttpClient) {}

  join(payload: any) { return this.http.post<any>(`${this.base}/join`, payload); }
  liveSessionsBrowse() {
    return this.http.get<any[]>(`${this.base}/live-sessions`);
  }
  waitingRoom(sessionId: number) { return this.http.get<any>(`${this.base}/session/${sessionId}/waiting-room`); }
  participantStatus(sessionId: number, participantId: number, token?: string) {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return this.http.get<any>(`${this.base}/session/${sessionId}/participant/${participantId}/status${query}`);
  }
  currentQuestion(sessionId: number) { return this.http.get<any>(`${this.base}/session/${sessionId}/current-question`); }
  submitAnswer(sessionId: number, payload: any) { return this.http.post(`${this.base}/session/${sessionId}/submit-answer`, payload); }
  leave(sessionId: number, payload: { participantId: number; participantToken: string }) {
    return this.http.post(`${this.base}/session/${sessionId}/leave`, payload);
  }
  leaderboard(sessionId: number) { return this.http.get<any[]>(`${this.base}/session/${sessionId}/leaderboard`); }
  result(sessionId: number, participantId: number) { return this.http.get<any>(`${this.base}/session/${sessionId}/result/${participantId}`); }
}
