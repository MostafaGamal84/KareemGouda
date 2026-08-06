import 'dart:convert';

enum AppRole { admin, host, player }

extension AppRoleX on AppRole {
  static AppRole fromAny(Object? value) {
    switch ('$value'.toLowerCase()) {
      case 'admin':
        return AppRole.admin;
      case 'player':
        return AppRole.player;
      default:
        return AppRole.host;
    }
  }

  String get label {
    switch (this) {
      case AppRole.admin:
        return 'Admin';
      case AppRole.host:
        return 'Host';
      case AppRole.player:
        return 'Player';
    }
  }

  String get apiValue => label;
}

class AppException implements Exception {
  AppException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AuthSession {
  AuthSession({
    required this.token,
    required this.email,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.status,
  });

  final String token;
  final String email;
  final int userId;
  final String firstName;
  final String lastName;
  final AppRole role;
  final int status;

  String get fullName => '$firstName $lastName'.trim();
}

class ParticipantSession {
  ParticipantSession({
    required this.participantId,
    required this.sessionId,
    required this.participantToken,
    required this.displayName,
    required this.joinStatus,
  });

  final int participantId;
  final int sessionId;
  final String participantToken;
  final String displayName;
  final int joinStatus;
}

class PagedResponse<T> {
  PagedResponse({
    required this.pageNumber,
    required this.pageSize,
    required this.totalCount,
    required this.items,
  });

  final int pageNumber;
  final int pageSize;
  final int totalCount;
  final List<T> items;
}

class CategoryRef {
  CategoryRef({required this.id, required this.name});

  final int id;
  final String name;

  factory CategoryRef.fromJson(Map<String, dynamic> json) {
    return CategoryRef(id: readInt(json, 'id'), name: readString(json, 'name'));
  }
}

class QuestionChoice {
  QuestionChoice({
    required this.id,
    required this.choiceText,
    required this.imageUrl,
    required this.hasImage,
    required this.isCorrect,
    required this.order,
  });

  final int id;
  final String choiceText;
  final String imageUrl;
  final bool hasImage;
  final bool isCorrect;
  final int order;

  factory QuestionChoice.fromJson(Map<String, dynamic> json) {
    return QuestionChoice(
      id: readInt(json, 'id'),
      choiceText: readString(json, 'choiceText'),
      imageUrl: readString(json, 'imageUrl'),
      hasImage: readBool(json, 'hasImage'),
      isCorrect: readBool(json, 'isCorrect'),
      order: readInt(json, 'order'),
    );
  }

  Map<String, dynamic> toRequestJson() {
    return {
      'id': id > 0 ? id : 0,
      'choiceText': choiceText,
      'isCorrect': isCorrect,
      'order': order,
      'hasImage': hasImage,
    };
  }
}

class QuestionItem {
  QuestionItem({
    required this.id,
    required this.title,
    required this.text,
    required this.type,
    required this.selectionMode,
    required this.difficulty,
    required this.imageUrl,
    required this.explanation,
    required this.points,
    required this.answerSeconds,
    required this.categoryId,
    required this.categoryName,
    required this.categories,
    required this.quizId,
    required this.quizTitle,
    required this.isOwnedByQuiz,
    required this.choices,
  });

  final int id;
  final String title;
  final String text;
  final int type;
  final int selectionMode;
  final String difficulty;
  final String imageUrl;
  final String explanation;
  final int points;
  final int answerSeconds;
  final int? categoryId;
  final String categoryName;
  final List<CategoryRef> categories;
  final int? quizId;
  final String quizTitle;
  final bool isOwnedByQuiz;
  final List<QuestionChoice> choices;

  factory QuestionItem.fromJson(Map<String, dynamic> json) {
    return QuestionItem(
      id: readInt(json, 'id'),
      title: readString(json, 'title'),
      text: readString(json, 'text'),
      type: readInt(json, 'type'),
      selectionMode: readInt(json, 'selectionMode', fallback: 1),
      difficulty: readString(json, 'difficulty'),
      imageUrl: readString(json, 'imageUrl'),
      explanation: readString(json, 'explanation'),
      points: readInt(json, 'points'),
      answerSeconds: readInt(json, 'answerSeconds', fallback: 30),
      categoryId: readNullableInt(json, 'categoryId'),
      categoryName: readString(json, 'categoryName'),
      categories: readList(
        json,
        'categories',
      ).map((item) => CategoryRef.fromJson(asMap(item))).toList(),
      quizId: readNullableInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      isOwnedByQuiz: readBool(json, 'isOwnedByQuiz'),
      choices: readList(
        json,
        'choices',
      ).map((item) => QuestionChoice.fromJson(asMap(item))).toList(),
    );
  }

  Map<String, dynamic> toRequestJson() {
    return {
      'title': title,
      'text': text,
      'type': type,
      'selectionMode': selectionMode,
      'difficulty': difficulty.isEmpty ? null : difficulty,
      'explanation': explanation.isEmpty ? null : explanation,
      'points': points,
      'answerSeconds': answerSeconds,
      'categoryIds': categories.map((category) => category.id).toList(),
      'choices': choices.map((choice) => choice.toRequestJson()).toList(),
    };
  }
}

class QuizQuestionAssignment {
  QuizQuestionAssignment({
    required this.id,
    required this.questionId,
    required this.questionTitle,
    required this.order,
    required this.pointsOverride,
    required this.answerSeconds,
    this.question,
  });

  final int id;
  final int questionId;
  final String questionTitle;
  final int order;
  final int? pointsOverride;
  final int answerSeconds;
  final QuestionItem? question;

  factory QuizQuestionAssignment.fromJson(Map<String, dynamic> json) {
    final rawQuestion = readObject(json, 'question');
    return QuizQuestionAssignment(
      id: readInt(json, 'id'),
      questionId: readInt(json, 'questionId'),
      questionTitle: readString(json, 'questionTitle'),
      order: readInt(json, 'order'),
      pointsOverride: readNullableInt(json, 'pointsOverride'),
      answerSeconds: readInt(json, 'answerSeconds', fallback: 30),
      question: rawQuestion == null ? null : QuestionItem.fromJson(rawQuestion),
    );
  }
}

class QuizItem {
  QuizItem({
    required this.id,
    required this.title,
    required this.description,
    required this.coverImageUrl,
    required this.mode,
    required this.durationMinutes,
    required this.totalMarks,
    required this.effectiveTotalMarks,
    required this.isPublished,
    required this.examMode,
    required this.accessType,
    required this.questionsCount,
    required this.categories,
    required this.questions,
  });

  final int id;
  final String title;
  final String description;
  final String coverImageUrl;
  final int mode;
  final int durationMinutes;
  final int? totalMarks;
  final int effectiveTotalMarks;
  final bool isPublished;
  final int? examMode;
  final int? accessType;
  final int questionsCount;
  final List<CategoryRef> categories;
  final List<QuizQuestionAssignment> questions;

  factory QuizItem.fromJson(Map<String, dynamic> json) {
    return QuizItem(
      id: readInt(json, 'id'),
      title: readString(json, 'title'),
      description: readString(json, 'description'),
      coverImageUrl: readString(json, 'coverImageUrl'),
      mode: readInt(json, 'mode'),
      durationMinutes: readInt(json, 'durationMinutes'),
      totalMarks: readNullableInt(json, 'totalMarks'),
      effectiveTotalMarks: readInt(json, 'effectiveTotalMarks'),
      isPublished: readBool(json, 'isPublished'),
      examMode: readNullableInt(json, 'examMode'),
      accessType: readNullableInt(json, 'accessType'),
      questionsCount: readInt(json, 'questionsCount'),
      categories: readList(
        json,
        'categories',
      ).map((item) => CategoryRef.fromJson(asMap(item))).toList(),
      questions: readList(
        json,
        'questions',
      ).map((item) => QuizQuestionAssignment.fromJson(asMap(item))).toList(),
    );
  }
}

class QuizAccessConfig {
  QuizAccessConfig({
    required this.id,
    required this.quizId,
    required this.examMode,
    required this.accessType,
    required this.maxAttempts,
    required this.scheduledStartTime,
    required this.scheduledEndTime,
    required this.timerMinutes,
    required this.accessUsers,
    required this.accessGroups,
  });

  final int id;
  final int quizId;
  final int examMode;
  final int accessType;
  final int maxAttempts;
  final String scheduledStartTime;
  final String scheduledEndTime;
  final int? timerMinutes;
  final List<QuizAccessUser> accessUsers;
  final List<QuizAccessGroup> accessGroups;

  factory QuizAccessConfig.fromJson(Map<String, dynamic> json) {
    return QuizAccessConfig(
      id: readInt(json, 'id'),
      quizId: readInt(json, 'quizId'),
      examMode: readInt(json, 'examMode'),
      accessType: readInt(json, 'accessType'),
      maxAttempts: readInt(json, 'maxAttempts', fallback: 1),
      scheduledStartTime: readString(json, 'scheduledStartTime'),
      scheduledEndTime: readString(json, 'scheduledEndTime'),
      timerMinutes: readNullableInt(json, 'timerMinutes'),
      accessUsers: readList(
        json,
        'accessUsers',
      ).map((item) => QuizAccessUser.fromJson(asMap(item))).toList(),
      accessGroups: readList(
        json,
        'accessGroups',
      ).map((item) => QuizAccessGroup.fromJson(asMap(item))).toList(),
    );
  }
}

class QuizAccessUser {
  QuizAccessUser({
    required this.id,
    required this.userId,
    required this.userName,
    required this.email,
    required this.status,
    required this.statusName,
    required this.attemptCount,
    required this.extraAttemptsApproved,
  });

  final int id;
  final int userId;
  final String userName;
  final String email;
  final int status;
  final String statusName;
  final int attemptCount;
  final bool extraAttemptsApproved;

  factory QuizAccessUser.fromJson(Map<String, dynamic> json) {
    return QuizAccessUser(
      id: readInt(json, 'id'),
      userId: readInt(json, 'userId'),
      userName: readString(json, 'userName'),
      email: readString(json, 'email'),
      status: readInt(json, 'status'),
      statusName: readString(json, 'statusName'),
      attemptCount: readInt(json, 'attemptCount'),
      extraAttemptsApproved: readBool(json, 'extraAttemptsApproved'),
    );
  }
}

class QuizAccessGroup {
  QuizAccessGroup({
    required this.id,
    required this.studentGroupId,
    required this.groupName,
    required this.membersCount,
  });

  final int id;
  final int studentGroupId;
  final String groupName;
  final int membersCount;

  factory QuizAccessGroup.fromJson(Map<String, dynamic> json) {
    return QuizAccessGroup(
      id: readInt(json, 'id'),
      studentGroupId: readInt(json, 'studentGroupId'),
      groupName: readString(json, 'groupName'),
      membersCount: readInt(json, 'membersCount'),
    );
  }
}

class GameSessionItem {
  GameSessionItem({
    required this.id,
    required this.quizId,
    required this.quizTitle,
    required this.quizCoverImageUrl,
    required this.joinCode,
    required this.joinLink,
    required this.status,
    required this.accessType,
    required this.questionFlowMode,
    required this.scheduledStartAt,
    required this.scheduledEndAt,
    required this.durationMinutes,
    required this.currentQuestionIndex,
    required this.participantsCount,
    required this.categories,
    required this.allowedUserIds,
  });

  final int id;
  final int quizId;
  final String quizTitle;
  final String quizCoverImageUrl;
  final String joinCode;
  final String joinLink;
  final int status;
  final int accessType;
  final int questionFlowMode;
  final String scheduledStartAt;
  final String scheduledEndAt;
  final int? durationMinutes;
  final int currentQuestionIndex;
  final int participantsCount;
  final List<CategoryRef> categories;
  final List<int> allowedUserIds;

  factory GameSessionItem.fromJson(Map<String, dynamic> json) {
    return GameSessionItem(
      id: readInt(json, 'id'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      quizCoverImageUrl: readString(json, 'quizCoverImageUrl'),
      joinCode: readString(json, 'joinCode'),
      joinLink: readString(json, 'joinLink'),
      status: readInt(json, 'status'),
      accessType: readInt(json, 'accessType'),
      questionFlowMode: readInt(json, 'questionFlowMode', fallback: 1),
      scheduledStartAt: readString(json, 'scheduledStartAt'),
      scheduledEndAt: readString(json, 'scheduledEndAt'),
      durationMinutes: readNullableInt(json, 'durationMinutes'),
      currentQuestionIndex: readInt(json, 'currentQuestionIndex'),
      participantsCount: readInt(json, 'participantsCount'),
      categories: readList(
        json,
        'categories',
      ).map((item) => CategoryRef.fromJson(asMap(item))).toList(),
      allowedUserIds: readList(
        json,
        'allowedUserIds',
      ).map((item) => readIntValue(item)).where((item) => item > 0).toList(),
    );
  }
}

class SessionState {
  SessionState({
    required this.sessionId,
    required this.quizId,
    required this.quizTitle,
    required this.quizCoverImageUrl,
    required this.status,
    required this.accessType,
    required this.questionFlowMode,
    required this.currentQuestionIndex,
    required this.totalQuestions,
    required this.currentQuestionDurationSeconds,
    required this.currentQuestionEndsAtUtc,
    required this.participantsCount,
    this.currentQuestion,
    this.nextQuestion,
  });

  final int sessionId;
  final int quizId;
  final String quizTitle;
  final String quizCoverImageUrl;
  final int status;
  final int accessType;
  final int questionFlowMode;
  final int currentQuestionIndex;
  final int totalQuestions;
  final int? currentQuestionDurationSeconds;
  final String currentQuestionEndsAtUtc;
  final int participantsCount;
  final QuestionItem? currentQuestion;
  final QuestionItem? nextQuestion;

  factory SessionState.fromJson(Map<String, dynamic> json) {
    final current = readObject(json, 'currentQuestion');
    final next = readObject(json, 'nextQuestion');
    return SessionState(
      sessionId: readInt(json, 'sessionId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      quizCoverImageUrl: readString(json, 'quizCoverImageUrl'),
      status: readInt(json, 'status'),
      accessType: readInt(json, 'accessType'),
      questionFlowMode: readInt(json, 'questionFlowMode'),
      currentQuestionIndex: readInt(json, 'currentQuestionIndex'),
      totalQuestions: readInt(json, 'totalQuestions'),
      currentQuestionDurationSeconds: readNullableInt(
        json,
        'currentQuestionDurationSeconds',
      ),
      currentQuestionEndsAtUtc: readString(json, 'currentQuestionEndsAtUtc'),
      participantsCount: readInt(json, 'participantsCount'),
      currentQuestion: current == null ? null : QuestionItem.fromJson(current),
      nextQuestion: next == null ? null : QuestionItem.fromJson(next),
    );
  }
}

class JoinRequest {
  JoinRequest({
    required this.participantId,
    required this.displayName,
    required this.email,
    required this.joinStatus,
    required this.requestedAt,
    required this.decisionNote,
  });

  final int participantId;
  final String displayName;
  final String email;
  final int joinStatus;
  final String requestedAt;
  final String decisionNote;

  factory JoinRequest.fromJson(Map<String, dynamic> json) {
    return JoinRequest(
      participantId: readInt(json, 'participantId'),
      displayName: readString(json, 'displayName'),
      email: readString(json, 'email'),
      joinStatus: readInt(json, 'joinStatus'),
      requestedAt: readString(json, 'requestedAt'),
      decisionNote: readString(json, 'decisionNote'),
    );
  }
}

class LeaderboardEntry {
  LeaderboardEntry({
    required this.participantId,
    required this.displayName,
    required this.totalScore,
    required this.rank,
  });

  final int participantId;
  final String displayName;
  final int totalScore;
  final int rank;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      participantId: readInt(json, 'participantId'),
      displayName: readString(json, 'displayName'),
      totalScore: readInt(json, 'totalScore'),
      rank: readInt(json, 'rank'),
    );
  }
}

class WaitingRoom {
  WaitingRoom({
    required this.sessionId,
    required this.sessionStatus,
    required this.quizTitle,
    required this.participantsCount,
    required this.players,
  });

  final int sessionId;
  final String sessionStatus;
  final String quizTitle;
  final int participantsCount;
  final List<WaitingRoomPlayer> players;

  factory WaitingRoom.fromJson(Map<String, dynamic> json) {
    return WaitingRoom(
      sessionId: readInt(json, 'sessionId'),
      sessionStatus: readString(json, 'sessionStatus'),
      quizTitle: readString(json, 'quizTitle'),
      participantsCount: readInt(json, 'participantsCount'),
      players: readList(
        json,
        'players',
      ).map((item) => WaitingRoomPlayer.fromJson(asMap(item))).toList(),
    );
  }
}

class WaitingRoomPlayer {
  WaitingRoomPlayer({required this.displayName, required this.email});

  final String displayName;
  final String email;

  factory WaitingRoomPlayer.fromJson(Map<String, dynamic> json) {
    return WaitingRoomPlayer(
      displayName: readString(json, 'displayName'),
      email: readString(json, 'email'),
    );
  }
}

class PlayerJoinResponse {
  PlayerJoinResponse({
    required this.participantId,
    required this.participantToken,
    required this.sessionId,
    required this.displayName,
    required this.joinStatus,
    required this.requiresApproval,
  });

  final int participantId;
  final String participantToken;
  final int sessionId;
  final String displayName;
  final int joinStatus;
  final bool requiresApproval;

  factory PlayerJoinResponse.fromJson(Map<String, dynamic> json) {
    return PlayerJoinResponse(
      participantId: readInt(json, 'participantId'),
      participantToken: readString(json, 'participantToken'),
      sessionId: readInt(json, 'sessionId'),
      displayName: readString(json, 'displayName'),
      joinStatus: readInt(json, 'joinStatus'),
      requiresApproval: readBool(json, 'requiresApproval'),
    );
  }
}

class ParticipantStatus {
  ParticipantStatus({
    required this.participantId,
    required this.sessionId,
    required this.displayName,
    required this.email,
    required this.joinStatus,
    required this.decisionNote,
  });

  final int participantId;
  final int sessionId;
  final String displayName;
  final String email;
  final int joinStatus;
  final String decisionNote;

  factory ParticipantStatus.fromJson(Map<String, dynamic> json) {
    return ParticipantStatus(
      participantId: readInt(json, 'participantId'),
      sessionId: readInt(json, 'sessionId'),
      displayName: readString(json, 'displayName'),
      email: readString(json, 'email'),
      joinStatus: readInt(json, 'joinStatus'),
      decisionNote: readString(json, 'decisionNote'),
    );
  }
}

class ParticipantResult {
  ParticipantResult({
    required this.participantId,
    required this.displayName,
    required this.totalScore,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.averageResponseTimeMs,
  });

  final int participantId;
  final String displayName;
  final int totalScore;
  final int correctAnswers;
  final int wrongAnswers;
  final double averageResponseTimeMs;

  factory ParticipantResult.fromJson(Map<String, dynamic> json) {
    return ParticipantResult(
      participantId: readInt(json, 'participantId'),
      displayName: readString(json, 'displayName'),
      totalScore: readInt(json, 'totalScore'),
      correctAnswers: readInt(json, 'correctAnswers'),
      wrongAnswers: readInt(json, 'wrongAnswers'),
      averageResponseTimeMs: readDouble(json, 'averageResponseTimeMs'),
    );
  }
}

class LiveSessionBrowseItem {
  LiveSessionBrowseItem({
    required this.sessionId,
    required this.quizId,
    required this.quizTitle,
    required this.status,
    required this.accessType,
    required this.joinCode,
    required this.joinLink,
    required this.canJoin,
    required this.joinHint,
  });

  final int sessionId;
  final int quizId;
  final String quizTitle;
  final int status;
  final int accessType;
  final String joinCode;
  final String joinLink;
  final bool canJoin;
  final String joinHint;

  factory LiveSessionBrowseItem.fromJson(Map<String, dynamic> json) {
    return LiveSessionBrowseItem(
      sessionId: readInt(json, 'sessionId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      status: readInt(json, 'status'),
      accessType: readInt(json, 'accessType'),
      joinCode: readString(json, 'joinCode'),
      joinLink: readString(json, 'joinLink'),
      canJoin: readBool(json, 'canJoin'),
      joinHint: readString(json, 'joinHint'),
    );
  }
}

class TestAttemptOverview {
  TestAttemptOverview({
    required this.attemptId,
    required this.quizId,
    required this.quizTitle,
    required this.isFinished,
    required this.durationMinutes,
    required this.currentQuestionIndex,
    required this.totalQuestions,
    required this.answeredQuestions,
    required this.remainingQuestions,
    required this.timerStartedAt,
    required this.elapsedSeconds,
    required this.questions,
  });

  final int attemptId;
  final int quizId;
  final String quizTitle;
  final bool isFinished;
  final int durationMinutes;
  final int currentQuestionIndex;
  final int totalQuestions;
  final int answeredQuestions;
  final int remainingQuestions;
  final String timerStartedAt;
  final int elapsedSeconds;
  final List<TestAttemptQuestionItem> questions;

  factory TestAttemptOverview.fromJson(Map<String, dynamic> json) {
    return TestAttemptOverview(
      attemptId: readInt(json, 'attemptId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      isFinished: readBool(json, 'isFinished'),
      durationMinutes: readInt(json, 'durationMinutes'),
      currentQuestionIndex: readInt(json, 'currentQuestionIndex'),
      totalQuestions: readInt(json, 'totalQuestions'),
      answeredQuestions: readInt(json, 'answeredQuestions'),
      remainingQuestions: readInt(json, 'remainingQuestions'),
      timerStartedAt: readString(json, 'timerStartedAt'),
      elapsedSeconds: readInt(json, 'elapsedSeconds'),
      questions: readList(
        json,
        'questions',
      ).map((item) => TestAttemptQuestionItem.fromJson(asMap(item))).toList(),
    );
  }
}

class TestAttemptQuestionItem {
  TestAttemptQuestionItem({
    required this.questionIndex,
    required this.questionId,
    required this.title,
    required this.isAnswered,
    required this.isCurrent,
  });

  final int questionIndex;
  final int questionId;
  final String title;
  final bool isAnswered;
  final bool isCurrent;

  factory TestAttemptQuestionItem.fromJson(Map<String, dynamic> json) {
    return TestAttemptQuestionItem(
      questionIndex: readInt(json, 'questionIndex'),
      questionId: readInt(json, 'questionId'),
      title: readString(json, 'title'),
      isAnswered: readBool(json, 'isAnswered'),
      isCurrent: readBool(json, 'isCurrent'),
    );
  }
}

class TestQuestionView {
  TestQuestionView({
    required this.questionIndex,
    required this.totalQuestions,
    required this.isAnswered,
    required this.selectedChoiceId,
    required this.selectedChoiceIds,
    required this.textAnswer,
    required this.isCorrect,
    required this.correctChoiceId,
    required this.correctChoiceIds,
    required this.question,
  });

  final int questionIndex;
  final int totalQuestions;
  final bool isAnswered;
  final int? selectedChoiceId;
  final List<int> selectedChoiceIds;
  final String textAnswer;
  final bool? isCorrect;
  final int? correctChoiceId;
  final List<int> correctChoiceIds;
  final QuestionItem question;

  factory TestQuestionView.fromJson(Map<String, dynamic> json) {
    return TestQuestionView(
      questionIndex: readInt(json, 'questionIndex'),
      totalQuestions: readInt(json, 'totalQuestions'),
      isAnswered: readBool(json, 'isAnswered'),
      selectedChoiceId: readNullableInt(json, 'selectedChoiceId'),
      selectedChoiceIds: readList(
        json,
        'selectedChoiceIds',
      ).map((item) => readIntValue(item)).where((item) => item > 0).toList(),
      textAnswer: readString(json, 'textAnswer'),
      isCorrect: readNullableBool(json, 'isCorrect'),
      correctChoiceId: readNullableInt(json, 'correctChoiceId'),
      correctChoiceIds: readList(
        json,
        'correctChoiceIds',
      ).map((item) => readIntValue(item)).where((item) => item > 0).toList(),
      question: QuestionItem.fromJson(asMap(jsonValue(json, 'question'))),
    );
  }
}

class TestAttemptResult {
  TestAttemptResult({
    required this.attemptId,
    required this.quizId,
    required this.quizTitle,
    required this.participantName,
    required this.totalScore,
    required this.totalQuestions,
    required this.answeredQuestions,
    required this.unansweredQuestions,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.accuracyPercent,
    required this.startedAt,
    required this.endedAt,
    required this.durationSeconds,
    required this.reviewQuestions,
  });

  final int attemptId;
  final int quizId;
  final String quizTitle;
  final String participantName;
  final int totalScore;
  final int totalQuestions;
  final int answeredQuestions;
  final int unansweredQuestions;
  final int correctAnswers;
  final int wrongAnswers;
  final double accuracyPercent;
  final String startedAt;
  final String endedAt;
  final int? durationSeconds;
  final List<TestReviewItem> reviewQuestions;

  factory TestAttemptResult.fromJson(Map<String, dynamic> json) {
    return TestAttemptResult(
      attemptId: readInt(json, 'attemptId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      participantName: readString(json, 'participantName'),
      totalScore: readInt(json, 'totalScore'),
      totalQuestions: readInt(json, 'totalQuestions'),
      answeredQuestions: readInt(json, 'answeredQuestions'),
      unansweredQuestions: readInt(json, 'unansweredQuestions'),
      correctAnswers: readInt(json, 'correctAnswers'),
      wrongAnswers: readInt(json, 'wrongAnswers'),
      accuracyPercent: readDouble(json, 'accuracyPercent'),
      startedAt: readString(json, 'startedAt'),
      endedAt: readString(json, 'endedAt'),
      durationSeconds: readNullableInt(json, 'durationSeconds'),
      reviewQuestions: readList(
        json,
        'reviewQuestions',
      ).map((item) => TestReviewItem.fromJson(asMap(item))).toList(),
    );
  }
}

class TestReviewItem {
  TestReviewItem({
    required this.questionIndex,
    required this.questionId,
    required this.questionTitle,
    required this.questionText,
    required this.isAnswered,
    required this.isCorrect,
    required this.selectedAnswerText,
    required this.correctAnswerText,
    required this.explanation,
  });

  final int questionIndex;
  final int questionId;
  final String questionTitle;
  final String questionText;
  final bool isAnswered;
  final bool isCorrect;
  final String selectedAnswerText;
  final String correctAnswerText;
  final String explanation;

  factory TestReviewItem.fromJson(Map<String, dynamic> json) {
    return TestReviewItem(
      questionIndex: readInt(json, 'questionIndex'),
      questionId: readInt(json, 'questionId'),
      questionTitle: readString(json, 'questionTitle'),
      questionText: readString(json, 'questionText'),
      isAnswered: readBool(json, 'isAnswered'),
      isCorrect: readBool(json, 'isCorrect'),
      selectedAnswerText: readString(json, 'selectedAnswerText'),
      correctAnswerText: readString(json, 'correctAnswerText'),
      explanation: readString(json, 'explanation'),
    );
  }
}

class PlayerSessionHistoryItem {
  PlayerSessionHistoryItem({
    required this.sessionId,
    required this.quizId,
    required this.quizTitle,
    required this.sessionStatus,
    required this.joinedAt,
    required this.displayName,
    required this.totalScore,
    required this.rank,
    required this.totalParticipants,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.averageResponseTimeMs,
  });

  final int sessionId;
  final int quizId;
  final String quizTitle;
  final int sessionStatus;
  final String joinedAt;
  final String displayName;
  final int totalScore;
  final int? rank;
  final int totalParticipants;
  final int correctAnswers;
  final int wrongAnswers;
  final double averageResponseTimeMs;

  factory PlayerSessionHistoryItem.fromJson(Map<String, dynamic> json) {
    return PlayerSessionHistoryItem(
      sessionId: readInt(json, 'sessionId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      sessionStatus: readInt(json, 'sessionStatus'),
      joinedAt: readString(json, 'joinedAt'),
      displayName: readString(json, 'displayName'),
      totalScore: readInt(json, 'totalScore'),
      rank: readNullableInt(json, 'rank'),
      totalParticipants: readInt(json, 'totalParticipants'),
      correctAnswers: readInt(json, 'correctAnswers'),
      wrongAnswers: readInt(json, 'wrongAnswers'),
      averageResponseTimeMs: readDouble(json, 'averageResponseTimeMs'),
    );
  }
}

class PlayerTestHistoryItem {
  PlayerTestHistoryItem({
    required this.attemptId,
    required this.quizId,
    required this.quizTitle,
    required this.totalScore,
    required this.totalQuestions,
    required this.answeredQuestions,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.accuracyPercent,
    required this.startedAt,
    required this.endedAt,
    required this.durationSeconds,
  });

  final int attemptId;
  final int quizId;
  final String quizTitle;
  final int totalScore;
  final int totalQuestions;
  final int answeredQuestions;
  final int correctAnswers;
  final int wrongAnswers;
  final double accuracyPercent;
  final String startedAt;
  final String endedAt;
  final int? durationSeconds;

  factory PlayerTestHistoryItem.fromJson(Map<String, dynamic> json) {
    return PlayerTestHistoryItem(
      attemptId: readInt(json, 'attemptId'),
      quizId: readInt(json, 'quizId'),
      quizTitle: readString(json, 'quizTitle'),
      totalScore: readInt(json, 'totalScore'),
      totalQuestions: readInt(json, 'totalQuestions'),
      answeredQuestions: readInt(json, 'answeredQuestions'),
      correctAnswers: readInt(json, 'correctAnswers'),
      wrongAnswers: readInt(json, 'wrongAnswers'),
      accuracyPercent: readDouble(json, 'accuracyPercent'),
      startedAt: readString(json, 'startedAt'),
      endedAt: readString(json, 'endedAt'),
      durationSeconds: readNullableInt(json, 'durationSeconds'),
    );
  }
}

class StudentUser {
  StudentUser({
    required this.id,
    required this.userName,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.status,
    required this.statusName,
    required this.registerTime,
    required this.groups,
  });

  final int id;
  final String userName;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final int status;
  final String statusName;
  final String registerTime;
  final List<String> groups;

  factory StudentUser.fromJson(Map<String, dynamic> json) {
    return StudentUser(
      id: readInt(json, 'id'),
      userName: readString(json, 'userName'),
      email: readString(json, 'email'),
      firstName: readString(json, 'firstName'),
      lastName: readString(json, 'lastName'),
      role: readString(json, 'role'),
      status: readInt(json, 'status'),
      statusName: readString(json, 'statusName'),
      registerTime: readString(json, 'registerTime'),
      groups: readList(json, 'groups').map((item) => '$item').toList(),
    );
  }

  String get fullName => '$firstName $lastName'.trim().isEmpty
      ? userName
      : '$firstName $lastName'.trim();
}

class StudentGroup {
  StudentGroup({
    required this.id,
    required this.name,
    required this.description,
    required this.membersCount,
    required this.activeMembersCount,
    required this.pendingMembersCount,
    required this.members,
  });

  final int id;
  final String name;
  final String description;
  final int membersCount;
  final int activeMembersCount;
  final int pendingMembersCount;
  final List<StudentGroupMember> members;

  factory StudentGroup.fromJson(Map<String, dynamic> json) {
    return StudentGroup(
      id: readInt(json, 'id'),
      name: readString(json, 'name'),
      description: readString(json, 'description'),
      membersCount: readInt(json, 'membersCount'),
      activeMembersCount: readInt(json, 'activeMembersCount'),
      pendingMembersCount: readInt(json, 'pendingMembersCount'),
      members: readList(
        json,
        'members',
      ).map((item) => StudentGroupMember.fromJson(asMap(item))).toList(),
    );
  }
}

class StudentGroupMember {
  StudentGroupMember({
    required this.id,
    required this.userId,
    required this.userName,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.status,
    required this.statusName,
  });

  final int id;
  final int userId;
  final String userName;
  final String email;
  final String firstName;
  final String lastName;
  final int status;
  final String statusName;

  factory StudentGroupMember.fromJson(Map<String, dynamic> json) {
    return StudentGroupMember(
      id: readInt(json, 'id'),
      userId: readInt(json, 'userId'),
      userName: readString(json, 'userName'),
      email: readString(json, 'email'),
      firstName: readString(json, 'firstName'),
      lastName: readString(json, 'lastName'),
      status: readInt(json, 'status'),
      statusName: readString(json, 'statusName'),
    );
  }

  String get fullName => '$firstName $lastName'.trim().isEmpty
      ? userName
      : '$firstName $lastName'.trim();
}

class SessionParticipantResult {
  SessionParticipantResult({
    required this.participantId,
    required this.displayName,
    required this.totalScore,
    required this.correctAnswers,
    required this.wrongAnswers,
    required this.averageResponseTimeMs,
  });

  final int participantId;
  final String displayName;
  final int totalScore;
  final int correctAnswers;
  final int wrongAnswers;
  final double averageResponseTimeMs;

  factory SessionParticipantResult.fromJson(Map<String, dynamic> json) {
    return SessionParticipantResult(
      participantId: readInt(json, 'participantId'),
      displayName: readString(json, 'displayName'),
      totalScore: readInt(json, 'totalScore'),
      correctAnswers: readInt(json, 'correctAnswers'),
      wrongAnswers: readInt(json, 'wrongAnswers'),
      averageResponseTimeMs: readDouble(json, 'averageResponseTimeMs'),
    );
  }
}

class SessionQuestionAnalysis {
  SessionQuestionAnalysis({
    required this.questionId,
    required this.questionTitle,
    required this.correctCount,
    required this.wrongCount,
    required this.averageResponseTimeMs,
  });

  final int questionId;
  final String questionTitle;
  final int correctCount;
  final int wrongCount;
  final double averageResponseTimeMs;

  factory SessionQuestionAnalysis.fromJson(Map<String, dynamic> json) {
    return SessionQuestionAnalysis(
      questionId: readInt(json, 'questionId'),
      questionTitle: readString(json, 'questionTitle'),
      correctCount: readInt(json, 'correctCount'),
      wrongCount: readInt(json, 'wrongCount'),
      averageResponseTimeMs: readDouble(json, 'averageResponseTimeMs'),
    );
  }
}

Map<String, dynamic> asMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, value) => MapEntry('$key', value));
  }
  return <String, dynamic>{};
}

Object? jsonValue(Map<String, dynamic> json, String key) {
  if (json.containsKey(key)) {
    return json[key];
  }
  final alt = '${key[0].toUpperCase()}${key.substring(1)}';
  return json[alt];
}

Map<String, dynamic>? readObject(Map<String, dynamic> json, String key) {
  final value = jsonValue(json, key);
  if (value == null) {
    return null;
  }
  return asMap(value);
}

List<dynamic> readList(Map<String, dynamic> json, String key) {
  final value = jsonValue(json, key);
  if (value is List) {
    return value;
  }
  if (value is Map && value['\$values'] is List) {
    return value['\$values'] as List<dynamic>;
  }
  return <dynamic>[];
}

String readString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = jsonValue(json, key);
  if (value == null) {
    return fallback;
  }
  return '$value';
}

int readInt(Map<String, dynamic> json, String key, {int fallback = 0}) {
  return readIntValue(jsonValue(json, key), fallback: fallback);
}

int readIntValue(Object? value, {int fallback = 0}) {
  if (value is int) {
    return value;
  }
  return int.tryParse('$value') ?? fallback;
}

int? readNullableInt(Map<String, dynamic> json, String key) {
  final value = jsonValue(json, key);
  if (value == null || '$value'.isEmpty) {
    return null;
  }
  return int.tryParse('$value');
}

double readDouble(
  Map<String, dynamic> json,
  String key, {
  double fallback = 0,
}) {
  final value = jsonValue(json, key);
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse('$value') ?? fallback;
}

bool readBool(Map<String, dynamic> json, String key, {bool fallback = false}) {
  final value = jsonValue(json, key);
  return readBoolValue(value, fallback: fallback);
}

bool readBoolValue(Object? value, {bool fallback = false}) {
  if (value is bool) {
    return value;
  }
  final raw = '$value'.toLowerCase();
  if (raw == 'true' || raw == '1') {
    return true;
  }
  if (raw == 'false' || raw == '0') {
    return false;
  }
  return fallback;
}

bool? readNullableBool(Map<String, dynamic> json, String key) {
  final value = jsonValue(json, key);
  if (value == null || '$value'.isEmpty) {
    return null;
  }
  return readBoolValue(value);
}

List<int> decodeChoiceIds(String? raw) {
  if (raw == null || raw.trim().isEmpty) {
    return <int>[];
  }
  try {
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      return decoded
          .map((item) => readIntValue(item))
          .where((item) => item > 0)
          .toList();
    }
  } catch (_) {}
  return <int>[];
}
