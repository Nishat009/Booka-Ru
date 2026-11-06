import React, { useContext, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import BookCover from '../Book/BookCover';
import { useMessages } from '../Messages/Messages';
import { DatePicker } from '../Fields/Fields';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

const todayIso = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

const CheckOut = () => {
    const [book, setBook] = useState({});
    const { id } = useParams();
    const [loggedInUser] = useContext(UserContext);
    const notify = useMessages();
    const [selectedDate, setSelectedDate] = useState(todayIso());
    const [orderQuantity, setOrderQuantity] = useState(1); const [address, setAddress] = useState('');
    const [confirming, setConfirming] = useState(false); const [placing, setPlacing] = useState(false);

    const placeOrder = async () => {
        setPlacing(true);
        try {
            const { message } = await apiRequest('/orders', { method: 'POST', body: JSON.stringify({ bookId: book._id, quantity: Number(orderQuantity), shippingAddress: address, requestedDate: selectedDate }) }, loggedInUser);
            notify.success(message);
            setAddress(''); setOrderQuantity(1);
            apiRequest(`/books/${id}`).then(({ data }) => setBook(data)).catch(() => {});
        } catch (error) { notify.error(error); }
        finally { setPlacing(false); setConfirming(false); }
    };

    useEffect(() => {
        apiRequest(`/books/${id}`).then(({ data }) => setBook(data)).catch(error => notify.error(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const { name, price } = book;
    const total = Number(price || 0) * Number(orderQuantity || 0);

    return (
        <div className='container'>
            <h1 className="text-center m-5">Place your order</h1>

            <div className="checkout-date">
                <label htmlFor="order-date">Order date</label>
                <DatePicker id="order-date" value={selectedDate} onChange={event => setSelectedDate(event.target.value || todayIso())} min={todayIso()} />
            </div>

            <table className="table border rounded mt-3">
                <thead>
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Book name</th>
                        <th scope="col">Book Image</th>
                        <th scope="col">Price</th>
                        <th scope="col">In stock</th>
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
            <div style={{ float: 'right' }} >

                <button onClick={() => setConfirming(true)} disabled={!book._id || Number(book.quantity) < 1 || !address.trim()} className="btn btn-primary">Place order</button>

                <Link to="/" className="m-3">
                    <button className="btn btn-info">More One</button>
                </Link>

                <Link to="/orderPreview">
                    <button className="btn btn-success">My orders</button>
                </Link>
            </div>
            {confirming && <ConfirmModal title="Are you sure?" confirmLabel="Yes, place order" cancelLabel="Go back" busy={placing} onConfirm={placeOrder} onCancel={() => setConfirming(false)}>
                <p>You are about to order <strong>{orderQuantity} × {name}</strong> for <strong>BDT {total}</strong>.</p>
                <p>Delivery to: {address}</p>
            </ConfirmModal>}
        </div>
    );
};

export default CheckOut;
