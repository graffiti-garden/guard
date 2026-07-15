import type { MethodGuard } from "../guard";
import ObjectPrompt from "../templates/guard_prompts/ObjectPrompt.vue";
import {
  matchesObjectApproval,
  prompt,
  rememberObjectApproval,
  type ObjectPromptResult,
} from "./utils";

export const guardPost: MethodGuard<"post"> = async (
  _graffiti,
  sourceId,
  args,
) => {
  const [object] = args;

  if (matchesObjectApproval(sourceId, object)) return true;

  const result = await prompt<ObjectPromptResult>(ObjectPrompt, {
    sourceId,
    action: "post",
    object,
  });
  if (result.kind === "deny") return false;
  if (result.kind === "allow-like-this") {
    rememberObjectApproval(
      sourceId,
      object,
      result.channels,
      result.allowed,
    );
  }

  return true;
};
