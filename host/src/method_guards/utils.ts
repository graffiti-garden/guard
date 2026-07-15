import type {
  Graffiti,
  GraffitiObjectUrl,
  GraffitiPostObject,
  GraffitiSession,
} from "@graffiti-garden/api";
import { inferSchema } from "@jsonhero/schema-infer";
import Ajv, { type ValidateFunction } from "ajv";
import { showComponent } from "../show_component";
import GenericPrompt from "../templates/guard_prompts/GenericPrompt.vue";

export type ApprovableObject = Pick<
  GraffitiPostObject<{}>,
  "value" | "channels" | "allowed"
>;

export type LogoutPromptResult = "deny" | "allow-once" | "remember";

export type ObjectPromptResult =
  | { kind: "deny" }
  | { kind: "allow-once" }
  | { kind: "allow-exact-url" }
  | {
      kind: "allow-like-this";
      channels?: string[];
      allowed?: string[];
    };

export type DiscoverPromptResult =
  | { kind: "deny" }
  | { kind: "allow-once" }
  | { kind: "allow-like-this"; channels?: string[] };

type ObjectApproval = {
  valueMatches: ValidateFunction;
  channels?: string[];
  allowed?: string[];
};

type DiscoverApproval = {
  schemaKey: string;
  channels?: string[];
};

const ajv = new Ajv();
let setFrameVisible: (visible: boolean) => Promise<void> | void = () => {};
const logoutApprovals = new Set<string>();
const objectApprovals = new Map<string, ObjectApproval[]>();
const getUrlApprovals = new Set<string>();
const discoverApprovals = new Map<string, DiscoverApproval[]>();

export function setGuardFrameVisible(
  setter: (visible: boolean) => Promise<void> | void,
) {
  setFrameVisible = setter;
}

export async function prompt<T>(
  component: Parameters<typeof showComponent>[0],
  params: Record<string, unknown>,
) {
  await setFrameVisible(true);

  return new Promise<T>((resolve) => {
    let settled = false;
    const onResolve = async (result: T) => {
      if (settled) return;
      settled = true;
      try {
        await setFrameVisible(false);
      } catch {}
      resolve(result);
    };
    showComponent(component, { ...params, onResolve });
  });
}

export async function guardGeneric(
  sourceId: string,
  method: string,
  args: unknown[],
) {
  return prompt<boolean>(GenericPrompt, { sourceId, method, args });
}

export function hasLogoutApproval(sourceId: string) {
  return logoutApprovals.has(sourceId);
}

export function rememberLogoutApproval(sourceId: string) {
  logoutApprovals.add(sourceId);
}

export function matchesObjectApproval(
  sourceId: string,
  object: ApprovableObject,
) {
  return objectApprovals
    .get(sourceId)
    ?.some(
      (approval) =>
        approval.valueMatches(object.value) &&
        matchesStringScope(object.channels, approval.channels) &&
        matchesStringScope(object.allowed ?? undefined, approval.allowed),
    );
}

export function rememberObjectApproval(
  sourceId: string,
  object: ApprovableObject,
  channels: string[] | undefined,
  allowed: string[] | undefined,
) {
  let approvals = objectApprovals.get(sourceId);
  if (!approvals) {
    approvals = [];
    objectApprovals.set(sourceId, approvals);
  }
  approvals.push(createObjectApproval(object, channels, allowed));
}

export function hasGetUrlApproval(
  sourceId: string,
  url: string | GraffitiObjectUrl,
) {
  return getUrlApprovals.has(getUrlApprovalKey(sourceId, url));
}

export function rememberGetUrlApproval(
  sourceId: string,
  url: string | GraffitiObjectUrl,
) {
  getUrlApprovals.add(getUrlApprovalKey(sourceId, url));
}

export function matchesDiscoverApproval(
  sourceId: string,
  channels: string[],
  schema: unknown,
) {
  const schemaKey = stableStringify(schema);
  return discoverApprovals
    .get(sourceId)
    ?.some(
      (approval) =>
        approval.schemaKey === schemaKey &&
        matchesStringScope(channels, approval.channels),
    );
}

export function rememberDiscoverApproval(
  sourceId: string,
  channels: string[] | undefined,
  schema: unknown,
) {
  const schemaKey = stableStringify(schema);
  let approvals = discoverApprovals.get(sourceId);
  if (!approvals) {
    approvals = [];
    discoverApprovals.set(sourceId, approvals);
  }
  approvals.push({ schemaKey, channels });
}

export async function getObjectForApproval(
  graffiti: Graffiti,
  url: string | GraffitiObjectUrl,
  session: GraffitiSession | null | undefined,
) {
  return graffiti.get<{}>(url, {}, session);
}

function createObjectApproval(
  object: ApprovableObject,
  channels: string[] | undefined,
  allowed: string[] | undefined,
): ObjectApproval {
  return {
    valueMatches: ajv.compile(inferSchema(object.value).toJSONSchema()),
    channels,
    allowed,
  };
}

function getUrlApprovalKey(sourceId: string, url: string | GraffitiObjectUrl) {
  return `${sourceId}:${stableStringify(url)}`;
}

function matchesStringScope(
  values: string[] | undefined,
  scope: string[] | undefined,
) {
  if (scope === undefined) return true;
  return Array.isArray(values) && values.every((value) => scope.includes(value));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value !== "object" || value == null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
