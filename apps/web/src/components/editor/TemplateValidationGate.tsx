import type { JSX, ReactNode } from 'react';
import { useMemo } from 'react';

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
  useMemo(() => props, [props]);
  throw new Error('TemplateValidationGate component not implemented');
}
