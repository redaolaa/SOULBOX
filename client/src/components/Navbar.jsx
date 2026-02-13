import { useAuth } from '../context/AuthContext';

const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <h1>SOULBOX</h1>
      </div>
      <div className="nav-links">
        <button
          className={currentView === 'calendar' ? 'active' : ''}
          onClick={() => setCurrentView('calendar')}
        >
          Calendar
        </button>
        <button
          className={currentView === 'exercises' ? 'active' : ''}
          onClick={() => setCurrentView('exercises')}
        >
          Exercise Lab
        </button>
      </div>
      <div className="nav-user">
        <span>Welcome, {user?.name || user?.username}</span>
        <button className="btn-secondary btn-small" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
