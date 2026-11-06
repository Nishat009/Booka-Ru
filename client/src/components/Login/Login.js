import React, { useContext, useState } from 'react';
import { UserContext } from '../../App';
import { Link, useHistory, useLocation } from 'react-router-dom';
import './Login.css';
import { apiRequest } from '../../api';
import { useMessages } from '../Messages/Messages';

const Login = () => {
    const [newUser, setNewUser] = useState(false);
    const [demoLoginRole, setDemoLoginRole] = useState('');
    const [user, setUser] = useState({
        name: '',
        email: '',
        password: '',
        error: '',
        success: false
    });
    const [, setLoggedInUser] = useContext(UserContext);
    const notify = useMessages();
    const history = useHistory();
    const location = useLocation();
    const from = location.state?.from || { pathname: '/' };

    const handleChange = event => {
        setUser(current => ({
            ...current,
            [event.target.name]: event.target.value,
            error: '',
            success: false
        }));
    };

    const handleSubmit = async event => {
        event.preventDefault();
        try {
            const response = await apiRequest(newUser ? '/auth/register' : '/auth/login', {
                method: 'POST', body: JSON.stringify({ name: user.name, email: user.email, password: user.password })
            });
            let account = response.data;
            if (newUser) account = (await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: user.password }) })).data;
            window.localStorage.setItem('bookaru_session', account.token);
            setLoggedInUser({ ...account.user, displayName: account.user.name, token: account.token });
            setUser(current => ({ ...current, error: '', success: true }));
            history.replace(from);
        } catch (error) {
            notify.error(error);
        }
    };

    const handleDemoLogin = async role => {
        setDemoLoginRole(role);
        setUser(current => ({ ...current, error: '', success: false }));
        try {
            const response = await apiRequest(`/auth/demo-login/${role}`, { method: 'POST' });
            const account = response.data;
            window.localStorage.setItem('bookaru_session', account.token);
            setLoggedInUser({ ...account.user, displayName: account.user.name, token: account.token });
            history.replace(role === 'customer' ? '/orderPreview' : '/admin/orders');
        } catch (error) {
            notify.error(error);
        } finally {
            setDemoLoginRole('');
        }
    };

    return (
        <div className="auth-page">
            <aside className="auth-story">
                <Link to="/" className="auth-back"><span aria-hidden="true">←</span> Back to the bookshop</Link>
                <div><p className="auth-story-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
                <h2>A little escape.<br />A whole new <em>world.</em></h2>
                <p>Your favorite stories, your next discovery, and a shelf that feels like you.</p></div>
                <img src="/fairytale-books.svg" alt="Enchanted storybooks in a moonlit garden" />
                <span className="auth-story-footer">BOOKA-RU / A HOME FOR CURIOUS MINDS</span>
            </aside>
            <form className="auth-card" onSubmit={handleSubmit}>
                <p className="auth-eyebrow">Welcome to Booka-Ru</p>
                <h1>{newUser ? 'Create your account' : 'Welcome back'}</h1>
                <p className="auth-description">{newUser ? 'Join Booka-Ru to track orders and keep your favourite reads close.' : 'Sign in to save your next great read.'}</p>

                {newUser && (
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
                        autoComplete={newUser ? 'new-password' : 'current-password'}
                        value={user.password}
                        onChange={handleChange}
                        minLength="7"
                        pattern="(?=.*\d).{7,}"
                        title="Use at least 7 characters and include a number."
                        required
                    />
                </label>

                {user.error && <p className="auth-error" role="alert">{user.error}</p>}
                {user.success && <p className="auth-success" role="status">Your account is ready.</p>}
                <button className="auth-submit" type="submit" disabled={Boolean(demoLoginRole)}>{newUser ? 'Create account' : 'Sign in'}</button>
                <p className="auth-switch">
                    {newUser ? 'Already have an account?' : 'New to Booka-Ru?'}
                    <button type="button" onClick={() => {
                        setNewUser(current => !current);
                        setUser(current => ({ ...current, error: '', success: false }));
                    }}>
                        {newUser ? 'Sign in' : 'Create an account'}
                    </button>
                </p>
                {!newUser && process.env.NODE_ENV !== 'production' && <section className="demo-login" aria-label="Demo profiles">
                    <p>ডেমো প্রোফাইলে দ্রুত প্রবেশ</p>
                    <div className="demo-login-buttons">
                        {[['admin', 'অ্যাডমিন হিসেবে প্রবেশ'], ['staff', 'স্টাফ হিসেবে প্রবেশ'], ['customer', 'কাস্টমার হিসেবে প্রবেশ']].map(([role, label]) => <button key={role} type="button" disabled={Boolean(demoLoginRole)} onClick={() => handleDemoLogin(role)}>
                            {demoLoginRole === role ? 'প্রবেশ করা হচ্ছে…' : label}
                        </button>)}
                    </div>
                </section>}
            </form>
        </div>
    );
};

export default Login;
