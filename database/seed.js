// Demo data so a reviewer or buyer sees a working shop straight away.
//
//   node database/seed.js        (or: npm --prefix server run db:seed)
//
// Steps, all idempotent (safe to run again):
//   1. apply schema migrations (database/migrations/)
//   2. load the starter catalogue: 51 English and Bangla books + 4 editorial reviews
//   3. create the admin / staff / customer demo accounts — only when ADMIN_EMAIL and all
//      three DEMO_*_PASSWORD values are set; passwords are never stored in this repo
//   4. add a sample order with a support conversation, a pending customer review and a
//      welcome pop-up, so every admin screen has something to show
//
// Use it on development, staging and demo databases. On a real shop, run only
// `npm --prefix server run seed:catalog` (or nothing at all).
const path = require('path');
const { withDatabase, serverDir } = require('./lib');
const { runMigrations } = require('./migrate');

const { seedCatalog } = require(path.join(serverDir, 'seed-catalog.js'));
const { seedDemoAccounts } = require(path.join(serverDir, 'seed-demo-accounts.js'));

const CUSTOMER_EMAIL = 'bookaru.customer.test@example.com';

async function seedSampleActivity(db) {
    const customer = await db.collection('users').findOne({ email: CUSTOMER_EMAIL });
    const admin = await db.collection('users').findOne({ email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() });
    const book = await db.collection('books').findOne({ seedKey: 'isbn-9780547928227' }); // The Hobbit

    await db.collection('popups').updateOne({ seedKey: 'demo-welcome-popup' }, { $setOnInsert: {
        seedKey: 'demo-welcome-popup', title: 'Welcome to Booka-Ru', imageURL: '/fairytale-books.svg', linkURL: '/',
        active: false, startsAt: null, endsAt: null, createdAt: new Date(), updatedAt: new Date()
    } }, { upsert: true });

    if (!customer || !book) return 'pop-up (sample order and review skipped: demo customer account not created)';

    const order = await db.collection('orders').findOneAndUpdate({ seedKey: 'demo-order-1' }, { $setOnInsert: {
        seedKey: 'demo-order-1', userId: String(customer._id), email: customer.email, customerName: customer.name,
        bookId: String(book._id), name: book.name, imageURL: book.imageURL || '', quantity: 1, price: book.price, total: book.price,
        status: 'confirmed', supportStaff: null, shippingAddress: 'House 12, Road 5, Dhanmondi, Dhaka 1205', notes: '',
        createdAt: new Date(), updatedAt: new Date()
    } }, { upsert: true, returnDocument: 'after' });
    const orderId = String((order.value || order)._id);

    const conversation = [
        { seedKey: 'demo-message-1', senderId: String(customer._id), senderName: customer.name, senderRole: 'customer', text: 'Hi! When will my copy of The Hobbit arrive?' },
        ...(admin ? [{ seedKey: 'demo-message-2', senderId: String(admin._id), senderName: admin.name, senderRole: 'admin', text: 'Your order is confirmed and will ship within two working days.' }] : [])
    ];
    for (const [index, message] of conversation.entries()) {
        await db.collection('orderMessages').updateOne({ seedKey: message.seedKey }, { $setOnInsert: { ...message, orderId, createdAt: new Date(Date.now() + index * 1000) } }, { upsert: true });
    }

    await db.collection('reviews').updateOne({ seedKey: 'demo-customer-review' }, { $setOnInsert: {
        seedKey: 'demo-customer-review', userId: String(customer._id), name: customer.name, email: customer.email, rating: 5,
        text: 'Fast delivery and the book arrived in perfect condition.', approved: false, createdAt: new Date()
    } }, { upsert: true });

    return 'pop-up, sample order with support messages, and a pending customer review';
}

async function seed(db) {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Schema: applied ${applied.join(', ')}.` : 'Schema: up to date.');

    console.log(`Catalogue: ${await seedCatalog(db)}.`);

    const env = process.env;
    if (env.ADMIN_EMAIL && env.DEMO_ADMIN_PASSWORD && env.DEMO_STAFF_PASSWORD && env.DEMO_CUSTOMER_PASSWORD) {
        await seedDemoAccounts(db, env);
        console.log(`Accounts: admin (${env.ADMIN_EMAIL}), bookaru.staff.test@example.com, ${CUSTOMER_EMAIL}.`);
    } else {
        console.log('Accounts: skipped. Set ADMIN_EMAIL and DEMO_ADMIN_PASSWORD / DEMO_STAFF_PASSWORD / DEMO_CUSTOMER_PASSWORD to create demo logins.');
    }

    console.log(`Sample data: ${await seedSampleActivity(db)}.`);
}

module.exports = { seed };

if (require.main === module) {
    withDatabase(seed)
        .then(() => console.log('Seed complete.'))
        .catch(error => { console.error('Seed failed:', error.message); process.exitCode = 1; });
}
