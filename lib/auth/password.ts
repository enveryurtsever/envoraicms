import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Hash format: "scrypt$N$r$p$saltB64$hashB64"
// N=16384, r=8, p=1 — OWASP 2023 minimum, Node default.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_LEN = 16;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) throw new Error("password too short");
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(plain, salt, KEYLEN);
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  try {
    const derived = await scrypt(plain, salt, expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
