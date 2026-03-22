/**
 * Seed script: Inserts 100 PDF documents across multiple directories with tags.
 *
 * Usage:
 *   npx ts-node src/seed-test-data.ts
 *
 * Requires the database to already have migrations applied (start the server first).
 */

import knex from 'knex';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5434', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'document_base',
  },
});

// Minimal valid PDF content (~200 bytes)
function createMinimalPdf(title: string): Buffer {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
210
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

// Directory structure: department -> sub-folders
const directoryTree: Record<string, string[]> = {
  HR: ['Policies', 'Onboarding', 'Benefits'],
  Finance: ['Invoices', 'Budgets', 'Tax'],
  Engineering: ['Architecture', 'RFCs', 'Runbooks'],
  Legal: ['Contracts', 'Compliance', 'NDAs'],
  Marketing: ['Campaigns', 'Brand', 'Reports'],
  Operations: ['SOPs', 'Vendor', 'Logistics'],
  Sales: ['Proposals', 'Agreements', 'Forecasts'],
};

// Tags pool
const allTags = [
  'policy', 'draft', 'final', 'review', 'approved',
  'confidential', 'public', 'internal', 'urgent', 'archived',
  '2024', '2025', '2026', 'q1', 'q2', 'q3', 'q4',
  'template', 'report', 'guide',
];

// Document name templates per department
const docTemplates: Record<string, string[]> = {
  HR: ['Employee Handbook', 'Leave Policy', 'Code of Conduct', 'Performance Review Template', 'Remote Work Policy', 'Exit Interview Form', 'Hiring Checklist', 'Diversity Report'],
  Finance: ['Annual Budget', 'Expense Report', 'Invoice Template', 'Tax Filing Guide', 'Revenue Forecast', 'Audit Checklist', 'Cost Analysis', 'Payment Policy'],
  Engineering: ['System Design Doc', 'API Specification', 'Incident Runbook', 'Deployment Guide', 'Security Audit', 'Tech Debt Report', 'Migration Plan', 'Monitoring Setup'],
  Legal: ['NDA Template', 'Service Agreement', 'Privacy Policy', 'Terms of Service', 'Vendor Contract', 'IP Assignment', 'Compliance Checklist', 'Data Processing Agreement'],
  Marketing: ['Brand Guidelines', 'Campaign Brief', 'Social Media Plan', 'Content Calendar', 'Market Research', 'Press Release Template', 'ROI Report', 'Customer Survey'],
  Operations: ['Standard Operating Procedure', 'Vendor Evaluation', 'Shipping Policy', 'Inventory Checklist', 'Facility Management', 'Safety Protocol', 'Emergency Plan', 'Quality Assurance'],
  Sales: ['Pricing Sheet', 'Proposal Template', 'Client Agreement', 'Commission Structure', 'Territory Plan', 'Pipeline Report', 'Demo Script', 'Win-Loss Analysis'],
};

const users = ['doc_admin', 'admin'];

async function seed() {
  console.log('Starting seed: 100 documents across directories...\n');

  const now = new Date().toISOString();

  // 1. Create directories
  const dirMap = new Map<string, { id: string; path: string }>();

  for (const [dept, subs] of Object.entries(directoryTree)) {
    const deptId = uuidv4();
    const deptPath = `/${dept}`;

    // Check if directory already exists
    const existing = await db('directories').where({ path: deptPath }).whereNull('deleted_at').first();
    if (existing) {
      dirMap.set(deptPath, { id: existing.id, path: existing.path });
      console.log(`  Directory exists: ${deptPath}`);
    } else {
      await db('directories').insert({
        id: deptId,
        name: dept,
        parent_id: null,
        path: deptPath,
        created_by: 'admin',
        created_at: now,
        updated_at: now,
      });
      dirMap.set(deptPath, { id: deptId, path: deptPath });
      console.log(`  Created directory: ${deptPath}`);
    }

    const parentId = dirMap.get(deptPath)!.id;

    for (const sub of subs) {
      const subPath = `/${dept}/${sub}`;
      const existingSub = await db('directories').where({ path: subPath }).whereNull('deleted_at').first();
      if (existingSub) {
        dirMap.set(subPath, { id: existingSub.id, path: existingSub.path });
        console.log(`  Directory exists: ${subPath}`);
      } else {
        const subId = uuidv4();
        await db('directories').insert({
          id: subId,
          name: sub,
          parent_id: parentId,
          path: subPath,
          created_by: 'admin',
          created_at: now,
          updated_at: now,
        });
        dirMap.set(subPath, { id: subId, path: subPath });
        console.log(`  Created directory: ${subPath}`);
      }
    }
  }

  // 2. Ensure tags exist
  const tagIdMap = new Map<string, string>();
  for (const tagName of allTags) {
    let tag = await db('tags').where({ name: tagName }).first();
    if (!tag) {
      const tagId = uuidv4();
      await db('tags').insert({ id: tagId, name: tagName });
      tag = { id: tagId };
    }
    tagIdMap.set(tagName, tag.id);
  }
  console.log(`\nEnsured ${allTags.length} tags exist.`);

  // 3. Create 100 documents spread across directories
  const departments = Object.keys(directoryTree);
  let docCount = 0;

  for (let i = 0; i < 100; i++) {
    const dept = departments[i % departments.length];
    const subs = directoryTree[dept];
    const sub = subs[i % subs.length];
    const dirPath = `/${dept}/${sub}`;
    const dir = dirMap.get(dirPath)!;

    const templates = docTemplates[dept];
    const baseName = templates[i % templates.length];
    // Add index to ensure uniqueness
    const docName = `${baseName} ${String(i + 1).padStart(3, '0')}`;
    const fileName = `${docName.replace(/\s+/g, '_')}.pdf`;

    const user = users[i % users.length];

    // Check if document already exists in this directory
    const existingDoc = await db('documents')
      .where({ name: docName, directory_id: dir.id })
      .whereNull('deleted_at')
      .first();

    if (existingDoc) {
      console.log(`  Skipping (exists): ${docName} in ${dirPath}`);
      docCount++;
      continue;
    }

    const pdfBuffer = createMinimalPdf(docName);
    const docId = uuidv4();
    const versionId = uuidv4();

    // Pick 1-3 random tags
    const numTags = 1 + (i % 3);
    const docTags: string[] = [];
    for (let t = 0; t < numTags; t++) {
      docTags.push(allTags[(i + t * 7) % allTags.length]);
    }

    // Generate a start_date in 2024-2026 range
    const year = 2024 + (i % 3);
    const month = String(1 + (i % 12)).padStart(2, '0');
    const startDate = `${year}-${month}-01`;

    await db.transaction(async (trx) => {
      // Insert document
      await trx('documents').insert({
        id: docId,
        name: docName,
        directory_id: dir.id,
        current_version_id: null,
        created_by: user,
        created_at: now,
        updated_at: now,
      });

      // Insert version
      await trx('document_versions').insert({
        id: versionId,
        document_id: docId,
        version_number: 1,
        file_data: pdfBuffer,
        file_name: fileName,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        start_date: startDate,
        end_date: null,
        is_archived: false,
        uploaded_by: user,
        created_at: now,
        updated_at: now,
      });

      // Set current_version_id
      await trx('documents')
        .where({ id: docId })
        .update({ current_version_id: versionId });

      // Assign tags
      for (const tagName of docTags) {
        const tagId = tagIdMap.get(tagName)!;
        await trx('document_tags').insert({
          document_id: docId,
          tag_id: tagId,
        });
      }
    });

    docCount++;
    if ((i + 1) % 10 === 0) {
      console.log(`  Seeded ${i + 1}/100 documents...`);
    }
  }

  console.log(`\nDone! Seeded ${docCount} documents across ${dirMap.size} directories.`);
  await db.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
