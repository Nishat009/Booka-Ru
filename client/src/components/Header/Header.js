import React, { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { UserContext } from '../../App';
import './Header.css';
import { apiRequest } from '../../api';

const Header = () => {
    const [loggedInUser, setLoggedInUser, , theme, setTheme] = useContext(UserContext);
    const handleSignOut = async () => {
        try {
            try { await apiRequest('/auth/logout', { method: 'POST' }, loggedInUser); } catch (error) { console.warn('Session sign out could not be confirmed:', error.message); }
            window.localStorage.removeItem('bookaru_session');
            setLoggedInUser({});
        } catch (error) { console.error('Could not sign out:', error); }
    };

    return (
        <header className="site-header">
            <nav className="site-nav" aria-label="Main navigation">
                <Link className="brand" to="/" aria-label="Booka-Ru home">
                    <span className="brand-mark" aria-hidden="true">B</span>
                    <span>Booka-Ru</span>
                </Link>
                <div className="nav-links">
                    <NavLink exact to="/" activeClassName="nav-current">Discover</NavLink>
                    <Link className="nav-collection" to="/#book-collection" onClick={() => window.setTimeout(() => document.getElementById('book-collection')?.scrollIntoView({ behavior: 'smooth' }), 0)}>The collection</Link>
                    <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
                    {loggedInUser.email && <Link to="/orderPreview">My orders</Link>}
                    {loggedInUser.role === 'admin' || loggedInUser.role === 'staff' ? <Link to="/admin/orders">Team desk</Link> : null}
                    {loggedInUser.email ? (
                        <>
                            <span className="nav-user">{loggedInUser.displayName || loggedInUser.email}</span>
                            <button className="nav-action" type="button" onClick={handleSignOut}>Sign out</button>
                        </>
                    ) : (
                        <Link className="nav-login" to="/login">Sign in</Link>
                    )}
                </div>
            </nav>
        </header>
    );
};

export default Header;
