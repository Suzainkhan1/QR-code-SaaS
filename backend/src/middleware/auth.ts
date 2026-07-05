import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Role } from '../types/enums';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role | 'CUSTOMER';
    restaurantId: string;
    name: string;
    tableId?: string;
    tableNumber?: string;
    sessionId?: string;
  };
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token is required (Bearer <Token>)' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      restaurantId: decoded.restaurantId,
      name: decoded.name,
      tableId: decoded.tableId,
      tableNumber: decoded.tableNumber,
      sessionId: decoded.sessionId,
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
};

export const requireRoles = (...roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized user context' });
    }

    if (!roles.includes(req.user.role as Role)) {
      return res.status(403).json({ error: 'Access denied: insufficient operational role permissions' });
    }

    next();
  };
};
