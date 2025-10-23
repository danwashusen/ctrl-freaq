import { Router, type NextFunction, type Request, type Response } from 'express';

import { SimpleAuthService, SimpleAuthServiceError } from '../../services/simple-auth.service.js';

const SIMPLE_AUTH_PREFIX = 'simple:';

const resolveSimpleAuthService = (req: Request): SimpleAuthService => {
  const services = req.services;

  if (!services?.has('simpleAuthService')) {
    throw new SimpleAuthServiceError('Simple auth service is not registered for this request');
  }

  return services.get<SimpleAuthService>('simpleAuthService');
};

const listUsersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const service = resolveSimpleAuthService(req);
    const users = await service.listUsers();

    res.status(200).json({ users });
  } catch (error) {
    if (error instanceof SimpleAuthServiceError) {
      res.status(500).json({ error: error.message, details: error.details ?? undefined });
      return;
    }

    next(error);
  }
};

const simpleAuthRouter: Router = Router();

export { simpleAuthRouter };

simpleAuthRouter.get('/users', listUsersHandler);

const logoutHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const rawAuthorization = (req.headers.authorization ?? req.headers.Authorization) as
    | string
    | undefined;

  if (!rawAuthorization) {
    res.status(204).send();
    return;
  }

  const [scheme, token] = rawAuthorization.split(' ', 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token?.startsWith(SIMPLE_AUTH_PREFIX)) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Simple auth logout requires a `Bearer simple:<userId>` token',
    });
    return;
  }

  const userId = token.slice(SIMPLE_AUTH_PREFIX.length);
  if (!userId) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Simple auth logout token is missing a user identifier',
    });
    return;
  }

  try {
    const service = resolveSimpleAuthService(req);
    const user = await service.getUserById(userId);
    if (!user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: `Simple auth user "${userId}" was not found`,
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

simpleAuthRouter.post('/logout', logoutHandler);
