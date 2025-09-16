export interface PublishTemplateVersionOptions {
  file: string;
  version: string;
  changelog?: string;
  activate?: boolean;
}

export interface ActivateTemplateVersionOptions {
  templateId: string;
  version: string;
}

export interface MigrateDocumentOptions {
  documentId: string;
  templateId: string;
  targetVersion: string;
  dryRun?: boolean;
}

export interface TemplatePublisher {
  publishFromFile(options: PublishTemplateVersionOptions): Promise<void>;
  activateVersion(options: ActivateTemplateVersionOptions): Promise<void>;
  migrateDocument(options: MigrateDocumentOptions): Promise<void>;
}

export function createTemplatePublisher(): TemplatePublisher {
  return {
    async publishFromFile(): Promise<void> {
      throw new Error('TemplatePublisher.publishFromFile not implemented');
    },
    async activateVersion(): Promise<void> {
      throw new Error('TemplatePublisher.activateVersion not implemented');
    },
    async migrateDocument(): Promise<void> {
      throw new Error('TemplatePublisher.migrateDocument not implemented');
    },
  };
}
