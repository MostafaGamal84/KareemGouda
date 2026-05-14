import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private base = `${environment.apiBaseUrl}/results`;
  constructor(private http: HttpClient) {}

  session(sessionId: number) { return this.http.get<any>(`${this.base}/game-sessions/${sessionId}`); }
  sessionParticipants(sessionId: number) { return this.http.get<any[]>(`${this.base}/game-sessions/${sessionId}/participants`); }
  sessionQuestionsAnalysis(sessionId: number) { return this.http.get<any[]>(`${this.base}/game-sessions/${sessionId}/questions-analysis`); }
  testAttempt(attemptId: number) { return this.http.get<any>(`${this.base}/test-mode/attempts/${attemptId}`); }
  quizSummary(quizId: number) { return this.http.get<any>(`${this.base}/quizzes/${quizId}/summary`); }
  playerHistory() { return this.http.get<any[]>(`${this.base}/player/history`); }
}
