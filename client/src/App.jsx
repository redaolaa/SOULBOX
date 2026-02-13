import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Calendar from './components/Calendar';
import ExerciseManager from './components/ExerciseManager';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }
  
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }
  
  return user ? <Navigate to="/" replace /> : children;
};

const Dashboard = () => {
  const [currentView, setCurrentView] = useState('calendar');
  const { user } = useAuth();

  // Check if user just registered (stored in sessionStorage)
  useEffect(() => {
    const justRegistered = sessionStorage.getItem('justRegistered');
    if (justRegistered === 'true') {
      setCurrentView('exercises');
      sessionStorage.removeItem('justRegistered');
    }
  }, []);

  return (
    <div className="app">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="main-content">
        {currentView === 'calendar' && <Calendar />}
        {currentView === 'exercises' && <ExerciseManager />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
