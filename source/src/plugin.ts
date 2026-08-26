import { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { UserQuestionService } from "@deepseek-ai/dsh-user-questions";
import "@deepseek-ai/dsh-user-approval";
import "@deepseek-ai/dsh-user-questions";
import { createProjectDesignKeeper } from "./index.js";
import { registerKeeperTools, type NativeKeeperService } from "./tools/keeper-tools.js";
import type { KeeperLimitOverrides } from "./security/limits.js";

/**
 * DeepSeek Harness plugin entry for Project Design Keeper.
 *
 * Mounts the nine former MCP tools as first-party harness tools on
 * `ctx.tools`. Apply approval flows through the harness approval seam and,
 * by default, an additional human digest confirmation through
 * `ctx.userQuestions`; both fail closed when unavailable.
 */

export const name = "project-design-keeper";
export const inject = ["tools", "approval"];

/** Plugin configuration (all optional). */
export interface Config {
  /** Keeper cache directory; defaults to the platform cache location. */
  cacheDirectory?: string;
  /** Home directory used for platform cache resolution. */
  homeDirectory?: string;
  /** Whether apply requires the human to type the digest suffix. Defaults to true. */
  requireDigestConfirmation?: boolean;
  /** Bounded resource-limit overrides for keeper operations. */
  limits?: KeeperLimitOverrides;
}

export const Config = z.object({
  cacheDirectory: z.string(),
  homeDirectory: z.string(),
  requireDigestConfirmation: z.boolean().default(true),
  limits: z.any()
});

export function apply(ctx: Context, config: Config = {}): void {
  const runtime = createProjectDesignKeeper({
    cacheDirectory: config.cacheDirectory,
    homeDirectory: config.homeDirectory,
    limits: config.limits
  });
  // The user-questions service definition is optional in the composition:
  // digest confirmation degrades to a hard refusal when it is absent.
  const userQuestions = ctx.get("userQuestions", false) as UserQuestionService | undefined;
  registerKeeperTools(
    (tool) => {
      ctx.tools.register(tool);
    },
    runtime as unknown as NativeKeeperService,
    {
      approval: ctx.approval,
      ...(userQuestions !== undefined ? { userQuestions } : {}),
      requireDigestConfirmation: config.requireDigestConfirmation ?? true
    }
  );
}

// NOTE: no default export. The Cordis loader unwraps `module.default` and would
// then lose the named `name`/`inject`/`Config` exports, breaking service
// injection. Named exports only.

