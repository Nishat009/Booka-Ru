// Canonical shelves for the shop. Genres are suggestions shown when adding a book.
const CATEGORIES = [
    { name: 'Fiction', genres: ['Classic Fiction', 'Contemporary Fiction', 'Adventure', 'Dystopian', 'Historical Fiction'] },
    { name: 'Fantasy', genres: ['Fairy Tale', 'Fantasy Adventure', 'Classic Fantasy', 'Dark Fantasy', 'Fantasy Romance'] },
    { name: 'Children', genres: ['Picture Book', 'Classic Fiction', 'Adventure', 'Fairy Tale'] },
    { name: 'Mystery & Thriller', genres: ['Detective', 'Crime', 'Psychological Thriller', 'Suspense'] },
    { name: 'Science Fiction', genres: ['Space Opera', 'Dystopian', 'Cyberpunk', 'Hard Science Fiction'] },
    { name: 'Romance', genres: ['Classic Romance', 'Contemporary Romance', 'Historical Romance'] },
    { name: 'History & Biography', genres: ['Biography', 'Autobiography', 'World History', 'Memoir'] },
    { name: 'Self-Help', genres: ['Personal Growth', 'Productivity', 'Mindfulness', 'Habits'] },
    { name: 'Poetry', genres: ['Classic Poetry', 'Modern Poetry', 'Collected Poems'] },
    { name: 'বাংলা সাহিত্য', genres: ['উপন্যাস', 'ছোটগল্প', 'কবিতা', 'রহস্য ও গোয়েন্দা', 'প্রবন্ধ'] }
];

export const CATEGORY_NAMES = CATEGORIES.map(category => category.name);
export const genresFor = name => (CATEGORIES.find(category => category.name === name) || {}).genres || [];
export const sortCategories = names => [...names].sort((a, b) => {
    const first = CATEGORY_NAMES.indexOf(a), second = CATEGORY_NAMES.indexOf(b);
    return (first < 0 ? 99 : first) - (second < 0 ? 99 : second) || a.localeCompare(b);
});
export default CATEGORIES;
