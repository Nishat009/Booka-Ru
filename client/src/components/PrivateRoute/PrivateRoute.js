import React, { useContext } from 'react';
import { Redirect, Route } from 'react-router';
import { UserContext } from '../../App';

const PrivateRoute = ({ children, staff, ...rest }) => {

    const [loggedInUser, , authReady] = useContext(UserContext);

    return (
        <Route
            {...rest}
            render={({ location }) =>
                !authReady ? <div className="page-message">Checking your account…</div> : loggedInUser.email ? (
                    staff && loggedInUser.role === 'customer' ? <Redirect to={{ pathname: '/admin/login', state: { from: location, message: 'This area is for the Booka-Ru team.' } }} /> :
                    children
                ) : (
                    <Redirect
                        to={{
                            // The team area has its own sign-in screen (with the Admin / Staff demo buttons).
                            pathname: staff ? "/admin/login" : "/login",
                            state: { from: location }
                        }}
                    />
                )
            }
        />
    );
};

export default PrivateRoute;
