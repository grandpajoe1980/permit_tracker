import fs from node:fs;
import crypto from node:crypto;
import { createClient } from @supabase/supabase-js;

function readEnvFile(path = .env) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, utf8)
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith(#))
      .map((line) => {
        const separator = line.indexOf(=);
        if (separator < 0) return [line.trim(), "];
 const key = line.slice(0, separator).trim();
 const value = line.slice(separator + 1).trim().replace(/^(['])(.*)\1$/, ");
 return [key, value];
 }),
 );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;

const client = createClient(url, serviceKey, {
 auth: { autoRefreshToken: false, persistSession: false },
});

console.log(================================================================================);
console.log(REVIEWER 2: EXHAUSTIVE DATABASE, SCHEMA & STORAGE AUDIT);
console.log(================================================================================);

// 1. Check Auth Users
const { data: usersData, error: usersErr } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
console.log(\n1. AUTH USERS: users found (Error: ));
for (const u of usersData?.users || []) {
 console.log( - (ID: ));
}

// 2. Check Organizations & Assignment Groups
const { data: orgs, error: orgsErr } = await client.from(organizations).select(id, code, name);
console.log(\n2. ORGANIZATIONS: rows found (Error: ));
for (const o of orgs || []) {
 console.log( - [] ());
}

const { data: ags, error: agsErr } = await client.from(assignment_groups).select(id, org_code, name, agency_type);
console.log(\n3. ASSIGNMENT GROUPS: rows found (Error: ));
for (const ag of ags || []) {
 console.log( - [] (type: , ID: ));
}

// 4. Check Projects
const { data: projects, error: projErr } = await client.from(projects).select(*).order(number);
console.log(\n4. PROJECTS: rows found (Error: ));
for (const p of projects || []) {
 console.log( - [] (Type: , Status: , ID: ));
}

// 5. Check Permit Types
const { data: permitTypes, error: ptErr } = await client.from(permit_types).select(*).order(code);
console.log(\n5. PERMIT TYPES: rows found (Error: ));
for (const pt of permitTypes || []) {
 console.log( - [] (Cat: , Org: ));
}

// 6. Check Workstreams
const { data: workstreams, error: wsErr } = await client.from(workstreams).select(*).order(code);
console.log(\n6. WORKSTREAMS: rows found (Error: ));
for (const ws of workstreams || []) {
 console.log( - [] );
 console.log( Project ID: );
 console.log( Permit Type: | State: | RAG: );
 console.log( Concierge: | Reg Lead: - );
 console.log( 6-Q Target Date: | At Risk: );
}

// 7. Check Tasks
const { data: tasks, error: tasksErr } = await client.from(tasks).select(*).order(id);
console.log(\n7. TASKS: rows found (Error: ));
for (const t of tasks || []) {
 console.log( - [] (WS: , Dur: d, Float: d, CP: , Status: ));
}

// 8. Check Commitments, Decisions, Meetings, CRs, RFIs
const { count: commCount } = await client.from(commitments).select(*, { count: exact, head: true });
const { count: decCount } = await client.from(decisions).select(*, { count: exact, head: true });
const { count: meetCount } = await client.from(meetings).select(*, { count: exact, head: true });
const { count: crCount } = await client.from(coordination_requests).select(*, { count: exact, head: true });
const { count: rfiCount } = await client.from(rfis).select(*, { count: exact, head: true });
const { count: revCount } = await client.from(document_agency_reviews).select(*, { count: exact, head: true });

console.log(\n8. INTERAGENCY & COORDINATION OBJECTS:);
console.log( - Commitments: );
console.log( - Decisions: );
console.log( - Meetings: );
console.log( - Coordination Requests: );
console.log( - RFIs: );
console.log( - Document Agency Reviews: );

// 9. Storage & Document Versions Cryptographic Audit
console.log(\n9. STORAGE & CRYPTOGRAPHIC VERIFICATION:);
const { data: docVersions, error: dvErr } = await client.from(document_versions).select(*).order(created_at);
console.log( Found document versions in ledger.);

let allHashesValid = true;
let allDownloadsValid = true;

for (const v of docVersions || []) {
 const { data: blob, error: dlErr } = await client.storage.from(path-documents).download(v.storage_path);
 if (dlErr || !blob) {
 console.error( ❌ Failed to download : );
 allDownloadsValid = false;
 continue;
 }
 const buf = Buffer.from(await blob.arrayBuffer());
 const actualHash = crypto.createHash(sha256).update(buf).digest(hex);
 const isHashMatch = actualHash === v.sha256_hash;
 const isSizeMatch = buf.length === v.file_size_bytes;
 const isPdf = v.mime_type === application/pdf ? buf.toString(ascii, 0, 8).includes(%PDF-) : true;

 if (!isHashMatch || !isSizeMatch || !isPdf) {
 allHashesValid = false;
 }

 // Also check signed URL
 const { data: sData } = await client.storage.from(path-documents).createSignedUrl(v.storage_path, 60);
 let httpOk = false;
 if (sData?.signedUrl) {
 const res = await fetch(sData.signedUrl);
 httpOk = res.ok;
 }

 console.log( - []);
 console.log( Size: bytes (Expected: ) -> );
 console.log( SHA-256: );
 console.log( Ledger Hash: -> );
 console.log( PDF Structure Valid: | Signed URL HTTP 200: );
}

console.log(\nStorage Parity Summary: Downloads: , Hashes: );

