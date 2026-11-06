import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';
import { Select } from '../Fields/Fields';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { CATEGORY_NAMES } from '../../categories';

const emptyBook = { name: '', author: '', category: '', genre: '', language: '', price: '', quantity: '', imageURL: '', description: '' };
function ManageBook() {
    const [user] = useContext(UserContext); const [books, setBooks] = useState([]); const [editing, setEditing] = useState(null); const [removing, setRemoving] = useState(null); const notify = useMessages();
    const load = async () => { const { data } = await apiRequest('/books'); setBooks(data); };
    useEffect(() => { load().catch(error => notify.error(error)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
    const submit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { const { message } = await apiRequest(`/books/${editing._id}`, { method: 'PUT', body: JSON.stringify(data) }, user); setEditing(null); notify.success(message); load(); } catch (error) { notify.error(error); } };
    const remove = async book => { try { const { message } = await apiRequest(`/books/${book._id}`, { method: 'DELETE' }, user); notify.success(message); load(); } catch (error) { notify.error(error); } finally { setRemoving(null); } };
    return <div className="book-management"><p>{books.length} books in the catalogue</p>
        {editing && <form className="team-form" onSubmit={submit}><h3>Edit book</h3><div className="book-edit-grid">{Object.keys(emptyBook).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}{key === 'description' ? <textarea name={key} defaultValue={editing[key] || ''} /> : key === 'category' ? <Select name={key} defaultValue={editing[key] || CATEGORY_NAMES[0]}>{[...new Set([...CATEGORY_NAMES, editing[key]].filter(Boolean))].map(name => <option key={name} value={name}>{name}</option>)}</Select> : <input name={key} type={['price', 'quantity'].includes(key) ? 'number' : key === 'imageURL' ? 'url' : 'text'} step={key === 'price' ? '0.01' : undefined} defaultValue={editing[key] || ''} required={['name', 'price', 'quantity'].includes(key)} />}</label>)}</div><button className="soft-button">Save changes</button><button className="soft-button" type="button" onClick={() => setEditing(null)}>Cancel</button></form>}
        <div className="admin-list">{books.map(book => <article className="admin-order" key={book._id}><div><strong>{book.name}</strong><p>{book.author || 'Author not listed'} · {book.category} · {book.language} · BDT {book.price} · stock {book.quantity}</p></div><div className="admin-actions"><button className="soft-button" onClick={() => setEditing(book)}>Edit</button><button className="soft-button danger-button" onClick={() => setRemoving(book)}>Remove</button></div></article>)}</div>
        {removing && <ConfirmModal title="Remove this book?" confirmLabel="Remove" onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)}><p><strong>{removing.name}</strong> will be removed from the collection.</p></ConfirmModal>}
    </div>;
}
export default ManageBook;
