import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import './PromoModal.css';

const seenKey = popup => `bookaru_popup_${popup._id}_${popup.updatedAt}`;
const readSeen = key => { try { return window.sessionStorage.getItem(key); } catch (error) { return null; } };
const writeSeen = key => { try { window.sessionStorage.setItem(key, '1'); } catch (error) { /* storage unavailable */ } };

const PromoModal = () => {
    const [popup, setPopup] = useState(null);
    const closeRef = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        apiRequest('/popups/active', { signal: controller.signal })
            .then(({ data }) => { if (data && data.imageURL && !readSeen(seenKey(data))) setPopup(data); })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    const close = () => { if (popup) writeSeen(seenKey(popup)); setPopup(null); };

    useEffect(() => {
        if (!popup) return;
        closeRef.current?.focus();
        const onKey = event => { if (event.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [popup]);

    if (!popup) return null;
    const image = <img src={popup.imageURL} alt={popup.title || 'Special offer'} />;
    const external = /^https?:\/\//i.test(popup.linkURL || '');
    return <div className="promo-backdrop" onClick={close}>
        <div className="promo-modal" role="dialog" aria-modal="true" aria-label={popup.title || 'Special offer'} onClick={event => event.stopPropagation()}>
            <button ref={closeRef} type="button" className="promo-close" aria-label="Close pop-up" onClick={close}>×</button>
            {popup.linkURL ? <a href={popup.linkURL} onClick={close} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{image}</a> : image}
        </div>
    </div>;
};

export default PromoModal;
