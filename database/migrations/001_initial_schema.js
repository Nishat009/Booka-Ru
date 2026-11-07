// 001 — Initial schema for Booka-Ru (MongoDB).
//
// Creates every collection the API uses, attaches a $jsonSchema validator to each one,
// and builds the indexes the API queries rely on. Safe to run on an empty database and
// on a database that already holds data: existing collections are updated with `collMod`,
// and `validationLevel: 'moderate'` means documents that were stored before this
// migration are not re-checked until they are valid again.

const number = { bsonType: ['int', 'long', 'double', 'decimal'] };
const nullableDate = { bsonType: ['date', 'null'] };

const collections = {
    users: {
        required: ['email', 'passwordHash'],
        properties: {
            email: { bsonType: 'string', pattern: '^\\S+@\\S+\\.\\S+$', description: 'Lower-cased, unique login email.' },
            name: { bsonType: 'string' },
            passwordHash: { bsonType: 'string', description: 'scrypt "salt:hash" in hex. Never store plain passwords.' },
            role: { enum: ['customer', 'staff', 'admin'] },
            permissions: { bsonType: 'array', items: { bsonType: 'string' } },
            active: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
        }
    },
    sessions: {
        required: ['userId', 'tokenHash', 'expiresAt'],
        properties: {
            userId: { bsonType: 'objectId' },
            tokenHash: { bsonType: 'string', description: 'SHA-256 of the bearer token. The raw token is never stored.' },
            createdAt: { bsonType: 'date' },
            expiresAt: { bsonType: 'date' }
        }
    },
    books: {
        required: ['name', 'price', 'quantity'],
        properties: {
            seedKey: { bsonType: 'string', description: 'Stable key for seeded books; absent on books added in the admin.' },
            isbn: { bsonType: 'string' },
            name: { bsonType: 'string', minLength: 1 },
            author: { bsonType: 'string' },
            description: { bsonType: 'string' },
            imageURL: { bsonType: 'string' },
            category: { bsonType: 'string' },
            genre: { bsonType: 'string' },
            language: { bsonType: 'string' },
            price: { ...number, minimum: 0 },
            quantity: { ...number, minimum: 0, description: 'Copies in stock. Orders decrement it atomically.' },
            active: { bsonType: 'bool', description: 'false = removed from the storefront (soft delete).' },
            createdAt: { bsonType: 'date' }
        }
    },
    orders: {
        required: ['userId', 'bookId', 'quantity', 'price', 'total', 'status', 'createdAt'],
        properties: {
            userId: { bsonType: 'string' },
            email: { bsonType: 'string' },
            customerName: { bsonType: 'string' },
            bookId: { bsonType: 'string' },
            name: { bsonType: 'string', description: 'Book name snapshot at order time.' },
            imageURL: { bsonType: 'string' },
            quantity: { ...number, minimum: 1, maximum: 99 },
            price: { ...number, minimum: 0 },
            total: { ...number, minimum: 0 },
            status: { enum: ['new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled'] },
            supportStaff: { bsonType: ['object', 'null'] },
            shippingAddress: { bsonType: 'string', maxLength: 400 },
            notes: { bsonType: 'string' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
        }
    },
    orderMessages: {
        required: ['orderId', 'senderId', 'text', 'createdAt'],
        properties: {
            orderId: { bsonType: 'string' },
            senderId: { bsonType: 'string' },
            senderName: { bsonType: 'string' },
            senderRole: { enum: ['customer', 'staff', 'admin'] },
            text: { bsonType: 'string', minLength: 1, maxLength: 1600 },
            createdAt: { bsonType: 'date' }
        }
    },
    reviews: {
        required: ['rating', 'text', 'approved'],
        properties: {
            seedKey: { bsonType: 'string' },
            userId: { bsonType: 'string' },
            name: { bsonType: 'string' },
            email: { bsonType: 'string' },
            rating: { ...number, minimum: 1, maximum: 5 },
            text: { bsonType: 'string', minLength: 1, maxLength: 800 },
            approved: { bsonType: 'bool' },
            editorial: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' }
        }
    },
    popups: {
        required: ['imageURL', 'active'],
        properties: {
            seedKey: { bsonType: 'string' },
            title: { bsonType: 'string', maxLength: 120 },
            imageURL: { bsonType: 'string', minLength: 1 },
            linkURL: { bsonType: 'string' },
            active: { bsonType: 'bool' },
            startsAt: nullableDate,
            endsAt: nullableDate,
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
        }
    }
};

const indexes = {
    users: [
        { key: { email: 1 }, name: 'email_unique', unique: true }
    ],
    sessions: [
        { key: { tokenHash: 1 }, name: 'tokenHash_unique', unique: true },
        { key: { userId: 1 }, name: 'userId' },
        // MongoDB removes a session document automatically once expiresAt has passed.
        { key: { expiresAt: 1 }, name: 'expiresAt_ttl', expireAfterSeconds: 0 }
    ],
    books: [
        { key: { seedKey: 1 }, name: 'seedKey_unique', unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } },
        { key: { active: 1, createdAt: -1 }, name: 'active_createdAt' },
        { key: { category: 1, genre: 1, language: 1 }, name: 'category_genre_language' }
    ],
    orders: [
        { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt' },
        { key: { createdAt: -1 }, name: 'createdAt' }
    ],
    orderMessages: [
        { key: { orderId: 1, createdAt: 1 }, name: 'orderId_createdAt' }
    ],
    reviews: [
        { key: { seedKey: 1 }, name: 'seedKey_unique', unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } },
        { key: { approved: 1, createdAt: -1 }, name: 'approved_createdAt' }
    ],
    popups: [
        { key: { seedKey: 1 }, name: 'seedKey_unique', unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } },
        { key: { active: 1, updatedAt: -1 }, name: 'active_updatedAt' }
    ]
};

async function up(db, log = console.log) {
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
    for (const [name, schema] of Object.entries(collections)) {
        const options = { validator: { $jsonSchema: { bsonType: 'object', ...schema } }, validationLevel: 'moderate', validationAction: 'error' };
        if (!existing.has(name)) { await db.createCollection(name, options); continue; }
        try {
            await db.command({ collMod: name, ...options });
        } catch (error) {
            // A database user with only the readWrite role may not run collMod. The collection
            // keeps working without a validator; the API still validates every write.
            if (error.code !== 13) throw error;
            log(`Skipped validator on existing collection "${name}": the database user lacks the collMod privilege.`);
        }
    }
    for (const [name, specs] of Object.entries(indexes)) {
        await db.collection(name).createIndexes(specs);
    }
}

module.exports = {
    id: '001_initial_schema',
    description: 'Create collections with validators and indexes',
    up,
    collections,
    indexes
};
