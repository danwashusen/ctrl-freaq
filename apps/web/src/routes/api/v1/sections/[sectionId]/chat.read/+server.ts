// SvelteKit endpoint stub (POST) for section-scoped read-only chat (SSE)
// Requires: packages/shared-types, packages/locator
// Note: Placeholder only; wire actual streaming with Vercel AI SDK in implementation.
import type { RequestHandler } from '@sveltejs/kit';
import { ChatReadBodySchema } from '../../../../../../../packages/shared-types/src/schemas';
import { requireAntiCsrf } from '../../../../../../lib/security/csrf';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  requireAntiCsrf(request);
  const sectionId = params.sectionId as string;
  const body = await request.json();
  const parsed = ChatReadBodySchema.parse(body);

  // Validate session (placeholder)
  if (!locals?.user) {
    return new Response(JSON.stringify({ code: 'unauthorized', message: 'Login required' }), { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`event: token\n`));
      controller.enqueue(enc.encode(`data: Processing section ${sectionId}...\n\n`));
      const tid = setTimeout(() => {
        controller.enqueue(enc.encode(`event: done\n`));
        controller.enqueue(enc.encode(`data: {"messageId":"msg_1"}\n\n`));
        controller.close();
      }, 50);
      // Heartbeat
      const hb = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15000);
      // Abort
      // @ts-ignore
      request.signal.addEventListener('abort', () => { clearTimeout(tid); clearInterval(hb); controller.close(); });
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive'
    }
  });
};

