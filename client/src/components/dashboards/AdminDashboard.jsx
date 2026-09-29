import React, { useState } from 'react';
import { 
  Users, UserCheck, BookOpen, UserPlus, FileText, CheckCircle2, 
  Eye, Upload, AlertCircle, RefreshCw, Trash2, BarChart2, X, Clock, Award 
} from 'lucide-react';
import { allocateStudents, addTeacher, deleteTeacher, addReference, uploadFileToCloudinary } from '../../api';

export default function AdminDashboard({
  students = [],
  teachers = [],
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

  // Helper to accurately resolve page count of answer script or reference document
  const getPageCount = (item) => {
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
      onViewDocument(url, `Official Answer Reference: ${r.subjectCode} - ${r.subjectTitle || ''}`, docData);
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
        onNotify(`Evaluator "${teacher.name}" removed successfully from MongoDB registry.`, 'success');
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
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);

  // Add Answer Reference Form State
  const [refSubjectCode, setRefSubjectCode] = useState('');
  const [refSubjectTitle, setRefSubjectTitle] = useState('');
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
    setIsAddingTeacher(true);
    try {
      await addTeacher({
        name: teacherName.trim(),
        email: teacherEmail.trim(),
        department: teacherDept.trim(),
        password: teacherPassword
      });
      if (onNotify) {
        onNotify(`New evaluator ${teacherName} added and saved to MongoDB.`, 'success');
      }
      setTeacherName('');
      setTeacherEmail('');
      setTeacherDept('');
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
    // MANDATORY FILE SELECTION CHECK (as requested!)
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

      // 3. Save into MongoDB answer_references collection
      await addReference({
        subjectCode: refSubjectCode.trim().toUpperCase(),
        subjectTitle: refSubjectTitle.trim(),
        examSession: refExamSession.trim(),
        fileName: refFile.name,
        fileSize: (refFile.size / (1024 * 1024)).toFixed(1) + ' MB',
        description: refDescription.trim(),
        fileUrl: copyUrl,
        copy_url: copyUrl,
        cloudinaryPublicId: uploadRes.publicId || null
      });

      if (onNotify) {
        onNotify(`Official Answer Reference for ${refSubjectCode} uploaded to Cloudinary & saved to MongoDB.`, 'success');
      }
      setRefSubjectCode('');
      setRefSubjectTitle('');
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
        <div>
          {/* Allocation Action Bar */}
          <div className="allocation-bar liquid-glass">
            <div className="allocation-controls">
              <label style={{ margin: 0, whiteSpace: 'nowrap' }}>Select Evaluator Teacher:</label>
              <select 
                style={{ minWidth: '260px' }}
                value={selectedTeacherEmail}
                onChange={(e) => setSelectedTeacherEmail(e.target.value)}
              >
                <option value="">-- Choose Evaluator --</option>
                {teachers.map(t => (
                  <option key={t.email} value={t.email}>
                    {t.name} ({t.department})
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
          <div className="table-responsive">
            <table>
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
                  <th>Subject</th>
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
                        <td><span style={{ fontWeight: 600 }}>{s.subjectCode || s.subject}</span>: {s.subjectTitle || s.subject}</td>
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
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Teachers Evaluation Performance Metrics</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Live evaluation statistics calculated from MongoDB Atlas.</p>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Teacher Name</th>
                  <th>Department</th>
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
                      <td>{t.department}</td>
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
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>University Candidate Enrollment Register</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Complete roster of candidates enrolled across examination subjects.</p>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Enrollment No</th>
                  <th>Candidate Name</th>
                  <th>Subject</th>
                  <th>Uploaded Copy File</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 700 }}>{s.enrollmentNumber || s.enrollment}</td>
                    <td style={{ fontWeight: 600 }}>{s.name || s.studentName}</td>
                    <td>{s.subjectCode || s.subject}: {s.subjectTitle || s.subject}</td>
                    <td>
                      <span className="cloudinary-status-tag">
                        {(s.copy_url || s.copyUrl || s.fileUrl)?.includes('cloudinary') ? 'Cloudinary CDN Script' : (s.fileName || 'Scanned Document')}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleInspect(s)}>
                        <Eye size={13} />
                        View Script ({getPageCount(s)} {getPageCount(s) === 1 ? 'Page' : 'Pages'})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Add New Teacher (PASSWORD REMOVED FROM TABLE UI as requested!) */}
      {activeTab === 'add-teacher' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px', alignItems: 'start' }}>
          {/* Registration Form */}
          <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Register New Evaluator</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Create official credentials and save directly to MongoDB teachers schema.</p>

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
                <label>Department / Faculty *</label>
                <input 
                  type="text" 
                  value={teacherDept} 
                  onChange={(e) => setTeacherDept(e.target.value)} 
                  required 
                  placeholder="e.g. Computer Science & Engineering" 
                />
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
                {isAddingTeacher ? 'Registering...' : 'Save Teacher to Database'}
              </button>
            </form>
          </div>

          {/* Active Registry Table with Remove Teacher option */}
          <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Active Evaluator Registry</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Teachers currently able to log in and receive answer sheet allocations.</p>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Teacher Name</th>
                    <th>Department</th>
                    <th>Login Email</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                        No evaluators registered. Use the form on the left to add a teacher.
                      </td>
                    </tr>
                  ) : (
                    teachers.map(t => (
                      <tr key={t.email}>
                        <td style={{ fontWeight: 700 }}>{t.name}</td>
                        <td>{t.department}</td>
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

      {/* TAB 5: Answer Reference (Cloudinary Upload, View Reference Document, Candidate Registry Removed as requested!) */}
      {activeTab === 'answer-ref' && (
        <div style={{ display: 'grid', gridTemplateColumns: '410px 1fr', gap: '28px', alignItems: 'start' }}>
          {/* Add Answer Reference Form */}
          <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Add Answer Reference</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Publish official model solutions and marking schemes into Cloudinary & MongoDB.
            </p>

            <form onSubmit={handlePublishReference}>
              <div className="form-group">
                <label>Subject Code *</label>
                <input 
                  type="text" 
                  value={refSubjectCode} 
                  onChange={(e) => setRefSubjectCode(e.target.value)} 
                  required 
                  placeholder="e.g. CS-401" 
                />
              </div>

              <div className="form-group">
                <label>Subject Title *</label>
                <input 
                  type="text" 
                  value={refSubjectTitle} 
                  onChange={(e) => setRefSubjectTitle(e.target.value)} 
                  required 
                  placeholder="e.g. Design and Analysis of Algorithms" 
                />
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

              {/* MANDATORY FILE SELECTION CHECK (required attribute + state check!) */}
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
          <div className="liquid-glass" style={{ padding: '24px', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Official Answer References & Subject Documents</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Inspect the official model solution document uploaded for respective subject code, title, and exam session.
            </p>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Title</th>
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
                        <td>{r.subjectTitle}</td>
                        <td>{r.examSession}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span className="cloudinary-status-tag" style={{ background: 'rgba(252, 108, 38, 0.15)', borderColor: '#FC6C26', color: '#064E3B' }}>
                            {r.fileName || `${r.subjectCode}_Model_Solution.pdf`}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {/* "View Reference Document" button (as requested!) */}
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handleViewRef(r)}
                            title={`Open official answer reference uploaded for ${r.subjectCode}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileText size={13} />
                            View Reference Document ({getPageCount(r)} {getPageCount(r) === 1 ? 'Page' : 'Pages'})
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Note: "Direct Candidate Scanned Copies Registry" removed from here as requested! */}
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
                          const isDone = s.evaluationStatus === 'checked' || s.status === 'Evaluated';
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
