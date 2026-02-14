/**
 * Seed script - creates default admin agent
 * Run: node seed.js
 */
require('dotenv').config();
const { connectDB } = require('./db/connection');
const { Agent } = require('./db/models');
const bcrypt = require('bcryptjs');

async function seed() {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@myapp.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'changeme123';

  const existing = await Agent.findOne({ email });
  if (existing) {
    console.log(`Admin agent already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await Agent.create({
    email,
    passwordHash,
    name: 'Admin',
    role: 'admin',
    status: 'offline',
    specialties: ['billing', 'technical', 'general']
  });

  console.log(`Created admin agent: ${email} / ${password}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
