import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_repository.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class SessionsScreen extends ConsumerStatefulWidget {
  const SessionsScreen({super.key});

  @override
  ConsumerState<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends ConsumerState<SessionsScreen> {
  bool _loading = true;
  String? _error;
  List<GameSessionItem> _sessions = const [];
  List<QuizItem> _quizzes = const [];
  List<StudentUser> _players = const [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getSessions(),
        repo.getQuizzes(pageSize: 100),
        repo.getStudents(pageSize: 100, role: 'Player', status: 1),
      ]);
      if (!mounted) return;
      setState(() {
        _sessions = results[0] as List<GameSessionItem>;
        _quizzes = results[1] as List<QuizItem>;
        _players = (results[2] as PagedResponse<StudentUser>).items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load sessions.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _showCreateSheet() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) =>
          _CreateSessionSheet(quizzes: _quizzes, players: _players),
    );

    if (created == true) {
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          AppSectionCard(
            title: 'Live sessions',
            subtitle:
                'Create live rooms from existing tests and control them without touching the backend.',
            actions: [
              FilledButton.icon(
                onPressed: _quizzes.isEmpty ? null : _showCreateSheet,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Create'),
              ),
            ],
            child: _loading
                ? const LoadingPane(label: 'Loading sessions...')
                : _error != null
                ? ErrorMessageCard(message: _error!, onRetry: _load)
                : _sessions.isEmpty
                ? const EmptyMessageCard(
                    title: 'No sessions yet',
                    message:
                        'Create a session from a quiz to start live delivery.',
                  )
                : Column(
                    children: _sessions
                        .map(
                          (session) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                session.quizTitle,
                                                style: Theme.of(
                                                  context,
                                                ).textTheme.titleMedium,
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                '${statusLabel(session.status)} • ${accessTypeLabel(session.accessType)} • ${session.participantsCount} players',
                                                style: Theme.of(
                                                  context,
                                                ).textTheme.bodySmall,
                                              ),
                                            ],
                                          ),
                                        ),
                                        FilledButton.tonal(
                                          onPressed: () => context.go(
                                            '/host/sessions/${session.id}/control',
                                          ),
                                          child: const Text('Control'),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        Chip(
                                          label: Text(
                                            'Code: ${session.joinCode}',
                                          ),
                                        ),
                                        if (session.categories.isNotEmpty)
                                          ...session.categories.map(
                                            (item) =>
                                                Chip(label: Text(item.name)),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Start: ${formatDateTime(session.scheduledStartAt)}',
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'End: ${formatDateTime(session.scheduledEndAt)}',
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 10,
                                      runSpacing: 10,
                                      children: [
                                        FilledButton.tonal(
                                          onPressed: () {
                                            Clipboard.setData(
                                              ClipboardData(
                                                text: session.joinCode,
                                              ),
                                            );
                                            ScaffoldMessenger.of(
                                              context,
                                            ).showSnackBar(
                                              const SnackBar(
                                                content: Text(
                                                  'Join code copied.',
                                                ),
                                              ),
                                            );
                                          },
                                          child: const Text('Copy code'),
                                        ),
                                        FilledButton.tonal(
                                          onPressed: () {
                                            Clipboard.setData(
                                              ClipboardData(
                                                text: session.joinLink,
                                              ),
                                            );
                                            ScaffoldMessenger.of(
                                              context,
                                            ).showSnackBar(
                                              const SnackBar(
                                                content: Text(
                                                  'Join link copied.',
                                                ),
                                              ),
                                            );
                                          },
                                          child: const Text('Copy link'),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class SessionControlScreen extends ConsumerStatefulWidget {
  const SessionControlScreen({super.key, required this.sessionId});

  final int sessionId;

  @override
  ConsumerState<SessionControlScreen> createState() =>
      _SessionControlScreenState();
}

class _SessionControlScreenState extends ConsumerState<SessionControlScreen> {
  Timer? _poller;
  bool _loading = true;
  bool _acting = false;
  String? _error;
  GameSessionItem? _session;
  SessionState? _state;
  List<LeaderboardEntry> _leaderboard = const [];
  List<JoinRequest> _requests = const [];
  final Map<int, TextEditingController> _rejectNotes = {};

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
    _poller = Timer.periodic(
      const Duration(seconds: 4),
      (_) => _load(silent: true),
    );
  }

  @override
  void dispose() {
    _poller?.cancel();
    for (final controller in _rejectNotes.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getSessionById(widget.sessionId),
        repo.getSessionState(widget.sessionId),
        repo.getSessionLeaderboard(widget.sessionId),
        repo.getJoinRequests(widget.sessionId),
      ]);

      if (!mounted) return;
      _session = results[0] as GameSessionItem;
      _state = results[1] as SessionState;
      _leaderboard = results[2] as List<LeaderboardEntry>;
      _requests = results[3] as List<JoinRequest>;
      for (final request in _requests) {
        _rejectNotes.putIfAbsent(
          request.participantId,
          TextEditingController.new,
        );
      }
      setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load control board.',
      );
    } finally {
      if (mounted && !silent) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _doAction(Future<void> Function() action, String success) async {
    if (_acting) return;
    setState(() => _acting = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(success)));
      await _load();
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException ? error.message : 'Action failed.',
      );
    } finally {
      if (mounted) {
        setState(() => _acting = false);
      }
    }
  }

  Future<void> _deleteSessionAndExit() async {
    await _doAction(
      () => ref.read(appRepositoryProvider).deleteSession(widget.sessionId),
      'Session deleted.',
    );
    if (!mounted) {
      return;
    }
    context.go('/host/sessions');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_session?.quizTitle ?? 'Session control'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingPane(label: 'Loading session control...')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_session != null && _state != null)
                    AppSectionCard(
                      title: 'Live state',
                      subtitle:
                          'Current status ${statusLabel(_state!.status)} • Flow ${_state!.questionFlowMode == 1 ? 'Host controlled' : 'Timed'}',
                      actions: [
                        PopupMenuButton<String>(
                          onSelected: (value) {
                            switch (value) {
                              case 'start':
                                _doAction(
                                  () => ref
                                      .read(appRepositoryProvider)
                                      .startSession(widget.sessionId),
                                  'Session started.',
                                );
                                break;
                              case 'pause':
                                _doAction(
                                  () => ref
                                      .read(appRepositoryProvider)
                                      .pauseSession(widget.sessionId),
                                  'Session paused.',
                                );
                                break;
                              case 'resume':
                                _doAction(
                                  () => ref
                                      .read(appRepositoryProvider)
                                      .resumeSession(widget.sessionId),
                                  'Session resumed.',
                                );
                                break;
                              case 'next':
                                _doAction(
                                  () => ref
                                      .read(appRepositoryProvider)
                                      .nextQuestion(widget.sessionId),
                                  'Moved to the next question.',
                                );
                                break;
                              case 'end':
                                _doAction(
                                  () => ref
                                      .read(appRepositoryProvider)
                                      .endSession(widget.sessionId),
                                  'Session ended.',
                                );
                                break;
                              case 'delete':
                                _deleteSessionAndExit();
                                break;
                            }
                          },
                          itemBuilder: (context) => const [
                            PopupMenuItem(value: 'start', child: Text('Start')),
                            PopupMenuItem(value: 'pause', child: Text('Pause')),
                            PopupMenuItem(
                              value: 'resume',
                              child: Text('Resume'),
                            ),
                            PopupMenuItem(
                              value: 'next',
                              child: Text('Next question'),
                            ),
                            PopupMenuItem(value: 'end', child: Text('End')),
                            PopupMenuItem(
                              value: 'delete',
                              child: Text('Delete'),
                            ),
                          ],
                        ),
                      ],
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              SizedBox(
                                width: 160,
                                child: StatTile(
                                  label: 'Status',
                                  value: statusLabel(_state!.status),
                                  accent: _state!.status == 3,
                                ),
                              ),
                              SizedBox(
                                width: 160,
                                child: StatTile(
                                  label: 'Players',
                                  value: '${_state!.participantsCount}',
                                ),
                              ),
                              SizedBox(
                                width: 160,
                                child: StatTile(
                                  label: 'Question',
                                  value:
                                      '${_state!.currentQuestionIndex + 1}/${_state!.totalQuestions}',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text('Join code: ${_session!.joinCode}'),
                          const SizedBox(height: 4),
                          Text('Join link: ${_session!.joinLink}'),
                          const SizedBox(height: 12),
                          if (_state!.currentQuestion != null) ...[
                            Text(
                              _state!.currentQuestion!.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            HtmlBlock(_state!.currentQuestion!.text),
                          ] else
                            const Text('No question is currently active.'),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  AppSectionCard(
                    title: 'Pending join requests',
                    subtitle:
                        'Approve or reject waiting players for private sessions without allow lists.',
                    child: _requests.isEmpty
                        ? const EmptyMessageCard(
                            title: 'No pending requests',
                            message:
                                'Public sessions auto-approve, and allow-listed private sessions skip the queue.',
                          )
                        : Column(
                            children: _requests
                                .map(
                                  (request) => Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: Card(
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              request.displayName,
                                              style: Theme.of(
                                                context,
                                              ).textTheme.titleMedium,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              request.email.isEmpty
                                                  ? 'No email'
                                                  : request.email,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Requested: ${formatDateTime(request.requestedAt)}',
                                            ),
                                            const SizedBox(height: 12),
                                            TextField(
                                              controller:
                                                  _rejectNotes[request
                                                      .participantId],
                                              decoration: const InputDecoration(
                                                labelText:
                                                    'Reject note (optional)',
                                              ),
                                            ),
                                            const SizedBox(height: 12),
                                            Wrap(
                                              spacing: 10,
                                              runSpacing: 10,
                                              children: [
                                                FilledButton(
                                                  onPressed: _acting
                                                      ? null
                                                      : () => _doAction(
                                                          () => ref
                                                              .read(
                                                                appRepositoryProvider,
                                                              )
                                                              .approveJoinRequest(
                                                                widget
                                                                    .sessionId,
                                                                request
                                                                    .participantId,
                                                              ),
                                                          'Request approved.',
                                                        ),
                                                  child: const Text('Approve'),
                                                ),
                                                FilledButton.tonal(
                                                  onPressed: _acting
                                                      ? null
                                                      : () => _doAction(
                                                          () => ref
                                                              .read(
                                                                appRepositoryProvider,
                                                              )
                                                              .rejectJoinRequest(
                                                                widget
                                                                    .sessionId,
                                                                request
                                                                    .participantId,
                                                                note:
                                                                    _rejectNotes[request
                                                                            .participantId]
                                                                        ?.text ??
                                                                    '',
                                                              ),
                                                          'Request rejected.',
                                                        ),
                                                  child: const Text('Reject'),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                  const SizedBox(height: 16),
                  AppSectionCard(
                    title: 'Leaderboard',
                    child: _leaderboard.isEmpty
                        ? const EmptyMessageCard(
                            title: 'No scores yet',
                            message:
                                'Leaderboard data will appear once players start answering.',
                          )
                        : Column(
                            children: _leaderboard
                                .map(
                                  (entry) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: CircleAvatar(
                                      child: Text('${entry.rank}'),
                                    ),
                                    title: Text(entry.displayName),
                                    trailing: Text('${entry.totalScore}'),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    ErrorMessageCard(message: _error!),
                  ],
                ],
              ),
      ),
    );
  }
}

class ResultsScreen extends ConsumerStatefulWidget {
  const ResultsScreen({super.key});

  @override
  ConsumerState<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends ConsumerState<ResultsScreen> {
  bool _loadingSessions = true;
  bool _loadingResults = false;
  String? _error;
  List<GameSessionItem> _sessions = const [];
  GameSessionItem? _selected;
  List<SessionParticipantResult> _participants = const [];
  List<SessionQuestionAnalysis> _analysis = const [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_loadSessions);
  }

  Future<void> _loadSessions() async {
    setState(() {
      _loadingSessions = true;
      _error = null;
    });
    try {
      final sessions = await ref.read(appRepositoryProvider).getSessions();
      if (!mounted) return;
      setState(() => _sessions = sessions);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load sessions.',
      );
    } finally {
      if (mounted) {
        setState(() => _loadingSessions = false);
      }
    }
  }

  Future<void> _loadResults() async {
    final selected = _selected;
    if (selected == null) return;

    setState(() {
      _loadingResults = true;
      _error = null;
    });
    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getSessionParticipantsResults(selected.id),
        repo.getSessionQuestionsAnalysis(selected.id),
      ]);
      if (!mounted) return;
      setState(() {
        _participants = results[0] as List<SessionParticipantResult>;
        _analysis = results[1] as List<SessionQuestionAnalysis>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load results.',
      );
    } finally {
      if (mounted) {
        setState(() => _loadingResults = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        AppSectionCard(
          title: 'Results and analytics',
          subtitle:
              'Inspect participant performance and question-level outcomes for any live session.',
          child: _loadingSessions
              ? const LoadingPane(label: 'Loading sessions...')
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButtonFormField<GameSessionItem>(
                      initialValue: _selected,
                      items: _sessions
                          .map(
                            (session) => DropdownMenuItem(
                              value: session,
                              child: Text(
                                '#${session.id} • ${session.quizTitle}',
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => _selected = value),
                      decoration: const InputDecoration(
                        labelText: 'Select session',
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _selected == null || _loadingResults
                          ? null
                          : _loadResults,
                      child: Text(
                        _loadingResults ? 'Loading...' : 'Load results',
                      ),
                    ),
                  ],
                ),
        ),
        if (_selected != null) ...[
          const SizedBox(height: 16),
          AppSectionCard(
            title: 'Participants snapshot',
            child: _participants.isEmpty
                ? const EmptyMessageCard(
                    title: 'No participant data',
                    message:
                        'There may be no submitted answers for this session yet.',
                  )
                : Column(
                    children: _participants
                        .map(
                          (item) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(item.displayName),
                            subtitle: Text(
                              'Correct ${item.correctAnswers} • Wrong ${item.wrongAnswers} • Avg ${item.averageResponseTimeMs.toStringAsFixed(0)} ms',
                            ),
                            trailing: Text('${item.totalScore}'),
                          ),
                        )
                        .toList(),
                  ),
          ),
          const SizedBox(height: 16),
          AppSectionCard(
            title: 'Question analysis',
            child: _analysis.isEmpty
                ? const EmptyMessageCard(
                    title: 'No question analysis',
                    message:
                        'Question insights will appear once answers are recorded.',
                  )
                : Column(
                    children: _analysis
                        .map(
                          (item) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(item.questionTitle),
                            subtitle: Text(
                              'Correct ${item.correctCount} • Wrong ${item.wrongCount} • Avg ${item.averageResponseTimeMs.toStringAsFixed(0)} ms',
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 16),
          ErrorMessageCard(message: _error!),
        ],
      ],
    );
  }
}

class _CreateSessionSheet extends ConsumerStatefulWidget {
  const _CreateSessionSheet({required this.quizzes, required this.players});

  final List<QuizItem> quizzes;
  final List<StudentUser> players;

  @override
  ConsumerState<_CreateSessionSheet> createState() =>
      _CreateSessionSheetState();
}

class _CreateSessionSheetState extends ConsumerState<_CreateSessionSheet> {
  int? _quizId;
  int _accessType = 2;
  int _flowMode = 1;
  final TextEditingController _durationController = TextEditingController();
  final TextEditingController _startController = TextEditingController();
  final TextEditingController _endController = TextEditingController();
  final Set<int> _allowedUserIds = <int>{};
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _durationController.dispose();
    _startController.dispose();
    _endController.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_quizId == null) {
      setState(() => _error = 'Choose a quiz first.');
      return;
    }
    if (_accessType == 2 && _allowedUserIds.isEmpty) {
      setState(() => _error = 'Private sessions need an allow list.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(appRepositoryProvider).createSession({
        'quizId': _quizId,
        'questionFlowMode': _flowMode,
        'accessType': _accessType,
        'durationMinutes': int.tryParse(_durationController.text.trim()),
        'scheduledStartAt': _startController.text.trim().isEmpty
            ? null
            : _startController.text.trim(),
        'scheduledEndAt': _endController.text.trim().isEmpty
            ? null
            : _endController.text.trim(),
        'allowedUserIds': _accessType == 2 ? _allowedUserIds.toList() : <int>[],
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Unable to create session.',
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 8,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Create session',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                items: widget.quizzes
                    .map(
                      (quiz) => DropdownMenuItem(
                        value: quiz.id,
                        child: Text(quiz.title),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _quizId = value),
                decoration: const InputDecoration(labelText: 'Quiz'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: _accessType,
                items: const [
                  DropdownMenuItem(value: 2, child: Text('Private allow list')),
                  DropdownMenuItem(value: 1, child: Text('Public')),
                ],
                onChanged: (value) => setState(() => _accessType = value ?? 2),
                decoration: const InputDecoration(labelText: 'Access'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                initialValue: _flowMode,
                items: const [
                  DropdownMenuItem(value: 1, child: Text('Host controlled')),
                  DropdownMenuItem(value: 2, child: Text('Timed by question')),
                ],
                onChanged: (value) => setState(() => _flowMode = value ?? 1),
                decoration: const InputDecoration(labelText: 'Question flow'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _durationController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Duration minutes',
                  hintText: 'Leave empty to use quiz duration',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _startController,
                decoration: const InputDecoration(
                  labelText: 'Scheduled start',
                  hintText: '2026-05-21T18:30:00Z',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _endController,
                decoration: const InputDecoration(
                  labelText: 'Scheduled end',
                  hintText: '2026-05-21T19:30:00Z',
                ),
              ),
              if (_accessType == 2) ...[
                const SizedBox(height: 16),
                Text(
                  'Allowed students',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                ...widget.players.map(
                  (player) => CheckboxListTile(
                    value: _allowedUserIds.contains(player.id),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(player.fullName),
                    subtitle: Text(player.email),
                    onChanged: (value) {
                      setState(() {
                        if (value == true) {
                          _allowedUserIds.add(player.id);
                        } else {
                          _allowedUserIds.remove(player.id);
                        }
                      });
                    },
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                ErrorMessageCard(message: _error!),
              ],
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _create,
                  child: Text(_saving ? 'Creating...' : 'Create session'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
