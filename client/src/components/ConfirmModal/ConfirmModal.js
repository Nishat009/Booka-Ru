import React, { useEffect, useRef } from 'react';
import './ConfirmModal.css';

function ConfirmModal({ title = 'Are you sure?', children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', busy = false, onConfirm, onCancel }) {
    const confirmRef = useRef(null);
    useEffect(() => {
        confirmRef.current?.focus();
        const onKey = event => { if (event.key === 'Escape' && !busy) onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);
    return <div className="confirm-backdrop" onClick={() => !busy && onCancel()}>
        <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={event => event.stopPropagation()}>
            <h2 id="confirm-title">{title}</h2>
            <div className="confirm-body">{children}</div>
            <div className="confirm-actions">
                <button type="button" className="confirm-cancel" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
                <button type="button" ref={confirmRef} className="confirm-ok" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
            </div>
        </div>
    </div>;
}

export default ConfirmModal;
