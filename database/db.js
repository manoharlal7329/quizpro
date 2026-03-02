/**
 * ⚠️ LEGACY DB SHIM 
 * All data has been migrated to MongoDB Atlas.
 * This file is kept only for backward compatibility during the bridge phase.
 */

const data = {
  users: [],
  categories: [],
  sessions: [],
  seats: [],
  questions: [],
  quiz_attempts: [],
  payments: [],
  wallets: [],
  wallet_txns: [],
  fraud_logs: [],
  withdraw_requests: []
};

const save = () => {
  // No-op: Local JSON sync is disabled in favor of MongoDB
  // console.warn('⚠️ Legacy save() called - No action taken (MongoDB is active)');
};

const db = {
  commit: () => save(),
  getCollection: (name) => data[name] || [],
  transaction: async (callback) => await callback()
};

module.exports = { db, data, save };
