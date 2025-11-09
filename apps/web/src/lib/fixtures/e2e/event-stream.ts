import type { IncomingMessage, ServerResponse } from 'http';

interface FixtureStreamError {
  code: string;
  message: string;
}

const methodNotAllowedError: FixtureStreamError = {
  code: 'fixtures.method_not_allowed',
  message: 'Only GET is supported for fixture event streams.',
};

const HEARTBEAT_INTERVAL_MS = 15_000;

export type FixtureEventStreamHandler = (req: IncomingMessage, res: ServerResponse) => void;

export const createFixtureEventStreamHandler = (): FixtureEventStreamHandler => {
  return (req, res) => {
    if (req.method && req.method !== 'GET') {
      sendJson(res, 405, methodNotAllowedError);
      return;
    }

    startEventStream(req, res);
  };
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function startEventStream(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  req.socket.setTimeout(0);

  const heartbeat = () => {
    writeEvent(res, 'heartbeat', { ts: new Date().toISOString() });
  };

  writeEvent(res, 'stream.ready', { profile: 'fixture' });
  heartbeat();

  const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeatTimer);
    res.end();
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
}

function writeEvent(res: ServerResponse, eventName: string, payload: unknown) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
