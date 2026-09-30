import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  User, 
  Building, 
  Lock, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { sendProfileOtp, verifyAndUpdateProfile } from '../api';

export default function ProfileModal({ 
  user, 
  currentUser, 
  onClose, 
  onUserUpdated, 
  onProfileUpdated, 
  onNotify 
}) {
  const activeUser = currentUser || user || {};

  const [name, setName] = useState(activeUser.name || '');
  const [department, setDepartment] = useState(activeUser.department || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [step, setStep] = useState('edit'); // 'edit' | 'verify'
  const [otp, setOtp] = useState('');
  const [otpPreview, setOtpPreview] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const userEmail = (activeUser.email || '').trim().toLowerCase();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!userEmail) {
      setError('No registered email found for this profile session.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await sendProfileOtp(userEmail);
      if (res.success) {
        setStep('verify');
        setEmailSent(res.emailSent);
        if (res.otpPreview) setOtpPreview(res.otpPreview);
        if (onNotify) {
          onNotify(res.message || `Verification OTP sent to ${userEmail}`, 'info');
        }
      } else {
        setError(res.error || 'Failed to dispatch verification OTP');
      }
    } catch (err) {
      setError(err.message || 'Error sending OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndUpdate = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the 6-digit OTP code received on your email.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updates = { 
        name: name.trim(), 
        department: department.trim() 
      };
      if (newPassword.trim()) {
        updates.password = newPassword.trim();
      }

      const res = await verifyAndUpdateProfile(userEmail, cleanOtp, updates);
      if (res.success) {
        setSuccessMsg('Profile credentials updated successfully in MongoDB database!');
        const updated = res.user || { ...activeUser, ...updates };
        
        if (onProfileUpdated) onProfileUpdated(updated);
        if (onUserUpdated) onUserUpdated(updated);
        if (onNotify) onNotify('Profile updated successfully!', 'success');

        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'OTP verification failed');
      }
    } catch (err) {
      setError(err.message || 'Update failed. Please verify the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div 
        className="modal-dialog modal-profile-dialog" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '520px', 
          width: '100%', 
          borderRadius: '20px', 
          padding: '32px 36px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '18px', borderBottom: '1.5px solid var(--border-subtle)', marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="profile-avatar-circle" style={{ width: '48px', height: '48px', fontSize: '18px' }}>
              {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Account Profile & Security</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Role: <strong style={{ textTransform: 'capitalize' }}>{activeUser.role || 'Personnel'}</strong> • {userEmail}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm btn-icon-only" 
            onClick={onClose}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1.5px solid #ef4444', color: 'var(--text-main)', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid #10b981', color: 'var(--text-main)', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: EDIT PROFILE */}
        {step === 'edit' ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter full name"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                Academic Department / Cell
              </label>
              <input
                type="text"
                className="form-control"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Examination Scrutiny Board"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                <span>Change Password (Leave blank to keep existing)</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (optional)"
              />
            </div>

            <div style={{ background: 'rgba(232, 224, 202, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              🔒 <strong>Email OTP Protected:</strong> Clicking "Proceed to Email OTP Verification" will dispatch a secure 6-digit confirmation code to <strong>{userEmail}</strong>.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw size={14} className="spin-slow" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Shield size={15} />
                    Proceed to Email OTP Verification
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: VERIFY REAL OTP */
          <form onSubmit={handleVerifyAndUpdate} style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(13, 71, 161, 0.1)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <KeyRound size={26} />
            </div>

            <h4 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Verify Security Code</h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              A 6-digit verification code was sent to: <br />
              <strong style={{ color: 'var(--accent-orange)', fontFamily: 'monospace' }}>{userEmail}</strong>
            </p>

            {emailSent ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid #10b981', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '16px' }}>
                ✓ Delivered directly to your email inbox via SMTP.
              </div>
            ) : (
              otpPreview && (
                <div style={{ background: 'var(--surface-glass-accent)', border: '2px dashed var(--border-strong)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  <div style={{ color: 'var(--text-main)', fontSize: '11px', fontWeight: 700 }}>Fallback Console Code:</div>
                  <strong style={{ fontSize: '20px', letterSpacing: '4px', fontFamily: 'monospace', color: 'var(--text-main)' }}>{otpPreview}</strong>
                </div>
              )
            )}

            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                maxLength="6"
                className="otp-digit-box"
                style={{ width: '220px', height: '50px', fontSize: '26px', letterSpacing: '10px', textAlign: 'center', margin: '0 auto', display: 'block', borderRadius: '6px', border: '2px solid var(--accent-ink)' }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-outline btn-sm" 
                onClick={() => { setStep('edit'); setOtp(''); setError(''); }}
                disabled={loading}
              >
                ← Back to Edit
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline btn-sm" 
                  onClick={handleRequestOtp}
                  disabled={loading}
                >
                  <RefreshCw size={13} /> Resend
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm" 
                  disabled={loading || otp.length < 6}
                >
                  {loading ? 'Verifying...' : 'Verify & Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
