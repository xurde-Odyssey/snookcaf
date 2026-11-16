import * as crypto from "node:crypto";
// Node 24.7+ provides Argon2; this narrow declaration also supports the existing Node 22 TS types.
type Argon2 = (algorithm: "argon2id", options: { message: string; nonce: Buffer; parallelism: number; tagLength: number; memory: number; passes: number }, callback: (error: Error | null, key: Buffer) => void) => void;
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  const argon2 = (crypto as unknown as { argon2: Argon2 }).argon2;
  if (!argon2) return reject(new Error("Authentication requires Node.js 24.7 or newer."));
  argon2("argon2id", { message: password, nonce: salt, parallelism: 1, tagLength: 32, memory: 65536, passes: 3 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString("base64").replace(/=+$/, "")}$${hash.toString("base64").replace(/=+$/, "")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded);
  // Unknown accounts and invalid hashes still pay the same KDF cost.
  const salt = match ? Buffer.from(match[1], "base64") : Buffer.alloc(16);
  const actual = await derive(password, salt);
  return !!match && crypto.timingSafeEqual(actual, Buffer.from(match[2], "base64"));
}
