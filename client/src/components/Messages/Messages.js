import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import './Messages.css';

const MessageContext = createContext(null);
const LIFETIME = { success: 5000, info: 5000, warning: 8000, error: 9000 };

// Single store for every message the UI shows. Text always comes from the backend response; the UI never writes its own.
export function MessageProvider({ children }) {
    const [messages, setMessages] = useState([]);
    const counter = useRef(0);
    const dismiss = useCallback(id => setMessages(current => current.filter(item => item.id !== id)), []);
    const clear = useCallback(() => setMessages([]), []);
    const push = useCallback((type, text, code) => {
        if (!text) return;
        const id = ++counter.current;
        setMessages(current => [...current.filter(item => !(item.type === type && item.text === text)), { id, type, text, code }]);
        window.setTimeout(() => dismiss(id), LIFETIME[type] || 6000);
    }, [dismiss]);
    const api = useMemo(() => ({
        messages, dismiss, clear,
        success: text => push('success', text),
        info: text => push('info', text),
        warning: text => push('warning', text),
        // Accepts an ApiError (shows every error in its errors array) or any Error.
        error: failure => (failure?.errors?.length ? failure.errors : [{ message: failure?.message }]).forEach(item => push('error', item.message, item.code))
    }), [messages, dismiss, clear, push]);
    return <MessageContext.Provider value={api}>{children}<MessageCenter /></MessageContext.Provider>;
}

export const useMessages = () => useContext(MessageContext);

function MessageCenter() {
    const { messages, dismiss, clear } = useContext(MessageContext);
    if (!messages.length) return null;
    return <div className="message-center" aria-live="polite">
        {messages.length > 1 && <button type="button" className="message-clear" onClick={clear}>Clear all</button>}
        {messages.map(item => <div key={item.id} className={`message-toast message-${item.type}`} role={item.type === 'error' ? 'alert' : 'status'}>
            <span className="message-text">{item.text}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => dismiss(item.id)}>×</button>
        </div>)}
    </div>;
}
