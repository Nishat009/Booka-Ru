import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../App';
import { apiRequest, default as API_URL } from '../../api';

const emptyBook = { name: '', author: '', category: '', genre: '', language: '', price: '', quantity: '', imageURL: '', description: '' };
function ManageBook() {
    const [user] = useContext(UserContext); const [books, setBooks] = useState([]); const [editing, setEditing] = useState(null); const [notice, setNotice] = useState('');
    const load = async () => { const response = await fetch(`${API_URL}/books`); if (!response.ok) throw new Error('Could not load books.'); setBooks(await response.json()); };
    useEffect(() => { load().catch(error => setNotice(error.message)); }, []);
    const submit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await apiRequest(`/books/${editing._id}`, { method: 'PUT', body: JSON.stringify(data) }, user); setEditing(null); setNotice('Book updated.'); load(); } catch (error) { setNotice(error.message); } };
    const remove = async book => { if (!window.confirm(`Remove “${book.name}” from the collection?`)) return; try { await apiRequest(`/books/${book._id}`, { method: 'DELETE' }, user); setNotice('Book removed.'); load(); } catch (error) { setNotice(error.message); } };
    return <div className="book-management"><p>{books.length} books in the catalogue</p>{notice && <p className="inline-notice" role="status">{notice}</p>}
        {editing && <form className="team-form" onSubmit={submit}><h3>Edit book</h3><div className="book-edit-grid">{Object.keys(emptyBook).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}{key === 'description' ? <textarea name={key} defaultValue={editing[key] || ''} /> : <input name={key} type={['price', 'quantity'].includes(key) ? 'number' : key === 'imageURL' ? 'url' : 'text'} step={key === 'price' ? '0.01' : undefined} defaultValue={editing[key] || ''} required={['name', 'price', 'quantity'].includes(key)} />}</label>)}</div><button className="soft-button">Save changes</button><button className="soft-button" type="button" onClick={() => setEditing(null)}>Cancel</button></form>}
        <div className="admin-list">{books.map(book => <article className="admin-order" key={book._id}><div><strong>{book.name}</strong><p>{book.author || 'Author not listed'} · {book.category} · {book.language} · BDT {book.price} · stock {book.quantity}</p></div><div className="admin-actions"><button className="soft-button" onClick={() => setEditing(book)}>Edit</button><button className="soft-button danger-button" onClick={() => remove(book)}>Remove</button></div></article>)}</div>
    </div>;
}
export default ManageBook;
