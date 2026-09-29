import React from 'react';
import { ShieldCheck, User, LogOut, CheckCircle2, Cloud } from 'lucide-react';

export default function Navbar({ currentUser, onLogout, onOpenProfile, serverStatus }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo-icon">
          MP
        </div>
        <div className="header-title-wrap">
          <h1>MPOnline Examination Evaluation Portal</h1>
          <p>State Board of Technical & Higher Education, Madhya Pradesh</p>
        </div>
      </div>

      <div className="header-user-status">
        {serverStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#064E3B', background: 'rgba(252, 108, 38, 0.15)', padding: '4px 10px', borderRadius: '4px', border: '1px solid #FC6C26' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#064E3B', display: 'inline-block' }}></span>
            <span>MongoDB Atlas Connected</span>
            {serverStatus.cloudinaryConfigured && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', borderLeft: '1px solid #FC6C26', paddingLeft: '6px', color: '#FC6C26' }}>
                <Cloud size={12} /> Cloudinary CDN
              </span>
            )}
          </div>
        )}

        {currentUser && (
          <>
            <div className="user-badge">
              <span className="user-badge-name">{currentUser.name}</span>
              <span className="user-badge-role">
                {currentUser.role === 'admin' ? 'Admin Cell' :
                 currentUser.role === 'administrator' ? 'Administrator' :
                 currentUser.role === 'university' ? 'University Board' : 'Evaluator'}
              </span>
            </div>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={onOpenProfile}
              title="Edit Profile & Security Credentials with Email OTP"
            >
              <User size={14} />
              Profile
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              title="Sign Out of Portal"
            >
              <LogOut size={14} />
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
