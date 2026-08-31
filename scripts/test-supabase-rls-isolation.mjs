import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;
const email = env.RLS_TEST_EMAIL ?? "alex.martin@spacex.com";
const password = env.RLS_TEST_PASSWORD ?? "SpaceX-MVP-2026!";

if (!url || !anonKey || !serviceKey) {
  throw new Error("Supabase URL, anon key, and service role key are required for the RLS isolation probe.");
}

const authenticated = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anonymous = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const ids = {
  customerOrganization: crypto.randomUUID(),
  project: crypto.randomUUID(),
  document: crypto.randomUUID(),
};
const projectNumber = `PRJ-RLS-PROBE-${Date.now()}`;
const storagePath = `${ids.document}/v1/rls-probe.txt`;
let documentCreated = false;
let projectCreated = false;
let customerOrganizationCreated = false;
let storageCreated = false;

try {
  const { data: leadOrganizations, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("code", "COASTAL_ENGINEERING")
    .limit(1);
  assert.equal(organizationError, null, organizationError?.message);
  assert.ok(leadOrganizations?.[0], "Expected the seeded lead organization for the isolated probe.");

  const customerOrganization = await admin
    .from("customer_organizations")
    .insert({ id: ids.customerOrganization, name: "PATH disposable RLS isolation probe" })
    .select("id")
    .single();
  assert.equal(customerOrganization.error, null, customerOrganization.error?.message);
  customerOrganizationCreated = true;

  const project = await admin
    .from("projects")
    .insert({
      id: ids.project,
      number: projectNumber,
      name: "PATH disposable RLS isolation probe",
      customer_organization_id: ids.customerOrganization,
      lead_organization_id: leadOrganizations[0].id,
      status: "draft",
    })
    .select("id")
    .single();
  assert.equal(project.error, null, project.error?.message);
  projectCreated = true;

  const document = await admin
    .from("documents")
    .insert({
      id: ids.document,
      project_id: ids.project,
      owner_organization_id: leadOrganizations[0].id,
      storage_path: `vault/${ids.project}/rls-probe.txt`,
      document_type: "security_probe",
      visibility: "restricted",
      created_by: "50e34731-7c7e-4205-b2d7-7976db33e333",
    })
    .select("id")
    .single();
  assert.equal(document.error, null, document.error?.message);
  documentCreated = true;

  const signIn = await authenticated.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, signIn.error?.message);
  assert.ok(signIn.data.user, "Expected the RLS probe user to authenticate.");

  const [authenticatedProject, authenticatedDocument] = await Promise.all([
    authenticated.from("projects").select("id").eq("id", ids.project),
    authenticated.from("documents").select("id").eq("id", ids.document),
  ]);
  assert.equal(authenticatedProject.error, null, authenticatedProject.error?.message);
  assert.deepEqual(authenticatedProject.data, [], "A customer without a project grant must not read the isolated project.");
  assert.equal(authenticatedDocument.error, null, authenticatedDocument.error?.message);
  assert.deepEqual(authenticatedDocument.data, [], "A customer without a project grant must not read the isolated document.");

  const anonymousProject = await anonymous.from("projects").select("id").eq("id", ids.project);
  assert.equal(anonymousProject.error, null, anonymousProject.error?.message);
  assert.deepEqual(anonymousProject.data, [], "Anonymous callers must not read project records.");

  const upload = await authenticated.storage.from("path-documents").upload(storagePath, new Blob(["RLS probe"]), {
    contentType: "text/plain",
    upsert: false,
  });
  storageCreated = !upload.error;
  assert.ok(upload.error, "An authenticated user without a project grant must not upload to the document path.");

  console.log(JSON.stringify({
    isolatedProjectHidden: true,
    isolatedDocumentHidden: true,
    anonymousProjectHidden: true,
    unauthorizedStorageUploadRejected: true,
    rejection: upload.error.message,
  }));
} finally {
  await authenticated.auth.signOut();
  if (storageCreated) await admin.storage.from("path-documents").remove([storagePath]);
  if (documentCreated) await admin.from("documents").delete().eq("id", ids.document);
  if (projectCreated) await admin.from("projects").delete().eq("id", ids.project);
  if (customerOrganizationCreated) await admin.from("customer_organizations").delete().eq("id", ids.customerOrganization);
}
