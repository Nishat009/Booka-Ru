// Keeps the SQL edition of the schema and demo data (database/schema.sql, database/seed.sql)
// in step with the MongoDB migration and the catalogue seed. No database server needed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { collections } = require('../../database/migrations/001_initial_schema');
const { buildSeedSql, seedFile } = require('../../database/export-sql');
const { catalogBooks, editorialReviews } = require('../seed-catalog');

const databaseDir = path.join(__dirname, '..', '..', 'database');
const read = file => fs.readFileSync(path.join(databaseDir, file), 'utf8').replace(/\r\n/g, '\n');
const schemaSql = read('schema.sql');

const snake = name => name.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
const tableFor = collection => ({ orderMessages: 'order_messages' })[collection] || collection;
// Fields that are not plain columns in SQL.
const specialColumns = { 'users.permissions': null, 'orders.supportStaff': 'support_staff_id' };
const columnFor = (collection, field) => {
    const key = `${collection}.${field}`;
    return key in specialColumns ? specialColumns[key] : snake(field);
};

function tableColumns(table) {
    const match = schemaSql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`));
    assert.ok(match, `schema.sql has no table ${table}`);
    const columns = {};
    for (const line of match[1].split('\n')) {
        const column = line.match(/^ {4}([a-z_]+)\s+(.*)$/);
        if (column && !['PRIMARY', 'CHECK', 'UNIQUE', 'FOREIGN'].includes(column[1].toUpperCase())) columns[column[1]] = column[2];
    }
    return columns;
}

test('schema.sql has a table and column for every MongoDB collection and field', () => {
    for (const [collection, schema] of Object.entries(collections)) {
        const columns = tableColumns(tableFor(collection));
        for (const field of Object.keys(schema.properties)) {
            const column = columnFor(collection, field);
            if (column === null) continue;
            assert.ok(columns[column], `${tableFor(collection)}.${column} (MongoDB ${collection}.${field}) is missing from schema.sql`);
        }
        for (const field of schema.required) {
            const column = columnFor(collection, field);
            assert.match(columns[column], /NOT NULL/, `${tableFor(collection)}.${column} is required in MongoDB and must be NOT NULL`);
        }
    }
    assert.ok(tableColumns('user_permissions').permission, 'users.permissions[] needs the user_permissions table');
});

test('schema.sql keeps the enum values of the MongoDB validators', () => {
    const enums = [['users', 'role'], ['orders', 'status'], ['orderMessages', 'senderRole']];
    for (const [collection, field] of enums) {
        const definition = tableColumns(tableFor(collection))[snake(field)] + schemaSql;
        for (const value of collections[collection].properties[field].enum) assert.ok(definition.includes(`'${value}'`), `${collection}.${field} value ${value}`);
    }
});

test('seed.sql is up to date with server/seed-catalog.js', () => {
    assert.strictEqual(read('seed.sql'), buildSeedSql().replace(/\r\n/g, '\n'), `run \`npm --prefix server run db:sql\` to regenerate ${path.basename(seedFile)}`);
});

test('seed.sql contains no usable password', () => {
    const seedSql = read('seed.sql');
    assert.doesNotMatch(seedSql, /[0-9a-f]{32}:[0-9a-f]{64,}/, 'seed.sql must not contain a scrypt salt:hash');
    assert.doesNotMatch(seedSql, /password\s*[:=]/i);
});

let sqlite = null;
try { sqlite = require('node:sqlite'); } catch { /* node:sqlite needs Node 22.13+; the test below is skipped on older versions */ }

test('schema.sql and seed.sql load into SQLite, twice, with valid foreign keys', { skip: !sqlite && 'node:sqlite is not available in this Node version' }, () => {
    const db = new sqlite.DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    for (let run = 0; run < 2; run += 1) { db.exec(schemaSql); db.exec(read('seed.sql')); }
    const count = table => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    assert.strictEqual(count('books'), catalogBooks.length);
    assert.strictEqual(count('reviews'), editorialReviews.length + 1);
    assert.strictEqual(count('users'), 3);
    assert.strictEqual(count('orders'), 1);
    assert.strictEqual(count('order_messages'), 2);
    assert.deepStrictEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.throws(() => db.exec("INSERT INTO books (id, name, price, quantity) VALUES ('bad', 'x', -1, 1)"), /CHECK constraint/);
    assert.throws(() => db.exec("INSERT INTO orders (id, user_id, book_id, quantity, price, total) VALUES ('bad', 'none', 'none', 1, 1, 1)"), /FOREIGN KEY/);
    db.close();
});
