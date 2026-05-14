import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PagedResult, Question, Quiz } from '../models';
import { map, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private base = `${environment.apiBaseUrl}/quizzes`;

  constructor(private http: HttpClient) {}

  getAll(params: any) {
    let query = new HttpParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') query = query.set(k, v as string);
    });

    return this.http.get<any>(this.base, { params: query }).pipe(
      map((res) => {
        const rootArray = this.toArray(res);
        const rawItems = rootArray.length
          ? rootArray
          : this.toArray(res?.items ?? res?.Items ?? res?.data ?? res?.Data);

        return {
          pageNumber: Number(res?.pageNumber ?? res?.PageNumber ?? params?.pageNumber ?? 1),
          pageSize: Number(res?.pageSize ?? res?.PageSize ?? params?.pageSize ?? 10),
          totalCount: Number(res?.totalCount ?? res?.TotalCount ?? rawItems.length),
          items: rawItems.map((x: any) => this.normalizeQuizItem(x))
        } as PagedResult<Quiz>;
      })
    );
  }

  getById(id: number) {
    return this.http.get<any>(`${this.base}/${id}`).pipe(map((res) => this.normalizeQuizDetails(res)));
  }
  getCategories() {
    return this.http.get<any[]>(`${this.base}/categories`).pipe(
      map((res) => this.toArray(res).map((item) => ({
        id: Number(item?.id ?? item?.Id ?? 0),
        name: String(item?.name ?? item?.Name ?? '')
      })))
    );
  }
  create(payload: any) { return this.http.post<any>(this.base, payload); }
  update(id: number, payload: any) { return this.http.put<any>(`${this.base}/${id}`, payload); }
  uploadCoverImage(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.base}/${id}/cover-image`, formData);
  }
  delete(id: number) { return this.http.delete(`${this.base}/${id}`); }
  addQuestions(id: number, payload: any[]) { return this.http.post(`${this.base}/${id}/questions`, payload); }
  removeQuestion(id: number, quizQuestionId: number) { return this.http.delete(`${this.base}/${id}/questions/${quizQuestionId}`); }
  reorderQuestions(id: number, payload: any[]) { return this.http.put(`${this.base}/${id}/questions/reorder`, payload); }
  publish(id: number, isPublished: boolean) { return this.http.put(`${this.base}/${id}/publish`, { isPublished }); }
  togglePublish(id: number) {
    return this.http.get<any>(`${this.base}/${id}`).pipe(
      switchMap(quiz => this.http.put(`${this.base}/${id}/publish`, { isPublished: !quiz.isPublished }))
    );
  }

  exportQuiz(id: number) {
    return this.http.get(`${this.base}/${id}/export`, { responseType: 'blob' }).pipe(
      map((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz_${id}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
    );
  }

  importQuiz(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.base}/import`, formData);
  }

  duplicate(id: number) {
    return this.http.post<any>(`${this.base}/${id}/duplicate`, {});
  }

  bulkDuplicate(ids: number[]) {
    return this.http.post<any>(`${this.base}/bulk-duplicate`, ids);
  }

  bulkDelete(ids: number[]) {
    return this.http.post<any>(`${this.base}/bulk-delete`, ids);
  }

  bulkPublish(ids: number[], publish: boolean) {
    return this.http.post<any>(`${this.base}/bulk-publish`, { ids, publish });
  }

  bulkAddCategory(ids: number[], categoryName: string) {
    return this.http.post<any>(`${this.base}/bulk-add-category`, { ids, categoryName });
  }

  bulkRemoveCategory(ids: number[], categoryName: string) {
    return this.http.post<any>(`${this.base}/bulk-remove-category`, { ids, categoryName });
  }

  bulkExport(ids: number[]) {
    return this.http.post(`${this.base}/bulk-export`, ids, {
      responseType: 'blob'
    }).pipe(
      map((blob: any) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quizzes_export.zip';
        a.click();
        window.URL.revokeObjectURL(url);
      })
    );
  }

  private toArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.$values)) return value.$values;
    return [];
  }

  private normalizeQuizItem(item: any): Quiz {
    return {
      id: Number(item?.id ?? item?.Id ?? 0),
      title: String(item?.title ?? item?.Title ?? ''),
      description: item?.description ?? item?.Description ?? '',
      coverImageUrl: this.resolveAssetUrl(item?.coverImageUrl ?? item?.CoverImageUrl ?? ''),
      mode: Number(item?.mode ?? item?.Mode ?? 0),
      durationMinutes: Number(item?.durationMinutes ?? item?.DurationMinutes ?? 0),
      totalMarks: this.toNullableNumber(item?.totalMarks ?? item?.TotalMarks),
      effectiveTotalMarks: Number(item?.effectiveTotalMarks ?? item?.EffectiveTotalMarks ?? 0),
      isPublished: Boolean(item?.isPublished ?? item?.IsPublished ?? false),
      examMode: item?.examMode !== undefined && item?.examMode !== null ? Number(item.examMode) : (item?.ExamMode !== undefined && item?.ExamMode !== null ? Number(item.ExamMode) : null),
      accessType: item?.accessType !== undefined && item?.accessType !== null ? Number(item.accessType) : (item?.AccessType !== undefined && item?.AccessType !== null ? Number(item.AccessType) : null),
      questionsCount: Number(item?.questionsCount ?? item?.QuestionsCount ?? 0),
      categories: this.toArray(item?.categories ?? item?.Categories).map((category: any) => ({
        id: Number(category?.id ?? category?.Id ?? 0),
        name: String(category?.name ?? category?.Name ?? '')
      }))
    };
  }

  private normalizeQuizDetails(item: any): any {
    const questions = this.toArray(item?.questions ?? item?.Questions).map((q: any) => ({
      id: Number(q?.id ?? q?.Id ?? 0),
      questionId: Number(q?.questionId ?? q?.QuestionId ?? 0),
      questionTitle: String(q?.questionTitle ?? q?.QuestionTitle ?? ''),
      order: Number(q?.order ?? q?.Order ?? 0),
      pointsOverride: q?.pointsOverride ?? q?.PointsOverride ?? null,
      answerSeconds: Number(q?.answerSeconds ?? q?.AnswerSeconds ?? 30),
      question: q?.question ?? q?.Question ? this.normalizeQuestion(q?.question ?? q?.Question) : undefined
    }));

    return {
      ...this.normalizeQuizItem(item),
      createdBy: item?.createdBy ?? item?.CreatedBy ?? null,
      createdAt: item?.createdAt ?? item?.CreatedAt ?? null,
      questions
    };
  }

  private resolveAssetUrl(value: any): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;

    const apiRoot = environment.apiBaseUrl.replace(/\/api\/?$/i, '');
    return raw.startsWith('/') ? `${apiRoot}${raw}` : `${apiRoot}/${raw}`;
  }

  private normalizeQuestion(item: any): Question {
    return {
      id: Number(item?.id ?? item?.Id ?? 0),
      title: String(item?.title ?? item?.Title ?? ''),
      text: String(item?.text ?? item?.Text ?? ''),
      type: Number(item?.type ?? item?.Type ?? 0),
      selectionMode: Number(item?.selectionMode ?? item?.SelectionMode ?? 1),
      difficulty: item?.difficulty ?? item?.Difficulty ?? undefined,
      imageUrl: this.resolveAssetUrl(item?.imageUrl ?? item?.ImageUrl ?? ''),
      explanation: item?.explanation ?? item?.Explanation ?? undefined,
      points: Number(item?.points ?? item?.Points ?? 0),
      answerSeconds: Number(item?.answerSeconds ?? item?.AnswerSeconds ?? 30),
      choices: this.toArray(item?.choices ?? item?.Choices).map((choice: any, index: number) => ({
        id: Number(choice?.id ?? choice?.Id ?? 0),
        choiceText: String(choice?.choiceText ?? choice?.ChoiceText ?? ''),
        imageUrl: this.resolveAssetUrl(choice?.imageUrl ?? choice?.ImageUrl ?? ''),
        hasImage: Boolean(choice?.hasImage ?? choice?.HasImage ?? false),
        isCorrect: Boolean(choice?.isCorrect ?? choice?.IsCorrect ?? false),
        order: Number(choice?.order ?? choice?.Order ?? index + 1)
      }))
    };
  }

  private toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
