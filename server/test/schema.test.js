// Run with: npm test (from server/). Uses Node's built-in test runner; no database needed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { collections, indexes } = require('../../database/migrations/001_initial_schema');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const usedCollections = [...source.matchAll(/database\.collection\('([^']+)'\)/g)].map(match => match[1]);

test('every collection the API uses has a schema and indexes', () => {
    assert.ok(usedCollections.length > 0);
    for (const name of usedCollections) {
        assert.ok(collections[name], `missing validator for ${name}`);
        assert.ok(indexes[name]?.length, `missing indexes for ${name}`);
    }
});

test('login emails and session tokens are unique, and sessions expire', () => {
    assert.ok(indexes.users.some(index => index.key.email === 1 && index.unique));
    assert.ok(indexes.sessions.some(index => index.key.tokenHash === 1 && index.unique));
    assert.ok(indexes.sessions.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
});

test('every mutating route except sign-up and sign-in requires authentication', () => {
    const routes = [...source.matchAll(/app\.(post|put|patch|delete)\('([^']+)',\s*([^\n]+)/g)];
    const publicRoutes = ['/auth/register', '/auth/login', '/auth/demo-login/:role'];
    assert.ok(routes.length > 10);
    for (const [, method, route, rest] of routes) {
        if (publicRoutes.includes(route)) continue;
        assert.match(rest, /^authenticate\b/, `${method.toUpperCase()} ${route} must start with authenticate`);
        if (route.startsWith('/admin/') || route.startsWith('/books')) assert.match(rest, /^authenticate, (allow\(|adminOnly)/, `${method.toUpperCase()} ${route} must check a permission`);
    }
});

test('the invoice renders a PDF for an order', async () => {
    const { buildInvoice } = require('../invoice');
    const pdf = buildInvoice({ _id: 'test', name: 'The Hobbit', quantity: 1, price: 520, total: 520, email: 'a@example.com', customerName: 'Test', shippingAddress: 'Dhaka', status: 'new', createdAt: new Date() });
    const chunks = [];
    pdf.on('data', chunk => chunks.push(chunk));
    const done = new Promise(resolve => pdf.on('end', resolve));
    pdf.end();
    await done;
    assert.strictEqual(Buffer.concat(chunks).subarray(0, 4).toString(), '%PDF');
});
