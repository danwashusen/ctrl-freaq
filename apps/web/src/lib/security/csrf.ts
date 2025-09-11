export function requireAntiCsrf(request: Request) {
  const token = request.headers.get('x-csrf');
  if (!token) {
    const err: any = new Error('Missing CSRF token');
    err.status = 403; err.code = 'forbidden';
    throw err;
  }
  // In implementation: compare token to session-bound nonce
}

