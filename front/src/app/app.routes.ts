import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { pendingStatusGuard } from './core/guards/pending-status.guard';
import { publicJoinCodeGuard } from './core/guards/public-join-code.guard';
import { publicParticipantSessionGuard } from './core/guards/public-participant-session.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: 'auth/login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  { path: 'auth/register', loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) },
  { path: 'auth/pending', loadComponent: () => import('./features/auth/pending-registration.component').then((m) => m.PendingRegistrationComponent) },
  { path: 'auth/pending-status', loadComponent: () => import('./features/auth/pending-status.component').then((m) => m.PendingStatusComponent) },

  {
    path: 'questions',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin', 'Host'] },
    children: [
      { path: '', loadComponent: () => import('./features/questions/question-bank.component').then((m) => m.QuestionBankComponent) },
      { path: 'new', loadComponent: () => import('./features/questions/question-form.component').then((m) => m.QuestionFormComponent) },
      { path: ':id/edit', loadComponent: () => import('./features/questions/question-form.component').then((m) => m.QuestionFormComponent) }
    ]
  },

  {
    path: 'quizzes',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin', 'Host'] },
    children: [
      { path: '', loadComponent: () => import('./features/quizzes/quizzes-list.component').then((m) => m.QuizzesListComponent) },
      { path: 'new', loadComponent: () => import('./features/quizzes/quiz-form.component').then((m) => m.QuizFormComponent) },
      { path: ':id/edit', loadComponent: () => import('./features/quizzes/quiz-form.component').then((m) => m.QuizFormComponent) },
      { path: ':id', loadComponent: () => import('./features/quizzes/quiz-details.component').then((m) => m.QuizDetailsComponent) },
      { path: ':id/access', loadComponent: () => import('./features/quizzes/quiz-access.component').then((m) => m.QuizAccessComponent) }
    ]
  },

  {
    path: 'game-sessions',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin', 'Host'] },
    children: [
      { path: '', loadComponent: () => import('./features/game-sessions/game-sessions-list.component').then((m) => m.GameSessionsListComponent) },
      { path: ':id/control', loadComponent: () => import('./features/game-sessions/game-session-control.component').then((m) => m.GameSessionControlComponent) }
    ]
  },

  {
    path: 'results',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin', 'Host'] },
    loadComponent: () => import('./features/results/results-dashboard.component').then((m) => m.ResultsDashboardComponent)
  },

  {
    path: 'students',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin', 'Host'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'groups' },
      { path: 'groups', loadComponent: () => import('./features/students/student-groups.component').then((m) => m.StudentGroupsComponent) }
    ]
  },

  {
    path: 'player/live-sessions',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Player', 'Admin', 'Host'] },
    loadComponent: () => import('./features/player/player-live-sessions.component').then((m) => m.PlayerLiveSessionsComponent)
  },
  { path: 'player/join', canActivate: [pendingStatusGuard], loadComponent: () => import('./features/player/player-join.component').then((m) => m.PlayerJoinComponent) },
  { path: 'player/join/:code', canActivate: [pendingStatusGuard, publicJoinCodeGuard], loadComponent: () => import('./features/player/player-join.component').then((m) => m.PlayerJoinComponent) },
  {
    path: 'player/session/:sessionId/waiting-room',
    canActivate: [pendingStatusGuard, publicParticipantSessionGuard],
    loadComponent: () => import('./features/player/player-waiting-room.component').then((m) => m.PlayerWaitingRoomComponent)
  },
  {
    path: 'player/session/:sessionId/live',
    canActivate: [pendingStatusGuard, publicParticipantSessionGuard],
    loadComponent: () => import('./features/player/player-live-question.component').then((m) => m.PlayerLiveQuestionComponent)
  },
  {
    path: 'player/session/:sessionId/leaderboard',
    canActivate: [pendingStatusGuard, publicParticipantSessionGuard],
    loadComponent: () => import('./features/player/player-leaderboard.component').then((m) => m.PlayerLeaderboardComponent)
  },
  {
    path: 'player/session/:sessionId/result/:participantId',
    canActivate: [pendingStatusGuard, publicParticipantSessionGuard],
    loadComponent: () => import('./features/player/player-result.component').then((m) => m.PlayerResultComponent)
  },
  {
    path: 'player/history',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Player', 'Admin', 'Host'] },
    loadComponent: () => import('./features/player/player-history.component').then((m) => m.PlayerHistoryComponent)
  },

  { path: 'test-mode', canActivate: [authGuard, pendingStatusGuard], loadComponent: () => import('./features/test-mode/test-mode-list.component').then((m) => m.TestModeListComponent) },
  { path: 'test-mode/attempt/:attemptId', canActivate: [authGuard, pendingStatusGuard], loadComponent: () => import('./features/test-mode/test-mode-attempt.component').then((m) => m.TestModeAttemptComponent) },

  {
    path: 'permissions',
    canActivate: [authGuard, pendingStatusGuard, roleGuard],
    data: { roles: ['Admin'] },
    loadComponent: () => import('./features/admin/permissions.component').then((m) => m.PermissionsComponent)
  },

  { path: '**', redirectTo: '/auth/login' }
];
