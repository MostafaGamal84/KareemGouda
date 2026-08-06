import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/domain_models.dart';
import 'api_client.dart';

final appRepositoryProvider = Provider<AppRepository>((ref) {
  return AppRepository(ref.watch(dioProvider));
});

class AppRepository {
  AppRepository(this._dio);

  final Dio _dio;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      '/auth/login',
      data: {'email': email.trim(), 'password': password},
    );
    final json = asMap(response.data);
    return AuthSession(
      token: readString(json, 'token'),
      email: readString(json, 'email'),
      userId: readInt(json, 'id'),
      firstName: readString(json, 'firstName'),
      lastName: readString(json, 'lastName'),
      role: AppRoleX.fromAny(
        readList(json, 'roles').isNotEmpty
            ? readList(json, 'roles').first
            : readString(json, 'role'),
      ),
      status: readInt(json, 'status', fallback: 1),
    );
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String role,
  }) async {
    await _dio.post(
      '/auth/register',
      data: {
        'email': email.trim(),
        'password': password,
        'firstName': firstName.trim(),
        'lastName': lastName.trim(),
        'role': role,
      },
    );
  }

  Future<List<QuestionItem>> getQuestions({
    int page = 1,
    int pageSize = 20,
    String search = '',
    int? type,
    int? categoryId,
  }) async {
    final response = await _dio.get(
      '/questions',
      queryParameters: {
        'pageNumber': page,
        'pageSize': pageSize,
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (type != null && type > 0) 'type': type,
        if (categoryId != null && categoryId > 0) 'categoryId': categoryId,
      },
    );

    final data = asMap(response.data);
    return readList(
      data,
      'items',
    ).map((item) => QuestionItem.fromJson(asMap(item))).toList();
  }

  Future<QuestionItem> getQuestionById(int id) async {
    final response = await _dio.get('/questions/$id');
    return QuestionItem.fromJson(asMap(response.data));
  }

  Future<List<CategoryRef>> getQuestionCategories() async {
    final response = await _dio.get('/question-categories');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => CategoryRef.fromJson(asMap(item))).toList();
  }

  Future<QuestionItem> createQuestion(Map<String, dynamic> payload) async {
    final response = await _dio.post('/questions', data: payload);
    return QuestionItem.fromJson(asMap(response.data));
  }

  Future<QuestionItem> updateQuestion(
    int id,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.put('/questions/$id', data: payload);
    return QuestionItem.fromJson(asMap(response.data));
  }

  Future<void> deleteQuestion(int id) async {
    await _dio.delete('/questions/$id');
  }

  Future<List<QuizItem>> getQuizzes({
    int? mode,
    int page = 1,
    int pageSize = 20,
    String search = '',
    String category = '',
  }) async {
    final response = await _dio.get(
      '/quizzes',
      queryParameters: {
        if (mode != null && mode > 0) 'mode': mode,
        'pageNumber': page,
        'pageSize': pageSize,
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (category.trim().isNotEmpty) 'category': category.trim(),
      },
    );
    final data = asMap(response.data);
    return readList(
      data,
      'items',
    ).map((item) => QuizItem.fromJson(asMap(item))).toList();
  }

  Future<QuizItem> getQuizById(int id) async {
    final response = await _dio.get('/quizzes/$id');
    return QuizItem.fromJson(asMap(response.data));
  }

  Future<List<CategoryRef>> getQuizCategories() async {
    final response = await _dio.get('/quizzes/categories');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => CategoryRef.fromJson(asMap(item))).toList();
  }

  Future<QuizItem> createQuiz(Map<String, dynamic> payload) async {
    final response = await _dio.post('/quizzes', data: payload);
    return QuizItem.fromJson(asMap(response.data));
  }

  Future<QuizItem> updateQuiz(int id, Map<String, dynamic> payload) async {
    final response = await _dio.put('/quizzes/$id', data: payload);
    return QuizItem.fromJson(asMap(response.data));
  }

  Future<void> deleteQuiz(int id) async {
    await _dio.delete('/quizzes/$id');
  }

  Future<void> publishQuiz(int id, bool isPublished) async {
    await _dio.put('/quizzes/$id/publish', data: {'isPublished': isPublished});
  }

  Future<void> addQuestionsToQuiz(
    int quizId,
    List<Map<String, dynamic>> items,
  ) async {
    await _dio.post('/quizzes/$quizId/questions', data: items);
  }

  Future<void> removeQuestionFromQuiz(int quizId, int quizQuestionId) async {
    await _dio.delete('/quizzes/$quizId/questions/$quizQuestionId');
  }

  Future<QuizAccessConfig?> getQuizAccess(int quizId) async {
    try {
      final response = await _dio.get('/quiz-access/quiz/$quizId');
      return QuizAccessConfig.fromJson(asMap(response.data));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<QuizAccessConfig> saveQuizAccess(
    int quizId,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.post(
      '/quiz-access/quiz/$quizId',
      data: payload,
    );
    return QuizAccessConfig.fromJson(asMap(response.data));
  }

  Future<List<StudentUser>> getAvailableStudentsForQuiz(int quizId) async {
    final response = await _dio.get(
      '/quiz-access/quiz/$quizId/available-students',
    );
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => StudentUser.fromJson(asMap(item))).toList();
  }

  Future<List<StudentGroup>> getAvailableGroupsForQuiz(int quizId) async {
    final response = await _dio.get(
      '/quiz-access/quiz/$quizId/available-groups',
    );
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => StudentGroup.fromJson(asMap(item))).toList();
  }

  Future<QuizAccessConfig> addUsersToQuizAccess(
    int quizId,
    List<int> userIds,
  ) async {
    final response = await _dio.post(
      '/quiz-access/quiz/$quizId/users',
      data: {'userIds': userIds},
    );
    return QuizAccessConfig.fromJson(asMap(response.data));
  }

  Future<QuizAccessConfig> removeUserFromQuizAccess(
    int quizId,
    int accessUserId,
  ) async {
    final response = await _dio.delete(
      '/quiz-access/quiz/$quizId/users/$accessUserId',
    );
    return QuizAccessConfig.fromJson(asMap(response.data));
  }

  Future<QuizAccessConfig> addGroupsToQuizAccess(
    int quizId,
    List<int> groupIds,
  ) async {
    final response = await _dio.post(
      '/quiz-access/quiz/$quizId/groups',
      data: {'groupIds': groupIds},
    );
    return QuizAccessConfig.fromJson(asMap(response.data));
  }

  Future<QuizAccessConfig> removeGroupFromQuizAccess(
    int quizId,
    int accessGroupId,
  ) async {
    final response = await _dio.delete(
      '/quiz-access/quiz/$quizId/groups/$accessGroupId',
    );
    return QuizAccessConfig.fromJson(asMap(response.data));
  }

  Future<List<GameSessionItem>> getSessions() async {
    final response = await _dio.get('/game-sessions');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => GameSessionItem.fromJson(asMap(item))).toList();
  }

  Future<GameSessionItem> createSession(Map<String, dynamic> payload) async {
    final response = await _dio.post('/game-sessions', data: payload);
    return GameSessionItem.fromJson(asMap(response.data));
  }

  Future<GameSessionItem> getSessionById(int id) async {
    final response = await _dio.get('/game-sessions/$id');
    return GameSessionItem.fromJson(asMap(response.data));
  }

  Future<GameSessionItem> getSessionByCode(String code) async {
    try {
      final response = await _dio.get(
        '/game-sessions/by-code/${code.toUpperCase()}',
      );
      return GameSessionItem.fromJson(asMap(response.data));
    } on DioException catch (error) {
      throw AppException(
        _messageFromDio(error, fallback: 'Session not found.'),
      );
    }
  }

  Future<SessionState> getSessionState(int id) async {
    final response = await _dio.get('/game-sessions/$id/state');
    return SessionState.fromJson(asMap(response.data));
  }

  Future<List<LeaderboardEntry>> getSessionLeaderboard(int id) async {
    final response = await _dio.get('/game-sessions/$id/leaderboard');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => LeaderboardEntry.fromJson(asMap(item))).toList();
  }

  Future<List<JoinRequest>> getJoinRequests(int id) async {
    final response = await _dio.get('/game-sessions/$id/join-requests');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => JoinRequest.fromJson(asMap(item))).toList();
  }

  Future<void> startSession(int id) async =>
      _dio.post('/game-sessions/$id/start');
  Future<void> pauseSession(int id) async =>
      _dio.post('/game-sessions/$id/pause');
  Future<void> resumeSession(int id) async =>
      _dio.post('/game-sessions/$id/resume');
  Future<void> nextQuestion(int id) async =>
      _dio.post('/game-sessions/$id/next-question');
  Future<void> endSession(int id) async => _dio.post('/game-sessions/$id/end');
  Future<void> deleteSession(int id) async => _dio.delete('/game-sessions/$id');

  Future<void> approveJoinRequest(int sessionId, int participantId) async {
    await _dio.post(
      '/game-sessions/$sessionId/join-requests/$participantId/approve',
    );
  }

  Future<void> rejectJoinRequest(
    int sessionId,
    int participantId, {
    String note = '',
  }) async {
    await _dio.post(
      '/game-sessions/$sessionId/join-requests/$participantId/reject',
      data: {'decisionNote': note.trim().isEmpty ? null : note.trim()},
    );
  }

  Future<List<LiveSessionBrowseItem>> getLiveSessionsBrowse() async {
    final response = await _dio.get('/player/live-sessions');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw
        .map((item) => LiveSessionBrowseItem.fromJson(asMap(item)))
        .toList();
  }

  Future<PlayerJoinResponse> joinSession({
    required String joinCode,
    required String displayName,
    String? email,
  }) async {
    try {
      final response = await _dio.post(
        '/player/join',
        data: {
          'joinCode': joinCode.trim().toUpperCase(),
          'displayName': displayName.trim(),
          if (email != null && email.trim().isNotEmpty) 'email': email.trim(),
        },
      );
      return PlayerJoinResponse.fromJson(asMap(response.data));
    } on DioException catch (error) {
      throw AppException(
        _messageFromDio(error, fallback: 'Unable to join the session.'),
      );
    }
  }

  Future<WaitingRoom> getWaitingRoom(int sessionId) async {
    final response = await _dio.get('/player/session/$sessionId/waiting-room');
    return WaitingRoom.fromJson(asMap(response.data));
  }

  Future<ParticipantStatus> getParticipantStatus({
    required int sessionId,
    required int participantId,
    required String token,
  }) async {
    final response = await _dio.get(
      '/player/session/$sessionId/participant/$participantId/status',
      queryParameters: {'token': token},
    );
    return ParticipantStatus.fromJson(asMap(response.data));
  }

  Future<Map<String, dynamic>> submitLiveAnswer(
    int sessionId,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.post(
      '/player/session/$sessionId/submit-answer',
      data: payload,
    );
    return asMap(response.data);
  }

  Future<void> leaveSession({
    required int sessionId,
    required int participantId,
    required String participantToken,
  }) async {
    await _dio.post(
      '/player/session/$sessionId/leave',
      data: {
        'participantId': participantId,
        'participantToken': participantToken,
      },
    );
  }

  Future<List<LeaderboardEntry>> getPlayerLeaderboard(int sessionId) async {
    final response = await _dio.get('/player/session/$sessionId/leaderboard');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => LeaderboardEntry.fromJson(asMap(item))).toList();
  }

  Future<ParticipantResult> getPlayerResult(
    int sessionId,
    int participantId,
  ) async {
    final response = await _dio.get(
      '/player/session/$sessionId/result/$participantId',
    );
    return ParticipantResult.fromJson(asMap(response.data));
  }

  Future<PagedResponse<QuizItem>> getTestModeQuizzes({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await _dio.get(
      '/test-mode/quizzes',
      queryParameters: {'pageNumber': page, 'pageSize': pageSize},
    );
    final data = asMap(response.data);
    return PagedResponse(
      pageNumber: readInt(data, 'pageNumber', fallback: page),
      pageSize: readInt(data, 'pageSize', fallback: pageSize),
      totalCount: readInt(data, 'totalCount'),
      items: readList(
        data,
        'items',
      ).map((item) => QuizItem.fromJson(asMap(item))).toList(),
    );
  }

  Future<int> startTestAttempt(int quizId) async {
    final response = await _dio.post(
      '/test-mode/quizzes/$quizId/start',
      data: {},
    );
    final json = asMap(response.data);
    return readInt(json, 'attemptId');
  }

  Future<TestAttemptOverview> getTestOverview(int attemptId) async {
    final response = await _dio.get('/test-mode/attempts/$attemptId/overview');
    return TestAttemptOverview.fromJson(asMap(response.data));
  }

  Future<TestQuestionView> getTestQuestion(
    int attemptId, {
    int? questionIndex,
  }) async {
    final response = await _dio.get(
      '/test-mode/attempts/$attemptId/current-question',
      queryParameters: {
        if (questionIndex != null) // ignore: use_null_aware_elements
          'questionIndex': questionIndex,
      },
    );
    return TestQuestionView.fromJson(asMap(response.data));
  }

  Future<Map<String, dynamic>> submitTestAnswer(
    int attemptId,
    Map<String, dynamic> payload,
  ) async {
    final response = await _dio.post(
      '/test-mode/attempts/$attemptId/submit-answer',
      data: payload,
    );
    return asMap(response.data);
  }

  Future<TestAttemptResult> finishTestAttempt(
    int attemptId, {
    List<Map<String, dynamic>> answers = const [],
  }) async {
    final response = await _dio.post(
      '/test-mode/attempts/$attemptId/finish',
      data: {'answers': answers},
    );
    return TestAttemptResult.fromJson(asMap(response.data));
  }

  Future<TestAttemptResult> getTestResult(int attemptId) async {
    final response = await _dio.get('/test-mode/attempts/$attemptId/result');
    return TestAttemptResult.fromJson(asMap(response.data));
  }

  Future<List<PlayerTestHistoryItem>> getMyTestHistory() async {
    final response = await _dio.get('/test-mode/history/me');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw
        .map((item) => PlayerTestHistoryItem.fromJson(asMap(item)))
        .toList();
  }

  Future<List<PlayerSessionHistoryItem>> getMyLiveHistory() async {
    final response = await _dio.get('/results/player/history');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw
        .map((item) => PlayerSessionHistoryItem.fromJson(asMap(item)))
        .toList();
  }

  Future<PagedResponse<StudentUser>> getStudents({
    int page = 1,
    int pageSize = 20,
    String search = '',
    int? status,
    int? groupId,
    String role = '',
  }) async {
    final response = await _dio.get(
      '/student-groups/students',
      queryParameters: {
        'pageNumber': page,
        'pageSize': pageSize,
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (status != null) // ignore: use_null_aware_elements
          'status': status,
        if (groupId != null) // ignore: use_null_aware_elements
          'groupId': groupId,
        if (role.trim().isNotEmpty) 'role': role.trim(),
      },
    );
    final data = asMap(response.data);
    return PagedResponse(
      pageNumber: readInt(data, 'pageNumber', fallback: page),
      pageSize: readInt(data, 'pageSize', fallback: pageSize),
      totalCount: readInt(data, 'totalCount'),
      items: readList(
        data,
        'items',
      ).map((item) => StudentUser.fromJson(asMap(item))).toList(),
    );
  }

  Future<void> approveStudent(int userId, int status) async {
    await _dio.post(
      '/student-groups/students/approve',
      data: {'userId': userId, 'status': status},
    );
  }

  Future<void> bulkApproveStudents(List<int> ids) async {
    await _dio.post('/student-groups/students/bulk-approve', data: ids);
  }

  Future<void> bulkRejectStudents(List<int> ids) async {
    await _dio.post('/student-groups/students/bulk-reject', data: ids);
  }

  Future<PagedResponse<StudentGroup>> getGroups({
    int page = 1,
    int pageSize = 20,
    String search = '',
  }) async {
    final response = await _dio.get(
      '/student-groups',
      queryParameters: {
        'pageNumber': page,
        'pageSize': pageSize,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    final data = asMap(response.data);
    return PagedResponse(
      pageNumber: readInt(data, 'pageNumber', fallback: page),
      pageSize: readInt(data, 'pageSize', fallback: pageSize),
      totalCount: readInt(data, 'totalCount'),
      items: readList(
        data,
        'items',
      ).map((item) => StudentGroup.fromJson(asMap(item))).toList(),
    );
  }

  Future<StudentGroup> getGroupById(int id) async {
    final response = await _dio.get('/student-groups/$id');
    return StudentGroup.fromJson(asMap(response.data));
  }

  Future<StudentGroup> createGroup({
    required String name,
    String description = '',
  }) async {
    final response = await _dio.post(
      '/student-groups',
      data: {
        'name': name.trim(),
        'description': description.trim().isEmpty ? null : description.trim(),
      },
    );
    return StudentGroup.fromJson(asMap(response.data));
  }

  Future<StudentGroup> updateGroup({
    required int groupId,
    required String name,
    String description = '',
  }) async {
    final response = await _dio.put(
      '/student-groups/$groupId',
      data: {
        'name': name.trim(),
        'description': description.trim().isEmpty ? null : description.trim(),
      },
    );
    return StudentGroup.fromJson(asMap(response.data));
  }

  Future<void> deleteGroup(int id) async {
    await _dio.delete('/student-groups/$id');
  }

  Future<StudentGroup> addMembersToGroup(int groupId, List<int> userIds) async {
    final response = await _dio.post(
      '/student-groups/$groupId/members',
      data: {'userIds': userIds},
    );
    return StudentGroup.fromJson(asMap(response.data));
  }

  Future<StudentGroup> removeMemberFromGroup(int groupId, int memberId) async {
    final response = await _dio.delete(
      '/student-groups/$groupId/members/$memberId',
    );
    return StudentGroup.fromJson(asMap(response.data));
  }

  Future<List<Map<String, dynamic>>> getUsersWithPermissions() async {
    final response = await _dio.get('/permissions/users');
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw.map((item) => asMap(item)).toList();
  }

  Future<void> setPermissions(int userId, Map<String, bool> permissions) async {
    await _dio.post(
      '/permissions/user/$userId',
      data: {'permissions': permissions},
    );
  }

  Future<Map<String, bool>> getPermissions(int userId) async {
    final response = await _dio.get('/permissions/user/$userId');
    final map = asMap(response.data);
    return map.map((key, value) => MapEntry(key, readBoolValue(value)));
  }

  Future<Map<String, dynamic>> getSessionResultsSummary(int sessionId) async {
    final response = await _dio.get('/results/game-sessions/$sessionId');
    return asMap(response.data);
  }

  Future<List<SessionParticipantResult>> getSessionParticipantsResults(
    int sessionId,
  ) async {
    final response = await _dio.get(
      '/results/game-sessions/$sessionId/participants',
    );
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw
        .map((item) => SessionParticipantResult.fromJson(asMap(item)))
        .toList();
  }

  Future<List<SessionQuestionAnalysis>> getSessionQuestionsAnalysis(
    int sessionId,
  ) async {
    final response = await _dio.get(
      '/results/game-sessions/$sessionId/questions-analysis',
    );
    final raw = response.data is List
        ? response.data as List
        : readList(asMap(response.data), 'items');
    return raw
        .map((item) => SessionQuestionAnalysis.fromJson(asMap(item)))
        .toList();
  }

  String _messageFromDio(DioException error, {required String fallback}) {
    final data = error.response?.data;
    if (data is Map) {
      final json = asMap(data);
      final message = readString(json, 'message');
      if (message.trim().isNotEmpty) {
        return message;
      }
    }
    return fallback;
  }
}
