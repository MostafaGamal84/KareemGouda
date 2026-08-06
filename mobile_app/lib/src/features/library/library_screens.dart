import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/app_repository.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class QuestionsScreen extends ConsumerStatefulWidget {
  const QuestionsScreen({super.key});

  @override
  ConsumerState<QuestionsScreen> createState() => _QuestionsScreenState();
}

class _QuestionsScreenState extends ConsumerState<QuestionsScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  int _type = 0;
  int _categoryId = 0;
  List<QuestionItem> _questions = const [];
  List<CategoryRef> _categories = const [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(appRepositoryProvider);
      final results = await Future.wait<Object?>([
        repo.getQuestionCategories(),
        repo.getQuestions(
          pageSize: 100,
          search: _searchController.text,
          type: _type == 0 ? null : _type,
          categoryId: _categoryId == 0 ? null : _categoryId,
        ),
      ]);
      if (!mounted) {
        return;
      }
      setState(() {
        _categories = results[0] as List<CategoryRef>;
        _questions = results[1] as List<QuestionItem>;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Failed to load questions.'),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _deleteQuestion(QuestionItem item) async {
    final confirmed = await _confirmAction(
      context,
      title: 'Delete question?',
      message: 'This will archive "${item.title}" from the bank.',
    );
    if (confirmed != true) {
      return;
    }

    try {
      await ref.read(appRepositoryProvider).deleteQuestion(item.id);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Question deleted.')));
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Unable to delete question.'),
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
            title: 'Question bank',
            subtitle:
                'Browse, search, and maintain reusable questions for tests and live sessions.',
            actions: [
              FilledButton.icon(
                onPressed: () => context.go('/host/questions/new'),
                icon: const Icon(Icons.add_rounded),
                label: const Text('New'),
              ),
            ],
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    labelText: 'Search',
                    suffixIcon: IconButton(
                      onPressed: _load,
                      icon: const Icon(Icons.search_rounded),
                    ),
                  ),
                  onSubmitted: (_) => _load(),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _type,
                        items: const [
                          DropdownMenuItem(value: 0, child: Text('All types')),
                          DropdownMenuItem(
                            value: 1,
                            child: Text('Multiple choice'),
                          ),
                          DropdownMenuItem(
                            value: 2,
                            child: Text('True / False'),
                          ),
                          DropdownMenuItem(
                            value: 3,
                            child: Text('Short answer'),
                          ),
                        ],
                        onChanged: (value) =>
                            setState(() => _type = value ?? 0),
                        decoration: const InputDecoration(labelText: 'Type'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _categoryId,
                        items: [
                          const DropdownMenuItem(
                            value: 0,
                            child: Text('All categories'),
                          ),
                          ..._categories.map(
                            (item) => DropdownMenuItem(
                              value: item.id,
                              child: Text(item.name),
                            ),
                          ),
                        ],
                        onChanged: (value) =>
                            setState(() => _categoryId = value ?? 0),
                        decoration: const InputDecoration(
                          labelText: 'Category',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonal(
                    onPressed: _load,
                    child: const Text('Apply filters'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const LoadingPane(label: 'Loading questions...')
          else if (_error != null)
            ErrorMessageCard(message: _error!, onRetry: _load)
          else if (_questions.isEmpty)
            const EmptyMessageCard(
              title: 'No questions found',
              message: 'Try a different filter or create your first question.',
            )
          else
            ..._questions.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${questionTypeLabel(item.type)} - ${selectionModeLabel(item.selectionMode)} - ${item.points} pts',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (value) {
                                if (value == 'edit') {
                                  context.go('/host/questions/${item.id}/edit');
                                } else if (value == 'delete') {
                                  _deleteQuestion(item);
                                }
                              },
                              itemBuilder: (context) => const [
                                PopupMenuItem(
                                  value: 'edit',
                                  child: Text('Edit'),
                                ),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete'),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        HtmlBlock(item.text),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (item.categories.isNotEmpty)
                              ...item.categories.map(
                                (category) => Chip(label: Text(category.name)),
                              )
                            else if (item.categoryName.isNotEmpty)
                              Chip(label: Text(item.categoryName)),
                            if (item.answerSeconds > 0)
                              Chip(label: Text('${item.answerSeconds} sec')),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class QuestionEditorScreen extends ConsumerStatefulWidget {
  const QuestionEditorScreen({super.key, this.questionId});

  final int? questionId;

  @override
  ConsumerState<QuestionEditorScreen> createState() =>
      _QuestionEditorScreenState();
}

class _QuestionEditorScreenState extends ConsumerState<QuestionEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _textController = TextEditingController();
  final TextEditingController _difficultyController = TextEditingController();
  final TextEditingController _explanationController = TextEditingController();
  final TextEditingController _pointsController = TextEditingController(
    text: '1',
  );
  final TextEditingController _secondsController = TextEditingController(
    text: '30',
  );

  bool _loading = true;
  bool _saving = false;
  String? _error;
  int _type = 1;
  int _selectionMode = 1;
  final Set<int> _categoryIds = <int>{};
  List<CategoryRef> _categories = const [];
  List<_EditableChoice> _choices = [];

  bool get _isEditing => widget.questionId != null;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _textController.dispose();
    _difficultyController.dispose();
    _explanationController.dispose();
    _pointsController.dispose();
    _secondsController.dispose();
    for (final choice in _choices) {
      choice.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(appRepositoryProvider);
      final categories = await repo.getQuestionCategories();
      QuestionItem? question;
      if (_isEditing) {
        question = await repo.getQuestionById(widget.questionId!);
      }
      if (!mounted) {
        return;
      }

      _categories = categories;
      if (question != null) {
        _titleController.text = question.title;
        _textController.text = question.text;
        _difficultyController.text = question.difficulty;
        _explanationController.text = question.explanation;
        _pointsController.text = question.points.toString();
        _secondsController.text = question.answerSeconds.toString();
        _type = question.type;
        _selectionMode = question.selectionMode;
        _categoryIds
          ..clear()
          ..addAll(question.categories.map((item) => item.id));
        _resetChoices(question.choices);
      } else {
        _ensureDefaultChoices();
      }
      setState(() {});
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _errorMessage(error, 'Failed to load question.'));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _resetChoices(List<QuestionChoice> source) {
    for (final choice in _choices) {
      choice.dispose();
    }
    _choices = source
        .map(
          (item) => _EditableChoice(
            id: item.id,
            text: item.choiceText,
            isCorrect: item.isCorrect,
            imageUrl: item.imageUrl,
          ),
        )
        .toList();
    if (_choices.isEmpty) {
      _ensureDefaultChoices();
    }
  }

  void _ensureDefaultChoices() {
    for (final choice in _choices) {
      choice.dispose();
    }
    if (_type == 2) {
      _choices = [
        _EditableChoice(text: 'True', isCorrect: true),
        _EditableChoice(text: 'False'),
      ];
      return;
    }
    _choices = [
      _EditableChoice(text: ''),
      _EditableChoice(text: ''),
      _EditableChoice(text: ''),
      _EditableChoice(text: ''),
    ];
  }

  void _updateType(int value) {
    setState(() {
      _type = value;
      if (_type == 2) {
        _selectionMode = 1;
      }
      _ensureDefaultChoices();
    });
  }

  void _addChoice() {
    setState(() => _choices.add(_EditableChoice(text: '')));
  }

  void _removeChoice(_EditableChoice choice) {
    if (_choices.length <= 2) {
      return;
    }
    setState(() {
      _choices.remove(choice);
      choice.dispose();
    });
  }

  Map<String, dynamic> _buildPayload() {
    final points = int.tryParse(_pointsController.text.trim()) ?? 1;
    final seconds = int.tryParse(_secondsController.text.trim()) ?? 30;

    List<Map<String, dynamic>> choices = const [];
    if (_type == 2) {
      choices = [
        _EditableChoice(
          text: 'True',
          isCorrect: _choices.first.isCorrect,
        ).toQuestionChoice(order: 1).toRequestJson(),
        _EditableChoice(
          text: 'False',
          isCorrect: !_choices.first.isCorrect,
        ).toQuestionChoice(order: 2).toRequestJson(),
      ];
    } else if (_type != 3) {
      choices = _choices
          .asMap()
          .entries
          .map(
            (entry) => entry.value
                .toQuestionChoice(order: entry.key + 1)
                .toRequestJson(),
          )
          .toList();
    }

    return {
      'title': _titleController.text.trim(),
      'text': _textController.text.trim(),
      'type': _type,
      'selectionMode': _type == 3 ? 1 : _selectionMode,
      'difficulty': _difficultyController.text.trim().isEmpty
          ? null
          : _difficultyController.text.trim(),
      'explanation': _explanationController.text.trim().isEmpty
          ? null
          : _explanationController.text.trim(),
      'points': points,
      'answerSeconds': seconds,
      'categoryIds': _categoryIds.toList(),
      'choices': choices,
    };
  }

  String? _validateQuestion() {
    if (!_formKey.currentState!.validate()) {
      return 'Please complete the required fields.';
    }
    if (_type != 3) {
      final filledChoices = _choices
          .where((item) => item.textController.text.trim().isNotEmpty)
          .toList();
      if (_type == 1 && filledChoices.length < 2) {
        return 'Add at least two answer choices.';
      }
      final correctCount = filledChoices.where((item) => item.isCorrect).length;
      if (correctCount == 0) {
        return 'Mark at least one correct choice.';
      }
      if (_selectionMode == 1 && correctCount > 1) {
        return 'Single-choice questions can only have one correct answer.';
      }
    }
    return null;
  }

  Future<void> _save() async {
    final validationError = _validateQuestion();
    if (validationError != null) {
      setState(() => _error = validationError);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final repo = ref.read(appRepositoryProvider);
      final payload = _buildPayload();
      final saved = _isEditing
          ? await repo.updateQuestion(widget.questionId!, payload)
          : await repo.createQuestion(payload);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEditing ? 'Question updated.' : 'Question created.'),
        ),
      );
      context.go('/host/questions/${saved.id}/edit');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _errorMessage(error, 'Unable to save question.'));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit question' : 'New question'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.save_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingPane(label: 'Loading editor...')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  AppSectionCard(
                    title: _isEditing ? 'Question details' : 'Create question',
                    subtitle:
                        'This editor sends the same payload structure already used by the web app.',
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TextFormField(
                            controller: _titleController,
                            decoration: const InputDecoration(
                              labelText: 'Title',
                            ),
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                ? 'Title is required.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _textController,
                            decoration: const InputDecoration(
                              labelText: 'Question text / HTML',
                            ),
                            minLines: 4,
                            maxLines: 8,
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                ? 'Question text is required.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<int>(
                            initialValue: _type,
                            items: const [
                              DropdownMenuItem(
                                value: 1,
                                child: Text('Multiple choice'),
                              ),
                              DropdownMenuItem(
                                value: 2,
                                child: Text('True / False'),
                              ),
                              DropdownMenuItem(
                                value: 3,
                                child: Text('Short answer'),
                              ),
                            ],
                            onChanged: (value) => _updateType(value ?? 1),
                            decoration: const InputDecoration(
                              labelText: 'Type',
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (_type == 1)
                            DropdownButtonFormField<int>(
                              initialValue: _selectionMode,
                              items: const [
                                DropdownMenuItem(
                                  value: 1,
                                  child: Text('Single correct'),
                                ),
                                DropdownMenuItem(
                                  value: 2,
                                  child: Text('Multiple correct'),
                                ),
                              ],
                              onChanged: (value) =>
                                  setState(() => _selectionMode = value ?? 1),
                              decoration: const InputDecoration(
                                labelText: 'Selection mode',
                              ),
                            ),
                          if (_type == 1) const SizedBox(height: 12),
                          TextFormField(
                            controller: _difficultyController,
                            decoration: const InputDecoration(
                              labelText: 'Difficulty',
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _pointsController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Points',
                                  ),
                                  validator: (value) =>
                                      (int.tryParse((value ?? '').trim()) ??
                                              0) <=
                                          0
                                      ? 'Enter valid points.'
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _secondsController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Answer seconds',
                                  ),
                                  validator: (value) =>
                                      (int.tryParse((value ?? '').trim()) ??
                                              0) <=
                                          0
                                      ? 'Enter valid seconds.'
                                      : null,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _explanationController,
                            decoration: const InputDecoration(
                              labelText: 'Explanation',
                            ),
                            minLines: 3,
                            maxLines: 6,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Categories',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _categories
                                .map(
                                  (item) => FilterChip(
                                    label: Text(item.name),
                                    selected: _categoryIds.contains(item.id),
                                    onSelected: (selected) {
                                      setState(() {
                                        if (selected) {
                                          _categoryIds.add(item.id);
                                        } else {
                                          _categoryIds.remove(item.id);
                                        }
                                      });
                                    },
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_type != 3) ...[
                    const SizedBox(height: 16),
                    AppSectionCard(
                      title: 'Answer choices',
                      subtitle: _type == 2
                          ? 'Pick which of the built-in true/false options is correct.'
                          : 'Add the visible answer options and mark the correct one(s).',
                      actions: _type == 1
                          ? [
                              FilledButton.tonal(
                                onPressed: _addChoice,
                                child: const Text('Add choice'),
                              ),
                            ]
                          : const [],
                      child: Column(
                        children: [
                          if (_type == 2)
                            CheckboxListTile(
                              value: _choices.isNotEmpty
                                  ? _choices.first.isCorrect
                                  : true,
                              onChanged: (value) {
                                setState(() {
                                  if (_choices.length < 2) {
                                    _ensureDefaultChoices();
                                  }
                                  _choices[0].isCorrect = value == true;
                                  _choices[1].isCorrect = value != true;
                                });
                              },
                              title: const Text('True is correct'),
                              controlAffinity: ListTileControlAffinity.leading,
                            ),
                          if (_type == 2)
                            CheckboxListTile(
                              value: _choices.length > 1
                                  ? _choices[1].isCorrect
                                  : false,
                              onChanged: (value) {
                                setState(() {
                                  if (_choices.length < 2) {
                                    _ensureDefaultChoices();
                                  }
                                  _choices[0].isCorrect = value == true;
                                  _choices[1].isCorrect = value != true;
                                });
                              },
                              title: const Text('False is correct'),
                              controlAffinity: ListTileControlAffinity.leading,
                            ),
                          if (_type == 1)
                            ..._choices.map(
                              (choice) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: TextField(
                                                controller:
                                                    choice.textController,
                                                decoration:
                                                    const InputDecoration(
                                                      labelText: 'Choice text',
                                                    ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            IconButton(
                                              onPressed: () =>
                                                  _removeChoice(choice),
                                              icon: const Icon(
                                                Icons.delete_outline_rounded,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        SwitchListTile(
                                          value: choice.isCorrect,
                                          contentPadding: EdgeInsets.zero,
                                          title: Text(
                                            _selectionMode == 1
                                                ? 'Correct answer'
                                                : 'Include in correct answers',
                                          ),
                                          onChanged: (value) {
                                            setState(() {
                                              if (_selectionMode == 1 &&
                                                  value) {
                                                for (final item in _choices) {
                                                  item.isCorrect = false;
                                                }
                                              }
                                              choice.isCorrect = value;
                                            });
                                          },
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    ErrorMessageCard(message: _error!),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: Text(_saving ? 'Saving...' : 'Save question'),
                  ),
                ],
              ),
      ),
    );
  }
}

class QuizzesScreen extends ConsumerStatefulWidget {
  const QuizzesScreen({super.key});

  @override
  ConsumerState<QuizzesScreen> createState() => _QuizzesScreenState();
}

class _QuizzesScreenState extends ConsumerState<QuizzesScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  int _mode = 0;
  List<QuizItem> _quizzes = const [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final quizzes = await ref
          .read(appRepositoryProvider)
          .getQuizzes(
            pageSize: 100,
            mode: _mode == 0 ? null : _mode,
            search: _searchController.text,
          );
      if (!mounted) {
        return;
      }
      setState(() => _quizzes = quizzes);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _errorMessage(error, 'Failed to load quizzes.'));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _deleteQuiz(QuizItem item) async {
    final confirmed = await _confirmAction(
      context,
      title: 'Delete quiz?',
      message: 'This will remove "${item.title}" from the catalog.',
    );
    if (confirmed != true) {
      return;
    }
    try {
      await ref.read(appRepositoryProvider).deleteQuiz(item.id);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Quiz deleted.')));
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _errorMessage(error, 'Unable to delete quiz.'));
    }
  }

  Future<void> _togglePublish(QuizItem item) async {
    try {
      await ref
          .read(appRepositoryProvider)
          .publishQuiz(item.id, !item.isPublished);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            item.isPublished ? 'Quiz unpublished.' : 'Quiz published.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Unable to update publish state.'),
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
            title: 'Quiz library',
            subtitle:
                'Build tests, attach questions, and manage access rules from the same mobile app.',
            actions: [
              FilledButton.icon(
                onPressed: () => context.go('/host/quizzes/new'),
                icon: const Icon(Icons.add_rounded),
                label: const Text('New'),
              ),
            ],
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    labelText: 'Search',
                    suffixIcon: IconButton(
                      onPressed: _load,
                      icon: const Icon(Icons.search_rounded),
                    ),
                  ),
                  onSubmitted: (_) => _load(),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: _mode,
                  items: const [
                    DropdownMenuItem(value: 0, child: Text('All available')),
                    DropdownMenuItem(
                      value: 1,
                      child: Text('Test mode quizzes'),
                    ),
                    DropdownMenuItem(value: 2, child: Text('Game quizzes')),
                  ],
                  onChanged: (value) => setState(() => _mode = value ?? 0),
                  decoration: const InputDecoration(labelText: 'Mode'),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonal(
                    onPressed: _load,
                    child: const Text('Apply filters'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const LoadingPane(label: 'Loading quizzes...')
          else if (_error != null)
            ErrorMessageCard(message: _error!, onRetry: _load)
          else if (_quizzes.isEmpty)
            const EmptyMessageCard(
              title: 'No quizzes found',
              message:
                  'Create a test or change the filters to see more results.',
            )
          else
            ..._quizzes.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${quizModeLabel(item.mode)} - ${item.questionsCount} questions - ${item.durationMinutes} min',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (value) {
                                switch (value) {
                                  case 'edit':
                                    context.go('/host/quizzes/${item.id}/edit');
                                    break;
                                  case 'publish':
                                    _togglePublish(item);
                                    break;
                                  case 'delete':
                                    _deleteQuiz(item);
                                    break;
                                }
                              },
                              itemBuilder: (context) => [
                                const PopupMenuItem(
                                  value: 'edit',
                                  child: Text('Edit'),
                                ),
                                PopupMenuItem(
                                  value: 'publish',
                                  child: Text(
                                    item.isPublished ? 'Unpublish' : 'Publish',
                                  ),
                                ),
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete'),
                                ),
                              ],
                            ),
                          ],
                        ),
                        if (item.description.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(item.description),
                        ],
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            Chip(
                              label: Text(
                                item.isPublished ? 'Published' : 'Draft',
                              ),
                            ),
                            if (item.examMode != null)
                              Chip(label: Text(examModeLabel(item.examMode!))),
                            if (item.accessType != null)
                              Chip(
                                label: Text(accessTypeLabel(item.accessType!)),
                              ),
                            ...item.categories.map(
                              (category) => Chip(label: Text(category.name)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class QuizEditorScreen extends ConsumerStatefulWidget {
  const QuizEditorScreen({super.key, this.quizId});

  final int? quizId;

  @override
  ConsumerState<QuizEditorScreen> createState() => _QuizEditorScreenState();
}

class _QuizEditorScreenState extends ConsumerState<QuizEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _durationController = TextEditingController(
    text: '30',
  );
  final TextEditingController _totalMarksController = TextEditingController();
  final TextEditingController _categoriesController = TextEditingController();
  final TextEditingController _maxAttemptsController = TextEditingController(
    text: '1',
  );
  final TextEditingController _timerMinutesController = TextEditingController();
  final TextEditingController _scheduledStartController =
      TextEditingController();
  final TextEditingController _scheduledEndController = TextEditingController();
  final TextEditingController _questionSearchController =
      TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  int _mode = 1;
  bool _isPublished = false;
  int _examMode = 2;
  int _accessType = 1;
  List<QuestionItem> _allQuestions = const [];
  List<QuizQuestionAssignment> _assignedQuestions = const [];
  List<QuestionItem> _availableQuestions = const [];
  List<StudentUser> _availableStudents = const [];
  List<StudentGroup> _availableGroups = const [];
  QuizAccessConfig? _access;
  final Set<int> _removedAssignmentIds = <int>{};
  final Set<int> _pendingQuestionIds = <int>{};
  final Set<int> _pendingUserIds = <int>{};
  final Set<int> _pendingGroupIds = <int>{};

  bool get _isEditing => widget.quizId != null;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _durationController.dispose();
    _totalMarksController.dispose();
    _categoriesController.dispose();
    _maxAttemptsController.dispose();
    _timerMinutesController.dispose();
    _scheduledStartController.dispose();
    _scheduledEndController.dispose();
    _questionSearchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(appRepositoryProvider);
      final questions = await repo.getQuestions(pageSize: 100);
      QuizItem? quiz;
      QuizAccessConfig? access;
      List<StudentUser> availableStudents = const [];
      List<StudentGroup> availableGroups = const [];
      if (_isEditing) {
        quiz = await repo.getQuizById(widget.quizId!);
        access = await repo.getQuizAccess(widget.quizId!);
        if (access != null) {
          availableStudents = await repo.getAvailableStudentsForQuiz(
            widget.quizId!,
          );
          availableGroups = await repo.getAvailableGroupsForQuiz(
            widget.quizId!,
          );
        }
      }

      if (!mounted) {
        return;
      }

      _allQuestions = questions;
      if (quiz != null) {
        _titleController.text = quiz.title;
        _descriptionController.text = quiz.description;
        _durationController.text = quiz.durationMinutes.toString();
        _totalMarksController.text = quiz.totalMarks?.toString() ?? '';
        _categoriesController.text = quiz.categories
            .map((item) => item.name)
            .join(', ');
        _mode = quiz.mode;
        _isPublished = quiz.isPublished;
        _assignedQuestions = List<QuizQuestionAssignment>.from(quiz.questions);
      }
      if (access != null) {
        _access = access;
        _examMode = access.examMode;
        _accessType = access.accessType;
        _maxAttemptsController.text = access.maxAttempts.toString();
        _timerMinutesController.text = access.timerMinutes?.toString() ?? '';
        _scheduledStartController.text = access.scheduledStartTime;
        _scheduledEndController.text = access.scheduledEndTime;
      }
      _availableStudents = availableStudents;
      _availableGroups = availableGroups;
      _refreshAvailableQuestions();
      setState(() {});
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Failed to load quiz editor.'),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _refreshAvailableQuestions() {
    final assignedIds = _assignedQuestions
        .where((item) => !_removedAssignmentIds.contains(item.id))
        .map((item) => item.questionId)
        .toSet();
    _availableQuestions = _allQuestions
        .where(
          (item) =>
              !assignedIds.contains(item.id) ||
              _pendingQuestionIds.contains(item.id),
        )
        .where(
          (item) =>
              _questionSearchController.text.trim().isEmpty ||
              item.title.toLowerCase().contains(
                _questionSearchController.text.trim().toLowerCase(),
              ),
        )
        .toList();
  }

  Map<String, dynamic> _buildQuizPayload() {
    final categories = _categoriesController.text
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();

    return {
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim().isEmpty
          ? null
          : _descriptionController.text.trim(),
      'mode': _mode,
      'durationMinutes': int.tryParse(_durationController.text.trim()) ?? 30,
      'totalMarks': _totalMarksController.text.trim().isEmpty
          ? null
          : int.tryParse(_totalMarksController.text.trim()),
      'isPublished': _isPublished,
      'categories': categories,
    };
  }

  Map<String, dynamic> _buildAccessPayload() {
    return {
      'examMode': _examMode,
      'accessType': _accessType,
      'maxAttempts': int.tryParse(_maxAttemptsController.text.trim()) ?? 1,
      'scheduledStartTime': _scheduledStartController.text.trim().isEmpty
          ? null
          : _scheduledStartController.text.trim(),
      'scheduledEndTime': _scheduledEndController.text.trim().isEmpty
          ? null
          : _scheduledEndController.text.trim(),
      'timerMinutes': _timerMinutesController.text.trim().isEmpty
          ? null
          : int.tryParse(_timerMinutesController.text.trim()),
    };
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      setState(() => _error = 'Please complete the required fields.');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final repo = ref.read(appRepositoryProvider);
      final payload = _buildQuizPayload();
      final quiz = _isEditing
          ? await repo.updateQuiz(widget.quizId!, payload)
          : await repo.createQuiz(payload);

      final activeAssignments = _assignedQuestions
          .where((item) => !_removedAssignmentIds.contains(item.id))
          .toList();
      for (final assignmentId in _removedAssignmentIds) {
        await repo.removeQuestionFromQuiz(quiz.id, assignmentId);
      }
      if (_pendingQuestionIds.isNotEmpty) {
        final items = _pendingQuestionIds.toList().asMap().entries.map((entry) {
          final question = _allQuestions.firstWhere(
            (item) => item.id == entry.value,
          );
          return {
            'questionId': question.id,
            'order': activeAssignments.length + entry.key + 1,
            'pointsOverride': null,
            'answerSeconds': question.answerSeconds,
          };
        }).toList();
        await repo.addQuestionsToQuiz(quiz.id, items);
      }

      var access = await repo.saveQuizAccess(quiz.id, _buildAccessPayload());
      if (_pendingUserIds.isNotEmpty) {
        access = await repo.addUsersToQuizAccess(
          quiz.id,
          _pendingUserIds.toList(),
        );
      }
      if (_pendingGroupIds.isNotEmpty) {
        access = await repo.addGroupsToQuizAccess(
          quiz.id,
          _pendingGroupIds.toList(),
        );
      }

      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_isEditing ? 'Quiz updated.' : 'Quiz created.')),
      );
      _access = access;
      context.go('/host/quizzes/${quiz.id}/edit');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _errorMessage(error, 'Unable to save quiz.'));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _removeAccessUser(QuizAccessUser item) async {
    final quizId = widget.quizId;
    if (quizId == null) {
      return;
    }
    try {
      final access = await ref
          .read(appRepositoryProvider)
          .removeUserFromQuizAccess(quizId, item.id);
      if (!mounted) {
        return;
      }
      setState(() => _access = access);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Unable to remove user access.'),
      );
    }
  }

  Future<void> _removeAccessGroup(QuizAccessGroup item) async {
    final quizId = widget.quizId;
    if (quizId == null) {
      return;
    }
    try {
      final access = await ref
          .read(appRepositoryProvider)
          .removeGroupFromQuizAccess(quizId, item.id);
      if (!mounted) {
        return;
      }
      setState(() => _access = access);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _errorMessage(error, 'Unable to remove group access.'),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit quiz' : 'New quiz'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.save_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const LoadingPane(label: 'Loading editor...')
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  AppSectionCard(
                    title: 'Quiz details',
                    subtitle:
                        'Core metadata, categories, and publishing state.',
                    child: Form(
                      key: _formKey,
                      child: Column(
                        children: [
                          TextFormField(
                            controller: _titleController,
                            decoration: const InputDecoration(
                              labelText: 'Title',
                            ),
                            validator: (value) =>
                                (value == null || value.trim().isEmpty)
                                ? 'Title is required.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _descriptionController,
                            decoration: const InputDecoration(
                              labelText: 'Description',
                            ),
                            minLines: 3,
                            maxLines: 6,
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<int>(
                            initialValue: _mode,
                            items: const [
                              DropdownMenuItem(
                                value: 1,
                                child: Text('Test mode'),
                              ),
                              DropdownMenuItem(
                                value: 2,
                                child: Text('Game mode'),
                              ),
                            ],
                            onChanged: (value) =>
                                setState(() => _mode = value ?? 1),
                            decoration: const InputDecoration(
                              labelText: 'Quiz mode',
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _durationController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Duration minutes',
                                  ),
                                  validator: (value) =>
                                      (int.tryParse((value ?? '').trim()) ??
                                              0) <=
                                          0
                                      ? 'Enter valid duration.'
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _totalMarksController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Total marks (optional)',
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _categoriesController,
                            decoration: const InputDecoration(
                              labelText: 'Categories',
                              hintText: 'Comma separated',
                            ),
                          ),
                          const SizedBox(height: 8),
                          SwitchListTile(
                            value: _isPublished,
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Published'),
                            onChanged: (value) =>
                                setState(() => _isPublished = value),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppSectionCard(
                    title: 'Assigned questions',
                    subtitle:
                        'Use the current question bank to attach content to this quiz.',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _questionSearchController,
                          decoration: InputDecoration(
                            labelText: 'Find question to add',
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(_refreshAvailableQuestions);
                              },
                              icon: const Icon(Icons.search_rounded),
                            ),
                          ),
                          onSubmitted: (_) =>
                              setState(_refreshAvailableQuestions),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _availableQuestions
                              .take(20)
                              .map(
                                (item) => FilterChip(
                                  label: Text(item.title),
                                  selected: _pendingQuestionIds.contains(
                                    item.id,
                                  ),
                                  onSelected: (selected) {
                                    setState(() {
                                      if (selected) {
                                        _pendingQuestionIds.add(item.id);
                                      } else {
                                        _pendingQuestionIds.remove(item.id);
                                      }
                                    });
                                  },
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 16),
                        if (_assignedQuestions
                                .where(
                                  (item) =>
                                      !_removedAssignmentIds.contains(item.id),
                                )
                                .isEmpty &&
                            _pendingQuestionIds.isEmpty)
                          const EmptyMessageCard(
                            title: 'No questions assigned',
                            message:
                                'Pick items from the bank above and save the quiz.',
                          )
                        else
                          Column(
                            children: [
                              ..._assignedQuestions
                                  .where(
                                    (item) => !_removedAssignmentIds.contains(
                                      item.id,
                                    ),
                                  )
                                  .map(
                                    (item) => ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(item.questionTitle),
                                      subtitle: Text(
                                        'Order ${item.order} - ${item.answerSeconds} sec',
                                      ),
                                      trailing: IconButton(
                                        onPressed: () {
                                          setState(
                                            () => _removedAssignmentIds.add(
                                              item.id,
                                            ),
                                          );
                                        },
                                        icon: const Icon(
                                          Icons.remove_circle_outline_rounded,
                                        ),
                                      ),
                                    ),
                                  ),
                              ..._pendingQuestionIds.map((id) {
                                final question = _allQuestions.firstWhere(
                                  (item) => item.id == id,
                                );
                                return ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: const Icon(Icons.add_task_rounded),
                                  title: Text(question.title),
                                  subtitle: const Text('Will be added on save'),
                                  trailing: IconButton(
                                    onPressed: () {
                                      setState(
                                        () => _pendingQuestionIds.remove(id),
                                      );
                                    },
                                    icon: const Icon(Icons.close_rounded),
                                  ),
                                );
                              }),
                            ],
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppSectionCard(
                    title: 'Access configuration',
                    subtitle:
                        'Control who can take this quiz and under which timing rules.',
                    child: Column(
                      children: [
                        DropdownButtonFormField<int>(
                          initialValue: _examMode,
                          items: const [
                            DropdownMenuItem(
                              value: 1,
                              child: Text('Live exam'),
                            ),
                            DropdownMenuItem(
                              value: 2,
                              child: Text('Test mode'),
                            ),
                          ],
                          onChanged: (value) =>
                              setState(() => _examMode = value ?? 2),
                          decoration: const InputDecoration(
                            labelText: 'Exam mode',
                          ),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<int>(
                          initialValue: _accessType,
                          items: const [
                            DropdownMenuItem(value: 1, child: Text('Public')),
                            DropdownMenuItem(
                              value: 2,
                              child: Text('Custom access'),
                            ),
                          ],
                          onChanged: (value) =>
                              setState(() => _accessType = value ?? 1),
                          decoration: const InputDecoration(
                            labelText: 'Access type',
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _maxAttemptsController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Max attempts',
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: _timerMinutesController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Timer minutes',
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _scheduledStartController,
                          decoration: const InputDecoration(
                            labelText: 'Scheduled start',
                            hintText: '2026-05-21T18:30:00Z',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _scheduledEndController,
                          decoration: const InputDecoration(
                            labelText: 'Scheduled end',
                            hintText: '2026-05-21T19:30:00Z',
                          ),
                        ),
                        if (_accessType == 2) ...[
                          const SizedBox(height: 16),
                          Text(
                            'Pending allow-list users',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _availableStudents
                                .take(20)
                                .map(
                                  (item) => FilterChip(
                                    label: Text(item.fullName),
                                    selected: _pendingUserIds.contains(item.id),
                                    onSelected: (selected) {
                                      setState(() {
                                        if (selected) {
                                          _pendingUserIds.add(item.id);
                                        } else {
                                          _pendingUserIds.remove(item.id);
                                        }
                                      });
                                    },
                                  ),
                                )
                                .toList(),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Pending access groups',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _availableGroups
                                .take(20)
                                .map(
                                  (item) => FilterChip(
                                    label: Text(item.name),
                                    selected: _pendingGroupIds.contains(
                                      item.id,
                                    ),
                                    onSelected: (selected) {
                                      setState(() {
                                        if (selected) {
                                          _pendingGroupIds.add(item.id);
                                        } else {
                                          _pendingGroupIds.remove(item.id);
                                        }
                                      });
                                    },
                                  ),
                                )
                                .toList(),
                          ),
                          if (_access != null) ...[
                            const SizedBox(height: 16),
                            if (_access!.accessUsers.isNotEmpty)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Current users',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  ..._access!.accessUsers.map(
                                    (item) => ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(item.userName),
                                      subtitle: Text(
                                        '${item.email} - ${item.statusName} - Attempts ${item.attemptCount}',
                                      ),
                                      trailing: IconButton(
                                        onPressed: () =>
                                            _removeAccessUser(item),
                                        icon: const Icon(
                                          Icons.remove_circle_outline_rounded,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            if (_access!.accessGroups.isNotEmpty)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Current groups',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  ..._access!.accessGroups.map(
                                    (item) => ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(item.groupName),
                                      subtitle: Text(
                                        '${item.membersCount} members',
                                      ),
                                      trailing: IconButton(
                                        onPressed: () =>
                                            _removeAccessGroup(item),
                                        icon: const Icon(
                                          Icons.remove_circle_outline_rounded,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ],
                      ],
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    ErrorMessageCard(message: _error!),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: Text(_saving ? 'Saving...' : 'Save quiz'),
                  ),
                ],
              ),
      ),
    );
  }
}

class _EditableChoice {
  _EditableChoice({
    required String text,
    this.id = 0,
    this.isCorrect = false,
    this.imageUrl = '',
  }) : textController = TextEditingController(text: text);

  final int id;
  final String imageUrl;
  final TextEditingController textController;
  bool isCorrect;

  String get text => textController.text.trim();

  QuestionChoice toQuestionChoice({required int order}) {
    return QuestionChoice(
      id: id,
      choiceText: text,
      imageUrl: imageUrl,
      hasImage: imageUrl.isNotEmpty,
      isCorrect: isCorrect,
      order: order,
    );
  }

  void dispose() {
    textController.dispose();
  }
}

Future<bool?> _confirmAction(
  BuildContext context, {
  required String title,
  required String message,
}) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Confirm'),
        ),
      ],
    ),
  );
}

String questionTypeLabel(int value) {
  return switch (value) {
    1 => 'Multiple choice',
    2 => 'True / False',
    3 => 'Short answer',
    _ => 'Question',
  };
}

String selectionModeLabel(int value) {
  return switch (value) {
    2 => 'Multi-select',
    _ => 'Single-select',
  };
}

String quizModeLabel(int value) {
  return value == 2 ? 'Game' : 'Test';
}

String _errorMessage(Object error, String fallback) {
  if (error is AppException) {
    return error.message;
  }
  return fallback;
}
