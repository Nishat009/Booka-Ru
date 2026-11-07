require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const { buildInvoice } = require('./invoice');
const { runMigrations } = require('../database/migrate');
const { seedCatalog } = require('./seed-catalog');
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
// Every success is HTTP 200 { success, message, data }; every failure is HTTP 422 { success, errors: [{ code, message, field? }] }.
const ok = (res, data = null, message = '') => res.status(200).json({ success: true, message, data });
const err = (code, message, field) => ({ code, message, ...(field ? { field } : {}) });
const fail = (res, ...errors) => res.status(422).json({ success: false, errors: errors.flat() });
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function startServer() {
    if (!uri) throw new Error('MONGODB_URI must be set in the server environment.');
    const client = new MongoClient(uri);
    await client.connect();
    const database = client.db(databaseName);
    // Create collections, validators and indexes on a fresh database (database/migrations/).
    // A failure is logged but does not stop the API, so an existing deployment keeps serving.
    await runMigrations(database).catch(error => console.error('Database migration failed:', error.message));
    // Opt-in for demo deployments: load the starter catalogue when the shop has no books at all,
    // so a fresh database never shows an empty storefront. Never touches a catalogue that has books.
    if (process.env.SEED_CATALOG_IF_EMPTY === 'true' && await database.collection('books').countDocuments({}, { limit: 1 }) === 0) {
        await seedCatalog(database)
            .then(summary => console.log(`Empty catalogue: loaded ${summary}.`))
            .catch(error => console.error('Starter catalogue seed failed:', error.message));
    }
    const books = database.collection('books');
    const orders = database.collection('orders');
    const users = database.collection('users');
    const sessions = database.collection('sessions');
    const reviews = database.collection('reviews');
    const messages = database.collection('orderMessages');
    const popups = database.collection('popups');
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    const sha = token => crypto.createHash('sha256').update(token).digest('hex');
    const permissionList = ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate', 'users:manage', 'popups:manage'];
    const roleOf = profile => profile.email === adminEmail ? 'admin' : (profile.role || 'customer');
    const accountOf = profile => { const role = roleOf(profile); return { uid: String(profile._id), email: profile.email, name: profile.name || profile.email, role, permissions: role === 'admin' ? ['*'] : (profile.permissions || []) }; };
    const startSession = async profile => {
        const token = crypto.randomBytes(32).toString('hex');
        await sessions.insertOne({ userId: profile._id, tokenHash: sha(token), createdAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) });
        return { token, user: accountOf(profile) };
    };

    const authenticate = asyncHandler(async (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return fail(res, err('AUTH_REQUIRED', 'Sign in to continue.'));
        const session = await sessions.findOne({ tokenHash: sha(token), expiresAt: { $gt: new Date() } });
        if (!session) return fail(res, err('SESSION_EXPIRED', 'Your session expired. Please sign in again.'));
        const profile = await users.findOne({ _id: session.userId });
        if (!profile) return fail(res, err('ACCOUNT_NOT_FOUND', 'Account not found. Please sign in again.'));
        if (profile.active === false) return fail(res, err('ACCOUNT_DEACTIVATED', 'This account has been deactivated. Contact an administrator.'));
        req.user = accountOf(profile);
        next();
    });
    const allow = (...permissions) => (req, res, next) => {
        if (req.user?.role === 'admin' || permissions.some(permission => req.user?.permissions?.includes(permission))) return next();
        return fail(res, err('FORBIDDEN', 'You do not have permission to do that.'));
    };
    const adminOnly = (req, res, next) => req.user?.role === 'admin' ? next() : fail(res, err('ADMIN_ONLY', 'Only an administrator can do that.'));
    const validId = value => ObjectId.isValid(value);
    const publicBook = book => ({ ...book, _id: String(book._id) });
    const withId = doc => ({ ...doc, _id: String(doc._id) });
    const hasText = value => String(value ?? '').trim().length > 0;
    const isPassword = value => value.length >= 8 && /[0-9]/.test(value);
    // orders:manage = view and update every order. support:handle = read-only view of every order and its invoice.
    const canViewAllOrders = user => user.role === 'admin' || user.permissions.includes('orders:manage') || user.permissions.includes('support:handle');
    const canSeeOrder = (user, order) => order.userId === user.uid || canViewAllOrders(user);
    // Support calls and chat belong to the main admin; staff can only view orders. Customers chat on their own orders.
    const canChat = (user, order) => order.userId === user.uid || user.role === 'admin';

    app.get('/', (req, res) => ok(res, { name: 'Booka-Ru API', status: 'running' }));
    app.get('/auth/me', authenticate, (req, res) => ok(res, req.user));
    app.post('/auth/register', asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const name = String(req.body.name || '').trim();
        const errors = [];
        if (!name) errors.push(err('NAME_REQUIRED', 'Enter your name.', 'name'));
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(err('EMAIL_INVALID', 'Enter a valid email address.', 'email'));
        if (!isPassword(password)) errors.push(err('PASSWORD_WEAK', 'Use a password of 8+ characters including a number.', 'password'));
        if (errors.length) return fail(res, errors);
        if (await users.findOne({ email })) return fail(res, err('EMAIL_TAKEN', 'An account with this email already exists.', 'email'));
        const result = await users.insertOne({ email, name, passwordHash: await hashPassword(password), role: 'customer', permissions: [], active: true, createdAt: new Date() });
        ok(res, { uid: String(result.insertedId) }, 'Account created.');
    }));
    app.post('/auth/login', asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const user = await users.findOne({ email });
        if (!user || !await verifyPassword(String(req.body.password || ''), user.passwordHash))
            return fail(res, err('INVALID_CREDENTIALS', 'Email or password is incorrect.'));
        if (user.active === false) return fail(res, err('ACCOUNT_DEACTIVATED', 'This account has been deactivated. Contact an administrator.'));
        ok(res, await startSession(user));
    }));
    app.post('/auth/demo-login/:role', asyncHandler(async (req, res) => {
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_LOGINS !== 'true')
            return fail(res, err('DEMO_DISABLED', 'Demo sign-in is not enabled.'));
        const profiles = {
            admin: { email: adminEmail },
            staff: { email: 'bookaru.staff.test@example.com' },
            customer: { email: 'bookaru.customer.test@example.com' }
        };
        const selected = profiles[req.params.role];
        if (!selected?.email) return fail(res, err('DEMO_NOT_FOUND', 'Demo profile not found.'));
        const profile = await users.findOne({ email: selected.email });
        if (!profile) return fail(res, err('DEMO_NOT_SEEDED', 'Demo profile is not set up. Run the demo account seeder.'));
        if (profile.active === false) return fail(res, err('ACCOUNT_DEACTIVATED', 'This account has been deactivated. Contact an administrator.'));
        ok(res, await startSession(profile));
    }));
    app.post('/auth/logout', authenticate, asyncHandler(async (req, res) => {
        await sessions.deleteOne({ tokenHash: sha(req.headers.authorization.replace(/^Bearer\s+/i, '')) });
        ok(res, null, 'Signed out.');
    }));

    app.get('/books', asyncHandler(async (req, res) => {
        const query = { active: { $ne: false } };
        if (req.query.category) query.category = req.query.category;
        if (req.query.genre) query.genre = req.query.genre;
        if (req.query.language) query.language = req.query.language;
        if (req.query.q) query.name = { $regex: String(req.query.q).slice(0, 80), $options: 'i' };
        ok(res, (await books.find(query).sort({ createdAt: -1 }).toArray()).map(publicBook));
    }));
    app.get('/books/:id', asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('BOOK_ID_INVALID', 'Invalid book ID.'));
        const book = await books.findOne({ _id: new ObjectId(req.params.id), active: { $ne: false } });
        return book ? ok(res, publicBook(book)) : fail(res, err('BOOK_NOT_FOUND', 'Book not found.'));
    }));
    const bookErrors = body => {
        const errors = [];
        if (!hasText(body.name)) errors.push(err('BOOK_NAME_REQUIRED', 'Enter the book name.', 'name'));
        if (!hasText(body.price) || !Number.isFinite(Number(body.price)) || Number(body.price) < 0) errors.push(err('BOOK_PRICE_INVALID', 'Enter a valid price.', 'price'));
        if (!hasText(body.quantity) || !Number.isInteger(Number(body.quantity)) || Number(body.quantity) < 0) errors.push(err('BOOK_QUANTITY_INVALID', 'Enter a valid whole-number quantity.', 'quantity'));
        return errors;
    };
    app.post('/books', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        const errors = bookErrors(req.body);
        if (errors.length) return fail(res, errors);
        const { name, price, quantity } = req.body;
        const book = { name: String(name).trim(), description: String(req.body.description || ''), imageURL: String(req.body.imageURL || ''),
            price: Number(price), quantity: Number(quantity), category: String(req.body.category || 'General'), genre: String(req.body.genre || 'General'),
            language: String(req.body.language || 'English'), author: String(req.body.author || ''), active: true, createdAt: new Date() };
        const result = await books.insertOne(book);
        ok(res, { ...book, _id: String(result.insertedId) }, 'Book added to the collection.');
    }));
    app.put('/books/:id', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('BOOK_ID_INVALID', 'Invalid book ID.'));
        const errors = bookErrors(req.body);
        if (errors.length) return fail(res, errors);
        const fields = ['name', 'description', 'imageURL', 'category', 'genre', 'language', 'author'];
        const update = {};
        fields.forEach(field => { if (req.body[field] !== undefined) update[field] = String(req.body[field]); });
        update.price = Number(req.body.price);
        update.quantity = Number(req.body.quantity);
        const result = await books.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        return result.matchedCount ? ok(res, { updated: true }, 'Book updated.') : fail(res, err('BOOK_NOT_FOUND', 'Book not found.'));
    }));
    app.delete('/books/:id', authenticate, allow('books:write'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('BOOK_ID_INVALID', 'Invalid book ID.'));
        const result = await books.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { active: false } });
        ok(res, { deleted: result.modifiedCount > 0 }, 'Book removed.');
    }));

    // Promotional pop-up shown to visitors when the site opens. Managed from the admin workspace.
    const isHttpUrl = value => /^(https?:\/\/|\/)[^\s]*$/i.test(value);
    const popupFields = body => {
        const imageURL = String(body.imageURL || '').trim(), linkURL = String(body.linkURL || '').trim();
        const errors = [];
        if (!imageURL || !isHttpUrl(imageURL)) errors.push(err('POPUP_IMAGE_INVALID', 'Add a valid image URL for the pop-up.', 'imageURL'));
        if (linkURL && !isHttpUrl(linkURL)) errors.push(err('POPUP_LINK_INVALID', 'The link must start with http://, https:// or /.', 'linkURL'));
        const date = value => { const parsed = value ? new Date(value) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null; };
        const startsAt = date(body.startsAt), endsAt = date(body.endsAt);
        if (startsAt && endsAt && endsAt < startsAt) errors.push(err('POPUP_DATES_INVALID', 'The end date must be after the start date.', 'endsAt'));
        return { errors, fields: { title: String(body.title || '').trim().slice(0, 120), imageURL, linkURL, active: body.active !== false && body.active !== 'false', startsAt, endsAt } };
    };
    app.get('/popups/active', asyncHandler(async (req, res) => {
        const now = new Date();
        const popup = await popups.findOne({ active: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] }, { sort: { updatedAt: -1 } });
        ok(res, popup ? withId(popup) : null);
    }));
    app.get('/admin/popups', authenticate, allow('popups:manage'), asyncHandler(async (req, res) => {
        ok(res, (await popups.find({}).sort({ updatedAt: -1 }).toArray()).map(withId));
    }));
    app.post('/admin/popups', authenticate, allow('popups:manage'), asyncHandler(async (req, res) => {
        const { fields, errors } = popupFields(req.body);
        if (errors.length) return fail(res, errors);
        const popup = { ...fields, createdAt: new Date(), updatedAt: new Date() };
        const result = await popups.insertOne(popup);
        ok(res, withId({ ...popup, _id: result.insertedId }), 'Pop-up created. Visitors will see it when they open the site.');
    }));
    app.put('/admin/popups/:id', authenticate, allow('popups:manage'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('POPUP_ID_INVALID', 'Invalid pop-up ID.'));
        const { fields, errors } = popupFields(req.body);
        if (errors.length) return fail(res, errors);
        const result = await popups.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { ...fields, updatedAt: new Date() } });
        return result.matchedCount ? ok(res, { updated: true }, 'Pop-up updated.') : fail(res, err('POPUP_NOT_FOUND', 'Pop-up not found.'));
    }));
    app.patch('/admin/popups/:id', authenticate, allow('popups:manage'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('POPUP_ID_INVALID', 'Invalid pop-up ID.'));
        const active = Boolean(req.body.active);
        const result = await popups.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { active, updatedAt: new Date() } });
        return result.matchedCount ? ok(res, { updated: true }, active ? 'Pop-up is now visible.' : 'Pop-up hidden.') : fail(res, err('POPUP_NOT_FOUND', 'Pop-up not found.'));
    }));
    app.delete('/admin/popups/:id', authenticate, allow('popups:manage'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('POPUP_ID_INVALID', 'Invalid pop-up ID.'));
        const result = await popups.deleteOne({ _id: new ObjectId(req.params.id) });
        ok(res, { deleted: result.deletedCount > 0 }, 'Pop-up deleted.');
    }));

    app.post('/orders', authenticate, asyncHandler(async (req, res) => {
        const bookId = req.body.bookId || req.body.id;
        const quantity = Number(req.body.quantity);
        const shippingAddress = String(req.body.shippingAddress || '').trim();
        const errors = [];
        if (!validId(bookId)) errors.push(err('BOOK_ID_INVALID', 'Choose a valid book.', 'bookId'));
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) errors.push(err('QUANTITY_INVALID', 'Choose between 1 and 99 copies.', 'quantity'));
        if (!shippingAddress) errors.push(err('ADDRESS_REQUIRED', 'Enter a delivery address.', 'shippingAddress'));
        if (errors.length) return fail(res, errors);
        const book = await books.findOne({ _id: new ObjectId(bookId), active: { $ne: false } });
        if (!book) return fail(res, err('BOOK_NOT_FOUND', 'Book not found.'));
        const stockUpdate = await books.updateOne({ _id: book._id, active: { $ne: false }, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } });
        if (!stockUpdate.modifiedCount) return fail(res, err('OUT_OF_STOCK', 'Not enough copies are in stock.', 'quantity'));
        const order = { userId: req.user.uid, email: req.user.email, customerName: req.user.name, bookId: String(book._id), name: book.name,
            imageURL: book.imageURL || '', quantity, price: Number(book.price), total: Number(book.price) * quantity,
            createdAt: new Date(), status: 'new', supportStaff: null, shippingAddress: shippingAddress.slice(0, 400), notes: '' };
        let result;
        try { result = await orders.insertOne(order); }
        catch (error) { await books.updateOne({ _id: book._id }, { $inc: { quantity } }); throw error; }
        ok(res, { ...order, _id: String(result.insertedId) }, 'Order placed. You can follow it in My orders.');
    }));
    app.get('/orders', authenticate, asyncHandler(async (req, res) => {
        // ?mine=1 always returns only the signed-in account's own orders (the "My orders" page).
        const query = canViewAllOrders(req.user) && !req.query.mine ? {} : { userId: req.user.uid };
        ok(res, (await orders.find(query).sort({ createdAt: -1 }).toArray()).map(withId));
    }));
    app.patch('/orders/:id', authenticate, allow('orders:manage'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('ORDER_ID_INVALID', 'Invalid order ID.'));
        const allowedStatuses = ['new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled'];
        if (!allowedStatuses.includes(req.body.status)) return fail(res, err('STATUS_INVALID', 'Choose a valid order status.', 'status'));
        if (req.body.status === 'on-call' && req.user.role !== 'admin') return fail(res, err('ADMIN_ONLY', 'Only an administrator can take an order on call.'));
        const update = { updatedAt: new Date(), status: req.body.status };
        if (req.body.status === 'on-call') update.supportStaff = { uid: req.user.uid, email: req.user.email, name: req.user.name };
        const result = await orders.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        return result.matchedCount ? ok(res, { updated: true }, req.body.status === 'on-call' ? 'Order assigned to you for a support call.' : 'Order status updated.') : fail(res, err('ORDER_NOT_FOUND', 'Order not found.'));
    }));
    app.get('/orders/:id/messages', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('ORDER_ID_INVALID', 'Invalid order ID.'));
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return fail(res, err('ORDER_NOT_FOUND', 'Order not found.'));
        if (!canChat(req.user, order)) return fail(res, err('CHAT_NOT_ASSIGNED', 'This support conversation is not assigned to you.'));
        ok(res, (await messages.find({ orderId: req.params.id }).sort({ createdAt: 1 }).toArray()).map(withId));
    }));
    app.post('/orders/:id/messages', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('ORDER_ID_INVALID', 'Invalid order ID.'));
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return fail(res, err('ORDER_NOT_FOUND', 'Order not found.'));
        if (!canChat(req.user, order)) return fail(res, err('CHAT_NOT_ASSIGNED', 'This support conversation is not assigned to you.'));
        const text = String(req.body.text || '').trim().slice(0, 1600);
        if (!text) return fail(res, err('MESSAGE_EMPTY', 'Message cannot be empty.', 'text'));
        const message = { orderId: req.params.id, senderId: req.user.uid, senderName: req.user.name, senderRole: req.user.role, text, createdAt: new Date() };
        const result = await messages.insertOne(message);
        ok(res, { ...message, _id: String(result.insertedId) });
    }));
    // The invoice is the only non-JSON success: a 200 response carrying the PDF bytes. Failures stay 422 JSON.
    app.get('/orders/:id/invoice', authenticate, asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('ORDER_ID_INVALID', 'Invalid order ID.'));
        const order = await orders.findOne({ _id: new ObjectId(req.params.id) });
        if (!order) return fail(res, err('ORDER_NOT_FOUND', 'Order not found.'));
        if (!canSeeOrder(req.user, order)) return fail(res, err('INVOICE_FORBIDDEN', 'This invoice is not available to your account.'));
        res.status(200);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="bookaru-invoice-${order._id}.pdf"`);
        const pdf = buildInvoice(order);
        pdf.pipe(res);
        pdf.end();
    }));

    app.post('/reviews', authenticate, asyncHandler(async (req, res) => {
        const rating = Number(req.body.rating);
        const errors = [];
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push(err('RATING_INVALID', 'Choose a rating from 1 to 5.', 'rating'));
        if (!hasText(req.body.text)) errors.push(err('REVIEW_TEXT_REQUIRED', 'Write a few words about your experience.', 'text'));
        if (errors.length) return fail(res, errors);
        const review = { userId: req.user.uid, name: req.user.name, email: req.user.email, rating,
            text: String(req.body.text).trim().slice(0, 800), createdAt: new Date(), approved: false };
        const result = await reviews.insertOne(review);
        ok(res, { id: String(result.insertedId) }, 'Review sent.');
    }));
    app.get('/reviews', asyncHandler(async (req, res) => {
        ok(res, (await reviews.find({ approved: true }).sort({ createdAt: -1 }).limit(12).toArray()).map(({ _id, name, rating, text, editorial }) => ({ _id: String(_id), name, rating, text, editorial: Boolean(editorial) })));
    }));
    app.get('/admin/reviews', authenticate, allow('reviews:moderate'), asyncHandler(async (req, res) => {
        ok(res, (await reviews.find().sort({ createdAt: -1 }).toArray()).map(withId));
    }));
    app.patch('/admin/reviews/:id', authenticate, allow('reviews:moderate'), asyncHandler(async (req, res) => {
        if (!validId(req.params.id)) return fail(res, err('REVIEW_ID_INVALID', 'Invalid review ID.'));
        const approved = Boolean(req.body.approved);
        const result = await reviews.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { approved } });
        return result.matchedCount ? ok(res, { updated: true }, approved ? 'Review approved.' : 'Review hidden.') : fail(res, err('REVIEW_NOT_FOUND', 'Review not found.'));
    }));

    // Team access. Staff with users:manage (team managers) can create staff accounts and edit staff members,
    // but only within limits: they never see or edit customers or other team managers, never reset an existing
    // account's password, and can only grant permissions they hold themselves. Only an administrator can grant
    // users:manage, touch the admin account, reset passwords, or deactivate/reactivate anyone.
    app.get('/admin/users', authenticate, allow('users:manage'), asyncHandler(async (req, res) => {
        const list = (await users.find({}, { projection: { email: 1, name: 1, role: 1, permissions: 1, active: 1 } }).toArray()).map(user => ({ ...user, role: roleOf(user), active: user.active !== false, _id: String(user._id) }));
        ok(res, req.user.role === 'admin' ? list : list.filter(user => user.role === 'staff'));
    }));
    app.put('/admin/users/:uid', authenticate, allow('users:manage'), asyncHandler(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const name = String(req.body.name || '').trim();
        const password = String(req.body.password || '');
        const role = ['customer', 'staff'].includes(req.body.role) ? req.body.role : 'customer';
        const validUid = req.params.uid !== 'new' && ObjectId.isValid(req.params.uid);
        const errors = [];
        if (!name) errors.push(err('NAME_REQUIRED', 'Enter a name.', 'name'));
        if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(err('EMAIL_INVALID', 'Enter a valid email address.', 'email'));
        if (password ? !isPassword(password) : !validUid) errors.push(err('PASSWORD_WEAK', 'Use a password of 8+ characters including a number.', 'password'));
        const permissions = Array.isArray(req.body.permissions) ? req.body.permissions.filter(permission => permissionList.includes(permission)) : [];
        if (req.user.role !== 'admin' && permissions.includes('users:manage')) errors.push(err('GRANT_FORBIDDEN', 'Only an administrator can grant team access management.', 'permissions'));
        if (errors.length) return fail(res, errors);
        const target = validUid ? await users.findOne({ _id: new ObjectId(req.params.uid) }) : null;
        if (validUid && !target) return fail(res, err('STAFF_NOT_FOUND', 'Staff account not found.'));
        const touchesAdmin = (target && roleOf(target) === 'admin') || email === adminEmail;
        if (touchesAdmin && req.user.role !== 'admin') return fail(res, err('ADMIN_PROTECTED', 'Only an administrator can change an administrator account.'));
        if (req.user.role !== 'admin') {
            const targetPermissions = target?.permissions || [];
            if (target && roleOf(target) !== 'staff') return fail(res, err('STAFF_ONLY', 'Team managers can only edit staff accounts.'));
            if (target && targetPermissions.includes('users:manage')) return fail(res, err('ADMIN_ONLY', 'Only an administrator can change another team manager.'));
            if (target && password) return fail(res, err('PASSWORD_RESET_ADMIN_ONLY', 'Only an administrator can reset an existing account’s password.', 'password'));
            if (permissions.some(permission => !req.user.permissions.includes(permission) && !targetPermissions.includes(permission)))
                return fail(res, err('GRANT_FORBIDDEN', 'You can only grant permissions that you have yourself.', 'permissions'));
        }
        const duplicate = await users.findOne({ email, ...(target ? { _id: { $ne: target._id } } : {}) });
        if (duplicate) return fail(res, err('EMAIL_TAKEN', 'Another account already uses this email.', 'email'));
        const fields = { email, name, role: target?.role === 'admin' ? 'admin' : role, permissions, updatedAt: new Date() };
        if (password) fields.passwordHash = await hashPassword(password);
        let uid = req.params.uid;
        if (target) await users.updateOne({ _id: target._id }, { $set: fields });
        else uid = String((await users.insertOne({ ...fields, active: true, createdAt: new Date() })).insertedId);
        ok(res, { uid, ...fields, passwordHash: undefined }, 'Team account saved. Share the temporary password securely.');
    }));
    app.patch('/admin/users/:uid/status', authenticate, adminOnly, asyncHandler(async (req, res) => {
        if (!validId(req.params.uid)) return fail(res, err('STAFF_ID_INVALID', 'Invalid account ID.'));
        const active = Boolean(req.body.active);
        const target = await users.findOne({ _id: new ObjectId(req.params.uid) });
        if (!target) return fail(res, err('STAFF_NOT_FOUND', 'Staff account not found.'));
        if (String(target._id) === req.user.uid) return fail(res, err('SELF_DEACTIVATE', 'You cannot deactivate your own account.'));
        if (roleOf(target) === 'admin') return fail(res, err('ADMIN_PROTECTED', 'Administrator accounts cannot be deactivated.'));
        await users.updateOne({ _id: target._id }, { $set: { active, updatedAt: new Date() } });
        if (!active) await sessions.deleteMany({ userId: target._id });
        ok(res, { uid: String(target._id), active }, active ? 'Account reactivated.' : 'Account deactivated and signed out.');
    }));

    app.use((error, req, res, next) => {
        console.error(error);
        res.status(500).json({ success: false, errors: [err('SERVER_ERROR', 'An unexpected server error occurred.')] });
    });
    const server = app.listen(port, () => console.log(`Booka-Ru API listening on port ${port}`));
    const shutdown = async () => { server.close(); await client.close(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

startServer().catch(error => { console.error('Could not start the Booka-Ru API:', error.message); process.exitCode = 1; });
