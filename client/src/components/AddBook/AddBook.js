import React, { useContext, useState } from 'react';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';

const AddBook = () => {
    const [user] = useContext(UserContext);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const onSubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const bookData = {
            name: formData.get('name'), description: formData.get('description'), author: formData.get('author'),
            imageURL: formData.get('imageURL'), category: formData.get('category'), genre: formData.get('genre'), language: formData.get('language'),
            price: formData.get('price'),
            quantity: formData.get('quantity')
        };
        setError(''); setSaved(false);
        apiRequest('/books', { method: 'POST', body: JSON.stringify(bookData) }, user)
            .then(() => { form.reset(); setSaved(true); })
            .catch(requestError => setError(requestError.message));
    }

    return (
        <div>
        <hr />
        <form onSubmit={onSubmit} className="row g-3 bg-light shadow mt-5 p-5 rounded">
            <div className="col-md-6">
                <label htmlFor="book-name" className="form-label">Book Name</label>
                <input type="text" name="name" className="form-control" id="book-name" placeholder="Enter Name" required />
            </div>
            <div className="col-md-6">
                <label htmlFor="book-quantity" className="form-label">Quantity</label>
                <input type="number" name="quantity" className="form-control" id="book-quantity" placeholder="Enter Quantity" min="0" required />
            </div>
            <div className="col-md-6">
                <label htmlFor="book-price" className="form-label">Add Price</label>
                <input type="number" name="price" className="form-control" id="book-price" placeholder="Enter Price" min="0" step="0.01" required />
            </div>
            <div className="col-md-6"><label htmlFor="book-author" className="form-label">Author</label><input name="author" className="form-control" id="book-author" /></div>
            <div className="col-md-6"><label htmlFor="book-category" className="form-label">Category</label><input name="category" className="form-control" id="book-category" placeholder="Fiction" /></div>
            <div className="col-md-6"><label htmlFor="book-genre" className="form-label">Genre</label><input name="genre" className="form-control" id="book-genre" placeholder="Mystery" /></div>
            <div className="col-md-6"><label htmlFor="book-language" className="form-label">Language</label><input name="language" className="form-control" id="book-language" placeholder="Bangla" /></div>
            <div className="col-md-6"><label htmlFor="book-description" className="form-label">Description</label><textarea name="description" className="form-control" id="book-description" rows="3" /></div>

            <div className="col-md-6">
                <label htmlFor="book-image" className="form-label">Add Photo</label>
                <input className="form-control" type="url" name="imageURL" id="book-image" placeholder="https://…" />
            </div>

            <div >
                <input type="submit" className="mt-3 btn btn-success" />
            </div>
            {error && <p className="text-danger" role="alert">{error}</p>}{saved && <p className="text-success" role="status">Book added to the collection.</p>}
        </form>
    </div>
    );
};

export default AddBook;
