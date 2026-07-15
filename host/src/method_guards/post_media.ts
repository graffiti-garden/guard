import type { MethodGuard } from "../guard";
import { guardGeneric } from "./utils";

export const guardPostMedia: MethodGuard<"postMedia"> = (
  _graffiti,
  sourceId,
  args,
) => guardGeneric(sourceId, "postMedia", args);
