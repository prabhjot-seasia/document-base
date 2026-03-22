/**
 * Seed script: creates directories and ~100 PDF documents
 * Usage: npx tsx seed-data.ts
 *
 * Requires the backend DB to be running (reads .env for connection).
 * Authenticates via auth-service to get a valid token.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = `http://localhost:${process.env.SERVER_PORT || 8082}`;
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8080';
const USERNAME = 'doc_admin';
const PASSWORD = 'Admin@123';

// A small valid PDF to use for all uploads
const PDF_PATH = path.join(__dirname, '..', 'tests', 'bdd', 'fixtures', 'test-document.pdf');

// ─── Directory + Document definitions ──────────────────────────────────────────

interface DocDef {
  name: string;
  tags: string[];
  startDate: string;
}

interface DirDef {
  name: string;
  children?: DirDef[];
  docs: DocDef[];
}

const STRUCTURE: DirDef[] = [
  {
    name: 'HR',
    children: [
      {
        name: 'Onboarding',
        docs: [
          { name: 'New Employee Welcome Kit', tags: ['onboarding', 'hr', 'welcome'], startDate: '2024-01-15' },
          { name: 'Orientation Checklist', tags: ['onboarding', 'checklist'], startDate: '2024-01-15' },
          { name: 'First 90 Days Plan', tags: ['onboarding', 'plan'], startDate: '2024-02-01' },
          { name: 'Benefits Enrollment Guide', tags: ['benefits', 'onboarding', 'hr'], startDate: '2024-01-20' },
          { name: 'Employee ID Request Form', tags: ['onboarding', 'form'], startDate: '2024-03-01' },
        ],
        children: [],
      },
      {
        name: 'Policies',
        docs: [
          { name: 'Employee Handbook 2024', tags: ['handbook', 'hr', 'policy', '2024'], startDate: '2024-01-01' },
          { name: 'Code of Conduct', tags: ['conduct', 'ethics', 'hr'], startDate: '2024-01-01' },
          { name: 'Anti-Harassment Policy', tags: ['harassment', 'hr', 'compliance'], startDate: '2024-01-01' },
          { name: 'Dress Code Policy', tags: ['dress-code', 'hr'], startDate: '2024-03-15' },
          { name: 'Remote Work Policy', tags: ['remote', 'wfh', 'hr', 'policy'], startDate: '2024-02-01' },
          { name: 'Attendance and Leave Policy', tags: ['attendance', 'leave', 'hr'], startDate: '2024-01-01' },
          { name: 'Disciplinary Action Policy', tags: ['disciplinary', 'hr', 'policy'], startDate: '2024-04-01' },
          { name: 'Grievance Redressal Policy', tags: ['grievance', 'hr'], startDate: '2024-01-01' },
          { name: 'Equal Opportunity Policy', tags: ['equality', 'diversity', 'hr'], startDate: '2024-01-01' },
          { name: 'Whistleblower Policy', tags: ['whistleblower', 'compliance', 'hr'], startDate: '2024-06-01' },
        ],
        children: [],
      },
      {
        name: 'Compensation',
        docs: [
          { name: 'Salary Structure FY2024', tags: ['salary', 'compensation', 'hr'], startDate: '2024-04-01' },
          { name: 'Bonus Policy', tags: ['bonus', 'compensation', 'hr'], startDate: '2024-04-01' },
          { name: 'Stock Options Plan', tags: ['esop', 'compensation'], startDate: '2024-01-01' },
          { name: 'Overtime Policy', tags: ['overtime', 'compensation', 'hr'], startDate: '2024-01-01' },
          { name: 'Travel Reimbursement Policy', tags: ['travel', 'reimbursement', 'hr'], startDate: '2024-03-01' },
        ],
        children: [],
      },
      {
        name: 'Performance',
        docs: [
          { name: 'Performance Review Template', tags: ['review', 'performance', 'hr'], startDate: '2024-01-01' },
          { name: 'KPI Framework', tags: ['kpi', 'performance', 'hr'], startDate: '2024-01-01' },
          { name: 'Promotion Criteria', tags: ['promotion', 'performance', 'hr'], startDate: '2024-02-01' },
          { name: 'PIP Guidelines', tags: ['pip', 'performance', 'hr'], startDate: '2024-03-01' },
        ],
        children: [],
      },
    ],
    docs: [],
  },
  {
    name: 'IT',
    children: [
      {
        name: 'Security',
        docs: [
          { name: 'Information Security Policy', tags: ['security', 'it', 'policy', 'infosec'], startDate: '2024-01-01' },
          { name: 'Password Management Policy', tags: ['password', 'security', 'it'], startDate: '2024-01-01' },
          { name: 'Data Classification Policy', tags: ['data', 'classification', 'security'], startDate: '2024-02-15' },
          { name: 'Incident Response Plan', tags: ['incident', 'security', 'it', 'plan'], startDate: '2024-01-01' },
          { name: 'Acceptable Use Policy', tags: ['acceptable-use', 'security', 'it'], startDate: '2024-01-01' },
          { name: 'Vulnerability Management Policy', tags: ['vulnerability', 'security', 'it'], startDate: '2024-03-01' },
          { name: 'Access Control Policy', tags: ['access-control', 'security', 'it'], startDate: '2024-01-01' },
          { name: 'BYOD Security Policy', tags: ['byod', 'mobile', 'security', 'it'], startDate: '2024-04-01' },
          { name: 'Encryption Standards', tags: ['encryption', 'security', 'standards'], startDate: '2024-02-01' },
          { name: 'Network Security Policy', tags: ['network', 'security', 'it'], startDate: '2024-01-01' },
        ],
        children: [],
      },
      {
        name: 'Infrastructure',
        docs: [
          { name: 'Cloud Architecture Guide', tags: ['cloud', 'aws', 'infrastructure'], startDate: '2024-01-15' },
          { name: 'Server Naming Convention', tags: ['naming', 'infrastructure', 'standards'], startDate: '2024-01-01' },
          { name: 'Backup and Recovery Plan', tags: ['backup', 'recovery', 'infrastructure'], startDate: '2024-02-01' },
          { name: 'Disaster Recovery Playbook', tags: ['disaster-recovery', 'infrastructure', 'plan'], startDate: '2024-01-01' },
          { name: 'Monitoring and Alerting Setup', tags: ['monitoring', 'alerting', 'infrastructure'], startDate: '2024-03-01' },
          { name: 'Database Management Standards', tags: ['database', 'infrastructure', 'standards'], startDate: '2024-02-15' },
        ],
        children: [],
      },
      {
        name: 'Development',
        docs: [
          { name: 'Coding Standards Guide', tags: ['coding', 'standards', 'development'], startDate: '2024-01-01' },
          { name: 'Git Branching Strategy', tags: ['git', 'branching', 'development'], startDate: '2024-01-01' },
          { name: 'Code Review Checklist', tags: ['code-review', 'checklist', 'development'], startDate: '2024-02-01' },
          { name: 'CI/CD Pipeline Documentation', tags: ['cicd', 'pipeline', 'development', 'devops'], startDate: '2024-03-01' },
          { name: 'API Design Guidelines', tags: ['api', 'design', 'development', 'standards'], startDate: '2024-01-15' },
          { name: 'Testing Strategy Document', tags: ['testing', 'qa', 'development'], startDate: '2024-02-01' },
          { name: 'Release Management Process', tags: ['release', 'deployment', 'development'], startDate: '2024-04-01' },
        ],
        children: [],
      },
      {
        name: 'Support',
        docs: [
          { name: 'IT Helpdesk SOP', tags: ['helpdesk', 'sop', 'it-support'], startDate: '2024-01-01' },
          { name: 'Laptop Provisioning Guide', tags: ['laptop', 'provisioning', 'it-support'], startDate: '2024-01-15' },
          { name: 'Software Request Process', tags: ['software', 'request', 'it-support'], startDate: '2024-02-01' },
          { name: 'VPN Setup Guide', tags: ['vpn', 'setup', 'it-support'], startDate: '2024-01-01' },
        ],
        children: [],
      },
    ],
    docs: [],
  },
  {
    name: 'Finance',
    children: [
      {
        name: 'Policies',
        docs: [
          { name: 'Expense Policy', tags: ['expense', 'finance', 'policy'], startDate: '2024-01-01' },
          { name: 'Procurement Policy', tags: ['procurement', 'finance', 'policy'], startDate: '2024-01-01' },
          { name: 'Invoice Processing SOP', tags: ['invoice', 'finance', 'sop'], startDate: '2024-02-01' },
          { name: 'Petty Cash Guidelines', tags: ['petty-cash', 'finance'], startDate: '2024-03-01' },
          { name: 'Budget Approval Process', tags: ['budget', 'approval', 'finance'], startDate: '2024-01-01' },
          { name: 'Tax Compliance Guide', tags: ['tax', 'compliance', 'finance'], startDate: '2024-04-01' },
        ],
        children: [],
      },
      {
        name: 'Reports',
        docs: [
          { name: 'Q1 2024 Financial Report', tags: ['quarterly', 'finance', 'report', 'q1'], startDate: '2024-04-15' },
          { name: 'Q2 2024 Financial Report', tags: ['quarterly', 'finance', 'report', 'q2'], startDate: '2024-07-15' },
          { name: 'Annual Budget FY2024', tags: ['budget', 'annual', 'finance'], startDate: '2024-01-01' },
          { name: 'Audit Report 2023', tags: ['audit', 'finance', 'report'], startDate: '2024-02-28' },
        ],
        children: [],
      },
    ],
    docs: [],
  },
  {
    name: 'Legal',
    children: [
      {
        name: 'Contracts',
        docs: [
          { name: 'Standard NDA Template', tags: ['nda', 'contract', 'legal', 'template'], startDate: '2024-01-01' },
          { name: 'Vendor Agreement Template', tags: ['vendor', 'contract', 'legal'], startDate: '2024-01-01' },
          { name: 'Employment Contract Template', tags: ['employment', 'contract', 'legal', 'hr'], startDate: '2024-02-01' },
          { name: 'SLA Template', tags: ['sla', 'contract', 'legal'], startDate: '2024-01-15' },
          { name: 'Data Processing Agreement', tags: ['dpa', 'gdpr', 'legal', 'privacy'], startDate: '2024-03-01' },
        ],
        children: [],
      },
      {
        name: 'Compliance',
        docs: [
          { name: 'GDPR Compliance Handbook', tags: ['gdpr', 'compliance', 'privacy', 'legal'], startDate: '2024-01-01' },
          { name: 'Data Privacy Policy', tags: ['privacy', 'data', 'legal', 'policy'], startDate: '2024-01-01' },
          { name: 'Cookie Policy', tags: ['cookie', 'privacy', 'legal'], startDate: '2024-02-01' },
          { name: 'Terms of Service', tags: ['tos', 'legal'], startDate: '2024-01-01' },
          { name: 'Regulatory Compliance Checklist', tags: ['regulatory', 'compliance', 'checklist'], startDate: '2024-04-01' },
          { name: 'Anti-Money Laundering Policy', tags: ['aml', 'compliance', 'legal'], startDate: '2024-01-01' },
        ],
        children: [],
      },
    ],
    docs: [],
  },
  {
    name: 'Operations',
    children: [
      {
        name: 'Facilities',
        docs: [
          { name: 'Office Safety Manual', tags: ['safety', 'office', 'operations'], startDate: '2024-01-01' },
          { name: 'Fire Evacuation Plan', tags: ['fire', 'evacuation', 'safety'], startDate: '2024-01-01' },
          { name: 'Visitor Management Policy', tags: ['visitor', 'security', 'operations'], startDate: '2024-02-01' },
          { name: 'Parking Policy', tags: ['parking', 'facilities', 'operations'], startDate: '2024-03-01' },
        ],
        children: [],
      },
      {
        name: 'Quality',
        docs: [
          { name: 'ISO 9001 Quality Manual', tags: ['iso', 'quality', 'manual', 'operations'], startDate: '2024-01-01' },
          { name: 'Quality Assurance SOP', tags: ['qa', 'quality', 'sop'], startDate: '2024-02-01' },
          { name: 'Customer Complaint Handling', tags: ['complaint', 'customer', 'quality'], startDate: '2024-01-15' },
          { name: 'Continuous Improvement Framework', tags: ['improvement', 'kaizen', 'quality'], startDate: '2024-03-01' },
        ],
        children: [],
      },
    ],
    docs: [],
  },
  {
    name: 'Marketing',
    docs: [],
    children: [
      {
        name: 'Brand',
        docs: [
          { name: 'Brand Guidelines 2024', tags: ['brand', 'guidelines', 'marketing'], startDate: '2024-01-01' },
          { name: 'Logo Usage Policy', tags: ['logo', 'brand', 'marketing'], startDate: '2024-01-01' },
          { name: 'Social Media Policy', tags: ['social-media', 'marketing', 'policy'], startDate: '2024-02-01' },
          { name: 'Content Style Guide', tags: ['content', 'style', 'marketing'], startDate: '2024-01-15' },
        ],
        children: [],
      },
      {
        name: 'Campaigns',
        docs: [
          { name: 'Q1 Marketing Campaign Plan', tags: ['campaign', 'marketing', 'q1'], startDate: '2024-01-10' },
          { name: 'Q2 Marketing Campaign Plan', tags: ['campaign', 'marketing', 'q2'], startDate: '2024-04-01' },
          { name: 'Product Launch Playbook', tags: ['launch', 'product', 'marketing'], startDate: '2024-03-01' },
        ],
        children: [],
      },
    ],
  },
  {
    name: 'Training',
    docs: [
      { name: 'Annual Training Calendar 2024', tags: ['training', 'calendar', '2024'], startDate: '2024-01-01' },
      { name: 'Leadership Development Program', tags: ['leadership', 'training', 'development'], startDate: '2024-02-01' },
      { name: 'Technical Skills Matrix', tags: ['skills', 'training', 'technical'], startDate: '2024-01-15' },
      { name: 'Compliance Training Manual', tags: ['compliance', 'training', 'mandatory'], startDate: '2024-01-01' },
      { name: 'Safety Training Guide', tags: ['safety', 'training', 'mandatory'], startDate: '2024-03-01' },
    ],
    children: [],
  },
];

// ─── Main logic ────────────────────────────────────────────────────────────────

let token = '';
let totalDocs = 0;
let failedDocs = 0;

async function getToken(): Promise<string> {
  const res = await axios.post(`${AUTH_URL}/auth/login`, {
    username: USERNAME,
    password: PASSWORD,
  });
  return res.data.code;
}

const api = () =>
  axios.create({
    baseURL: BACKEND_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

async function ensureDirectory(name: string, parentId: string | null): Promise<string> {
  // Check existing directories
  const res = await api().get('/api/directories');
  const found = findDirInTree(res.data, name, parentId);
  if (found) return found;

  // Create it
  const createRes = await api().post('/api/directories', {
    name,
    parent_id: parentId,
  });
  return createRes.data.id;
}

function findDirInTree(dirs: any[], name: string, parentId: string | null): string | null {
  for (const dir of dirs) {
    if (dir.name === name) {
      if (!parentId && !dir.parent_id) return dir.id;
      if (parentId && dir.parent_id === parentId) return dir.id;
    }
    if (dir.children?.length) {
      const found = findDirInTree(dir.children, name, parentId);
      if (found) return found;
    }
  }
  return null;
}

async function uploadDocument(dirId: string, doc: DocDef) {
  const form = new FormData();
  form.append('name', doc.name);
  form.append('directory_id', dirId);
  form.append('tags', doc.tags.join(', '));
  form.append('start_date', doc.startDate);
  form.append('file', fs.createReadStream(PDF_PATH), {
    filename: `${doc.name.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf`,
    contentType: 'application/pdf',
  });

  try {
    await api().post('/api/documents', form, {
      headers: { ...form.getHeaders() },
      maxContentLength: 100 * 1024 * 1024,
    });
    totalDocs++;
    process.stdout.write(`\r  Uploaded ${totalDocs} documents...`);
  } catch (err: any) {
    failedDocs++;
    const msg = err.response?.data?.error || err.message;
    console.error(`\n  FAILED: "${doc.name}" — ${msg}`);
  }
}

async function processDirDef(def: DirDef, parentId: string | null) {
  const dirId = await ensureDirectory(def.name, parentId);

  // Upload docs in this directory
  for (const doc of def.docs) {
    await uploadDocument(dirId, doc);
  }

  // Process children
  if (def.children) {
    for (const child of def.children) {
      await processDirDef(child, dirId);
    }
  }
}

async function main() {
  console.log('Seeding document-base with test data...');
  console.log(`  Backend: ${BACKEND_URL}`);
  console.log(`  Auth:    ${AUTH_URL}`);

  // Check backend health
  try {
    await axios.get(`${BACKEND_URL}/health`);
  } catch {
    console.error('ERROR: Backend is not running at ' + BACKEND_URL);
    process.exit(1);
  }

  // Get token
  console.log('  Authenticating as doc_admin...');
  token = await getToken();
  if (!token) {
    console.error('ERROR: Failed to get auth token');
    process.exit(1);
  }
  console.log('  Authenticated.');

  // Count total docs
  let total = 0;
  const countDocs = (defs: DirDef[]) => {
    for (const d of defs) {
      total += d.docs.length;
      if (d.children) countDocs(d.children);
    }
  };
  countDocs(STRUCTURE);
  console.log(`  Creating ${total} documents across directory structure...\n`);

  // Process all directories and docs
  for (const def of STRUCTURE) {
    await processDirDef(def, null);
  }

  console.log(`\n\nDone! Uploaded ${totalDocs} documents. ${failedDocs > 0 ? `(${failedDocs} failed)` : ''}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
