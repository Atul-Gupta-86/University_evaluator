/**
 * Centralized API Client for MPOnline Evaluation Portal
 * Connects to Node.js backend endpoints
 */

const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  let currentUnivId = options.universityId || '';
  if (!currentUnivId) {
    try {
      currentUnivId = localStorage.getItem('mponline_university_id') || '';
      if (!currentUnivId) {
        const u = localStorage.getItem('mponline_user');
        if (u) {
          const parsed = JSON.parse(u);
          currentUnivId = parsed.universityId || '';
        }
      }
    } catch (_) {}
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(currentUnivId ? { 'X-University-Id': currentUnivId } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok && !data.success) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err.message);
    throw err;
  }
}

// ---------------- Multi-Tenant Universities ----------------
export async function getUniversities() {
  const res = await request('/universities');
  return res.universities || [];
}

export async function registerUniversity(universityData) {
  return request('/universities/register', {
    method: 'POST',
    body: JSON.stringify(universityData)
  });
}

// ---------------- Authentication & 2FA Real OTP ----------------
export async function loginRequest(email, password, universityId = null) {
  return request('/auth/login-request', {
    method: 'POST',
    universityId,
    body: JSON.stringify({ email, password, universityId })
  });
}

export async function verifyLoginOtp(email, otp, universityId = null) {
  return request('/auth/verify-login-otp', {
    method: 'POST',
    universityId,
    body: JSON.stringify({ email, otp, universityId })
  });
}

export async function directLogin(email, password, universityId = null) {
  return request('/auth/login', {
    method: 'POST',
    universityId,
    body: JSON.stringify({ email, password, universityId })
  });
}

export async function sendProfileOtp(email) {
  return request('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function verifyAndUpdateProfile(email, otp, updates) {
  return request('/auth/otp/verify-and-update', {
    method: 'POST',
    body: JSON.stringify({ email, otp, updates })
  });
}

// ---------------- Portal Health & Cloudinary ----------------
export async function getStatus() {
  return request('/status');
}

export const getServerStatus = getStatus;

// ---------------- System Metrics ----------------
export async function getMetrics() {
  try {
    const students = await getStudents();
    const total = students.length;
    const evaluated = students.filter(s => 
      s.status === 'Evaluated' || 
      s.evaluationStatus === 'checked' || 
      s.evaluationStatus === 'evaluated' || 
      !!s.evaluation
    ).length;
    const allocated = students.filter(s => 
      s.allocationStatus === 'allocated' || 
      s.allocatedTeacher || 
      s.allocatedTeacherId || 
      s.allocatedTeacherName
    ).length;
    const sentForEvaluation = students.filter(s => 
      s.inRevaluation || 
      s.status === 'Sent for Revaluation' ||
      s.evaluationStatus === 'revaluation'
    ).length;

    return {
      totalStudents: total,
      allocatedStudents: allocated,
      evaluatedStudents: evaluated,
      sentForEvaluation: sentForEvaluation
    };
  } catch (err) {
    return {
      totalStudents: 0,
      allocatedStudents: 0,
      evaluatedStudents: 0,
      sentForEvaluation: 0
    };
  }
}

// ---------------- Students & Scanned Answer Sheets ----------------
export async function getStudents() {
  const res = await request('/students');
  const rawList = res.students || [];

  // Normalize fields so all dashboard views work consistently
  return rawList.map(s => {
    const isEvaluated = s.status === 'Evaluated' || s.evaluationStatus === 'checked' || s.evaluationStatus === 'evaluated' || !!s.evaluation || (s.totalScore !== undefined && s.totalScore > 0);
    const isReval = !isEvaluated && (s.inRevaluation === true || s.status === 'Sent for Revaluation' || s.evaluationStatus === 'revaluation') && !s.revaluation?.resolved;
    const isAllocated = !isEvaluated && (s.allocationStatus === 'allocated' || !!s.allocatedTeacher || !!s.allocatedTeacherName || !!s.allocatedTeacherId);

    const teacherName = s.allocatedTeacherName || (typeof s.allocatedTeacher === 'string' ? s.allocatedTeacher : (s.allocatedTeacher?.name || s.allocatedTeacher?.email || ''));
    const teacherEmail = s.allocatedTeacherEmail || s.allocatedTeacherId || (typeof s.allocatedTeacher === 'object' ? s.allocatedTeacher?.email : '');

    return {
      ...s,
      id: s.id || s._id,
      _id: s._id || s.id,
      enrollmentNumber: s.enrollmentNumber || s.enrollment || 'UNKNOWN',
      name: s.name || s.studentName || 'Candidate',
      department: s.department || s.departmentName || 'Academic',
      subject: s.subject || s.subjectTitle || s.subjectCode || 'General',
      subjectCode: s.subjectCode || s.subject || '',
      status: isEvaluated ? 'Evaluated' : (isReval ? 'Sent for Revaluation' : (isAllocated ? 'Allocated' : 'Unallocated')),
      allocationStatus: isAllocated ? 'allocated' : 'not_allocated',
      evaluationStatus: isEvaluated ? 'checked' : (isReval ? 'revaluation' : 'pending'),
      allocatedTeacher: teacherName || null,
      allocatedTeacherName: teacherName || null,
      allocatedTeacherEmail: teacherEmail || null,
      allocatedTeacherId: teacherEmail || null,
      copyUrl: s.copyUrl || s.copy_url || s.fileUrl || null,
      totalPages: Number(s.totalPages) > 0 ? Number(s.totalPages) : (Array.isArray(s.pages) ? s.pages.length : 1),
      pages: s.pages || null,
      inRevaluation: isReval,
      totalScore: s.totalScore !== undefined ? s.totalScore : (s.evaluation?.totalMarksAwarded ?? s.evaluation?.totalScore ?? 0)
    };
  });
}

export async function uploadStudent(payload) {
  const mappedPayload = {
    enrollment: payload.enrollmentNumber || payload.enrollment,
    studentName: payload.name || payload.studentName,
    department: payload.department || payload.departmentName || 'Academic',
    subjectCode: payload.subjectCode || payload.subject,
    subjectTitle: payload.subjectTitle || payload.subject || 'Examination Script',
    academicYear: payload.academicYear || '2025-2026',
    examSession: payload.examSession || 'December',
    copy_url: payload.copyUrl || payload.copy_url || payload.fileUrl,
    fileUrl: payload.copyUrl || payload.copy_url || payload.fileUrl,
    copyUrl: payload.copyUrl || payload.copy_url || payload.fileUrl,
    totalPages: Number(payload.totalPages) || 1,
    fileName: payload.fileName || null,
    allocationStatus: 'not_allocated',
    evaluationStatus: 'pending'
  };
  return request('/students/upload', {
    method: 'POST',
    body: JSON.stringify(mappedPayload)
  });
}

export const createStudent = uploadStudent;

// Guaranteed universal formatter for Department : Subject format
export function formatDeptSubject(student, subjects = []) {
  if (!student) return 'Academic : General';
  let dept = (student.department || student.departmentName || '').trim();
  const subj = (student.subjectTitle || student.subject || student.subjectCode || 'General').trim();
  
  if (!dept && Array.isArray(subjects) && subjects.length > 0) {
    const match = subjects.find(sub => 
      (sub.code && (sub.code === student.subjectCode || sub.code === student.subject)) ||
      (sub.title && (sub.title === student.subjectTitle || sub.title === student.subject)) ||
      (sub.name && (sub.name === student.subjectTitle || sub.name === student.subject))
    );
    if (match && match.department) {
      dept = match.department.trim();
    }
  }
  
  if (!dept) dept = 'Academic';

  // If subj already starts with dept + ' :', avoid duplicating
  if (subj.toLowerCase().startsWith(dept.toLowerCase() + ' :') || subj.toLowerCase().startsWith(dept.toLowerCase() + ':')) {
    return subj;
  }

  return `${dept} : ${subj}`;
}

export async function fetchDocumentPageCount(url, publicId = null) {
  try {
    const params = new URLSearchParams();
    if (url) params.append('url', url);
    if (publicId) params.append('publicId', publicId);
    const res = await request(`/documents/page-count?${params.toString()}`);
    return res.totalPages || 1;
  } catch (e) {
    console.warn('Error fetching dynamic page count:', e);
    return 1;
  }
}

export async function allocateStudents(studentIds, teacherEmail, teacherName) {
  return request('/students/allocate', {
    method: 'POST',
    body: JSON.stringify({ studentIds, teacherEmail, teacherName })
  });
}

export async function submitEvaluation(studentId, evaluationData) {
  return request('/students/evaluate', {
    method: 'POST',
    body: JSON.stringify({ studentId, evaluationData })
  });
}

export async function flagRevaluation(studentId, reason, teacherEmail) {
  return request('/students/revaluation/flag', {
    method: 'POST',
    body: JSON.stringify({ studentId, reason, teacherEmail })
  });
}

export const sendToRevaluation = flagRevaluation;

export async function resolveRevaluation(studentId, options) {
  return request('/students/revaluation/resolve', {
    method: 'POST',
    body: JSON.stringify({ studentId, ...options })
  });
}

// ---------------- Teachers & Evaluators ----------------
export async function getTeachers() {
  const res = await request('/teachers');
  return res.teachers || [];
}

export async function addTeacher(teacherData) {
  return request('/teachers/add', {
    method: 'POST',
    body: JSON.stringify(teacherData)
  });
}

export async function deleteTeacher(emailOrId) {
  return request('/teachers/remove', {
    method: 'POST',
    body: JSON.stringify({ email: emailOrId })
  });
}

export const removeTeacher = deleteTeacher;

export async function getUsers(role = null) {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const res = await request(`/users${query}`);
  return res.users || [];
}

export async function addUser(userData) {
  return request('/users/add', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function deleteUser(emailOrId) {
  return request('/users/remove', {
    method: 'POST',
    body: JSON.stringify({ email: emailOrId })
  });
}

// ---------------- University Subjects Catalog ----------------
export async function getSubjects() {
  const res = await request('/subjects');
  const list = res.subjects || [];
  return list.map(s => ({
    ...s,
    name: s.name || s.title || s.subjectName || s.code
  }));
}

export async function addSubject(subject) {
  return request('/subjects/add', {
    method: 'POST',
    body: JSON.stringify({
      code: subject.code,
      title: subject.name || subject.title,
      department: subject.department
    })
  });
}

export async function removeSubject(code) {
  return request('/subjects/remove', {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}

export async function deleteSubject(subjectOrCode) {
  const code = typeof subjectOrCode === 'object' ? (subjectOrCode.code || subjectOrCode._id) : subjectOrCode;
  return removeSubject(code);
}

// ---------------- Academic Departments ----------------
export async function getDepartments() {
  const res = await request('/departments');
  return res.departments || [];
}

export async function addDepartment(dept) {
  return request('/departments/add', {
    method: 'POST',
    body: JSON.stringify(dept)
  });
}

export async function removeDepartment(codeOrName) {
  return request('/departments/remove', {
    method: 'POST',
    body: JSON.stringify({ code: codeOrName, name: codeOrName })
  });
}

export const deleteDepartment = removeDepartment;

// ---------------- Answer References ----------------
export async function getReferences() {
  const res = await request('/references');
  return res.references || [];
}

export async function addReference(refData) {
  return request('/references/add', {
    method: 'POST',
    body: JSON.stringify(refData)
  });
}

// ---------------- Direct Cloudinary File Upload ----------------
export async function uploadFileToCloudinary(fileInput, fileName, enrollment, subjectCode) {
  let fileData = fileInput;
  let fName = fileName;

  // If user passed a browser File / Blob object, convert to base64 DataURL
  if (fileInput instanceof File || fileInput instanceof Blob) {
    fName = fName || fileInput.name;
    fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileInput);
    });
  }

  return request('/upload', {
    method: 'POST',
    body: JSON.stringify({ 
      fileData, 
      fileName: fName || 'scanned_copy.pdf', 
      enrollment: enrollment || 'INTAKE', 
      subjectCode: subjectCode || 'EXAM' 
    })
  });
}
