import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-chatbot-secret-change-in-production';

export interface JwtPayload {
  id_usuario: number;
  username: string;
  rol: string;
}

export function authMiddleware(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado', message: 'Token requerido' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado', message: 'Token inválido o expirado' });
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );
}
