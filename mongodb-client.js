require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mponline_evaluation';
const DB_NAME = 'mponline_evaluation_db';

// Seed defaults held strictly in-memory (no local file database)
const DEFAULT_USERS = [
  {
    email: 'admin@gmail.com',
    password: 'admin123',
    name: 'Admin Cell Head',
    role: 'admin',
    department: 'Academic Scrutiny Board'
  },
  {
    email: 'administrator@gmail.com',
    password: 'admin123',
    name: 'Chief Administrator',
    role: 'administrator',
    department: 'Apex Examination Authority'
  },
  {
    email: 'university@gmail.com',
    password: 'univ123',
    name: 'University Examination Cell',
    role: 'university',
    department: 'Central Intake Cell'
  },
  {
    email: 'teacher@gmail.com',
    password: 'teacher123',
    name: 'Evaluator Teacher',
    role: 'teacher',
    department: 'Computer Science & Engineering',
    maxLoad: 100,
    status: 'active'
  }
];

const DEFAULT_SUBJECTS = [];
const DEFAULT_DEPARTMENTS = [];

const DEFAULT_TEACHERS = [
  {
    id: 'tch_primary_1',
    email: 'teacher@gmail.com',
    password: 'teacher123',
    name: 'Evaluator Teacher',
    role: 'teacher',
    department: 'Computer Science & Engineering',
    maxLoad: 100,
    status: 'active'
  }
];

const DEFAULT_REFERENCES = [];

function extractCleanUrl(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    return extractCleanUrl(val.copy_url || val.fileUrl || val.secure_url || val.url || null);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractCleanUrl(parsed);
      } catch (e) {}
    }
    const match = trimmed.match(/https?:\/\/[^\s"',}\]]+/i);
    if (match) {
      let url = match[0];
      if (url.includes('cloudinary.com') && url.toLowerCase().includes('.pdf')) {
        url = url.replace(/\.pdf(\?.*)?$/i, '.jpg$1');
      }
      return url;
    }
    if (trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;
  }
  return null;
}

class MongoDBHandler {
  constructor() {
    this.uri = MONGODB_URI;
    this.client = null;
    this.db = null;
    this.isConnected = false;

    // Purely in-memory buffer (NO local file / NO disk database)
    this.memoryUsers = [...DEFAULT_USERS];
    this.memoryTeachers = [...DEFAULT_TEACHERS];
    this.memoryStudents = [];
    this.memoryReferences = [...DEFAULT_REFERENCES];
    this.memorySubjects = [...DEFAULT_SUBJECTS];
    this.memoryDepartments = [...DEFAULT_DEPARTMENTS];

    this.connect();
    this.startAutoReconnect();
  }

  async connect() {
    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.isConnected = true;
      console.log(`[MongoDB] Connected successfully to MongoDB Database: "${DB_NAME}"`);

      // Initialize separate collections and unique indexes
      const teachersCollection = this.db.collection('teachers');
      await teachersCollection.createIndex({ email: 1 }, { unique: true });

      const studentsCollection = this.db.collection('students');
      await studentsCollection.createIndex({ enrollment: 1, subjectCode: 1 });

      const usersCollection = this.db.collection('users');
      await usersCollection.createIndex({ email: 1 }, { unique: true });

      const refsCollection = this.db.collection('answer_references');
      await refsCollection.createIndex({ subjectCode: 1 });

      const subjectsCollection = this.db.collection('subjects');
      await subjectsCollection.createIndex({ code: 1 }, { unique: true });

      const deptsCollection = this.db.collection('departments');
      await deptsCollection.createIndex({ code: 1 }, { unique: true });

      // Strictly keep ONLY the 4 authorized login accounts in MongoDB users collection
      const allowedEmails = DEFAULT_USERS.map(u => u.email.toLowerCase());
      await usersCollection.deleteMany({ email: { $nin: allowedEmails } });
      for (const u of DEFAULT_USERS) {
        await usersCollection.updateOne(
          { email: u.email.toLowerCase() },
          { $set: u },
          { upsert: true }
        );
      }

      // Strictly keep ONLY the official evaluator teacher in teachers collection
      await teachersCollection.deleteMany({ email: { $ne: 'teacher@gmail.com' } });
      for (const t of DEFAULT_TEACHERS) {
        await teachersCollection.updateOne(
          { email: t.email.toLowerCase() },
          { $set: t },
          { upsert: true }
        );
      }

      console.log('[MongoDB] Collections initialized: strictly 4 authorized login accounts retained.');
    } catch (e) {
      this.isConnected = false;
      console.warn(`[MongoDB Notice] Could not connect to Atlas server (${e.message}). Operating with pure in-memory cache until Atlas IP access is enabled.`);
    }
  }

  startAutoReconnect() {
    setInterval(async () => {
      if (!this.isConnected) {
        try {
          await this.connect();
        } catch (_) {}
      }
    }, 15000);
  }

  getStatus() {
    return {
      connected: this.isConnected,
      database: DB_NAME,
      collections: ['teachers', 'students', 'users', 'answer_references', 'subjects'],
      storageMode: this.isConnected ? 'mongodb_atlas' : 'memory_sync_active'
    };
  }

  // ==============================================================
  // 1. Separate Teacher Schema Operations (MongoDB 'teachers' collection)
  // ==============================================================
  async getAllTeachers() {
    if (this.isConnected && this.db) {
      try {
        const teachers = await this.db.collection('teachers').find({}).toArray();
        return teachers.map(t => {
          const { _id, ...rest } = t;
          return rest;
        });
      } catch (e) {
        console.error('[MongoDB] Fetch teachers failed:', e.message);
      }
    }
    return this.memoryTeachers;
  }

  async insertTeacher(teacherData) {
    const cleanEmail = teacherData.email.trim().toLowerCase();
    const cleanTeacher = {
      id: teacherData.id || `tch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: teacherData.name.trim(),
      email: cleanEmail,
      password: teacherData.password,
      department: teacherData.department ? teacherData.department.trim() : 'Academic Department',
      role: 'teacher',
      maxLoad: Number(teacherData.maxLoad) || 100,
      createdAt: teacherData.createdAt || new Date().toISOString(),
      status: 'active'
    };

    // Save directly to MongoDB separate 'teachers' collection
    if (this.isConnected && this.db) {
      try {
        await this.db.collection('teachers').updateOne(
          { email: cleanEmail },
          { $set: cleanTeacher },
          { upsert: true }
        );
        console.log(`[MongoDB] Teacher "${cleanTeacher.name}" saved directly to separate 'teachers' collection!`);

        // Also save to users collection for unified authentication
        await this.db.collection('users').updateOne(
          { email: cleanEmail },
          { $set: cleanTeacher },
          { upsert: true }
        );
      } catch (e) {
        console.error('[MongoDB] Insert teacher into teachers collection failed:', e.message);
      }
    }

    // In-memory buffer sync
    const idx = this.memoryTeachers.findIndex(t => t.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      this.memoryTeachers[idx] = cleanTeacher;
    } else {
      this.memoryTeachers.push(cleanTeacher);
    }

    const uIdx = this.memoryUsers.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (uIdx >= 0) {
      this.memoryUsers[uIdx] = cleanTeacher;
    } else {
      this.memoryUsers.push(cleanTeacher);
    }

    return cleanTeacher;
  }

  async deleteTeacher(emailOrId) {
    const key = (emailOrId || '').trim().toLowerCase();
    if (this.isConnected && this.db) {
      try {
        await this.db.collection('teachers').deleteOne({
          $or: [{ email: key }, { id: key }]
        });
        await this.db.collection('users').deleteOne({
          $or: [{ email: key }, { id: key }],
          role: 'teacher'
        });
        console.log(`[MongoDB] Teacher "${key}" deleted successfully.`);
      } catch (e) {
        console.error('[MongoDB] Delete teacher failed:', e.message);
      }
    }

    this.memoryTeachers = this.memoryTeachers.filter(t => t.email.toLowerCase() !== key && t.id !== key);
    this.memoryUsers = this.memoryUsers.filter(u => !(u.role === 'teacher' && (u.email.toLowerCase() === key || u.id === key)));
    return { success: true, key };
  }

  // ==============================================================
  // 2. Student Schema Operations (MongoDB 'students' collection)
  // Field "copy_url" explicitly holds Cloudinary return URL
  // ==============================================================
  async insertStudent(student) {
    const rawCopy = student.copy_url || student.fileUrl || null;
    const cleanUrl = extractCleanUrl(rawCopy);
    const studentDoc = {
      ...student,
      copy_url: cleanUrl,
      fileUrl: cleanUrl,
      storageProvider: cleanUrl && cleanUrl.includes('cloudinary') ? 'cloudinary' : (student.storageProvider || 'local')
    };

    // Save directly to MongoDB 'students' collection
    if (this.isConnected && this.db) {
      try {
        const collection = this.db.collection('students');
        await collection.updateOne(
          { enrollment: studentDoc.enrollment, subjectCode: studentDoc.subjectCode },
          { $set: studentDoc },
          { upsert: true }
        );
        console.log(`[MongoDB] Student "${studentDoc.enrollment}" saved to MongoDB students collection with copy_url: ${studentDoc.copy_url}`);
      } catch (e) {
        console.error('[MongoDB] Insert student failed:', e.message);
      }
    }

    // In-memory buffer sync
    const idx = this.memoryStudents.findIndex(s => s.enrollment === studentDoc.enrollment && s.subjectCode === studentDoc.subjectCode);
    if (idx >= 0) {
      this.memoryStudents[idx] = studentDoc;
    } else {
      this.memoryStudents.unshift(studentDoc);
    }

    return studentDoc;
  }

  async getAllStudents() {
    let list = [];
    if (this.isConnected && this.db) {
      try {
        const collection = this.db.collection('students');
        const docs = await collection.find({}).sort({ uploadDate: -1 }).toArray();
        list = docs.map(d => {
          const stringId = d.id || (d._id ? d._id.toString() : `std_${Date.now()}`);
          const cleanUrl = extractCleanUrl(d.copy_url || d.fileUrl || d.copyUrl);
          const isImg = (cleanUrl && /\.(png|jpg|jpeg|webp)($|\?)/i.test(cleanUrl)) || (d.fileName && /\.(png|jpg|jpeg|webp)$/i.test(d.fileName));
          const normalizedPages = isImg ? 1 : (Number(d.totalPages) || (d.pages && d.pages.length ? d.pages.length : 1));
          return {
            ...d,
            _id: stringId,
            id: stringId,
            copy_url: cleanUrl,
            fileUrl: cleanUrl,
            copyUrl: cleanUrl,
            totalPages: normalizedPages
          };
        });
      } catch (e) {
        console.error('[MongoDB] Fetch students failed:', e.message);
        list = this.memoryStudents;
      }
    } else {
      list = this.memoryStudents;
    }

    // Ensure teacher names are populated if email/id exists
    let teachers = [];
    try {
      teachers = await this.getAllTeachers();
    } catch (_) {
      teachers = this.memoryTeachers || [];
    }

    const teacherMap = new Map();
    teachers.forEach(t => {
      if (t.email) teacherMap.set(t.email.toLowerCase(), t.name);
      if (t.id) teacherMap.set(t.id, t.name);
    });

    try {
      const users = await this.getAllUsers();
      users.forEach(u => {
        if (u.name && u.email && !teacherMap.has(u.email.toLowerCase())) {
          teacherMap.set(u.email.toLowerCase(), u.name);
        }
      });
    } catch (_) {}

    return list.map(d => {
      let tName = d.allocatedTeacherName || (typeof d.allocatedTeacher === 'string' ? d.allocatedTeacher : null);
      const tEmail = d.allocatedTeacherEmail || d.allocatedTeacherId;
      if ((!tName || tName === 'None') && tEmail) {
        tName = teacherMap.get(tEmail.toLowerCase()) || tEmail;
      }
      return {
        ...d,
        allocatedTeacherName: tName || null,
        allocatedTeacher: tName || null,
        allocatedTeacherEmail: tEmail || null,
        allocatedTeacherId: tEmail || null
      };
    });
  }

  // ==============================================================
  // 3. Users Collection Operations (Authentication & Profiles)
  // ==============================================================
  async getAllUsers() {
    if (this.isConnected && this.db) {
      try {
        const users = await this.db.collection('users').find({}).toArray();
        return users.map(u => {
          const { _id, ...rest } = u;
          return rest;
        });
      } catch (e) {
        console.error('[MongoDB] Fetch users failed:', e.message);
      }
    }
    return this.memoryUsers;
  }

  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = await this.getAllUsers();
    return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  async authenticateUser(email, password) {
    if (!email) return { success: false, message: 'Email address is required.' };
    const cleanEmail = email.trim().toLowerCase();

    // Check users collection & teachers collection in MongoDB
    let user = await this.findUserByEmail(cleanEmail);
    if (!user) {
      const teachers = await this.getAllTeachers();
      user = teachers.find(t => t.email.toLowerCase() === cleanEmail);
    }

    if (!user) {
      return { success: false, message: 'Account not found in official registry' };
    }
    if (user.password !== password) {
      return { success: false, message: 'Invalid password' };
    }
    return { success: true, user };
  }

  async insertUser(userData) {
    if (userData.role === 'teacher') {
      return this.insertTeacher(userData);
    }

    const cleanEmail = userData.email.trim().toLowerCase();
    const cleanUser = {
      ...userData,
      email: cleanEmail,
      createdAt: userData.createdAt || new Date().toISOString()
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('users').updateOne(
          { email: cleanEmail },
          { $set: cleanUser },
          { upsert: true }
        );
      } catch (e) {
        console.error('[MongoDB] Insert user failed:', e.message);
      }
    }

    const idx = this.memoryUsers.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      this.memoryUsers[idx] = cleanUser;
    } else {
      this.memoryUsers.push(cleanUser);
    }

    return cleanUser;
  }

  async updateUserProfile(email, updates) {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.findUserByEmail(cleanEmail);
    if (!existing) {
      throw new Error(`User with email ${cleanEmail} not found in database.`);
    }

    const updatedUser = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('users').updateOne(
          { email: cleanEmail },
          { $set: updatedUser }
        );
        if (updatedUser.role === 'teacher') {
          await this.db.collection('teachers').updateOne(
            { email: cleanEmail },
            { $set: updatedUser }
          );
        }
      } catch (e) {
        console.error('[MongoDB] Update user profile failed:', e.message);
      }
    }

    const idx = this.memoryUsers.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      this.memoryUsers[idx] = updatedUser;
    } else {
      this.memoryUsers.push(updatedUser);
    }

    if (updatedUser.role === 'teacher') {
      const tIdx = this.memoryTeachers.findIndex(t => t.email.toLowerCase() === cleanEmail);
      if (tIdx >= 0) {
        this.memoryTeachers[tIdx] = updatedUser;
      }
    }

    return updatedUser;
  }

  // ==============================================================
  // 4. Allocation & Evaluation Operations in MongoDB
  // ==============================================================
  async allocateStudents(studentIds, teacherEmail, teacherName) {
    const allocatedDate = new Date().toISOString();
    const { ObjectId } = require('mongodb');
    const validObjIds = [];
    studentIds.forEach(sid => {
      if (typeof sid === 'string' && ObjectId.isValid(sid) && sid.length === 24) {
        try { validObjIds.push(new ObjectId(sid)); } catch (_) {}
      }
    });

    const filter = {
      $or: [
        { id: { $in: studentIds } },
        { _id: { $in: validObjIds } },
        { enrollment: { $in: studentIds } }
      ]
    };
    const update = {
      $set: {
        allocationStatus: 'allocated',
        allocatedTeacherId: teacherEmail,
        allocatedTeacherName: teacherName,
        allocatedDate: allocatedDate
      }
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('students').updateMany(filter, update);
      } catch (e) {
        console.error('[MongoDB] Allocate students failed:', e.message);
      }
    }

    this.memoryStudents = this.memoryStudents.map(s => {
      if (studentIds.includes(s.id) || studentIds.includes(s.enrollment) || (s._id && studentIds.includes(s._id.toString()))) {
        return {
          ...s,
          allocationStatus: 'allocated',
          allocatedTeacherId: teacherEmail,
          allocatedTeacherName: teacherName,
          allocatedDate: allocatedDate
        };
      }
      return s;
    });

    return {
      success: true,
      message: `Allocated ${studentIds.length} scripts to ${teacherName} in MongoDB.`
    };
  }

  async submitEvaluation(studentId, evaluationData) {
    const currentStudent = this.memoryStudents.find(s => s.id === studentId || s.enrollment === studentId || (s._id && s._id.toString() === studentId));
    const isAdmin = (evaluationData.evaluatorEmail || '').toLowerCase().includes('admin') || 
                    (evaluationData.evaluatorName || '').toLowerCase().includes('admin');

    const updateSet = {
      status: 'Evaluated',
      evaluationStatus: 'checked',
      inRevaluation: false,
      evaluation: evaluationData,
      totalScore: evaluationData.totalMarksAwarded ?? evaluationData.totalScore ?? 0,
      evaluatedAt: new Date().toISOString()
    };

    if (isAdmin) {
      const prevTeacherEmail = currentStudent?.allocatedTeacherEmail || currentStudent?.allocatedTeacherId || (typeof currentStudent?.allocatedTeacher === 'object' ? currentStudent?.allocatedTeacher?.email : null);
      const prevTeacherName = currentStudent?.allocatedTeacherName || (typeof currentStudent?.allocatedTeacher === 'object' ? currentStudent?.allocatedTeacher?.name : currentStudent?.allocatedTeacher);

      updateSet.allocatedTeacherName = 'Administrator';
      updateSet.allocatedTeacher = 'Administrator';
      updateSet.assignedTeacher = 'Administrator';
      updateSet.evaluatedByAdmin = true;
      updateSet.checkedByAdmin = true;
      if (prevTeacherEmail) {
        updateSet.previousTeacherEmail = prevTeacherEmail;
      }
      if (prevTeacherName) {
        updateSet.previousTeacherName = prevTeacherName;
      }
    }

    const update = {
      $set: updateSet,
      $unset: {
        revaluation: ""
      }
    };

    const { ObjectId } = require('mongodb');
    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('students').updateOne(filter, update);
      } catch (e) {
        console.error('[MongoDB] Submit evaluation failed:', e.message);
      }
    }

    const idx = this.memoryStudents.findIndex(s => s.id === studentId || s.enrollment === studentId || (s._id && s._id.toString() === studentId));
    if (idx >= 0) {
      delete this.memoryStudents[idx].revaluation;
      Object.assign(this.memoryStudents[idx], updateSet);
    }

    return { success: true, message: 'Evaluation marks recorded successfully in MongoDB.' };
  }

  async flagRevaluation(studentId, { reason, teacherEmail }) {
    const revalData = {
      flaggedAt: new Date().toISOString(),
      flaggedBy: teacherEmail,
      reason: reason || 'Teacher flagged discrepancy with script questions.',
      resolved: false
    };

    const { ObjectId } = require('mongodb');
    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('students').updateOne(
          filter,
          { $set: { status: 'Sent for Revaluation', evaluationStatus: 'revaluation', inRevaluation: true, revaluation: revalData } }
        );
      } catch (e) {
        console.error('[MongoDB] Flag revaluation failed:', e.message);
      }
    }

    const idx = this.memoryStudents.findIndex(s => s.id === studentId || s.enrollment === studentId || (s._id && s._id.toString() === studentId));
    if (idx >= 0) {
      this.memoryStudents[idx].status = 'Sent for Revaluation';
      this.memoryStudents[idx].evaluationStatus = 'revaluation';
      this.memoryStudents[idx].inRevaluation = true;
      this.memoryStudents[idx].revaluation = revalData;
    }

    return { success: true, message: 'Answer sheet flagged for revaluation in MongoDB.' };
  }

  async resolveRevaluation(studentId, { action, adminRemarks, newTeacherEmail, newTeacherName }) {
    let teacherName = newTeacherName;
    if (!teacherName && newTeacherEmail) {
      const foundT = this.memoryTeachers?.find(t => t.email === newTeacherEmail);
      if (foundT) {
        teacherName = foundT.name;
      } else if (this.isConnected && this.db) {
        try {
          const dbT = await this.db.collection('teachers').findOne({ email: newTeacherEmail });
          if (dbT) teacherName = dbT.name;
        } catch (_) {}
      }
    }
    if (!teacherName && newTeacherEmail) {
      teacherName = newTeacherEmail;
    }

    const currentStudent = this.memoryStudents.find(s => s.id === studentId || s.enrollment === studentId || (s._id && s._id.toString() === studentId));
    const prevTeacherEmail = currentStudent?.allocatedTeacherEmail || currentStudent?.allocatedTeacherId || (typeof currentStudent?.allocatedTeacher === 'object' ? currentStudent?.allocatedTeacher?.email : null);
    const prevTeacherName = currentStudent?.allocatedTeacherName || (typeof currentStudent?.allocatedTeacher === 'object' ? currentStudent?.allocatedTeacher?.name : currentStudent?.allocatedTeacher);

    let updateFields = {
      inRevaluation: false,
      evaluatedByAdmin: false,
      checkedByAdmin: false
    };

    if (action === 'reassign') {
      updateFields.status = 'Allocated';
      updateFields.allocationStatus = 'allocated';
      updateFields.allocatedTeacherId = newTeacherEmail;
      updateFields.allocatedTeacherEmail = newTeacherEmail;
      updateFields.allocatedTeacherName = teacherName;
      updateFields.allocatedTeacher = teacherName;
      updateFields.assignedTeacher = teacherName;
      updateFields.allocatedDate = new Date().toISOString();
      updateFields.evaluationStatus = 'pending';
      if (prevTeacherEmail) {
        updateFields.previousTeacherEmail = prevTeacherEmail;
      }
      if (prevTeacherName) {
        updateFields.previousTeacherName = prevTeacherName;
      }
    } else {
      updateFields.status = 'Evaluated';
      updateFields.evaluationStatus = 'checked';
      updateFields.allocatedTeacherName = 'Administrator';
      updateFields.allocatedTeacher = 'Administrator';
      updateFields.assignedTeacher = 'Administrator';
      updateFields.evaluatedByAdmin = true;
      updateFields.checkedByAdmin = true;
      if (prevTeacherEmail) {
        updateFields.previousTeacherEmail = prevTeacherEmail;
      }
      if (prevTeacherName) {
        updateFields.previousTeacherName = prevTeacherName;
      }
    }

    const { ObjectId } = require('mongodb');
    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('students').updateOne(filter, { 
          $set: updateFields,
          $unset: { revaluation: "" }
        });
      } catch (e) {
        console.error('[MongoDB] Resolve revaluation failed:', e.message);
      }
    }

    const idx = this.memoryStudents.findIndex(s => s.id === studentId || s.enrollment === studentId || (s._id && s._id.toString() === studentId));
    if (idx >= 0) {
      delete this.memoryStudents[idx].revaluation;
      Object.assign(this.memoryStudents[idx], updateFields);
    }

    return { success: true, message: 'Revaluation case resolved in MongoDB.' };
  }

  // ==============================================================
  // 5. Answer References Collection Operations in MongoDB
  // ==============================================================
  async getAllAnswerReferences() {
    if (this.isConnected && this.db) {
      try {
        const refs = await this.db.collection('answer_references').find({}).toArray();
        return refs.map(r => {
          const { _id, ...rest } = r;
          return rest;
        });
      } catch (e) {
        console.error('[MongoDB] Fetch references failed:', e.message);
      }
    }
    return this.memoryReferences;
  }

  async insertAnswerReference(refData) {
    const cleanRef = {
      id: refData.id || `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      subjectCode: refData.subjectCode.trim().toUpperCase(),
      subjectTitle: refData.subjectTitle.trim(),
      examSession: refData.examSession || 'May-June 2026',
      fileName: refData.fileName || `${refData.subjectCode}_Model_Solution.pdf`,
      fileSize: refData.fileSize || '2.1 MB',
      uploadedAt: refData.uploadedAt || new Date().toISOString(),
      fileUrl: refData.fileUrl || refData.copy_url || null,
      copy_url: refData.copy_url || refData.fileUrl || null,
      cloudinaryPublicId: refData.cloudinaryPublicId || null,
      description: refData.description || 'Approved marking scheme and rubric.'
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('answer_references').updateOne(
          { subjectCode: cleanRef.subjectCode },
          { $set: cleanRef },
          { upsert: true }
        );
      } catch (e) {
        console.error('[MongoDB] Insert answer reference failed:', e.message);
      }
    }

    const idx = this.memoryReferences.findIndex(r => r.subjectCode === cleanRef.subjectCode);
    if (idx >= 0) {
      this.memoryReferences[idx] = cleanRef;
    } else {
      this.memoryReferences.push(cleanRef);
    }

    return cleanRef;
  }

  getAllReferences() {
    return this.getAllAnswerReferences();
  }

  insertReference(refData) {
    return this.insertAnswerReference(refData);
  }

  // ==============================================================
  // 6. Subjects Collection Operations in MongoDB
  // ==============================================================
  async getAllSubjects() {
    if (this.isConnected && this.db) {
      try {
        const list = await this.db.collection('subjects').find({}).toArray();
        if (list && list.length > 0) {
          return list.map(s => {
            const { _id, ...rest } = s;
            return rest;
          });
        }
      } catch (e) {
        console.error('[MongoDB] Fetch subjects failed:', e.message);
      }
    }
    return this.memorySubjects;
  }

  async insertSubject(subjectData) {
    const cleanSubject = {
      code: subjectData.code.trim().toUpperCase(),
      title: subjectData.title.trim(),
      department: subjectData.department ? subjectData.department.trim() : 'Academic Department',
      createdAt: new Date().toISOString()
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('subjects').updateOne(
          { code: cleanSubject.code },
          { $set: cleanSubject },
          { upsert: true }
        );
      } catch (e) {
        console.error('[MongoDB] Insert subject failed:', e.message);
      }
    }

    const idx = this.memorySubjects.findIndex(s => s.code === cleanSubject.code);
    if (idx >= 0) {
      this.memorySubjects[idx] = cleanSubject;
    } else {
      this.memorySubjects.push(cleanSubject);
    }
    return cleanSubject;
  }

  async deleteSubject(subjectCode) {
    const cleanCode = subjectCode.trim().toUpperCase();
    if (this.isConnected && this.db) {
      try {
        await this.db.collection('subjects').deleteOne({ code: cleanCode });
      } catch (e) {
        console.error('[MongoDB] Delete subject failed:', e.message);
      }
    }
    this.memorySubjects = this.memorySubjects.filter(s => s.code !== cleanCode);
    return { success: true, code: cleanCode };
  }

  // ==============================================================
  // 7. Academic Departments Operations in MongoDB
  // ==============================================================
  async getAllDepartments() {
    if (this.isConnected && this.db) {
      try {
        const list = await this.db.collection('departments').find({}).toArray();
        if (list && list.length > 0) {
          return list.map(d => {
            const { _id, ...rest } = d;
            return rest;
          });
        }
      } catch (e) {
        console.error('[MongoDB] Fetch departments failed:', e.message);
      }
    }
    return this.memoryDepartments;
  }

  async insertDepartment(deptData) {
    const cleanDept = {
      id: deptData.id || `dept_${Date.now()}`,
      code: deptData.code ? deptData.code.trim().toUpperCase() : `DEPT_${Date.now().toString().slice(-4)}`,
      name: deptData.name ? deptData.name.trim() : 'Academic Department',
      head: deptData.head ? deptData.head.trim() : 'Department Head',
      email: deptData.email ? deptData.email.trim() : null,
      facultyCount: Number(deptData.facultyCount) || 20,
      intakeCapacity: Number(deptData.intakeCapacity) || 120,
      buildingLocation: deptData.buildingLocation ? deptData.buildingLocation.trim() : 'Academic Wing',
      status: deptData.status || 'Active',
      description: deptData.description || null,
      createdAt: deptData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.isConnected && this.db) {
      try {
        await this.db.collection('departments').updateOne(
          { code: cleanDept.code },
          { $set: cleanDept },
          { upsert: true }
        );
      } catch (e) {
        console.error('[MongoDB] Insert department failed:', e.message);
      }
    }

    const idx = this.memoryDepartments.findIndex(d => d.code === cleanDept.code);
    if (idx >= 0) {
      this.memoryDepartments[idx] = cleanDept;
    } else {
      this.memoryDepartments.push(cleanDept);
    }
    return cleanDept;
  }

  async deleteDepartment(deptCodeOrName) {
    const key = (deptCodeOrName || '').trim();
    if (this.isConnected && this.db) {
      try {
        await this.db.collection('departments').deleteOne({
          $or: [{ code: key.toUpperCase() }, { name: key }, { id: key }]
        });
      } catch (e) {
        console.error('[MongoDB] Delete department failed:', e.message);
      }
    }
    this.memoryDepartments = this.memoryDepartments.filter(
      d => d.code !== key.toUpperCase() && d.name !== key && d.id !== key
    );
    return { success: true, key };
  }
}

module.exports = new MongoDBHandler();
