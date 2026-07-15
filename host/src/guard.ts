import type { Graffiti } from "@graffiti-garden/api";
import { guardContinueDiscover } from "./method_guards/continue_discover";
import { guardDelete } from "./method_guards/delete";
import { guardDeleteMedia } from "./method_guards/delete_media";
import { guardDiscover } from "./method_guards/discover";
import { guardGet } from "./method_guards/get";
import { guardGetMedia } from "./method_guards/get_media";
import { guardLogout } from "./method_guards/logout";
import { guardPost } from "./method_guards/post";
import { guardPostMedia } from "./method_guards/post_media";
import { setGuardFrameVisible } from "./method_guards/utils";

export { setGuardFrameVisible };

export type GraffitiMethod = {
  [K in keyof Graffiti]: Graffiti[K] extends (...args: any[]) => unknown
    ? K
    : never;
}[keyof Graffiti] &
  string;

export type GraffitiArgs<T extends GraffitiMethod> = Graffiti[T] extends (
  ...args: infer Args
) => unknown
  ? Args
  : never;

export type MethodGuard<T extends GraffitiMethod> = (
  graffiti: Graffiti,
  sourceId: string,
  args: GraffitiArgs<T>,
) => boolean | Promise<boolean>;

type GuardsByMethod = { [T in GraffitiMethod]: MethodGuard<T> };

let promptQueue: Promise<void> = Promise.resolve();

const guardsByMethod: GuardsByMethod = {
  login: allow,
  actorToHandle: allow,
  handleToActor: allow,
  post: guardPost,
  get: guardGet,
  delete: guardDelete,
  logout: guardLogout,
  discover: guardDiscover,
  getMedia: guardGetMedia,
  continueDiscover: guardContinueDiscover,
  postMedia: guardPostMedia,
  deleteMedia: guardDeleteMedia,
};

export async function guardGraffitiCall<T extends GraffitiMethod>(
  graffiti: Graffiti,
  method: T,
  args: GraffitiArgs<T>,
) {
  return guardRequest(method, () => guard(graffiti, method, getSourceId(), args));
}

async function guard<T extends GraffitiMethod>(
  graffiti: Graffiti,
  method: T,
  sourceId: string,
  args: GraffitiArgs<T>,
) {
  if (isUnguardedEnvironment()) return true;

  return guardsByMethod[method](graffiti, sourceId, args);
}

function allow() {
  return true;
}

async function guardRequest(method: string, run: () => Promise<boolean>) {
  const approved = await enqueuePrompt(run);
  if (approved) return;

  throw new Error(`The user denied ${method} request.`);
}

function enqueuePrompt<T>(run: () => Promise<T>) {
  const pending = promptQueue.then(run, run);
  promptQueue = pending.then(
    () => {},
    () => {},
  );
  return pending;
}

function isUnguardedEnvironment() {
  return typeof document === "undefined";
}

function getSourceId() {
  if (typeof document === "undefined") return "unknown-client";
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {}
  return "unknown-client";
}
