import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/auth_controller.dart';
import '../../core/network/app_repository.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class UsersManagementScreen extends ConsumerStatefulWidget {
  const UsersManagementScreen({super.key});

  @override
  ConsumerState<UsersManagementScreen> createState() =>
      _UsersManagementScreenState();
}

class _UsersManagementScreenState extends ConsumerState<UsersManagementScreen> {
  bool _loading = true;
  bool _savingPermissions = false;
  String? _error;
  List<StudentUser> _users = const [];
  List<Map<String, dynamic>> _permissionUsers = const [];
  int _statusFilter = -1;

  bool get _canManagePermissions =>
      ref.read(authControllerProvider).session?.role == AppRole.admin;

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
      final students = await repo.getStudents(
        pageSize: 100,
        status: _statusFilter >= 0 ? _statusFilter : null,
      );
      List<Map<String, dynamic>> permissionUsers = const [];
      if (_canManagePermissions) {
        permissionUsers = await repo.getUsersWithPermissions();
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _users = students.items;
        _permissionUsers = permissionUsers;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _screenError(error, 'Failed to load users.'));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _approveUser(StudentUser user, int status) async {
    try {
      await ref.read(appRepositoryProvider).approveStudent(user.id, status);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(status == 1 ? 'User approved.' : 'User rejected.'),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _screenError(error, 'Unable to update user status.'),
      );
    }
  }

  Future<void> _bulkAction(int status) async {
    final targetIds = _users
        .where((item) => item.status == 0)
        .map((item) => item.id)
        .toList();
    if (targetIds.isEmpty) {
      return;
    }
    try {
      if (status == 1) {
        await ref.read(appRepositoryProvider).bulkApproveStudents(targetIds);
      } else {
        await ref.read(appRepositoryProvider).bulkRejectStudents(targetIds);
      }
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            status == 1 ? 'Pending users approved.' : 'Pending users rejected.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _screenError(error, 'Unable to update pending users.'),
      );
    }
  }

  Future<void> _editPermissions(Map<String, dynamic> userMap) async {
    final userId = readInt(userMap, 'id');
    if (userId <= 0) {
      return;
    }
    final currentPermissions = _normalizePermissions(
      userMap['permissions'] ?? userMap['Permissions'],
    );
    final draft = Map<String, bool>.from(currentPermissions);

    final shouldSave = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
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
                    readString(
                      userMap,
                      'userName',
                      fallback: readString(userMap, 'email'),
                    ),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  ...permissionKeys.map(
                    (key) => SwitchListTile(
                      value: draft[key] ?? false,
                      contentPadding: EdgeInsets.zero,
                      title: Text(permissionLabel(key)),
                      onChanged: (value) {
                        setSheetState(() => draft[key] = value);
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: const Text('Save permissions'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (shouldSave != true) {
      return;
    }

    setState(() => _savingPermissions = true);
    try {
      await ref.read(appRepositoryProvider).setPermissions(userId, draft);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Permissions updated.')));
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(
        () => _error = _screenError(error, 'Unable to save permissions.'),
      );
    } finally {
      if (mounted) {
        setState(() => _savingPermissions = false);
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
            title: 'Users and approvals',
            subtitle:
                'Review newly registered accounts and keep classroom access under control.',
            child: Column(
              children: [
                DropdownButtonFormField<int>(
                  initialValue: _statusFilter,
                  items: const [
                    DropdownMenuItem(value: -1, child: Text('All statuses')),
                    DropdownMenuItem(value: 0, child: Text('Pending')),
                    DropdownMenuItem(value: 1, child: Text('Active')),
                    DropdownMenuItem(value: 2, child: Text('Rejected')),
                  ],
                  onChanged: (value) =>
                      setState(() => _statusFilter = value ?? -1),
                  decoration: const InputDecoration(
                    labelText: 'Filter by status',
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.tonal(
                      onPressed: _load,
                      child: const Text('Refresh'),
                    ),
                    FilledButton.tonal(
                      onPressed: _users.any((item) => item.status == 0)
                          ? () => _bulkAction(1)
                          : null,
                      child: const Text('Approve pending'),
                    ),
                    FilledButton.tonal(
                      onPressed: _users.any((item) => item.status == 0)
                          ? () => _bulkAction(2)
                          : null,
                      child: const Text('Reject pending'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const LoadingPane(label: 'Loading users...')
          else if (_users.isEmpty)
            const EmptyMessageCard(
              title: 'No users found',
              message:
                  'Registrations will appear here once accounts are created.',
            )
          else
            AppSectionCard(
              title: 'Accounts',
              child: Column(
                children: _users
                    .map(
                      (user) => Padding(
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
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            user.fullName,
                                            style: Theme.of(
                                              context,
                                            ).textTheme.titleMedium,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(user.email),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${user.role} - ${user.statusName} - ${formatDateTime(user.registerTime)}',
                                            style: Theme.of(
                                              context,
                                            ).textTheme.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Chip(label: Text(user.statusName)),
                                  ],
                                ),
                                if (user.groups.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: user.groups
                                        .map(
                                          (group) => Chip(label: Text(group)),
                                        )
                                        .toList(),
                                  ),
                                ],
                                if (user.status == 0) ...[
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 10,
                                    runSpacing: 10,
                                    children: [
                                      FilledButton(
                                        onPressed: () => _approveUser(user, 1),
                                        child: const Text('Approve'),
                                      ),
                                      FilledButton.tonal(
                                        onPressed: () => _approveUser(user, 2),
                                        child: const Text('Reject'),
                                      ),
                                    ],
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
            ),
          if (_canManagePermissions) ...[
            const SizedBox(height: 16),
            AppSectionCard(
              title: 'Role permissions',
              subtitle: 'Admin-only controls for action-level capabilities.',
              child: _savingPermissions
                  ? const LoadingPane(label: 'Saving permissions...')
                  : _permissionUsers.isEmpty
                  ? const EmptyMessageCard(
                      title: 'No permission users loaded',
                      message: 'Refresh after signing in as an admin account.',
                    )
                  : Column(
                      children: _permissionUsers
                          .map(
                            (item) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(
                                readString(
                                  item,
                                  'userName',
                                  fallback: readString(item, 'email'),
                                ),
                              ),
                              subtitle: Text(
                                '${readString(item, 'role')} - ${readString(item, 'email')}',
                              ),
                              trailing: FilledButton.tonal(
                                onPressed: () => _editPermissions(item),
                                child: const Text('Edit'),
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
      ),
    );
  }
}

class StudentGroupsScreen extends ConsumerStatefulWidget {
  const StudentGroupsScreen({super.key});

  @override
  ConsumerState<StudentGroupsScreen> createState() =>
      _StudentGroupsScreenState();
}

class _StudentGroupsScreenState extends ConsumerState<StudentGroupsScreen> {
  bool _loading = true;
  String? _error;
  List<StudentGroup> _groups = const [];

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
      final groups = await ref
          .read(appRepositoryProvider)
          .getGroups(pageSize: 100);
      if (!mounted) {
        return;
      }
      setState(() => _groups = groups.items);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _screenError(error, 'Failed to load groups.'));
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _openGroupEditor({StudentGroup? group}) async {
    final nameController = TextEditingController(text: group?.name ?? '');
    final descriptionController = TextEditingController(
      text: group?.description ?? '',
    );

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 8,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Group name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(labelText: 'Description'),
                minLines: 3,
                maxLines: 5,
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    final name = nameController.text.trim();
                    if (name.isEmpty) {
                      return;
                    }
                    try {
                      if (group == null) {
                        await ref
                            .read(appRepositoryProvider)
                            .createGroup(
                              name: name,
                              description: descriptionController.text,
                            );
                      } else {
                        await ref
                            .read(appRepositoryProvider)
                            .updateGroup(
                              groupId: group.id,
                              name: name,
                              description: descriptionController.text,
                            );
                      }
                      if (context.mounted) {
                        Navigator.of(context).pop(true);
                      }
                    } catch (_) {
                      if (context.mounted) {
                        Navigator.of(context).pop(false);
                      }
                    }
                  },
                  child: Text(group == null ? 'Create group' : 'Save group'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    nameController.dispose();
    descriptionController.dispose();

    if (saved == true) {
      await _load();
    }
  }

  Future<void> _deleteGroup(StudentGroup group) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete group?'),
        content: Text('This will remove "${group.name}" and its assignments.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      await ref.read(appRepositoryProvider).deleteGroup(group.id);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Group deleted.')));
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = _screenError(error, 'Unable to delete group.'));
    }
  }

  Future<void> _openMembers(StudentGroup group) async {
    final details = await ref
        .read(appRepositoryProvider)
        .getGroupById(group.id);
    final available = await ref
        .read(appRepositoryProvider)
        .getStudents(pageSize: 100, status: 1, role: 'Player');
    if (!mounted) {
      return;
    }

    final pending = <int>{};
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
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
                    group.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (group.description.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(group.description),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Current members',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (details.members.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text('No members yet.'),
                    )
                  else
                    ...details.members.map(
                      (member) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(member.fullName),
                        subtitle: Text(
                          '${member.email} - ${member.statusName}',
                        ),
                        trailing: IconButton(
                          onPressed: () async {
                            try {
                              await ref
                                  .read(appRepositoryProvider)
                                  .removeMemberFromGroup(group.id, member.id);
                              if (!mounted) {
                                return;
                              }
                              Navigator.of(this.context).pop();
                              await _openMembers(group);
                            } catch (error) {
                              if (!mounted) {
                                return;
                              }
                              setState(
                                () => _error = _screenError(
                                  error,
                                  'Unable to remove member.',
                                ),
                              );
                            }
                          },
                          icon: const Icon(Icons.remove_circle_outline_rounded),
                        ),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text(
                    'Add active players',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: available.items
                        .where(
                          (item) => !details.members.any(
                            (member) => member.userId == item.id,
                          ),
                        )
                        .take(30)
                        .map(
                          (item) => FilterChip(
                            label: Text(item.fullName),
                            selected: pending.contains(item.id),
                            onSelected: (selected) {
                              setSheetState(() {
                                if (selected) {
                                  pending.add(item.id);
                                } else {
                                  pending.remove(item.id);
                                }
                              });
                            },
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: pending.isEmpty
                          ? null
                          : () async {
                              try {
                                await ref
                                    .read(appRepositoryProvider)
                                    .addMembersToGroup(
                                      group.id,
                                      pending.toList(),
                                    );
                                if (!mounted) {
                                  return;
                                }
                                Navigator.of(this.context).pop();
                                await _load();
                              } catch (error) {
                                if (!mounted) {
                                  return;
                                }
                                setState(
                                  () => _error = _screenError(
                                    error,
                                    'Unable to add members.',
                                  ),
                                );
                              }
                            },
                      child: const Text('Add selected members'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          AppSectionCard(
            title: 'Student groups',
            subtitle:
                'Organize students into reusable cohorts for quiz access and classroom management.',
            actions: [
              FilledButton.icon(
                onPressed: () => _openGroupEditor(),
                icon: const Icon(Icons.add_rounded),
                label: const Text('New'),
              ),
            ],
            child: _loading
                ? const LoadingPane(label: 'Loading groups...')
                : _groups.isEmpty
                ? const EmptyMessageCard(
                    title: 'No groups yet',
                    message: 'Create a cohort and start assigning students.',
                  )
                : Column(
                    children: _groups
                        .map(
                          (group) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                group.name,
                                                style: Theme.of(
                                                  context,
                                                ).textTheme.titleMedium,
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                group.description.isEmpty
                                                    ? 'No description'
                                                    : group.description,
                                              ),
                                            ],
                                          ),
                                        ),
                                        PopupMenuButton<String>(
                                          onSelected: (value) {
                                            switch (value) {
                                              case 'edit':
                                                _openGroupEditor(group: group);
                                                break;
                                              case 'delete':
                                                _deleteGroup(group);
                                                break;
                                              case 'members':
                                                _openMembers(group);
                                                break;
                                            }
                                          },
                                          itemBuilder: (context) => const [
                                            PopupMenuItem(
                                              value: 'members',
                                              child: Text('Manage members'),
                                            ),
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
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        Chip(
                                          label: Text(
                                            '${group.membersCount} members',
                                          ),
                                        ),
                                        Chip(
                                          label: Text(
                                            '${group.activeMembersCount} active',
                                          ),
                                        ),
                                        Chip(
                                          label: Text(
                                            '${group.pendingMembersCount} pending',
                                          ),
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
          if (_error != null) ...[
            const SizedBox(height: 16),
            ErrorMessageCard(message: _error!),
          ],
        ],
      ),
    );
  }
}

const permissionKeys = <String>[
  'AddQuestions',
  'EditQuestions',
  'DeleteQuestions',
  'AddTests',
  'EditTests',
  'DeleteTests',
  'ViewStudentResults',
  'ApproveRejectUsers',
  'AddRemoveStudentsToGroups',
  'ManageLiveClasses',
];

Map<String, bool> _normalizePermissions(Object? raw) {
  if (raw is Map<String, dynamic>) {
    return raw.map(
      (key, value) =>
          MapEntry(_normalizePermissionKey(key), readBoolValue(value)),
    );
  }
  if (raw is Map) {
    return raw.map(
      (key, value) =>
          MapEntry(_normalizePermissionKey('$key'), readBoolValue(value)),
    );
  }
  return {for (final key in permissionKeys) key: false};
}

String _normalizePermissionKey(String key) {
  switch (key) {
    case '1':
      return 'AddQuestions';
    case '2':
      return 'EditQuestions';
    case '4':
      return 'DeleteQuestions';
    case '8':
      return 'AddTests';
    case '16':
      return 'EditTests';
    case '32':
      return 'DeleteTests';
    case '64':
      return 'ViewStudentResults';
    case '128':
      return 'ApproveRejectUsers';
    case '256':
      return 'AddRemoveStudentsToGroups';
    case '512':
      return 'ManageLiveClasses';
    default:
      return key;
  }
}

String permissionLabel(String key) {
  return switch (key) {
    'AddQuestions' => 'Add questions',
    'EditQuestions' => 'Edit questions',
    'DeleteQuestions' => 'Delete questions',
    'AddTests' => 'Add tests',
    'EditTests' => 'Edit tests',
    'DeleteTests' => 'Delete tests',
    'ViewStudentResults' => 'View student results',
    'ApproveRejectUsers' => 'Approve / reject users',
    'AddRemoveStudentsToGroups' => 'Manage group membership',
    'ManageLiveClasses' => 'Manage live classes',
    _ => key,
  };
}

String _screenError(Object error, String fallback) {
  if (error is AppException) {
    return error.message;
  }
  return fallback;
}
