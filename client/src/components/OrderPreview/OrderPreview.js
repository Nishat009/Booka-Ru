import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';
import { Select } from '../Fields/Fields';

function OrderPreview() {
    const [user] = useContext(UserContext); const notify = useMessages();
    const [orders, setOrders] = useState([]); const [selected, setSelected] = useState(null); const [messages, setMessages] = useState([]); const [text, setText] = useState('');
    const load = async () => { try { const { data } = await apiRequest('/orders?mine=1', {}, user); setOrders(data); } catch (error) { notify.error(error); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [user.email]);
    const openChat = async order => { setSelected(order); try { const { data } = await apiRequest(`/orders/${order._id}/messages`, {}, user); setMessages(data); } catch (error) { notify.error(error); } };
    const send = async event => { event.preventDefault(); try { const { data } = await apiRequest(`/orders/${selected._id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }, user); setMessages(current => [...current, data]); setText(''); } catch (error) { notify.error(error); } };
    const downloadInvoice = async order => {
        try {
            const { blob } = await apiRequest(`/orders/${order._id}/invoice`, { raw: true }, user);
            const url = URL.createObjectURL(blob); const link = document.createElement('a');
            link.href = url; link.download = `bookaru-invoice-${order._id}.pdf`; link.click(); URL.revokeObjectURL(url);
        } catch (error) { notify.error(error); }
    };
    const submitReview = async event => {
        event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
        try { const { message } = await apiRequest('/reviews', { method: 'POST', body: JSON.stringify({ rating: Number(values.get('rating')), text: values.get('text') }) }, user); form.reset(); notify.success(message); }
        catch (error) { notify.error(error); }
    };
    return <section className="orders-page"><p className="eyebrow">Your Booka-Ru account</p><h1>My orders</h1><p>Follow deliveries, contact the support team and download invoices.</p>
        {orders.length === 0 && <div className="collection-message">No orders yet. <Link to="/#book-collection">Explore books</Link></div>}
        <div className="admin-list">{orders.map(order => <article className="admin-order customer-order" key={order._id}><div><strong>{order.name}</strong><p>{new Date(order.createdAt).toLocaleDateString()} · {order.quantity} {Number(order.quantity) === 1 ? 'copy' : 'copies'} · BDT {order.total}</p><span className={`status-pill status-${order.status}`}>{order.status}</span>{order.supportStaff && <p>Support: {order.supportStaff.name}</p>}</div><div className="admin-actions"><button className="soft-button" onClick={() => downloadInvoice(order)}>Download invoice (PDF)</button>{order.supportStaff && <button className="soft-button" onClick={() => openChat(order)}>Chat with support</button>}</div></article>)}</div>
        {selected && <section className="support-chat"><div className="support-chat-heading"><h3>Support · {selected.name}</h3><button onClick={() => setSelected(null)}>Close</button></div><div className="chat-messages">{messages.map(message => <p key={message._id}><strong>{message.senderName}:</strong> {message.text}</p>)}{messages.length === 0 && <p>Send a message to reach the support staff handling your order.</p>}</div><form onSubmit={send}><input value={text} onChange={event => setText(event.target.value)} placeholder="Write a message…" maxLength="1600" required /><button className="soft-button">Send</button></form></section>}
        <form className="review-form" onSubmit={submitReview}><p className="eyebrow">Share a reader note</p><h2>How was your Booka-Ru experience?</h2><label>Rating<Select name="rating" defaultValue="5"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></Select></label><label>Your review<textarea name="text" rows="3" maxLength="800" required placeholder="Write a few words…" /></label><button className="soft-button">Submit for approval</button></form>
    </section>;
}
export default OrderPreview;
