import type { JSX, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

export interface TemplateValidationIssue {
  path: Array<string | number>;
  message: string;
  code?: string;
}

export interface TemplateValidationGateRenderProps {
  submit: () => void;
  setFieldValue: (path: Array<string | number>, value: unknown) => void;
  errors: TemplateValidationIssue[];
}

export interface TemplateValidationGateProps {
  documentId: string;
  templateId: string;
  validator: unknown;
  value: unknown;
  onChange: (value: unknown) => void;
  onValid: (value: unknown) => void;
  children: (props: TemplateValidationGateRenderProps) => ReactNode;
}

export function TemplateValidationGate(props: TemplateValidationGateProps): JSX.Element {
  const { value, validator, onChange, onValid, children, templateId } = props;
  const [errors, setErrors] = useState<TemplateValidationIssue[]>([]);

  const runValidation = useCallback(
    (input: unknown) => {
      const candidate = validator as {
        safeParse?: (value: unknown) => { success: boolean; data?: unknown; error?: unknown };
        parse?: (value: unknown) => unknown;
      } | null;

      if (!candidate) {
        return { success: true as const, data: input };
      }

      if (typeof candidate.safeParse === 'function') {
        const result = candidate.safeParse(input);
        if (result.success) {
          return { success: true as const, data: result.data ?? input };
        }

        const issues = extractIssues(result.error, templateId);
        setErrors(issues);
        return { success: false as const, issues };
      }

      if (typeof candidate.parse === 'function') {
        try {
          const parsed = candidate.parse(input);
          return { success: true as const, data: parsed ?? input };
        } catch (error) {
          const issues = extractIssues(error, templateId);
          setErrors(issues);
          return { success: false as const, issues };
        }
      }

      return { success: true as const, data: input };
    },
    [templateId, validator]
  );

  const submit = useCallback(() => {
    const result = runValidation(value);
    if (result.success) {
      setErrors([]);
      onValid(result.data ?? value);
    }
  }, [runValidation, value, onValid]);

  const setFieldValue = useCallback(
    (path: Array<string | number>, fieldValue: unknown) => {
      const updated = updateAtPath(value, path, fieldValue);
      onChange(updated);
    },
    [onChange, value]
  );

  const renderProps = useMemo(
    () => ({
      submit,
      setFieldValue,
      errors,
    }),
    [errors, setFieldValue, submit]
  );

  return <>{children(renderProps)}</>;
}

const FIELD_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  architecture: {
    introduction: 'Executive Summary',
  },
};

function extractIssues(error: unknown, templateId: string): TemplateValidationIssue[] {
  if (error && typeof error === 'object' && 'issues' in (error as Record<string, unknown>)) {
    const zodIssues = (error as { issues: Array<{ path: (string | number)[]; message: string; code?: string }> }).issues;
    return zodIssues.map(issue => ({
      path: issue.path,
      message: enrichMessage(issue.message, issue.path, templateId),
      code: issue.code,
    }));
  }

  if (error instanceof Error) {
    return [
      {
        path: [],
        message: enrichMessage(error.message, [], templateId),
      },
    ];
  }

  return [
    {
      path: [],
      message: enrichMessage('Template validation failed', [], templateId),
    },
  ];
}

function updateAtPath(source: unknown, path: Array<string | number>, nextValue: unknown): unknown {
  if (path.length === 0) {
    return nextValue;
  }

  const [head, ...rest] = path;

  if (head === undefined) {
    return nextValue;
  }

  if (typeof head === 'number') {
    const base = Array.isArray(source) ? [...source] : [];
    const current = base[head];
    base[head] = updateAtPath(current, rest, nextValue);
    return base;
  }

  const base = source && typeof source === 'object' && !Array.isArray(source)
    ? { ...(source as Record<string, unknown>) }
    : {};

  const current = base[head];
  base[head] = updateAtPath(current, rest, nextValue);
  return base;
}

function enrichMessage(message: string, path: Array<string | number>, templateId: string): string {
  if (message !== 'Required') {
    return message;
  }

  const overrides = FIELD_LABEL_OVERRIDES[templateId] ?? {};
  const key = path[0];

  if (typeof key === 'string') {
    const friendly = overrides[key] ?? titleize(key);
    return `${friendly} is required`;
  }

  return message;
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
