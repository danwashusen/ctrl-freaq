import { create } from 'zustand';

import { createTemplateValidator } from '../lib/template-validator';

import type ApiClient from '../lib/api';
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
  apiClient: Pick<ApiClient, 'getDocument' | 'getTemplate' | 'getTemplateVersion'>;
  documentId: string;
}

type TemplateStoreStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'error';

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
  loadDocument: (options: LoadDocumentOptions) => Promise<void>;
  reset: () => void;
  setFormValue: (value: Record<string, unknown>) => void;
}

const initialState: Omit<TemplateStoreState, 'loadDocument' | 'reset' | 'setFormValue'> = {
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
};

export const useTemplateStore = create<TemplateStoreState>(set => ({
  ...initialState,
  async loadDocument({ apiClient, documentId }: LoadDocumentOptions) {
    set({ status: 'loading', error: undefined });

    try {
      const response = (await apiClient.getDocument(documentId)) as DocumentApiResponse;
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
        });
        logger.setTemplateContext({
          templateId: decision.requestedVersion.templateId,
          templateVersion: decision.requestedVersion.version,
          templateSchemaHash: decision.requestedVersion.schemaHash,
        });
        return;
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
      });

      logger.setTemplateContext({
        templateId,
        templateVersion: response.document.templateVersion,
        templateSchemaHash: response.document.templateSchemaHash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load template context';
      set({ status: 'error', error: message, decision: null });
      logger.warn('template.store.load_failed', {
        documentId,
        error: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
    }
  },
  reset() {
    set({ ...initialState });
    logger.clearTemplateContext();
  },
  setFormValue(value: Record<string, unknown>) {
    set({ formValue: value });
  },
}));
