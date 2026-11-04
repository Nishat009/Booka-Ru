import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { UserContext } from '../../App';
import API_URL from '../../api';
import { apiRequest } from '../../api';
import BookCover from '../Book/BookCover';



const CheckOut = () => {
    const [book, setBook] = useState({});

    const { id } = useParams();

    const [loggedInUser] = useContext(UserContext)

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [orderQuantity, setOrderQuantity] = useState(1); const [address, setAddress] = useState(''); const [notice, setNotice] = useState('');


    const handleBuy = async () => { setNotice(''); try { await apiRequest('/orders', { method: 'POST', body: JSON.stringify({ bookId: book._id, quantity: Number(orderQuantity), shippingAddress: address, requestedDate: selectedDate }) }, loggedInUser); setNotice('Order placed. You can follow it in My orders.'); } catch (error) { setNotice(error.message); } };


    useEffect(() => {
        fetch(`${API_URL}/books/${id}`)
            .then(res => res.json())
            .then(data => setBook(data))
    }, [id])

    const { name, price } = book;


    return (
        <div className='container'>
            <h1 className="text-center m-5">Place your order</h1>

            <div style={{ textAlign: 'center' }}>
                <label htmlFor="order-date">Order date </label>
                <input
                    id="order-date"
                    type="date"
                    value={selectedDate}
                    onChange={event => setSelectedDate(event.target.value)}
                />
            </div>

            <table className="table border rounded mt-3">
                <thead>
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Book name</th>
                        <th scope="col">Book Image</th>
                        <th scope="col">Price</th>
                        <th scope="col">Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th scope="row">1</th>
                        <td>{name}</td>
                        <td><div className="checkout-book-cover"><BookCover book={book} /></div></td>
                        <td>BDT {price}</td>
                        <td>{book.quantity}</td>
                        
                    </tr>
                </tbody>
            </table>
            <div className="checkout-fields"><label>Copies<input type="number" min="1" max={book.quantity} value={orderQuantity} onChange={event => setOrderQuantity(event.target.value)} /></label><label>Delivery address<textarea value={address} onChange={event => setAddress(event.target.value)} required rows="2" /></label></div>
            {notice && <p className="inline-notice" role="status">{notice}</p>}
            <div style={{ float: 'right' }} >

                <button onClick={handleBuy} disabled={!book._id || Number(book.quantity) < 1 || !address.trim()} className="btn btn-primary">Place order</button>

                <Link to="/" className="m-3">
                    <button className="btn btn-info">More One</button>
                </Link>

                <Link to="/orderPreview">
                    <button className="btn btn-success">My orders</button>
                </Link>
            </div>
        </div>
    );
};

export default CheckOut;
