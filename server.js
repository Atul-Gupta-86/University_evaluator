require('dotenv').config({ override: true });
const http = require('http');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const mongodbHandler = require('./mongodb-client');

const PORT = process.env.PORT || 3000;
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
    'Access-Control-Allow-Headers': 'Content-Type, X-University-Id'
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

// Multi-Tenant University Extractor
function getRequestUniversityId(req, urlParams = null, body = null) {
  return (
    req.headers['x-university-id'] ||
    (urlParams && urlParams.get('universityId')) ||
    (body && body.universityId) ||
    null
  );
}

const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('?');
  const reqPath = urlParts[0];
  const queryParams = urlParts[1] ? new URLSearchParams(urlParts[1]) : null;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-University-Id'
    });
    res.end();
    return;
  }

  // ==============================================================
  // Multi-Tenant Universities Central Endpoints
  // ==============================================================

  // GET /api/universities - Fetch all registered universities
  if (reqPath === '/api/universities' && req.method === 'GET') {
    try {
      const universities = await mongodbHandler.getAllUniversities();
      return sendJSON(res, 200, { success: true, universities });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/universities/register - Only universities can register!
  // Creates dedicated isolated tenant database on the MongoDB Atlas cluster
  if (reqPath === '/api/universities/register' && req.method === 'POST') {
    try {
      const data = await parseJSONBody(req);
      const result = await mongodbHandler.registerUniversity(data);
      return sendJSON(res, 201, result);
    } catch (e) {
      return sendJSON(res, 400, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // MongoDB & Cloudinary REST API Endpoints
  // ==============================================================

  // GET /api/status - MongoDB connection status & health
  if (reqPath === '/api/status' && req.method === 'GET') {
    const universityId = getRequestUniversityId(req, queryParams);
    const status = mongodbHandler.getStatus();
    const students = await mongodbHandler.getAllStudents(universityId);
    const users = await mongodbHandler.getAllUsers(universityId);
    const universities = await mongodbHandler.getAllUniversities();
    return sendJSON(res, 200, {
      ...status,
      activeUniversityId: universityId || (universities[0] ? universities[0].universityId : null),
      totalUniversitiesRegistered: universities.length,
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
        public_id: `${cleanEnroll}_${cleanSubject}_${Date.now()}`,
        pages: true,
        image_metadata: true
      });

      const isPdf = uploadResult.format === 'pdf' || uploadResult.secure_url.toLowerCase().endsWith('.pdf');
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
      const publicId = queryParams ? queryParams.get('publicId') : null;
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
      const docUrl = queryParams ? (queryParams.get('url') || '') : '';
      let publicId = queryParams ? (queryParams.get('publicId') || '') : '';

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

      return sendJSON(res, 200, { success: true, totalPages: 1 });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/teachers - Fetch teachers from isolated tenant database
  if (reqPath === '/api/teachers' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const teachers = await mongodbHandler.getAllTeachers(universityId);
      return sendJSON(res, 200, { success: true, teachers });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/teachers/add - Add teacher to isolated tenant database
  if (reqPath === '/api/teachers/add' && req.method === 'POST') {
    try {
      const teacherData = await parseJSONBody(req);
      if (!teacherData.email || !teacherData.name) {
        return sendJSON(res, 400, { success: false, error: 'Teacher name and email are required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, teacherData);
      const savedTeacher = await mongodbHandler.insertTeacher(teacherData, universityId);
      return sendJSON(res, 201, { success: true, teacher: savedTeacher });
    } catch (e) {
      console.error('[API Teacher Add Error]', e);
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/teachers/remove - Delete teacher from isolated tenant database
  if ((reqPath === '/api/teachers/remove' || reqPath === '/api/teachers/delete') && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const target = (body.email || body.id || '').trim();
      if (!target) {
        return sendJSON(res, 400, { success: false, error: 'Teacher email or ID is required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.deleteTeacher(target, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }


  // POST /api/auth/login-request - Step 1 of 2FA: Verify credentials inside tenant DB and dispatch OTP
  if (reqPath === '/api/auth/login-request' && req.method === 'POST') {
    try {
      const { email, password, universityId: bodyUnivId } = await parseJSONBody(req);
      if (!email || !password) {
        return sendJSON(res, 400, { success: false, error: 'Email and password are required.' });
      }

      const universityId = bodyUnivId || req.headers['x-university-id'] || null;
      const cleanEmail = email.trim().toLowerCase();
      const authResult = await mongodbHandler.authenticateUser(cleanEmail, password, universityId);

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
        universityId: authResult.user.universityId,
        universityName: authResult.user.universityName,
        universityCode: authResult.user.universityCode,
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

      loginOtpStore.delete(cleanEmail);
      console.log(`[2FA SUCCESS] User ${record.user.name} authenticated into "${record.user.universityName}".`);

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

  // POST /api/auth/login - Direct authentication fallback (passes universityId)
  if (reqPath === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password, universityId: bodyUnivId } = await parseJSONBody(req);
      const universityId = bodyUnivId || req.headers['x-university-id'] || null;
      const result = await mongodbHandler.authenticateUser(email, password, universityId);
      if (result.success) {
        return sendJSON(res, 200, result);
      } else {
        return sendJSON(res, 401, result);
      }
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/users - Fetch users from tenant DB (optionally filter by role)
  if (reqPath === '/api/users' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const roleFilter = queryParams?.get('role');
      let users = await mongodbHandler.getAllUsers(universityId);
      if (roleFilter) {
        users = users.filter(u => (u.role || '').toLowerCase() === roleFilter.trim().toLowerCase());
      }
      return sendJSON(res, 200, { success: true, users });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/users/add - Store new user in tenant DB
  if (reqPath === '/api/users/add' && req.method === 'POST') {
    try {
      const userData = await parseJSONBody(req);
      if (!userData.email || !userData.password) {
        return sendJSON(res, 400, { success: false, error: 'Email and password are mandatory fields.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, userData);
      const cleanData = {
        ...userData,
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        role: userData.role || 'user',
        name: (userData.name || '').trim(),
        department: (userData.department || '').trim()
      };
      const savedUser = await mongodbHandler.insertUser(cleanData, universityId);
      return sendJSON(res, 201, { success: true, user: savedUser });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/users/remove - Remove user from tenant DB
  if (reqPath === '/api/users/remove' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const target = body.email || body.id;
      if (!target) {
        return sendJSON(res, 400, { success: false, error: 'User email or ID is required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.deleteUser(target, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/subjects - Fetch list of university subjects from tenant DB
  if (reqPath === '/api/subjects' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const subjects = await mongodbHandler.getAllSubjects(universityId);
      return sendJSON(res, 200, { success: true, subjects });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/subjects/add - Add new subject to tenant DB
  if (reqPath === '/api/subjects/add' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { code, title, department } = body;
      if (!code || !title) {
        return sendJSON(res, 400, { success: false, error: 'Subject code and title are required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const saved = await mongodbHandler.insertSubject({ code, title, department }, universityId);
      return sendJSON(res, 201, { success: true, subject: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/subjects/remove - Remove subject from tenant DB
  if (reqPath === '/api/subjects/remove' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { code } = body;
      if (!code) {
        return sendJSON(res, 400, { success: false, error: 'Subject code is required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.deleteSubject(code, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // GET /api/departments - Fetch academic departments from tenant DB
  if (reqPath === '/api/departments' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const departments = await mongodbHandler.getAllDepartments(universityId);
      return sendJSON(res, 200, { success: true, departments });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/departments/add - Add new academic department in tenant DB
  if (reqPath === '/api/departments/add' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { name, code, head, email } = body;
      if (!name || !code) {
        return sendJSON(res, 400, { 
          success: false, 
          error: 'Department Code and Name are mandatory.' 
        });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const saved = await mongodbHandler.insertDepartment({ 
        name: name.trim(), 
        code: code.trim().toUpperCase(), 
        head: (head || '').trim(), 
        email: (email || '').trim().toLowerCase() 
      }, universityId);
      return sendJSON(res, 201, { success: true, department: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/departments/remove - Delete academic department from tenant DB
  if (reqPath === '/api/departments/remove' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { code, name, id } = body;
      const target = code || name || id;
      if (!target) {
        return sendJSON(res, 400, { success: false, error: 'Department code or name is required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.deleteDepartment(target, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/auth/otp/send - Generate and dispatch OTP to user email
  if (reqPath === '/api/auth/otp/send' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { email } = body;
      if (!email) {
        return sendJSON(res, 400, { success: false, error: 'Email is required.' });
      }

      const universityId = getRequestUniversityId(req, queryParams, body);
      const cleanEmail = email.trim().toLowerCase();
      const user = await mongodbHandler.findUserByEmail(cleanEmail, universityId);
      if (!user) {
        return sendJSON(res, 404, { success: false, error: 'User account not found.' });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;
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

  // POST /api/auth/otp/verify-and-update - Verify OTP and update profile/password in tenant DB
  if (reqPath === '/api/auth/otp/verify-and-update' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { email, otp, updates } = body;
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

      otpStore.delete(cleanEmail);
      const universityId = getRequestUniversityId(req, queryParams, body);
      const updatedUser = await mongodbHandler.updateUserProfile(cleanEmail, updates, universityId);

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
  // Students & Evaluation Endpoints (Scoped to Tenant Database)
  // ==============================================================

  // GET /api/students - Fetch stored students from tenant DB
  if (reqPath === '/api/students' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const students = await mongodbHandler.getAllStudents(universityId);

      // Dynamically resolve and guarantee department for all students
      const subjects = await mongodbHandler.getAllSubjects(universityId);
      const subjectDeptMap = new Map();
      for (const sub of subjects) {
        if (sub.department) {
          if (sub.code) subjectDeptMap.set(sub.code.trim().toUpperCase(), sub.department);
          if (sub.title) subjectDeptMap.set(sub.title.trim().toUpperCase(), sub.department);
        }
      }

      for (const s of students) {
        if (!s.department || !s.department.trim()) {
          const codeKey = (s.subjectCode || '').trim().toUpperCase();
          const titleKey = (s.subjectTitle || s.subject || '').trim().toUpperCase();
          s.department = subjectDeptMap.get(codeKey) || subjectDeptMap.get(titleKey) || 'Academic';
        }
        if (!s.totalPages || Number(s.totalPages) <= 0) {
          if (s.pages && Array.isArray(s.pages) && s.pages.length > 0) {
            s.totalPages = s.pages.length;
          } else {
            s.totalPages = 1;
          }
        }
      }
      return sendJSON(res, 200, { success: true, students });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/upload - Store student data in tenant DB
  if (reqPath === '/api/students/upload' && req.method === 'POST') {
    try {
      const payload = await parseJSONBody(req);
      if (!payload.enrollment || !payload.subjectCode) {
        return sendJSON(res, 400, { success: false, error: 'Enrollment and Subject Code are required.' });
      }

      const universityId = getRequestUniversityId(req, queryParams, payload);
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

      let dept = payload.department ? payload.department.trim() : null;
      if (!dept && payload.subjectCode) {
        const subjects = await mongodbHandler.getAllSubjects(universityId);
        const codeUpper = payload.subjectCode.trim().toUpperCase();
        const match = subjects.find(sub => (sub.code && sub.code.trim().toUpperCase() === codeUpper) || (sub.title && sub.title.trim() === payload.subjectTitle));
        if (match && match.department) dept = match.department;
      }
      dept = dept || 'Academic';

      const newStudent = {
        id: payload.id || `std_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        enrollment: cleanEnroll,
        studentName: payload.studentName ? payload.studentName.trim() : 'Candidate',
        department: dept,
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

      const saved = await mongodbHandler.insertStudent(newStudent, universityId);
      console.log(`[API] Saved student ${cleanEnroll} in university database "${saved.universityName || universityId}".`);
      return sendJSON(res, 201, { success: true, student: saved });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/allocate - Allocate students to teacher in tenant DB
  if (reqPath === '/api/students/allocate' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { studentIds, teacherEmail, teacherName } = body;
      if (!studentIds || !studentIds.length || !teacherEmail) {
        return sendJSON(res, 400, { success: false, error: 'studentIds and teacherEmail are required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.allocateStudents(studentIds, teacherEmail, teacherName, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/evaluate - Save evaluation in tenant DB
  if (reqPath === '/api/students/evaluate' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { studentId, evaluationData } = body;
      if (!studentId || !evaluationData) {
        return sendJSON(res, 400, { success: false, error: 'studentId and evaluationData are required.' });
      }
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.submitEvaluation(studentId, evaluationData, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/revaluation/flag - Flag revaluation in tenant DB
  if (reqPath === '/api/students/revaluation/flag' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { studentId, reason, teacherEmail } = body;
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.flagRevaluation(studentId, { reason, teacherEmail }, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // POST /api/students/revaluation/resolve - Resolve revaluation in tenant DB
  if (reqPath === '/api/students/revaluation/resolve' && req.method === 'POST') {
    try {
      const body = await parseJSONBody(req);
      const { studentId, action, adminRemarks, newTeacherEmail, newTeacherName } = body;
      const universityId = getRequestUniversityId(req, queryParams, body);
      const result = await mongodbHandler.resolveRevaluation(studentId, {
        action,
        adminRemarks,
        newTeacherEmail,
        newTeacherName
      }, universityId);
      return sendJSON(res, 200, result);
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  // ==============================================================
  // Answer References Endpoints (Scoped to Tenant Database)
  // ==============================================================
  if (reqPath === '/api/references' && req.method === 'GET') {
    try {
      const universityId = getRequestUniversityId(req, queryParams);
      const refs = await mongodbHandler.getAllReferences(universityId);
      return sendJSON(res, 200, { success: true, references: refs });
    } catch (e) {
      return sendJSON(res, 500, { success: false, error: e.message });
    }
  }

  if (reqPath === '/api/references/add' && req.method === 'POST') {
    try {
      const refData = await parseJSONBody(req);
      const universityId = getRequestUniversityId(req, queryParams, refData);
      const saved = await mongodbHandler.insertReference(refData, universityId);
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
    console.log(`MPOnline Multi-Tenant Examination Portal running at http://localhost:${PORT}`);
  });
});
