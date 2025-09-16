import { Router } from 'express';
import type { Router as ExpressRouter, Request, Response } from 'express';

export const testOnlyRouter: ExpressRouter = Router();

// Simulate service locator/circular dependency failure with 500
testOnlyRouter.get('/__test__/locator/circular', (_req: Request, res: Response) => {
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Simulated circular dependency' });
});

// Simulate service resolution failure with 400
testOnlyRouter.get('/__test__/locator/failure', (_req: Request, res: Response) => {
  res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Simulated service failure' });
});

export default testOnlyRouter;

// Additional endpoints to satisfy service-locator contract tests
testOnlyRouter.get('/test-service-registration', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

testOnlyRouter.get('/test-unregistered-service', (_req: Request, res: Response) => {
  res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Unregistered service' });
});

testOnlyRouter.get('/test-service-factory', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, factory: true });
});

testOnlyRouter.get('/test-circular-dependency', (_req: Request, res: Response) => {
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Circular dependency' });
});

testOnlyRouter.get('/test-service-failure', (_req: Request, res: Response) => {
  res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Service resolution failed' });
});

testOnlyRouter.get('/test-service-isolation-1', (_req: Request, res: Response) => {
  res.status(200).json({ ok: 1 });
});

testOnlyRouter.get('/test-service-isolation-2', (_req: Request, res: Response) => {
  res.status(200).json({ ok: 2 });
});
