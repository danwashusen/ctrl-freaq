import type { Express } from 'express';
import request from 'supertest';

import {
  readTemplateFixture,
  withManagerAuth,
  type TemplateFixtureName,
} from '../../src/testing/templates-test-helpers.js';

interface PublishOptions {
  templateId?: string;
  version?: string;
  fixture?: TemplateFixtureName;
  changelog?: string;
  autoActivate?: boolean;
}

export async function publishTemplateVersion(
  app: Express,
  options: PublishOptions = {}
): Promise<request.Response> {
  const {
    templateId = 'architecture',
    version = '1.0.0',
    fixture = 'architecture.valid',
    changelog = 'Initial architecture baseline',
    autoActivate = false,
  } = options;

  const templateYaml = readTemplateFixture(fixture);

  const response = await withManagerAuth(
    request(app).post(`/api/v1/templates/${templateId}/versions`).send({
      version,
      changelog,
      templateYaml,
      publish: autoActivate,
    })
  );

  return response;
}

export async function activateTemplateVersion(
  app: Express,
  templateId: string,
  version: string
): Promise<request.Response> {
  return await withManagerAuth(
    request(app).post(`/api/v1/templates/${templateId}/versions/${version}/activate`).send()
  );
}

export async function listTemplateVersions(
  app: Express,
  templateId: string
): Promise<request.Response> {
  return await withManagerAuth(request(app).get(`/api/v1/templates/${templateId}/versions`));
}

export async function getTemplate(app: Express, templateId: string): Promise<request.Response> {
  return await withManagerAuth(request(app).get(`/api/v1/templates/${templateId}`));
}

export async function getTemplateVersion(
  app: Express,
  templateId: string,
  version: string
): Promise<request.Response> {
  return await withManagerAuth(
    request(app).get(`/api/v1/templates/${templateId}/versions/${version}`)
  );
}

export async function listTemplates(app: Express): Promise<request.Response> {
  return await withManagerAuth(request(app).get(`/api/v1/templates`));
}
