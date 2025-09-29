import type { Logger } from 'pino';

import type { DocumentRepositoryImpl, SectionRepositoryImpl } from '@ctrl-freaq/shared-data';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';

import {
  StaticPromptProvider,
  type AssumptionPromptProvider,
  type AssumptionPromptTemplate,
} from './assumption-session.service.js';

interface TemplateAssumptionPromptProviderDeps {
  templateResolver: TemplateResolver;
  documentRepository: DocumentRepositoryImpl;
  sectionRepository: SectionRepositoryImpl;
  logger: Logger;
  fallbackProvider?: AssumptionPromptProvider;
}

type ChecklistEntry =
  | string
  | {
      id?: string;
      heading?: string;
      body?: string;
      responseType?: 'single_select' | 'multi_select' | 'text';
      options?: Array<{
        id: string;
        label: string;
        description?: string | null;
        defaultSelected?: boolean;
      }>;
      priority?: number;
    };

type TemplateSectionNode = {
  id?: string;
  title?: string;
  guidance?: string | null;
  orderIndex?: number;
  assumptions?: {
    checklist?: ChecklistEntry[];
    guidance?: string;
  } | null;
  children?: TemplateSectionNode[];
};

const YES_NO_OPTIONS = [
  { id: 'confirmed', label: 'Confirmed', description: null, defaultSelected: false },
  { id: 'needs-followup', label: 'Needs follow-up', description: null, defaultSelected: false },
];

export class TemplateAssumptionPromptProvider implements AssumptionPromptProvider {
  private readonly resolver: TemplateResolver;
  private readonly documents: DocumentRepositoryImpl;
  private readonly sections: SectionRepositoryImpl;
  private readonly logger: Logger;
  private readonly fallback: AssumptionPromptProvider;

  constructor(deps: TemplateAssumptionPromptProviderDeps) {
    this.resolver = deps.templateResolver;
    this.documents = deps.documentRepository;
    this.sections = deps.sectionRepository;
    this.logger = deps.logger;
    this.fallback = deps.fallbackProvider ?? new StaticPromptProvider();
  }

  async getPrompts(input: {
    sectionId: string;
    documentId: string;
    templateVersion: string;
  }): Promise<AssumptionPromptTemplate[]> {
    const { sectionId, documentId } = input;

    try {
      const [section, document] = await Promise.all([
        this.sections.findById(sectionId),
        this.documents.findById(documentId),
      ]);

      if (!section) {
        this.logger.warn({ sectionId }, 'Template assumption provider fallback: section not found');
        return this.fallback.getPrompts(input);
      }

      if (!document || !document.templateId) {
        this.logger.warn(
          { documentId },
          'Template assumption provider fallback: document template missing'
        );
        return this.fallback.getPrompts(input);
      }

      const version = input.templateVersion || document.templateVersion;
      if (!version) {
        this.logger.warn(
          { documentId },
          'Template assumption provider fallback: template version missing'
        );
        return this.fallback.getPrompts(input);
      }

      const template = await this.resolver.resolve({
        templateId: document.templateId,
        version,
      });

      if (!template) {
        this.logger.warn(
          { documentId, templateId: document.templateId, version },
          'Template assumption provider fallback: template version not found'
        );
        return this.fallback.getPrompts(input);
      }

      const sectionNode = this.findSection(template.template.sections, section.key);
      if (!sectionNode) {
        this.logger.warn(
          { sectionKey: section.key, templateId: document.templateId },
          'Template assumption provider fallback: section key missing from template'
        );
        return this.fallback.getPrompts(input);
      }

      const prompts = this.buildPrompts(sectionNode);
      if (prompts.length === 0) {
        this.logger.warn(
          { sectionKey: section.key, templateId: document.templateId },
          'Template assumption provider fallback: no assumptions defined in template'
        );
        return this.fallback.getPrompts(input);
      }

      return prompts.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    } catch (error) {
      this.logger.error(
        { sectionId, documentId, error: error instanceof Error ? error.message : error },
        'Template assumption provider fallback due to error'
      );
      return this.fallback.getPrompts(input);
    }
  }

  private findSection(sections: unknown, targetKey: string): TemplateSectionNode | undefined {
    if (!Array.isArray(sections)) {
      return undefined;
    }

    for (const raw of sections as TemplateSectionNode[]) {
      if (raw.id === targetKey) {
        return raw;
      }
      const candidate = this.findSection(raw.children ?? [], targetKey);
      if (candidate) {
        return candidate;
      }
    }

    return undefined;
  }

  private buildPrompts(section: TemplateSectionNode): AssumptionPromptTemplate[] {
    const prompts: AssumptionPromptTemplate[] = [];
    const checklist = Array.isArray(section.assumptions?.checklist)
      ? (section.assumptions?.checklist as ChecklistEntry[])
      : [];

    checklist.forEach((entry, index) => {
      const prompt = this.normaliseChecklistEntry(section, entry, index);
      if (prompt) {
        prompts.push(prompt);
      }
    });

    if (prompts.length === 0) {
      const guidance = section.assumptions?.guidance ?? section.guidance;
      if (guidance) {
        const key = `${section.id ?? 'section'}.guidance`;
        prompts.push({
          id: key,
          templateKey: key,
          heading: section.title ? `Review guidance: ${section.title}` : 'Review section guidance',
          body: guidance,
          responseType: 'text',
          priority: 100,
        });
      }
    }

    return prompts;
  }

  private normaliseChecklistEntry(
    section: TemplateSectionNode,
    entry: ChecklistEntry,
    index: number
  ): AssumptionPromptTemplate | null {
    const baseKey = section.id ?? 'section';

    if (typeof entry === 'string') {
      const key = `${baseKey}.checklist.${index}`;
      return {
        id: key,
        templateKey: key,
        heading: entry,
        body: entry,
        responseType: 'single_select',
        options: YES_NO_OPTIONS,
        priority: index,
      } satisfies AssumptionPromptTemplate;
    }

    const heading = entry.heading ?? entry.body ?? section.title ?? `Assumption ${index + 1}`;
    const body = entry.body ?? entry.heading ?? section.guidance ?? heading;
    let responseType: 'single_select' | 'multi_select' | 'text' = entry.responseType ?? 'text';

    let options = Array.isArray(entry.options) ? entry.options : undefined;
    if (responseType === 'multi_select') {
      if (!options || options.length === 0) {
        responseType = 'text';
      }
    }

    if (responseType === 'single_select' && (!options || options.length === 0)) {
      options = YES_NO_OPTIONS;
    }

    const normalizedOptions = options?.map(option => ({
      id: option.id,
      label: option.label,
      description: option.description ?? null,
      defaultSelected: option.defaultSelected ?? false,
    }));

    const key = entry.id ?? `${baseKey}.checklist.${index}`;

    return {
      id: key,
      templateKey: key,
      heading,
      body,
      responseType,
      options: normalizedOptions,
      priority: entry.priority ?? index,
    } satisfies AssumptionPromptTemplate;
  }
}
