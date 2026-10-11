// Reads an admin password from stdin and prints only its scrypt hash, for ADMIN_PASSWORD_HASH.
//   read -s PW && printf '%s' "$PW" | npm run -s hash-password; unset PW
import { hashPassword } from '../backend/admin.js';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');

if (password.length < 12) {
  console.error('Please use a password of at least 12 characters.');
  process.exit(1);
}
if (password.length > 200) {
  console.error('Please use a password of at most 200 characters.');
  process.exit(1);
}

process.stdout.write((await hashPassword(password)) + '\n');
