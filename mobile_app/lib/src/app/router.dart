import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_screens.dart';
import '../features/home/home_screen.dart';
import '../features/host/host_screens.dart';
import '../features/library/library_screens.dart';
import '../features/player/player_screens.dart';
import '../features/students/student_screens.dart';
import '../models/domain_models.dart';
import '../widgets/app_shell.dart';
import 'auth_controller.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  bool isPublicPlayerPath(String path) {
    return path == '/join' ||
        path.startsWith('/join/') ||
        path == '/player/join' ||
        path.startsWith('/player/join/') ||
        path.startsWith('/player/waiting/') ||
        path.startsWith('/player/live/') ||
        path.startsWith('/player/result/') ||
        path.startsWith('/player/session/');
  }

  String resolveHome() {
    final role = authState.session?.role;
    if (role == AppRole.player) {
      return '/player/home';
    }
    return '/host/home';
  }

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final path = state.uri.path;
      final isAuthPage = path == '/login' || path == '/register';
      final isPendingPage = path == '/pending';
      final isPublicPage = isPublicPlayerPath(path);

      if (!authState.initialized) {
        return path == '/splash' ? null : '/splash';
      }

      if (path == '/splash') {
        if (!authState.isAuthenticated) {
          return '/login';
        }
        if (authState.isPending) {
          return '/pending';
        }
        return resolveHome();
      }

      if (!authState.isAuthenticated) {
        return isAuthPage || isPublicPage ? null : '/login';
      }

      if (authState.isPending && !isPublicPage) {
        return isPendingPage ? null : '/pending';
      }

      if (isAuthPage || isPendingPage) {
        return resolveHome();
      }

      final isPlayer = authState.session?.role == AppRole.player;
      if (path.startsWith('/host') &&
          isPlayer &&
          !path.startsWith('/host/results')) {
        return '/player/home';
      }

      if (path.startsWith('/player') &&
          !isPlayer &&
          !path.startsWith('/player/join') &&
          !path.startsWith('/player/waiting') &&
          !path.startsWith('/player/live') &&
          !path.startsWith('/player/result')) {
        return '/host/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/pending',
        builder: (context, state) => const PendingApprovalScreen(),
      ),
      GoRoute(
        path: '/join',
        builder: (context, state) => const JoinSessionScreen(),
      ),
      GoRoute(
        path: '/join/:code',
        builder: (context, state) =>
            JoinSessionScreen(initialCode: state.pathParameters['code']),
      ),
      GoRoute(
        path: '/player/join',
        builder: (context, state) => const JoinSessionScreen(),
      ),
      GoRoute(
        path: '/player/join/:code',
        builder: (context, state) =>
            JoinSessionScreen(initialCode: state.pathParameters['code']),
      ),
      GoRoute(
        path: '/player/waiting/:sessionId',
        builder: (context, state) => WaitingRoomScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
        ),
      ),
      GoRoute(
        path: '/player/session/:sessionId/waiting-room',
        builder: (context, state) => WaitingRoomScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
        ),
      ),
      GoRoute(
        path: '/player/live/:sessionId',
        builder: (context, state) => LiveQuestionScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
        ),
      ),
      GoRoute(
        path: '/player/session/:sessionId/live',
        builder: (context, state) => LiveQuestionScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
        ),
      ),
      GoRoute(
        path: '/player/result/:sessionId/:participantId',
        builder: (context, state) => LiveResultScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
          participantId: int.parse(state.pathParameters['participantId']!),
        ),
      ),
      GoRoute(
        path: '/player/session/:sessionId/result/:participantId',
        builder: (context, state) => LiveResultScreen(
          sessionId: int.parse(state.pathParameters['sessionId']!),
          participantId: int.parse(state.pathParameters['participantId']!),
        ),
      ),
      GoRoute(
        path: '/player/test-attempt/:attemptId',
        builder: (context, state) => TestAttemptScreen(
          attemptId: int.parse(state.pathParameters['attemptId']!),
        ),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return AppShell(currentLocation: state.uri.path, child: child);
        },
        routes: [
          GoRoute(path: '/', redirect: (context, state) => resolveHome()),
          GoRoute(
            path: '/player/home',
            builder: (context, state) => const PlayerHomeScreen(),
          ),
          GoRoute(
            path: '/player/live-sessions',
            builder: (context, state) => const PlayerLiveSessionsScreen(),
          ),
          GoRoute(
            path: '/player/tests',
            builder: (context, state) => const TestModeListScreen(),
          ),
          GoRoute(
            path: '/player/history',
            builder: (context, state) => const PlayerHistoryScreen(),
          ),
          GoRoute(
            path: '/host/home',
            builder: (context, state) => const HostHomeScreen(),
          ),
          GoRoute(
            path: '/host/sessions',
            builder: (context, state) => const SessionsScreen(),
          ),
          GoRoute(
            path: '/host/sessions/:sessionId/control',
            builder: (context, state) => SessionControlScreen(
              sessionId: int.parse(state.pathParameters['sessionId']!),
            ),
          ),
          GoRoute(
            path: '/host/results',
            builder: (context, state) => const ResultsScreen(),
          ),
          GoRoute(
            path: '/host/questions',
            builder: (context, state) => const QuestionsScreen(),
          ),
          GoRoute(
            path: '/host/questions/new',
            builder: (context, state) => const QuestionEditorScreen(),
          ),
          GoRoute(
            path: '/host/questions/:questionId/edit',
            builder: (context, state) => QuestionEditorScreen(
              questionId: int.parse(state.pathParameters['questionId']!),
            ),
          ),
          GoRoute(
            path: '/host/quizzes',
            builder: (context, state) => const QuizzesScreen(),
          ),
          GoRoute(
            path: '/host/quizzes/new',
            builder: (context, state) => const QuizEditorScreen(),
          ),
          GoRoute(
            path: '/host/quizzes/:quizId/edit',
            builder: (context, state) => QuizEditorScreen(
              quizId: int.parse(state.pathParameters['quizId']!),
            ),
          ),
          GoRoute(
            path: '/host/users',
            builder: (context, state) => const UsersManagementScreen(),
          ),
          GoRoute(
            path: '/host/groups',
            builder: (context, state) => const StudentGroupsScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
        ],
      ),
    ],
  );
});
