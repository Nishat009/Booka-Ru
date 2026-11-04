import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import AddBook from '../AddBook/AddBook';
import ManageBook from '../ManageBook/ManageBook';

const permissions = ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate', 'users:manage'];
const labels = { 'books:write': 'Manage books', 'orders:manage': 'Manage all orders', 'support:handle': 'Handle support calls', 'reviews:moderate': 'Approve reviews', 'users:manage': 'Manage team access' };

function Admin() {
    const [user] = useContext(UserContext);
    const location = useLocation();
    const section = location.pathname === '/manageBook' ? 'books' : location.pathname === '/addBook' ? 'add' : location.pathname.split('/')[2] || 'orders';
    const can = permission => user.role === 'admin' || user.permissions?.includes(permission);
    const [orders, setOrders] = useState([]); const [reviews, setReviews] = useState([]); const [team, setTeam] = useState([]); const [chatOrder, setChatOrder] = useState(''); const [chatMessages, setChatMessages] = useState([]); const [chatText, setChatText] = useState('');
    const [notice, setNotice] = useState(''); const [staffEmail, setStaffEmail] = useState(''); const [staffUid, setStaffUid] = useState(''); const [staffPassword, setStaffPassword] = useState('');
    const [staffName, setStaffName] = useState(''); const [staffRole, setStaffRole] = useState('staff'); const [staffPermissions, setStaffPermissions] = useState([]);
    const loadOrders = async () => { try { const res = await apiRequest('/orders', {}, user); setOrders(await res.json()); } catch (error) { setNotice(error.message); } };
    const loadReviews = async () => { try { const res = await apiRequest('/admin/reviews', {}, user); setReviews(await res.json()); } catch (error) { setNotice(error.message); } };
    const loadTeam = async () => { try { const res = await apiRequest('/admin/users', {}, user); setTeam(await res.json()); } catch (error) { setNotice(error.message); } };
    useEffect(() => { if (can('orders:manage') || can('support:handle')) loadOrders(); if (can('reviews:moderate')) loadReviews(); if (can('users:manage')) loadTeam(); /* permissions depend on verified account */ }, [user.email, user.role]);
    const changeOrder = async (id, status) => { try { await apiRequest(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, user); setNotice(status === 'on-call' ? 'Order assigned to you for a support call.' : 'Order status updated.'); loadOrders(); } catch (error) { setNotice(error.message); } };
    const openChat = async order => { setChatOrder(order._id); try { const res = await apiRequest(`/orders/${order._id}/messages`, {}, user); setChatMessages(await res.json()); } catch (error) { setNotice(error.message); } };
    const sendChat = async event => { event.preventDefault(); if (!chatText.trim()) return; try { const res = await apiRequest(`/orders/${chatOrder}/messages`, { method: 'POST', body: JSON.stringify({ text: chatText }) }, user); const message = await res.json(); setChatMessages(current => [...current, message]); setChatText(''); } catch (error) { setNotice(error.message); } };
    const approveReview = async (review, approved) => { try { await apiRequest(`/admin/reviews/${review._id}`, { method: 'PATCH', body: JSON.stringify({ approved }) }, user); setReviews(current => current.map(item => item._id === review._id ? { ...item, approved } : item)); } catch (error) { setNotice(error.message); } };
    const updateStaff = async event => { event.preventDefault(); try { await apiRequest(`/admin/users/${encodeURIComponent(staffUid || 'new')}`, { method: 'PUT', body: JSON.stringify({ email: staffEmail, name: staffName, password: staffPassword, role: staffRole, permissions: staffPermissions }) }, user); setNotice('Team account saved. Share the temporary password securely.'); setStaffEmail(''); setStaffUid(''); setStaffName(''); setStaffPassword(''); setStaffPermissions([]); loadTeam(); } catch (error) { setNotice(error.message); } };
    const editStaff = member => { setStaffEmail(member.email); setStaffUid(member._id); setStaffName(member.name || ''); setStaffPassword(''); setStaffRole(member.role); setStaffPermissions(member.permissions || []); };

    return <div className="admin-shell">
        <aside className="admin-sidebar"><p className="eyebrow">Booka-Ru workspace</p><h2>{user.role === 'admin' ? 'Admin' : 'Staff'} desk</h2>
            {can('orders:manage') || can('support:handle') ? <Link to="/admin/orders">Orders & support</Link> : null}
            {can('books:write') ? <><Link to="/manageBook">Book collection</Link><Link to="/addBook">Add a book</Link></> : null}
            {can('reviews:moderate') ? <Link to="/admin/reviews">Reviews</Link> : null}
            {can('users:manage') ? <Link to="/admin/team">Staff access</Link> : null}
        </aside>
        <section className="admin-content">
            <p className="eyebrow">{user.role === 'admin' ? 'Full access' : 'Your assigned workspace'}</p>
            <h1>{section === 'books' ? 'Book collection' : section === 'add' ? 'Add a book' : section === 'reviews' ? 'Review moderation' : section === 'team' ? 'Team access' : 'Orders & support'}</h1>
            {notice && <p className="inline-notice" role="status">{notice}</p>}
            {section === 'books' && can('books:write') ? <ManageBook /> : null}
            {section === 'add' && can('books:write') ? <AddBook /> : null}
            {section === 'orders' && (can('orders:manage') || can('support:handle')) ? <div className="admin-list">
                {orders.length === 0 && <p className="collection-message">No orders yet.</p>}
                {orders.map(order => <article className="admin-order" key={order._id}><div><strong>{order.name}</strong><p>{order.customerName} · {order.email}</p><p>Qty {order.quantity} · BDT {order.total} · {new Date(order.createdAt).toLocaleString()}</p><span className={`status-pill status-${order.status}`}>{order.status}</span>{order.supportStaff && <small> On call: {order.supportStaff.name}</small>}</div>
                <div className="admin-actions">{can('support:handle') && order.status === 'on-call' && (!order.supportStaff || order.supportStaff.uid === user.uid) && <button className="soft-button" onClick={() => openChat(order)}>Open support chat</button>}{can('support:handle') && order.status !== 'on-call' && <button className="soft-button" onClick={() => changeOrder(order._id, 'on-call')}>Take on call</button>}{can('orders:manage') && <select aria-label="Order status" value={order.status} onChange={event => changeOrder(order._id, event.target.value)}>{['new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled'].map(status => <option key={status}>{status}</option>)}</select>}</div></article>)}
                {chatOrder && <section className="support-chat"><div className="support-chat-heading"><h3>Support conversation</h3><button type="button" onClick={() => setChatOrder('')}>Close</button></div><div className="chat-messages">{chatMessages.map(message => <p key={message._id}><strong>{message.senderName}:</strong> {message.text}</p>)}{chatMessages.length === 0 && <p>No messages yet. Start the conversation.</p>}</div><form onSubmit={sendChat}><input value={chatText} onChange={event => setChatText(event.target.value)} placeholder="Write a message…" maxLength="1600" required /><button className="soft-button">Send</button></form></section>}
            </div> : null}
            {section === 'reviews' && can('reviews:moderate') ? <div className="admin-list">{reviews.map(review => <article className="admin-order" key={review._id}><div><strong>{'★'.repeat(review.rating)} · {review.name}</strong><p>{review.text}</p><span className="status-pill">{review.approved ? 'Approved' : 'Needs approval'}</span></div><div className="admin-actions">{!review.approved && <button className="soft-button" onClick={() => approveReview(review, true)}>Approve</button>}{review.approved && <button className="soft-button" onClick={() => approveReview(review, false)}>Hide</button>}</div></article>)}</div> : null}
            {section === 'team' && can('users:manage') ? <><form className="team-form" onSubmit={updateStaff}><h3>{staffUid ? 'Update team account' : 'Create staff account'}</h3><p>Set the staff member’s email and a temporary password. They can sign in without any external account.</p><label>Name<input value={staffName} onChange={event => setStaffName(event.target.value)} required /></label><label>Email<input type="email" value={staffEmail} onChange={event => setStaffEmail(event.target.value)} required /></label><label>{staffUid ? 'New password (leave empty to keep existing)' : 'Temporary password'}<input type="password" value={staffPassword} onChange={event => setStaffPassword(event.target.value)} required={!staffUid} minLength="8" /></label><label>Role<select value={staffRole} onChange={event => setStaffRole(event.target.value)}><option value="staff">Staff</option><option value="customer">Customer</option></select></label><fieldset><legend>Allowed menus and actions</legend>{permissions.map(permission => <label className="check-label" key={permission}><input type="checkbox" checked={staffPermissions.includes(permission)} onChange={event => setStaffPermissions(current => event.target.checked ? [...current, permission] : current.filter(item => item !== permission))} />{labels[permission]}</label>)}</fieldset><button className="soft-button">Save access</button><button className="soft-button" type="button" onClick={() => { setStaffUid(''); setStaffEmail(''); setStaffName(''); setStaffPassword(''); setStaffPermissions([]); }}>New staff</button></form><div className="admin-list">{team.map(member => <button className="team-member" key={member._id} onClick={() => editStaff(member)}><strong>{member.name}</strong><span>{member.email} · {member.role} · {(member.permissions || []).length} permissions</span></button>)}</div></> : null}
        </section>
    </div>;
}
export default Admin;
