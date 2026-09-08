import type { DemoPersona } from "./demo-data";
import {
  getOperationalPersona,
  type OperationalPersona,
  type OperationalWorkItem,
  type WorkActionId,
} from "./operational-ux";

export interface ActionDescriptor {
  actionId: WorkActionId;
  label: string;
  isPrimary: boolean;
  eligible: boolean;
  disabledReason?: string;
  requiredFields: string[];
  commandName: string;
  recipientPreview?: string;
  expectedResult: string;
}

export function getActionDescriptor(
  actionId: WorkActionId,
  item: OperationalWorkItem,
  personaInput: OperationalPersona | DemoPersona
): ActionDescriptor {
  const persona =
    "workspace" in personaInput && typeof personaInput.workspace === "string"
      ? (personaInput as OperationalPersona)
      : getOperationalPersona(personaInput as DemoPersona);
  const isCustomer = persona.isCustomer;
  const isSupervisorOrAbove =
    persona.workspace === "supervisor" ||
    persona.workspace === "state_office" ||
    persona.workspace === "admin" ||
    (persona.permissions?.includes("triage_intake") ?? false);

  switch (actionId) {
    case "request_clarification": {
      if (item.kind === "customer_request") {
        const canClarify = isSupervisorOrAbove;
        return {
          actionId,
          label: "Request clarification",
          isPrimary: !item.workstreamId && canClarify,
          eligible: canClarify,
          disabledReason: canClarify
            ? undefined
            : "Only project office coordinators or administrators can request customer clarification.",
          requiredFields: ["notes"],
          commandName: "request_customer_intake_clarification",
          recipientPreview: item.submittedByName ?? "Customer Submitter (SpaceX)",
          expectedResult:
            "Request status updates to Pending Customer and routes directly to the submitter.",
        };
      }
      // RFI response clarification
      return {
        actionId,
        label: "Request RFI clarification",
        isPrimary: false,
        eligible: !isCustomer && Boolean(item.hasRfiResponse),
        disabledReason: item.hasRfiResponse
          ? undefined
          : "No customer response has been submitted to clarify.",
        requiredFields: ["questionText", "questionDueDate"],
        commandName: "create_rfi_clarification",
        recipientPreview: "SpaceX Regulatory Engineering",
        expectedResult: "A linked follow-up RFI is issued to the applicant.",
      };
    }

    case "request_information": {
      const hasWorkstream = Boolean(item.workstreamId);
      const eligible = !isCustomer && hasWorkstream;
      return {
        actionId,
        label: "Request information (RFI)",
        isPrimary: false,
        eligible,
        disabledReason: hasWorkstream
          ? undefined
          : "Request Information requires a linked workstream. Use Request Clarification for unrouted intake requests.",
        requiredFields: ["questionText", "questionDueDate", "technicalReason"],
        commandName: "create_rfi",
        recipientPreview: "SpaceX Regulatory Engineering",
        expectedResult: "Issues an audited RFI and pauses the statutory review clock.",
      };
    }

    case "accept_rfi_response": {
      const eligible = !isCustomer && Boolean(item.hasRfiResponse);
      return {
        actionId,
        label: "Accept RFI response",
        isPrimary: eligible,
        eligible,
        disabledReason: eligible
          ? undefined
          : "A submitted applicant response is required before acceptance.",
        requiredFields: ["notes"],
        commandName: "accept_rfi_response",
        recipientPreview: "Applicant (SpaceX)",
        expectedResult: "Accepts the response, clears the RFI hold, and resumes the review.",
      };
    }

    case "respond": {
      if (item.kind === "customer_request") {
        const eligible = isCustomer && (item.itsmState === "pending_customer" || item.statusLabel.toLowerCase().includes("pending"));
        return {
          actionId,
          label: "Submit clarification",
          isPrimary: eligible,
          eligible,
          disabledReason: eligible
            ? undefined
            : "Clarification is not currently requested from the customer.",
          requiredFields: ["responseText"],
          commandName: "respond_customer_intake_clarification",
          recipientPreview: "State Project Office",
          expectedResult: "Clarification is submitted and returns to the project office triage queue.",
        };
      }
      // RFI response
      const eligible = isCustomer && !item.hasRfiResponse;
      return {
        actionId,
        label: "Submit RFI response",
        isPrimary: eligible,
        eligible,
        disabledReason: eligible
          ? undefined
          : "A response has already been submitted or you are not authorized to respond.",
        requiredFields: ["responseText"],
        commandName: "submit_rfi_response",
        recipientPreview: item.ownerOrganization || "Reviewing Agency",
        expectedResult: "Submits the technical response and uploaded documents to the reviewing agency.",
      };
    }

    case "complete_step": {
      const eligible = !isCustomer && Boolean(item.requiresCurrentUserAction);
      return {
        actionId,
        label: "Complete step",
        isPrimary: eligible,
        eligible,
        disabledReason: eligible
          ? undefined
          : "Prerequisites incomplete or item is not ready for completion.",
        requiredFields: ["notes"],
        commandName: "complete_step",
        recipientPreview: item.nextHandoff ?? "Downstream stage lead",
        expectedResult: "Advances workflow to the next scheduled stage or marks work complete.",
      };
    }

    case "mark_blocked": {
      return {
        actionId,
        label: "Mark blocked",
        isPrimary: false,
        eligible: !isCustomer,
        disabledReason: undefined,
        requiredFields: ["reason", "waitingOn"],
        commandName: "mark_blocked",
        recipientPreview: "Project Delivery Team & Applicant",
        expectedResult: "Flags schedule risk, updates project health, and notifies stakeholders.",
      };
    }

    case "clear_blocker": {
      return {
        actionId,
        label: "Clear blocker",
        isPrimary: !isCustomer && item.statusTone === "red",
        eligible: !isCustomer,
        disabledReason: undefined,
        requiredFields: ["resolutionNotes"],
        commandName: "clear_blocker",
        recipientPreview: "Project Delivery Team",
        expectedResult: "Clears the blocking impediment and resumes workflow execution.",
      };
    }

    default: {
      return {
        actionId,
        label: actionId.replaceAll("_", " "),
        isPrimary: false,
        eligible: true,
        requiredFields: [],
        commandName: actionId,
        expectedResult: "Executes the selected operational transition.",
      };
    }
  }
}

export function getActionDescriptors(
  item: OperationalWorkItem,
  persona: OperationalPersona | DemoPersona,
  availableActionIds: WorkActionId[]
): ActionDescriptor[] {
  return availableActionIds.map((actionId) => getActionDescriptor(actionId, item, persona));
}

export function getPrimaryActionDescriptor(
  item: OperationalWorkItem,
  persona: OperationalPersona | DemoPersona,
  availableActionIds: WorkActionId[]
): ActionDescriptor | null {
  const descriptors = getActionDescriptors(item, persona, availableActionIds);
  return descriptors.find((d) => d.isPrimary && d.eligible) ?? descriptors.find((d) => d.eligible) ?? null;
}
