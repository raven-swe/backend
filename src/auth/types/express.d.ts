import { User } from './user.type';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}
