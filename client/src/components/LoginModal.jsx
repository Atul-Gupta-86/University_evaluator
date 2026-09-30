import React, { useState, useEffect } from 'react';
import { MessageCircleDashedCheck } from 'lucide-react';
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
  Sparkles,
  Landmark,
  Building2,
  MapPin,
  UserCheck,
  Database,
  FileCheck2
} from 'lucide-react';
import { loginRequest, verifyLoginOtp, directLogin, getUniversities, registerUniversity } from '../api';

export default function LoginModal({ onLoginSuccess, isModal = false, onClose = null, themeMode = 'dark', onToggleTheme }) {
  // Mode: 'signin' | 'register-univ'
  const [activeTab, setActiveTab] = useState('signin');

  // Universities Directory
  const [universities, setUniversities] = useState([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);

  // Sign In Credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA Flow state: 'credentials' | 'otp'
  const [step, setStep] = useState('credentials');
  const [otp, setOtp] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [otpPreview, setOtpPreview] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [authenticatedUserMeta, setAuthenticatedUserMeta] = useState(null);

  // University Registration Form State (ONLY for universities)
  const [univName, setUnivName] = useState('');
  const [univCode, setUnivCode] = useState('');
  const [univEmail, setUnivEmail] = useState('');
  const [univPassword, setUnivPassword] = useState('');
  const [univConfirmPassword, setUnivConfirmPassword] = useState('');
  const [univCity, setUnivCity] = useState('');
  const [univState, setUnivState] = useState('Madhya Pradesh');
  const [registrationSuccessData, setRegistrationSuccessData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load universities list on mount
  useEffect(() => {
    async function fetchUniversities() {
      setIsLoadingUniversities(true);
      try {
        const list = await getUniversities();
        setUniversities(list || []);
        if (list && list.length > 0) {
          const savedUnivId = localStorage.getItem('mponline_university_id');
          const matched = list.find(u => u.universityId === savedUnivId);
          setSelectedUniversityId(matched ? matched.universityId : list[0].universityId);
        }
      } catch (err) {
        console.warn('Failed to fetch universities:', err);
      } finally {
        setIsLoadingUniversities(false);
      }
    }
    fetchUniversities();
  }, []);

  // Update localStorage when university selected
  const handleUniversityChange = (id) => {
    setSelectedUniversityId(id);
    localStorage.setItem('mponline_university_id', id);
    setError('');
  };

  // 1. SIGN IN FLOW (With University Verification)
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both your registered email address and password.');
      return;
    }
    if (!selectedUniversityId) {
      setError('Please select your affiliated University / Institution.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await loginRequest(cleanEmail, password, selectedUniversityId);
      if (res.success && res.requiresOtp) {
        setStep('otp');
        setOtpNotice(res.message);
        setEmailSent(res.emailSent);
        setAuthenticatedUserMeta({
          name: res.userName,
          role: res.userRole,
          universityName: res.universityName,
          universityId: res.universityId
        });
        if (res.otpPreview) {
          setOtpPreview(res.otpPreview);
        }
      } else {
        setError(res.error || 'Failed to authenticate credentials.');
      }
    } catch (err) {
      setError(err.message || 'Login request failed. Please check credentials and university.');
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
      const res = await verifyLoginOtp(email.trim(), cleanOtp, selectedUniversityId);
      if (res.success && res.user) {
        localStorage.setItem('mponline_university_id', res.user.universityId || selectedUniversityId);
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
      const res = await loginRequest(email.trim(), password, selectedUniversityId);
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
    if (!selectedUniversityId) {
      setError('Please select your affiliated University.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await directLogin(cleanEmail, password, selectedUniversityId);
      if (res.success && res.user) {
        localStorage.setItem('mponline_university_id', res.user.universityId || selectedUniversityId);
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

  // 2. UNIVERSITY REGISTRATION FLOW (Strictly for Universities)
  const handleRegisterUniversity = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!univName.trim() || !univCode.trim() || !univEmail.trim() || !univPassword) {
      setError('All mandatory institutional fields (*) must be completed.');
      return;
    }

    if (univPassword !== univConfirmPassword) {
      setError('Passwords do not match. Please verify both password entries.');
      return;
    }

    if (univPassword.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    const cleanCode = univCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (cleanCode.length < 2) {
      setError('University Code must be at least 2 alphanumeric characters (e.g. DAVV, BU, RGPV).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: univName.trim(),
        code: cleanCode,
        email: univEmail.trim().toLowerCase(),
        password: univPassword,
        city: univCity.trim() || 'Madhya Pradesh',
        state: univState.trim() || 'Madhya Pradesh'
      };

      const res = await registerUniversity(payload);
      if (res.success) {
        setRegistrationSuccessData(res);
        // Refresh universities list
        const updatedList = await getUniversities();
        setUniversities(updatedList);
        setSelectedUniversityId(res.university.universityId);
        localStorage.setItem('mponline_university_id', res.university.universityId);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. University code or email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToSignInAfterReg = () => {
    if (registrationSuccessData?.university) {
      setSelectedUniversityId(registrationSuccessData.university.universityId);
      setEmail(registrationSuccessData.university.email);
      setPassword(univPassword);
    }
    setRegistrationSuccessData(null);
    setActiveTab('signin');
    setStep('credentials');
    setError('');
  };

  const currentUniv = universities.find(u => u.universityId === selectedUniversityId);

  return (
    <div className={isModal ? "login-modal-overlay" : "login-page-wrapper"}>
      <div className="login-card-container liquid-glass" style={{ maxWidth: activeTab === 'register-univ' ? '680px' : '520px', transition: 'max-width 0.3s ease' }}>
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
        <div className="login-header-section" style={{ marginBottom: '16px', display: 'flex' }}>
          <div className="login-crest-badge">
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'inherit', marginTop: '10px' }}><MessageCircleDashedCheck /></span>
          </div>
          <div style={{
            display: 'flex',
            paddingTop: '10px',
          }} className="login-header-text">
          <p style={{
            display: 'flex',
            flexDirection: 'row'
          }} className="login-title">Digital On-Screen Marking Portal</p>
        </div>
      </div>

      {/* PRIMARY TAB SWITCHER: SIGN IN vs UNIVERSITY REGISTRATION */}
      <div style={{
        display: 'flex',
        background: 'rgba(0, 0, 0, 0.12)',
        padding: '4px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          type="button"
          onClick={() => { setActiveTab('signin'); setError(''); }}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'signin' ? 'var(--accent-orange)' : 'transparent',
            color: activeTab === 'signin' ? '#ffffff' : 'var(--text-main)',
            fontWeight: activeTab === 'signin' ? 700 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldCheck size={16} />
          <span>Institutional Sign-In</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('register-univ'); setError(''); setRegistrationSuccessData(null); }}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'register-univ' ? 'var(--accent-orange)' : 'transparent',
            color: activeTab === 'register-univ' ? '#ffffff' : 'var(--text-main)',
            fontWeight: activeTab === 'register-univ' ? 700 : 500,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Landmark size={16} />
          <span>Register University</span>
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '4px' }}>
            Institutions Only
          </span>
        </button>
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="login-alert-banner alert-error" style={{ marginBottom: '16px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ==============================================================
            TAB 1: INSTITUTIONAL SIGN IN (WITH UNIVERSITY RESOLUTION)
           ============================================================== */}
      {activeTab === 'signin' && (
        <>
          {step === 'credentials' ? (
            <div className="login-form-body">
              <form onSubmit={handleRequestOtp}>
                {/* University Selection Dropdown */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Landmark size={16} color="#FC6C26" />
                      Affiliated University / Board <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <select
                    className="form-control"
                    value={selectedUniversityId}
                    onChange={(e) => handleUniversityChange(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: 'var(--surface-glass)',
                      color: 'var(--text-main)',
                      border: '1.5px solid var(--border-strong)',
                      borderRadius: '8px'
                    }}
                  >
                    {universities.length === 0 ? (
                      <option value="" disabled style={{ background: '#111827', color: '#9ca3af' }}>
                        ⚠️ No universities registered yet. Register your university above.
                      </option>
                    ) : (
                      universities.map(u => (
                        <option key={u.universityId} value={u.universityId} style={{ background: '#111827', color: '#ffffff' }}>
                          🏛️ [{u.code}] {u.name}
                        </option>
                      ))
                    )}
                  </select>
                  {currentUniv && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <Landmark size={12} color="#10b981" />
                      <span>Institutional Campus: <strong style={{ color: 'var(--text-main)' }}>{currentUniv.city || ''}{currentUniv.city && currentUniv.state ? ', ' : ''}{currentUniv.state || ''}</strong></span>
                    </div>
                  )}
                  {universities.length === 0 && (
                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⚠️ No universities registered yet. Click the <strong>Register University</strong> tab above to get started.</span>
                    </div>
                  )}
                </div>

                {/* Email Address Input */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={16} color="#FC6C26" />
                      Account Email Address <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="email"
                    className="login-input"
                    style={{ padding: '0 16px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter authorized institutional email"
                    autoComplete="email"
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
                    placeholder="Enter confidential password"
                    autoComplete="current-password"
                  />
                </div>

                {/* Primary 2FA Login Button */}
                <button
                  type="submit"
                  className="btn btn-primary login-submit-btn"
                  disabled={loading || universities.length === 0}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Verifying Credentials & Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Sign In with 2FA Verification</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Direct Bypass Shortcut */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleDirectBypass}
                    className="login-bypass-link"
                    disabled={loading || universities.length === 0}
                  >
                    Direct Sign-In (Fast Track)
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* STEP 2: REAL 2FA EMAIL OTP VERIFICATION */
            <div className="login-otp-panel">
              <div className="login-otp-icon-wrapper">
                <KeyRound size={28} />
              </div>

              <h2 className="login-otp-heading">Two-Factor Email Verification</h2>

              <p className="login-otp-subtext">
                Verifying login for <strong>{authenticatedUserMeta?.universityName}</strong>
                <br />
                A real 6-digit security code was dispatched to:
                <br />
                <strong className="login-otp-email-highlight">{email}</strong>
              </p>

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
                      <span>Verifying Security Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm OTP & Enter Portal</span>
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
        </>
      )}

      {/* ==============================================================
            TAB 2: UNIVERSITY ONBOARDING / REGISTRATION (UNIVERSITIES ONLY)
           ============================================================== */}
      {activeTab === 'register-univ' && (
        <div className="login-form-body">
          {registrationSuccessData ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <CheckCircle2 size={32} color="#10b981" />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                University Successfully Onboarded!
              </h2>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                Institutional profile successfully registered for <strong>{registrationSuccessData.university.name}</strong>.
              </p>

              <div style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', textAlign: 'left', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>University Name:</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '13px' }}>
                      {registrationSuccessData.university.name}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>University Code:</span>
                    <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '14px', fontFamily: 'monospace' }}>
                      {registrationSuccessData.university.code}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Registered Email:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {registrationSuccessData.university.email}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Campus Location:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {registrationSuccessData.university.city}, {registrationSuccessData.university.state}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProceedToSignInAfterReg}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                <ShieldCheck size={18} /> Proceed to Sign In with {registrationSuccessData.university.code}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterUniversity}>
              {/* Institutional Notice Banner */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '18px',
                fontSize: '11.5px',
                lineHeight: '1.45',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <Landmark size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Institutional Accreditation Only:</strong> Registration is restricted exclusively to recognized Higher Education Universities & Autonomous Examination Boards. Individual teachers, students, or candidates cannot register here.
                </div>
              </div>

              {/* 2-Column Grid for University Form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Full University Name */}
                <div className="login-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={15} color="#FC6C26" />
                      Full University Name <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. Devi Ahilya Vishwavidyalaya"
                    value={univName}
                    onChange={(e) => setUnivName(e.target.value)}
                    required
                  />
                </div>

                {/* University Code & Live DB Badge */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Landmark size={15} color="#FC6C26" />
                      University Short Code <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. DAVV, BU, RGPV"
                    value={univCode}
                    onChange={(e) => setUnivCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    maxLength={12}
                    required
                    style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1px' }}
                  />
                </div>

                {/* Campus City */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={15} color="#FC6C26" />
                      Campus City / HQ <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. Indore, Bhopal, Jabalpur"
                    value={univCity}
                    onChange={(e) => setUnivCity(e.target.value)}
                    required
                  />
                </div>

                {/* Official University Email */}
                <div className="login-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={15} color="#FC6C26" />
                      Official University Examination Email <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="e.g. exam_controller@davv.ac.in"
                    value={univEmail}
                    onChange={(e) => setUnivEmail(e.target.value)}
                    required
                  />
                </div>



                {/* Master Password */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={15} color="#FC6C26" />
                      Master Account Password <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Minimum 6 characters"
                    value={univPassword}
                    onChange={(e) => setUnivPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Confirm Password */}
                <div className="login-form-group">
                  <label className="login-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={15} color="#FC6C26" />
                      Confirm Password <span style={{ color: '#FC6C26' }}>*</span>
                    </span>
                  </label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Re-enter password"
                    value={univConfirmPassword}
                    onChange={(e) => setUnivConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Submit University Registration Button */}
              <button
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={loading}
                style={{ marginTop: '18px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Provisioning Database on MongoDB Cluster...</span>
                  </>
                ) : (
                  <>
                    <Landmark size={18} />
                    <span>Register University & Initialize Isolated Database</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}


    </div>
    </div >
  );
}
