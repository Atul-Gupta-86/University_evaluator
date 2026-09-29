import React, { useState } from 'react';
import { RotateCcw, Users, UserCheck, CheckCircle2, Search, Eye, UserPlus, CheckSquare, BarChart2, X } from 'lucide-react';
import { resolveRevaluation } from '../../api';

export default function AdministratorDashboard({ 
  students = [], 
  teachers = [], 
  metrics, 
  onInspectStudent, 
  onEvaluateStudent, 
  onViewDocument, 
  onRefresh 
}) {
  const [activeTab, setActiveTab] = useState('revaluation'); // 'revaluation' | 'students' | 'teachers'
  const [studentFilter, setStudentFilter] = useState('all'); // 'all' | 'allocated' | 'evaluated' | 'not_allocated'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherForPerf, setSelectedTeacherForPerf] = useState(null);

  // Helper to accurately resolve page count of answer script
  const getPageCount = (item) => {
    if (item?.totalPages && Number(item.totalPages) > 0) return Number(item.totalPages);
    if (item?.pages && Array.isArray(item.pages) && item.pages.length > 0) return item.pages.length;
    const url = (item?.copyUrl || item?.copy_url || item?.fileUrl || item?.url || '').toLowerCase();
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp')) return 1;
    return 1;
  };

  // Safe document inspector handler
  const handleInspect = (s) => {
    const docData = { ...s, totalPages: getPageCount(s) };
    if (typeof onInspectStudent === 'function') {
      onInspectStudent(docData);
    } else if (typeof onViewDocument === 'function') {
      const url = s.copyUrl || s.copy_url || s.fileUrl || s.url || s.scannedCopyUrl;
      onViewDocument(url, `Student Answer Script: ${s.name || s.studentName || 'Candidate'} (${s.enrollmentNumber || s.enrollment || 'N/A'})`, docData);
    } else {
      if (typeof onNotify === 'function') onNotify('Answer script viewer handler is not configured.', 'warning');
    }
  };

  // Reallocate Modal State
  const [reallocStudent, setReallocStudent] = useState(null);
  const [selectedNewTeacher, setSelectedNewTeacher] = useState('');
  const [reallocRemarks, setReallocRemarks] = useState('');
  const [isReallocating, setIsReallocating] = useState(false);

  // Filter categorization
  const isEvaluated = (s) => s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
  const isAllocated = (s) => !isEvaluated(s) && (s.status === 'Allocated' || s.allocationStatus === 'allocated' || !!s.assignedTeacher || !!s.allocatedTeacherId || !!s.allocatedTeacher || !!s.allocatedTeacherName);
  const isNotAllocated = (s) => !isEvaluated(s) && !isAllocated(s);

  const revalStudents = students.filter(s => !isEvaluated(s) && (s.inRevaluation === true || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation') && !s.revaluation?.resolved);
  const evaluatedStudents = students.filter(isEvaluated);
  const allocatedStudents = students.filter(isAllocated);
  const notAllocatedStudents = students.filter(isNotAllocated);

  let displayList = students;
  if (studentFilter === 'allocated') displayList = allocatedStudents;
  else if (studentFilter === 'evaluated') displayList = evaluatedStudents;
  else if (studentFilter === 'not_allocated') displayList = notAllocatedStudents;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayList = displayList.filter(s =>
      (s.enrollmentNumber || s.enrollment || '').toLowerCase().includes(q) ||
      (s.name || s.studentName || '').toLowerCase().includes(q) ||
      (s.subject || s.subjectCode || '').toLowerCase().includes(q) ||
      (s.allocatedTeacher || s.allocatedTeacherName || '').toLowerCase().includes(q)
    );
  }

  const handleOpenReallocate = (s) => {
    setReallocStudent(s);
    setSelectedNewTeacher(teachers[0]?.email || '');
    setReallocRemarks('');
  };

  const handleConfirmReallocate = async () => {
    if (!selectedNewTeacher) {
      if (typeof onNotify === 'function') onNotify('Please select a new evaluator teacher.', 'warning');
      return;
    }

    const teacherObj = teachers.find(t => t.email === selectedNewTeacher);
    const teacherName = teacherObj ? teacherObj.name : selectedNewTeacher;

    setIsReallocating(true);
    try {
      await resolveRevaluation(reallocStudent.id, {
        action: 'reassign',
        newTeacherEmail: selectedNewTeacher,
        newTeacherName: teacherName,
        adminRemarks: reallocRemarks
      });
      if (typeof onNotify === 'function') {
        onNotify(`Script ${reallocStudent.enrollmentNumber || reallocStudent.enrollment} reallocated successfully to ${teacherName}.`, 'success');
      }
      setReallocStudent(null);
      onRefresh();
    } catch (e) {
      if (typeof onNotify === 'function') onNotify(`Reallocation failed: ${e.message}`, 'error');
    } finally {
      setIsReallocating(false);
    }
  };

  return (
    <div className="tab-pane active">
      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'revaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('revaluation')}
        >
          <RotateCcw size={15} />
          Revaluation Queue ({revalStudents.length})
        </button>

        <button 
          className={`nav-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <Users size={15} />
          Student Directory ({students.length})
        </button>

        <button 
          className={`nav-tab ${activeTab === 'teachers' ? 'active' : ''}`}
          onClick={() => setActiveTab('teachers')}
        >
          <UserCheck size={15} />
          Teachers Scrutiny & Performance ({teachers.length})
        </button>
      </div>

      {/* TAB 1: Revaluation Queue */}
      {activeTab === 'revaluation' && (
        <div>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
                Revaluation & Scrutiny Section
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Scripts flagged by evaluators for marks revision or discrepancy. Choose to either allocate to a new teacher or check directly by yourself.
              </p>
            </div>
            <span className={`status-pill ${revalStudents.length > 0 ? 'status-pending' : 'status-checked'}`}>
              {revalStudents.length} Copies Awaiting Scrutiny
            </span>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Enrollment No</th>
                  <th>Student Name</th>
                  <th>Subject</th>
                  <th>Flagged By</th>
                  <th>Discrepancy Reason</th>
                  <th>Preliminary Marks</th>
                  <th style={{ textAlign: 'center', minWidth: '280px' }}>Administrative Action Options</th>
                </tr>
              </thead>
              <tbody>
                {revalStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                      No answer scripts currently pending revaluation.
                    </td>
                  </tr>
                ) : (
                  revalStudents.map(s => (
                    <tr key={s.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{s.enrollment}</td>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td><span style={{ fontWeight: 600 }}>{s.subjectCode}</span>: {s.subjectTitle}</td>
                      <td>{s.revaluation?.teacherEmail || s.allocatedTeacherName || 'Evaluator'}</td>
                      <td style={{ color: 'var(--accent-red)', maxWidth: '240px', fontSize: '12px' }}>
                        {s.revaluation?.reason || 'Discrepancy noted during grading.'}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {s.evaluation ? `${s.evaluation.totalMarksAwarded} / ${s.evaluation.maxPossibleMarks}` : 'N/A'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* OPTION 0: Inspect Script directly in Revaluation Queue */}
                          <button 
                            className="btn btn-outline btn-sm"
                            onClick={() => handleInspect(s)}
                            title="Inspect candidate answer copy"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={13} />
                            Inspect Script ({getPageCount(s)} {getPageCount(s) === 1 ? 'Page' : 'Pages'})
                          </button>

                          {/* OPTION 1: Allocate to new teacher */}
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenReallocate(s)}
                            title="Reallocate script to a different evaluator teacher"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <UserPlus size={13} />
                            Allocate to New Teacher
                          </button>

                          {/* OPTION 2: Check by Administrator himself (KEPT as requested!) */}
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => onEvaluateStudent(s)}
                            title="Open 3-section studio to evaluate directly as Administrator"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <CheckSquare size={13} />
                            Check by Myself
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Student Directory */}
      {activeTab === 'students' && (
        <div>
          {/* Sub-filter Pills & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className={`btn btn-sm ${studentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStudentFilter('all')}
              >
                All Students ({students.length})
              </button>
              <button 
                className={`btn btn-sm ${studentFilter === 'allocated' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStudentFilter('allocated')}
              >
                Allocated Students ({allocatedStudents.length})
              </button>
              <button 
                className={`btn btn-sm ${studentFilter === 'evaluated' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStudentFilter('evaluated')}
              >
                Evaluated ({evaluatedStudents.length})
              </button>
              <button 
                className={`btn btn-sm ${studentFilter === 'not_allocated' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStudentFilter('not_allocated')}
              >
                Not Allocated to any Teacher ({notAllocatedStudents.length})
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search Enrollment, Name, Subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '280px', padding: '7px 12px', fontSize: '12px' }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Enrollment No</th>
                  <th>Student Name</th>
                  <th>Subject</th>
                  <th>Uploaded Date</th>
                  <th>Allocation Status</th>
                  <th>Evaluation Status</th>
                  <th>Assigned Teacher</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                      No students found matching current filter.
                    </td>
                  </tr>
                ) : (
                  displayList.map(s => {
                    const isChecked = s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
                    const isReval = !isChecked && (s.inRevaluation === true || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation');
                    const isAllocated = isChecked || s.allocationStatus === 'allocated' || !!s.allocatedTeacherId || !!s.allocatedTeacher || !!s.allocatedTeacherName;

                    return (
                      <tr key={s.id}>
                        <td className="mono" style={{ fontWeight: 700 }}>{s.enrollmentNumber || s.enrollment}</td>
                        <td style={{ fontWeight: 600 }}>{s.name || s.studentName}</td>
                        <td><span style={{ fontWeight: 600 }}>{s.subjectCode || s.subject}</span>: {s.subjectTitle || s.subject}</td>
                        <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(s.uploadedDate || Date.now()).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          <span className={`status-pill ${isAllocated ? 'status-allocated' : 'status-unallocated'}`}>
                            {isAllocated ? 'Allocated' : 'Unallocated'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isChecked ? 'status-evaluated' : (isReval ? 'status-revaluation' : 'status-pending')}`}>
                            {isChecked ? 'Evaluated' : (isReval ? 'Revaluation' : 'Pending')}
                          </span>
                        </td>
                        <td>{s.allocatedTeacherName || s.allocatedTeacher || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}</td>
                        <td style={{ textAlign: 'center' }}>
                          {/* ONLY INSPECT BUTTON (Check/Evaluate button removed from Student Directory as requested!) */}
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => handleInspect(s)}
                            title="Inspect candidate answer copy"
                          >
                            <Eye size={13} />
                            Inspect ({getPageCount(s)} {getPageCount(s) === 1 ? 'Page' : 'Pages'})
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Teachers Scrutiny & Performance */}
      {activeTab === 'teachers' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Active Academic Evaluators Registry & Performance</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Teachers currently receiving answer sheet allocations and submitting evaluations.</p>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Department</th>
                  <th>Login Email</th>
                  <th>Allocated Copies</th>
                  <th>Evaluated Copies</th>
                  <th>Pending Copies</th>
                  <th>Completion Rate</th>
                  <th style={{ textAlign: 'center' }}>Detailed Performance</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => {
                  const teacherStudents = students.filter(s => 
                    s.allocatedTeacherEmail === t.email || 
                    s.allocatedTeacherId === t.email ||
                    s.allocatedTeacher === t.name ||
                    s.allocatedTeacherName === t.name
                  );
                  const checkedCount = teacherStudents.filter(s => s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation).length;
                  const pendingCount = teacherStudents.length - checkedCount;
                  const rate = teacherStudents.length > 0 ? ((checkedCount / teacherStudents.length) * 100).toFixed(0) : 0;

                  return (
                    <tr key={t.email}>
                      <td style={{ fontWeight: 700 }}>{t.name}</td>
                      <td>{t.department}</td>
                      <td className="mono" style={{ fontSize: '12px' }}>{t.email}</td>
                      <td style={{ fontWeight: 700 }}>{teacherStudents.length}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{checkedCount}</td>
                      <td style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{pendingCount}</td>
                      <td>
                        <span className="status-pill status-checked">{rate}% Evaluated</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => setSelectedTeacherForPerf(t)}
                          title={`View comprehensive performance analytics for ${t.name}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <BarChart2 size={13} /> View Detailed Performance
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reallocate Script Modal */}
      {reallocStudent && (
        <div className="modal-backdrop" onClick={() => setReallocStudent(null)}>
          <div className="modal-dialog liquid-glass" onClick={(e) => e.stopPropagation()} style={{ padding: '28px 32px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3>Reallocate Script: {reallocStudent.enrollmentNumber || reallocStudent.enrollment}</h3>
              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => setReallocStudent(null)}>
                ×
              </button>
            </div>

            <div style={{ background: 'rgba(232, 224, 202, 0.4)', padding: '12px', borderRadius: '4px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '4px' }}>
                Reported Discrepancy Reason
              </div>
              <div style={{ fontSize: '13px' }}>
                {reallocStudent.revaluation?.reason || 'Discrepancy noted during scrutiny.'}
              </div>
            </div>

            <div className="form-group">
              <label>Select New Evaluator Teacher *</label>
              <select value={selectedNewTeacher} onChange={(e) => setSelectedNewTeacher(e.target.value)}>
                {teachers.map(t => (
                  <option key={t.email} value={t.email}>
                    {t.name} ({t.department}) - {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Administrator Instructions / Scrutiny Remarks</label>
              <textarea
                rows="3"
                value={reallocRemarks}
                onChange={(e) => setReallocRemarks(e.target.value)}
                placeholder="Enter specific instructions for the new evaluator..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setReallocStudent(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmReallocate} disabled={isReallocating}>
                Confirm Reallocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Detailed Performance Modal */}
      {selectedTeacherForPerf && (() => {
        const t = selectedTeacherForPerf;
        const teacherScripts = students.filter(s => 
          s.allocatedTeacherEmail === t.email || 
          s.allocatedTeacherId === t.email ||
          s.allocatedTeacher === t.name ||
          s.allocatedTeacherName === t.name
        );
        const checkedScripts = teacherScripts.filter(s => s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation);
        const pendingScripts = teacherScripts.filter(s => !checkedScripts.includes(s));
        const flaggedScripts = teacherScripts.filter(s => s.inRevaluation || s.status === 'Sent for Revaluation');
        const rate = teacherScripts.length > 0 ? ((checkedScripts.length / teacherScripts.length) * 100).toFixed(0) : 0;

        let totalScoreSum = 0;
        let evaluatedWithScore = 0;
        checkedScripts.forEach(s => {
          const score = s.totalScore !== undefined ? s.totalScore : (s.evaluation?.totalMarksAwarded || s.evaluation?.totalScore || 0);
          if (score > 0) {
            totalScoreSum += score;
            evaluatedWithScore++;
          }
        });
        const avgScore = evaluatedWithScore > 0 ? (totalScoreSum / evaluatedWithScore).toFixed(1) : 'N/A';

        return (
          <div className="modal-backdrop" onClick={() => setSelectedTeacherForPerf(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 99999 }}>
            <div 
              className="modal-dialog liquid-glass" 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                maxWidth: '750px', 
                width: '100%', 
                maxHeight: '85vh', 
                padding: 0,
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column',
                background: '#F8E7C9',
                border: '2px solid #FC6C26',
                borderRadius: '12px',
                boxShadow: '0 20px 45px rgba(6,78,59,0.2)'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1.5px solid #FC6C26', background: 'rgba(252, 108, 38, 0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FC6C26', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#064E3B' }}>
                    <BarChart2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#064E3B' }}>
                      {t.name} — Detailed Performance
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#064E3B', opacity: 0.85 }}>
                      {t.email} • {t.department}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm btn-icon-only" 
                  onClick={() => setSelectedTeacherForPerf(null)}
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {/* 4 Performance Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(252, 108, 38, 0.12)', padding: '14px 16px', borderRadius: '8px', border: '1.5px solid #FC6C26', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#064E3B', fontWeight: 700 }}>Total Allocated</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#064E3B', marginTop: '4px' }}>{teacherScripts.length}</div>
                  </div>
                  <div style={{ background: 'rgba(252, 108, 38, 0.12)', padding: '14px 16px', borderRadius: '8px', border: '1.5px solid #FC6C26', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#064E3B', fontWeight: 700 }}>Evaluated</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#064E3B', marginTop: '4px' }}>{checkedScripts.length}</div>
                  </div>
                  <div style={{ background: 'rgba(252, 108, 38, 0.12)', padding: '14px 16px', borderRadius: '8px', border: '1.5px solid #FC6C26', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#064E3B', fontWeight: 700 }}>Pending</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#064E3B', marginTop: '4px' }}>{pendingScripts.length}</div>
                  </div>
                  <div style={{ background: 'rgba(252, 108, 38, 0.12)', padding: '14px 16px', borderRadius: '8px', border: '1.5px solid #FC6C26', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#064E3B', fontWeight: 700 }}>Completion</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#064E3B', marginTop: '4px' }}>{rate}%</div>
                  </div>
                </div>

                {/* Additional KPI Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ padding: '12px 18px', background: 'rgba(252, 108, 38, 0.1)', borderRadius: '6px', border: '1.5px solid #FC6C26', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#064E3B' }}>Average Marks Awarded:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#064E3B' }}>{avgScore !== 'N/A' ? `${avgScore} / 70` : 'No scores yet'}</span>
                  </div>
                  <div style={{ padding: '12px 18px', background: 'rgba(252, 108, 38, 0.1)', borderRadius: '6px', border: '1.5px solid #FC6C26', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#064E3B' }}>Revaluations Flagged:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#064E3B' }}>{flaggedScripts.length} scripts</span>
                  </div>
                </div>

                {/* Allocated Scripts Breakdown Table */}
                <h4 style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', color: '#064E3B' }}>
                  Workload Breakdown ({teacherScripts.length} scripts)
                </h4>
                {teacherScripts.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#064E3B', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                    No student answer scripts are currently allocated to this teacher.
                  </p>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <table className="table" style={{ fontSize: '12px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Enrollment</th>
                          <th>Student Name</th>
                          <th>Subject</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th style={{ textAlign: 'center' }}>Script</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacherScripts.map(s => {
                          const isDone = s.evaluationStatus === 'checked' || s.status === 'Evaluated' || !!s.evaluation;
                          const score = s.totalScore !== undefined ? s.totalScore : (s.evaluation?.totalMarksAwarded || s.evaluation?.totalScore || '-');
                          return (
                            <tr key={s.id || s.enrollment}>
                              <td className="mono" style={{ fontWeight: 600 }}>{s.enrollmentNumber || s.enrollment}</td>
                              <td>{s.name || s.studentName}</td>
                              <td>{s.subjectCode || s.subject}</td>
                              <td>
                                <span className={`status-pill ${isDone ? 'status-evaluated' : 'status-pending'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                  {isDone ? 'Checked' : 'Pending'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700 }}>{isDone ? score : '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleInspect(s)}
                                >
                                  <Eye size={11} /> Inspect ({getPageCount(s)} {getPageCount(s) === 1 ? 'Pg' : 'Pgs'})
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid #FC6C26', display: 'flex', justifyContent: 'flex-end', background: 'rgba(252, 108, 38, 0.12)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTeacherForPerf(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
