import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const themeStorageKey = 'quiz-live-theme';
const storedTheme = typeof window !== 'undefined' ? window.localStorage.getItem(themeStorageKey) : null;
const initialTheme = storedTheme === 'light' || storedTheme === 'dark'
  ? storedTheme
  : (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.style.colorScheme = initialTheme;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
