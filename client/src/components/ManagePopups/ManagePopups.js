import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../App';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';
import { DatePicker } from '../Fields/Fields';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

const toInput = value => value ? new Date(value).toISOString().slice(0, 10) : '';

function ManagePopups() {
    const [user] = useContext(UserContext);
    const [popups, setPopups] = useState([]);
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);
    const notify = useMessages();
    const load = async () => { const { data } = await apiRequest('/admin/popups', {}, user); setPopups(data); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load().catch(error => notify.error(error)); }, []);

    const submit = async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form));
        data.active = form.elements.active.checked;
        try {
            const { message } = await apiRequest(editing?._id ? `/admin/popups/${editing._id}` : '/admin/popups', { method: editing?._id ? 'PUT' : 'POST', body: JSON.stringify(data) }, user);
            notify.success(message);
            setEditing(null); form.reset(); load();
        } catch (error) { notify.error(error); }
    };
    const toggle = async popup => { try { const { message } = await apiRequest(`/admin/popups/${popup._id}`, { method: 'PATCH', body: JSON.stringify({ active: !popup.active }) }, user); notify.success(message); load(); } catch (error) { notify.error(error); } };
    const remove = async popup => { try { const { message } = await apiRequest(`/admin/popups/${popup._id}`, { method: 'DELETE' }, user); notify.success(message); load(); } catch (error) { notify.error(error); } finally { setRemoving(null); } };
    const current = editing || {};

    return <div className="book-management">
        <p>Visitors see the newest active pop-up once per browser session when they open the site.</p>
        <form className="team-form" key={current._id || 'new'} onSubmit={submit}>
            <h3>{current._id ? 'Edit pop-up' : 'New pop-up'}</h3>
            <label>Image URL<input name="imageURL" type="text" defaultValue={current.imageURL || ''} placeholder="https://… or /promo.jpg" required /></label>
            <label>Link when clicked (optional)<input name="linkURL" type="text" defaultValue={current.linkURL || ''} placeholder="https://… or /login" /></label>
            <label>Title (for screen readers)<input name="title" defaultValue={current.title || ''} placeholder="Winter sale" /></label>
            <div className="book-edit-grid">
                <label>Show from (optional)<DatePicker name="startsAt" defaultValue={toInput(current.startsAt)} placeholder="Any time" /></label>
                <label>Show until (optional)<DatePicker name="endsAt" defaultValue={toInput(current.endsAt)} placeholder="No end" /></label>
            </div>
            <label className="check-label"><input name="active" type="checkbox" defaultChecked={current.active !== false} /> Active</label>
            <div className="admin-actions"><button className="soft-button">{current._id ? 'Save changes' : 'Create pop-up'}</button>{current._id && <button type="button" className="soft-button" onClick={() => setEditing(null)}>Cancel</button>}</div>
        </form>
        <div className="admin-list">
            {popups.length === 0 && <p className="collection-message">No pop-ups yet.</p>}
            {popups.map(popup => <article className="admin-order" key={popup._id}>
                <div><img src={popup.imageURL} alt="" style={{ width: 90, borderRadius: 4, marginBottom: 8 }} /><p>{popup.title || 'Untitled pop-up'}</p><span className={`status-pill ${popup.active ? 'status-completed' : ''}`}>{popup.active ? 'Active' : 'Hidden'}</span></div>
                <div className="admin-actions"><button className="soft-button" onClick={() => setEditing(popup)}>Edit</button><button className="soft-button" onClick={() => toggle(popup)}>{popup.active ? 'Hide' : 'Show'}</button><button className="soft-button danger-button" onClick={() => setRemoving(popup)}>Delete</button></div>
            </article>)}
        </div>
        {removing && <ConfirmModal title="Delete this pop-up?" confirmLabel="Delete" onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)}><p>{removing.title || 'Untitled pop-up'} will be deleted permanently.</p></ConfirmModal>}
    </div>;
}
export default ManagePopups;
