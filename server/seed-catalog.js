require('dotenv').config();
const { MongoClient } = require('mongodb');
const coverCatalog = require('../client/src/bookCovers.json');

const catalog = [
  ['9780547928227','The Hobbit','J.R.R. Tolkien','Fantasy','Classic Fantasy',520],
  ['9780590353427','Harry Potter and the Sorcerer’s Stone','J.K. Rowling','Fantasy','Fantasy Adventure',480],
  ['9780064471046','The Lion, the Witch and the Wardrobe','C.S. Lewis','Fantasy','Fairy Tale',390],
  ['9781503222687','Alice’s Adventures in Wonderland','Lewis Carroll','Fantasy','Fairy Tale',280],
  ['9781503214133','Peter Pan','J.M. Barrie','Fantasy','Fairy Tale',310],
  ['9780156012195','The Little Prince','Antoine de Saint-Exupéry','Fantasy','Fairy Tale',350],
  ['9780142410370','Matilda','Roald Dahl','Children','Fantasy Adventure',380],
  ['9780142410318','Charlie and the Chocolate Factory','Roald Dahl','Children','Fantasy Adventure',390],
  ['9780141321060','The Secret Garden','Frances Hodgson Burnett','Children','Classic Fiction',340],
  ['9780141321138','The Wind in the Willows','Kenneth Grahame','Children','Classic Fiction',360],
  ['9780486454646','Grimm’s Fairy Tales','Brothers Grimm','Fantasy','Fairy Tale',420],
  ['9780451531370','Andersen’s Fairy Tales','Hans Christian Andersen','Fantasy','Fairy Tale',410],
  ['9780192735567','Pippi Longstocking','Astrid Lindgren','Children','Adventure',360],
  ['9780064400558','Charlotte’s Web','E.B. White','Children','Classic Fiction',370],
  ['9780394820378','The Phantom Tollbooth','Norton Juster','Fantasy','Fantasy Adventure',400],
  ['9780140386332','The Neverending Story','Michael Ende','Fantasy','Fantasy Adventure',490],
  ['9780064410342','Howl’s Moving Castle','Diana Wynne Jones','Fantasy','Fantasy Romance',450],
  ['9780763680893','The Tale of Despereaux','Kate DiCamillo','Children','Fairy Tale',390],
  ['9780786838653','The Lightning Thief','Rick Riordan','Fantasy','Fantasy Adventure',520],
  ['9780312367541','A Wrinkle in Time','Madeleine L’Engle','Fantasy','Science Fantasy',400],
  ['9780375869020','Wonder','R.J. Palacio','Children','Contemporary Fiction',450],
  ['9780380807345','Coraline','Neil Gaiman','Fantasy','Dark Fantasy',420],
  ['9780061689246','Stardust','Neil Gaiman','Fantasy','Fairy Tale',470],
  ['9780062315007','The Alchemist','Paulo Coelho','Fiction','Adventure',390],
  ['9780141439518','Pride and Prejudice','Jane Austen','Fiction','Romance',330],
  ['9780142437179','The Adventures of Huckleberry Finn','Mark Twain','Fiction','Adventure',350],
  ['9780061120084','To Kill a Mockingbird','Harper Lee','Fiction','Classic Fiction',420],
  ['9780451524935','1984','George Orwell','Fiction','Dystopian',380],
  ['9780140177398','Of Mice and Men','John Steinbeck','Fiction','Classic Fiction',300],
  ['9780060850524','Brave New World','Aldous Huxley','Fiction','Science Fiction',400]
].map(([isbn, name, author, category, genre, price]) => ({
  seedKey: `isbn-${isbn}`,
  isbn,
  name,
  author,
  category,
  genre,
  language: 'English',
  description: `${name} by ${author}. A much-loved ${genre.toLowerCase()} for readers who enjoy imaginative storytelling.`,
  imageURL: `/covers/${coverCatalog[name] || isbn}.jpg`,
  price,
  quantity: 8,
  active: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z')
}));

const banglaCatalog = [
  ['bangla-pather-panchali', 'পথের পাঁচালী', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'বাংলা সাহিত্য', 'উপন্যাস', 320,
    'নিশ্চিন্দিপুরের গ্রামীণ জীবন, অপু ও দুর্গার শৈশব এবং প্রকৃতির সঙ্গে মানুষের সম্পর্কের কালজয়ী উপন্যাস।'],
  ['bangla-devdas', 'দেবদাস', 'শরৎচন্দ্র চট্টোপাধ্যায়', 'বাংলা সাহিত্য', 'সামাজিক উপন্যাস', 280,
    'প্রেম, আত্মসংঘাত ও সামাজিক বাধার ভেতর দিয়ে এগিয়ে চলা শরৎচন্দ্রের বহুলপঠিত উপন্যাস।'],
  ['bangla-srikanta', 'শ্রীকান্ত', 'শরৎচন্দ্র চট্টোপাধ্যায়', 'বাংলা সাহিত্য', 'ভ্রমণ ও জীবন', 420,
    'পথিক শ্রীকান্তের ভ্রমণ, সম্পর্ক ও জীবনের অভিজ্ঞতায় সমৃদ্ধ চার খণ্ডের উপন্যাস।'],
  ['bangla-aranyak', 'আরণ্যক', 'বিভূতিভূষণ বন্দ্যোপাধ্যায়', 'বাংলা সাহিত্য', 'প্রকৃতি ও জীবন', 350,
    'বিহারের অরণ্যে কাটানো দিনের স্মৃতি, প্রকৃতি ও মানুষের জীবনের এক অনন্য সাহিত্যিক আখ্যান।'],
  ['bangla-feluda', 'সোনার কেল্লা', 'সত্যজিৎ রায়', 'বাংলা সাহিত্য', 'রহস্য ও গোয়েন্দা', 300,
    'ফেলুদা, তোপসে ও জটায়ুর সঙ্গে রাজস্থানের পথে ইতিহাস ও রহস্যে ভরা এক রোমাঞ্চকর অভিযান।']
].map(([seedKey, name, author, category, genre, price, description]) => ({
  seedKey,
  name,
  author,
  category,
  genre,
  language: 'বাংলা',
  description,
  imageURL: `/covers/${seedKey}.jpg`,
  price,
  quantity: 8,
  active: true,
  createdAt: new Date('2025-01-03T00:00:00.000Z')
}));


// Books for the extra shelves. No local cover art, so the storefront shows a typographic cover.
const extraCatalog = [
  ['mystery-hound-baskervilles','The Hound of the Baskervilles','Arthur Conan Doyle','Mystery & Thriller','Detective',320],
  ['mystery-murder-orient-express','Murder on the Orient Express','Agatha Christie','Mystery & Thriller','Detective',380],
  ['mystery-girl-dragon-tattoo','The Girl with the Dragon Tattoo','Stieg Larsson','Mystery & Thriller','Crime',460],
  ['scifi-dune','Dune','Frank Herbert','Science Fiction','Space Opera',550],
  ['scifi-foundation','Foundation','Isaac Asimov','Science Fiction','Space Opera',420],
  ['scifi-martian','The Martian','Andy Weir','Science Fiction','Hard Science Fiction',450],
  ['romance-jane-eyre','Jane Eyre','Charlotte Brontë','Romance','Classic Romance',340],
  ['romance-persuasion','Persuasion','Jane Austen','Romance','Classic Romance',310],
  ['history-diary-young-girl','The Diary of a Young Girl','Anne Frank','History & Biography','Memoir',360],
  ['history-sapiens','Sapiens','Yuval Noah Harari','History & Biography','World History',520],
  ['history-long-walk-freedom','Long Walk to Freedom','Nelson Mandela','History & Biography','Autobiography',480],
  ['selfhelp-atomic-habits','Atomic Habits','James Clear','Self-Help','Habits',450],
  ['selfhelp-deep-work','Deep Work','Cal Newport','Self-Help','Productivity',420],
  ['selfhelp-mans-search','Man’s Search for Meaning','Viktor E. Frankl','Self-Help','Personal Growth',340],
  ['poetry-gitanjali','Gitanjali','Rabindranath Tagore','Poetry','Classic Poetry',260],
  ['poetry-leaves-of-grass','Leaves of Grass','Walt Whitman','Poetry','Collected Poems',330]
].map(([seedKey, name, author, category, genre, price]) => ({
  seedKey, name, author, category, genre,
  language: 'English',
  description: `${name} by ${author}. A well-loved ${genre.toLowerCase()} title from our ${category} shelf.`,
  imageURL: '',
  price,
  quantity: 8,
  active: true,
  createdAt: new Date('2024-12-20T00:00:00.000Z')
}));

const editorialReviews = [
  { seedKey: 'bookaru-editorial-hobbit', name: 'Booka-Ru editors', rating: 5, text: 'A cozy, generous adventure with riddles, dragons, and a wonderfully unlikely hero. A lovely place to begin a fantasy reading journey.' },
  { seedKey: 'bookaru-editorial-secret-garden', name: 'Booka-Ru editors', rating: 5, text: 'The Secret Garden turns curiosity and friendship into a quiet kind of magic. Its hopeful mood makes this a story readers return to.' },
  { seedKey: 'bookaru-editorial-little-prince', name: 'Booka-Ru editors', rating: 5, text: 'A small, thoughtful fable about friendship and seeing with your heart. The Little Prince rewards both a quick read and a slower return.' },
  { seedKey: 'bookaru-editorial-howls', name: 'Booka-Ru editors', rating: 5, text: 'A witty moving castle, a spell, and characters with room to surprise you: Howl’s Moving Castle is comfort reading with plenty of sparkle.' }
].map(review => ({ ...review, approved: true, editorial: true, createdAt: new Date('2025-01-02T00:00:00.000Z') }));

// Idempotent: books and reviews are matched on seedKey, so running it again never duplicates data.
async function seedCatalog(database) {
  const books = database.collection('books');
  const reviews = database.collection('reviews');
  for (const book of [...catalog, ...banglaCatalog, ...extraCatalog]) {
    const { imageURL, ...insertFields } = book;
    await books.updateOne({ seedKey: book.seedKey }, { $setOnInsert: insertFields, $set: { imageURL } }, { upsert: true });
  }
  for (const review of editorialReviews) await reviews.updateOne({ seedKey: review.seedKey }, { $setOnInsert: review }, { upsert: true });
  return `${catalog.length} English books, ${banglaCatalog.length} Bangla books, ${extraCatalog.length} books on the new category shelves, and ${editorialReviews.length} approved editorial reviews`;
}

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in server/.env.');
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log(`Catalog ready: ${await seedCatalog(client.db(process.env.DB_NAME || 'bookDB'))}.`);
  } finally {
    await client.close();
  }
}

module.exports = { seedCatalog };

if (require.main === module) seed().catch(error => { console.error('Could not seed the catalog:', error.message); process.exitCode = 1; });
