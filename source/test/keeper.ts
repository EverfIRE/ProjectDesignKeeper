import { createProjectDesignKeeper } from "../src/index.js";
import type { ServiceOptions } from "../src/types/schema.js";

export const approveAllForTest: NonNullable<ServiceOptions["trustedApprovalProvider"]> = async () => ({
  approved: true
});

export function createTrustedTestKeeper(options: ServiceOptions = {}) {
  return createProjectDesignKeeper({
    ...options,
    trustedApprovalProvider: options.trustedApprovalProvider ?? approveAllForTest
  });
}
