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
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'inherit', marginTop: '10px' }}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" id="Form-Validation-Check-Double--Streamline-Freehand" height={24} width={24} ><desc>{"\n    Form Validation Check Double Streamline Icon: https://streamlinehq.com\n  "}</desc><path fill="#020202" fillRule="evenodd" d="M23.8736 2.57825c-0.0539 -0.16158 -0.1551 -0.30323 -0.2905 -0.40656 -0.1354 -0.10333 -0.2987 -0.16355 -0.4688 -0.17285 -0.3411 0.02436 -0.6613 0.17377 -0.8991 0.41957 -1.2259 1.24099 -2.3516 2.57715 -3.3665 3.99595 -2.4975 3.31664 -5.5145 7.73214 -6.8631 9.77014l-0.4895 0.7492c-1.362 -0.4944 -2.77665 -0.8296 -4.21571 -0.999 -0.6639 -0.1116 -1.3435 -0.0878 -1.99798 0.0699 -0.08794 0.0352 -0.16781 0.0879 -0.23479 0.1549 -0.06697 0.0669 -0.11964 0.1468 -0.15481 0.2347 -0.03279 0.197 -0.02111 0.3988 0.03421 0.5907 0.05531 0.1919 0.15285 0.3689 0.28547 0.5182 0.68426 0.8387 1.4656 1.5932 2.32763 2.2477 1.89808 1.5285 4.29568 2.997 5.15478 3.1069 0.0447 0.0056 0.09 0.0022 0.1333 -0.0099 0.0434 -0.0121 0.0839 -0.0327 0.1192 -0.0606s0.0647 -0.0625 0.0866 -0.1018c0.0218 -0.0394 0.0356 -0.0827 0.0405 -0.1274 0.0084 -0.0912 -0.0193 -0.1821 -0.0772 -0.2531 -0.0579 -0.071 -0.1414 -0.1164 -0.2325 -0.1265 -1.4668 -0.5674 -2.82021 -1.3929 -3.99592 -2.4376 -1.02646 -0.7625 -1.96168 -1.6407 -2.78717 -2.6173 -0.07685 -0.1019 -0.14693 -0.2086 -0.20979 -0.3197 0.07736 -0.0271 0.15798 -0.0439 0.23976 -0.0499 1.01326 0.0381 2.01881 0.1923 2.99695 0.4595 0.8306 0.1892 1.64037 0.4603 2.41757 0.8092 0.0846 0.0506 0.1827 0.0739 0.281 0.0668 0.0983 -0.0072 0.1921 -0.0444 0.2684 -0.1068 0.0859 -0.0502 0.1526 -0.1275 0.1898 -0.2197v-0.05c0.1099 -0.1698 0.3297 -0.5095 0.6594 -0.999 1.3686 -1.998 4.4155 -6.3535 6.913 -9.64021 1.1188 -1.4785 2.1178 -2.74721 2.8171 -3.47647 0.0902 -0.09429 0.1907 -0.17808 0.2997 -0.24975 -0.05 0.27972 -0.1698 0.64934 -0.2597 0.99899 -0.8526 2.68592 -1.9286 5.29574 -3.2168 7.80204 -1.5169 3.202 -3.263 6.2902 -5.2247 9.2407 -0.0236 0.0315 -0.0408 0.0673 -0.0505 0.1054 -0.0098 0.0381 -0.012 0.0778 -0.0064 0.1168 0.0056 0.0389 0.0187 0.0764 0.0388 0.1103 0.02 0.0339 0.0466 0.0634 0.0781 0.0871 0.0651 0.0482 0.1467 0.0689 0.227 0.0577 0.0803 -0.0112 0.153 -0.0534 0.2025 -0.1177 3.2723 -4.7191 6.0603 -9.7561 8.3216 -15.03474 0.4349 -0.96209 0.7696 -1.96636 0.999 -2.99696 0.07 -0.38096 0.039 -0.7736 -0.0899 -1.13885Z" clipRule="evenodd" strokeWidth={1} /><path fill="#020202" fillRule="evenodd" d="M9.08855 14.0566c1.25875 -1.7282 2.99695 -3.9959 4.62535 -6.09381l1.9979 -2.59737c0.999 -1.22875 1.7582 -2.2677 2.3177 -2.86709 0.0999 -0.0999 0.1898 -0.21978 0.2697 -0.30968 0.0095 0.0495 0.0095 0.10034 0 0.14984 -0.0251 0.43313 -0.0988 0.86206 -0.2198 1.27871 -0.1099 0.61937 -0.3596 1.3786 -0.6593 2.17779 -0.0243 0.03783 -0.0398 0.08065 -0.0453 0.12528 -0.0055 0.04464 -0.0009 0.08994 0.0135 0.13255 0.0144 0.04261 0.0381 0.08143 0.0696 0.1136 0.0314 0.03217 0.0697 0.05685 0.1119 0.07222 0.0423 0.01537 0.0875 0.02103 0.1322 0.01656 0.0448 -0.00447 0.0879 -0.01895 0.1263 -0.04237 0.0384 -0.02342 0.071 -0.05518 0.0955 -0.09292 0.0244 -0.03775 0.0401 -0.08051 0.0457 -0.12512 0.5614 -1.14145 0.9743 -2.35005 1.2288 -3.59636 0.0799 -0.81917 -0.2697 -1.20877 -0.7293 -1.25872 -0.2827 0.00538 -0.5533 0.11577 -0.7592 0.30969 -1.0716 0.97063 -2.0483 2.04104 -2.917 3.19675 -0.6294 0.79919 -1.3087 1.70827 -1.998 2.64732 -1.5684 2.17779 -3.12684 4.57533 -4.29566 6.37353 -0.03502 0.0751 -0.04224 0.1602 -0.02037 0.2401 0.02188 0.0799 0.07142 0.1495 0.13981 0.1963 0.06838 0.0468 0.15116 0.0677 0.23357 0.0592 0.08242 -0.0086 0.15911 -0.0461 0.21642 -0.106h0.01998Z" clipRule="evenodd" strokeWidth={1} /><path fill="#020202" fillRule="evenodd" d="M6.64106 21.9786c-0.55944 -0.1099 -1.59838 -1.2987 -2.65731 -2.6573 -0.42956 -0.5395 -0.84914 -1.1289 -1.24873 -1.6783 -0.3996 -0.5495 -0.83915 -1.2088 -1.14884 -1.7283 -0.21304 -0.3156 -0.39694 -0.65 -0.54944 -0.9989l0 -0.05c0.90545 -0.0156 1.80806 0.1056 2.67728 0.3596 0.03739 0.0138 0.07713 0.0201 0.11694 0.0185 0.03982 -0.0016 0.07893 -0.011 0.11511 -0.0277 0.03618 -0.0167 0.06871 -0.0403 0.09575 -0.0696 0.02703 -0.0293 0.04803 -0.0636 0.06181 -0.101 0.01377 -0.0374 0.02005 -0.0771 0.01847 -0.1169 -0.00158 -0.0398 -0.01099 -0.0789 -0.02769 -0.1151 -0.0167 -0.0362 -0.04036 -0.0687 -0.06963 -0.0958 -0.02927 -0.027 -0.06358 -0.048 -0.10097 -0.0618 -0.88525 -0.3555 -1.81732 -0.581 -2.76719 -0.6693 -0.291029 -0.0437 -0.588464 -0.0056 -0.859131 0.1099 -0.106347 0.0578 -0.19063 0.1491 -0.2397568 0.2597 -0.06476824 0.2704 -0.0751597 0.5509 -0.0305705 0.8253 0.0445893 0.2744 0.1432703 0.5372 0.2903073 0.7731 0.429273 0.8802 0.948161 1.7137 1.548431 2.4875 1.5784 2.0879 3.77617 4.1458 4.65528 4.2756 0.04396 0.0087 0.08921 0.0087 0.13314 -0.0002 0.04392 -0.0089 0.08566 -0.0264 0.12281 -0.0514 0.03714 -0.0251 0.06896 -0.0573 0.09361 -0.0947 0.02465 -0.0374 0.04166 -0.0794 0.05003 -0.1234 0.02059 -0.049 0.02938 -0.1022 0.02567 -0.1552 -0.00371 -0.053 -0.01982 -0.1045 -0.04703 -0.1501 -0.02721 -0.0457 -0.06476 -0.0844 -0.10963 -0.1129 -0.04488 -0.0285 -0.09582 -0.0461 -0.14872 -0.0513Z" clipRule="evenodd" strokeWidth={1} /></svg></span>
          </div>
          <div style={{
            display: 'flex',
            paddingTop: '10px',
          }} className="login-header-text">
          <p style={{
            display: 'flex',
            flexDirection: 'row'
          }} className="login-title">Online Evaluation Portal</p>
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
