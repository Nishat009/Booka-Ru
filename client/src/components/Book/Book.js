import React from 'react';
import { useHistory } from 'react-router';
import './Book.css';
import BookCover from './BookCover';

const Book = ({ book, badge }) => {
    const history = useHistory();

    return (
        <article className="book-card">
                <div className="book-cover" data-title={book.name}>
                {badge && <span className="book-badge">{badge}</span>}
                <BookCover book={book} />
            </div>
            <div className="book-card-info">
                <p className="book-genre">{book.genre || 'Fiction'} <span>·</span> {book.language || 'English'}</p>
                <h3>{book.name}</h3>
                <p className="book-author">by {book.author || 'Unknown author'}</p>
                <div className="book-card-footer">
                    <span className="book-price">BDT {Number(book.price).toLocaleString('en-BD')}</span>
                    <button type="button" onClick={() => history.push(`/checkOut/${book._id}`)} aria-label={`Buy ${book.name}`}>Buy book <span aria-hidden="true">&nearr;</span></button>
                </div>
            </div>
        </article>
    );
};

export default Book;

