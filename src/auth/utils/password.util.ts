import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

// NOTE: This is a very first level implementation. keeping it to avoid merge conflicts for now.
// In future, consider adding peppering and more advanced techniques.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
