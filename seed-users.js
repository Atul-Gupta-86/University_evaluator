require('dotenv').config();
const { MongoClient } = require('mongodb');

// Exactly 1 Gmail per role - All dummy data removed
const CLEAN_USERS = [
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

const CLEAN_TEACHERS = [
  {
    id: 'tch_primary_1',
    email: 'teacher@gmail.com',
    password: 'teacher123',
    name: 'Evaluator Teacher',
    role: 'teacher',
    department: 'Computer Science & Engineering',
    maxLoad: 100,
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

async function cleanAndSeed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not configured in .env');
    return;
  }

  console.log('[CLEANUP] Connecting to MongoDB Atlas...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db('mponline_evaluation_db');

  console.log('[CLEANUP] 1. Purging dummy students from MongoDB...');
  const studentsCol = db.collection('students');
  const deletedStudents = await studentsCol.deleteMany({});
  console.log(`[CLEANUP] Removed ${deletedStudents.deletedCount} dummy student records.`);

  console.log('[CLEANUP] 2. Purging old users and setting strictly 1 Gmail per role...');
  const usersCol = db.collection('users');
  await usersCol.deleteMany({});
  for (const u of CLEAN_USERS) {
    await usersCol.insertOne(u);
  }
  console.log(`[CLEANUP] Configured ${CLEAN_USERS.length} official users.`);

  console.log('[CLEANUP] 3. Purging old teachers and setting 1 teacher Gmail...');
  const teachersCol = db.collection('teachers');
  await teachersCol.deleteMany({});
  for (const t of CLEAN_TEACHERS) {
    await teachersCol.insertOne(t);
  }
  console.log(`[CLEANUP] Configured ${CLEAN_TEACHERS.length} official teacher.`);

  console.log('[CLEANUP] 4. Purging dummy answer references...');
  const refsCol = db.collection('answer_references');
  await refsCol.deleteMany({});

  console.log('[CLEANUP] 5. Purging subjects...');
  await db.collection('subjects').deleteMany({});

  console.log('[CLEANUP] 6. Purging departments...');
  await db.collection('departments').deleteMany({});

  console.log('====================================================');
  console.log('[CLEANUP COMPLETE] Database is pristine and zero dummy data remains.');
  console.log('Official Logins Available (1 Gmail per Role):');
  CLEAN_USERS.forEach(u => console.log(`  - Role: ${u.role.padEnd(14)} | Email: ${u.email.padEnd(26)} | Password: ${u.password}`));
  console.log('====================================================');

  await client.close();
}

cleanAndSeed().catch(err => {
  console.error('[CLEANUP ERROR]', err);
  process.exit(1);
});
