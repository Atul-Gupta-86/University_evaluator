import React, { useState, useEffect } from 'react';
import './UniversityDashboard.css';
import {
  UploadCloud,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  ExternalLink,
  Building2,
  FolderTree,
  ShieldCheck,
  Mail,
  Lock,
  UserPlus
} from 'lucide-react';
import {
  uploadFileToCloudinary,
  createStudent,
  addSubject,
  deleteSubject,
  addDepartment,
  deleteDepartment,
  getUsers,
  addUser,
  deleteUser,
  formatDeptSubject
} from '../../api';

export default function UniversityDashboard({
  currentUser,
  students,
  subjects,
  departments = [],
  onRefresh,
  onViewDocument,
  onNotify
}) {
  const [activeTab, setActiveTab] = useState('intake'); // 'intake' | 'administrators' | 'departments' | 'subjects'

  // Administrators management state
  const [administrators, setAdministrators] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminDept, setAdminDept] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Fetch Administrators for this university
  const loadAdministrators = async () => {
    try {
      setIsLoadingAdmins(true);
      const list = await getUsers('administrator');
      setAdministrators(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error fetching administrators:', err);
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdministrators();
  }, []);

  const handleAddAdministrator = async (e) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanPass = adminPassword.trim();

    if (!cleanEmail || !cleanPass) {
      onNotify('Administrator Email and Password are mandatory fields.', 'warning');
      return;
    }

    try {
      setIsAddingAdmin(true);
      await addUser({
        email: cleanEmail,
        password: cleanPass,
        name: adminName.trim(),
        role: 'administrator',
        department: adminDept.trim()
      });

      onNotify(`Administrator account "${cleanEmail}" provisioned successfully in MongoDB users.`, 'success');
      setAdminEmail('');
      setAdminPassword('');
      setAdminName('');
      setAdminDept('');
      await loadAdministrators();
      if (onRefresh) onRefresh();
    } catch (err) {
      onNotify(`Failed to create administrator: ${err.message}`, 'error');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdministrator = async (targetEmail) => {
    if (!window.confirm(`Are you sure you want to revoke access for administrator "${targetEmail}"?`)) {
      return;
    }

    try {
      await deleteUser(targetEmail);
      onNotify(`Administrator "${targetEmail}" deleted from university users.`, 'success');
      await loadAdministrators();
      if (onRefresh) onRefresh();
    } catch (err) {
      onNotify(`Failed to delete administrator: ${err.message}`, 'error');
    }
  };

  // Intake form state
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [examSession, setExamSession] = useState('December');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Department management state
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

  // Subject management state
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDept, setNewSubDept] = useState('');
  const [isAddingSub, setIsAddingSub] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();

    // Critical validation: Check that university cannot submit without selecting a file
    if (!selectedFile) {
      onNotify('Validation Error: You must select and attach a scanned student answer script file (.pdf, .jpg, .png).', 'error');
      return;
    }

    if (!selectedDept) {
      onNotify('Validation Error: Academic Department is mandatory. Please select a department.', 'warning');
      return;
    }

    if (!enrollmentNumber.trim() || !studentName.trim() || !selectedSubject) {
      onNotify('Please fill in all mandatory fields (Enrollment No, Name, Department, and Subject).', 'warning');
      return;
    }

    if (!academicYear.trim() || !examSession.trim()) {
      onNotify('Academic Year and Exam Session are mandatory fields.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadProgress('Uploading encrypted script directly to Cloudinary CDN...');

      const uploadRes = await uploadFileToCloudinary(
        selectedFile,
        selectedFile.name,
        enrollmentNumber.trim(),
        selectedSubject
      );

      const copyUrl = uploadRes.copy_url || uploadRes.fileUrl || uploadRes.secure_url || uploadRes.url;
      if (!copyUrl) {
        throw new Error('Cloudinary upload completed but no deliverable file URL was returned.');
      }

      const isImg = selectedFile?.type?.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(selectedFile.name);
      const computedPages = isImg ? 1 : (Number(uploadRes.totalPages) || (uploadRes.pages ? uploadRes.pages.length : 1));

      setUploadProgress('Archiving candidate record...');
      await createStudent({
        enrollmentNumber: enrollmentNumber.trim(),
        name: studentName.trim(),
        department: selectedDept,
        subject: selectedSubject,
        academicYear,
        examSession,
        copyUrl: copyUrl,
        totalPages: computedPages,
        fileName: selectedFile.name,
        fileSize: (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB'
      });

      onNotify(`Answer script for ${studentName} (${enrollmentNumber}) uploaded and archived successfully!`, 'success');

      // Reset form
      setEnrollmentNumber('');
      setStudentName('');
      setSelectedDept('');
      setSelectedSubject('');
      setSelectedFile(null);
      const fileInput = document.getElementById('scanned-copy-input');
      if (fileInput) fileInput.value = '';

      onRefresh();
    } catch (err) {
      onNotify(`Submission failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  // Add Department
  const handleAddDeptSubmit = async (e) => {
    e.preventDefault();
    if (!deptCode.trim()) {
      onNotify('Department Code is mandatory.', 'warning');
      return;
    }
    if (!deptName.trim()) {
      onNotify('Department Name is mandatory.', 'warning');
      return;
    }

    try {
      setIsAddingDept(true);
      await addDepartment({
        code: deptCode.trim().toUpperCase(),
        name: deptName.trim(),
        status: 'Active'
      });
      onNotify(`Academic department "${deptName}" created successfully.`, 'success');
      setDeptCode('');
      setDeptName('');
      onRefresh();
    } catch (err) {
      onNotify(`Failed to create department: ${err.message}`, 'error');
    } finally {
      setIsAddingDept(false);
    }
  };

  // Delete Department
  const handleDeleteDept = async (dept) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove department "${dept.name}" (${dept.code})?`);
    if (!confirmDelete) return;

    try {
      await deleteDepartment(dept.code || dept.name || dept.id);
      onNotify(`Department "${dept.name}" removed successfully.`, 'success');
      onRefresh();
    } catch (err) {
      onNotify(`Failed to remove department: ${err.message}`, 'error');
    }
  };

  // Add Subject - Department selection is strictly mandatory
  const handleAddSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!newSubCode.trim() || !newSubName.trim()) {
      onNotify('Please enter both subject code and course title.', 'warning');
      return;
    }

    if (!newSubDept || !newSubDept.trim()) {
      onNotify('Please select an Academic Department. Department selection is mandatory before submitting.', 'warning');
      return;
    }

    try {
      setIsAddingSub(true);
      await addSubject({
        code: newSubCode.trim().toUpperCase(),
        name: newSubName.trim(),
        department: newSubDept.trim()
      });
      onNotify(`Subject ${newSubName} (${newSubCode}) added successfully to department "${newSubDept}".`, 'success');
      setNewSubCode('');
      setNewSubName('');
      setNewSubDept('');
      onRefresh();
    } catch (err) {
      onNotify(`Failed to add subject: ${err.message}`, 'error');
    } finally {
      setIsAddingSub(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (sub) => {
    const confirmDelete = window.confirm(`Are you sure you want to remove subject "${sub.name}" (${sub.code})?`);
    if (!confirmDelete) return;

    try {
      await deleteSubject(sub._id || sub.code);
      onNotify(`Subject ${sub.name} removed successfully.`, 'success');
      onRefresh();
    } catch (err) {
      onNotify(`Failed to delete subject: ${err.message}`, 'error');
    }
  };

  // Filtered intake registry list
  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.enrollmentNumber || '').toLowerCase().includes(q) ||
      (s.subject || '').toLowerCase().includes(q)
    );
  });

  // Helper to accurately resolve page count of answer script
  const getPageCount = (st) => {
    if (st?.totalPages && Number(st.totalPages) > 0) return Number(st.totalPages);
    if (st?.pages && Array.isArray(st.pages) && st.pages.length > 0) return st.pages.length;
    const url = (st?.copyUrl || st?.copy_url || st?.fileUrl || '').toLowerCase();
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp')) return 1;
    return 1;
  };

  return (
    <div className="tab-pane active university-dashboard-view">
      {/* Sub Tabs Navigation */}
      <div className="section-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '18px' }}>
        {/* <div>
          <h2>University Board Examination Portal</h2>
          <p>Answer script digitization pipeline, academic departments & syllabus catalog administration</p>
        </div> */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'intake' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('intake')}
          >
            <UploadCloud size={16} /> Script Intake & Registry ({students.length})
          </button>
          <button
            className={`btn ${activeTab === 'administrators' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('administrators')}
          >
            <ShieldCheck size={16} /> Add Administrator ({administrators.length})
          </button>
          <button
            className={`btn ${activeTab === 'departments' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('departments')}
          >
            <Building2 size={16} /> Academic Departments ({departments.length})
          </button>
          <button
            className={`btn ${activeTab === 'subjects' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('subjects')}
          >
            <BookOpen size={16} /> Subject Curriculum ({subjects.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SCRIPT INTAKE & REGISTRY */}
      {activeTab === 'intake' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '28px' }}>
          {/* Intake Upload Form */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UploadCloud size={20} color="#FC6C26" /> Scanned Script Ingestion
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleIntakeSubmit}>
                <div className="form-group">
                  <label>Enrollment / Roll Number <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 0101CS221045"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Student Full Name <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Anjali Sharma"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Academic Department <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                  <select
                    className="form-control"
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setSelectedSubject('');
                    }}
                    required
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
                      ⚠️ No departments registered. Add departments in Departments tab first.
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Examination Subject <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                  <select
                    className="form-control"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    required
                    disabled={!selectedDept}
                    style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                  >
                    <option value="" style={{ background: '#111827', color: '#ffffff' }}>{selectedDept ? '-- Select Subject from Curriculum --' : '-- Choose Department First --'}</option>
                    {subjects.filter(sub => {
                      if (!selectedDept) return false;
                      const deptObj = departments.find(d => d.name === selectedDept || d.code === selectedDept);
                      return sub.department === selectedDept || (deptObj && (sub.department === deptObj.name || sub.department === deptObj.code));
                    }).map((sub) => (
                      <option key={sub.code || sub._id} value={sub.name} style={{ background: '#111827', color: '#ffffff' }}>
                        {sub.code ? `[${sub.code}] ` : ''}{sub.name}
                      </option>
                    ))}
                  </select>
                  {selectedDept && subjects.filter(sub => {
                    const deptObj = departments.find(d => d.name === selectedDept || d.code === selectedDept);
                    return sub.department === selectedDept || (deptObj && (sub.department === deptObj.name || sub.department === deptObj.code));
                  }).length === 0 && (
                      <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                        ⚠️ No subjects found under this department. Please register subjects in Curriculum tab first.
                      </small>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Academic Year <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                    <select
                      className="form-control"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      required
                      style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                    >
                      <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Select Academic Year --</option>
                      <option value="2026-2027" style={{ background: '#111827', color: '#ffffff' }}>2026-2027</option>
                      <option value="2025-2026" style={{ background: '#111827', color: '#ffffff' }}>2025-2026</option>
                      <option value="2024-2025" style={{ background: '#111827', color: '#ffffff' }}>2024-2025</option>
                      <option value="2023-2024" style={{ background: '#111827', color: '#ffffff' }}>2023-2024</option>
                      <option value="2022-2023" style={{ background: '#111827', color: '#ffffff' }}>2022-2023</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Exam Session <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                    <select
                      className="form-control"
                      value={examSession}
                      onChange={(e) => setExamSession(e.target.value)}
                      required
                      style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                    >
                      <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Select Session Month --</option>
                      <option value="January" style={{ background: '#111827', color: '#ffffff' }}>January</option>
                      <option value="February" style={{ background: '#111827', color: '#ffffff' }}>February</option>
                      <option value="March" style={{ background: '#111827', color: '#ffffff' }}>March</option>
                      <option value="April" style={{ background: '#111827', color: '#ffffff' }}>April</option>
                      <option value="May" style={{ background: '#111827', color: '#ffffff' }}>May</option>
                      <option value="June" style={{ background: '#111827', color: '#ffffff' }}>June</option>
                      <option value="July" style={{ background: '#111827', color: '#ffffff' }}>July</option>
                      <option value="August" style={{ background: '#111827', color: '#ffffff' }}>August</option>
                      <option value="September" style={{ background: '#111827', color: '#ffffff' }}>September</option>
                      <option value="October" style={{ background: '#111827', color: '#ffffff' }}>October</option>
                      <option value="November" style={{ background: '#111827', color: '#ffffff' }}>November</option>
                      <option value="December" style={{ background: '#111827', color: '#ffffff' }}>December</option>
                    </select>
                  </div>
                </div>

                {/* File Upload with Mandatory Check */}
                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Scanned Answer Sheet <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></span>
                    {selectedFile && <span style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 'bold' }}>✓ Selected</span>}
                  </label>
                  <input
                    id="scanned-copy-input"
                    type="file"
                    className="form-control"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Accepted formats: High-res PDF, PNG, JPG scans (Up to 25MB)
                  </div>
                </div>

                {uploadProgress && (
                  <div style={{ padding: '12px 16px', background: 'var(--surface-glass-accent)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '12px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshCw size={14} className="spin-slow" /> {uploadProgress}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>Uploading to Cloudinary...</>
                  ) : (
                    <><UploadCloud size={18} /> Ingest & Archive Answer Script</>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Uploaded Scripts Registry */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#FC6C26" /> Ingested Scripts Repository
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {filteredStudents.length} copies logged for current examination cycle
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#FC6C26' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search roll, name, subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '32px', width: '220px', height: '36px', fontSize: '12px' }}
                  />
                </div>
                <button className="btn btn-outline btn-sm" onClick={onRefresh} title="Refresh records">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Candidate Name</th>
                      <th>Department : Subject</th>
                      <th>Status</th>
                      <th>Digital Script</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                          No answer copies match the criteria or repository is empty.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st) => {
                        const fileUrl = st.copyUrl || st.copy_url || st.fileUrl;
                        return (
                          <tr key={st._id || st.id}>
                            <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{st.enrollmentNumber}</td>
                            <td>{st.name}</td>
                            <td>
                              <span className="badge badge-neutral">{formatDeptSubject(st, subjects)}</span>
                            </td>
                            <td>
                              {st.status === 'Evaluated' ? (
                                <span className="status-pill status-evaluated"><CheckCircle2 size={12} /> Evaluated</span>
                              ) : st.allocatedTeacher ? (
                                <span className="status-pill status-allocated">Allocated</span>
                              ) : (
                                <span className="status-pill status-unallocated">Unallocated</span>
                              )}
                            </td>
                            <td>
                              {fileUrl ? (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => onViewDocument(fileUrl, `Candidate Copy: ${st.name} (${st.enrollmentNumber})`, { ...st, totalPages: getPageCount(st) })}
                                  title="Inspect Digital Scan"
                                  style={{ color: 'var(--text-main)', borderColor: 'var(--border-strong)' }}
                                >
                                  <Eye size={12} /> Inspect
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.6 }}>No File Attached</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ADD ADMINISTRATOR (Directly beside Script Intake) */}
      {activeTab === 'administrators' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)', gap: '24px' }}>
          {/* Add Administrator Form Card */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="#FC6C26" /> Add University Administrator
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddAdministrator}>
                <div className="form-group">
                  <label>Administrator Email <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. administrator@university.ac.in"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                  />
                  <small style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Used for logging into this university's Administrator portal.
                  </small>
                </div>

                <div className="form-group">
                  <label>Password <span style={{ color: '#FC6C26' }}>* (Mandatory)</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Enter secure access password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      tabIndex="-1"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex'
                      }}
                    >
                      {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Administrator Full Name (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dr. R.K. Sharma"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Office / Designation</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Apex Examination Authority"
                    value={adminDept}
                    onChange={(e) => setAdminDept(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
                  disabled={isAddingAdmin}
                >
                  {isAddingAdmin ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Saving in MongoDB users...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Provision Administrator</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Administrators Directory Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="#10b981" /> Provisioned Administrators ({administrators.length})
                </h3>
                {/* <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Institutional accounts stored in this university's database <code>users</code> folder.
                </p> */}
              </div>

              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search administrator..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  style={{ height: '32px', fontSize: '11.5px', paddingLeft: '30px' }}
                />
              </div>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Administrator</th>
                      <th>Email / Login</th>
                      <th>Role & Scope</th>
                      <th>Created At</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {administrators.filter(a => {
                      const q = adminSearchQuery.toLowerCase();
                      return (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          No institutional administrators registered yet. Use the form on the left to add one.
                        </td>
                      </tr>
                    ) : (
                      administrators.filter(a => {
                        const q = adminSearchQuery.toLowerCase();
                        return (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
                      }).map((adm) => (
                        <tr key={adm.email}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{adm.name || adm.email}</div>
                            {adm.department && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{adm.department}</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Mail size={13} color="#FC6C26" />
                              <strong style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{adm.email}</strong>
                            </div>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background: 'rgba(124, 58, 237, 0.15)',
                              color: '#a78bfa',
                              border: '1px solid rgba(124, 58, 237, 0.3)'
                            }}>
                              <ShieldCheck size={11} /> ADMINISTRATOR
                            </span>
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : 'Active'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => handleDeleteAdministrator(adm.email)}
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              title="Delete Administrator"
                            >
                              <Trash2 size={13} />
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
        </div>
      )}

      {/* TAB 2: ACADEMIC DEPARTMENTS MANAGEMENT */}
      {activeTab === 'departments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr)', gap: '16px' }}>
          {/* Add Department Form */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="#FC6C26" /> Add Academic Department
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddDeptSubmit}>
                <div className="form-group">
                  <label>Department Code <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CSE, ECE, ME"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Department Name <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Computer Science & Engineering"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
                  disabled={isAddingDept}
                >
                  <Plus size={18} /> Register Department
                </button>
              </form>
            </div>
          </div>

          {/* Departments Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={20} color="#FC6C26" /> Recognized Academic Departments
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {departments.length} recognized academic departments registered
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={onRefresh}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Department Code</th>
                      <th>Department Name</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                          No departments defined. Add your first department using the form on the left.
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept) => (
                        <tr key={dept.code || dept.id || dept.name}>
                          <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                            <span style={{ padding: '3px 8px', background: 'rgba(252, 108, 38, 0.15)', borderRadius: '4px', border: '1px solid var(--border-strong)', color: 'var(--text-main)' }}>
                              {dept.code || 'N/A'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{dept.name}</div>
                          </td>
                          <td>
                            <span className="badge badge-success" style={{ fontSize: '11px' }}>
                              {dept.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: '#FC6C26', borderColor: '#FC6C26' }}
                              onClick={() => handleDeleteDept(dept)}
                              title="Delete Department"
                            >
                              <Trash2 size={14} /> Remove
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
        </div>
      )}

      {/* TAB 3: SUBJECT MANAGEMENT */}
      {activeTab === 'subjects' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(0, 1fr)', gap: '16px' }}>
          {/* Add Subject Form */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="#FC6C26" /> Add Curriculum Course
              </h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddSubjectSubmit}>
                <div className="form-group">
                  <label>Subject / Course Code <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. CS601, ME302"
                    value={newSubCode}
                    onChange={(e) => setNewSubCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Course Title <span style={{ color: '#FC6C26' }}>*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Compiler Design & Automata"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Academic Department <span style={{ color: '#FC6C26' }}>*</span></label>
                  <select
                    className="form-control"
                    value={newSubDept}
                    onChange={(e) => setNewSubDept(e.target.value)}
                    required
                    style={{ background: 'var(--bg-card, #111827)', color: 'var(--text-main, #ffffff)' }}
                  >
                    <option value="" style={{ background: '#111827', color: '#ffffff' }}>-- Select Academic Department (Required) --</option>
                    {departments.map((d) => (
                      <option key={d.code || d.name} value={d.name} style={{ background: '#111827', color: '#ffffff' }}>
                        {d.code ? `[${d.code}] ` : ''}{d.name}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <small style={{ color: '#FC6C26', display: 'block', marginTop: '4px' }}>
                      ⚠️ No departments found. Please register an Academic Department first before creating subjects.
                    </small>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
                  disabled={isAddingSub}
                >
                  <Plus size={18} /> Register Subject Code
                </button>
              </form>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Authorized Examination Curriculum</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Active subjects eligible for answer script digitization and allocation</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={onRefresh}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject Code</th>
                      <th>Course Title</th>
                      <th>Department</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                          No subjects defined. Add your first subject using the form on the left.
                        </td>
                      </tr>
                    ) : (
                      subjects.map((sub) => (
                        <tr key={sub.code || sub._id}>
                          <td style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                            {sub.code || 'N/A'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{sub.name}</td>
                          <td>
                            <span className="badge badge-neutral">{sub.department || 'General'}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: '#FC6C26', borderColor: '#FC6C26' }}
                              onClick={() => handleDeleteSubject(sub)}
                              title="Delete Subject"
                            >
                              <Trash2 size={14} /> Remove
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
        </div>
      )}
    </div>
  );
}
