import { ShieldCheck, User, LogOut, CheckCircle2, Cloud, Search, Repeat, Sparkles, Sun, Moon, Landmark } from 'lucide-react';
import { MessageCircleDashedCheck } from 'lucide-react';
export default function Navbar({ currentUser, onLogout, onOpenProfile, serverStatus, themeMode = 'dark', onToggleTheme }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo-icon">
          <MessageCircleDashedCheck />
        </div>
        <div className="header-title-wrap">
          <h1 className="header-title-text">Digital On-Screen Marking Portal</h1>
        </div>
      </div>

      <div className="header-user-status">
        {/* Universal Theme Mode Switcher: Dark Mode (Admin UI) <-> Light Mode (University UI) */}
        <button 
          type="button" 
          className="theme-mode-toggle-btn"
          onClick={onToggleTheme}
          title={themeMode === 'dark' ? 'Switch to Light Mode (University Board UI)' : 'Switch to Dark Mode (Administrator UI)'}
          aria-label="Toggle Portal Theme Mode"
        >
          <span className="theme-toggle-icon-wrap">
            {themeMode === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
          </span>
          <span className="theme-toggle-label">
            {themeMode === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        {serverStatus && serverStatus.cloudinaryConfigured && (
          <div className="server-status-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
            <Cloud size={12} />
            <span>CDN</span>
          </div>
        )}

        {currentUser && (
          <>
            {(currentUser.universityName || currentUser.universityCode) && (
              <div 
                className="server-status-pill" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '11.5px', 
                  fontWeight: 700, 
                  padding: '4px 10px', 
                  borderRadius: '8px', 
                  whiteSpace: 'nowrap',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: 'var(--text-main)'
                }}
                title={`Connected to isolated database for ${currentUser.universityName || currentUser.universityCode}`}
              >
                <Landmark size={13} color="#f59e0b" />
                <span>{currentUser.universityCode || currentUser.universityName}</span>
              </div>
            )}
            <div className="user-badge" style={{ whiteSpace: 'nowrap' }}>
              <span className="user-badge-name" style={{ fontSize: '12.5px' }}>{currentUser.name}</span>
              <span className="user-badge-role" style={{ fontSize: '9.5px' }}>
                {currentUser.role === 'admin' ? 'Admin Cell' :
                 currentUser.role === 'administrator' ? 'Administrator' :
                 currentUser.role === 'university' ? 'University Board' : 'Evaluator'}
              </span>
            </div>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={onOpenProfile}
              title="Edit Profile & Security Credentials with Email OTP"
              style={{ whiteSpace: 'nowrap', padding: '4px 10px', fontSize: '12px' }}
            >
              <User size={13} />
              Profile
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              title="Sign Out of Portal"
              style={{ whiteSpace: 'nowrap', padding: '4px 10px', fontSize: '12px' }}
            >
              <LogOut size={13} />
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
