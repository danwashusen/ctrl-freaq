import type { RequestHandler } from '@sveltejs/kit';
import { ProposalsGenerateBodySchema } from '../../../../../../../packages/shared-types/src/schemas';
import { requireAntiCsrf } from '../../../../../../lib/security/csrf';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  requireAntiCsrf(request);
  const sectionId = params.sectionId as string;
  const body = await request.json();
  ProposalsGenerateBodySchema.parse(body);
  if (!locals?.user) return new Response(JSON.stringify({ code: 'unauthorized', message: 'Login required' }), { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`event: token\n`));
      controller.enqueue(enc.encode(`data: Proposing edits for ${sectionId}...\n\n`));
      controller.enqueue(enc.encode(`event: diff\n`));
      controller.enqueue(enc.encode(`data: @@ -1,1 +1,1 @@\n-Old\n+New\n\n`));
      controller.enqueue(enc.encode(`event: done\n`));
      controller.enqueue(enc.encode(`data: {"proposalId":"prp_1"}\n\n`));
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' } });
};

