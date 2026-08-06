import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/auth_controller.dart';
import '../../core/network/app_repository.dart';
import '../../core/storage/app_storage.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class JoinSessionScreen extends ConsumerStatefulWidget {
  const JoinSessionScreen({super.key, this.initialCode});

  final String? initialCode;

  @override
  ConsumerState<JoinSessionScreen> createState() => _JoinSessionScreenState();
}

class _JoinSessionScreenState extends ConsumerState<JoinSessionScreen> {
  late final TextEditingController _codeController;
  late final TextEditingController _displayNameController;
  late final TextEditingController _emailController;

  GameSessionItem? _sessionPreview;
  bool _loadingPreview = false;
  bool _joining = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final auth = ref.read(authControllerProvider).session;
    _codeController = TextEditingController(text: widget.initialCode ?? '');
    _displayNameController = TextEditingController(text: auth?.fullName ?? '');
    _emailController = TextEditingController(text: auth?.email ?? '');
    if ((widget.initialCode ?? '').trim().isNotEmpty) {
      Future.microtask(_loadPreview);
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _displayNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _loadPreview() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _sessionPreview = null);
      return;
    }

    setState(() {
      _loadingPreview = true;
      _error = null;
    });

    try {
      final session = await ref
          .read(appRepositoryProvider)
          .getSessionByCode(code);
      if (!mounted) return;
      setState(() => _sessionPreview = session);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _sessionPreview = null;
        _error = error is AppException ? error.message : 'Session not found.';
      });
    } finally {
      if (mounted) {
        setState(() => _loadingPreview = false);
      }
    }
  }

  Future<void> _join() async {
    if (_joining) return;
    final code = _codeController.text.trim().toUpperCase();
    final displayName = _displayNameController.text.trim();
    final email = _emailController.text.trim();

    if (code.isEmpty) {
      setState(() => _error = 'Enter a join code.');
      return;
    }
    if (displayName.isEmpty) {
      setState(() => _error = 'Display name is required.');
      return;
    }
    if (_sessionPreview?.accessType == 1 &&
        (email.isEmpty || !email.contains('@'))) {
      setState(() => _error = 'Enter a valid email for this public session.');
      return;
    }
    if (_sessionPreview?.accessType == 2 &&
        ref.read(authControllerProvider).session == null) {
      setState(() {
        _error = 'Sign in first to join this private session.';
      });
      return;
    }

    setState(() {
      _joining = true;
      _error = null;
    });

    try {
      final response = await ref
          .read(appRepositoryProvider)
          .joinSession(joinCode: code, displayName: displayName, email: email);
      await ref
          .read(appStorageProvider)
          .saveParticipantSession(
            ParticipantSession(
              participantId: response.participantId,
              sessionId: response.sessionId,
              participantToken: response.participantToken,
              displayName: response.displayName,
              joinStatus: response.joinStatus,
            ),
          );
      if (!mounted) return;
      context.go('/player/waiting/${response.sessionId}');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is AppException
            ? error.message
            : 'Unable to join the session.';
      });
    } finally {
      if (mounted) {
        setState(() => _joining = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPrivate = _sessionPreview?.accessType == 2;
    final isPublic = _sessionPreview?.accessType == 1;
    final auth = ref.watch(authControllerProvider).session;

    return Scaffold(
      appBar: AppBar(title: const Text('Join session')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const BrandPanel(compact: true),
            const SizedBox(height: 16),
            AppSectionCard(
              title: 'Live access',
              subtitle:
                  'Enter the code shared by your host, then choose the name that should appear on the leaderboard.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _codeController,
                    decoration: const InputDecoration(
                      labelText: 'Join code',
                      hintText: 'e.g. PQB2M4',
                    ),
                    textCapitalization: TextCapitalization.characters,
                    onSubmitted: (_) => _loadPreview(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _displayNameController,
                    decoration: const InputDecoration(
                      labelText: 'Display name',
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (isPublic || _sessionPreview == null)
                    TextField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'Required for public sessions',
                      ),
                    ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton.tonal(
                        onPressed: _loadingPreview ? null : _loadPreview,
                        child: Text(
                          _loadingPreview ? 'Checking...' : 'Preview session',
                        ),
                      ),
                      FilledButton(
                        onPressed:
                            _joining ||
                                (_sessionPreview?.accessType == 2 &&
                                    auth == null)
                            ? null
                            : _join,
                        child: Text(_joining ? 'Joining...' : 'Join session'),
                      ),
                    ],
                  ),
                  if (isPrivate && auth == null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Private sessions require a signed-in account that is either on the allow list or will be approved by the host.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: () => context.go('/login'),
                      child: const Text('Sign in'),
                    ),
                  ],
                ],
              ),
            ),
            if (_sessionPreview != null) ...[
              const SizedBox(height: 16),
              AppSectionCard(
                title: _sessionPreview!.quizTitle,
                subtitle:
                    '${accessTypeLabel(_sessionPreview!.accessType)} session • ${statusLabel(_sessionPreview!.status)}',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_sessionPreview!.categories.isNotEmpty)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _sessionPreview!.categories
                            .map((item) => Chip(label: Text(item.name)))
                            .toList(),
                      ),
                    if (_sessionPreview!.categories.isNotEmpty)
                      const SizedBox(height: 10),
                    Text('Code: ${_sessionPreview!.joinCode}'),
                    const SizedBox(height: 4),
                    Text('Link: ${_sessionPreview!.joinLink}'),
                  ],
                ),
              ),
            ],
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

class PlayerLiveSessionsScreen extends ConsumerStatefulWidget {
  const PlayerLiveSessionsScreen({super.key});

  @override
  ConsumerState<PlayerLiveSessionsScreen> createState() =>
      _PlayerLiveSessionsScreenState();
}

class _PlayerLiveSessionsScreenState
    extends ConsumerState<PlayerLiveSessionsScreen> {
  bool _loading = true;
  String? _error;
  List<LiveSessionBrowseItem> _items = const [];

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
      final items = await ref
          .read(appRepositoryProvider)
          .getLiveSessionsBrowse();
      if (!mounted) return;
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load live sessions.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          AppSectionCard(
            title: 'Available live sessions',
            subtitle:
                'Browse public rooms and private sessions that your account can access.',
            child: _loading
                ? const LoadingPane(label: 'Loading live sessions...')
                : _error != null
                ? ErrorMessageCard(message: _error!, onRetry: _load)
                : _items.isEmpty
                ? const EmptyMessageCard(
                    title: 'No sessions right now',
                    message:
                        'Ask your host for a join code or check back later.',
                  )
                : Column(
                    children: _items
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Card(
                              child: ListTile(
                                contentPadding: const EdgeInsets.all(16),
                                title: Text(item.quizTitle),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    '${statusLabel(item.status)} • ${accessTypeLabel(item.accessType)}\n${item.joinHint.isEmpty ? item.joinCode : item.joinHint}',
                                  ),
                                ),
                                trailing: FilledButton.tonal(
                                  onPressed: item.canJoin
                                      ? () =>
                                            context.go('/join/${item.joinCode}')
                                      : null,
                                  child: const Text('Open'),
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

class WaitingRoomScreen extends ConsumerStatefulWidget {
  const WaitingRoomScreen({super.key, required this.sessionId});

  final int sessionId;

  @override
  ConsumerState<WaitingRoomScreen> createState() => _WaitingRoomScreenState();
}

class _WaitingRoomScreenState extends ConsumerState<WaitingRoomScreen> {
  Timer? _poller;
  WaitingRoom? _room;
  ParticipantStatus? _status;
  bool _loading = true;
  String? _error;

  ParticipantSession? get _participant =>
      ref.read(appStorageProvider).participantSession;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
    _poller = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _load(silent: true),
    );
  }

  @override
  void dispose() {
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final participant = _participant;
    if (participant == null || participant.sessionId != widget.sessionId) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Participant session is missing. Join the room again.';
        });
      }
      return;
    }

    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getWaitingRoom(widget.sessionId),
        repo.getParticipantStatus(
          sessionId: widget.sessionId,
          participantId: participant.participantId,
          token: participant.participantToken,
        ),
      ]);

      if (!mounted) return;
      _room = results[0] as WaitingRoom;
      _status = results[1] as ParticipantStatus;
      await ref
          .read(appStorageProvider)
          .updateParticipantJoinStatus(_status!.joinStatus);

      if (_room!.sessionStatus.toLowerCase() == 'live' &&
          _status!.joinStatus == 2 &&
          mounted) {
        context.go('/player/live/${widget.sessionId}');
        return;
      }

      setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load waiting room.',
      );
    } finally {
      if (mounted && !silent) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _leave() async {
    final participant = _participant;
    if (participant != null) {
      try {
        await ref
            .read(appRepositoryProvider)
            .leaveSession(
              sessionId: widget.sessionId,
              participantId: participant.participantId,
              participantToken: participant.participantToken,
            );
      } catch (_) {}
    }
    await ref.read(appStorageProvider).clearParticipantSession();
    if (mounted) {
      context.go('/join');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Waiting room'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppSectionCard(
              title: _room?.quizTitle ?? 'Waiting room',
              subtitle:
                  'Status: ${_status == null ? 'Loading...' : joinStatusLabel(_status!.joinStatus)}',
              actions: [
                FilledButton.tonal(
                  onPressed: _leave,
                  child: const Text('Leave'),
                ),
              ],
              child: _loading
                  ? const LoadingPane(label: 'Loading room...')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_room != null) ...[
                          Text('Session: ${_room!.sessionStatus}'),
                          const SizedBox(height: 4),
                          Text('Approved players: ${_room!.participantsCount}'),
                          const SizedBox(height: 12),
                          if (_status?.decisionNote.isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: ErrorMessageCard(
                                message: _status!.decisionNote,
                              ),
                            ),
                          if (_room!.players.isEmpty)
                            const EmptyMessageCard(
                              title: 'No approved players yet',
                              message:
                                  'Once approvals happen, the player list will appear here.',
                            )
                          else
                            ..._room!.players.map(
                              (player) => ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: const CircleAvatar(
                                  radius: 18,
                                  child: Icon(Icons.person_rounded, size: 18),
                                ),
                                title: Text(player.displayName),
                                subtitle: player.email.isEmpty
                                    ? null
                                    : Text(player.email),
                              ),
                            ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          ErrorMessageCard(message: _error!),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class LiveQuestionScreen extends ConsumerStatefulWidget {
  const LiveQuestionScreen({super.key, required this.sessionId});

  final int sessionId;

  @override
  ConsumerState<LiveQuestionScreen> createState() => _LiveQuestionScreenState();
}

class _LiveQuestionScreenState extends ConsumerState<LiveQuestionScreen> {
  Timer? _timer;
  SessionState? _state;
  List<LeaderboardEntry> _leaderboard = const [];
  ParticipantStatus? _participantStatus;
  String? _error;
  bool _loading = true;
  bool _submitting = false;
  int? _selectedChoiceId;
  final Set<int> _selectedChoiceIds = <int>{};
  final TextEditingController _textAnswerController = TextEditingController();
  int? _submittedQuestionId;
  DateTime? _questionLoadedAt;
  int _tick = 0;

  ParticipantSession? get _participant =>
      ref.read(appStorageProvider).participantSession;

  QuestionItem? get _question => _state?.currentQuestion;

  bool get _isMultiSelect =>
      _question != null &&
      _question!.type != 3 &&
      _question!.selectionMode == 2;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _tick++);
      if (_tick % 4 == 0) {
        _load(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _textAnswerController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final participant = _participant;
    if (participant == null || participant.sessionId != widget.sessionId) {
      setState(() {
        _error = 'Participant session is missing. Join the live room again.';
        _loading = false;
      });
      return;
    }

    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getSessionState(widget.sessionId),
        repo.getPlayerLeaderboard(widget.sessionId),
        repo.getParticipantStatus(
          sessionId: widget.sessionId,
          participantId: participant.participantId,
          token: participant.participantToken,
        ),
      ]);

      if (!mounted) return;

      final nextState = results[0] as SessionState;
      final nextQuestionId = nextState.currentQuestion?.id;
      final oldQuestionId = _state?.currentQuestion?.id;
      _state = nextState;
      _leaderboard = results[1] as List<LeaderboardEntry>;
      _participantStatus = results[2] as ParticipantStatus;

      if (nextQuestionId != oldQuestionId) {
        _selectedChoiceId = null;
        _selectedChoiceIds.clear();
        _textAnswerController.clear();
        _submittedQuestionId = null;
        _questionLoadedAt = DateTime.now();
      }

      if (nextState.status == 5 && mounted) {
        _timer?.cancel();
      }

      setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is AppException
            ? error.message
            : 'Failed to load live question.';
      });
    } finally {
      if (mounted && !silent) {
        setState(() => _loading = false);
      }
    }
  }

  int _timeRemainingSeconds() {
    final raw = _state?.currentQuestionEndsAtUtc;
    if (raw == null || raw.isEmpty) {
      return 0;
    }
    final endsAt = DateTime.tryParse(raw)?.toLocal();
    if (endsAt == null) {
      return 0;
    }
    final diff = endsAt.difference(DateTime.now()).inSeconds;
    return diff > 0 ? diff : 0;
  }

  void _toggleChoice(int id) {
    if (_submittedQuestionId == _question?.id) {
      return;
    }

    setState(() {
      if (_isMultiSelect) {
        if (_selectedChoiceIds.contains(id)) {
          _selectedChoiceIds.remove(id);
        } else {
          _selectedChoiceIds.add(id);
        }
      } else {
        _selectedChoiceId = id;
      }
    });
  }

  bool _canSubmit() {
    final question = _question;
    if (question == null || _submittedQuestionId == question.id) {
      return false;
    }
    if (question.type == 3) {
      return _textAnswerController.text.trim().isNotEmpty;
    }
    if (_isMultiSelect) {
      return _selectedChoiceIds.isNotEmpty;
    }
    return _selectedChoiceId != null;
  }

  Future<void> _submit() async {
    final question = _question;
    final participant = _participant;
    if (!_canSubmit() || question == null || participant == null) {
      return;
    }

    setState(() => _submitting = true);
    try {
      final response = await ref
          .read(appRepositoryProvider)
          .submitLiveAnswer(widget.sessionId, {
            'participantId': participant.participantId,
            'questionId': question.id,
            'selectedChoiceId': !_isMultiSelect ? _selectedChoiceId : null,
            'selectedChoiceIds': _isMultiSelect
                ? _selectedChoiceIds.toList()
                : <int>[],
            'textAnswer': question.type == 3
                ? _textAnswerController.text.trim()
                : null,
            'responseTimeMs': _questionLoadedAt == null
                ? null
                : DateTime.now().difference(_questionLoadedAt!).inMilliseconds,
          });
      if (!mounted) return;
      _submittedQuestionId = question.id;
      final message = readBool(response, 'isCorrect')
          ? 'Answer submitted. Nice one.'
          : readString(response, 'message', fallback: 'Answer submitted.');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Unable to submit your answer.',
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _leave() async {
    final participant = _participant;
    if (participant != null) {
      try {
        await ref
            .read(appRepositoryProvider)
            .leaveSession(
              sessionId: widget.sessionId,
              participantId: participant.participantId,
              participantToken: participant.participantToken,
            );
      } catch (_) {}
    }
    await ref.read(appStorageProvider).clearParticipantSession();
    if (mounted) {
      context.go('/join');
    }
  }

  @override
  Widget build(BuildContext context) {
    final question = _question;
    final participant = _participant;

    return Scaffold(
      appBar: AppBar(
        title: Text(_state?.quizTitle ?? 'Live session'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingPane(label: 'Loading live state...')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_state != null)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
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
                                    value: '${_leaderboard.length}',
                                  ),
                                ),
                                SizedBox(
                                  width: 180,
                                  child: StatTile(
                                    label: 'Time left',
                                    value: _state!.questionFlowMode == 2
                                        ? '${_timeRemainingSeconds()} sec'
                                        : 'Host controlled',
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Question ${(_state!.currentQuestionIndex + 1).clamp(1, _state!.totalQuestions)} of ${_state!.totalQuestions}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  if (_participantStatus != null &&
                      _participantStatus!.joinStatus != 2)
                    ErrorMessageCard(
                      message: _participantStatus!.decisionNote.isNotEmpty
                          ? _participantStatus!.decisionNote
                          : 'Your participation is not approved anymore.',
                    ),
                  if (question == null)
                    const EmptyMessageCard(
                      title: 'Waiting for the next question',
                      message: 'The host has not activated a question yet.',
                    )
                  else
                    AppSectionCard(
                      title: question.title,
                      subtitle: question.type == 3
                          ? 'Short answer'
                          : (_isMultiSelect
                                ? 'Multiple choice'
                                : 'Single choice'),
                      actions: [
                        FilledButton.tonal(
                          onPressed: _leave,
                          child: const Text('Leave'),
                        ),
                      ],
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          HtmlBlock(question.text),
                          if (question.imageUrl.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Image.network(question.imageUrl),
                            ),
                          ],
                          const SizedBox(height: 16),
                          if (question.type == 3)
                            TextField(
                              controller: _textAnswerController,
                              minLines: 4,
                              maxLines: 7,
                              enabled: _submittedQuestionId != question.id,
                              decoration: const InputDecoration(
                                labelText: 'Your answer',
                              ),
                            )
                          else
                            Column(
                              children: question.choices
                                  .map(
                                    (choice) => Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 10,
                                      ),
                                      child: InkWell(
                                        onTap: () => _toggleChoice(choice.id),
                                        borderRadius: BorderRadius.circular(16),
                                        child: Ink(
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                              16,
                                            ),
                                            border: Border.all(
                                              color:
                                                  (_isMultiSelect
                                                          ? _selectedChoiceIds
                                                          : {_selectedChoiceId})
                                                      .contains(choice.id)
                                                  ? Theme.of(
                                                      context,
                                                    ).colorScheme.secondary
                                                  : Theme.of(context)
                                                        .colorScheme
                                                        .outlineVariant,
                                            ),
                                            color:
                                                (_isMultiSelect
                                                        ? _selectedChoiceIds
                                                        : {_selectedChoiceId})
                                                    .contains(choice.id)
                                                ? Theme.of(context)
                                                      .colorScheme
                                                      .secondary
                                                      .withValues(alpha: 0.12)
                                                : Theme.of(context)
                                                      .colorScheme
                                                      .surfaceContainerHighest
                                                      .withValues(alpha: 0.2),
                                          ),
                                          child: Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Icon(
                                                (_isMultiSelect
                                                            ? _selectedChoiceIds
                                                            : {_selectedChoiceId})
                                                        .contains(choice.id)
                                                    ? Icons.check_circle_rounded
                                                    : Icons.circle_outlined,
                                                color: Theme.of(
                                                  context,
                                                ).colorScheme.secondary,
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    if (choice
                                                        .choiceText
                                                        .isNotEmpty)
                                                      Text(choice.choiceText),
                                                    if (choice
                                                        .imageUrl
                                                        .isNotEmpty) ...[
                                                      const SizedBox(
                                                        height: 10,
                                                      ),
                                                      ClipRRect(
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              14,
                                                            ),
                                                        child: Image.network(
                                                          choice.imageUrl,
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: _submitting || !_canSubmit()
                                ? null
                                : _submit,
                            child: Text(
                              _submitting
                                  ? 'Submitting...'
                                  : _submittedQuestionId == question.id
                                  ? 'Submitted'
                                  : 'Submit answer',
                            ),
                          ),
                          if (question.explanation.isNotEmpty &&
                              _submittedQuestionId == question.id) ...[
                            const SizedBox(height: 16),
                            AppSectionCard(
                              title: 'Explanation',
                              child: Text(question.explanation),
                            ),
                          ],
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  AppSectionCard(
                    title: 'Leaderboard',
                    subtitle:
                        'Live ranking updates while the session is running.',
                    child: _leaderboard.isEmpty
                        ? const EmptyMessageCard(
                            title: 'No leaderboard yet',
                            message:
                                'Scores will appear once answers start coming in.',
                          )
                        : Column(
                            children: _leaderboard
                                .map(
                                  (entry) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    leading: CircleAvatar(
                                      backgroundColor: Theme.of(context)
                                          .colorScheme
                                          .secondary
                                          .withValues(alpha: 0.12),
                                      foregroundColor: Theme.of(
                                        context,
                                      ).colorScheme.secondary,
                                      child: Text('${entry.rank}'),
                                    ),
                                    title: Text(entry.displayName),
                                    trailing: Text(
                                      '${entry.totalScore}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                  if (_state?.status == 5 && participant != null) ...[
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.go(
                        '/player/result/${widget.sessionId}/${participant.participantId}',
                      ),
                      child: const Text('Open final result'),
                    ),
                  ],
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

class LiveResultScreen extends ConsumerStatefulWidget {
  const LiveResultScreen({
    super.key,
    required this.sessionId,
    required this.participantId,
  });

  final int sessionId;
  final int participantId;

  @override
  ConsumerState<LiveResultScreen> createState() => _LiveResultScreenState();
}

class _LiveResultScreenState extends ConsumerState<LiveResultScreen> {
  ParticipantResult? _result;
  bool _loading = true;
  String? _error;

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
      final result = await ref
          .read(appRepositoryProvider)
          .getPlayerResult(widget.sessionId, widget.participantId);
      if (!mounted) return;
      setState(() => _result = result);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load result.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Final result')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_loading)
              const LoadingPane(label: 'Loading final result...')
            else if (_error != null)
              ErrorMessageCard(message: _error!, onRetry: _load)
            else if (_result != null)
              AppSectionCard(
                title: _result!.displayName,
                subtitle: 'Session performance summary',
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: 200,
                      child: StatTile(
                        label: 'Score',
                        value: '${_result!.totalScore}',
                        accent: true,
                      ),
                    ),
                    SizedBox(
                      width: 200,
                      child: StatTile(
                        label: 'Correct',
                        value: '${_result!.correctAnswers}',
                      ),
                    ),
                    SizedBox(
                      width: 200,
                      child: StatTile(
                        label: 'Wrong',
                        value: '${_result!.wrongAnswers}',
                      ),
                    ),
                    SizedBox(
                      width: 200,
                      child: StatTile(
                        label: 'Avg response',
                        value:
                            '${_result!.averageResponseTimeMs.toStringAsFixed(0)} ms',
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class TestModeListScreen extends ConsumerStatefulWidget {
  const TestModeListScreen({super.key});

  @override
  ConsumerState<TestModeListScreen> createState() => _TestModeListScreenState();
}

class _TestModeListScreenState extends ConsumerState<TestModeListScreen> {
  bool _loading = true;
  String? _error;
  PagedResponse<QuizItem>? _paged;

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
      final paged = await ref.read(appRepositoryProvider).getTestModeQuizzes();
      if (!mounted) return;
      setState(() => _paged = paged);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load tests.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _start(int quizId) async {
    try {
      final attemptId = await ref
          .read(appRepositoryProvider)
          .startTestAttempt(quizId);
      if (!mounted) return;
      context.go('/player/test-attempt/$attemptId');
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is AppException
                ? error.message
                : 'Unable to start test mode.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          AppSectionCard(
            title: 'Test mode',
            subtitle:
                'Start or resume published tests and review your work afterwards.',
            child: _loading
                ? const LoadingPane(label: 'Loading tests...')
                : _error != null
                ? ErrorMessageCard(message: _error!, onRetry: _load)
                : (_paged?.items.isEmpty ?? true)
                ? const EmptyMessageCard(
                    title: 'No published tests',
                    message:
                        'Ask your host to publish test-mode quizzes first.',
                  )
                : Column(
                    children: _paged!.items
                        .map(
                          (quiz) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Card(
                              child: ListTile(
                                contentPadding: const EdgeInsets.all(16),
                                title: Text(quiz.title),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    '${quiz.durationMinutes} min • ${quiz.questionsCount} questions • ${quiz.categories.map((e) => e.name).join(', ')}',
                                  ),
                                ),
                                trailing: FilledButton(
                                  onPressed: () => _start(quiz.id),
                                  child: const Text('Start'),
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

class TestAttemptScreen extends ConsumerStatefulWidget {
  const TestAttemptScreen({super.key, required this.attemptId});

  final int attemptId;

  @override
  ConsumerState<TestAttemptScreen> createState() => _TestAttemptScreenState();
}

class _TestAttemptScreenState extends ConsumerState<TestAttemptScreen> {
  Timer? _timer;
  TestAttemptOverview? _overview;
  TestQuestionView? _question;
  TestAttemptResult? _result;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  int? _selectedChoiceId;
  final Set<int> _selectedChoiceIds = <int>{};
  final TextEditingController _textAnswerController = TextEditingController();
  int _localElapsedSeconds = 0;

  bool get _isMultiSelect =>
      _question != null &&
      _question!.question.type != 3 &&
      _question!.question.selectionMode == 2;

  @override
  void initState() {
    super.initState();
    Future.microtask(_loadInitial);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _result != null) return;
      if (_overview?.durationMinutes != null &&
          _overview!.durationMinutes > 0) {
        setState(() => _localElapsedSeconds++);
        if (_timeLeftSeconds() <= 0) {
          _finish();
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _textAnswerController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final overview = await ref
          .read(appRepositoryProvider)
          .getTestOverview(widget.attemptId);
      final question = await ref
          .read(appRepositoryProvider)
          .getTestQuestion(
            widget.attemptId,
            questionIndex: overview.currentQuestionIndex,
          );
      if (!mounted) return;
      _overview = overview;
      _localElapsedSeconds = overview.elapsedSeconds;
      _applyQuestion(question);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load test attempt.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _applyQuestion(TestQuestionView question) {
    _question = question;
    _selectedChoiceId = question.selectedChoiceId;
    _selectedChoiceIds
      ..clear()
      ..addAll(question.selectedChoiceIds);
    _textAnswerController.text = question.textAnswer;
    setState(() {});
  }

  Future<bool> _saveCurrentAnswer() async {
    final question = _question;
    if (question == null) return true;

    final hasAnswer = question.question.type == 3
        ? _textAnswerController.text.trim().isNotEmpty
        : _isMultiSelect
        ? _selectedChoiceIds.isNotEmpty
        : _selectedChoiceId != null;

    if (!hasAnswer) {
      return true;
    }

    setState(() => _saving = true);
    try {
      await ref.read(appRepositoryProvider).submitTestAnswer(widget.attemptId, {
        'questionId': question.question.id,
        'selectedChoiceId': !_isMultiSelect ? _selectedChoiceId : null,
        'selectedChoiceIds': _isMultiSelect
            ? _selectedChoiceIds.toList()
            : <int>[],
        'textAnswer': question.question.type == 3
            ? _textAnswerController.text.trim()
            : null,
      });
      final overview = await ref
          .read(appRepositoryProvider)
          .getTestOverview(widget.attemptId);
      if (!mounted) return false;
      setState(() => _overview = overview);
      return true;
    } catch (error) {
      if (!mounted) return false;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to save your answer.',
      );
      return false;
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _goToQuestion(int index) async {
    final saved = await _saveCurrentAnswer();
    if (!saved) return;
    try {
      final question = await ref
          .read(appRepositoryProvider)
          .getTestQuestion(widget.attemptId, questionIndex: index);
      if (!mounted) return;
      _applyQuestion(question);
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Unable to move to that question.',
      );
    }
  }

  Future<void> _finish() async {
    if (_saving) return;
    final saved = await _saveCurrentAnswer();
    if (!saved) return;
    setState(() => _saving = true);
    try {
      final result = await ref
          .read(appRepositoryProvider)
          .finishTestAttempt(widget.attemptId);
      if (!mounted) return;
      _result = result;
      setState(() {});
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Unable to finish attempt.',
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  int _timeLeftSeconds() {
    if (_overview == null || _overview!.durationMinutes <= 0) {
      return 0;
    }
    return (_overview!.durationMinutes * 60) - _localElapsedSeconds;
  }

  String _formatTimer(int seconds) {
    final safe = seconds < 0 ? 0 : seconds;
    final mins = safe ~/ 60;
    final secs = safe % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_result != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test result')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              AppSectionCard(
                title: _result!.quizTitle,
                subtitle: 'Final summary',
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: 180,
                      child: StatTile(
                        label: 'Score',
                        value: '${_result!.totalScore}',
                        accent: true,
                      ),
                    ),
                    SizedBox(
                      width: 180,
                      child: StatTile(
                        label: 'Correct',
                        value: '${_result!.correctAnswers}',
                      ),
                    ),
                    SizedBox(
                      width: 180,
                      child: StatTile(
                        label: 'Wrong',
                        value: '${_result!.wrongAnswers}',
                      ),
                    ),
                    SizedBox(
                      width: 180,
                      child: StatTile(
                        label: 'Accuracy',
                        value:
                            '${_result!.accuracyPercent.toStringAsFixed(1)}%',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppSectionCard(
                title: 'Answer review',
                child: Column(
                  children: _result!.reviewQuestions
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Q${item.questionIndex + 1} • ${item.questionTitle}',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 10),
                                  HtmlBlock(item.questionText),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Your answer: ${item.selectedAnswerText.isEmpty ? '-' : item.selectedAnswerText}',
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Correct answer: ${item.correctAnswerText}',
                                  ),
                                  if (item.explanation.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text('Explanation: ${item.explanation}'),
                                  ],
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
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_overview?.quizTitle ?? 'Test attempt'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _finish,
            icon: const Icon(Icons.check_circle_outline_rounded),
            tooltip: 'Finish attempt',
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingPane(label: 'Loading attempt...')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_overview != null)
                    AppSectionCard(
                      title: 'Attempt overview',
                      subtitle:
                          'Answer questions in any order. The app saves answers when you move around.',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              SizedBox(
                                width: 150,
                                child: StatTile(
                                  label: 'Current',
                                  value:
                                      '${(_question?.questionIndex ?? 0) + 1}/${_overview!.totalQuestions}',
                                ),
                              ),
                              SizedBox(
                                width: 150,
                                child: StatTile(
                                  label: 'Answered',
                                  value: '${_overview!.answeredQuestions}',
                                ),
                              ),
                              SizedBox(
                                width: 150,
                                child: StatTile(
                                  label: 'Remaining',
                                  value: '${_overview!.remainingQuestions}',
                                ),
                              ),
                              SizedBox(
                                width: 150,
                                child: StatTile(
                                  label: _overview!.durationMinutes > 0
                                      ? 'Time left'
                                      : 'Limit',
                                  value: _overview!.durationMinutes > 0
                                      ? _formatTimer(_timeLeftSeconds())
                                      : 'Open',
                                  accent:
                                      _overview!.durationMinutes > 0 &&
                                      _timeLeftSeconds() <= 60,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _overview!.questions
                                .map(
                                  (item) => ChoiceChip(
                                    label: Text('${item.questionIndex + 1}'),
                                    selected:
                                        _question?.questionIndex ==
                                        item.questionIndex,
                                    onSelected: (_) =>
                                        _goToQuestion(item.questionIndex),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  if (_question != null)
                    AppSectionCard(
                      title: _question!.question.title,
                      subtitle: _question!.question.type == 3
                          ? 'Short answer'
                          : (_isMultiSelect
                                ? 'Multiple choice'
                                : 'Single choice'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          HtmlBlock(_question!.question.text),
                          if (_question!.question.imageUrl.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: Image.network(
                                _question!.question.imageUrl,
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),
                          if (_question!.question.type == 3)
                            TextField(
                              controller: _textAnswerController,
                              minLines: 4,
                              maxLines: 7,
                              decoration: const InputDecoration(
                                labelText: 'Your answer',
                              ),
                            )
                          else
                            Column(
                              children: _question!.question.choices
                                  .map(
                                    (choice) => Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 10,
                                      ),
                                      child: InkWell(
                                        onTap: () {
                                          setState(() {
                                            if (_isMultiSelect) {
                                              if (_selectedChoiceIds.contains(
                                                choice.id,
                                              )) {
                                                _selectedChoiceIds.remove(
                                                  choice.id,
                                                );
                                              } else {
                                                _selectedChoiceIds.add(
                                                  choice.id,
                                                );
                                              }
                                            } else {
                                              _selectedChoiceId = choice.id;
                                            }
                                          });
                                        },
                                        borderRadius: BorderRadius.circular(16),
                                        child: Ink(
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                              16,
                                            ),
                                            border: Border.all(
                                              color:
                                                  (_isMultiSelect
                                                          ? _selectedChoiceIds
                                                          : {_selectedChoiceId})
                                                      .contains(choice.id)
                                                  ? Theme.of(
                                                      context,
                                                    ).colorScheme.secondary
                                                  : Theme.of(context)
                                                        .colorScheme
                                                        .outlineVariant,
                                            ),
                                            color:
                                                (_isMultiSelect
                                                        ? _selectedChoiceIds
                                                        : {_selectedChoiceId})
                                                    .contains(choice.id)
                                                ? Theme.of(context)
                                                      .colorScheme
                                                      .secondary
                                                      .withValues(alpha: 0.12)
                                                : Theme.of(context)
                                                      .colorScheme
                                                      .surfaceContainerHighest
                                                      .withValues(alpha: 0.2),
                                          ),
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              if (choice.choiceText.isNotEmpty)
                                                Text(choice.choiceText),
                                              if (choice
                                                  .imageUrl
                                                  .isNotEmpty) ...[
                                                const SizedBox(height: 10),
                                                ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(12),
                                                  child: Image.network(
                                                    choice.imageUrl,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              FilledButton.tonal(
                                onPressed: _question!.questionIndex > 0
                                    ? () => _goToQuestion(
                                        _question!.questionIndex - 1,
                                      )
                                    : null,
                                child: const Text('Previous'),
                              ),
                              FilledButton.tonal(
                                onPressed:
                                    (_question!.questionIndex + 1) <
                                        (_overview?.totalQuestions ?? 0)
                                    ? () => _goToQuestion(
                                        _question!.questionIndex + 1,
                                      )
                                    : null,
                                child: const Text('Next'),
                              ),
                              FilledButton(
                                onPressed: _saving ? null : _finish,
                                child: Text(
                                  _saving ? 'Saving...' : 'Finish attempt',
                                ),
                              ),
                            ],
                          ),
                        ],
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

class PlayerHistoryScreen extends ConsumerStatefulWidget {
  const PlayerHistoryScreen({super.key});

  @override
  ConsumerState<PlayerHistoryScreen> createState() =>
      _PlayerHistoryScreenState();
}

class _PlayerHistoryScreenState extends ConsumerState<PlayerHistoryScreen> {
  bool _loading = true;
  String? _error;
  List<PlayerSessionHistoryItem> _live = const [];
  List<PlayerTestHistoryItem> _tests = const [];

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
        repo.getMyLiveHistory(),
        repo.getMyTestHistory(),
      ]);
      if (!mounted) return;
      setState(() {
        _live = results[0] as List<PlayerSessionHistoryItem>;
        _tests = results[1] as List<PlayerTestHistoryItem>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error is AppException
            ? error.message
            : 'Failed to load history.',
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          if (_loading)
            const LoadingPane(label: 'Loading your history...')
          else ...[
            AppSectionCard(
              title: 'Live sessions history',
              child: _live.isEmpty
                  ? const EmptyMessageCard(
                      title: 'No live history yet',
                      message: 'Your completed live sessions will appear here.',
                    )
                  : Column(
                      children: _live
                          .map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Card(
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(16),
                                  title: Text(item.quizTitle),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      '${statusLabel(item.sessionStatus)} • Score ${item.totalScore} • Correct ${item.correctAnswers} • ${formatDateTime(item.joinedAt)}',
                                    ),
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
              title: 'Test mode history',
              child: _tests.isEmpty
                  ? const EmptyMessageCard(
                      title: 'No test attempts yet',
                      message:
                          'Start a published test to see detailed review here.',
                    )
                  : Column(
                      children: _tests
                          .map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Card(
                                child: ListTile(
                                  contentPadding: const EdgeInsets.all(16),
                                  title: Text(item.quizTitle),
                                  subtitle: Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      'Score ${item.totalScore} • Accuracy ${item.accuracyPercent.toStringAsFixed(1)}% • ${formatDateTime(item.endedAt)}',
                                    ),
                                  ),
                                  trailing: FilledButton.tonal(
                                    onPressed: () => context.go(
                                      '/player/test-attempt/${item.attemptId}',
                                    ),
                                    child: const Text('Review'),
                                  ),
                                ),
                              ),
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
        ],
      ),
    );
  }
}
