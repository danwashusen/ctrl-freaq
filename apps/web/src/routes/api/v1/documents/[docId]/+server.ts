import type { RequestHandler } from '@sveltejs/kit';
import { PatchDocumentBodySchema, DocumentMetaSchema } from '../../../../../../packages/shared-types/src/schemas';
import { requireAntiCsrf } from '../../../../../lib/security/csrf';

export const GET: RequestHandler = async () => {
  const meta = {
    id: 'doc_1', type: 'architecture', title: 'Ctrl Freaq', templateId: 'architecture', templateVersion: '0.1.0', schemaVersion: 'v1', version: '0.1.0', status: 'draft', assumptionAggressivenessDefault: 'balanced',
  } as const;
  DocumentMetaSchema.parse(meta);
  return new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } });
};

export const PATCH: RequestHandler = async ({ request, params, locals }) => {
  requireAntiCsrf(request);
  if (!locals?.user) return new Response(JSON.stringify({ code: 'unauthorized', message: 'Login required' }), { status: 401 });
  const _docId = params.docId;
  const patch = PatchDocumentBodySchema.parse(await request.json());
  // Pretend to apply patch
  const meta = {
    id: _docId, type: 'architecture', title: 'Ctrl Freaq', templateId: 'architecture', templateVersion: '0.1.0', schemaVersion: 'v1', version: '0.1.0', status: 'draft', assumptionAggressivenessDefault: patch.assumptionAggressivenessDefault ?? 'balanced',
  } as const;
  DocumentMetaSchema.parse(meta);
  return new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } });
};

