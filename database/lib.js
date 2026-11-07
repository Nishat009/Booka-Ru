// Shared helpers for the database scripts. The MongoDB driver and dotenv are installed in
// server/node_modules, so they are loaded from there; this lets `node database/<script>.js`
// run from any working directory without a separate install.
const path = require('path');
const { createRequire } = require('module');

const serverDir = path.join(__dirname, '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));

function loadEnv() {
    serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
}

async function withDatabase(task) {
    loadEnv();
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI must be set (server/.env or the environment).');
    const { MongoClient } = serverRequire('mongodb');
    const client = new MongoClient(uri);
    try {
        await client.connect();
        return await task(client.db(process.env.DB_NAME || 'bookDB'));
    } finally {
        await client.close();
    }
}

module.exports = { serverDir, serverRequire, loadEnv, withDatabase };
