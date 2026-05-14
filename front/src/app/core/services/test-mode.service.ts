import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TestModeService {
  private base = `${environment.apiBaseUrl}/test-mode`;

  constructor(private http: HttpClient) {}

  quizzes(params: any = {}) {
    let query = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        query = query.set(k, v as string);
      }
    });

    return this.http.get<any>(`${this.base}/quizzes`, { params: query }).pipe(
      map((res) => {
        const rootArray = this.toArray(res);
        const rawItems = rootArray.length
          ? rootArray
          : this.toArray(res?.items ?? res?.Items ?? res?.data ?? res?.Data);

        return {
          pageNumber: Number(res?.pageNumber ?? res?.PageNumber ?? params?.pageNumber ?? 1),
          pageSize: Number(res?.pageSize ?? res?.PageSize ?? params?.pageSize ?? 10),
          totalCount: Number(res?.totalCount ?? res?.TotalCount ?? rawItems.length),
          items: rawItems
        };
      })
    );
  }

  start(quizId: number, participantName?: string) {
    return this.http.post<any>(`${this.base}/quizzes/${quizId}/start`, { participantName });
  }

  overview(attemptId: number) {
    return this.http.get<any>(`${this.base}/attempts/${attemptId}/overview`);
  }

  questions(attemptId: number) {
    return this.http.get<any[]>(`${this.base}/attempts/${attemptId}/questions`).pipe(
      map((res) => this.toArray(res))
    );
  }

  currentQuestion(attemptId: number, questionIndex?: number | null) {
    let params = new HttpParams();
    if (questionIndex !== null && questionIndex !== undefined) {
      params = params.set('questionIndex', questionIndex);
    }

    return this.http.get<any>(`${this.base}/attempts/${attemptId}/current-question`, { params });
  }

  submitAnswer(attemptId: number, payload: any) {
    return this.http.post<any>(`${this.base}/attempts/${attemptId}/submit-answer`, payload);
  }

  finish(attemptId: number, payload: any) {
    return this.http.post<any>(`${this.base}/attempts/${attemptId}/finish`, payload);
  }

  result(attemptId: number) {
    return this.http.get<any>(`${this.base}/attempts/${attemptId}/result`);
  }

  history() {
    return this.http.get<any[]>(`${this.base}/history/me`);
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.$values)) return value.$values;
    return [];
  }
}



