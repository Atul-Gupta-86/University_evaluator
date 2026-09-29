import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Save, Bot, Layers } from 'lucide-react';
import { submitEvaluation, flagRevaluation, fetchDocumentPageCount } from '../api';

const DEFAULT_QUESTIONS = [
  { id: 'q1', label: 'Question 1: Core Concept Definition', maxMarks: 10, marks: 0 },
  { id: 'q2', label: 'Question 2: Architectural Proof / Derivation', maxMarks: 15, marks: 0 },
  { id: 'q3', label: 'Question 3: Algorithm Design & Analysis', maxMarks: 15, marks: 0 },
  { id: 'q4', label: 'Question 4: Practical Implementation / Case', maxMarks: 10, marks: 0 },
  { id: 'q5', label: 'Question 5: Critical Evaluation & Schema', maxMarks: 20, marks: 0 }
];

export default function EvaluationStudio({ 
  student, 
  currentUser, 
  onClose, 
  onRefresh, 
  onEvaluationSaved,
  onNotify 
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [remarks, setRemarks] = useState(student.evaluation?.remarks || '');
  const [questions, setQuestions] = useState(() => {
    if (student.evaluation?.breakdown && student.evaluation.breakdown.length > 0) {
      return student.evaluation.breakdown;
    }
    return DEFAULT_QUESTIONS;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevalModal, setShowRevalModal] = useState(false);
  const [revalReason, setRevalReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (!student) return null;

  const rawUrl = student.copyUrl || student.copy_url || student.fileUrl || student.url;

  const resolveTotalPages = () => {
    if (student?.totalPages && Number(student.totalPages) > 0) return Number(student.totalPages);
    if (student?.pages && Array.isArray(student.pages) && student.pages.length > 0) return student.pages.length;
    const clean = (rawUrl || '').toLowerCase();
    if (clean.includes('.png') || clean.includes('.jpg') || clean.includes('.jpeg') || clean.includes('.webp')) return 1;
    return 1;
  };

  const [totalPages, setTotalPages] = useState(() => resolveTotalPages());

  // Dynamically fetch accurate page count from Cloudinary API / backend
  useEffect(() => {
    let isMounted = true;
    const fetchPages = async () => {
      if (!rawUrl) return;
      try {
        const count = await fetchDocumentPageCount(rawUrl);
        if (isMounted && count && count > 0) {
          setTotalPages(count);
        }
      } catch (err) {
        console.warn('[EvaluationStudio] Could not auto-fetch page count:', err);
      }
    };
    fetchPages();
    return () => { isMounted = false; };
  }, [rawUrl]);

  // Keyboard navigation for page toggling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage(p => Math.min(totalPages, p + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const getPageUrl = (url, page) => {
    if (!url) return null;
    let clean = url.trim();
    if (clean.includes('cloudinary.com') && clean.includes('/upload/')) {
      const isPdf = clean.toLowerCase().includes('.pdf');
      if (isPdf) {
        clean = clean.replace(/\.pdf(\?.*)?$/i, '.jpg$1');
      }
      if (clean.includes('/pg_')) {
        clean = clean.replace(/\/pg_\d+\//, `/pg_${page}/`);
      } else {
        clean = clean.replace('/upload/', `/upload/pg_${page}/`);
      }
    }
    return clean;
  };

  const deliverableUrl = rawUrl ? getPageUrl(rawUrl, currentPage) : null;

  const totalAwarded = questions.reduce((sum, q) => sum + (parseFloat(q.marks) || 0), 0);
  const totalMax = questions.reduce((sum, q) => sum + (parseFloat(q.maxMarks) || 0), 0);

  const handleMarksChange = (id, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        return { ...q, marks: Math.min(num, q.maxMarks) };
      }
      return q;
    }));
  };

  // Open confirmation pop up window asking to confirm the evaluated marks
  const handleInitiateSubmit = () => {
    setShowConfirmModal(true);
  };

  const executeSubmitEvaluation = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const evalData = {
        evaluatorEmail: currentUser.email,
        evaluatorName: currentUser.name,
        totalMarksAwarded: totalAwarded,
        maxPossibleMarks: totalMax,
        percentage: ((totalAwarded / totalMax) * 100).toFixed(1),
        remarks: remarks.trim() || 'Script successfully evaluated and verified.',
        evaluatedAt: new Date().toISOString(),
        breakdown: questions
      };

      const targetId = student.id || student._id;
      await submitEvaluation(targetId, evalData);

      setShowConfirmModal(false);
      setIsSubmitting(false);

      if (typeof onNotify === 'function') {
        onNotify(`Official evaluation submitted successfully! Total Marks: ${totalAwarded}/${totalMax}`, 'success');
      }

      // Safely refresh and close without duplicate or failing callbacks
      try {
        if (typeof onEvaluationSaved === 'function') {
          onEvaluationSaved();
        } else if (typeof onRefresh === 'function') {
          onRefresh();
        }
      } catch (e) {
        console.warn('Post-evaluation refresh warning:', e);
      }

      try {
        if (typeof onClose === 'function') {
          onClose();
        }
      } catch (e) {
        console.warn('Post-evaluation close warning:', e);
      }
    } catch (err) {
      if (typeof onNotify === 'function') {
        onNotify('Error submitting evaluation: ' + err.message, 'error');
      }
      setIsSubmitting(false);
    }
  };

  const handleFlagRevaluation = async () => {
    if (!revalReason.trim()) {
      if (typeof onNotify === 'function') {
        onNotify('Please enter a specific discrepancy reason for revaluation scrutiny.', 'warning');
      }
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const targetId = student.id || student._id;
      await flagRevaluation(targetId, revalReason, currentUser.email);

      setShowRevalModal(false);
      setIsSubmitting(false);

      if (typeof onNotify === 'function') {
        onNotify('Script sent to Administrator Revaluation Queue successfully.', 'success');
      }

      try {
        if (typeof onEvaluationSaved === 'function') {
          onEvaluationSaved();
        } else if (typeof onRefresh === 'function') {
          onRefresh();
        }
      } catch (e) {
        console.warn('Post-reval refresh warning:', e);
      }

      try {
        if (typeof onClose === 'function') {
          onClose();
        }
      } catch (e) {
        console.warn('Post-reval close warning:', e);
      }
    } catch (err) {
      if (typeof onNotify === 'function') {
        onNotify('Error flagging for revaluation: ' + err.message, 'error');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="evaluation-modal">
      {/* Top Header */}
      <div className="evaluation-header">
        <div className="eval-student-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '15px' }}>{student.enrollment}</span>
            <span className="eval-badge">{student.studentName}</span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>{student.subjectCode}</strong>: {student.subjectTitle} | Session: {student.examSession}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-glass-accent)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-strong)' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>Total Score:</span>
            <span style={{ fontSize: '16px', fontWeight: 800, color: totalAwarded >= (totalMax * 0.4) ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {totalAwarded} / {totalMax}
            </span>
          </div>

          <button className="btn btn-secondary btn-sm btn-icon-only" onClick={onClose} title="Close Evaluation Studio">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 3-Section Workspace */}
      <div className="evaluation-workspace">
        {/* SECTION 1 (Left): Marking Section */}
        <div className="eval-section-marking">
          <div className="section-title">
            <span>Marking Scheme & Scores</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{questions.length} Items</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '14px' }}>
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="question-row">
                <div style={{ flex: 1, paddingRight: '8px' }}>
                  <div className="question-label">{q.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Score: {q.maxMarks} pts</div>
                </div>

                <div className="question-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max={q.maxMarks}
                    step="0.5"
                    value={q.marks}
                    onChange={(e) => handleMarksChange(q.id, e.target.value)}
                  />
                  <span className="question-max-label">/ {q.maxMarks}</span>
                </div>
              </div>
            ))}

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label>Evaluator Remarks & Scrutiny Notes</label>
              <textarea
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter feedback, rubric compliance or remarks..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '12px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '8px' }}
              onClick={handleInitiateSubmit}
              disabled={isSubmitting}
            >
              <Save size={14} />
              Submit Official Marks Evaluation
            </button>

            <button
              className="btn btn-danger btn-sm"
              style={{ width: '100%' }}
              onClick={() => setShowRevalModal(true)}
              disabled={isSubmitting}
            >
              <AlertTriangle size={14} />
              Flag for Revaluation Queue
            </button>
          </div>
        </div>

        {/* SECTION 2 (Center): Scanned Answer Sheet Canvas Viewer */}
        <div className="eval-section-viewer">
          <div className="viewer-toolbar">
            <div className="viewer-page-controls">
              <button
                className="btn btn-secondary btn-sm btn-icon-only"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                title="Previous Page (Left Arrow)"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Direct Page Jump Dropdown */}
              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1.5px solid #FC6C26',
                  background: '#F8E7C9',
                  color: '#064E3B',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                title="Jump directly to any page"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <option key={p} value={p}>Page {p} of {totalPages}</option>
                ))}
              </select>

              <button
                className="btn btn-secondary btn-sm btn-icon-only"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                title="Next Page (Right Arrow)"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}>
                <ZoomOut size={14} />
              </button>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', width: '38px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}>
                <ZoomIn size={14} />
              </button>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setZoom(1.0)}>
                <RotateCw size={14} />
              </button>
            </div>
          </div>

          {/* Quick Page Toggle Strip */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(252, 108, 38, 0.1)',
              padding: '6px 16px',
              borderBottom: '1px solid #FC6C26',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#064E3B', marginRight: '4px' }}>
                Pages:
              </span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #FC6C26',
                    background: currentPage === p ? '#FC6C26' : '#F8E7C9',
                    color: '#064E3B',
                    fontWeight: currentPage === p ? 800 : 600,
                    fontSize: '11px',
                    cursor: 'pointer',
                    minWidth: '24px'
                  }}
                  title={`Go to Page ${p}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="viewer-canvas-container">
            {deliverableUrl ? (
              <div className="answer-sheet-canvas-wrapper" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                <img
                  src={deliverableUrl}
                  alt={`Answer Sheet Page ${currentPage}`}
                  style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain', display: 'block' }}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <h3>Digital Canvas Script</h3>
                <p>Candidate: {student.studentName} ({student.enrollment})</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3 (Right): AI Summary (Strictly left empty as designed) */}
        <div className="eval-section-ai">
          <div className="ai-summary-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={16} />
              <span>AI Summary</span>
            </div>
          </div>
          <div className="ai-summary-body">
            {/* Strictly left empty as per architectural design requirement */}
          </div>
        </div>
      </div>

      {/* Flag for Revaluation Modal */}
      {showRevalModal && (
        <div className="modal-backdrop" onClick={() => setShowRevalModal(false)}>
          <div className="modal-dialog liquid-glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Flag Script for Revaluation</h3>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setShowRevalModal(false)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Candidate: <strong>{student.enrollment}</strong> ({student.studentName}) - {student.subjectCode}
            </p>
            <div className="form-group">
              <label>Reason for Revaluation Discrepancy *</label>
              <textarea
                rows="4"
                value={revalReason}
                onChange={(e) => setRevalReason(e.target.value)}
                placeholder="Detail the marks discrepancy, missing questions, or reason for revaluation..."
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowRevalModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleFlagRevaluation} disabled={isSubmitting}>
                Confirm & Route to Revaluation Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Ask Evaluator Once Again Before Finally Submitting Evaluated Marks */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setShowConfirmModal(false)}>
          <div className="modal-dialog liquid-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="#FC6C26" />
                Confirm Official Marks Submission
              </h3>
              <button 
                className="btn btn-secondary btn-sm btn-icon-only" 
                onClick={() => !isSubmitting && setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(252, 108, 38, 0.1)', padding: '16px', borderRadius: '8px', border: '1.5px solid #FC6C26', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#064E3B' }}>Candidate Name:</span>
                <strong style={{ fontSize: '13px', color: '#064E3B' }}>{student.name || student.studentName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#064E3B' }}>Enrollment Number:</span>
                <strong style={{ fontSize: '13px', color: '#064E3B', fontFamily: 'monospace' }}>{student.enrollmentNumber || student.enrollment}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#064E3B' }}>Subject:</span>
                <strong style={{ fontSize: '13px', color: '#064E3B' }}>{student.subject || student.subjectTitle || student.subjectCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #FC6C26' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#064E3B' }}>Total Evaluated Marks:</span>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#064E3B' }}>
                  {totalAwarded} / {totalMax} ({((totalAwarded / totalMax) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '18px', maxHeight: '140px', overflowY: 'auto', border: '1px solid rgba(252, 108, 38, 0.3)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#FC6C26' }}>
                Question-wise Breakdown:
              </div>
              {questions.map((q, idx) => (
                <div key={q.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderBottom: idx < questions.length - 1 ? '1px dotted rgba(6, 78, 59, 0.15)' : 'none' }}>
                  <span>{q.label}</span>
                  <strong>{q.marks} / {q.maxMarks}</strong>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '12.5px', color: '#064E3B', marginBottom: '20px', lineHeight: 1.5 }}>
              Are you sure you want to finally submit the evaluated marks of <strong>{totalAwarded} / {totalMax}</strong> for candidate <strong>{student.name || student.studentName}</strong>? Once confirmed, this evaluation is locked and recorded officially.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel & Review
              </button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={executeSubmitEvaluation}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit Final Marks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
