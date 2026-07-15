import type { MethodGuard } from "../guard";
import { guardGeneric } from "./utils";

export const guardDeleteMedia: MethodGuard<"deleteMedia"> = (
  _graffiti,
  sourceId,
  args,
) => guardGeneric(sourceId, "deleteMedia", args);
