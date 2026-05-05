export type User = { name: string; email: string; passwordHash: string };

const userDb: User[] = [];

const hashPassword = (input: string) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 33) ^ input.charCodeAt(i);
  return `h_${(hash >>> 0).toString(16)}`;
};

export async function registerUser(name: string, email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const existing = userDb.find((u) => u.email === normalized);
  if (existing) return { ok: false, message: 'Email already registered.' };

  userDb.push({ name: name.trim(), email: normalized, passwordHash: hashPassword(password) });
  return { ok: true };
}

export async function loginUser(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = userDb.find((u) => u.email === normalized);
  if (!user) return { ok: false, message: 'No account found.' };
  if (user.passwordHash !== hashPassword(password)) return { ok: false, message: 'Invalid credentials.' };
  return { ok: true, user };
}
