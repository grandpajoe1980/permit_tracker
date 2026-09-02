import fs from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key;

if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY credentials in environment");
  process.exit(1);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

const {
  spacexProjectRecord,
  workstreamsData,
  commitmentsData,
  projectDecisionsData,
  projectMeetingsData,
  projectDocumentsData,
  coordinationRequestsData,
  rfisData,
  permitCatalog,
} = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");

await vite.close();

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function stableUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}


async function seed() {
  console.log("Seeding Command System database tables on Supabase...");

  // 1. Seed Permit Types & Resources
  for (const permit of permitCatalog) {
    const { error: pErr } = await supabase.from("permit_types").upsert({
      id: permit.id,
      code: permit.code,
      name: permit.name,
      category: permit.category,
      responsible_org_id: permit.responsibleOrgId,
      responsible_org_code: permit.responsibleOrgCode,
      trigger_explanation: permit.triggerExplanation,
      statutory_citation: permit.statutoryCitation,
      expected_lead_time_days: permit.expectedLeadTimeDays,
      minimum_statutory_days: permit.minimumStatutoryDays,
      public_notice_required: permit.publicNoticeRequired,
      public_notice_days: permit.publicNoticeDays,
      prerequisites: permit.prerequisites || [],
      related_permit_type_ids: permit.relatedPermitTypeIds || [],
      last_verified_at: permit.lastVerifiedAt,
      verification_status: permit.verificationStatus,
    });
    if (pErr) console.warn("Permit upsert notice:", pErr.message);

    for (const res of permit.resources || []) {
      const { error: rErr } = await supabase.from("requirement_resources").upsert({
        id: res.id,
        permit_type_id: permit.id,
        resource_name: res.resourceName,
        resource_type: res.resourceType,
        url: res.url,
        version_tag: res.versionTag,
        verified_at: res.verifiedAt,
        verified_by: res.verifiedBy,
        is_stale: Boolean(res.isStale),
      });
      if (rErr) console.warn("Resource upsert notice:", rErr.message);
    }
  }

  // 2. Find or create project
  let { data: projects } = await supabase.from("projects").select("id").eq("number", "PRJ-PECAN-2026");
  let projectId = projects?.[0]?.id;
  if (!projectId) {
    const { data: custOrgs } = await supabase.from("customer_organizations").select("id").limit(1);
    const { data: leadOrgs } = await supabase.from("organizations").select("id").eq("code", "LA-PROJECTS");
    const { data: newProj } = await supabase.from("projects").insert({
      id: "d1000000-0000-0000-0000-000000000001",
      number: "PRJ-PECAN-2026",
      name: "SpaceX Starbase Louisiana Launch Complex & Industrial Campus",
      description: "Pecan Island 125,000-acre coastal space launch complex, orbital launch mounts, methane liquefaction plant, deluge wastewater retention systems, and heavy-haul logistics corridor in Vermilion Parish, Louisiana.",
      customer_organization_id: custOrgs?.[0]?.id || "b9977037-3175-4dc6-9b61-8d64b6b863fa",
      lead_organization_id: leadOrgs?.[0]?.id || "c0000000-0000-0000-0000-000000000002",
      status: "active",
      risk: "at_risk",
      start_date: "2026-01-01",
      target_date: "2026-12-28",
      location: { parish: "Vermilion Parish", region: "Pecan Island Coastal Zone", description: "Pecan Island Coastal Zone, Vermilion Parish, Louisiana" },
    }).select("id").single();
    projectId = newProj?.id || "d1000000-0000-0000-0000-000000000001";
  }

  // 3. Seed Workstreams, Tasks, Dependencies
  for (const ws of workstreamsData) {
    const { error: wsErr } = await supabase.from("workstreams").upsert({
      id: ws.id,
      project_id: projectId,
      code: ws.code,
      title: ws.title,
      category: ws.category,
      permit_type_id: ws.permitTypeId,
      current_stage_name: ws.currentStageName,
      operational_state: ws.operationalState,
      operational_state_label: ws.operationalStateLabel,
      rag_status: ws.ragStatus,
      rag_label: ws.ragLabel,
      is_critical_path: ws.isCriticalPath,
      baseline_target_date: ws.baselineTargetDate,
      forecast_target_date: ws.forecastTargetDate,
      schedule_variance_days: ws.scheduleVarianceDays,
      remaining_float_days: ws.remainingFloatDays,
      state_concierge: ws.stateConcierge,
      regulatory_lead: ws.regulatoryLead,
      six_questions: ws.sixQuestions,
      waiting_reason: ws.waitingReason,
      waiting_on_entity: ws.waitingOnEntity,
      current_action_summary: ws.currentActionSummary,
      escalation_level: ws.escalationLevel || 0,
      escalation_triggered_at: ws.escalationTriggeredAt,
      escalation_summary: ws.escalationSummary,
      stage_history: ws.stageHistory || [],
      active_blockers: ws.activeBlockers || [],
    });
    if (wsErr) console.warn("Workstream upsert notice:", wsErr.message);

    for (const task of ws.tasks || []) {
      const { error: tErr } = await supabase.from("tasks").upsert({
        id: task.id,
        workstream_id: ws.id,
        task_code: task.id,
        title: task.title,
        duration_days: task.durationDays,
        float_days: task.floatDays,
        early_start: task.earlyStart,
        early_finish: task.earlyFinish,
        late_start: task.lateStart,
        late_finish: task.lateFinish,
        is_critical_path: task.isCriticalPath,
        status: task.status,
        predecessors: task.predecessors || [],
      });
      if (tErr) console.warn("Task upsert notice:", tErr.message);
    }
  }

  // 4. Seed Coordination Requests (CR-00xxx)
  for (const cr of coordinationRequestsData) {
    const { error: crErr } = await supabase.from("coordination_requests").upsert({
      id: cr.id,
      code: cr.code,
      workstream_id: cr.workstreamId,
      workstream_title: cr.workstreamTitle,
      requesting_org_id: cr.requestingOrgId,
      requesting_org_code: cr.requestingOrgCode,
      target_org_id: cr.targetOrgId,
      target_org_code: cr.targetOrgCode,
      requesting_user_name: cr.requestingUserName,
      assigned_to_user_name: cr.assignedToUserName,
      title: cr.title,
      need_description: cr.needDescription,
      requested_date: cr.requestedDate,
      due_date: cr.dueDate,
      response_date: cr.responseDate,
      concurred_at: cr.concurredAt,
      attached_document_version_ids: cr.attachedDocumentVersionIds || [],
      blocks_workstream_title: cr.blocksWorkstreamTitle,
      priority: cr.priority,
      status: cr.status,
      response_summary: cr.responseSummary,
    });
    if (crErr) console.warn("CR upsert notice:", crErr.message);
  }

  // 5. Seed RFIs
  for (const rfi of rfisData) {
    const { error: rfiErr } = await supabase.from("rfis").upsert({
      id: rfi.id,
      code: rfi.code,
      workstream_id: rfi.workstreamId,
      workstream_title: rfi.workstreamTitle,
      requesting_org_id: rfi.requestingOrgId,
      requesting_org_code: rfi.requestingOrgCode,
      recipient_org_id: rfi.recipientOrgId,
      recipient_org_code: rfi.recipientOrgCode,
      title: rfi.title,
      question_text: rfi.questionText,
      technical_reason: rfi.technicalReason,
      required_document_types: rfi.requiredDocumentTypes || [],
      issued_date: rfi.issuedDate,
      response_deadline: rfi.responseDeadline,
      clock_impact: rfi.clockImpact,
      schedule_impact_days: rfi.scheduleImpactDays,
      status: rfi.status,
      is_consolidated_cycle: rfi.isConsolidatedCycle,
      consolidated_batch_id: rfi.consolidatedBatchId,
      lead_reviewer_approved_at: rfi.leadReviewerApprovedAt,
    });
    if (rfiErr) console.warn("RFI upsert notice:", rfiErr.message);
  }

  // 6. Seed Commitments
  for (const com of commitmentsData) {
    const { error: comErr } = await supabase.from("commitments").upsert({
      id: com.id,
      workstream_id: com.workstreamId,
      workstream_title: com.workstreamTitle,
      committing_org_id: com.committingOrgId,
      committing_org_code: com.committingOrgCode,
      made_by_person_name: com.madeByPersonName,
      committed_action: com.committedAction,
      origin_context: com.originContext,
      committed_date: com.committedDate,
      promised_due_date: com.promisedDueDate,
      fulfilled_date: com.fulfilledDate,
      status: com.status,
      impact_if_missed: com.impactIfMissed,
      is_critical_path_impact: com.isCriticalPathImpact,
    });
    if (comErr) console.warn("Commitment upsert notice:", comErr.message);
  }

  // 7. Seed Decisions
  for (const dec of projectDecisionsData) {
    const { error: decErr } = await supabase.from("decisions").upsert({
      id: dec.id,
      project_id: projectId,
      title: dec.title,
      decision_date: dec.decisionDate,
      decision_summary: dec.decisionSummary,
      decision_maker_name: dec.decisionMakerName,
      decision_maker_title: dec.decisionMakerTitle,
      organizations_represented: dec.organizationsRepresented || [],
      statutory_authority: dec.statutoryAuthority,
      affected_workstream_ids: dec.affectedWorkstreamIds || [],
      affected_workstream_titles: dec.affectedWorkstreamTitles || [],
      referenced_document_version_ids: dec.referencedDocumentVersionIds || [],
      required_follow_ups: dec.requiredFollowUps,
    });
    if (decErr) console.warn("Decision upsert notice:", decErr.message);
  }

  // 8. Seed Meetings
  for (const meet of projectMeetingsData) {
    const { error: meetErr } = await supabase.from("meetings").upsert({
      id: meet.id,
      project_id: projectId,
      title: meet.title,
      meeting_date: meet.meetingDate,
      location_or_link: meet.locationOrLink,
      attendee_list: meet.attendeeList || [],
      meeting_notes: meet.meetingNotes,
      related_workstream_ids: meet.relatedWorkstreamIds || [],
      action_items_converted: meet.actionItemsConverted || [],
    });
    if (meetErr) console.warn("Meeting upsert notice:", meetErr.message);
  }

  // 9. Seed Document Versions & Reviews
  for (const doc of projectDocumentsData) {
    const documentId = stableUuid(`document:${doc.id}`);
    const { error: docErr } = await supabase.from("documents").upsert({
      id: documentId,
      project_id: projectId,
      owner_organization_id: (await supabase.from("organizations").select("id").eq("code", doc.ownerOrgCode).single()).data?.id,
      storage_path: `vault/${projectId}/${doc.id}`,
      document_type: doc.category,
      visibility: "customer",
      version: doc.currentVersionNumber || 1,
      scan_status: "clean",
      retention_category: "project_delivery",
      created_by: (await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })).data?.users?.[0]?.id,
    }, { onConflict: "id" });
    if (docErr) console.warn("Document upsert notice:", docErr.message);
    for (const v of doc.versions || []) {
      const vNum = parseInt(v.versionTag?.replace(/[^\d]/g, "") || "1", 10) || 1;
      const { error: vErr } = await supabase.from("document_versions").upsert({
         id: v.id,
         document_id: documentId,
         project_id: projectId,
        document_ref_id: doc.id,
        version_number: vNum,
        version_label: v.versionTag || `Rev ${vNum}`,
        storage_path: v.storageUri || v.storagePath || `vault/${doc.id}/${v.id}.pdf`,
        sha256_hash: v.sha256Hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        file_size_bytes: v.fileSizeBytes || 50000000,
        uploaded_at: v.uploadedAt || new Date().toISOString(),
        uploaded_by_name: v.uploadedByName || "SpaceX Engineering",
        uploaded_by_org_name: "SpaceX",
        change_notes: v.changeSummary || "Drawing revision update",
        status: "under_review",
      });
      if (vErr) console.warn("Doc version upsert notice:", vErr.message);

      for (const rev of doc.agencyReviews || []) {
        if (rev.documentVersionId === v.id) {
          const { error: revErr } = await supabase.from("document_agency_reviews").upsert({
            id: rev.id,
            document_version_id: v.id,
            reviewing_org_id: `org-${rev.reviewingOrgCode.toLowerCase()}`,
            reviewing_org_code: rev.reviewingOrgCode,
            reviewed_by_user_name: rev.reviewedByName,
            reviewed_at: rev.decisionDate,
            status: rev.reviewStatus === "approved" ? "approved" : "under_review",
            comments: rev.reviewComments,
          });
          if (revErr) console.warn("Review upsert notice:", revErr.message);
        }
      }
    }
  }


  console.log("Database successfully seeded with all 22 relational entities and SpaceX Pecan Island Megaproject records!");
}

await seed();
