import React, { useState } from 'react';
import covers from '../../bookCovers.json';

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const catalogCovers = Object.fromEntries(Object.entries(covers).map(([name, isbn]) => [normalize(name), isbn]));

export const getCoverSources = book => {
    const isbn = String(book.isbn || '').replace(/[^0-9X]/gi, '');
    const localIsbn = catalogCovers[normalize(book.name)];
    return [...new Set([
        localIsbn && `${process.env.PUBLIC_URL}/covers/${localIsbn}.jpg`,
        !localIsbn && book.imageURL,
        /^(?:[0-9]{13}|[0-9]{9}[0-9X])$/i.test(isbn) && `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
    ].filter(Boolean))];
};

const CoverImage = ({ book, featured }) => {
    const [sourceIndex, setSourceIndex] = useState(0);
    const sources = getCoverSources(book);
    return <>
        {sourceIndex >= sources.length && <span className="cover-unavailable" role="status">Cover unavailable</span>}
        {sourceIndex < sources.length && <img src={sources[sourceIndex]} alt={`Cover of ${book.name}`} loading={featured ? 'eager' : 'lazy'} decoding="async" onError={() => setSourceIndex(current => current + 1)} onLoad={event => {
            if (event.currentTarget.naturalWidth < 10 || event.currentTarget.naturalHeight < 10) setSourceIndex(current => current + 1);
        }} />}
    </>;
};

const BookCover = ({ book, featured = false }) => <CoverImage key={getCoverSources(book).join('|')} book={book} featured={featured} />;
export default BookCover;
