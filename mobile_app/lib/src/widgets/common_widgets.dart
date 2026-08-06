import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:intl/intl.dart';

import '../core/theme/app_theme.dart';

class BrandPanel extends StatelessWidget {
  const BrandPanel({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: EdgeInsets.all(compact ? 18 : 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset(
                'assets/logo.jpeg',
                height: compact ? 88 : 120,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'GOUDAPREP',
              style: theme.textTheme.labelLarge?.copyWith(
                letterSpacing: 2,
                color: AppTheme.wine,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              compact
                  ? 'Smart prep in your pocket.'
                  : 'Smart prep for every test, now with a dedicated mobile workflow.',
              style: theme.textTheme.headlineSmall,
            ),
            const SizedBox(height: 10),
            Text(
              'Live sessions, test mode, history, and host controls connected directly to the current backend.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AppSectionCard extends StatelessWidget {
  const AppSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
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
                      Text(title, style: theme.textTheme.titleLarge),
                      if (subtitle != null) ...[
                        const SizedBox(height: 6),
                        Text(subtitle!, style: theme.textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
                if (actions.isNotEmpty) ...actions,
              ],
            ),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class ErrorMessageCard extends StatelessWidget {
  const ErrorMessageCard({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(
        context,
      ).colorScheme.errorContainer.withValues(alpha: 0.45),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: onRetry,
                child: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyMessageCard extends StatelessWidget {
  const EmptyMessageCard({
    super.key,
    required this.title,
    required this.message,
    this.action,
  });

  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (action != null) ...[const SizedBox(height: 14), action!],
          ],
        ),
      ),
    );
  }
}

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.accent = false,
  });

  final String label;
  final String value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: accent
            ? AppTheme.wine.withValues(alpha: 0.12)
            : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.25),
        border: Border.all(
          color: accent
              ? AppTheme.wine.withValues(alpha: 0.25)
              : theme.colorScheme.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              letterSpacing: 1,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(
              color: accent ? AppTheme.wine : null,
            ),
          ),
        ],
      ),
    );
  }
}

class LoadingPane extends StatelessWidget {
  const LoadingPane({super.key, this.label = 'Loading...'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 12),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class HtmlBlock extends StatelessWidget {
  const HtmlBlock(this.html, {super.key});

  final String html;

  @override
  Widget build(BuildContext context) {
    final content = html.trim().isEmpty ? '<p>-</p>' : html;
    return Html(
      data: content,
      style: {
        '*': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
          color: Theme.of(context).colorScheme.onSurface,
          lineHeight: const LineHeight(1.45),
        ),
        'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero),
        'p': Style(margin: Margins.only(bottom: 10)),
      },
    );
  }
}

String formatDateTime(String? value) {
  if (value == null || value.trim().isEmpty) {
    return '-';
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    return value;
  }
  return DateFormat('y/MM/dd - hh:mm a').format(parsed.toLocal());
}

String statusLabel(int value) {
  return switch (value) {
    1 => 'Draft',
    2 => 'Waiting',
    3 => 'Live',
    4 => 'Paused',
    5 => 'Ended',
    _ => 'Unknown',
  };
}

String joinStatusLabel(int value) {
  return switch (value) {
    1 => 'Pending',
    2 => 'Approved',
    3 => 'Rejected',
    4 => 'Left',
    _ => 'Pending',
  };
}

String examModeLabel(int value) {
  return value == 1 ? 'Live' : 'Test';
}

String accessTypeLabel(int value) {
  return value == 1 ? 'Public' : 'Private';
}
