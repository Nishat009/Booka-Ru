import React, { useContext, useEffect, useState } from 'react';
import { UserContext } from '../../App';
import { Link, useHistory, useLocation } from 'react-router-dom';
import './Login.css';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';

// The API decides whether one-click demo logins are on (GET /auth/demo): DEMO_MODE=true on a public
// demo deployment, or ENABLE_DEMO_LOGINS=true in development. The buttons only show when it says so.
const DEMO_PROFILES = {
    customer: { label: 'Customer', hint: 'Shop, place an order, download the invoice and chat about it' },
    admin: { label: 'Admin', hint: 'Full control: books, orders, chat, reviews, pop-ups, staff' },
    staff: { label: 'Staff', hint: 'Team desk with limited permissions' }
};
// The storefront login offers every role (customer first); the team login offers the admin panel roles.
const ROLE_ORDER = { shop: ['customer', 'admin', 'staff'], team: ['admin', 'staff'] };

const Login = ({ team = false }) => {
    const [newUser, setNewUser] = useState(false);
    const [demoRoles, setDemoRoles] = useState([]);
    const [demoLoginRole, setDemoLoginRole] = useState('');
    const [user, setUser] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [, setLoggedInUser] = useContext(UserContext);
    const notify = useMessages();
    const history = useHistory();
    const location = useLocation();
    const from = location.state?.from || { pathname: team ? '/admin' : '/home' };
    const isNewUser = newUser && !team;

    useEffect(() => {
        let active = true;
        apiRequest('/auth/demo')
            .then(response => { if (active && response.data?.enabled) setDemoRoles(response.data.roles || []); })
            .catch(() => {});
        return () => { active = false; };
    }, []);

    const shownRoles = ROLE_ORDER[team ? 'team' : 'shop'].filter(role => demoRoles.includes(role));

    const handleChange = event => {
        setUser(current => ({
            ...current,
            [event.target.name]: event.target.value
        }));
    };

    const handleSubmit = async event => {
        event.preventDefault();
        try {
            const response = await apiRequest(isNewUser ? '/auth/register' : '/auth/login', {
                method: 'POST', body: JSON.stringify({ name: user.name, email: user.email, password: user.password })
            });
            let account = response.data;
            if (isNewUser) account = (await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: user.password }) })).data;
            window.localStorage.setItem('bookaru_session', account.token);
            setLoggedInUser({ ...account.user, displayName: account.user.name, token: account.token });
            history.replace(from);
        } catch (error) {
            notify.error(error);
        }
    };

    const handleDemoLogin = async role => {
        setDemoLoginRole(role);
        try {
            const response = await apiRequest(`/auth/demo-login/${role}`, { method: 'POST' });
            const account = response.data;
            window.localStorage.setItem('bookaru_session', account.token);
            setLoggedInUser({ ...account.user, displayName: account.user.name, token: account.token });
            history.replace(role === 'customer' ? '/home' : '/admin/orders');
        } catch (error) {
            notify.error(error);
        } finally {
            setDemoLoginRole('');
        }
    };

    return (
        <div className="auth-page">
            <aside className="auth-story">
                <Link to="/home" className="auth-back"><span aria-hidden="true">←</span> Back to the bookshop</Link>
                {team ? <div><p className="auth-story-kicker">BOOKA-RU TEAM DESK</p>
                    <h2>Run the shop.<br />Every <em>chapter</em> of it.</h2>
                    <p>Books and stock, orders and invoices, customer chat, reviews, pop-ups and staff — in one place.</p></div>
                : <div><p className="auth-story-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
                    <h2>A little escape.<br />A whole new <em>world.</em></h2>
                    <p>Your favorite stories, your next discovery, and a shelf that feels like you.</p></div>}
                <img src="/fairytale-books.svg" alt="Enchanted storybooks in a moonlit garden" />
                <span className="auth-story-footer">BOOKA-RU / A HOME FOR CURIOUS MINDS</span>
            </aside>
            <form className="auth-card" onSubmit={handleSubmit}>
                <p className="auth-eyebrow">{team ? 'Admin panel' : 'Welcome to Booka-Ru'}</p>
                <h1>{team ? 'Team sign-in' : isNewUser ? 'Create your account' : 'Welcome back'}</h1>
                <p className="auth-description">{team ? 'Sign in with your admin or staff account.' : isNewUser ? 'Join Booka-Ru to track orders and keep your favourite reads close.' : 'Sign in to save your next great read.'}</p>

                {!isNewUser && shownRoles.length > 0 && <section className="demo-login demo-login-top" aria-label="Demo profiles">
                    <p>{team ? 'Explore the admin panel — one click, no password' : 'Try the demo — one click, no password'}</p>
                    <div className="demo-login-buttons">
                        {shownRoles.map(role => <button key={role} type="button" disabled={Boolean(demoLoginRole)} onClick={() => handleDemoLogin(role)}>
                            <strong>{demoLoginRole === role ? 'Signing in…' : `Sign in as ${DEMO_PROFILES[role].label}`}</strong><small>{DEMO_PROFILES[role].hint}</small>
                        </button>)}
                    </div>
                    <p className="demo-login-or"><span>or sign in with email</span></p>
                </section>}

                {isNewUser && (
                    <label className="auth-field">
                        Your name
                        <input name="name" type="text" autoComplete="name" value={user.name} onChange={handleChange} required />
                    </label>
                )}
                <label className="auth-field">
                    Email address
                    <input name="email" type="email" autoComplete="email" value={user.email} onChange={handleChange} required />
                </label>
                <label className="auth-field">
                    Password
                    <input
                        name="password"
                        type="password"
                        autoComplete={isNewUser ? 'new-password' : 'current-password'}
                        value={user.password}
                        onChange={handleChange}
                        minLength="7"
                        pattern="(?=.*\d).{7,}"
                        title="Use at least 7 characters and include a number."
                        required
                    />
                </label>

                <button className="auth-submit" type="submit" disabled={Boolean(demoLoginRole)}>{isNewUser ? 'Create account' : 'Sign in'}</button>
                {!team && <p className="auth-switch">
                    {isNewUser ? 'Already have an account?' : 'New to Booka-Ru?'}
                    <button type="button" onClick={() => setNewUser(current => !current)}>
                        {isNewUser ? 'Sign in' : 'Create an account'}
                    </button>
                </p>}
                <p className="auth-switch">
                    {team ? <>Shopping for books? <Link to="/login">Customer sign-in</Link></>
                        : <>Booka-Ru team? <Link to="/admin/login">Admin panel sign-in</Link></>}
                </p>
            </form>
        </div>
    );
};

export default Login;
