import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuestionCategory {
  id: number;
  name: string;
  description?: string;
  color: number;
  questionsCount: number;
}

@Injectable({ providedIn: 'root' })
export class QuestionCategoryService {
  private readonly baseUrl = `${environment.apiBaseUrl}/question-categories`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<QuestionCategory[]> {
    return this.http.get<QuestionCategory[]>(this.baseUrl);
  }

  getById(id: number): Observable<QuestionCategory> {
    return this.http.get<QuestionCategory>(`${this.baseUrl}/${id}`);
  }

  create(dto: { name: string; description?: string; color?: number }): Observable<QuestionCategory> {
    return this.http.post<QuestionCategory>(this.baseUrl, dto);
  }

  update(id: number, dto: { name: string; description?: string; color?: number }): Observable<QuestionCategory> {
    return this.http.put<QuestionCategory>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
