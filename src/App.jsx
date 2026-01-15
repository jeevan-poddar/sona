import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SmileGame from "./components/SmileGame";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import "./App.css";

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const handleAdminLogin = () => {
    setIsAdminLoggedIn(true);
    // Store in sessionStorage so it persists during the session
    sessionStorage.setItem("adminLoggedIn", "true");
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem("adminLoggedIn");
    navigate("/baka");
  };

  // Check if admin was already logged in (for page refresh)
  React.useEffect(() => {
    const loggedIn = sessionStorage.getItem("adminLoggedIn");
    if (loggedIn) {
      setIsAdminLoggedIn(true);
    }
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<SmileGame />} />
          <Route
            path="/baka"
            element={
              isAdminLoggedIn ? (
                <AdminDashboard onLogout={handleAdminLogout} />
              ) : (
                <AdminLogin onLogin={handleAdminLogin} />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}
