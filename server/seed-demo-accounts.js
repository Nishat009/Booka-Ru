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
  else await users.insertOne({ ...fields, createdAt: new Date() });
}

async function seedDemoAccounts() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!process.env.MONGODB_URI || !adminEmail) throw new Error('MONGODB_URI and ADMIN_EMAIL must be set.');
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const users = client.db(process.env.DB_NAME || 'bookDB').collection('users');
    await saveAccount(users, { email: adminEmail, name: 'Booka-Ru Test Admin', role: 'admin', permissions: ['*'], password: process.env.DEMO_ADMIN_PASSWORD });
    await saveAccount(users, { email: 'bookaru.staff.test@example.com', name: 'Booka-Ru Test Staff', role: 'staff', permissions: ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate'], password: process.env.DEMO_STAFF_PASSWORD });
    await saveAccount(users, { email: 'bookaru.customer.test@example.com', name: 'Booka-Ru Test Customer', role: 'customer', permissions: [], password: process.env.DEMO_CUSTOMER_PASSWORD });
    console.log('Demo admin, staff, and customer accounts are ready in MongoDB.');
  } finally {
    await client.close();
  }
}

seedDemoAccounts().catch(error => { console.error('Could not seed demo accounts:', error.message); process.exitCode = 1; });
