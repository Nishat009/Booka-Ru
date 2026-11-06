import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Book from '../Book/Book';
import BookCover, { getCoverSources } from '../Book/BookCover';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api';
import { Select } from '../Fields/Fields';
import { sortCategories } from '../../categories';
import PromoModal from '../PromoModal/PromoModal';
import './Home.css';

const dhakaMapUrl = 'https://www.openstreetmap.org/export/embed.html?bbox=90.3625%2C23.7803%2C90.4625%2C23.8403&layer=mapnik&marker=23.8103%2C23.8103'.replace('23.8103%2C23.8103','23.8103%2C90.4125');
const dhakaMapLink = 'https://www.openstreetmap.org/?mlat=23.8103&mlon=90.4125#map=14/23.8103/90.4125';
const googleMapsEmbedUrl = process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? `https://www.google.com/maps/embed/v1/place?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&q=Dhaka%2C%20Bangladesh` : null;

const Home = () => {
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ q: '', category: '', genre: '', language: '' });
    const [reviews, setReviews] = useState([]);
    const [showAllBooks, setShowAllBooks] = useState(false);
    const [featuredIndex, setFeaturedIndex] = useState(0);
    const [slideshowPaused, setSlideshowPaused] = useState(false);
    const [slideshowInteracting, setSlideshowInteracting] = useState(false);
    const storefrontRef = useRef(null);
    const featuredCount = Math.min(5, books.length);

    useEffect(() => {
        if (featuredCount < 2 || slideshowPaused || slideshowInteracting || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const timer = window.setInterval(() => setFeaturedIndex(current => (current + 1) % featuredCount), 5000);
        return () => window.clearInterval(timer);
    }, [featuredCount, slideshowPaused, slideshowInteracting]);

    useEffect(() => {
        if (!window.IntersectionObserver) return;
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        storefrontRef.current.querySelectorAll('.shelf-section, .collection-section, .reviews-section, .location-section, .category-shelf').forEach(section => {
            section.classList.add('scroll-reveal');
            observer.observe(section);
        });
        return () => observer.disconnect();
    }, [isLoading, books.length]);

    useEffect(() => {
        const controller = new AbortController();
        apiRequest('/books', { signal: controller.signal }).then(({ data }) => {
            if (!Array.isArray(data)) throw new Error('The book collection response was invalid.');
            setBooks(data); setError('');
        }).catch(loadError => {
            if (loadError.name !== 'AbortError') setError('We could not load the books. Please check the API connection and try again.');
        }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
        apiRequest('/reviews').then(({ data }) => setReviews(Array.isArray(data) ? data : [])).catch(() => setReviews([]));
        return () => controller.abort();
    }, []);

    const options = useMemo(() => ({
        category: sortCategories(new Set(books.map(book => book.category).filter(Boolean))),
        genre: [...new Set(books.map(book => book.genre).filter(Boolean))],
        language: [...new Set(books.map(book => book.language).filter(Boolean))]
    }), [books]);
    const visibleBooks = books.filter(book => (!filters.q || `${book.name} ${book.author || ''} ${book.description || ''}`.toLowerCase().includes(filters.q.toLowerCase())) && (!filters.category || book.category === filters.category) && (!filters.genre || book.genre === filters.genre) && (!filters.language || book.language === filters.language));
    const hasActiveFilters = Object.values(filters).some(Boolean);
    const displayedBooks = hasActiveFilters || showAllBooks ? visibleBooks : visibleBooks.slice(0, 10);
    const featuredBooks = [...books]
        .filter(book => !book.seedKey?.startsWith('demo-') && !/\bdemo\b/i.test(`${book.name || ''} ${book.author || ''}`) && !/^\d{10,}$/.test(String(book.name || '').trim()))
        .sort((a, b) => Number(Boolean(getCoverSources(b)[0]?.includes("/covers/"))) - Number(Boolean(getCoverSources(a)[0]?.includes("/covers/"))))
        .slice(0, 5);
    const newArrivals = books.map((book, index) => ({ book, index })).sort((a, b) => (Date.parse(b.book.createdAt) || 0) - (Date.parse(a.book.createdAt) || 0) || b.index - a.index).slice(0, 4).map(item => item.book);
    const categoryShelves = options.category.slice(0, 3).map(category => ({ category, books: books.filter(book => book.category === category).slice(0, 4) })).filter(shelf => shelf.books.length);
    const moveFeatured = direction => setFeaturedIndex(current => (current + direction + featuredBooks.length) % (featuredBooks.length || 1));

    return <div className="storefront" ref={storefrontRef}>
        <PromoModal />
        <section className="hero">
            <div className="hero-copy"><p className="eyebrow">A little more story in every day</p><h1>Find your next<br /><em>favorite read.</em></h1><p className="hero-description">Thoughtful stories, hand-picked for curious minds. Find a book to keep, gift, and pass along.</p><a className="primary-button" href="#book-collection">Explore the collection <span aria-hidden="true">→</span></a><div className="hero-actions"><Link to="/login" className="hero-account-link">Make yourself at home <span aria-hidden="true">↗</span></Link></div></div>
            <div className="hero-art" role="region" aria-roledescription="carousel" aria-label="Featured books" onMouseEnter={() => setSlideshowInteracting(true)} onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setSlideshowInteracting(false); }} onFocusCapture={() => setSlideshowInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(":hover")) setSlideshowInteracting(false); }}><div className="featured-shelf-top"><span>On the reading table</span><span>CURATED FOR YOU</span></div>
                {featuredBooks.length > 0 ? <><div className="featured-book-stage">{featuredBooks.map((book, index) => <article key={book._id} aria-hidden={index !== featuredIndex} className={`featured-book featured-book-${(index - featuredIndex + featuredBooks.length) % featuredBooks.length}`}><div className="featured-book-cover"><span className="cover-spine" aria-hidden="true" /><BookCover book={book} featured /></div><div className="featured-book-meta"><span>{book.category || book.genre || 'A good read'}</span><strong>{book.name}</strong><small>by {book.author || 'Unknown author'}</small><Link tabIndex={index === featuredIndex ? 0 : -1} to={`/checkOut/${book._id}`}>Discover this book <span aria-hidden="true">↗</span></Link></div></article>)}</div><div className="featured-controls"><span>{String(featuredIndex + 1).padStart(2, '0')} <i>/</i> {String(featuredBooks.length).padStart(2, '0')}</span><div><button className="slideshow-pause" aria-label={slideshowPaused ? "Play slideshow" : "Pause slideshow"} onClick={() => setSlideshowPaused(current => !current)}>{slideshowPaused ? "Play" : "Pause"}</button><button aria-label="Previous featured book" onClick={() => moveFeatured(-1)}>←</button><button aria-label="Next featured book" onClick={() => moveFeatured(1)}>→</button></div></div></> : <div className="featured-empty">{isLoading ? 'Setting the reading table…' : 'A good book is waiting to be discovered.'}</div>}
                <span className="hero-art-caption">A little magic on every shelf</span></div>
        </section>
        <div className="store-values" aria-label="Our collection"><span><b>01</b> Thoughtfully selected</span><span><b>02</b> Bangla & English reads</span><span><b>03</b> A story for every mood</span></div>
        {!isLoading && !error && newArrivals.length > 0 && <section className="shelf-section" aria-labelledby="new-arrivals-title"><div className="shelf-heading"><div><p className="eyebrow">Fresh from the bookshop</p><h2 id="new-arrivals-title">New arrivals</h2></div><a href="#book-collection">Browse every book ↗</a></div><div className="shelf-grid">{newArrivals.map(book => <Book key={`arrival-${book._id}`} book={book} badge="Just arrived" />)}</div></section>}
        <section className="collection-section" id="book-collection"><div className="section-heading"><div><p className="eyebrow">The Booka-Ru shelf</p><h2>Stories worth staying in for</h2></div><span className="collection-count">{visibleBooks.length} books to discover</span></div>
            {options.category.length > 0 && <div className="category-tabs" aria-label="Browse by category"><button type="button" className={!filters.category ? 'active' : ''} aria-pressed={!filters.category} onClick={() => setFilters(current => ({ ...current, category: '' }))}>All stories</button>{options.category.map(category => <button type="button" key={category} className={filters.category === category ? 'active' : ''} aria-pressed={filters.category === category} onClick={() => setFilters(current => ({ ...current, category }))}>{category}<span>{books.filter(book => book.category === category).length}</span></button>)}</div>}
            <div className="book-filters" aria-label="Filter books"><input aria-label="Search books" placeholder="Search books or authors" value={filters.q} onChange={event => setFilters(current => ({ ...current, q: event.target.value }))} />{['category', 'genre', 'language'].map(key => <Select aria-label={`Filter by ${key}`} key={key} value={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}><option value="">{{ category: 'All categories', genre: 'All genres', language: 'All languages' }[key]}</option>{options[key].map(value => <option key={value}>{value}</option>)}</Select>)}</div>
            {isLoading && <p className="collection-message" role="status">Finding your next read…</p>}{error && <p className="collection-message collection-error" role="alert">{error}</p>}{!isLoading && !error && books.length === 0 && <p className="collection-message">The shelf is quiet for now. Check back soon for new books.</p>}
            {!isLoading && !error && books.length > 0 && <>{!hasActiveFilters && categoryShelves.map(shelf => <section className="category-shelf" key={shelf.category}><div className="shelf-heading"><div><p className="eyebrow">Explore by category</p><h3>{shelf.category}</h3></div><button type="button" onClick={() => { setFilters(current => ({ ...current, category: shelf.category })); document.getElementById('book-collection')?.scrollIntoView({ behavior: 'smooth' }); }}>See this shelf →</button></div><div className="shelf-grid">{shelf.books.map(book => <Book key={`${shelf.category}-${book._id}`} book={book} />)}</div></section>)}{visibleBooks.length === 0 && <p className="collection-message">No books match these filters.</p>}<div className="catalog-label"><p className="eyebrow">Find a place on your bookshelf</p><h3>{filters.category || "The complete collection"}</h3>{hasActiveFilters && <button type="button" onClick={() => setFilters({ q: "", category: "", genre: "", language: "" })}>Clear filters</button>}</div><div className="book-grid">{displayedBooks.map(book => <Book key={book._id} book={book} />)}</div>{!hasActiveFilters && visibleBooks.length > 10 && <button className="show-books-button" type="button" onClick={() => setShowAllBooks(current => !current)}>{showAllBooks ? 'Show fewer books' : `Show all ${visibleBooks.length} books`}</button>}</>}
        </section>
        <section className="reviews-section"><div className="review-heading"><p className="eyebrow">Notes from fellow readers</p><h2>Good books leave a little echo.</h2><p className="review-intro">Kind words from readers who found a story to take home.</p></div>{reviews.length ? <div className="reviews-grid">{reviews.slice(0, 3).map((review) => <article className="reader-review" key={review._id}><span className="review-number" aria-hidden="true">&ldquo;</span><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0))))}{'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0))))}</span><p>“{review.text}”</p><div className="review-reader"><span>{(review.name || 'R').charAt(0).toUpperCase()}</span><strong>{review.name}</strong><small>Booka-Ru reader</small></div></article>)}</div> : <p className="collection-message">Reader reviews are coming soon.</p>}</section>
        <section className="location-section" aria-labelledby="location-title"><div className="location-copy"><p className="eyebrow">Find us on the map</p><h2 id="location-title">A bookshop in Dhaka</h2><p>This map is centered on Dhaka city. The exact shop address has not been provided yet, so the pin is an approximate city-center location.</p><a className="map-link" href={dhakaMapLink} target="_blank" rel="noreferrer">Open the map <span aria-hidden="true">↗</span></a></div><div className="map-frame"><iframe title="OpenStreetMap centered on Dhaka city" src={googleMapsEmbedUrl || dhakaMapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section>
        <footer className="store-footer">
            <div className="footer-inner">
                <div className="footer-brand"><span className="brand-mark" aria-hidden="true">B</span><div><strong>Booka-Ru</strong><p>Bangla &amp; English books, hand-picked in Dhaka for curious minds.</p></div></div>
                <nav className="footer-links" aria-label="Footer"><a href="#book-collection">The collection</a><Link to="/orderPreview">My orders</Link><a href={dhakaMapLink} target="_blank" rel="noreferrer">Find us in Dhaka</a></nav>
            </div>
            <p className="footer-meta">© {new Date().getFullYear()} Booka-Ru <span>·</span> Stories for every season</p>
        </footer>
    </div>;
};
export default Home;
