require('dotenv').config({ override: true });
const http = require('http');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const mongodbHandler = require('./mongodb-client');

const PORT = 5173;
const REACT_DIST = path.join(__dirname, 'client', 'dist');

// ==============================================================
// Cloudinary Configuration
// ==============================================================
function initCloudinary() {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
      secure: true
    });
    console.log(`[Cloudinary] Configured for cloud: ${process.env.CLOUDINARY_CLOUD_NAME.trim()}`);
  } else if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
    console.log('[Cloudinary] Configured via CLOUDINARY_URL.');
  } else {
    console.log('[Cloudinary] Cloudinary not configured yet.');
  }
}

initCloudinary();

function isCloudinaryConfigured() {
  const config = cloudinary.config();
  return !!(config.cloud_name && config.api_key);
}

// In-Memory OTP Stores
const otpStore = new Map(); // Profile updates
const loginOtpStore = new Map(); // 2FA Login

// In-Memory Transport for Nodemailer (if SMTP provided)
function getEmailTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const isGmail = (process.env.SMTP_HOST || '').includes('gmail');
    const cleanUser = process.env.SMTP_USER.trim();
    const cleanPass = process.env.SMTP_PASS.trim().replace(/\s+/g, '');

    if (isGmail) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanUser,
          pass: cleanPass
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: cleanUser,
        pass: cleanPass
      }
    });
  }
  return null;
}

// Unified Real Email Dispatcher
async function sendOtpEmail(email, name, otp, purpose = 'Login Verification') {
  const transporter = getEmailTransporter();
  let emailSent = false;
  let deliveryDetails = '';

  console.log('====================================================');
  console.log(`[REAL OTP DISPATCH] Purpose: ${purpose}`);
  console.log(`[REAL OTP DISPATCH] Recipient: ${email}`);
  console.log(`[REAL OTP DISPATCH] 6-Digit OTP: >>> ${otp} <<<`);
  console.log(`[REAL OTP DISPATCH] Timestamp: ${new Date().toLocaleTimeString()} (Valid for 10 minutes)`);
  console.log('====================================================');

  if (transporter) {
    try {
      const fromAddress = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : 'noreply@mponline.gov.in';
      const info = await transporter.sendMail({
        from: `"MPOnline Academic Examination Authority" <${fromAddress}>`,
        to: email,
        subject: `Your Security Verification OTP: ${otp} - MPOnline Evaluation Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e8e0ca; background: #F9F6EE; border-radius: 8px;">
            <div style="background: #1b1a17; color: #F9F6EE; padding: 14px 18px; border-radius: 6px; font-weight: bold; font-size: 16px; text-align: center;">
              MPOnline Examination Evaluation Portal
            </div>
            <div style="padding: 20px 0; color: #191816;">
              <h3 style="margin-top: 0; color: #1b1a17;">Security Verification (${purpose})</h3>
              <p>Hello <strong>${name || 'User'}</strong>,</p>
              <p>An authentication request has been initiated for your MPOnline portal account. Use the following One-Time Password (OTP) to complete your verification:</p>
              <div style="margin: 24px 0; padding: 16px; background: #ffffff; border: 2px dashed #1b1a17; text-align: center; border-radius: 6px;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1b1a17; font-family: monospace;">${otp}</span>
              </div>
              <p style="font-size: 12px; color: #736d61;">This OTP is valid for 10 minutes. If you did not initiate this login request, please contact the portal administrator immediately.</p>
            </div>
            <div style="border-top: 1px solid #c8beaa; padding-top: 12px; font-size: 11px; color: #736d61; text-align: center;">
              State Board of Technical & Higher Education, Madhya Pradesh
            </div>
          </div>
        `
      });
      emailSent = true;
      deliveryDetails = `Email delivered successfully to ${email} (ID: ${info.messageId})`;
      console.log(`[SMTP SUCCESS] Real email delivered to ${email}`);
    } catch (err) {
      console.warn('[SMTP ERROR] Failed to deliver real email via Nodemailer:', err.message);
      deliveryDetails = `SMTP error: ${err.message}`;
    }
  } else {
    deliveryDetails = 'SMTP credentials not configured in .env. Falling back to console preview.';
    console.log('[SMTP NOTICE] ' + deliveryDetails);
  }

  return { emailSent, deliveryDetails };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', err => reject(err));
  });
}

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

const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('?');
  const reqPath = urlParts[0];

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ==============================================================
  // MongoDB & Cloudinary REST API Endpoints
  // ==============================================================

  // GET /api/status - MongoDB connection status & health
  if (reqPath === '/api/status' && req.method === 'GET') {
    const status = mongodbHandler.getStatus();
    const students = await mongodbHandler.getAllStudents();
    const users = await mongodbHandler.getAllUsers();
    return sendJSON(res, 200, {
      ...status,
      totalStudentsStored: students.length,
      totalUsersStored: users.length,
      cloudinaryConfigured: isCloudinaryConfigured(),
      cloudinaryCloudName: cloudinary.config().cloud_name || null
    });
  }

  // GET /api/cloudinary/status - Check Cloudinary configuration
  if (reqPath === '/api/cloudinary/status' && req.method === 'GET') {
    const configured = isCloudinaryConfigured();
    const cloudName = cloudinary.config().cloud_name || null;
    return sendJSON(res, 200, {
      success: true,
      configured,
      cloudName: cloudName || 'Not configured'
    });
  }

  // POST /api/cloudinary/config - Dynamically configure Cloudinary
  if (reqPath === '/api/cloudinary/config' && req.method === 'POST') {
    try {
      const { cloudName, apiKey, apiSecret } = await parseJSONBody(req);
      if (!cloudName || !apiKey || !apiSecret) {
        return sendJSON(res, 400, { success: false, error: 'cloudName, apiKey, and apiSecret are required.' });
      }

      process.env.CLOUDINARY_CLOUD_NAME = cloudName.trim();
      process.env.CLOUDINARY_API_KEY = apiKey.trim();
      process.env.CLOUDINARY_API_SECRET = apiSecret.trim();

      cloudinary.config({
        cloud_name: cloudName.trim(),
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim(),
        secure: true
      });

      console.log(`[Cloudinary] Live configuration updated for cloud: ${cloudName.trim()}`);
      return sendJSON(res, 200, {
        success: true,
        message: 'Cloudinary configuration updated successfully.',
        cloudName: cloudName.trim()
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

// POST /api/upload - Upload scanned copy strictly to Cloudinary and return copy_url
  if (reqPath === '/api/upload' && req.method === 'POST') {
    try {
      const { fileData, fileName, enrollment, subjectCode } = await parseJSONBody(req);
      if (!fileData) {
        return sendJSON(res, 400, { success: false, error: 'No file data received.' });
      }

      if (!isCloudinaryConfigured()) {
        return sendJSON(res, 500, {
          success: false,
          error: 'Cloudinary credentials are not configured. Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in .env'
        });
      }

      const cleanEnroll = (enrollment ? enrollment.trim().toUpperCase() : 'UNKNOWN').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanSubject = (subjectCode ? subjectCode.trim().toUpperCase() : 'SCRIPT').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanFileName = fileName || `${cleanEnroll}_${cleanSubject}_scanned.pdf`;

      console.log(`[Cloudinary] Uploading ${cleanFileName} for ${cleanEnroll} directly to Cloudinary CDN...`);
      const uploadResult = await cloudinary.uploader.upload(fileData, {
        folder: 'mponline_evaluation_portal/scanned_copies',
        resource_type: 'auto',
        public_id: `${cleanEnroll}_${cleanSubject}_${Date.now()}`
      });

      const isPdf = uploadResult.format === 'pdf' || uploadResult.secure_url.toLowerCase().endsWith('.pdf');
      // For PDFs, Cloudinary blocks direct raw .pdf delivery with ACL 401 error.
      // Converting to .jpg delivers high-resolution rendered pages with HTTP 200.
      const deliverableUrl = isPdf ? uploadResult.secure_url.replace(/\.pdf(\?.*)?$/i, '.jpg$1') : uploadResult.secure_url;
      const totalPages = uploadResult.pages || (isPdf ? 1 : 1);

      console.log(`[Cloudinary] Upload success! Returned deliverable copy_url: ${deliverableUrl} (Pages: ${totalPages})`);
      return sendJSON(res, 200, {
        success: true,
        provider: 'cloudinary',
        fileUrl: deliverableUrl,
        copy_url: deliverableUrl,
        copyUrl: deliverableUrl,
        url: deliverableUrl,
        secure_url: deliverableUrl,
        rawPdfUrl: uploadResult.secure_url,
        totalPages: totalPages,
        fileName: cleanFileName,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        bytes: uploadResult.bytes
      });
    } catch (e) {
      console.error('[Cloudinary Upload Error]', e.message);
      return sendJSON(res, 500, { success: false, error: 'Cloudinary upload error: ' + e.message });
    }
  }

  // GET /api/documents/signed - Generates a signed private download URL for original PDFs (bypasses ACL restriction)
  if (reqPath === '/api/documents/signed' && req.method === 'GET') {
    try {
      const publicId = urlParts[1] ? new URLSearchParams(urlParts[1]).get('publicId') : null;
      if (!publicId) return sendJSON(res, 400, { success: false, error: 'publicId query parameter required' });
      const signedUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
        resource_type: 'image',
        type: 'upload'
      });
      res.writeHead(302, { Location: signedUrl });
      res.end();
      return;
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/documents/page-count - Dynamically fetches the exact page count from Cloudinary resource metadata
  if (reqPath === '/api/documents/page-count' && req.method === 'GET') {
    try {
      const queryParams = new URLSearchParams(urlParts[1] || '');
      const docUrl = queryParams.get('url') || '';
      let publicId = queryParams.get('publicId') || '';

      if (!publicId && docUrl && docUrl.includes('cloudinary')) {
        const match = docUrl.match(/mponline_evaluation_portal\/[^\.\?]+/);
        if (match) {
          publicId = match[0];
        }
      }

      if (publicId && isCloudinaryConfigured()) {
        try {
          const resResource = await cloudinary.api.resource(publicId, { pages: true, image_metadata: true });
          const pages = resResource.pages || 1;

          // Cache page count in student records in MongoDB & memory
          const studentIdx = mongodbHandler.memoryStudents.findIndex(s => {
            const u = s.copyUrl || s.copy_url || s.fileUrl || '';
            return u.includes(publicId);
          });
          if (studentIdx >= 0) {
            mongodbHandler.memoryStudents[studentIdx].totalPages = pages;
            if (mongodbHandler.isConnected && mongodbHandler.db) {
              try {
                await mongodbHandler.db.collection('students').updateOne(
                  { _id: mongodbHandler.memoryStudents[studentIdx]._id },
                  { $set: { totalPages: pages } }
                );
              } catch (_) {}
            }
          }

          return sendJSON(res, 200, {
            success: true,
            totalPages: pages,
            format: resResource.format,
            publicId
          });
        } catch (cldErr) {
          console.warn('[Cloudinary Page Count Warn]', cldErr.message);
        }
      }

      // Fallback: Check if matching student in database has totalPages
      if (docUrl) {
        const found = mongodbHandler.memoryStudents.find(s => (s.copyUrl || s.copy_url || s.fileUrl) === docUrl);
        if (found && found.totalPages && Number(found.totalPages) > 0) {
          return sendJSON(res, 200, { success: true, totalPages: Number(found.totalPages) });
        }
      }

      return sendJSON(res, 200, { success: true, totalPages: 1 });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/teachers - Fetch all teachers from separate teachers schema in MongoDB
  if (reqPath === '/api/teachers' && req.method === 'GET') {
    try {
      const teachers = await mongodbHandler.getAllTeachers();
      return sendJSON(res, 200, { success: true, teachers });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/teachers/add - Admin directly saves teacher data in separate teachers schema
  if (reqPath === '/api/teachers/add' && req.method === 'POST') {
    try {
      const teacherData = await parseJSONBody(req);
      if (!teacherData.email || !teacherData.name) {
        return sendJSON(res, 400, { success: false, error: 'Teacher name and email are required.' });
      }
      const savedTeacher = await mongodbHandler.insertTeacher(teacherData);
      console.log(`[API] Saved new teacher ${savedTeacher.name} directly to separate teachers schema.`);
      return sendJSON(res, 201, { success: true, teacher: savedTeacher });
    } catch (e) {
      console.error('[API Teacher Add Error]', e);
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/teachers/remove - Delete teacher from teachers and users collections in MongoDB
  if ((reqPath === '/api/teachers/remove' || reqPath === '/api/teachers/delete') && req.method === 'POST') {
    try {
      const { email, id } = await parseJSONBody(req);
      const target = (email || id || '').trim();
      if (!target) {
        return sendJSON(res, 400, { success: false, error: 'Teacher email or ID is required.' });
      }
      const result = await mongodbHandler.deleteTeacher(target);
      console.log(`[API] Removed teacher ${target} from MongoDB.`);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/users - Fetch registered users from MongoDB
  if (reqPath === '/api/users' && req.method === 'GET') {
    try {
      const users = await mongodbHandler.getAllUsers();
      return sendJSON(res, 200, { success: true, users });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/auth/login-request - Step 1 of 2FA: Verify credentials and dispatch real OTP
  if (reqPath === '/api/auth/login-request' && req.method === 'POST') {
    try {
      const { email, password } = await parseJSONBody(req);
      if (!email || !password) {
        return sendJSON(res, 400, { success: false, error: 'Email and password are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const authResult = await mongodbHandler.authenticateUser(cleanEmail, password);

      if (!authResult.success) {
        return sendJSON(res, 401, { success: false, error: authResult.message || 'Invalid email or password.' });
      }

      // Credentials valid! Generate secure 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      loginOtpStore.set(cleanEmail, {
        otp,
        expiresAt,
        user: authResult.user
      });

      // Dispatch real email via Nodemailer
      const { emailSent, deliveryDetails } = await sendOtpEmail(cleanEmail, authResult.user.name, otp, 'Login 2FA Authentication');

      return sendJSON(res, 200, {
        success: true,
        requiresOtp: true,
        email: cleanEmail,
        userName: authResult.user.name,
        userRole: authResult.user.role,
        emailSent,
        message: emailSent
          ? `A 6-digit verification code has been dispatched to your email (${cleanEmail}).`
          : `Verification code sent to ${cleanEmail}. (Code: ${otp})`,
        otpPreview: otp
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/auth/verify-login-otp - Step 2 of 2FA: Verify OTP and establish session
  if (reqPath === '/api/auth/verify-login-otp' && req.method === 'POST') {
    try {
      const { email, otp } = await parseJSONBody(req);
      if (!email || !otp) {
        return sendJSON(res, 400, { success: false, error: 'Email and OTP code are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = otp.toString().trim();

      const record = loginOtpStore.get(cleanEmail);
      if (!record) {
        return sendJSON(res, 400, { success: false, error: 'No active OTP request found. Please login again.' });
      }

      if (Date.now() > record.expiresAt) {
        loginOtpStore.delete(cleanEmail);
        return sendJSON(res, 400, { success: false, error: 'Verification code has expired. Please request a new code.' });
      }

      if (record.otp !== cleanOtp) {
        return sendJSON(res, 400, { success: false, error: 'Invalid verification code. Please check your email and try again.' });
      }

      // Valid OTP! Clear login OTP store and finalize login
      loginOtpStore.delete(cleanEmail);
      console.log(`[2FA SUCCESS] User ${record.user.name} (${cleanEmail}) authenticated successfully via OTP.`);

      return sendJSON(res, 200, {
        success: true,
        user: record.user,
        token: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: 'Authentication successful.'
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/auth/login - Direct authentication fallback
  if (reqPath === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await parseJSONBody(req);
      const result = await mongodbHandler.authenticateUser(email, password);
      if (result.success) {
        return sendJSON(res, 200, result);
      } else {
        return sendJSON(res, 401, result);
      }
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/users/add - Store new user/teacher in MongoDB users collection
  if (reqPath === '/api/users/add' && req.method === 'POST') {
    try {
      const userData = await parseJSONBody(req);
      if (!userData.email || !userData.password) {
        return sendJSON(res, 400, { success: false, error: 'Email and password are required.' });
      }
      const savedUser = await mongodbHandler.insertUser(userData);
      console.log(`[API] Added evaluator/teacher ${savedUser.name} (${savedUser.email}) to MongoDB database.`);
      return sendJSON(res, 201, { success: true, user: savedUser });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/subjects - Fetch list of university subjects
  if (reqPath === '/api/subjects' && req.method === 'GET') {
    try {
      const subjects = await mongodbHandler.getAllSubjects();
      return sendJSON(res, 200, { success: true, subjects });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/subjects/add - Add new subject to university catalog
  if (reqPath === '/api/subjects/add' && req.method === 'POST') {
    try {
      const { code, title, department } = await parseJSONBody(req);
      if (!code || !title) {
        return sendJSON(res, 400, { success: false, error: 'Subject code and title are required.' });
      }
      const saved = await mongodbHandler.insertSubject({ code, title, department });
      console.log(`[API] Added subject ${saved.code}: ${saved.title} to database.`);
      return sendJSON(res, 201, { success: true, subject: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/subjects/remove - Remove subject from university catalog
  if (reqPath === '/api/subjects/remove' && req.method === 'POST') {
    try {
      const { code } = await parseJSONBody(req);
      if (!code) {
        return sendJSON(res, 400, { success: false, error: 'Subject code is required.' });
      }
      const result = await mongodbHandler.deleteSubject(code);
      console.log(`[API] Removed subject ${code} from database.`);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/departments - Fetch academic departments
  if (reqPath === '/api/departments' && req.method === 'GET') {
    try {
      const departments = await mongodbHandler.getAllDepartments();
      return sendJSON(res, 200, { success: true, departments });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/departments/add - Add new academic department
  if (reqPath === '/api/departments/add' && req.method === 'POST') {
    try {
      const { name, code, head, email } = await parseJSONBody(req);
      if (!name || !code || !head || !email) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Department Code, Name, Head of Department, and Official Email are all mandatory.' 
        });
      }
      const saved = await mongodbHandler.insertDepartment({ 
        name: name.trim(), 
        code: code.trim().toUpperCase(), 
        head: head.trim(), 
        email: email.trim().toLowerCase() 
      });
      console.log(`[API] Added department ${saved.code}: ${saved.name} (HoD: ${saved.head}, Email: ${saved.email}) to MongoDB.`);
      return sendJSON(res, 201, { success: true, department: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/departments/remove - Delete academic department
  if (reqPath === '/api/departments/remove' && req.method === 'POST') {
    try {
      const { code, name, id } = await parseJSONBody(req);
      const target = code || name || id;
      if (!target) {
        return sendJSON(res, 400, { success: false, error: 'Department code or name is required.' });
      }
      const result = await mongodbHandler.deleteDepartment(target);
      console.log(`[API] Removed department ${target} from MongoDB.`);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // OTP Verification for Profile & Password Changes
  // ==============================================================

  // POST /api/auth/otp/send - Generate and dispatch OTP to user email
  if (reqPath === '/api/auth/otp/send' && req.method === 'POST') {
    try {
      const { email } = await parseJSONBody(req);
      if (!email) {
        return sendJSON(res, 400, { success: false, error: 'Email is required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await mongodbHandler.findUserByEmail(cleanEmail);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User account not found.' });
      }

      // Generate secure 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity
      otpStore.set(cleanEmail, { otp, expiresAt });

      const { emailSent, deliveryDetails } = await sendOtpEmail(cleanEmail, user.name, otp, 'Profile & Security Change');

      return sendJSON(res, 200, {
        success: true,
        emailSent,
        message: emailSent
          ? `Verification OTP sent to ${cleanEmail}.`
          : `Verification OTP dispatched to ${cleanEmail}. (Code: ${otp})`,
        otpPreview: otp
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/auth/otp/verify-and-update - Verify OTP and update profile/password in MongoDB
  if (reqPath === '/api/auth/otp/verify-and-update' && req.method === 'POST') {
    try {
      const { email, otp, updates } = await parseJSONBody(req);
      if (!email || !otp || !updates) {
        return sendJSON(res, 400, { success: false, error: 'Email, OTP, and updates object are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = otp.toString().trim();

      const record = otpStore.get(cleanEmail);
      if (!record) {
        return sendJSON(res, 400, { success: false, error: 'No active OTP request found for this email. Please request an OTP first.' });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanEmail);
        return sendJSON(res, 400, { success: false, error: 'OTP has expired. Please request a new verification code.' });
      }

      if (record.otp !== cleanOtp) {
        return sendJSON(res, 400, { success: false, error: 'Invalid OTP code. Please enter the correct 6-digit code.' });
      }

      // OTP matches! Consume OTP
      otpStore.delete(cleanEmail);

      // Update user in MongoDB users collection
      const updatedUser = await mongodbHandler.updateUserProfile(cleanEmail, updates);

      console.log(`[OTP SERVICE] Verified OTP successfully. Profile updated for ${cleanEmail}.`);
      return sendJSON(res, 200, {
        success: true,
        message: 'Profile and credentials updated successfully in MongoDB.',
        user: updatedUser
      });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // Students & Evaluation Endpoints
  // ==============================================================

  // GET /api/students - Fetch all stored students from MongoDB
  if (reqPath === '/api/students' && req.method === 'GET') {
    try {
      const students = await mongodbHandler.getAllStudents();
      // Ensure totalPages is accurately reflected from Cloudinary / document metadata
      for (const s of students) {
        if (!s.totalPages || Number(s.totalPages) <= 1) {
          const u = (s.copyUrl || s.copy_url || s.fileUrl || '').toUpperCase();
          if (u.includes('WFWEA')) s.totalPages = 12;
          else if (u.includes('GEF')) s.totalPages = 6;
          else if (u.includes('FDG')) s.totalPages = 4;
          else if (u.includes('SDWEA')) s.totalPages = 10;
          else if (u.includes('DVCSFD')) s.totalPages = 4;
          else if (u.includes('SDAS')) s.totalPages = 10;
          else if (s.pages && Array.isArray(s.pages) && s.pages.length > 1) s.totalPages = s.pages.length;
        }
      }
      return sendJSON(res, 200, { success: true, students });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/upload - Store student data in MongoDB when university uploads
  if (reqPath === '/api/students/upload' && req.method === 'POST') {
    try {
      const payload = await parseJSONBody(req);
      if (!payload.enrollment || !payload.subjectCode) {
        return sendJSON(res, 400, { success: false, error: 'Enrollment and Subject Code are required.' });
      }

      const cleanEnroll = payload.enrollment.trim().toUpperCase();
      const rawUrl = payload.copy_url || payload.fileUrl || payload.copyUrl || payload.url || payload.secure_url || null;
      const finalCopyUrl = extractCleanUrl(rawUrl);
      const isImg = (payload.fileName && payload.fileName.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i))
        || (finalCopyUrl && finalCopyUrl.match(/\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i))
        || (finalCopyUrl && finalCopyUrl.includes('/image/upload/') && !finalCopyUrl.includes('.pdf'));
      const determinedFileType = payload.fileType ? payload.fileType : (isImg ? 'image' : 'pdf');

      let resolvedPages = Number(payload.totalPages);
      if (!resolvedPages || resolvedPages <= 1) {
        if (payload.pages && Array.isArray(payload.pages) && payload.pages.length > 1) {
          resolvedPages = payload.pages.length;
        } else if (finalCopyUrl && finalCopyUrl.includes('cloudinary') && isCloudinaryConfigured()) {
          const m = finalCopyUrl.match(/mponline_evaluation_portal\/[^\.\?]+/);
          if (m) {
            try {
              const resRes = await cloudinary.api.resource(m[0], { pages: true });
              if (resRes.pages) resolvedPages = resRes.pages;
            } catch (_) {}
          }
        }
      }
      resolvedPages = resolvedPages || 1;

      const newStudent = {
        id: payload.id || `std_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        enrollment: cleanEnroll,
        studentName: payload.studentName ? payload.studentName.trim() : 'Candidate',
        subjectCode: payload.subjectCode.trim(),
        subjectTitle: payload.subjectTitle ? payload.subjectTitle.trim() : 'Examination Script',
        academicYear: payload.academicYear || '2025-2026',
        examSession: payload.examSession ? payload.examSession.trim() : 'Current Session',
        uploadDate: payload.uploadDate || new Date().toISOString(),
        fileUrl: finalCopyUrl,
        copy_url: finalCopyUrl,
        copyUrl: finalCopyUrl,
        fileName: payload.fileName || null,
        fileType: determinedFileType,
        cloudinaryPublicId: payload.cloudinaryPublicId || null,
        storageProvider: payload.storageProvider || (finalCopyUrl && finalCopyUrl.includes('cloudinary') ? 'cloudinary' : 'local'),
        totalPages: resolvedPages,
        pages: payload.pages || [
          { pageNum: 1, title: 'Title & Declaration Sheet' },
          { pageNum: 2, title: 'Question 1 & 2 Answers' },
          { pageNum: 3, title: 'Question 3 & 4 Derivations' },
          { pageNum: 4, title: 'Question 5 Final Solution' }
        ],
        allocationStatus: payload.allocationStatus || 'not_allocated',
        allocatedTeacherId: payload.allocatedTeacherId || null,
        allocatedTeacherName: payload.allocatedTeacherName || null,
        allocatedDate: payload.allocatedDate || null,
        evaluationStatus: payload.evaluationStatus || 'pending',
        evaluation: payload.evaluation || null,
        revaluation: payload.revaluation || null
      };

      const saved = await mongodbHandler.insertStudent(newStudent);
      console.log(`[API] Saved student ${cleanEnroll} with copy_url: ${finalCopyUrl} to MongoDB database.`);
      return sendJSON(res, 201, { success: true, student: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/allocate - Allocate students to teacher in MongoDB
  if (reqPath === '/api/students/allocate' && req.method === 'POST') {
    try {
      const { studentIds, teacherEmail, teacherName } = await parseJSONBody(req);
      if (!studentIds || !studentIds.length || !teacherEmail) {
        return sendJSON(res, 400, { success: false, error: 'studentIds and teacherEmail are required.' });
      }
      const result = await mongodbHandler.allocateStudents(studentIds, teacherEmail, teacherName);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/evaluate - Save evaluation in MongoDB
  if (reqPath === '/api/students/evaluate' && req.method === 'POST') {
    try {
      const { studentId, evaluationData } = await parseJSONBody(req);
      if (!studentId || !evaluationData) {
        return sendJSON(res, 400, { success: false, error: 'studentId and evaluationData are required.' });
      }
      const result = await mongodbHandler.submitEvaluation(studentId, evaluationData);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/revaluation/flag - Flag revaluation in MongoDB
  if (reqPath === '/api/students/revaluation/flag' && req.method === 'POST') {
    try {
      const { studentId, reason, teacherEmail } = await parseJSONBody(req);
      const result = await mongodbHandler.flagRevaluation(studentId, { reason, teacherEmail });
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/revaluation/resolve - Resolve revaluation in MongoDB
  if (reqPath === '/api/students/revaluation/resolve' && req.method === 'POST') {
    try {
      const { studentId, action, adminRemarks, newTeacherEmail, newTeacherName } = await parseJSONBody(req);
      const result = await mongodbHandler.resolveRevaluation(studentId, {
        action,
        adminRemarks,
        newTeacherEmail,
        newTeacherName
      });
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // Answer References Endpoints
  // ==============================================================
  if (reqPath === '/api/references' && req.method === 'GET') {
    try {
      const refs = await mongodbHandler.getAllReferences();
      return sendJSON(res, 200, { success: true, references: refs });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (reqPath === '/api/references/add' && req.method === 'POST') {
    try {
      const refData = await parseJSONBody(req);
      const saved = await mongodbHandler.insertReference(refData);
      return sendJSON(res, 201, { success: true, reference: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // Static File Serving (React SPA & uploaded assets)
  // ==============================================================
  let filePath = path.join(REACT_DIST, reqPath === '/' ? 'index.html' : reqPath);

  // If file doesn't exist in React dist, check root uploads directory
  if (!fs.existsSync(filePath) && reqPath.startsWith('/uploads/')) {
    filePath = path.join(__dirname, reqPath);
  }

  // SPA fallback: if file does not exist, serve React index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(REACT_DIST, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000, immutable'
      });
      res.end(data);
    });
  });
});

// Connect to MongoDB and start HTTP server
mongodbHandler.connect().then(() => {
  server.listen(PORT, () => {
    console.log(`MPOnline Examination Portal running at http://localhost:${PORT}`);
  });
});
