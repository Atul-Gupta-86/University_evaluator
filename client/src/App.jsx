import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import MetricCards from './components/MetricCards';
import LoginModal from './components/LoginModal';
import ProfileModal from './components/ProfileModal';
import DocumentViewerModal from './components/DocumentViewerModal';
import EvaluationStudio from './components/EvaluationStudio';

import AdministratorDashboard from './components/dashboards/AdministratorDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
import UniversityDashboard from './components/dashboards/UniversityDashboard';
import TeacherDashboard from './components/dashboards/TeacherDashboard';

import './components/dashboards/AdministratorDashboard.css';
import './components/dashboards/UniversityDashboard.css';

import { 
  getMetrics, 
  getStudents, 
  getTeachers, 
  getSubjects, 
  getDepartments,
  getReferences, 
  getServerStatus 
} from './api';

export default function App() {
  // Current authenticated user state (cached in localStorage)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('mponline_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Global data caches
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    allocatedStudents: 0,
    evaluatedStudents: 0,
    sentForEvaluation: 0
  });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [references, setReferences] = useState([]);
  const [serverStatus, setServerStatus] = useState({
    database: 'connecting',
    cloudinary: 'configured',
    server: 'online'
  });
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null); // { url, title } or null
  const [evaluatingStudent, setEvaluatingStudent] = useState(null); // student object or null

  // Notification Toast state
  const [toast, setToast] = useState(null); // { message, type }

  // Universal Theme Mode: 'dark' (Administrator UI) | 'light' (University Board UI)
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('portal_theme_mode');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark'; // Default to Administrator dark liquid glass
  });

  useEffect(() => {
    localStorage.setItem('portal_theme_mode', themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'dark') {
      document.body.classList.add('dark-mode', 'administrator-theme');
      document.body.classList.remove('light-mode', 'university-theme');
    } else {
      document.body.classList.add('light-mode', 'university-theme');
      document.body.classList.remove('dark-mode', 'administrator-theme');
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const showNotification = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Fetch all core system data
  const loadSystemData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [statusRes, metricsRes, studentsRes, teachersRes, subjectsRes, refsRes, deptsRes] = await Promise.allSettled([
        getServerStatus(),
        getMetrics(),
        getStudents(),
        getTeachers(),
        getSubjects(),
        getReferences(),
        getDepartments()
      ]);

      if (statusRes.status === 'fulfilled') {
        setServerStatus({
          database: statusRes.value.database || 'connected',
          cloudinary: statusRes.value.cloudinary || 'configured',
          server: 'online'
        });
      }

      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value);
      }

      if (studentsRes.status === 'fulfilled') {
        setStudents(Array.isArray(studentsRes.value) ? studentsRes.value : []);
      }

      if (teachersRes.status === 'fulfilled') {
        setTeachers(Array.isArray(teachersRes.value) ? teachersRes.value : []);
      }

      if (subjectsRes.status === 'fulfilled') {
        setSubjects(Array.isArray(subjectsRes.value) ? subjectsRes.value : []);
      }

      if (refsRes.status === 'fulfilled') {
        setReferences(Array.isArray(refsRes.value) ? refsRes.value : []);
      }

      if (deptsRes.status === 'fulfilled') {
        setDepartments(Array.isArray(deptsRes.value) ? deptsRes.value : []);
      }
    } catch (err) {
      console.error('Data refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  // Persist session automatically across page reloads
  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem('mponline_user', JSON.stringify(currentUser));
      } catch (e) {
        console.error('Failed to persist session to localStorage:', e);
      }
    }
  }, [currentUser]);

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    try {
      localStorage.setItem('mponline_user', JSON.stringify(userData));
    } catch (e) {
      console.error('Failed to persist user session:', e);
    }
    setCurrentUser(userData);
    setShowLoginModal(false);
    showNotification(`Welcome back, ${userData.name}! Authenticated as ${userData.role}.`, 'success');
    loadSystemData();
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('mponline_user');
    setCurrentUser(null);
    showNotification('Logged out successfully.', 'info');
  };

  // Render appropriate role dashboard
  const renderDashboard = () => {
    if (!currentUser) {
      return (
        <LoginModal 
          onLoginSuccess={handleLoginSuccess}
          onNotify={showNotification}
          isModal={false}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
        />
      );
    }

    const role = (currentUser.role || '').toLowerCase();

    if (role === 'administrator') {
      return (
        <AdministratorDashboard
          currentUser={currentUser}
          students={students}
          teachers={teachers}
          metrics={metrics}
          onRefresh={loadSystemData}
          onInspectStudent={(s) => {
            const url = s.copyUrl || s.copy_url || s.fileUrl || s.url || s.scannedCopyUrl;
            setViewingDoc({ 
              url, 
              title: `Student Script: ${s.name || s.studentName || 'Candidate'} (${s.enrollmentNumber || s.enrollment || 'N/A'}) - ${s.subjectCode || s.subject || ''}`, 
              ...s 
            });
          }}
          onViewDocument={(url, title, data = null) => setViewingDoc({ url, title, ...(typeof data === 'object' && data !== null ? data : {}) })}
          onEvaluateStudent={(student) => setEvaluatingStudent(student)}
          onStartEvaluation={(student) => setEvaluatingStudent(student)}
          onNotify={showNotification}
        />
      );
    }

    if (role === 'admin' || role === 'admin cell') {
      return (
        <AdminDashboard
          currentUser={currentUser}
          students={students}
          teachers={teachers}
          departments={departments}
          subjects={subjects}
          references={references}
          metrics={metrics}
          onRefresh={loadSystemData}
          onInspectStudent={(s) => {
            const url = s.copyUrl || s.copy_url || s.fileUrl || s.url || s.scannedCopyUrl;
            setViewingDoc({ 
              url, 
              title: `Student Script: ${s.name || s.studentName || 'Candidate'} (${s.enrollmentNumber || s.enrollment || 'N/A'}) - ${s.subjectCode || s.subject || ''}`, 
              ...s 
            });
          }}
          onViewReference={(r) => {
            const url = r.fileUrl || r.copy_url || r.copyUrl || r.url || r.secure_url;
            setViewingDoc({ 
              url, 
              title: `Answer Reference: ${r.subjectCode} - ${r.subjectTitle || ''}`, 
              ...r 
            });
          }}
          onViewDocument={(url, title, data = null) => setViewingDoc({ url, title, ...(typeof data === 'object' && data !== null ? data : {}) })}
          onNotify={showNotification}
        />
      );
    }

    if (role === 'university') {
      return (
        <UniversityDashboard
          students={students}
          subjects={subjects}
          departments={departments}
          onRefresh={loadSystemData}
          onViewDocument={(url, title, data = null) => setViewingDoc({ url, title, ...(typeof data === 'object' && data !== null ? data : {}) })}
          onNotify={showNotification}
        />
      );
    }

    if (role === 'teacher') {
      return (
        <TeacherDashboard
          currentUser={currentUser}
          students={students}
          onRefresh={loadSystemData}
          onViewDocument={(url, title, data = null) => setViewingDoc({ url, title, ...(typeof data === 'object' && data !== null ? data : {}) })}
          onStartEvaluation={(student) => setEvaluatingStudent(student)}
          onNotify={showNotification}
        />
      );
    }

    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <h3>Unrecognized Role Portal</h3>
        <p style={{ color: 'var(--text-muted)' }}>Role "{currentUser.role}" does not match an active dashboard layout.</p>
        <button className="btn btn-outline" onClick={handleLogout}>Switch Account</button>
      </div>
    );
  };

  const role = currentUser?.role?.toLowerCase() || '';
  const isAdministrator = role === 'administrator' || role === 'admin' || role === 'admin cell';
  const isUniversity = role === 'university' || role === 'university board' || role === 'board';

  return (
    <div className={`app-container theme-${themeMode} ${themeMode === 'dark' ? 'administrator-theme dark-mode' : 'university-theme light-mode'}`}>
      {/* Toast Notification Container */}
      {toast && (
        <div 
          className={`toast-notification toast-${toast.type}`}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            padding: '14px 20px',
            background: 'var(--accent-orange)',
            color: 'var(--text-main)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
            fontSize: '13.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInUp 0.25s ease'
          }}
        >
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: '8px', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <Navbar 
        currentUser={currentUser}
        serverStatus={serverStatus}
        onOpenLogin={() => setShowLoginModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Page Body */}
      <main className="main-content">
        {/* Metric Cards - shown whenever user is logged in (hidden in evaluator dashboard as requested) */}
        {currentUser && currentUser.role?.toLowerCase() !== 'teacher' && (
          <MetricCards 
            metrics={metrics}
            students={students}
            isLoading={isLoading}
          />
        )}

        {/* Dynamic Role Dashboard */}
        {renderDashboard()}
      </main>

      {/* Login Modal with 2FA OTP */}
      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          onNotify={showNotification}
          isModal={true}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
        />
      )}

      {/* Profile Modal with Email OTP Verification */}
      {showProfileModal && currentUser && (
        <ProfileModal 
          user={currentUser}
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onNotify={showNotification}
          onProfileUpdated={(updated) => {
            setCurrentUser(updated);
            localStorage.setItem('mponline_user', JSON.stringify(updated));
            loadSystemData();
          }}
        />
      )}

      {/* High-Resolution Document / Script Viewer Modal */}
      {viewingDoc && (
        <DocumentViewerModal 
          docUrl={viewingDoc.url}
          docTitle={viewingDoc.title}
          documentData={typeof viewingDoc === 'object' ? viewingDoc : null}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* 3-Section Digital Evaluation Studio Modal */}
      {evaluatingStudent && (
        <EvaluationStudio 
          student={evaluatingStudent}
          currentUser={currentUser}
          onClose={() => setEvaluatingStudent(null)}
          onNotify={showNotification}
          onRefresh={loadSystemData}
          onEvaluationSaved={() => {
            setEvaluatingStudent(null);
            loadSystemData();
          }}
        />
      )}
    </div>
  );
}
