import type { MethodGuard } from "../guard";
import ObjectPrompt from "../templates/guard_prompts/ObjectPrompt.vue";
import {
  getObjectForApproval,
  matchesObjectApproval,
  prompt,
  rememberObjectApproval,
  type ObjectPromptResult,
} from "./utils";

export const guardDelete: MethodGuard<"delete"> = async (
  graffiti,
  sourceId,
  args,
) => {
  const [url, session] = args;

  const object = await getObjectForApproval(graffiti, url, session);
  if (matchesObjectApproval(sourceId, object)) return true;

  const result = await prompt<ObjectPromptResult>(ObjectPrompt, {
    sourceId,
    action: "delete",
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
