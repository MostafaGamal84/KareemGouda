import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/auth_controller.dart';
import '../app/settings_controller.dart';
import '../core/theme/app_theme.dart';
import '../models/domain_models.dart';

class AppShell extends ConsumerWidget {
  const AppShell({
    super.key,
    required this.child,
    required this.currentLocation,
  });

  final Widget child;
  final String currentLocation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider).session!;
    final isPlayer = auth.role == AppRole.player;
    final items = isPlayer ? _playerItems : _hostItems;

    return Scaffold(
      appBar: AppBar(title: Text(_resolveTitle(items, currentLocation))),
      drawer: NavigationDrawer(
        selectedIndex: items.indexWhere(
          (item) => currentLocation.startsWith(item.path),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 54,
                  width: 54,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: AppTheme.wine.withValues(alpha: 0.14),
                  ),
                  child: const Icon(Icons.school_rounded, color: AppTheme.wine),
                ),
                const SizedBox(height: 14),
                Text(
                  auth.fullName.isEmpty ? auth.email : auth.fullName,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 2),
                Text(
                  auth.role.label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          ...items.map(
            (item) => NavigationDrawerDestination(
              icon: Icon(item.icon),
              label: Text(item.label),
            ),
          ),
          const Divider(height: 24),
          ListTile(
            leading: Icon(
              ref.watch(settingsControllerProvider).themeMode == ThemeMode.dark
                  ? Icons.light_mode_rounded
                  : Icons.dark_mode_rounded,
            ),
            title: const Text('Toggle theme'),
            onTap: () async {
              await ref.read(settingsControllerProvider.notifier).toggleTheme();
              if (context.mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.settings_rounded),
            title: const Text('Settings'),
            onTap: () {
              Navigator.of(context).pop();
              context.go('/settings');
            },
          ),
          ListTile(
            leading: const Icon(Icons.logout_rounded),
            title: const Text('Logout'),
            onTap: () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
        ],
        onDestinationSelected: (index) {
          Navigator.of(context).pop();
          context.go(items[index].path);
        },
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return Align(
              alignment: Alignment.topCenter,
              child: Container(
                width: constraints.maxWidth > 1100 ? 1100 : double.infinity,
                padding: const EdgeInsets.all(16),
                child: child,
              ),
            );
          },
        ),
      ),
    );
  }

  String _resolveTitle(List<_ShellItem> items, String location) {
    for (final item in items) {
      if (location.startsWith(item.path)) {
        return item.label;
      }
    }
    return 'GOUDAPREP';
  }
}

class _ShellItem {
  const _ShellItem({
    required this.label,
    required this.path,
    required this.icon,
  });

  final String label;
  final String path;
  final IconData icon;
}

const _playerItems = <_ShellItem>[
  _ShellItem(label: 'Home', path: '/player/home', icon: Icons.home_rounded),
  _ShellItem(
    label: 'Live Sessions',
    path: '/player/live-sessions',
    icon: Icons.podcasts_rounded,
  ),
  _ShellItem(
    label: 'Test Mode',
    path: '/player/tests',
    icon: Icons.edit_note_rounded,
  ),
  _ShellItem(
    label: 'History',
    path: '/player/history',
    icon: Icons.history_rounded,
  ),
];

const _hostItems = <_ShellItem>[
  _ShellItem(label: 'Dashboard', path: '/host/home', icon: Icons.home_rounded),
  _ShellItem(
    label: 'Sessions',
    path: '/host/sessions',
    icon: Icons.live_tv_rounded,
  ),
  _ShellItem(
    label: 'Results',
    path: '/host/results',
    icon: Icons.insights_rounded,
  ),
  _ShellItem(
    label: 'Questions',
    path: '/host/questions',
    icon: Icons.quiz_rounded,
  ),
  _ShellItem(
    label: 'Quizzes',
    path: '/host/quizzes',
    icon: Icons.library_books_rounded,
  ),
  _ShellItem(
    label: 'Users',
    path: '/host/users',
    icon: Icons.manage_accounts_rounded,
  ),
  _ShellItem(label: 'Groups', path: '/host/groups', icon: Icons.groups_rounded),
];
