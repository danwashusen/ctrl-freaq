import type { RequestHandler } from '@sveltejs/kit';
import { ResolveAssumptionsBodySchema } from '../../../../../../../packages/shared-types/src/schemas';
import { requireAntiCsrf } from '../../../../../../lib/security/csrf';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  requireAntiCsrf(request);
  if (!locals?.user) return new Response(JSON.stringify({ code: 'unauthorized', message: 'Login required' }), { status: 401 });
  const _docId = params.docId;
  const body = ResolveAssumptionsBodySchema.parse(await request.json());
  // Placeholder: echo back decisions as updated
  const updated = body.decisions.map((d) => ({ id: d.id, scope: body.scope, sectionId: body.sectionId, title: '', intent: '', status: 'clear', decision: d.decision, order: 0 }));
  return new Response(JSON.stringify({ updated }), { headers: { 'content-type': 'application/json' } });
};

