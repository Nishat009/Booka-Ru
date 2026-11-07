// Migration runner. Applies every file in database/migrations/ in name order, once.
// Applied migrations are recorded in the `_migrations` collection.
//
//   node database/migrate.js            apply pending migrations
//   node database/migrate.js --status   list applied and pending migrations
//
// The API also calls runMigrations() on startup, so a fresh database is ready as soon
// as the server starts.
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'migrations');

function loadMigrations() {
    return fs.readdirSync(migrationsDir)
        .filter(file => /^\d+_.+\.js$/.test(file))
        .sort()
        .map(file => require(path.join(migrationsDir, file)));
}

async function migrationStatus(db) {
    const applied = new Set((await db.collection('_migrations').find({}, { projection: { _id: 1 } }).toArray()).map(item => item._id));
    return loadMigrations().map(migration => ({ id: migration.id, description: migration.description, applied: applied.has(migration.id) }));
}

async function runMigrations(db, log = console.log) {
    const done = [];
    for (const migration of loadMigrations()) {
        if (await db.collection('_migrations').findOne({ _id: migration.id })) continue;
        log(`Applying migration ${migration.id} — ${migration.description}`);
        await migration.up(db, log);
        await db.collection('_migrations').insertOne({ _id: migration.id, description: migration.description, appliedAt: new Date() });
        done.push(migration.id);
    }
    return done;
}

module.exports = { runMigrations, migrationStatus };

if (require.main === module) {
    const { withDatabase } = require('./lib');
    withDatabase(async db => {
        if (process.argv.includes('--status')) {
            for (const item of await migrationStatus(db)) console.log(`${item.applied ? '[x]' : '[ ]'} ${item.id} — ${item.description}`);
            return;
        }
        const done = await runMigrations(db);
        console.log(done.length ? `Applied ${done.length} migration(s).` : 'Database schema is up to date.');
    }).catch(error => { console.error('Migration failed:', error.message); process.exitCode = 1; });
}
