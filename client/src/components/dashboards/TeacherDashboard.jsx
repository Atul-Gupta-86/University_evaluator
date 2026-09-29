import React, { useState } from 'react';
import { 
  FileCheck2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Edit3, 
  Search, 
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { sendToRevaluation } from '../../api';

export default function TeacherDashboard({ 
  currentUser, 
  students, 
  onRefresh, 
  onViewDocument, 
  onStartEvaluation, 
  onNotify 
}) {
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'evaluated'
  const [searchQuery, setSearchQuery] = useState('');
  const [revalReasonPrompt, setRevalReasonPrompt] = useState(null); // student object or null
  const [reasonText, setReasonText] = useState('');
  const [isSubmittingReval, setIsSubmittingReval] = useState(false);

  // Filter students allocated to this teacher
  const myStudents = students.filter(st => {
    const teacherId = currentUser?.id || currentUser?._id;
    const teacherEmail = (currentUser?.email || '').toLowerCase().trim();
    const teacherName = (currentUser?.name || '').toLowerCase().trim();

    // Check if evaluated by Administrator himself, but originally belonged to this teacher:
    // "If the administrator check by himself then keep the student in the list of the previous teacher"
    const prevEmail = (st.previousTeacherEmail || st.initialTeacherEmail || '').toString().toLowerCase().trim();
    const prevId = (st.previousTeacherId || '').toString().toLowerCase().trim();
    const isCheckedByAdmin = st.evaluatedByAdmin || st.checkedByAdmin || 
      ((st.status === 'Evaluated' || st.evaluationStatus === 'checked') && 
       ((st.assignedTeacher || '').toLowerCase() === 'administrator' || 
        (st.allocatedTeacherName || '').toLowerCase() === 'administrator' || 
        (st.allocatedTeacher || '').toString().toLowerCase() === 'administrator'));

    if (isCheckedByAdmin && (prevEmail === teacherEmail || prevId === (teacherId || '').toString().toLowerCase().trim())) {
      return true;
    }

    // Check allocatedTeacherId / allocatedTeacherEmail / allocatedTeacherName
    const assignedId = (st.allocatedTeacherId || '').toString().toLowerCase().trim();
    const assignedEmail = (st.allocatedTeacherEmail || '').toString().toLowerCase().trim();
    const assignedName = (st.allocatedTeacherName || '').toString().toLowerCase().trim();

    if (assignedId && (assignedId === (teacherId || '').toString().toLowerCase().trim() || assignedId === teacherEmail)) return true;
    if (assignedEmail && assignedEmail === teacherEmail) return true;
    if (assignedName && assignedName === teacherName) return true;

    // Check allocatedTeacher (can be object or string)
    if (typeof st.allocatedTeacher === 'object' && st.allocatedTeacher !== null) {
      if (st.allocatedTeacher.id && st.allocatedTeacher.id === teacherId) return true;
      if (st.allocatedTeacher.email && st.allocatedTeacher.email.toLowerCase().trim() === teacherEmail) return true;
      if (st.allocatedTeacher.name && st.allocatedTeacher.name.toLowerCase().trim() === teacherName) return true;
    } else if (typeof st.allocatedTeacher === 'string' && st.allocatedTeacher.trim()) {
      const fieldVal = st.allocatedTeacher.toLowerCase().trim();
      if (fieldVal === (teacherId || '').toString().toLowerCase().trim() || fieldVal === teacherEmail || fieldVal === teacherName) return true;
    }

    return false;
  });

  const isDone = (s) => s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
  const isInEvaluationQueue = (s) => (s.inRevaluation || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation' || (s.revaluation && !s.revaluation.resolved)) && !isDone(s);

  // Calculate teacher stats
  const totalAllocated = myStudents.length;
  const evaluatedCount = myStudents.filter(isDone).length;
  const evaluationQueueCount = myStudents.filter(isInEvaluationQueue).length;
  const pendingCount = myStudents.filter(s => !isDone(s) && !isInEvaluationQueue(s)).length;

  // Filtered by sub-tab and search
  const filteredList = myStudents.filter(st => {
    if (filterTab === 'pending') {
      if (isDone(st)) return false;
    } else if (filterTab === 'evaluated') {
      if (!isDone(st)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (st.name || st.studentName || '').toLowerCase().includes(q) ||
        (st.enrollmentNumber || st.enrollment || '').toLowerCase().includes(q) ||
        (st.subject || st.subjectCode || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSendToRevalSubmit = async (e) => {
    e.preventDefault();
    if (!reasonText.trim()) {
      onNotify('Please provide a specific justification for sending this script to the revaluation board.', 'warning');
      return;
    }

    try {
      setIsSubmittingReval(true);
      await sendToRevaluation(revalReasonPrompt._id || revalReasonPrompt.id, reasonText.trim());
      onNotify(`Answer script for ${revalReasonPrompt.name || revalReasonPrompt.studentName} escalated to Revaluation Board.`, 'success');
      setRevalReasonPrompt(null);
      setReasonText('');
      onRefresh();
    } catch (err) {
      onNotify(`Revaluation escalation failed: ${err.message}`, 'error');
    } finally {
      setIsSubmittingReval(false);
    }
  };

  // Helper to accurately resolve page count of answer script
  const getPageCount = (st) => {
    if (st?.totalPages && Number(st.totalPages) > 0) return Number(st.totalPages);
    if (st?.pages && Array.isArray(st.pages) && st.pages.length > 0) return st.pages.length;
    const url = (st?.copyUrl || st?.copy_url || st?.fileUrl || '').toLowerCase();
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp')) return 1;
    return 1;
  };

  return (
    <div className="tab-pane active">
      {/* Teacher Stats Banner - 4 boxes including Evaluation Queue */}
      <div className="metrics-grid" style={{ marginBottom: '28px' }}>
        {/* 1. Allocated Bundles */}
        <div className="stat-box liquid-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-box-label">Allocated Bundles</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={16} color="#FC6C26" />
            </div>
          </div>
          <span className="stat-box-value" style={{ color: '#064E3B' }}>
            {totalAllocated}
          </span>
          <span className="stat-box-subtext">Assigned for current cycle</span>
        </div>

        {/* 2. Evaluated Scripts */}
        <div className="stat-box liquid-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-box-label">Evaluated Scripts</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#064E3B" />
            </div>
          </div>
          <span className="stat-box-value" style={{ color: '#064E3B' }}>
            {evaluatedCount}
          </span>
          <span className="stat-box-subtext">Completed & marks locked</span>
        </div>

        {/* 3. Pending Evaluation */}
        <div className="stat-box liquid-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-box-label">Pending Evaluation</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#FC6C26" />
            </div>
          </div>
          <span className="stat-box-value" style={{ color: '#064E3B' }}>
            {pendingCount}
          </span>
          <span className="stat-box-subtext">Awaiting grading studio</span>
        </div>

        {/* 4. Evaluation Queue */}
        <div className="stat-box liquid-glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-box-label">Evaluation Queue</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(252, 108, 38, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} color="#FC6C26" />
            </div>
          </div>
          <span className="stat-box-value" style={{ color: '#FC6C26' }}>
            {evaluationQueueCount}
          </span>
          <span className="stat-box-subtext">Sent to scrutiny queue</span>
        </div>
      </div>

      {/* Main Evaluator Registry */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px' }}>
          <div>
            <h3>Assigned Examination Scripts</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#064E3B' }}>
              Logged in Evaluator: <strong>{currentUser?.name || 'Authorized Teacher'}</strong> ({currentUser?.subject || 'All Subjects'})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#FC6C26' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '200px', height: '36px', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', padding: '3px', borderRadius: '8px' }}>
              <button 
                className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ border: 'none' }}
                onClick={() => setFilterTab('all')}
              >
                All ({myStudents.length})
              </button>
              <button 
                className={`btn btn-sm ${filterTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                style={{ border: 'none' }}
                onClick={() => setFilterTab('pending')}
              >
                Pending ({pendingCount})
              </button>
              <button 
                className={`btn btn-sm ${filterTab === 'evaluated' ? 'btn-primary' : 'btn-outline'}`}
                style={{ border: 'none' }}
                onClick={() => setFilterTab('evaluated')}
              >
                Evaluated ({evaluatedCount})
              </button>
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Roll / Enrollment</th>
                  <th>Candidate Name</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Awarded Marks</th>
                  <th style={{ textAlign: 'right' }}>Evaluation Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px', color: '#064E3B' }}>
                      {myStudents.length === 0 
                        ? 'No answer scripts have been allocated to your account yet.' 
                        : 'No candidate copies match the selected filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((st) => (
                    <tr key={st._id || st.id}>
                      <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{st.enrollmentNumber}</td>
                      <td>{st.name}</td>
                      <td>
                        <span className="badge badge-neutral">{st.subject}</span>
                      </td>
                      <td>
                        {st.status === 'Evaluated' ? (
                          <span className="status-pill status-evaluated">
                            <CheckCircle2 size={12} /> Evaluated
                          </span>
                        ) : (st.inRevaluation || st.status === 'Sent for Revaluation' || st.evaluationStatus === 'revaluation' || (st.revaluation && !st.revaluation.resolved)) ? (
                          <span className="status-pill status-revaluation">
                            <RotateCcw size={12} /> Revaluation
                          </span>
                        ) : (
                          <span className="status-pill status-pending">
                            <Clock size={12} /> Pending Review
                          </span>
                        )}
                      </td>
                      <td>
                        {st.status === 'Evaluated' && st.totalScore !== undefined ? (
                          <span style={{ fontWeight: 'bold', color: '#064E3B', fontSize: '14px' }}>
                            {st.totalScore} / 100
                          </span>
                        ) : (
                          <span style={{ color: '#064E3B', opacity: 0.6, fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          {st.copyUrl && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => onViewDocument(st.copyUrl, `Copy: ${st.name || st.studentName} (${st.enrollmentNumber || st.enrollment})`, { ...st, totalPages: getPageCount(st) })}
                              title="Inspect Script"
                            >
                              <Eye size={14} /> Preview ({getPageCount(st)} {getPageCount(st) === 1 ? 'Page' : 'Pages'})
                            </button>
                          )}

                          {/* If flagged for Revaluation Queue, strictly remove the Evaluate Option */}
                          {(st.inRevaluation || st.status === 'Sent for Revaluation' || st.evaluationStatus === 'revaluation' || (st.revaluation && !st.revaluation.resolved)) ? (
                            <span 
                              className="status-pill status-revaluation"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '5px 10px' }}
                              title="Script escalated to Revaluation Board - evaluation locked"
                            >
                              <RotateCcw size={12} /> In Revaluation Queue
                            </span>
                          ) : isDone(st) ? (
                            <span 
                              className="status-pill status-evaluated"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', padding: '5px 10px' }}
                              title="Script evaluated and marks officially locked - no re-evaluation permitted"
                            >
                              <CheckCircle2 size={12} /> Evaluated {st.evaluatedByAdmin || st.assignedTeacher === 'Administrator' ? '(Admin)' : ''}
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onStartEvaluation(st)}
                              title="Open grading studio to evaluate script"
                            >
                              <FileCheck2 size={14} /> Evaluate Script
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Escalate to Revaluation Modal */}
      {revalReasonPrompt && (
        <div className="modal-backdrop" onClick={() => setRevalReasonPrompt(null)}>
          <div className="modal-dialog liquid-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '28px 32px' }}>
            <div className="modal-header" style={{ marginBottom: '18px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#064E3B' }}>
                <RotateCcw size={20} color="#FC6C26" /> Escalate to Revaluation
              </h3>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setRevalReasonPrompt(null)}>✕</button>
            </div>
            <div>
              <p style={{ fontSize: '13px', color: '#064E3B', marginBottom: '16px' }}>
                You are about to refer candidate <strong>{revalReasonPrompt.name}</strong> ({revalReasonPrompt.enrollmentNumber}) for second-opinion revaluation or head scrutiny.
              </p>
              <form onSubmit={handleSendToRevalSubmit}>
                <div className="form-group">
                  <label>Scrutiny Justification / Reason <span style={{ color: '#FC6C26' }}>*</span></label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Provide specific notes regarding illegible answers, syllabus mismatch, or question paper ambiguity..."
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setRevalReasonPrompt(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmittingReval}>
                    {isSubmittingReval ? 'Submitting...' : 'Confirm Escalation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
