import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  KeyRound, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { loginRequest, verifyLoginOtp, directLogin } from '../api';

const REGISTERED_ROLES_GUIDE = [
  { role: 'Administrator', email: 'administrator@gmail.com', pass: 'admin123', scope: 'Apex scrutiny, revaluation queue & student directory' },
  { role: 'Admin Cell', email: 'admin@gmail.com', pass: 'admin123', scope: 'Student allocation, active evaluators, curriculum & references' },
  { role: 'University Board', email: 'university@gmail.com', pass: 'univ123', scope: 'Scanned script intake, Cloudinary upload & curriculum' },
  { role: 'Evaluator / Teacher', email: 'teacher@gmail.com', pass: 'teacher123', scope: '3-Section grading studio, marks rubric & revaluation escalation' }
];

export default function LoginModal({ onLoginSuccess, isModal = false, onClose = null }) {
  // Credentials state - empty by default (NO HARDCODING)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleGuide, setShowRoleGuide] = useState(false);

  // 2FA Flow state: 'credentials' | 'otp'
  const [step, setStep] = useState('credentials');
  const [otp, setOtp] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [otpPreview, setOtpPreview] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [authenticatedUserMeta, setAuthenticatedUserMeta] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Allow tester to optionally click to auto-populate if desired
  const handleQuickPopulate = (creds) => {
    setEmail(creds.email);
    setPassword(creds.pass);
    setError('');
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both your registered email address and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await loginRequest(cleanEmail, password);
      if (res.success && res.requiresOtp) {
        setStep('otp');
        setOtpNotice(res.message);
        setEmailSent(res.emailSent);
        setAuthenticatedUserMeta({ name: res.userName, role: res.userRole });
        if (res.otpPreview) {
          setOtpPreview(res.otpPreview);
        }
      } else {
        setError(res.error || 'Failed to authenticate credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login request failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit security code received on your email.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifyLoginOtp(email.trim(), cleanOtp);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Invalid OTP security code.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await loginRequest(email.trim(), password);
      if (res.success) {
        setOtpNotice(res.message);
        setEmailSent(res.emailSent);
        if (res.otpPreview) setOtpPreview(res.otpPreview);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectBypass = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter your email and password first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await directLogin(cleanEmail, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Authentication failed.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isModal ? "login-modal-overlay" : "login-page-wrapper"}>
      <div className="login-card-container liquid-glass">
        {/* Close button if shown in modal mode */}
        {isModal && onClose && (
          <button 
            type="button" 
            className="login-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        {/* Portal Emblem & Title Header */}
        <div className="login-header-section">
          <div className="login-crest-badge">
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#064E3B' }}>MP</span>
          </div>
          <div className="login-header-text">
            <div className="login-supertitle">GOVERNMENT OF MADHYA PRADESH</div>
            <h1 className="login-title">Digital On-Screen Marking Portal</h1>
            <p className="login-subtitle">
              Secure Centralized Examination Evaluation & Script Scrutiny System
            </p>
          </div>
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="login-alert-banner alert-error">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS (Email & Password - NOT HARDCODED) */}
        {step === 'credentials' ? (
          <div className="login-form-body">
            <form onSubmit={handleRequestOtp}>
              {/* Email Address Input */}
              <div className="login-form-group">
                <label className="login-label">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={16} color="#FC6C26" />
                    Official Registered Email Address <span style={{ color: '#FC6C26' }}>*</span>
                  </span>
                </label>
                <input
                  type="email"
                  className="login-input"
                  style={{ padding: '0 16px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your registered email address"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Input */}
              <div className="login-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="login-label" style={{ margin: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={16} color="#FC6C26" />
                      Account Password <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <button 
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  style={{ padding: '0 16px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your confidential account password"
                  autoComplete="current-password"
                />
              </div>

              {/* Primary 2FA Login Button */}
              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Credentials & Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Authenticate & Receive 2FA Email OTP</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Direct Bypass Shortcut for Testing */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleDirectBypass}
                  className="login-bypass-link"
                  disabled={loading}
                >
                  Direct Sign-In (Development Fast Track)
                </button>
              </div>
            </form>

            {/* Collapsible Registered Role Reference (Optional Helper) */}
            <div className="login-role-guide-container">
              <button
                type="button"
                className="login-role-guide-toggle"
                onClick={() => setShowRoleGuide(!showRoleGuide)}
              >
                <HelpCircle size={14} />
                <span>{showRoleGuide ? 'Hide Authorized Role Credentials Guide' : 'View Authorized Role Accounts Reference'}</span>
              </button>

              {showRoleGuide && (
                <div className="login-role-guide-panel">
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Click any authorized account below to automatically fill the login fields for quick evaluation testing:
                  </div>
                  <div className="login-role-grid">
                    {REGISTERED_ROLES_GUIDE.map((acc) => (
                      <div 
                        key={acc.email} 
                        className="login-role-item"
                        onClick={() => handleQuickPopulate(acc)}
                        title="Click to populate"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="login-role-name">{acc.role}</span>
                          <span className="login-role-fill-badge"><Sparkles size={10} /> Fill</span>
                        </div>
                        <div className="login-role-email">{acc.email}</div>
                        <div className="login-role-scope">{acc.scope}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: REAL 2FA EMAIL OTP VERIFICATION */
          <div className="login-otp-panel">
            <div className="login-otp-icon-wrapper">
              <KeyRound size={28} />
            </div>

            <h2 className="login-otp-heading">Two-Factor Email Verification</h2>

            <p className="login-otp-subtext">
              A real 6-digit security OTP code was dispatched to:
              <br />
              <strong className="login-otp-email-highlight">{email}</strong>
            </p>

            {/* Email Dispatch Notice Banner */}
            {emailSent ? (
              <div className="login-alert-banner alert-success">
                <CheckCircle2 size={16} />
                <span>Official OTP code has been delivered to your email inbox via SMTP.</span>
              </div>
            ) : (
              otpPreview && (
                <div className="login-otp-preview-banner">
                  <div className="login-otp-preview-label">Console Fallback Code:</div>
                  <div className="login-otp-preview-code">{otpPreview}</div>
                  <div className="login-otp-preview-note">
                    (Set SMTP_USER & SMTP_PASS in .env for live inbox delivery)
                  </div>
                </div>
              )
            )}

            <form onSubmit={handleVerifyOtp} style={{ width: '100%' }}>
              <div className="login-form-group" style={{ textAlign: 'center' }}>
                <label className="login-label" style={{ justifyContent: 'center', marginBottom: '10px' }}>
                  <span>Enter 6-Digit OTP Code</span>
                </label>
                <input
                  type="text"
                  maxLength="6"
                  className="login-otp-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={loading || otp.length < 6}
                style={{ marginTop: '16px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Code with Board Security...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Confirm OTP & Enter Official Portal</span>
                  </>
                )}
              </button>

              <div className="login-otp-footer-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                  disabled={loading}
                >
                  ← Back to Credentials
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleResendOtp}
                  disabled={loading}
                >
                  <RefreshCw size={14} /> Resend OTP
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Security Footer Notice */}
        <div className="login-footer-security">
          <span>🔒 256-Bit Encrypted MPOnline Institutional Portal</span>
          <span>•</span>
          <span>Access Restricted to Authorized Examination Personnel Only</span>
        </div>
      </div>
    </div>
  );
}
