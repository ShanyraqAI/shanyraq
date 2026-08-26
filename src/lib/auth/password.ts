import { compare, hash, hashSync } from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

/**
 * Constant-work verification: when the user does not exist we still run one
 * bcrypt comparison against a fixed hash, so "unknown email" and "wrong
 * password" take the same time and accounts cannot be enumerated by timing.
 */
const DUMMY_HASH = hashSync("shanyraq-constant-work", BCRYPT_ROUNDS);

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) {
    await compare(password, DUMMY_HASH);
    return false;
  }
  return compare(password, passwordHash);
}
