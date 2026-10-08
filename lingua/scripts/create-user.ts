/**
 * Creates the (single) account. Run the seed first.
 *   npm run user:create -- "you@example.com" "a-password-8+chars" "Your name"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapUser } from "../src/lib/cards";

const [email, password, name = "Moi"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run user:create -- "email" "password (8+ chars)" "name"');
  process.exit(1);
}
const db = new PrismaClient();
(async () => {
  const e = email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email: e } })) throw new Error("Un compte existe déjà avec cet e-mail.");
  const u = await db.user.create({ data: { email: e, name, passwordHash: await bcrypt.hash(password, 11) } });
  await bootstrapUser(u.id);
  console.log(`Compte créé pour ${e}. Connectez-vous sur http://localhost:3000/login`);
})().catch((err) => { console.error(err.message); process.exit(1); }).finally(() => db.$disconnect());
