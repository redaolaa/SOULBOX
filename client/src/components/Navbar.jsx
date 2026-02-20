import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout, changePassword } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleOpenPasswordModal = () => {
    setShowPasswordModal(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordSuccess(true);
      setTimeout(() => handleClosePasswordModal(), 1500);
    } else {
      setPasswordError(result.error);
    }
  };

  return (
    <>
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
          <button type="button" className="btn-secondary btn-small" onClick={handleOpenPasswordModal}>
            Change password
          </button>
          <button className="btn-secondary btn-small" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="modal-content change-password-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change password</h3>
            {passwordSuccess ? (
              <p className="modal-success">Password updated successfully.</p>
            ) : (
              <form onSubmit={handleSubmitPassword}>
                <div className="form-group">
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                {passwordError && <p className="form-error">{passwordError}</p>}
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={handleClosePasswordModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
