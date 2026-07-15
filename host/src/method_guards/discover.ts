import type { MethodGuard } from "../guard";
import DiscoverPrompt from "../templates/guard_prompts/DiscoverPrompt.vue";
import {
  matchesDiscoverApproval,
  prompt,
  rememberDiscoverApproval,
  type DiscoverPromptResult,
} from "./utils";

export const guardDiscover: MethodGuard<"discover"> = async (
  _graffiti,
  sourceId,
  args,
) => {
  if (args[2] == null) return true;

  const [channels, schema] = args;

  if (matchesDiscoverApproval(sourceId, channels, schema)) return true;

  const result = await prompt<DiscoverPromptResult>(DiscoverPrompt, {
    sourceId,
    channels,
    schema,
  });
  if (result.kind === "deny") return false;
  if (result.kind === "allow-like-this") {
    rememberDiscoverApproval(sourceId, result.channels, schema);
  }

  return true;
};
