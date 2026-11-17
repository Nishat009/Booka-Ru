import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const FEATURES = [
    ['Bangla & English shelves', 'A hand-picked catalogue of 50+ books with covers, genres, language filters and live stock counts.'],
    ['Checkout and PDF invoices', 'Customers order in a few taps, track status, and download a printable invoice for every order.'],
    ['Team desk for owners', 'Manage books, orders, reviews, pop-ups and staff permissions from one workspace.'],
    ['Order chat and calls', 'Customers talk to the shop about an order; the admin can take the call and reply in chat.'],
    ['Role-based access', 'Admin, staff and customer roles, enforced on the API, not just hidden in the interface.'],
    ['Light and dark themes', 'A warm, readable design that adapts to phones, tablets, desktops and your theme choice.']
];
const SHOTS = [
    ['home.png', 'Storefront', 'A calm, editorial home page with a curated reading table.'],
    ['orders.png', 'Customer orders', 'Order history, status, invoices and chat in one place.'],
    ['admin.png', 'Admin desk', 'Orders and support for the shop owner, with live status control.'],
    ['dark.png', 'Dark mode', 'The same storefront, comfortable at night.']
];
const STACK = ['React 18', 'Node.js 22', 'Express', 'MongoDB', 'PDFKit', 'Docker'];
const ROLES = [['Admin', 'Everything: books, orders, reviews, pop-ups and staff.'], ['Staff', 'Only the permissions the admin grants.'], ['Customer', 'Browse, order, track and chat.']];

const Landing = () => (
    <div className="landing">
        <section className="landing-hero">
            <div className="landing-hero-copy">
                <p className="landing-kicker">Online bookshop · Dhaka</p>
                <h1>Sell Bangla and English books <em>beautifully.</em></h1>
                <p className="landing-lead">Booka-Ru is a complete bookshop you can run today: a polished storefront, secure checkout, invoices, order chat and a team desk for your staff.</p>
                <div className="landing-cta">
                    <Link className="landing-btn landing-btn-primary" to="/login">Live Demo <span aria-hidden="true">→</span></Link>
                    <Link className="landing-btn landing-btn-ghost" to="/admin/login">Admin Panel Demo</Link>
                    <Link className="landing-btn landing-btn-ghost" to="/home">Browse the shop</Link>
                </div>
                <p className="landing-note">Sign in as Admin, Staff or Customer with one click. No password needed.</p>
                <ul className="landing-stack" aria-label="Tech stack">{STACK.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="landing-hero-shot"><img src="/landing/home.png" alt="Booka-Ru storefront" /></div>
        </section>

        <section className="landing-section" id="features">
            <p className="landing-kicker">Key features</p>
            <h2>Everything a bookshop needs</h2>
            <div className="landing-grid">{FEATURES.map(([title, text], index) => <article key={title} className="landing-card"><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className="landing-section" id="screenshots">
            <p className="landing-kicker">Screenshots</p>
            <h2>See it in action</h2>
            <div className="landing-shots">{SHOTS.map(([file, title, text]) => <figure key={file}><img src={`/landing/${file}`} alt={title} loading="lazy" /><figcaption><strong>{title}</strong>{text}</figcaption></figure>)}</div>
        </section>

        <section className="landing-section landing-benefits">
            <div>
                <p className="landing-kicker">Benefits</p>
                <h2>Ready to explore, ready to launch</h2>
                <ul>
                    <li>Start selling quickly with a seeded 50+ book catalogue.</li>
                    <li>Secure by design: hashed passwords, hashed session tokens, server-side permissions.</li>
                    <li>Deploy anywhere: Docker Compose, Render, Vercel, MongoDB Atlas.</li>
                    <li>Clear docs, migrations and tests so your team can extend it.</li>
                </ul>
            </div>
            <div className="landing-roles">
                <h3>Try every role</h3>
                {ROLES.map(([role, text]) => <p key={role}><strong>{role}</strong>{text}</p>)}
                <Link className="landing-btn landing-btn-primary" to="/login">Open the Live Demo <span aria-hidden="true">→</span></Link>
                <Link className="landing-btn landing-roles-admin" to="/admin/login">Open the Admin Panel</Link>
            </div>
        </section>

        <footer className="landing-footer">© Booka-Ru · <Link to="/home">Shop</Link> · <Link to="/login">Live Demo</Link> · <Link to="/admin/login">Admin Demo</Link></footer>
    </div>
);

export default Landing;
