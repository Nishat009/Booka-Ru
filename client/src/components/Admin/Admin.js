import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';
import { Select } from '../Fields/Fields';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import AddBook from '../AddBook/AddBook';
import ManageBook from '../ManageBook/ManageBook';
import ManagePopups from '../ManagePopups/ManagePopups';

const permissions = ['books:write', 'orders:manage', 'support:handle', 'reviews:moderate', 'users:manage', 'popups:manage'];
const labels = { 'books:write': 'Manage books', 'orders:manage': 'Manage all orders', 'support:handle': 'View all orders & invoices (read-only)', 'reviews:moderate': 'Approve reviews', 'users:manage': 'Manage team access', 'popups:manage': 'Manage site pop-ups' };

function Admin() {
    const [user] = useContext(UserContext);
    const notify = useMessages();
    const [deactivating, setDeactivating] = useState(null);
    const location = useLocation();
    const section = location.pathname === '/manageBook' ? 'books' : location.pathname === '/addBook' ? 'add' : location.pathname.split('/')[2] || 'orders';
    const can = permission => user.role === 'admin' || user.permissions?.includes(permission);
    const [orders, setOrders] = useState([]); const [reviews, setReviews] = useState([]); const [team, setTeam] = useState([]); const [chatOrder, setChatOrder] = useState(''); const [chatMessages, setChatMessages] = useState([]); const [chatText, setChatText] = useState('');
    const [staffEmail, setStaffEmail] = useState(''); const [staffUid, setStaffUid] = useState(''); const [staffPassword, setStaffPassword] = useState('');
    const [staffName, setStaffName] = useState(''); const [staffRole, setStaffRole] = useState('staff'); const [staffPermissions, setStaffPermissions] = useState([]);
    const loadOrders = async () => { try { const { data } = await apiRequest('/orders', {}, user); setOrders(data); } catch (error) { notify.error(error); } };
    const loadReviews = async () => { try { const { data } = await apiRequest('/admin/reviews', {}, user); setReviews(data); } catch (error) { notify.error(error); } };
    const loadTeam = async () => { try { const { data } = await apiRequest('/admin/users', {}, user); setTeam(data); } catch (error) { notify.error(error); } };
    // Reload only when the verified account changes; the loaders are recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (can('orders:manage') || can('support:handle')) loadOrders(); if (can('reviews:moderate')) loadReviews(); if (can('users:manage')) loadTeam(); /* permissions depend on verified account */ }, [user.email, user.role]);
    const changeOrder = async (id, status) => { try { const { message } = await apiRequest(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, user); notify.success(message); loadOrders(); } catch (error) { notify.error(error); } };
    const openChat = async order => { setChatOrder(order._id); try { const { data } = await apiRequest(`/orders/${order._id}/messages`, {}, user); setChatMessages(data); } catch (error) { notify.error(error); } };
    const sendChat = async event => { event.preventDefault(); if (!chatText.trim()) return; try { const { data } = await apiRequest(`/orders/${chatOrder}/messages`, { method: 'POST', body: JSON.stringify({ text: chatText }) }, user); setChatMessages(current => [...current, data]); setChatText(''); } catch (error) { notify.error(error); } };
    const approveReview = async (review, approved) => { try { const { message } = await apiRequest(`/admin/reviews/${review._id}`, { method: 'PATCH', body: JSON.stringify({ approved }) }, user); notify.success(message); setReviews(current => current.map(item => item._id === review._id ? { ...item, approved } : item)); } catch (error) { notify.error(error); } };
    const updateStaff = async event => { event.preventDefault(); try { const { message } = await apiRequest(`/admin/users/${encodeURIComponent(staffUid || 'new')}`, { method: 'PUT', body: JSON.stringify({ email: staffEmail, name: staffName, password: staffPassword, role: staffRole, permissions: staffPermissions }) }, user); notify.success(message); setStaffEmail(''); setStaffUid(''); setStaffName(''); setStaffPassword(''); setStaffPermissions([]); loadTeam(); } catch (error) { notify.error(error); } };
    const setActive = async (member, active) => { try { const { message } = await apiRequest(`/admin/users/${member._id}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }, user); notify.success(message); loadTeam(); } catch (error) { notify.error(error); } finally { setDeactivating(null); } };
    const editStaff = member => { setStaffEmail(member.email); setStaffUid(member._id); setStaffName(member.name || ''); setStaffPassword(''); setStaffRole(member.role); setStaffPermissions(member.permissions || []); };

    const sectionAllowed = { orders: can('orders:manage') || can('support:handle'), books: can('books:write'), add: can('books:write'), reviews: can('reviews:moderate'), popups: can('popups:manage'), team: can('users:manage') }[section] || false;

    return <div className="admin-shell">
        <aside className="admin-sidebar"><p className="eyebrow">Booka-Ru workspace</p><h2>{user.role === 'admin' ? 'Admin' : 'Staff'} desk</h2>
            {can('orders:manage') || can('support:handle') ? <Link to="/admin/orders">Orders & support</Link> : null}
            {can('books:write') ? <><Link to="/manageBook">Book collection</Link><Link to="/addBook">Add a book</Link></> : null}
            {can('reviews:moderate') ? <Link to="/admin/reviews">Reviews</Link> : null}
            {can('popups:manage') ? <Link to="/admin/popups">Site pop-up</Link> : null}
            {can('users:manage') ? <Link to="/admin/team">Staff access</Link> : null}
        </aside>
        <section className="admin-content">
            <p className="eyebrow">{user.role === 'admin' ? 'Full access' : 'Your assigned workspace'}</p>
            <h1>{section === 'books' ? 'Book collection' : section === 'add' ? 'Add a book' : section === 'reviews' ? 'Review moderation' : section === 'popups' ? 'Site pop-up' : section === 'team' ? 'Team access' : 'Orders & support'}</h1>
            {!sectionAllowed && <p className="collection-message">This section is not part of your workspace. Ask an administrator if you need access.</p>}
            {section === 'books' && can('books:write') ? <ManageBook /> : null}
            {section === 'add' && can('books:write') ? <AddBook /> : null}
            {section === 'popups' && can('popups:manage') ? <ManagePopups /> : null}
            {section === 'orders' && (can('orders:manage') || can('support:handle')) ? <div className="admin-list">
                {orders.length === 0 && <p className="collection-message">No orders yet.</p>}
                {orders.map(order => <article className="admin-order" key={order._id}><div><strong>{order.name}</strong><p>{order.customerName} · {order.email}</p><p>Qty {order.quantity} · BDT {order.total} · {new Date(order.createdAt).toLocaleString()}</p><span className={`status-pill status-${order.status}`}>{order.status}</span>{order.supportStaff && <small> On call: {order.supportStaff.name}</small>}</div>
                <div className="admin-actions">{user.role === 'admin' && order.supportStaff && <button className="soft-button" onClick={() => openChat(order)}>Open support chat</button>}{user.role === 'admin' && order.status !== 'on-call' && <button className="soft-button" onClick={() => changeOrder(order._id, 'on-call')}>Take on call</button>}{can('orders:manage') && <Select aria-label="Order status" value={order.status} onChange={event => changeOrder(order._id, event.target.value)}>{['new', 'on-call', 'confirmed', 'shipped', 'completed', 'cancelled'].map(status => <option key={status} disabled={status === 'on-call' && user.role !== 'admin'}>{status}</option>)}</Select>}</div></article>)}
                {chatOrder && <section className="support-chat"><div className="support-chat-heading"><h3>Support conversation</h3><button type="button" onClick={() => setChatOrder('')}>Close</button></div><div className="chat-messages">{chatMessages.map(message => <p key={message._id}><strong>{message.senderName}:</strong> {message.text}</p>)}{chatMessages.length === 0 && <p>No messages yet. Start the conversation.</p>}</div><form onSubmit={sendChat}><input value={chatText} onChange={event => setChatText(event.target.value)} placeholder="Write a message…" maxLength="1600" required /><button className="soft-button">Send</button></form></section>}
            </div> : null}
            {section === 'reviews' && can('reviews:moderate') ? <div className="admin-list">{reviews.map(review => <article className="admin-order" key={review._id}><div><strong>{'★'.repeat(review.rating)} · {review.name}</strong><p>{review.text}</p><span className="status-pill">{review.approved ? 'Approved' : 'Needs approval'}</span></div><div className="admin-actions">{!review.approved && <button className="soft-button" onClick={() => approveReview(review, true)}>Approve</button>}{review.approved && <button className="soft-button" onClick={() => approveReview(review, false)}>Hide</button>}</div></article>)}</div> : null}
            {section === 'team' && can('users:manage') ? <><form className="team-form" onSubmit={updateStaff}><h3>{staffUid ? 'Update team account' : 'Create staff account'}</h3><p>Set the staff member’s email and a temporary password. They can sign in without any external account.</p><label>Name<input value={staffName} onChange={event => setStaffName(event.target.value)} required /></label><label>Email<input type="email" value={staffEmail} onChange={event => setStaffEmail(event.target.value)} required /></label>{(!staffUid || user.role === 'admin') && <label>{staffUid ? 'New password (leave empty to keep existing)' : 'Temporary password'}<input type="password" value={staffPassword} onChange={event => setStaffPassword(event.target.value)} required={!staffUid} minLength="8" /></label>}<label>Role<Select value={staffRole} onChange={event => setStaffRole(event.target.value)}><option value="staff">Staff</option><option value="customer">Customer</option></Select></label><fieldset><legend>Allowed menus and actions</legend>{permissions.filter(permission => user.role === 'admin' || (permission !== 'users:manage' && (can(permission) || staffPermissions.includes(permission)))).map(permission => <label className="check-label" key={permission}><input type="checkbox" checked={staffPermissions.includes(permission)} onChange={event => setStaffPermissions(current => event.target.checked ? [...current, permission] : current.filter(item => item !== permission))} />{labels[permission]}</label>)}</fieldset><button className="soft-button">Save access</button><button className="soft-button" type="button" onClick={() => { setStaffUid(''); setStaffEmail(''); setStaffName(''); setStaffPassword(''); setStaffPermissions([]); }}>New staff</button></form><div className="admin-list">{team.map(member => <div className={`team-row ${member.active ? '' : 'team-inactive'}`} key={member._id}><button className="team-member" onClick={() => editStaff(member)}><strong>{member.name}</strong><span>{member.email} · {member.role} · {(member.permissions || []).length} permissions</span></button><span className={`status-pill ${member.active ? 'status-completed' : 'status-cancelled'}`}>{member.active ? 'Active' : 'Deactivated'}</span>{user.role === 'admin' && member.role !== 'admin' && member._id !== user.uid && (member.active ? <button className="soft-button danger-button" onClick={() => setDeactivating(member)}>Deactivate</button> : <button className="soft-button" onClick={() => setActive(member, true)}>Reactivate</button>)}</div>)}</div></> : null}
        </section>
        {deactivating && <ConfirmModal title="Deactivate this account?" confirmLabel="Deactivate" onConfirm={() => setActive(deactivating, false)} onCancel={() => setDeactivating(null)}><p><strong>{deactivating.name}</strong> ({deactivating.email}) will be signed out immediately and will not be able to sign in until you reactivate the account.</p></ConfirmModal>}
    </div>;
}
export default Admin;
