const { MongoClient } = require('mongodb');
require('dotenv').config();

const departments = [
  { 
    code: 'CSE', 
    name: 'Computer Science & Engineering', 
    head: 'Dr. R. Sharma, Ph.D', 
    email: 'hod.cse@university.ac.in',
    facultyCount: 32,
    intakeCapacity: 240,
    establishedYear: 1998,
    status: 'Active',
    buildingLocation: 'Ramanujan Tech Block, Floor 3',
    description: 'NBA Tier-1 Accredited Department of Computer Science & Software Engineering.'
  },
  { 
    code: 'IT', 
    name: 'Information Technology', 
    head: 'Dr. V. Verma, Ph.D', 
    email: 'hod.it@university.ac.in',
    facultyCount: 24,
    intakeCapacity: 180,
    establishedYear: 2002,
    status: 'Active',
    buildingLocation: 'Turing Computing Center, Floor 2',
    description: 'Information Systems, Cloud Infrastructure, and Cyber Security.'
  },
  { 
    code: 'AI_DS', 
    name: 'Artificial Intelligence & Data Science', 
    head: 'Dr. Priya Nambiar, Ph.D', 
    email: 'hod.aids@university.ac.in',
    facultyCount: 18,
    intakeCapacity: 120,
    establishedYear: 2020,
    status: 'Active',
    buildingLocation: 'Aryabhata Data Center, Floor 4',
    description: 'Deep Learning, Machine Intelligence, and Big Data Analytics.'
  },
  { 
    code: 'ECE', 
    name: 'Electronics & Communication Engineering', 
    head: 'Dr. S. Gupta, Ph.D', 
    email: 'hod.ece@university.ac.in',
    facultyCount: 26,
    intakeCapacity: 180,
    establishedYear: 1995,
    status: 'Active',
    buildingLocation: 'J.C. Bose Communication Wing, Floor 1',
    description: 'VLSI Design, Embedded Systems, and Wireless Telecommunications.'
  },
  { 
    code: 'ME', 
    name: 'Mechanical Engineering', 
    head: 'Dr. A. Patel, Ph.D', 
    email: 'hod.me@university.ac.in',
    facultyCount: 28,
    intakeCapacity: 120,
    establishedYear: 1985,
    status: 'Active',
    buildingLocation: 'Visvesvaraya Mechanical Complex, Block A',
    description: 'Thermodynamics, Robotics, Automation, and Advanced Manufacturing.'
  },
  { 
    code: 'CE', 
    name: 'Civil Engineering', 
    head: 'Dr. N. Joshi, Ph.D', 
    email: 'hod.ce@university.ac.in',
    facultyCount: 20,
    intakeCapacity: 120,
    establishedYear: 1985,
    status: 'Active',
    buildingLocation: 'Structural Engineering Pavilion, Block C',
    description: 'Structural Analysis, Geotechnical Studies, and Urban Infrastructure.'
  },
  { 
    code: 'EE', 
    name: 'Electrical Engineering', 
    head: 'Dr. Rajesh K. Tiwari, Ph.D', 
    email: 'hod.ee@university.ac.in',
    facultyCount: 22,
    intakeCapacity: 120,
    establishedYear: 1990,
    status: 'Active',
    buildingLocation: 'Faraday Energy Lab, Block B',
    description: 'Power Grids, Renewable Energy, and High Voltage Systems.'
  },
  { 
    code: 'MBA', 
    name: 'Management Studies & Business Administration', 
    head: 'Dr. M. Kulkarni, Ph.D', 
    email: 'hod.mba@university.ac.in',
    facultyCount: 16,
    intakeCapacity: 90,
    establishedYear: 2005,
    status: 'Active',
    buildingLocation: 'Chanakya Management Tower, Floor 5',
    description: 'Finance, Operations, Marketing, and Technology Management.'
  }
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB Atlas successfully!');
  const db = client.db('mponline_evaluation_db');
  const collection = db.collection('departments');
  await collection.createIndex({ code: 1 }, { unique: true });
  
  for (const dept of departments) {
    await collection.updateOne(
      { code: dept.code },
      { $set: { ...dept, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log(`[MongoDB] Upserted department: ${dept.code} - ${dept.name}`);
  }
  
  const count = await collection.countDocuments();
  console.log(`[MongoDB] Total Recognized Academic Departments in database: ${count}`);
  const docs = await collection.find({}).toArray();
  console.log('Sample Document:', JSON.stringify(docs[0], null, 2));
  await client.close();
}

seed().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
