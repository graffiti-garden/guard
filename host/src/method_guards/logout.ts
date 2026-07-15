import type { MethodGuard } from "../guard";
import LogoutPrompt from "../templates/guard_prompts/LogoutPrompt.vue";
import {
  hasLogoutApproval,
  prompt,
  rememberLogoutApproval,
  type LogoutPromptResult,
} from "./utils";

export const guardLogout: MethodGuard<"logout"> = async (
  _graffiti,
  sourceId,
) => {
  if (hasLogoutApproval(sourceId)) return true;

  const result = await prompt<LogoutPromptResult>(LogoutPrompt, {
    sourceId,
  });
  if (result === "deny") return false;
  if (result === "remember") {
    rememberLogoutApproval(sourceId);
  }

  return true;
};
