import type { RequestHandler } from '@sveltejs/kit';
import { CreateDocumentBodySchema, DocumentMetaSchema } from '../../../../../packages/shared-types/src/schemas';
import { requireAntiCsrf } from '../../../../lib/security/csrf';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireAntiCsrf(request);
  if (!locals?.user) return new Response(JSON.stringify({ code: 'unauthorized', message: 'Login required' }), { status: 401 });
  const data = await request.json();
  const body = CreateDocumentBodySchema.parse(data);
  // Placeholder doc meta
  const meta = {
    id: 'doc_1',
    type: body.type,
    title: body.title,
    templateId: 'architecture',
    templateVersion: '0.1.0',
    schemaVersion: 'v1',
    version: '0.1.0',
    status: 'draft',
    assumptionAggressivenessDefault: 'balanced',
  } as const;
  DocumentMetaSchema.parse(meta);
  return new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' }, status: 201 });
};

