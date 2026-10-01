import React, { useState, useEffect } from 'react';
import {
  Users, UserCheck, BookOpen, UserPlus, FileText, CheckCircle2,
  Eye, Upload, AlertCircle, RefreshCw, Trash2, BarChart2, X, Clock, Award
} from 'lucide-react';
import { allocateStudents, addTeacher, deleteTeacher, addReference, uploadFileToCloudinary, fetchDocumentPageCount, formatDeptSubject } from '../../api';
import './AdministratorDashboard.css';

export default function AdminDashboard({
  currentUser,
  students = [],
  teachers = [],
  departments = [],
  subjects = [],
  references = [],
  metrics,
  onInspectStudent,
  onViewReference,
  onViewDocument,
  onRefresh,
  onNotify
}) {
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'teachers' | 'enrollments' | 'add-teacher' | 'answer-ref'
  const [studentFilter, setStudentFilter] = useState('all'); // 'all' | 'allocated' | 'evaluated' | 'not_allocated'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  const [selectedTeacherForPerf, setSelectedTeacherForPerf] = useState(null);
  const [pageCounts, setPageCounts] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchMissingPageCounts = async () => {
      for (const s of students) {
        const id = s.id || s._id || s.enrollmentNumber || s.enrollment;
        const url = s.copyUrl || s.copy_url || s.fileUrl || s.url;
        if (!url || (s.totalPages && Number(s.totalPages) > 1)) continue;
        if (pageCounts[id]) continue;
        const clean = url.toLowerCase();
        if (clean.includes('.png') || clean.includes('.jpg') || clean.includes('.jpeg') || clean.includes('.webp')) {
          continue;
        }
        try {
          const count = await fetchDocumentPageCount(url);
          if (isMounted && count && count > 0) {
            setPageCounts(prev => ({ ...prev, [id]: count }));
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchMissingPageCounts();
    return () => { isMounted = false; };
  }, [students]);

  // Helper to accurately resolve page count of answer script or reference document
  const getPageCount = (item) => {
    const id = item?.id || item?._id || item?.enrollmentNumber || item?.enrollment;
    if (id && pageCounts[id] && pageCounts[id] > 0) return pageCounts[id];
    if (item?.totalPages && Number(item.totalPages) > 0) return Number(item.totalPages);
    if (item?.pages && Array.isArray(item.pages) && item.pages.length > 0) return item.pages.length;
    const url = (item?.copyUrl || item?.copy_url || item?.fileUrl || item?.url || '').toLowerCase();
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp')) return 1;
    return 1;
  };

  // Safe document and reference inspection handlers
  const handleInspect = (s) => {
    const docData = { ...s, totalPages: getPageCount(s) };
    if (typeof onInspectStudent === 'function') {
      onInspectStudent(docData);
    } else if (typeof onViewDocument === 'function') {
      const url = s.copyUrl || s.copy_url || s.fileUrl || s.url || s.scannedCopyUrl;
      onViewDocument(url, `Student Answer Script: ${s.name || s.studentName || 'Candidate'} (${s.enrollmentNumber || s.enrollment || 'N/A'})`, docData);
    } else {
      if (onNotify) onNotify('Answer script viewer handler is not configured.', 'warning');
    }
  };

  const handleViewRef = (r) => {
    const docData = { ...r, totalPages: getPageCount(r) };
    if (typeof onViewReference === 'function') {
      onViewReference(docData);
    } else if (typeof onViewDocument === 'function') {
      const url = r.fileUrl || r.copy_url || r.copyUrl || r.url || r.secure_url;
      onViewDocument(url, `Official Answer Reference: ${r.subjectCode} - ${r.department || ''}`, docData);
    } else {
      if (onNotify) onNotify('Reference document viewer handler is not configured.', 'warning');
    }
  };

  const handleRemoveTeacher = async (teacher) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove evaluator "${teacher.name}" (${teacher.email})?\nThis will remove their account and evaluation privileges.`);
    if (!confirmDelete) return;

    try {
      await deleteTeacher(teacher.email || teacher.id);
      if (onNotify) {
        onNotify(`Evaluator "${teacher.name}" removed successfully from registry.`, 'success');
      }
      onRefresh();
    } catch (err) {
      if (onNotify) {
        onNotify(`Failed to remove evaluator: ${err.message}`, 'error');
      }
    }
  };

  // Add Teacher Form State
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherDept, setTeacherDept] = useState('');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);

  // Add Answer Reference Form State
  const [refDepartment, setRefDepartment] = useState('');
  const [refSubjectCode, setRefSubjectCode] = useState('');
  const [refExamSession, setRefExamSession] = useState('May-June 2026');
  const [refDescription, setRefDescription] = useState('');
  const [refFile, setRefFile] = useState(null);
  const [isPublishingRef, setIsPublishingRef] = useState(false);

  // Dynamic Filtering Logic
  const isEvaluated = (s) => s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
  const isAllocated = (s) => !isEvaluated(s) && (s.status === 'Allocated' || s.allocationStatus === 'allocated' || !!s.assignedTeacher || !!s.allocatedTeacherId || !!s.allocatedTeacher || !!s.allocatedTeacherName);
  const isNotAllocated = (s) => !isEvaluated(s) && !isAllocated(s);

  const evaluatedStudents = students.filter(isEvaluated);
  const allocatedStudents = students.filter(isAllocated);
  const notAllocatedStudents = students.filter(isNotAllocated);

  let filteredList = students;
  if (studentFilter === 'allocated') filteredList = allocatedStudents;
  else if (studentFilter === 'evaluated') filteredList = evaluatedStudents;
  else if (studentFilter === 'not_allocated') filteredList = notAllocatedStudents;

  // 100-student Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filteredList.slice(startIndex, startIndex + pageSize);

  // Multi-select Checkbox Handling
  const unallocatedOnPage = pageItems.filter(s => !(s.allocationStatus === 'allocated' || !!s.allocatedTeacherId));
  const isAllSelected = unallocatedOnPage.length > 0 && unallocatedOnPage.every(s => selectedStudentIds.has(s.id));

  const handleToggleSelectAll = (checked) => {
    const nextSet = new Set(selectedStudentIds);
    unallocatedOnPage.forEach(s => {
      if (checked) nextSet.add(s.id);
      else nextSet.delete(s.id);
    });
    setSelectedStudentIds(nextSet);
  };

  const handleToggleStudent = (id, checked) => {
    const nextSet = new Set(selectedStudentIds);
    if (checked) nextSet.add(id);
    else nextSet.delete(id);
    setSelectedStudentIds(nextSet);
  };

  const handleAllocate = async () => {
    if (!selectedTeacherEmail) {
      if (onNotify) onNotify('Please select an evaluator teacher from the dropdown.', 'warning');
      return;
    }
    if (selectedStudentIds.size === 0) {
      if (onNotify) onNotify('Please select at least one unallocated student using the checkboxes below.', 'warning');
      return;
    }

    const teacherObj = teachers.find(t => t.email === selectedTeacherEmail);
    const teacherName = teacherObj ? teacherObj.name : 'Evaluator';

    setIsAllocating(true);
    try {
      const res = await allocateStudents(Array.from(selectedStudentIds), selectedTeacherEmail, teacherName);
      if (onNotify) {
        onNotify(`Allocated ${res.allocatedCount} answer copies to ${teacherName} successfully.`, 'success');
      }
      setSelectedStudentIds(new Set());
      onRefresh();
    } catch (err) {
      if (onNotify) onNotify(`Allocation error: ${err.message}`, 'error');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!teacherDept) {
      if (onNotify) onNotify('Please select an Academic Department.', 'warning');
      return;
    }
    if (!teacherSubject) {
      if (onNotify) onNotify('Please select a Subject for this evaluator.', 'warning');
      return;
    }
    setIsAddingTeacher(true);
    try {
      await addTeacher({
        name: teacherName.trim(),
        email: teacherEmail.trim(),
        department: teacherDept.trim(),
        subject: teacherSubject.trim(),
        password: teacherPassword
      });
      if (onNotify) {
        onNotify(`New evaluator ${teacherName} registered successfully.`, 'success');
      }
      setTeacherName('');
      setTeacherEmail('');
      setTeacherDept('');
      setTeacherSubject('');
      setTeacherPassword('');
      onRefresh();
    } catch (err) {
      if (onNotify) onNotify(`Error registering evaluator: ${err.message}`, 'error');
    } finally {
      setIsAddingTeacher(false);
    }
  };

  const handlePublishReference = async (e) => {
    e.preventDefault();
    if (!refDepartment) {
      if (onNotify) onNotify('Please select an Academic Department before uploading reference.', 'warning');
      return;
    }
    if (!refSubjectCode) {
      if (onNotify) onNotify('Please select a Subject Code before uploading reference.', 'warning');
      return;
    }
    // MANDATORY FILE SELECTION CHECK
    if (!refFile) {
      if (onNotify) onNotify('Please select an Answer Reference Document file (PDF) before submitting.', 'warning');
      return;
    }

    setIsPublishingRef(true);
    try {
      // 1. Convert file to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(refFile);
      });

      // 2. Upload directly to Cloudinary
      const uploadRes = await uploadFileToCloudinary(
        base64Data,
        refFile.name,
        'OFFICIAL_REF',
        refSubjectCode.trim().toUpperCase()
      );

      if (!uploadRes.success) {
        throw new Error(uploadRes.error || 'Cloudinary upload failed');
      }

      const copyUrl = uploadRes.copy_url || uploadRes.fileUrl;

      // 3. Save into answer_references collection
      await addReference({
        department: refDepartment.trim(),
        subjectCode: refSubjectCode.trim().toUpperCase(),
        examSession: refExamSession.trim(),
        fileName: refFile.name,
        fileSize: (refFile.size / (1024 * 1024)).toFixed(1) + ' MB',
        description: refDescription.trim(),
        fileUrl: copyUrl,
        copy_url: copyUrl,
        cloudinaryPublicId: uploadRes.publicId || null
      });

      if (onNotify) {
        onNotify(`Official Answer Reference for ${refSubjectCode} published successfully.`, 'success');
      }
      setRefDepartment('');
      setRefSubjectCode('');
      setRefDescription('');
      setRefFile(null);
      onRefresh();
    } catch (err) {
      if (onNotify) onNotify(`Error publishing reference: ${err.message}`, 'error');
    } finally {
      setIsPublishingRef(false);
    }
  };

  return (
    <div className="tab-pane active">
      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <Users size={15} />
          Student Allocation & Management
        </button>

        <button
          className={`nav-tab ${activeTab === 'teachers' ? 'active' : ''}`}
          onClick={() => setActiveTab('teachers')}
        >
          <UserCheck size={15} />
          Teachers Performance
        </button>

        <button
          className={`nav-tab ${activeTab === 'enrollments' ? 'active' : ''}`}
          onClick={() => setActiveTab('enrollments')}
        >
          <FileText size={15} />
          Enrollment List
        </button>

        <button
          className={`nav-tab ${activeTab === 'add-teacher' ? 'active' : ''}`}
          onClick={() => setActiveTab('add-teacher')}
        >
          <UserPlus size={15} />
          Add New Teacher
        </button>

        <button
          className={`nav-tab ${activeTab === 'answer-ref' ? 'active' : ''}`}
          onClick={() => setActiveTab('answer-ref')}
        >
          <BookOpen size={15} />
          Answer Reference
        </button>
      </div>

      {/* TAB 1: Student Allocation & Management */}
      {activeTab === 'students' && (
        <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          {/* Allocation Action Bar */}
          <div className="allocation-bar liquid-glass" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="allocation-controls">
              <label style={{ margin: 0, whiteSpace: 'nowrap',marginLeft: '7px' }}>Select Evaluator Teacher:</label>
              <select
                style={{ minWidth: '260px', background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                value={selectedTeacherEmail}
                onChange={(e) => setSelectedTeacherEmail(e.target.value)}
                className="form-control"
              >
                <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Choose Evaluator --</option>
                {teachers.map(t => (
                  <option key={t.email} value={t.email} style={{ background: '#111827', color: '#ffffff' }}>
                    {t.name} ({t.department || 'Academic'}{t.subject ? ` - ${t.subject}` : ''})
                  </option>
                ))}
              </select>

              <button className="btn btn-primary" onClick={handleAllocate} disabled={isAllocating}>
                <CheckCircle2 size={15} />
                Allocate Selected Students
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {selectedStudentIds.size} scripts selected
              </span>
              {selectedStudentIds.size > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStudentIds(new Set())}>
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* 4 Filter Buttons: All, Allocated, Evaluated, Not Allocated (as requested!) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div className="filter-btn-group">
              <button
                className={`filter-btn ${studentFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setStudentFilter('all'); setCurrentPage(1); }}
              >
                All Students ({students.length})
              </button>
              <button
                className={`filter-btn ${studentFilter === 'allocated' ? 'active' : ''}`}
                onClick={() => { setStudentFilter('allocated'); setCurrentPage(1); }}
              >
                Allocated Students ({allocatedStudents.length})
              </button>
              <button
                className={`filter-btn ${studentFilter === 'evaluated' ? 'active' : ''}`}
                onClick={() => { setStudentFilter('evaluated'); setCurrentPage(1); }}
              >
                Evaluated ({evaluatedStudents.length})
              </button>
              <button
                className={`filter-btn ${studentFilter === 'not_allocated' ? 'active' : ''}`}
                onClick={() => { setStudentFilter('not_allocated'); setCurrentPage(1); }}
              >
                Not Allocated to any Teacher ({notAllocatedStudents.length})
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Pagination: 100 students per page
            </div>
          </div>

          {/* Students Table */}
          <div className="table-responsive" style={{ width: '100%', maxWidth: '100%' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '44px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      disabled={unallocatedOnPage.length === 0}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      title="Select all unallocated scripts on this page"
                    />
                  </th>
                  <th>Enrollment No</th>
                  <th>Student Name</th>
                  <th>Department : Subject</th>
                  <th>Uploaded Date</th>
                  <th>Allocation Status</th>
                  <th>Evaluation Status</th>
                  <th>Assigned Teacher</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                      No student records present in this category.
                    </td>
                  </tr>
                ) : (
                  pageItems.map(s => {
                    const isSelected = selectedStudentIds.has(s.id);
                    const isChecked = s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
                    const isReval = !isChecked && (s.inRevaluation === true || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation');
                    // DISABLE ALLOCATION OPTION IF ALREADY ALLOCATED OR EVALUATED
                    const isAlreadyAllocated = isChecked || s.allocationStatus === 'allocated' || !!s.allocatedTeacherId || !!s.allocatedTeacher || !!s.allocatedTeacherName;

                    return (
                      <tr key={s.id} style={{ background: isSelected ? 'rgba(232, 224, 202, 0.45)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          {isAlreadyAllocated ? (
                            <input
                              type="checkbox"
                              disabled
                              title="Already allocated or evaluated"
                              style={{ cursor: 'not-allowed', opacity: 0.45 }}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleStudent(s.id, e.target.checked)}
                            />
                          )}
                        </td>
                        <td className="mono" style={{ fontWeight: 700 }}>{s.enrollmentNumber || s.enrollment}</td>
                        <td style={{ fontWeight: 600 }}>{s.name || s.studentName}</td>
                        <td>{formatDeptSubject(s, subjects)}</td>
                        <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(s.uploadedDate || Date.now()).toLocaleDateString('en-IN')}
                        </td>
                        <td>
                          <span className={`status-pill ${isAlreadyAllocated ? 'status-allocated' : 'status-unallocated'}`}>
                            {isAlreadyAllocated ? 'Allocated' : 'Unallocated'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${isChecked ? 'status-evaluated' : (isReval ? 'status-revaluation' : 'status-pending')}`}>
                            {isChecked ? `Evaluated (${s.evaluation?.totalMarksAwarded ?? s.totalScore ?? 0}/${s.evaluation?.maxPossibleMarks || 70})` : (isReval ? 'Revaluation' : 'Pending')}
                          </span>
                        </td>
                        <td>
                          {s.allocatedTeacherName || s.allocatedTeacher ? (
                            <span style={{ fontWeight: 600 }}>{s.allocatedTeacherName || s.allocatedTeacher}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleInspect(s)}>
                            <Eye size={13} />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 100-student Pagination Bar */}
          <div className="pagination-bar liquid-glass">
            <div className="pagination-info">
              Showing {filteredList.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + pageSize, filteredList.length)} of {filteredList.length} student scripts (Page {currentPage} of {totalPages})
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous 100
              </button>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '0 8px' }}>{currentPage}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next 100
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Teachers Performance */}
      {activeTab === 'teachers' && (
        <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>Examiner performance analytics</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Department : Subject</th>
                  <th>Login Email</th>
                  <th>Allocated</th>
                  <th>Evaluated</th>
                  <th>Completion Rate</th>
                  <th style={{ textAlign: 'center' }}>Detailed Performance</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => {
                  const teacherScripts = students.filter(s =>
                    s.allocatedTeacherEmail === t.email ||
                    s.allocatedTeacherId === t.email ||
                    s.allocatedTeacher === t.name ||
                    s.allocatedTeacherName === t.name
                  );
                  const checkedCount = teacherScripts.filter(s => s.evaluationStatus === 'checked' || s.status === 'Evaluated').length;
                  const rate = teacherScripts.length > 0 ? ((checkedCount / teacherScripts.length) * 100).toFixed(0) : 0;

                  return (
                    <tr key={t.email}>
                      <td style={{ fontWeight: 700 }}>{t.name}</td>
                      <td>{t.department ? (t.subject ? `${t.department} : ${t.subject}` : t.department) : (t.subject || '—')}</td>
                      <td className="mono" style={{ fontSize: '12px' }}>{t.email}</td>
                      <td style={{ fontWeight: 700 }}>{teacherScripts.length}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{checkedCount}</td>
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

      {/* TAB 3: Enrollment List */}
      {activeTab === 'enrollments' && (
        <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>Enrolled Candidate in University</h3>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Enrollment No</th>
                  <th>Candidate Name</th>
                  <th>Department : Subject</th>
                  <th>Uploaded Copy File</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 700 }}>{s.enrollmentNumber || s.enrollment}</td>
                    <td style={{ fontWeight: 600 }}>{s.name || s.studentName}</td>
                    <td>{formatDeptSubject(s, subjects)}</td>
                    <td>
                      <span className="cloudinary-status-tag">
                        {(s.copy_url || s.copyUrl || s.fileUrl)?.includes('cloudinary') ? 'Uploaded' : (s.fileName || 'Scanned Document')}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleInspect(s)}>
                        <Eye size={13} />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Add New Teacher */}
      {activeTab === 'add-teacher' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'start', width: '100%', maxWidth: '100%' }}>
          {/* Registration Form */}
          <div className="liquid-glass" style={{ padding: '18px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>Register New Evaluator</h3>
            <form onSubmit={handleAddTeacherSubmit}>
              <div className="form-group">
                <label>Teacher Full Name *</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                />
              </div>

              <div className="form-group">
                <label>Login Email Address *</label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  required
                  placeholder="e.g. rajesh.teacher@gmail.com"
                />
              </div>

              <div className="form-group">
                <label>Department *</label>
                <select
                  value={teacherDept}
                  onChange={(e) => {
                    setTeacherDept(e.target.value);
                    setTeacherSubject('');
                  }}
                  required
                  className="form-control"
                  style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                >
                  <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Select Academic Department --</option>
                  {departments.map((d) => (
                    <option key={d.code || d.name} value={d.name || d.code} style={{ background: '#111827', color: '#ffffff' }}>
                      {d.code ? `[${d.code}] ` : ''}{d.name}
                    </option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                    ⚠️ No departments registered. Add departments in University Dashboard first.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Assigned Subject *</label>
                <select
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubject(e.target.value)}
                  required
                  disabled={!teacherDept}
                  className="form-control"
                  style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                >
                  <option value="" style={{ background: '#111827', color: '#ffffff' }}>{teacherDept ? '-- Select Subject --' : '-- Choose Department First --'}</option>
                  {subjects.filter(s => {
                    if (!teacherDept) return false;
                    const deptObj = departments.find(d => d.name === teacherDept || d.code === teacherDept);
                    return s.department === teacherDept || (deptObj && (s.department === deptObj.name || s.department === deptObj.code));
                  }).map((s) => (
                    <option key={s.code || s._id || s.name} value={s.name || s.code} style={{ background: '#111827', color: '#ffffff' }}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </select>
                {teacherDept && subjects.filter(s => {
                  const deptObj = departments.find(d => d.name === teacherDept || d.code === teacherDept);
                  return s.department === teacherDept || (deptObj && (s.department === deptObj.name || s.department === deptObj.code));
                }).length === 0 && (
                  <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                    ⚠️ No subjects found under this department.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Login Password *</label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  required
                  placeholder="Create teacher password"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={isAddingTeacher}>
                <UserPlus size={15} />
                {isAddingTeacher ? 'Registering...' : 'Save Teacher'}
              </button>
            </form>
          </div>

          {/* Active Registry Table with Remove Teacher option */}
          <div className="liquid-glass" style={{ padding: '18px', borderRadius: '4px', minWidth: 0, width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>Active Evaluator Registry</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>Teachers currently able to log in and receive answer sheet allocations.</p>

            <div className="table-responsive" style={{ width: '100%', maxWidth: '100%' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Teacher Name</th>
                    <th>Department</th>
                    <th>Assigned Subject</th>
                    <th>Login Email</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                        No evaluators registered. Use the form on the left to add a teacher.
                      </td>
                    </tr>
                  ) : (
                    teachers.map(t => (
                      <tr key={t.email}>
                        <td style={{ fontWeight: 700 }}>{t.name}</td>
                        <td>{t.department}</td>
                        <td><span className="badge badge-neutral">{t.subject || 'All Subjects'}</span></td>
                        <td className="mono" style={{ fontSize: '12px' }}>{t.email}</td>
                        <td>
                          <span className="status-pill status-checked">Active</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ color: '#FC6C26', borderColor: '#FC6C26' }}
                            onClick={() => handleRemoveTeacher(t)}
                            title={`Remove evaluator ${t.name} from registry`}
                          >
                            <Trash2 size={13} /> Remove Teacher
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Answer Reference */}
      {activeTab === 'answer-ref' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'start', width: '100%', maxWidth: '100%' }}>
          {/* Add Answer Reference Form */}
          <div className="liquid-glass" style={{ padding: '18px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>Add Answer Reference</h3>
            <form onSubmit={handlePublishReference}>
              <div className="form-group">
                <label>Academic Department *</label>
                <select
                  value={refDepartment}
                  onChange={(e) => {
                    setRefDepartment(e.target.value);
                    setRefSubjectCode('');
                  }}
                  required
                  className="form-control"
                  style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                >
                  <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Select Academic Department --</option>
                  {departments.map((d) => (
                    <option key={d.code || d.name} value={d.name || d.code} style={{ background: '#111827', color: '#ffffff' }}>
                      {d.code ? `[${d.code}] ` : ''}{d.name}
                    </option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                    ⚠️ No departments registered. Add departments in University Dashboard first.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Subject Code *</label>
                <select
                  value={refSubjectCode}
                  onChange={(e) => setRefSubjectCode(e.target.value)}
                  required
                  disabled={!refDepartment}
                  className="form-control"
                  style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                >
                  <option value="" style={{ background: '#111827', color: '#ffffff' }}>{refDepartment ? '-- Select Subject Code --' : '-- Choose Department First --'}</option>
                  {subjects.filter(s => {
                    if (!refDepartment) return false;
                    const deptObj = departments.find(d => d.name === refDepartment || d.code === refDepartment);
                    return s.department === refDepartment || (deptObj && (s.department === deptObj.name || s.department === deptObj.code));
                  }).map((s) => (
                    <option key={s.code || s._id} value={s.code} style={{ background: '#111827', color: '#ffffff' }}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </select>
                {refDepartment && subjects.filter(s => {
                  const deptObj = departments.find(d => d.name === refDepartment || d.code === refDepartment);
                  return s.department === refDepartment || (deptObj && (s.department === deptObj.name || s.department === deptObj.code));
                }).length === 0 && (
                  <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                    ⚠️ No subjects found under this department.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Exam Session</label>
                <input
                  type="text"
                  value={refExamSession}
                  onChange={(e) => setRefExamSession(e.target.value)}
                  required
                />
              </div>

              {/* MANDATORY FILE SELECTION CHECK */}
              <div className="form-group">
                <label>Select Answer Reference Document (PDF) *</label>
                <input
                  type="file"
                  accept=".pdf"
                  required
                  onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {refFile ? `Selected: ${refFile.name} (${(refFile.size / (1024 * 1024)).toFixed(2)} MB)` : 'Upload approved official marking scheme PDF.'}
                </span>
              </div>

              <div className="form-group">
                <label>Evaluation Rubric Notes</label>
                <textarea
                  rows="3"
                  value={refDescription}
                  onChange={(e) => setRefDescription(e.target.value)}
                  placeholder="Enter key grading rubric points..."
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={isPublishingRef}>
                <Upload size={14} />
                {isPublishingRef ? 'Uploading to Cloudinary...' : 'Publish Answer Reference PDF'}
              </button>
            </form>
          </div>

          {/* Official References Table with "View Reference Document" Button */}
          <div className="liquid-glass" style={{ padding: '18px', borderRadius: '4px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>Official Answer References</h3>

            <div className="table-responsive" style={{ width: '100%', maxWidth: '100%' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Department</th>
                    <th>Session</th>
                    <th>Reference Document</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {references.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                        No answer references published yet. Use the form on the left to upload reference documents.
                      </td>
                    </tr>
                  ) : (
                    references.map(r => (
                      <tr key={r.id || r.subjectCode}>
                        <td className="mono" style={{ fontWeight: 700 }}>{r.subjectCode}</td>
                        <td>{r.department || 'General'}</td>
                        <td>{r.examSession}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span className="cloudinary-status-tag" style={{ background: 'var(--surface-glass-accent)', borderColor: 'var(--border-strong)', color: 'var(--text-main)' }}>
                            {r.fileName || `${r.subjectCode}_Model_Solution.pdf`}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleViewRef(r)}
                            title={`Open official answer reference uploaded for ${r.subjectCode}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileText size={13} />
                            View Reference Document
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Teacher Performance Modal Popup (Window) */}
      {selectedTeacherForPerf && (() => {
        const t = selectedTeacherForPerf;
        const teacherScripts = students.filter(s =>
          s.allocatedTeacherEmail === t.email ||
          s.allocatedTeacherId === t.email ||
          s.allocatedTeacher === t.name ||
          s.allocatedTeacherName === t.name
        );
        const checkedScripts = teacherScripts.filter(s => s.evaluationStatus === 'checked' || s.status === 'Evaluated');
        const pendingScripts = teacherScripts.filter(s => !checkedScripts.includes(s));
        const flaggedScripts = teacherScripts.filter(s => s.inRevaluation || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation');
        const rate = teacherScripts.length > 0 ? ((checkedScripts.length / teacherScripts.length) * 100).toFixed(0) : 0;

        // Calculate average score awarded
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
              className="modal-dialog admin-liquid-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '780px',
                width: '92vw',
                maxHeight: '88vh',
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)'
              }}
            >
              {/* Modal Header */}
              <div className="admin-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1.5px solid var(--border-subtle)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-orange), #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
                    <BarChart2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {t.name} — Detailed Performance
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                      {t.email} • {t.department}{t.subject ? ` : ${t.subject}` : ''}
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
              <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                {/* 4 Performance Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div className="admin-nested-stat-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Allocated</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{teacherScripts.length}</div>
                  </div>
                  <div className="admin-nested-stat-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evaluated</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-green)', marginTop: '4px' }}>{checkedScripts.length}</div>
                  </div>
                  <div className="admin-nested-stat-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-orange)', marginTop: '4px' }}>{pendingScripts.length}</div>
                  </div>
                  <div className="admin-nested-stat-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completion</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>{rate}%</div>
                  </div>
                </div>

                {/* Additional KPI Highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <div className="admin-nested-kpi-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Average Marks Awarded:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-orange)' }}>{avgScore !== 'N/A' ? `${avgScore} / 70` : 'No scores yet'}</span>
                  </div>
                  <div className="admin-nested-kpi-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Revaluations Flagged:</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-red)' }}>{flaggedScripts.length} scripts</span>
                  </div>
                </div>

                {/* Allocated Scripts Breakdown Table */}
                <h4 style={{ fontSize: '12.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Workload Breakdown ({teacherScripts.length} scripts)
                </h4>
                {teacherScripts.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                    No student answer scripts are currently allocated to this teacher.
                  </p>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box', margin: 0 }}>
                    <table className="table" style={{ fontSize: '11px', width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Enrollment</th>
                          <th>Student Name</th>
                          <th>Department : Subject</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th style={{ textAlign: 'center' }}>Script</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacherScripts.map(s => {
                          const isDone = s.evaluationStatus === 'checked' || s.status === 'Evaluated';
                          const score = s.totalScore !== undefined ? s.totalScore : (s.evaluation?.totalMarksAwarded || s.evaluation?.totalScore || '-');
                          return (
                            <tr key={s.id || s.enrollment}>
                              <td className="mono" style={{ fontWeight: 600 }}>{s.enrollmentNumber || s.enrollment}</td>
                              <td>{s.name || s.studentName}</td>
                              <td>{formatDeptSubject(s, subjects)}</td>
                              <td>
                                <span className={`status-pill ${isDone ? 'status-evaluated' : 'status-pending'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                  {isDone ? 'Checked' : 'Pending'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700 }}>{isDone ? score : '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                                  onClick={() => handleInspect(s)}
                                >
                                  <Eye size={11} /> Inspect
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
              <div className="admin-modal-footer" style={{ padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', borderTop: '1.5px solid var(--border-subtle)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
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
