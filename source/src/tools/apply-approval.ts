import type { CallId } from "@deepseek-ai/dsh-llm";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { ApprovalService } from "@deepseek-ai/dsh-user-approval";
import type { UserQuestionService } from "@deepseek-ai/dsh-user-questions";
import { assertStringWithin } from "../security/limits.js";
import type { ApplyAuthorization, ChangesetApprovalBinding } from "../security/approval.js";

/**
 * Approval adaptation for the native DeepSeek Harness plugin.
 *
 * The former MCP layer authenticated apply requests through the MCP
 * elicitation capability (a form demanding the final eight digest characters).
 * DeepSeek Harness has no MCP elicitation, so the same confirmation semantics
 * are replayed on the harness's own capability seams:
 *
 * 1. `ctx.approval.request(...)` asks the session's composed answerers
 *    (policy `ask`) with the full changeset summary as the reason; every
 *    non-grant outcome fails the apply closed.
 * 2. When `requireDigestConfirmation` is enabled, `ctx.userQuestions.ask(...)`
 *    additionally demands the final eight hexadecimal digest characters typed
 *    by the human (or the literal `decline`), preserving the original
 *    digest-match guarantee that a model could not approve on its own.
 *
 * The issued capability is then consumed by the keeper transaction layer
 * exactly as before; the binding equality, expiry, and identity checks are
 * unchanged.
 */

/** Message shown to the human for one authenticated changeset. */
export function approvalMessage(binding: ChangesetApprovalBinding): string {
  const escapeFormatControls = (value: string): string => value.replace(
    /[\u007f-\u009f\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`
  );
  const summaryJson = escapeFormatControls(JSON.stringify({
    root: binding.root,
    changesetId: binding.changesetId,
    diffDigest: binding.diffDigest,
    expiresAt: new Date(binding.expiresAt).toISOString(),
    summary: binding.summary,
    paths: binding.paths,
    archiveActions: binding.archiveActions,
    semanticDecisionIds: binding.semanticDecisionIds
  }, null, 2));
  const message = [
    "Approve this authenticated Project Design Keeper changeset?",
    summaryJson,
    `Select approve and type the final eight hexadecimal digest characters: ${binding.diffDigest.slice(-8)}`
  ].join("\n");
  assertStringWithin("Approval summary", message, 1024 * 1024);
  return message;
}

/** Digest suffix a human must type to approve (lower-case hex). */
export function approvalDigestSuffix(binding: ChangesetApprovalBinding): string {
  return binding.diffDigest.slice(-8);
}

/** Services the apply tool may use to elicit approval. */
export interface ApplyApprovalServices {
  /** Session approval seam (`ctx.approval`); must be mounted. */
  approval: ApprovalService;
  /** UI question seam (`ctx.userQuestions`); required only for digest confirmation. */
  userQuestions?: UserQuestionService;
  /** Whether the human must additionally type the digest suffix. */
  requireDigestConfirmation: boolean;
}

/** Execution identity the approval flow needs from the tool call. */
export interface ApplyCallIdentity {
  callId: CallId;
  agent?: Agent;
  signal: AbortSignal;
}

export interface ElicitedApproval {
  authorization: ApplyAuthorization;
  requestIdentity: object;
}

/** Stable brand for authorizations issued by this native plugin. */
const requestIdentityBase = Object.freeze({ source: "dsh-plugin" });

/**
 * Elicit human approval for one authenticated changeset and return an apply
 * authorization consumable by the keeper transaction layer. Every refusal,
 * cancellation, unavailable answerer, missing agent, or digest mismatch throws
 * and leaves the changeset untouched.
 */
export async function elicitApplyApproval(
  services: ApplyApprovalServices,
  issueAuthorization: (binding: ChangesetApprovalBinding, requestIdentity: object) => ApplyAuthorization,
  binding: ChangesetApprovalBinding,
  identity: ApplyCallIdentity
): Promise<ElicitedApproval> {
  if (identity.agent === undefined) {
    throw new Error("Apply approval requires a live calling agent; refusing to apply without one");
  }
  const requestIdentity = Object.freeze({
    ...requestIdentityBase,
    callId: identity.callId,
    agentId: identity.agent.id
  });

  const outcome = await services.approval.request({
    agent: identity.agent,
    toolName: "apply_update",
    callId: identity.callId,
    reason: approvalMessage(binding),
    signal: identity.signal
  });
  if (outcome !== "allowed-once") {
    throw new Error(approvalOutcomeMessage(outcome));
  }

  if (services.requireDigestConfirmation) {
    await confirmDigest(services, binding, identity);
  }

  return {
    authorization: issueAuthorization(binding, requestIdentity),
    requestIdentity
  };
}

function approvalOutcomeMessage(outcome: string): string {
  switch (outcome) {
    case "rejected":
      return "Apply approval was declined";
    case "cancelled":
      return "Apply approval was cancelled";
    case "unavailable":
      return "Apply approval is unavailable in this session (no answerer); the apply request is rejected";
    default:
      return `Apply approval returned an unexpected outcome: ${outcome}`;
  }
}

async function confirmDigest(
  services: ApplyApprovalServices,
  binding: ChangesetApprovalBinding,
  identity: ApplyCallIdentity
): Promise<void> {
  const userQuestions = services.userQuestions;
  if (userQuestions === undefined) {
    throw new Error(
      "Digest confirmation requires the user-questions capability, which is not mounted in this session; "
      + "the apply request is rejected. Disable digest confirmation only when a trusted approval provider is used."
    );
  }
  const suffix = approvalDigestSuffix(binding);
  const summaryJson = JSON.stringify({
    root: binding.root,
    changesetId: binding.changesetId,
    diffDigest: binding.diffDigest,
    expiresAt: new Date(binding.expiresAt).toISOString(),
    summary: binding.summary,
    paths: binding.paths,
    archiveActions: binding.archiveActions,
    semanticDecisionIds: binding.semanticDecisionIds
  }, null, 2);
  const answer = await userQuestions.ask({
    agent: identity.agent,
    signal: identity.signal,
    questions: [{
      id: "keeper-apply-digest",
      header: "Apply approval",
      question: `Approve this Project Design Keeper changeset? Type the final eight hexadecimal digest characters (${suffix}) to approve, or type "decline" to refuse.`,
      detail: summaryJson
    }]
  });
  const item = answer.answers.find((entry) => entry.id === "keeper-apply-digest");
  const custom = item?.custom?.trim().toLowerCase() ?? "";
  if (custom === "decline") throw new Error("Apply approval was declined");
  if (!/^[a-f0-9]{8}$/u.test(custom) || custom !== suffix) {
    throw new Error("Apply approval digest confirmation does not match");
  }
}
