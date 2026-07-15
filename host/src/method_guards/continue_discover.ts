import type { MethodGuard } from "../guard";
import { guardGeneric } from "./utils";

export const guardContinueDiscover: MethodGuard<"continueDiscover"> = (
  _graffiti,
  sourceId,
  args,
) => {
  if (args[1] == null) return true;
  return guardGeneric(sourceId, "continueDiscover", args);
};
