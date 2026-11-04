require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = await scrypt(password, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const port = process.env.PORT || 5500;
const uri = process.env.MONGODB_URI;
const databaseName = process.env.DB_NAME || 'bookDB';
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function startServer() {
    if (!uri) throw new Error('MONGODB_URI must be set in the server environment.');
    const client = new MongoClient(uri);
    await client.connect();
    const database = client.db(databaseName);
    const books = database.collection('books');
    const orders = database.collection('orders');
    const users = database.collection('users');
    const sessions = database.collection('sessions');
    const reviews = database.collection('reviews');
    const messages = database.collection('orderMessages');
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    const authenticate = asyncHandler(async (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
        const session = await sessions.findOne({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: { $gt: new Date() } });
        if (!session) return res.status(401).json({ message: 'Your session expired. Please sign in again.' });
        const profile = await users.findOne({ _id: session.userId });
        if (!profile) return res.status(401).json({ message: 'Account not found. Please sign in again.' });
        const role = profile.email === adminEmail ? 'admin' : (profile.role || 'customer');
        req.user = { uid: String(profile._id), email: profile.email, name: profile.name || profile.email, role,
            permissions: role === 'admin' ? ['*'] : (profile.permissions || []) };
        next();
    });
    const allow = (...permissions) => (req, res, next) => {
        if (req.user?.role === 'admin' || permissions.some(permission => req.user?.permissions?.includes(permission))) return next();
        return res.status(403).json({ message: 'You do not have permission to do that.' });
    };
    const validId = value => ObjectId.isValid(value);
    const publicBook = book => ({ ...book, _id: String(book._id) });

    app.get('/', (req, res) => res.json({ name: 'Booka-Ru API', status: 'running' }));
    app.get('/auth/me', authenticate, (req, res) => res.json({ uid: req.user.uid, email: req.user.email, name: req.user.name, role: req.user.role, permissions: req.user.permissions }));
    app.post('/auth/register', asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const name = String(req.body.name || '').trim();
        if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !/[0-9]/.test(password) || !name)
            return res.status(400).json({ message: 'Name, valid email, and password (8+ characters including a number) are required.' });
        if (await users.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
        const result = await users.insertOne({ email, name, passwordHash: await hashPassword(password), role: 'customer', permissions: [], createdAt: new Date() });
        res.status(201).json({ registered: true, uid: String(result.insertedId) });
    }));
    app.post('/auth/login', asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const user = await users.findOne({ email });
        if (!user || !await verifyPassword(String(req.body.password || ''), user.passwordHash))
            return res.status(401).json({ message: 'Email or password is incorrect.' });
        const token = crypto.randomBytes(32).toString('hex');
        await sessions.insertOne({ userId: user._id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), createdAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) });
        const role = user.email === adminEmail ? 'admin' : (user.role || 'customer');
        res.json({ token, user: { uid: String(user._id), email, name: user.name, role, permissions: role === 'admin' ? ['*'] : (user.permissions || []) } });
    }));
    app.post('/auth/demo-login/:role', asyncHandler(async (req, res) => {
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_LOGINS !== 'true')
            return res.status(404).json({ message: 'Demo sign-in is not enabled.' });
        const profiles = {
            admin: { email: adminEmail },
            staff: { email: 'bookaru.staff.test@example.com' },
            customer: { email: 'bookaru.customer.test@example.com' }
        };
        const selected = profiles[req.params.role];
        if (!selected?.email) return res.status(404).json({ message: 'Demo profile not found.' });
        const profile = await users.findOne({ email: selected.email });
        if (!profile) return res.status(404).json({ message: 'Demo profile is not set up. Run the demo account seeder.' });
        const role = profile.email === adminEmail ? 'admin' : (profile.role || 'customer');
        const token = crypto.randomBytes(32).toString('hex');
        await sessions.insertOne({ userId: profile._id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), createdAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) });
        res.json({ token, user: { uid: String(profile._id), email: profile.email, name: profile.name || profile.email, role, permissions: role === 'admin' ? ['*'] : (profile.permissions || []) } });
    }));
    app.post('/auth/logout', authenticate, asyncHandler(async (req, res) => {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        await sessions.deleteOne({ tokenHash: crypto.createHash('sha256').update(token).digest('hex') });
        res.json({ signedOut: true });
    }));
    app.get('/books', asyncHandler(async (req, res) => {
        const query = { active: { $ne: false } };
        if (req.query.category) query.category = req.query.category;
        if (req.query.genre) query.genre = req.query.genre;
        if (req.query.language) query.language = req.query.language;
        if (req.query.q) query.name = { $regex: String(req.query.q).slice(0, 80), $options: 'i' };
        res.json((await books.find(query).sort({ createdAt: -1 }).toArray()).map(publicBook));
    }));
    app.get('/books/:id', asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid book ID.' });
        const book = await books.findOne({ _id: new ObjectId(req.params.id), active: { $ne: false } });
        return book ? res.json(publicBook(book)) : res.status(404).json({ message: 'Book not found.' });
    }));
    app.post('/books', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        const { name, price, quantity } = req.body;
        if (!String(name || '').trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(quantity)) || Number(quantity) < 0)
            return res.status(400).json({ message: 'Book name, valid price, and quantity are required.' });
        const book = { name: String(name).trim(), description: String(req.body.description || ''), imageURL: String(req.body.imageURL || ''),
            price: Number(price), quantity: Number(quantity), category: String(req.body.category || 'General'), genre: String(req.body.genre || 'General'),
            language: String(req.body.language || 'English'), author: String(req.body.author || ''), active: true, createdAt: new Date() };
        const result = await books.insertOne(book);
        res.status(201).json({ ...book, _id: String(result.insertedId) });
    }));
    app.put('/books/:id', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid book ID.' });
        const fields = ['name', 'description', 'imageURL', 'category', 'genre', 'language', 'author'];
        const update = {};
        fields.forEach(field => { if (req.body[field] !== undefined) update[field] = String(req.body[field]); });
        if (req.body.price !== undefined) update.price = Number(req.body.price);
        if (req.body.quantity !== undefined) update.quantity = Number(req.body.quantity);
        const result = await books.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        return result.matchedCount ? res.json({ updated: true }) : res.status(404).json({ message: 'Book not found.' });
    }));
    app.delete('/books/:id', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid book ID.' });
        const result = await books.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { active: false } });
        res.json({ deleted: result.modifiedCount > 0 });
    }));

    app.post('/orders', authenticate, asyncHandler(async (req, res) => {
        const bookId = req.body.bookId || req.body.id;
        if (!validId(bookId)) return res.status(400).json({ message: 'Choose a valid book.' });
        const quantity = Math.max(1, Math.min(99, Number(req.body.quantity) || 1));
        const book = await books.findOne({ _id: new ObjectId(bookId), active: { $ne: false } });
        if (!book) return res.status(404).json({ message: 'Book not found.' });
        const stockUpdate = await books.updateOne({ _id: book._id, active: { $ne: false }, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } });
        if (!stockUpdate.modifiedCount) return res.status(409).json({ message: 'Not enough copies are in stock.' });
        const order = { userId: req.user.uid, email: req.user.email, customerName: req.user.name, bookId: String(book._id), name: book.name,
            imageURL: book.imageURL || '', quantity, price: Number(book.price), total: Number(book.price) * quantity,
            createdAt: new Date(), status: 'new', supportStaff: null, shippingAddress: String(req.body.shippingAddress || ''), notes: '' };
        let result;
        try { result = await orders.insertOne(order); }
        catch (error) { await books.updateOne({ _id: book._id }, { $inc: { quantity } }); throw error; }
        res.status(201).json({ ...order, _id: String(result.insertedId) });
    }));
    app.get('/orders', authenticate, asyncHandler(async (req, res) => {
        const staffAccess = req.user.role === 'admin' || req.user.permissions.includes('orders:manage') || req.user.permissions.includes('support:handle');
        const query = staffAccess ? {} : { userId: req.user.uid };
        res.json((await orders.find(query).sort({ createdAt: -1 }).toArray()).map(order => ({ ...order, _id: String(order._id) })));
    }));
    app.patch('/orders/:id', authenticate, allow('orders:manage', 'support:handle'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
        const allowedStatuses = ['new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled'];
        const update = { updatedAt: new Date() };
        if (req.body.status && allowedStatuses.includes(req.body.status)) update.status = req.body.status;
        if (req.body.status === 'on-call') update.supportStaff = { uid: req.user.uid, email: req.user.email, name: req.user.name };
        const result = await orders.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        return result.matchedCount ? res.json({ updated: true }) : res.status(404).json({ message: 'Order not found.' });
    }));
    app.get('/orders/:id/messages', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.status(404).json({ message: 'Order not found.' });
        if (order.userId !== req.user.uid && req.user.role !== 'admin' && !req.user.permissions.includes('orders:manage') &&
            !(req.user.permissions.includes('support:handle') && order.supportStaff?.uid === req.user.uid))
            return res.status(403).json({ message: 'This support conversation is not assigned to you.' });
        res.json((await messages.find({ orderId: req.params.id }).sort({ createdAt: 1 }).toArray()).map(message => ({ ...message, _id: String(message._id) })));
    }));
    app.post('/orders/:id/messages', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.status(404).json({ message: 'Order not found.' });
        if (order.userId !== req.user.uid && req.user.role !== 'admin' && !req.user.permissions.includes('orders:manage') &&
            !(req.user.permissions.includes('support:handle') && order.supportStaff?.uid === req.user.uid))
            return res.status(403).json({ message: 'This support conversation is not assigned to you.' });
        const text = String(req.body.text || '').trim().slice(0, 1600);
        if (!text) return res.status(400).json({ message: 'Message cannot be empty.' });
        const message = { orderId: req.params.id, senderId: req.user.uid, senderName: req.user.name, senderRole: req.user.role, text, createdAt: new Date() };
        const result = await messages.insertOne(message);
        res.status(201).json({ ...message, _id: String(result.insertedId) });
    }));
    app.get('/orders/:id/invoice', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid order ID.' });
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return res.status(404).json({ message: 'Order not found.' });
        if (order.userId !== req.user.uid && req.user.role !== 'admin' && !req.user.permissions.includes('orders:manage'))
            return res.status(403).json({ message: 'This invoice is not available to your account.' });
        const line = value => String(value || '').replace(/[\r\n]/g, ' ').slice(0, 160);
        const invoice = [`BOOKA-RU | INVOICE`, `Invoice: ${order._id}`, `Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`,
            `Customer: ${line(order.customerName)} (${line(order.email)})`, `Book: ${line(order.name)}`, `Quantity: ${order.quantity}`,
            `Unit price: BDT ${order.price}`, `Total: BDT ${order.total}`, `Status: ${order.status}`].join('\n');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="bookaru-invoice-${order._id}.txt"`);
        return res.send(invoice);
    }));

    app.post('/reviews', authenticate, asyncHandler(async (req, res) => {
        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !String(req.body.text || '').trim())
            return res.status(400).json({ message: 'A review and a rating from 1 to 5 are required.' });
        const review = { userId: req.user.uid, name: req.user.name, email: req.user.email, rating,
            text: String(req.body.text).trim().slice(0, 800), createdAt: new Date(), approved: false };
        const result = await reviews.insertOne(review);
        res.status(201).json({ id: String(result.insertedId), submitted: true });
    }));
    app.get('/reviews', asyncHandler(async (req, res) => {
        res.json((await reviews.find({ approved: true }).sort({ createdAt: -1 }).limit(12).toArray()).map(({ _id, name, rating, text, editorial }) => ({ _id: String(_id), name, rating, text, editorial: Boolean(editorial) })));
    }));
    app.get('/admin/reviews', authenticate, allow('reviews:moderate'), asyncHandler(async (req, res) => {
        res.json((await reviews.find().sort({ createdAt: -1 }).toArray()).map(review => ({ ...review, _id: String(review._id) })));
    }));
    app.patch('/admin/reviews/:id', authenticate, allow('reviews:moderate'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid review ID.' });
        await reviews.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { approved: Boolean(req.body.approved) } });
        res.json({ updated: true });
    }));
    app.get('/admin/users', authenticate, allow('users:manage'), asyncHandler(async (req, res) => {
        res.json((await users.find({}, { projection: { email: 1, name: 1, role: 1, permissions: 1 } }).toArray()).map(user => ({ ...user, _id: String(user._id) })));
    }));
    app.put('/admin/users/:uid', authenticate, allow('users:manage'), asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const name = String(req.body.name || '').trim();
        const password = String(req.body.password || '');
        const role = ['customer', 'staff', 'admin'].includes(req.body.role) ? req.body.role : 'customer';
        const validUid = req.params.uid !== 'new' && ObjectId.isValid(req.params.uid);
        if (!/^\S+@\S+\.\S+$/.test(email) || !name || (password && (password.length < 8 || !/[0-9]/.test(password))) || (!validUid && !password))
            return res.status(400).json({ message: 'Enter a name, valid email, and an 8+ character password including a number for new staff.' });
        const permissions = Array.isArray(req.body.permissions) ? req.body.permissions.filter(permission =>
            ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate', 'users:manage'].includes(permission)) : [];
        const fields = { email, name, role, permissions, updatedAt: new Date() };
        if (password) fields.passwordHash = await hashPassword(password);
        const result = validUid
            ? await users.updateOne({ _id: new ObjectId(req.params.uid) }, { $set: fields })
            : await users.insertOne({ ...fields, createdAt: new Date() });
        if (validUid && result.matchedCount === 0) return res.status(404).json({ message: 'Staff account not found.' });
        res.json({ uid: validUid ? req.params.uid : String(result.insertedId), ...fields, passwordHash: undefined });
    }));

    app.use((error, req, res, next) => {
        console.error(error);
        res.status(500).json({ message: 'An unexpected server error occurred.' });
    });
    const server = app.listen(port, () => console.log(`Booka-Ru API listening on port ${port}`));
    const shutdown = async () => { server.close(); await client.close(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

startServer().catch(error => { console.error('Could not start the Booka-Ru API:', error.message); process.exitCode = 1; });
