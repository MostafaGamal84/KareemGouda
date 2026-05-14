import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function toCamelCaseKey(key: string): string {
  if (!key) return key;
  return key.charAt(0).toLowerCase() + key.slice(1);
}

function normalizeWithAliases(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWithAliases(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, val]) => {
    const nextValue = normalizeWithAliases(val);
    normalized[key] = nextValue;

    const camelKey = toCamelCaseKey(key);
    if (!(camelKey in normalized)) {
      normalized[camelKey] = nextValue;
    }
  });

  return normalized;
}

export const camelCaseInterceptor: HttpInterceptorFn = (req, next) =>
{
  return next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body;
        const response = body && typeof body === 'object'
          ? event.clone({ body: normalizeWithAliases(body) })
          : event;
        return response;
      }

      return event;
    })
  );
};
