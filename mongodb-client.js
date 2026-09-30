require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mponline_evaluation';
const CENTRAL_DB_NAME = 'mponline_central';

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
    this.centralDb = null;
    this.isConnected = false;

    this.connect();
    this.startAutoReconnect();
  }

  async connect() {
    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000
      });
      await this.client.connect();
      this.centralDb = this.client.db(CENTRAL_DB_NAME);
      this.isConnected = true;
      console.log(`[MongoDB Multi-Tenant] Connected successfully to Cluster. Central DB: "${CENTRAL_DB_NAME}"`);

      // Initialize Central Universities Registry indexes
      const univCol = this.centralDb.collection('universities');
      await univCol.createIndex({ universityId: 1 }, { unique: true });
      await univCol.createIndex({ code: 1 }, { unique: true });

      const count = await univCol.countDocuments();
      console.log(`[MongoDB Multi-Tenant] Central DB initialized with ${count} registered universities from MongoDB.`);
    } catch (e) {
      this.isConnected = false;
      console.warn(`[MongoDB Error] Could not connect to Atlas cluster: ${e.message}`);
    }
  }

  async ensureConnected() {
    if (!this.isConnected || !this.client || !this.centralDb) {
      await this.connect();
    }
    if (!this.isConnected || !this.client) {
      throw new Error('Database connection unavailable. Please check MongoDB Atlas connection.');
    }
  }

  async initTenantDatabase(dbName) {
    await this.ensureConnected();
    try {
      const tenantDb = this.client.db(dbName);
      await tenantDb.collection('users').createIndex({ email: 1 }, { unique: true });
      await tenantDb.collection('teachers').createIndex({ email: 1 }, { unique: true });
      await tenantDb.collection('students').createIndex({ enrollment: 1, subjectCode: 1 });
      await tenantDb.collection('departments').createIndex({ code: 1 }, { unique: true });
      await tenantDb.collection('subjects').createIndex({ code: 1 }, { unique: true });
      await tenantDb.collection('answer_references').createIndex({ subjectCode: 1 });
    } catch (err) {
      console.warn(`[initTenantDatabase Warn] ${dbName}:`, err.message);
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
      architecture: 'Multi-Tenant (Approach A: Separate Database per University)',
      centralDatabase: CENTRAL_DB_NAME,
      storageMode: 'mongodb_atlas_multi_db'
    };
  }

  // ==============================================================
  // Multi-Tenant University Management (Central DB: 'mponline_central')
  // ==============================================================

  async getAllUniversities() {
    await this.ensureConnected();
    try {
      const docs = await this.centralDb.collection('universities').find({}).sort({ name: 1 }).toArray();
      return (docs || []).map(d => {
        const { _id, ...rest } = d;
        return rest;
      });
    } catch (e) {
      console.error('[MongoDB] Fetch universities failed:', e.message);
      return [];
    }
  }

  async resolveUniversity(universityIdOrCode) {
    await this.ensureConnected();
    if (!universityIdOrCode) {
      const first = await this.centralDb.collection('universities').findOne({});
      if (first) {
        const { _id, ...rest } = first;
        return rest;
      }
      return null;
    }

    const cleanKey = universityIdOrCode.toString().trim();
    try {
      const found = await this.centralDb.collection('universities').findOne({
        $or: [
          { universityId: cleanKey },
          { code: cleanKey.toUpperCase() },
          { email: cleanKey.toLowerCase() },
          { dbName: cleanKey.toLowerCase() }
        ]
      });
      if (found) {
        const { _id, ...rest } = found;
        return rest;
      }
    } catch (e) {
      console.warn('[MongoDB] Resolve university failed:', e.message);
    }
    return null;
  }

  async getTenantDb(universityIdOrCode) {
    const univ = await this.resolveUniversity(universityIdOrCode);
    if (!univ) {
      return { db: null, univ: null };
    }
    await this.ensureConnected();
    const db = (this.client && univ.dbName) ? this.client.db(univ.dbName) : null;
    return { db, univ };
  }

  /**
   * Only universities can register!
   * Generates a completely separate database `univ_<code_lowercase>` on MongoDB.
   */
  async registerUniversity(data) {
    await this.ensureConnected();

    if (!data.name || !data.code || !data.email || !data.password) {
      throw new Error('University Name, University Code, Official Email, and Password are required.');
    }

    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();

    if (!cleanCode || cleanCode.length < 2) {
      throw new Error('University Code must be at least 2 alphanumeric characters (e.g. DAVV, BU, RGPV).');
    }

    const universityId = `MP_UNIV_${cleanCode}`;
    const dbName = `univ_${cleanCode.toLowerCase()}`;

    // Verify uniqueness directly in live MongoDB central database
    const existing = await this.centralDb.collection('universities').findOne({
      $or: [
        { universityId },
        { code: cleanCode },
        { email: cleanEmail },
        { dbName }
      ]
    });

    if (existing) {
      if (existing.code === cleanCode) {
        throw new Error(`University Code "${cleanCode}" is already registered with "${existing.name}".`);
      }
      if (existing.email === cleanEmail) {
        throw new Error(`Email "${cleanEmail}" is already registered to a university account.`);
      }
      throw new Error(`University database identifier "${dbName}" already exists on cluster.`);
    }

    const univDoc = {
      universityId,
      code: cleanCode,
      name: cleanName,
      dbName,
      email: cleanEmail,
      city: (data.city || 'Madhya Pradesh').trim(),
      state: (data.state || 'Madhya Pradesh').trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // 1. Save directly in Central Registry (mponline_central.universities)
    await this.centralDb.collection('universities').insertOne(univDoc);

    // 2. Provision Isolated Tenant Database collections on MongoDB Cluster
    await this.initTenantDatabase(dbName);

    // 3. Create the official University Account inside the tenant database users collection
    const univUser = {
      email: cleanEmail,
      password: data.password,
      name: cleanName,
      role: 'university',
      department: 'University Examination Cell',
      universityId,
      universityName: cleanName,
      createdAt: new Date().toISOString()
    };

    const tenantDb = this.client.db(dbName);
    await tenantDb.collection('users').updateOne(
      { email: cleanEmail },
      { $set: univUser },
      { upsert: true }
    );

    console.log(`[MongoDB Multi-Tenant] Successfully registered University "${cleanName}" (${cleanCode}). Database: "${dbName}".`);

    return {
      success: true,
      university: {
        universityId: univDoc.universityId,
        code: univDoc.code,
        name: univDoc.name,
        email: univDoc.email,
        city: univDoc.city,
        state: univDoc.state,
        status: univDoc.status,
        createdAt: univDoc.createdAt
      }
    };
  }

  // ==============================================================
  // 1. Teacher Schema Operations (Scoped to Tenant Database)
  // ==============================================================
  async getAllTeachers(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];

    try {
      const teachers = await tenantDb.collection('teachers').find({}).toArray();
      return teachers.map(t => {
        const { _id, ...rest } = t;
        return { ...rest, universityId: univ.universityId, universityName: univ.name };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch teachers from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  async insertTeacher(teacherData, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId || teacherData.universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanEmail = teacherData.email.trim().toLowerCase();
    const cleanTeacher = {
      id: teacherData.id || `tch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: teacherData.name.trim(),
      email: cleanEmail,
      password: teacherData.password,
      department: teacherData.department ? teacherData.department.trim() : 'Academic Department',
      subject: teacherData.subject ? teacherData.subject.trim() : null,
      role: 'teacher',
      maxLoad: Number(teacherData.maxLoad) || 100,
      createdAt: teacherData.createdAt || new Date().toISOString(),
      status: 'active',
      universityId: univ.universityId,
      universityName: univ.name
    };

    await tenantDb.collection('teachers').updateOne(
      { email: cleanEmail },
      { $set: cleanTeacher },
      { upsert: true }
    );
    await tenantDb.collection('users').updateOne(
      { email: cleanEmail },
      { $set: cleanTeacher },
      { upsert: true }
    );
    console.log(`[MongoDB Multi-Tenant] Teacher "${cleanTeacher.name}" saved into ${univ.dbName}.teachers!`);
    return cleanTeacher;
  }

  async deleteTeacher(emailOrId, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const key = (emailOrId || '').trim().toLowerCase();

    await tenantDb.collection('teachers').deleteOne({
      $or: [{ email: key }, { id: key }]
    });
    await tenantDb.collection('users').deleteOne({
      $or: [{ email: key }, { id: key }],
      role: 'teacher'
    });
    console.log(`[MongoDB Multi-Tenant] Teacher "${key}" deleted from ${univ.dbName}.`);
    return { success: true, key };
  }

  // ==============================================================
  // 2. Student Schema Operations (Scoped to Tenant Database)
  // ==============================================================
  async insertStudent(student, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId || student.universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const rawCopy = student.copy_url || student.fileUrl || null;
    const cleanUrl = extractCleanUrl(rawCopy);
    const studentDoc = {
      ...student,
      copy_url: cleanUrl,
      fileUrl: cleanUrl,
      storageProvider: cleanUrl && cleanUrl.includes('cloudinary') ? 'cloudinary' : (student.storageProvider || 'local'),
      universityId: univ.universityId,
      universityName: univ.name
    };

    await tenantDb.collection('students').updateOne(
      { enrollment: studentDoc.enrollment, subjectCode: studentDoc.subjectCode },
      { $set: studentDoc },
      { upsert: true }
    );
    console.log(`[MongoDB Multi-Tenant] Student "${studentDoc.enrollment}" saved to ${univ.dbName}.students`);
    return studentDoc;
  }

  async getAllStudents(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];

    try {
      const docs = await tenantDb.collection('students').find({}).sort({ uploadDate: -1 }).toArray();
      return docs.map(d => {
        const stringId = d.id || (d._id ? d._id.toString() : `std_${Date.now()}`);
        const cleanUrl = extractCleanUrl(d.copy_url || d.fileUrl || d.copyUrl);
        const isImg = (cleanUrl && /\.(png|jpg|jpeg|webp)($|\?)/i.test(cleanUrl)) || (d.fileName && /\.(png|jpg|jpeg|webp)$/i.test(d.fileName));
        const normalizedPages = isImg ? 1 : (Number(d.totalPages) || (d.pages && d.pages.length ? d.pages.length : 1));
        return {
          ...d,
          _id: stringId,
          id: stringId,
          department: d.department || d.departmentName || '',
          copy_url: cleanUrl,
          fileUrl: cleanUrl,
          copyUrl: cleanUrl,
          totalPages: normalizedPages,
          universityId: univ.universityId,
          universityName: univ.name
        };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch students from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  // ==============================================================
  // 3. User Authentication & Profile Operations (Scoped to Tenant DB)
  // ==============================================================
  async getAllUsers(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];
    try {
      const users = await tenantDb.collection('users').find({}).toArray();
      return users.map(u => {
        const { _id, ...rest } = u;
        return { ...rest, universityId: univ.universityId, universityName: univ.name };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch users from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  async findUserByEmail(email, universityId) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const { db: tenantDb } = await this.getTenantDb(universityId);
    if (!tenantDb) return null;
    try {
      const user = await tenantDb.collection('users').findOne({ email: cleanEmail });
      if (user) {
        const { _id, ...rest } = user;
        return rest;
      }
    } catch (_) {}
    return null;
  }

  async authenticateUser(email, password, universityId) {
    if (!email) return { success: false, message: 'Email address is required.' };
    const cleanEmail = email.trim().toLowerCase();

    // 1. Resolve Target University
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) {
      return { success: false, message: 'University not found or database unavailable.' };
    }

    // 2. Query only inside that university's isolated database
    let user = null;
    try {
      user = await tenantDb.collection('users').findOne({ email: cleanEmail });
      if (!user) {
        user = await tenantDb.collection('teachers').findOne({ email: cleanEmail });
      }
    } catch (e) {
      console.warn(`[MongoDB Auth] ${univ.dbName}:`, e.message);
    }

    if (!user) {
      return { 
        success: false, 
        message: `Account "${cleanEmail}" does not exist in "${univ.name}". Access denied for this university.` 
      };
    }

    if (user.password !== password) {
      return { success: false, message: 'Invalid account password.' };
    }

    const { _id, ...cleanUser } = user;
    return {
      success: true,
      user: {
        ...cleanUser,
        universityId: univ.universityId,
        universityName: univ.name,
        universityCode: univ.code,
        dbName: univ.dbName
      }
    };
  }

  async insertUser(userData, universityId) {
    if (userData.role === 'teacher') {
      return this.insertTeacher(userData, universityId);
    }

    const { db: tenantDb, univ } = await this.getTenantDb(universityId || userData.universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanEmail = userData.email.trim().toLowerCase();
    const cleanUser = {
      ...userData,
      email: cleanEmail,
      universityId: univ.universityId,
      universityName: univ.name,
      createdAt: userData.createdAt || new Date().toISOString()
    };

    await tenantDb.collection('users').updateOne(
      { email: cleanEmail },
      { $set: cleanUser },
      { upsert: true }
    );
    return cleanUser;
  }

  async updateUserProfile(email, updates, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanEmail = email.trim().toLowerCase();
    const existing = await tenantDb.collection('users').findOne({ email: cleanEmail });
    if (!existing) {
      throw new Error(`User with email ${cleanEmail} not found in ${univ.name}.`);
    }

    const updatedUser = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    delete updatedUser._id;

    await tenantDb.collection('users').updateOne(
      { email: cleanEmail },
      { $set: updatedUser }
    );
    if (updatedUser.role === 'teacher') {
      await tenantDb.collection('teachers').updateOne(
        { email: cleanEmail },
        { $set: updatedUser }
      );
    }

    return updatedUser;
  }

  async deleteUser(emailOrId, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const key = (emailOrId || '').trim().toLowerCase();

    await tenantDb.collection('users').deleteOne({
      $or: [{ email: key }, { id: key }]
    });
    return { success: true, key };
  }

  // ==============================================================
  // 4. Allocation & Evaluation Operations (Scoped to Tenant Database)
  // ==============================================================
  async allocateStudents(studentIds, teacherEmail, teacherName, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const allocatedDate = new Date().toISOString();
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

    await tenantDb.collection('students').updateMany(filter, update);
    return {
      success: true,
      message: `Allocated ${studentIds.length} scripts in ${univ.name}.`
    };
  }

  async submitEvaluation(studentId, evaluationData, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');

    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    const currentStudent = await tenantDb.collection('students').findOne(filter);
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
      if (prevTeacherEmail) updateSet.previousTeacherEmail = prevTeacherEmail;
      if (prevTeacherName) updateSet.previousTeacherName = prevTeacherName;
    }

    const update = {
      $set: updateSet,
      $unset: { revaluation: "" }
    };

    await tenantDb.collection('students').updateOne(filter, update);
    return { success: true, message: `Evaluation recorded in ${univ.name}.` };
  }

  async flagRevaluation(studentId, { reason, teacherEmail }, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const revalData = {
      flaggedAt: new Date().toISOString(),
      flaggedBy: teacherEmail,
      reason: reason || 'Teacher flagged discrepancy with script questions.',
      resolved: false
    };

    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    await tenantDb.collection('students').updateOne(
      filter,
      { $set: { status: 'Sent for Revaluation', evaluationStatus: 'revaluation', inRevaluation: true, revaluation: revalData } }
    );

    return { success: true, message: `Answer sheet escalated for revaluation in ${univ.name}.` };
  }

  async resolveRevaluation(studentId, { action, adminRemarks, newTeacherEmail, newTeacherName }, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    let teacherName = newTeacherName;

    if (!teacherName && newTeacherEmail) {
      const dbT = await tenantDb.collection('teachers').findOne({ email: newTeacherEmail });
      if (dbT) teacherName = dbT.name;
    }
    if (!teacherName && newTeacherEmail) teacherName = newTeacherEmail;

    let filter = { id: studentId };
    if (typeof studentId === 'string' && ObjectId.isValid(studentId) && studentId.length === 24) {
      filter = { $or: [{ id: studentId }, { _id: new ObjectId(studentId) }, { enrollment: studentId }] };
    } else {
      filter = { $or: [{ id: studentId }, { enrollment: studentId }] };
    }

    const currentStudent = await tenantDb.collection('students').findOne(filter);
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
      if (prevTeacherEmail) updateFields.previousTeacherEmail = prevTeacherEmail;
      if (prevTeacherName) updateFields.previousTeacherName = prevTeacherName;
    } else {
      updateFields.status = 'Evaluated';
      updateFields.evaluationStatus = 'checked';
      updateFields.allocatedTeacherName = 'Administrator';
      updateFields.allocatedTeacher = 'Administrator';
      updateFields.assignedTeacher = 'Administrator';
      updateFields.evaluatedByAdmin = true;
      updateFields.checkedByAdmin = true;
      if (prevTeacherEmail) updateFields.previousTeacherEmail = prevTeacherEmail;
      if (prevTeacherName) updateFields.previousTeacherName = prevTeacherName;
    }

    await tenantDb.collection('students').updateOne(filter, { 
      $set: updateFields,
      $unset: { revaluation: "" }
    });

    return { success: true, message: `Revaluation case resolved in ${univ.name}.` };
  }

  // ==============================================================
  // 5. Answer References (Scoped to Tenant Database)
  // ==============================================================
  async getAllReferences(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];
    try {
      const refs = await tenantDb.collection('answer_references').find({}).toArray();
      return refs.map(r => {
        const { _id, ...rest } = r;
        return { ...rest, universityId: univ.universityId, universityName: univ.name };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch references from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  async insertReference(refData, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanRef = {
      id: refData.id || `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      subjectCode: refData.subjectCode.trim().toUpperCase(),
      subjectTitle: (refData.subjectTitle || refData.subjectName || refData.subjectCode || 'Course Material').trim(),
      department: (refData.department || 'Academic Department').trim(),
      examSession: refData.examSession || 'May-June 2026',
      fileName: refData.fileName || `${refData.subjectCode}_Model_Solution.pdf`,
      fileSize: refData.fileSize || '2.1 MB',
      uploadedAt: refData.uploadedAt || new Date().toISOString(),
      fileUrl: refData.fileUrl || refData.copy_url || null,
      copy_url: refData.copy_url || refData.fileUrl || null,
      cloudinaryPublicId: refData.cloudinaryPublicId || null,
      description: refData.description || 'Approved marking scheme and rubric.',
      universityId: univ.universityId,
      universityName: univ.name
    };

    await tenantDb.collection('answer_references').updateOne(
      { subjectCode: cleanRef.subjectCode },
      { $set: cleanRef },
      { upsert: true }
    );
    return cleanRef;
  }

  async deleteReference(subjectCode, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanCode = (subjectCode || '').trim().toUpperCase();
    await tenantDb.collection('answer_references').deleteOne({ subjectCode: cleanCode });
    return { success: true, subjectCode: cleanCode };
  }

  // ==============================================================
  // 6. Subjects Collection Operations (Scoped to Tenant Database)
  // ==============================================================
  async getAllSubjects(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];
    try {
      const list = await tenantDb.collection('subjects').find({}).toArray();
      return (list || []).map(s => {
        const { _id, ...rest } = s;
        return { ...rest, universityId: univ.universityId, universityName: univ.name };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch subjects from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  async insertSubject(subjectData, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanSubject = {
      code: subjectData.code.trim().toUpperCase(),
      title: subjectData.title.trim(),
      department: subjectData.department ? subjectData.department.trim() : 'Academic Department',
      universityId: univ.universityId,
      universityName: univ.name,
      createdAt: new Date().toISOString()
    };

    await tenantDb.collection('subjects').updateOne(
      { code: cleanSubject.code },
      { $set: cleanSubject },
      { upsert: true }
    );
    return cleanSubject;
  }

  async deleteSubject(subjectCode, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const cleanCode = subjectCode.trim().toUpperCase();
    await tenantDb.collection('subjects').deleteOne({ code: cleanCode });
    return { success: true, code: cleanCode };
  }

  // ==============================================================
  // 7. Academic Departments Operations (Scoped to Tenant Database)
  // ==============================================================
  async getAllDepartments(universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) return [];
    try {
      const list = await tenantDb.collection('departments').find({}).toArray();
      return (list || []).map(d => {
        const { _id, ...rest } = d;
        return { ...rest, universityId: univ.universityId, universityName: univ.name };
      });
    } catch (e) {
      console.error(`[MongoDB] Fetch departments from ${univ.dbName} failed:`, e.message);
      return [];
    }
  }

  async insertDepartment(deptData, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
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
      universityId: univ.universityId,
      universityName: univ.name,
      createdAt: deptData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await tenantDb.collection('departments').updateOne(
      { code: cleanDept.code },
      { $set: cleanDept },
      { upsert: true }
    );
    return cleanDept;
  }

  async deleteDepartment(deptCodeOrName, universityId) {
    const { db: tenantDb, univ } = await this.getTenantDb(universityId);
    if (!univ || !tenantDb) throw new Error('University database unavailable.');
    const key = (deptCodeOrName || '').trim();
    await tenantDb.collection('departments').deleteOne({
      $or: [{ code: key.toUpperCase() }, { name: key }, { id: key }]
    });
    return { success: true, key };
  }
}

module.exports = new MongoDBHandler();
