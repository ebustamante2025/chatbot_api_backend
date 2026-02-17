import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/connection.js';

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

    // Verificar que el token sea la sesión activa del usuario
    db('usuarios_soporte')
      .where({ id_usuario: decoded.id_usuario })
      .select('sesion_token')
      .first()
      .then((usuario) => {
        // Si el usuario no existe o la columna sesion_token no tiene valor,
        // permitir el paso (migración pendiente o primer login)
        if (!usuario || !usuario.sesion_token) {
          next();
          return;
        }
        if (usuario.sesion_token !== token) {
          res.status(401).json({
            error: 'Sesión expirada',
            message: 'Se ha iniciado sesión en otro dispositivo. Solo se permite una sesión activa.',
            code: 'SESSION_REPLACED',
          });
          return;
        }
        next();
      })
      .catch(() => {
        // Si falla la consulta a BD, permitir el paso para no bloquear
        next();
      });
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
