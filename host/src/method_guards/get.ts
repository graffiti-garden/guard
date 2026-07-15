import type { MethodGuard } from "../guard";
import ObjectPrompt from "../templates/guard_prompts/ObjectPrompt.vue";
import {
  getObjectForApproval,
  hasGetUrlApproval,
  matchesObjectApproval,
  prompt,
  rememberGetUrlApproval,
  rememberObjectApproval,
  type ObjectPromptResult,
} from "./utils";

export const guardGet: MethodGuard<"get"> = async (
  graffiti,
  sourceId,
  args,
) => {
  if (args[2] == null) return true;

  const [url, _schema, session] = args;

  if (hasGetUrlApproval(sourceId, url)) return true;

  const object = await getObjectForApproval(graffiti, url, session);
  if (matchesObjectApproval(sourceId, object)) return true;

  const result = await prompt<ObjectPromptResult>(ObjectPrompt, {
    sourceId,
    action: "get",
    object,
    exactUrl: true,
  });
  if (result.kind === "deny") return false;
  if (result.kind === "allow-exact-url") {
    rememberGetUrlApproval(sourceId, url);
  }
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
