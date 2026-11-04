import React, { createContext, useEffect, useState } from 'react';
import './App.css';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation
} from "react-router-dom";
import Header from './components/Header/Header';
import Home from './components/Home/Home';
import Login from './components/Login/Login';
import NotFound from './components/noMatch/noMatch';
import PrivateRoute from './components/PrivateRoute/PrivateRoute';
import Admin from './components/Admin/Admin';
import CheckOut from './components/CheckOut/CheckOut';
import OrderPreview from './components/OrderPreview/OrderPreview';
import ThankYou from './components/ThankYou/ThankYou';
import { apiRequest } from './api';

export const UserContext = createContext();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const [loggedInUser, setLoggedInUser] = useState({});
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState(() => window.localStorage.getItem('bookaru_theme') || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('bookaru_theme', theme);
  }, [theme]);
  useEffect(() => {
    const token = window.localStorage.getItem('bookaru_session');
    if (!token) { setAuthReady(true); return; }
    apiRequest('/auth/me', {}, { token }).then(response => response.json()).then(profile => setLoggedInUser({ ...profile, displayName: profile.name, token }))
      .catch(() => { window.localStorage.removeItem('bookaru_session'); setLoggedInUser({}); })
      .finally(() => setAuthReady(true));
  }, []);
  return (
    <UserContext.Provider value={[loggedInUser, setLoggedInUser, authReady, theme, setTheme]}>
      <Router>
        <ScrollToTop />
        <Header />
        <main>
          <Switch>
            <Route path={["/home", "/"]} exact>
              <Home />
            </Route>
            <PrivateRoute path={["/admin", "/admin/:section", "/addBook", "/manageBook"]} staff>
              <Admin />
            </PrivateRoute>
            <Route path="/login">
              <Login />
            </Route>
            <PrivateRoute path="/checkOut/:id">
              <CheckOut />
            </PrivateRoute>
            <PrivateRoute path="/checkOut">
              <CheckOut />
            </PrivateRoute>
            <PrivateRoute path="/orderPreview">
              <OrderPreview />
            </PrivateRoute>
            <PrivateRoute path="/thank">
              <ThankYou />
            </PrivateRoute>
            <Route path="*">
              <NotFound />
            </Route>
          </Switch>
        </main>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
