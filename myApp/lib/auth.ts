export type User = { name: string; email: string; passwordHash: string; provider: 'password' | 'google' };

const userDb: User[] = [];

const hashPassword = (input: string) => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 33) ^ input.charCodeAt(i);
  return `h_${(hash >>> 0).toString(16)}`;
};

const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

export async function registerUser(name: string, email: string, password: string) {
  const cleanName = name.trim();
  const normalized = email.trim().toLowerCase();

  if (!cleanName) return { ok: false, message: 'Name is required.' };
  if (!isValidEmail(normalized)) return { ok: false, message: 'Enter a valid email.' };
  if (password.length < 8) return { ok: false, message: 'Password must be at least 8 characters.' };

  const existing = userDb.find((u) => u.email === normalized);
  if (existing) return { ok: false, message: 'Email already registered.' };

  userDb.push({ name: cleanName, email: normalized, passwordHash: hashPassword(password), provider: 'password' });
  return { ok: true };
}

export async function loginUser(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = userDb.find((u) => u.email === normalized);
  if (!user) return { ok: false, message: 'No account found.' };
  if (user.provider !== 'password') return { ok: false, message: 'Use Google Sign-In for this account.' };
  if (user.passwordHash !== hashPassword(password)) return { ok: false, message: 'Invalid credentials.' };
  return { ok: true, user };
}

export async function loginWithGoogle() {
  const googleEmail = 'google.user@example.com';
  let user = userDb.find((u) => u.email === googleEmail);

  if (!user) {
    user = {
      name: 'Google User',
      email: googleEmail,
      passwordHash: hashPassword(`google:${Date.now()}`),
      provider: 'google',
    };
    userDb.push(user);
  }

  return { ok: true, user, message: 'Signed in with Google.' };
}

export function debugListUsers() {
  return [...userDb];
}
