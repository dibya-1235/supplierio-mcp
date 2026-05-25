import bcrypt from 'bcrypt';

let usersMap: Map<string, string> = new Map();

export function initUsers(raw: string): void {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    usersMap = new Map(Object.entries(parsed));
  } catch {
    console.error('FATAL: USERS must be valid JSON — e.g. {"dibya@supplier.io":"$2b$10$..."}');
    process.exit(1);
  }
}

export async function verifyUser(email: string, password: string): Promise<boolean> {
  const hash = usersMap.get(email);
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
