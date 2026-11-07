require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const { MongoClient } = require('mongodb');
const scrypt = promisify(crypto.scrypt);

async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function saveAccount(users, { email, name, role, permissions, password }) {
  if (!email || !password || password.length < 8 || !/[0-9]/.test(password)) {
    throw new Error(`Set a password of at least 8 characters including a number for ${email || 'every demo account'}.`);
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users.findOne({ email: normalizedEmail });
  const fields = { email: normalizedEmail, name, role, permissions, passwordHash: await passwordHash(password), updatedAt: new Date() };
  if (existing) await users.updateOne({ _id: existing._id }, { $set: fields });
  else await users.insertOne({ ...fields, active: true, createdAt: new Date() });
}

// Passwords always come from the environment (DEMO_*_PASSWORD); nothing is hard-coded.
async function seedDemoAccounts(database, env = process.env) {
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) throw new Error('ADMIN_EMAIL must be set.');
  const users = database.collection('users');
  await saveAccount(users, { email: adminEmail, name: 'Booka-Ru Test Admin', role: 'admin', permissions: ['*'], password: env.DEMO_ADMIN_PASSWORD });
  await saveAccount(users, { email: 'bookaru.staff.test@example.com', name: 'Booka-Ru Test Staff', role: 'staff', permissions: ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate'], password: env.DEMO_STAFF_PASSWORD });
  await saveAccount(users, { email: 'bookaru.customer.test@example.com', name: 'Booka-Ru Test Customer', role: 'customer', permissions: [], password: env.DEMO_CUSTOMER_PASSWORD });
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI and ADMIN_EMAIL must be set.');
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    await seedDemoAccounts(client.db(process.env.DB_NAME || 'bookDB'));
    console.log('Demo admin, staff, and customer accounts are ready in MongoDB.');
  } finally {
    await client.close();
  }
}

module.exports = { seedDemoAccounts };

if (require.main === module) run().catch(error => { console.error('Could not seed demo accounts:', error.message); process.exitCode = 1; });
