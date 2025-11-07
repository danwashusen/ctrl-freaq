import { create } from 'zustand';

import { createTemplateValidator } from '../lib/template-validator';

import type ApiClient from '../lib/api';
import type { ApiError, PrimaryDocumentSnapshotResponse } from '../lib/api';
import { logger } from '../lib/logger';

interface TemplateSectionOutline {
  id: string;
  title?: string;
  orderIndex?: number;
  required?: boolean;
  type?: string;
  guidance?: string | null;
  fields?: unknown[];
  children?: TemplateSectionOutline[];
}

type TemplateVersionLifecycleStatus = 'draft' | 'active' | 'deprecated';

interface TemplateVersionSummaryLite {
  templateId: string;
  version: string;
  schemaHash: string;
  status: TemplateVersionLifecycleStatus;
}

interface DocumentTemplateBindingLite {
  templateId: string;
  version: string;
  schemaHash: string;
}

type TemplateProvisioningState = 'idle' | 'pending';

type TemplateUpgradeDecision =
  | {
      action: 'noop';
      reason: 'up_to_date' | 'no_active_version';
      currentVersion: TemplateVersionSummaryLite;
    }
  | {
      action: 'upgrade';
      reason: 'out_of_date' | 'schema_mismatch';
      currentVersion: TemplateVersionSummaryLite;
      targetVersion: TemplateVersionSummaryLite;
    }
  | {
      action: 'blocked';
      reason: 'removed_version';
      requestedVersion: DocumentTemplateBindingLite;
    };

interface DocumentMigrationSummary {
  id: string;
  documentId: string;
  fromVersion: string;
  toVersion: string;
  status: 'pending' | 'succeeded' | 'failed';
  validationErrors?: unknown;
  initiatedBy: string;
  initiatedAt: string;
  completedAt?: string | null;
}

interface DocumentApiResponse {
  document: {
    id: string;
    projectId: string;
    title: string;
    content: unknown;
    templateId: string;
    templateVersion: string;
    templateSchemaHash: string;
  };
  migration: DocumentMigrationSummary | null;
  templateDecision: TemplateUpgradeDecision;
}

interface TemplateSummaryResponse {
  template: {
    id: string;
    name: string;
    description?: string | null;
    documentType: string;
    status: string;
    activeVersion: string | null;
    activeVersionMetadata?: {
      version: string;
      schemaHash: string;
      status: string;
      changelog: string | null;
      sections?: TemplateSectionOutline[];
    } | null;
    createdAt: string;
    updatedAt: string;
  };
}

interface TemplateVersionResponse {
  version: {
    templateId: string;
    version: string;
    schemaHash: string;
    schema: unknown;
    sections?: TemplateSectionOutline[];
  };
}

interface LoadDocumentOptions {
  apiClient: Pick<
    ApiClient,
    'getPrimaryDocument' | 'getDocument' | 'getTemplate' | 'getTemplateVersion'
  >;
  projectId: string;
}

type TemplateStoreStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'upgrade_failed' | 'error';

interface TemplateUpgradeIssue {
  path: Array<string | number>;
  message: string;
  code?: string;
}

interface TemplateUpgradeFailureState {
  message: string;
  issues: TemplateUpgradeIssue[];
  requestId?: string;
}

interface TemplateStoreState {
  status: TemplateStoreStatus;
  document: DocumentApiResponse['document'] | null;
  template: TemplateSummaryResponse['template'] | null;
  migration: DocumentMigrationSummary | null;
  validator: ReturnType<typeof createTemplateValidator> | null;
  sections: TemplateSectionOutline[];
  removedVersion: { templateId: string; version: string } | null;
  error?: string;
  formValue: Record<string, unknown> | null;
  decision: TemplateUpgradeDecision | null;
  errorCode: string | null;
  upgradeFailure: TemplateUpgradeFailureState | null;
  provisioningState: TemplateProvisioningState;
  loadDocument: (options: LoadDocumentOptions) => Promise<PrimaryDocumentSnapshotResponse | null>;
  reset: () => void;
  setFormValue: (value: Record<string, unknown>) => void;
  setProvisioningState: (state: TemplateProvisioningState) => void;
}

const initialState: Omit<
  TemplateStoreState,
  'loadDocument' | 'reset' | 'setFormValue' | 'setProvisioningState'
> = {
  status: 'idle',
  document: null,
  template: null,
  migration: null,
  validator: null,
  sections: [],
  removedVersion: null,
  error: undefined,
  formValue: null,
  decision: null,
  errorCode: null,
  upgradeFailure: null,
  provisioningState: 'idle',
};

export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  ...initialState,
  async loadDocument({ apiClient, projectId }: LoadDocumentOptions) {
    set({
      status: 'loading',
      error: undefined,
      errorCode: null,
      upgradeFailure: null,
      removedVersion: null,
    });

    let resolvedDocumentId: string | null = null;

    try {
      const snapshot = (await apiClient.getPrimaryDocument(
        projectId
      )) as PrimaryDocumentSnapshotResponse;

      if (!snapshot.document) {
        const isArchived = snapshot.status === 'archived';
        set({
          status: isArchived ? 'blocked' : 'idle',
          document: null,
          template: null,
          migration: null,
          validator: null,
          sections: [],
          removedVersion: null,
          formValue: null,
          decision: null,
          error: isArchived ? 'Primary document has been archived.' : undefined,
          errorCode: isArchived ? 'DOCUMENT_ARCHIVED' : null,
          upgradeFailure: null,
        });

        logger.clearTemplateContext();
        return snapshot;
      }

      resolvedDocumentId = snapshot.document.documentId;

      const response = (await apiClient.getDocument(resolvedDocumentId)) as DocumentApiResponse;
      const templateId = response.document.templateId;
      const decision = response.templateDecision as TemplateUpgradeDecision;
      const migration = (response.migration ?? null) as DocumentMigrationSummary | null;
      let templateSummary: TemplateSummaryResponse['template'] | null = null;
      let sections: TemplateSectionOutline[] = [];
      let validator: TemplateStoreState['validator'] = null;

      try {
        const summary = (await apiClient.getTemplate(templateId)) as TemplateSummaryResponse;
        templateSummary = summary.template;
        const summarySections = summary.template.activeVersionMetadata?.sections ?? [];
        if (summarySections.length > 0) {
          sections = summarySections;
        }
      } catch {
        templateSummary = null;
      }

      if (decision.action !== 'blocked') {
        try {
          const version = (await apiClient.getTemplateVersion(
            templateId,
            response.document.templateVersion
          )) as TemplateVersionResponse;
          sections = version.version.sections ?? sections;
          validator = createTemplateValidator({
            templateId,
            version: version.version.version,
            schemaJson: version.version.schema,
          });
        } catch (versionError) {
          logger.warn('template.store.validator_failed', {
            templateId,
            documentId: response.document.id,
            error:
              versionError instanceof Error
                ? versionError.message
                : String(versionError ?? 'unknown'),
          });
          validator = null;
        }
      }

      const clonedContent =
        typeof structuredClone === 'function'
          ? structuredClone(response.document.content)
          : JSON.parse(JSON.stringify(response.document.content ?? {}));
      const formValue =
        clonedContent && typeof clonedContent === 'object' && !Array.isArray(clonedContent)
          ? (clonedContent as Record<string, unknown>)
          : {};

      if (decision.action === 'blocked') {
        set({
          status: 'blocked',
          document: response.document,
          template: templateSummary,
          migration,
          validator: null,
          sections,
          removedVersion: {
            templateId: decision.requestedVersion.templateId,
            version: decision.requestedVersion.version,
          },
          formValue,
          decision,
          error: undefined,
          errorCode: 'TEMPLATE_VERSION_REMOVED',
          upgradeFailure: null,
        });
        logger.setTemplateContext({
          templateId: decision.requestedVersion.templateId,
          templateVersion: decision.requestedVersion.version,
          templateSchemaHash: decision.requestedVersion.schemaHash,
        });
        return snapshot;
      }

      set({
        status: 'ready',
        document: response.document,
        template: templateSummary,
        migration,
        validator,
        sections,
        removedVersion: null,
        formValue,
        decision,
        error: undefined,
        errorCode: null,
        upgradeFailure: null,
      });

      logger.setTemplateContext({
        templateId,
        templateVersion: response.document.templateVersion,
        templateSchemaHash: response.document.templateSchemaHash,
      });
      return snapshot;
    } catch (error) {
      if (isApiError(error)) {
        if (error.status === 409) {
          const body = (error.body ?? {}) as Record<string, unknown>;
          const templateId = typeof body.templateId === 'string' ? body.templateId : null;
          const missingVersion =
            typeof body.missingVersion === 'string' ? body.missingVersion : null;
          const message =
            (typeof body.message === 'string' && body.message.length > 0
              ? body.message
              : error.message) ?? 'Template version is no longer available.';

          set({
            status: 'blocked',
            document: null,
            template: null,
            migration: null,
            validator: null,
            sections: [],
            removedVersion:
              templateId && missingVersion ? { templateId, version: missingVersion } : null,
            formValue: null,
            decision: null,
            error: message,
            errorCode: typeof error.code === 'string' ? error.code : 'TEMPLATE_VERSION_REMOVED',
            upgradeFailure: null,
          });

          logger.warn('template.store.version_removed', {
            documentId: resolvedDocumentId ?? 'unknown',
            templateId: templateId ?? 'unknown',
            missingVersion: missingVersion ?? 'unknown',
            requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
          });
          return null;
        }

        if (error.status === 422) {
          const body = (error.body ?? {}) as Record<string, unknown>;
          const message =
            (typeof body.message === 'string' && body.message.length > 0
              ? body.message
              : error.message) ?? 'Template auto-upgrade failed.';
          const issues = normalizeValidationIssues(
            error.details ??
              (body as { details?: unknown }).details ??
              (body as { issues?: unknown }).issues
          );

          set({
            status: 'upgrade_failed',
            document: null,
            template: null,
            migration: null,
            validator: null,
            sections: [],
            removedVersion: null,
            formValue: null,
            decision: null,
            error: message,
            errorCode:
              typeof body.error === 'string' && body.error.length > 0
                ? body.error
                : typeof error.code === 'string'
                  ? error.code
                  : 'TEMPLATE_VALIDATION_FAILED',
            upgradeFailure: {
              message,
              issues,
              requestId:
                typeof (body as { requestId?: unknown }).requestId === 'string'
                  ? (body as { requestId?: string }).requestId
                  : undefined,
            },
          });

          logger.warn('template.store.upgrade_failed', {
            documentId: resolvedDocumentId ?? 'unknown',
            issues: issues.length,
            requestId:
              typeof (body as { requestId?: unknown }).requestId === 'string'
                ? (body as { requestId?: string }).requestId
                : undefined,
          });
          return null;
        }

        if (error.status === 404) {
          const message =
            error instanceof Error && error.message.length > 0
              ? error.message
              : 'Primary document could not be found.';

          set({
            status: 'error',
            document: null,
            template: null,
            migration: null,
            validator: null,
            sections: [],
            removedVersion: null,
            formValue: null,
            decision: null,
            error: message,
            errorCode: typeof error.code === 'string' ? error.code : null,
            upgradeFailure: null,
          });

          logger.warn('template.store.document_not_found', {
            documentId: resolvedDocumentId ?? 'unknown',
            status: error.status,
            code: error.code,
          });
          return null;
        }
      }

      const message = error instanceof Error ? error.message : 'Failed to load template context';

      set({
        status: 'error',
        document: null,
        template: null,
        migration: null,
        validator: null,
        sections: [],
        removedVersion: null,
        formValue: null,
        decision: null,
        error: message,
        errorCode: isApiError(error) && typeof error.code === 'string' ? error.code : null,
        upgradeFailure: null,
      });
      logger.warn('template.store.load_failed', {
        documentId: resolvedDocumentId ?? 'unknown',
        error: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      return null;
    }
  },
  reset() {
    set({ ...initialState });
    logger.clearTemplateContext();
  },
  setFormValue(value: Record<string, unknown>) {
    set({ formValue: value });
  },
  setProvisioningState(state: TemplateProvisioningState) {
    if (get().provisioningState === state) {
      return;
    }
    set({ provisioningState: state });
  },
}));

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'status' in error;
}

function normalizeValidationIssues(input: unknown): TemplateUpgradeIssue[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map(issue => normalizeIssue(issue))
      .filter((issue): issue is TemplateUpgradeIssue => issue !== null);
  }

  if (typeof input === 'object' && input !== null) {
    const nested = (input as { issues?: unknown }).issues;
    if (Array.isArray(nested)) {
      return normalizeValidationIssues(nested);
    }
  }

  return [];
}

function normalizeIssue(issue: unknown): TemplateUpgradeIssue | null {
  if (!issue || typeof issue !== 'object') {
    return null;
  }

  const pathValue = (issue as { path?: unknown }).path;
  const messageValue = (issue as { message?: unknown }).message;
  const codeValue = (issue as { code?: unknown }).code;

  const path = Array.isArray(pathValue)
    ? pathValue.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number'
      )
    : [];

  const message = typeof messageValue === 'string' ? messageValue : 'Template validation failed';
  const code = typeof codeValue === 'string' ? codeValue : undefined;

  return { path, message, code };
}
