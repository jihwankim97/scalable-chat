import { JwtPayload } from '../auth/types/jwt.types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
