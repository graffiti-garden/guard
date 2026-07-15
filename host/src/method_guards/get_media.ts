import type { MethodGuard } from "../guard";
import { guardGeneric } from "./utils";

export const guardGetMedia: MethodGuard<"getMedia"> = (
  _graffiti,
  sourceId,
  args,
) => {
  if (args[2] == null) return true;
  return guardGeneric(sourceId, "getMedia", args);
};
