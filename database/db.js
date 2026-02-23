const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'db_store.json');

// Initialize data structure
let data = {
  users: [],
  categories: [],
  sessions: [],
  seats: [],
  questions: [],
  quiz_attempts: [],
  payments: []
};

// Load existing data
const load = () => {
  if (fs.existsSync(dbFile)) {
    try {
      data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
      console.error('Error loading DB file:', e.message);
    }
  }
};

// Save data
const save = () => {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving DB file:', e.message);
  }
};

load();

// ── Ensure all required keys exist (null-safety after load) ──
const defaults = {
  users: [], categories: [], sessions: [], seats: [], questions: [],
  quiz_attempts: [], payments: [],
  wallets: [], wallet_txns: [], referrals: []
};
Object.keys(defaults).forEach(k => { if (!data[k]) data[k] = defaults[k]; });

// Seed data if empty
if (data.categories.length === 0) {
  data.categories = [
    { id: 1, name: 'Beginner', level: 'beginner', color: '#10b981' },
    { id: 2, name: 'Skill Builder', level: 'intermediate', color: '#f59e0b' },
    { id: 3, name: 'Pro Speed', level: 'advanced', color: '#ef4444' }
  ];
  save();
}
if (!data.users.find(u => u.is_admin === 1)) {
  data.users.push({ id: 1, mobile: '9999999999', name: 'Admin', is_admin: 1 });
  save();
}

// ─── PURE JS DB INTERFACE ───────────────────────────────────────────────────
// This mimics the SQLite interface used in routes but works on the JSON object
const db = {
  // Helper to save after mutation
  commit: () => save(),

  // Table accessors
  getCollection: (name) => data[name],

  // Generic Mock for Transaction (simulated)
  transaction: async (callback) => {
    return await callback();
  }
};

module.exports = { db, data, save };
