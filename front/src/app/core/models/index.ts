export type UserRole = 'Admin' | 'Host' | 'Player';

export const enum ExamMode {
  Live = 1,
  Test = 2
}

export const enum ExamAccessType {
  Public = 1,
  Custom = 2
}

export const enum StudentStatus {
  Pending = 0,
  Active = 1,
  Rejected = 2
}

export const enum AccessRequestStatus {
  Pending = 1,
  Approved = 2,
  Rejected = 3
}

export interface AuthUser {
  token: string;
  email?: string;
  role?: UserRole;
}

export interface PagedResult<T> {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

export interface QuestionChoice {
  id?: number;
  choiceText: string;
  imageUrl?: string;
  hasImage?: boolean;
  isCorrect: boolean;
  order: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface Question {
  id: number;
  title: string;
  text: string;
  type: number;
  selectionMode: number;
  difficulty?: string;
  imageUrl?: string;
  explanation?: string;
  points: number;
  answerSeconds: number;
  categoryId?: number;
  categoryName?: string;
  categories?: Category[];
  quizId?: number;
  quizTitle?: string;
  isOwnedByQuiz?: boolean;
  choices: QuestionChoice[];
}

export interface QuizQuestion {
  id: number;
  questionId: number;
  questionTitle: string;
  order: number;
  pointsOverride?: number | null;
  answerSeconds: number;
  question?: Question;
}

export interface Quiz {
  id: number;
  title: string;
  description?: string;
  coverImageUrl?: string;
  mode: number;
  durationMinutes: number;
  showExplanationAfterEachAnswer: boolean;
  totalMarks?: number | null;
  effectiveTotalMarks: number;
  isPublished: boolean;
  /** From QuizAccess: 1=Live delivery, 2=Test (async) */
  examMode?: number | null;
  /** From QuizAccess: 1=Public, 2=Custom */
  accessType?: number | null;
  questionsCount: number;
  categories: Category[];
  questions?: QuizQuestion[];
}

export interface GameSession {
  id: number;
  quizId: number;
  quizTitle: string;
  quizCoverImageUrl?: string;
  joinCode: string;
  joinLink: string;
  status: number;
  accessType: number;
  questionFlowMode: number;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  durationMinutes?: number | null;
  currentQuestionIndex: number;
  participantsCount: number;
  categories: Category[];
}

export interface LeaderboardItem {
  participantId: number;
  displayName: string;
  totalScore: number;
  rank: number;
}
