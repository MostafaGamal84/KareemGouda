import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/auth_controller.dart';
import '../../app/settings_controller.dart';
import '../../core/network/app_repository.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class PlayerHomeScreen extends StatelessWidget {
  const PlayerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const BrandPanel(compact: true),
        const SizedBox(height: 16),
        AppSectionCard(
          title: 'Quick actions',
          subtitle: 'Jump into the flows players use most.',
          child: GridView.count(
            crossAxisCount: MediaQuery.sizeOf(context).width > 720 ? 2 : 1,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.8,
            children: [
              _QuickActionTile(
                icon: Icons.qr_code_rounded,
                title: 'Join live session',
                subtitle: 'Enter a code and join public or approved rooms.',
                onTap: () => context.go('/join'),
              ),
              _QuickActionTile(
                icon: Icons.podcasts_rounded,
                title: 'Browse live sessions',
                subtitle: 'See rooms available to your account right now.',
                onTap: () => context.go('/player/live-sessions'),
              ),
              _QuickActionTile(
                icon: Icons.edit_note_rounded,
                title: 'Test mode',
                subtitle: 'Practice published tests with instant review.',
                onTap: () => context.go('/player/tests'),
              ),
              _QuickActionTile(
                icon: Icons.history_rounded,
                title: 'My history',
                subtitle: 'Review live performance and test attempts.',
                onTap: () => context.go('/player/history'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class HostHomeScreen extends ConsumerWidget {
  const HostHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder<List<Object?>>(
      future: Future.wait<Object?>([
        ref.read(appRepositoryProvider).getSessions(),
        ref.read(appRepositoryProvider).getQuizzes(pageSize: 50),
        ref.read(appRepositoryProvider).getQuestions(pageSize: 50),
        ref
            .read(appRepositoryProvider)
            .getStudents(pageSize: 50, role: 'Player'),
      ]),
      builder: (context, snapshot) {
        final isLoading =
            !snapshot.hasData &&
            snapshot.connectionState != ConnectionState.done;
        final hasError = snapshot.hasError;
        final data = snapshot.data;
        final sessions = data != null
            ? data[0] as List<GameSessionItem>
            : const <GameSessionItem>[];
        final quizzes = data != null
            ? data[1] as List<QuizItem>
            : const <QuizItem>[];
        final questions = data != null
            ? data[2] as List<QuestionItem>
            : const <QuestionItem>[];
        final players = data != null
            ? (data[3] as PagedResponse<StudentUser>).items
            : const <StudentUser>[];

        return ListView(
          children: [
            const BrandPanel(compact: true),
            const SizedBox(height: 16),
            if (isLoading)
              const LoadingPane(label: 'Loading host dashboard...')
            else if (hasError)
              ErrorMessageCard(message: '${snapshot.error}')
            else ...[
              AppSectionCard(
                title: 'Operational overview',
                subtitle:
                    'A quick read of the current mobile-control surfaces.',
                child: GridView.count(
                  crossAxisCount: MediaQuery.sizeOf(context).width > 900
                      ? 4
                      : 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    StatTile(
                      label: 'Sessions',
                      value: '${sessions.length}',
                      accent: true,
                    ),
                    StatTile(label: 'Quizzes', value: '${quizzes.length}'),
                    StatTile(label: 'Questions', value: '${questions.length}'),
                    StatTile(label: 'Players', value: '${players.length}'),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              AppSectionCard(
                title: 'Host shortcuts',
                subtitle:
                    'The mobile app emphasizes operations, control, and review.',
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _QuickActionTile(
                      icon: Icons.live_tv_rounded,
                      title: 'Sessions',
                      subtitle: 'Create and control live delivery.',
                      width: 320,
                      onTap: () => context.go('/host/sessions'),
                    ),
                    _QuickActionTile(
                      icon: Icons.insights_rounded,
                      title: 'Results',
                      subtitle: 'Inspect participants and question analytics.',
                      width: 320,
                      onTap: () => context.go('/host/results'),
                    ),
                    _QuickActionTile(
                      icon: Icons.quiz_rounded,
                      title: 'Question bank',
                      subtitle:
                          'Create and update questions for mobile workflows.',
                      width: 320,
                      onTap: () => context.go('/host/questions'),
                    ),
                    _QuickActionTile(
                      icon: Icons.library_books_rounded,
                      title: 'Tests',
                      subtitle:
                          'Build and configure quizzes with access rules.',
                      width: 320,
                      onTap: () => context.go('/host/quizzes'),
                    ),
                    _QuickActionTile(
                      icon: Icons.manage_accounts_rounded,
                      title: 'Users',
                      subtitle: 'Approve registrations and tune permissions.',
                      width: 320,
                      onTap: () => context.go('/host/users'),
                    ),
                    _QuickActionTile(
                      icon: Icons.groups_rounded,
                      title: 'Groups',
                      subtitle: 'Maintain student groups and memberships.',
                      width: 320,
                      onTap: () => context.go('/host/groups'),
                    ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _apiController;

  @override
  void initState() {
    super.initState();
    _apiController = TextEditingController(
      text: ref.read(settingsControllerProvider).apiBaseUrl,
    );
  }

  @override
  void dispose() {
    _apiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsControllerProvider);
    final auth = ref.watch(authControllerProvider).session;

    return ListView(
      children: [
        AppSectionCard(
          title: 'Connection',
          subtitle:
              'Use the existing backend endpoints without modifying the API.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _apiController,
                decoration: const InputDecoration(
                  labelText: 'API base URL',
                  hintText: 'https://localhost:5001/api',
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  FilledButton(
                    onPressed: () async {
                      await ref
                          .read(settingsControllerProvider.notifier)
                          .saveApiBaseUrl(_apiController.text);
                      if (!context.mounted) {
                        return;
                      }
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('API base URL updated.')),
                      );
                    },
                    child: const Text('Save endpoint'),
                  ),
                  FilledButton.tonal(
                    onPressed: () async {
                      await ref
                          .read(settingsControllerProvider.notifier)
                          .toggleTheme();
                    },
                    child: Text(
                      settings.themeMode == ThemeMode.dark
                          ? 'Switch to light mode'
                          : 'Switch to dark mode',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppSectionCard(
          title: 'Current session',
          subtitle:
              'The mobile app stores login state locally and uses the same JWT-backed APIs as the web app.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Email: ${auth?.email ?? '-'}'),
              const SizedBox(height: 6),
              Text('Role: ${auth?.role.label ?? '-'}'),
              const SizedBox(height: 6),
              Text('Status: ${auth?.status ?? '-'}'),
            ],
          ),
        ),
      ],
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.width,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: Theme.of(context).colorScheme.outlineVariant,
            ),
            color: Theme.of(
              context,
            ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.22),
          ),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: Theme.of(
                  context,
                ).colorScheme.secondary.withValues(alpha: 0.12),
                foregroundColor: Theme.of(context).colorScheme.secondary,
                child: Icon(icon),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}
