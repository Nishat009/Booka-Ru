import React from "react";
import { Link } from "react-router-dom";
import './SideSlider.css';

const SideSlider = () => {
    return (
        <nav className="admin-sidebar" aria-label="Admin navigation">
            <Link to="/manageBook">Manage books</Link>
            <Link to="/addBook">Add a book</Link>
        </nav>
    );
};

export default SideSlider;