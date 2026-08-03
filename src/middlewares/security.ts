import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const warnedMissingToken = { value: false };

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    if (!warnedMissingToken.value) {
      warnedMissingToken.value = true;
      console.warn('Security warning: JWT_SECRET is not configured. Refusing access to /api routes.');
    }
    res.status(503).json({ success: false, message: 'JWT auth is not configured' });
    return;
  }

  const token = extractBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    const sub = typeof decoded.sub === 'string' ? decoded.sub : '';
    const tenantId = typeof decoded.tenantId === 'string' ? decoded.tenantId.trim() : '';
    const role = typeof decoded.role === 'string' ? decoded.role : undefined;
    const email = typeof decoded.email === 'string' ? decoded.email : undefined;

    if (!sub || !tenantId) {
      res.status(403).json({ success: false, message: 'Invalid token claims' });
      return;
    }

    req.auth = {
      userId: sub,
      tenantId,
      role,
      email,
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (role === 'superadmin' || role === 'platform_admin') {
    next();
    return;
  }

  const configuredKey = process.env.TENANT_ADMIN_KEY?.trim();

  if (!configuredKey) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ success: false, message: 'TENANT_ADMIN_KEY is not configured' });
      return;
    }

    next();
    return;
  }

  const requestKey = req.header('x-tenant-admin-key')?.trim();
  if (!requestKey || requestKey !== configuredKey) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  next();
}
