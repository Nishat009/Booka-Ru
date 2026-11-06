import React, { useEffect, useRef, useState } from 'react';
import './Fields.css';

// Closes a popover when the user clicks elsewhere or presses Escape.
function useDismiss(open, close, ref) {
    useEffect(() => {
        if (!open) return;
        const onDown = event => { if (ref.current && !ref.current.contains(event.target)) close(); };
        const onKey = event => { if (event.key === 'Escape') close(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open, close, ref]);
}

const textOf = node => React.Children.toArray(node).map(child => typeof child === 'object' ? textOf(child.props?.children) : String(child)).join('');

// Drop-in replacement for <select>: same <option> children, name/value/defaultValue/onChange, but styled with the site theme.
export function Select({ children, name, value, defaultValue, onChange, id, className = '', disabled, 'aria-label': ariaLabel }) {
    const options = React.Children.toArray(children).filter(child => child?.type === 'option')
        .map(child => ({ value: String(child.props.value ?? textOf(child.props.children)), label: textOf(child.props.children) }));
    const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''));
    const current = value !== undefined ? String(value) : inner;
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const rootRef = useRef(null);
    const close = () => setOpen(false);
    useDismiss(open, close, rootRef);
    const selected = options.find(option => option.value === current);
    const choose = option => {
        setInner(option.value); setOpen(false);
        if (onChange) onChange({ target: { name, value: option.value } });
    };
    const openList = () => { setActive(Math.max(0, options.findIndex(option => option.value === current))); setOpen(true); };
    const onKeyDown = event => {
        if (disabled) return;
        if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openList(); return; }
        if (!open) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(options.length - 1, index + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (options[active]) choose(options[active]); }
        else if (event.key === 'Tab') close();
    };
    return <div className={`themed-select ${className}`} ref={rootRef}>
        {name && <input type="hidden" name={name} value={current} />}
        <button type="button" id={id} className="themed-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled}
            onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}>
            <span>{selected?.label ?? ''}</span><i aria-hidden="true" />
        </button>
        {open && <ul className="themed-list" role="listbox">
            {options.map((option, index) => <li key={option.value} role="option" aria-selected={option.value === current}
                className={`${option.value === current ? 'chosen' : ''} ${index === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(index)} onMouseDown={event => { event.preventDefault(); choose(option); }}>{option.label}</li>)}
        </ul>}
    </div>;
}

const pad = number => String(number).padStart(2, '0');
const toIso = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const parseIso = text => { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || ''); return match ? { year: +match[1], month: +match[2] - 1, day: +match[3] } : null; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const display = text => { const parts = parseIso(text); return parts ? `${pad(parts.day)} ${MONTHS[parts.month].slice(0, 3)} ${parts.year}` : ''; };

// Themed calendar. Values are plain YYYY-MM-DD strings, so it works with FormData (name) and controlled state (value/onChange).
export function DatePicker({ name, value, defaultValue, onChange, min, max, id, placeholder = 'Select a date', className = '', 'aria-label': ariaLabel }) {
    const [inner, setInner] = useState(defaultValue || '');
    const current = value !== undefined ? value : inner;
    const today = new Date();
    const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
    const start = parseIso(current) || { year: today.getFullYear(), month: today.getMonth() };
    const [view, setView] = useState({ year: start.year, month: start.month });
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const close = () => setOpen(false);
    useDismiss(open, close, rootRef);
    const shift = months => setView(({ year, month }) => { const total = year * 12 + month + months; return { year: Math.floor(total / 12), month: total % 12 }; });
    const pick = iso => {
        if ((min && iso < min) || (max && iso > max)) return;
        setInner(iso); setOpen(false);
        if (onChange) onChange({ target: { name, value: iso } });
    };
    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
    return <div className={`themed-date ${className}`} ref={rootRef}>
        {name && <input type="hidden" name={name} value={current || ''} />}
        <button type="button" id={id} className="themed-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}
            onClick={() => { if (!open) setView({ year: start.year, month: start.month }); setOpen(!open); }}>
            <span className={current ? '' : 'placeholder'}>{display(current) || placeholder}</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16"><rect x="3" y="4.5" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 8.5h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        {open && <div className="calendar" role="dialog" aria-label="Choose a date">
            <div className="calendar-head">
                <button type="button" aria-label="Previous year" onClick={() => shift(-12)}>«</button>
                <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
                <strong>{MONTHS[view.month]} {view.year}</strong>
                <button type="button" aria-label="Next month" onClick={() => shift(1)}>›</button>
                <button type="button" aria-label="Next year" onClick={() => shift(12)}>»</button>
            </div>
            <div className="calendar-grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}
                {cells.map((day, index) => {
                    if (!day) return <span key={`blank-${index}`} />;
                    const iso = toIso(view.year, view.month, day);
                    const blocked = (min && iso < min) || (max && iso > max);
                    return <button type="button" key={iso} disabled={blocked} onClick={() => pick(iso)}
                        className={`${iso === current ? 'chosen' : ''} ${iso === todayIso ? 'today' : ''}`} aria-pressed={iso === current}>{day}</button>;
                })}
            </div>
            <div className="calendar-foot">
                <button type="button" onClick={() => { setInner(''); setOpen(false); if (onChange) onChange({ target: { name, value: '' } }); }}>Clear</button>
                <button type="button" disabled={(min && todayIso < min) || (max && todayIso > max)} onClick={() => pick(todayIso)}>Today</button>
            </div>
        </div>}
    </div>;
}
