import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/auth_controller.dart';
import '../../models/domain_models.dart';
import '../../widgets/common_widgets.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: LoadingPane(label: 'Preparing GOUDAPREP Mobile...')),
    );
  }
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _guestJoinController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _guestJoinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1080),
              child: Wrap(
                spacing: 18,
                runSpacing: 18,
                children: [
                  const SizedBox(width: 500, child: BrandPanel()),
                  SizedBox(
                    width: 500,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Sign in',
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Continue to your dashboard, live sessions, and test mode.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 20),
                            TextField(
                              controller: _guestJoinController,
                              decoration: const InputDecoration(
                                labelText: 'Session code',
                                hintText:
                                    'Continue as guest into a public live session',
                              ),
                              textCapitalization: TextCapitalization.characters,
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.tonal(
                                onPressed: () {
                                  final code = _guestJoinController.text.trim();
                                  if (code.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Enter a session code first.',
                                        ),
                                      ),
                                    );
                                    return;
                                  }
                                  context.go('/join/${code.toUpperCase()}');
                                },
                                child: const Text('Continue as guest'),
                              ),
                            ),
                            const SizedBox(height: 18),
                            const Divider(),
                            const SizedBox(height: 18),
                            TextField(
                              controller: _emailController,
                              decoration: const InputDecoration(
                                labelText: 'Email',
                              ),
                              keyboardType: TextInputType.emailAddress,
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _passwordController,
                              decoration: const InputDecoration(
                                labelText: 'Password',
                              ),
                              obscureText: true,
                            ),
                            const SizedBox(height: 18),
                            if (auth.error != null) ...[
                              ErrorMessageCard(message: auth.error!),
                              const SizedBox(height: 12),
                            ],
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: auth.isSubmitting
                                    ? null
                                    : () async {
                                        final ok = await ref
                                            .read(
                                              authControllerProvider.notifier,
                                            )
                                            .login(
                                              email: _emailController.text,
                                              password:
                                                  _passwordController.text,
                                            );
                                        if (!context.mounted || !ok) {
                                          return;
                                        }

                                        final session = ref
                                            .read(authControllerProvider)
                                            .session;
                                        if (session?.status == 0) {
                                          context.go('/pending');
                                        } else if (session?.role ==
                                            AppRole.player) {
                                          context.go('/player/home');
                                        } else {
                                          context.go('/host/home');
                                        }
                                      },
                                child: Text(
                                  auth.isSubmitting ? 'Signing in...' : 'Login',
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: () => context.go('/register'),
                              child: const Text('Create account'),
                            ),
                          ],
                        ),
                      ),
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
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String _role = 'Player';

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create account',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Registration goes into pending review until an administrator approves it.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: _firstNameController,
                        decoration: const InputDecoration(
                          labelText: 'First name',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _lastNameController,
                        decoration: const InputDecoration(
                          labelText: 'Last name',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _emailController,
                        decoration: const InputDecoration(labelText: 'Email'),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _role,
                        items: const [
                          DropdownMenuItem(
                            value: 'Player',
                            child: Text('Player'),
                          ),
                          DropdownMenuItem(value: 'Host', child: Text('Host')),
                        ],
                        onChanged: (value) =>
                            setState(() => _role = value ?? 'Player'),
                        decoration: const InputDecoration(labelText: 'Role'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _passwordController,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 18),
                      if (auth.error != null) ...[
                        ErrorMessageCard(message: auth.error!),
                        const SizedBox(height: 12),
                      ],
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: auth.isSubmitting
                              ? null
                              : () async {
                                  final ok = await ref
                                      .read(authControllerProvider.notifier)
                                      .register(
                                        email: _emailController.text,
                                        password: _passwordController.text,
                                        firstName: _firstNameController.text,
                                        lastName: _lastNameController.text,
                                        role: _role,
                                      );
                                  if (!context.mounted) {
                                    return;
                                  }
                                  if (ok) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Registration sent successfully. Wait for approval.',
                                        ),
                                      ),
                                    );
                                    context.go('/login');
                                  }
                                },
                          child: Text(
                            auth.isSubmitting ? 'Submitting...' : 'Register',
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => context.go('/login'),
                        child: const Text('Back to login'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PendingApprovalScreen extends ConsumerWidget {
  const PendingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: AppSectionCard(
                title: 'Account pending approval',
                subtitle:
                    'Your registration is waiting for an administrator to approve it before full access is enabled.',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (session != null)
                      Text(
                        session.email,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    const SizedBox(height: 12),
                    const Text(
                      'You can close the app and sign in again later. Once approved, the mobile app will take you straight to your dashboard.',
                    ),
                    const SizedBox(height: 18),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        FilledButton(
                          onPressed: () => context.go('/login'),
                          child: const Text('Back to login'),
                        ),
                        FilledButton.tonal(
                          onPressed: () async {
                            await ref
                                .read(authControllerProvider.notifier)
                                .logout();
                            if (context.mounted) {
                              context.go('/login');
                            }
                          },
                          child: const Text('Logout'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
