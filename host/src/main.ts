import type {
  Graffiti,
  GraffitiLoginEvent,
  GraffitiLogoutEvent,
  GraffitiMedia,
  GraffitiObjectStream,
  GraffitiPostMedia,
  GraffitiSession,
  GraffitiSessionInitializedEvent,
} from "@graffiti-garden/api";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import { connect, Reply, WindowMessenger } from "penpal";
import { createApp } from "vue";
import Home from "./Home.vue";
import { handleLoginRedirect, isLoginRedirect } from "./login_redirect";
import { showComponent } from "./show_component";
import { activateStorageAccess } from "./storage_access";
import Status from "./templates/Status.vue";

type ClientMethods = {
  sessionEvent(type: string, detail: unknown): Promise<void>;
  setFrameVisible(visible: boolean): Promise<void>;
};

type SerializedMedia = Omit<GraffitiMedia, "data"> & {
  data: { buffer: ArrayBuffer; type: string };
};

type SerializedPostMedia = Omit<GraffitiPostMedia, "data"> & {
  data: { buffer: ArrayBuffer; type: string };
};

const simpleMethods = [
  "post",
  "get",
  "delete",
  "deleteMedia",
  "login",
  "logout",
  "actorToHandle",
  "handleToActor",
] as const;
const sessionEventTypes = ["login", "logout", "initialized"] as const;

const pageUrl = new URL(window.location.href);
const remoteWindow = window.parent !== window ? window.parent : undefined;

const loggedInActors = new Set<string>();
const streams = new Map<string, GraffitiObjectStream<{}>>();
let destroyed = false;
let graffiti: GraffitiDecentralized | undefined;
let remote: ClientMethods | undefined;
let remoteReady: Promise<ClientMethods> | undefined;
let rpcConnection: { destroy(): void } | undefined;

createApp(Home).mount("#app");

if (remoteWindow !== undefined) {
  startRpcHost();
} else if (isLoginRedirect(pageUrl)) {
  void handleLoginRedirect({ pageUrl, graffiti: startGraffiti() });
} else {
  showComponent(Status, {
    message: "Open this page from an app using Graffiti Guard.",
  });
}

function startGraffiti() {
  if (graffiti !== undefined) return graffiti;

  graffiti = new GraffitiDecentralized();
  graffiti.sessionEvents.addEventListener("login", onLogin);
  graffiti.sessionEvents.addEventListener("logout", onLogout);
  for (const type of sessionEventTypes) {
    graffiti.sessionEvents.addEventListener(type, forward);
  }
  return graffiti;
}

async function getGraffiti() {
  if (graffiti !== undefined) return graffiti;
  if (remoteWindow !== undefined) await activateStorageAccess(setFrameVisible);
  return startGraffiti();
}

function startRpcHost() {
  if (remoteWindow === undefined) return;
  const rpcSimpleMethods = Object.fromEntries(
    simpleMethods.map((method) => [
      method,
      async (...args: unknown[]) => {
        const graffiti = await getGraffiti();
        const fn = graffiti[method] as (...methodArgs: unknown[]) => unknown;
        return fn.apply(graffiti, args);
      },
    ]),
  );

  rpcConnection?.destroy();
  const connection = connect<ClientMethods>({
    messenger: new WindowMessenger({
      remoteWindow,
      allowedOrigins: ["*"],
    }),
    methods: {
      ...rpcSimpleMethods,
      async postMedia(media: SerializedPostMedia, session: GraffitiSession) {
        const graffiti = await getGraffiti();
        const data = new Blob([media.data.buffer], { type: media.data.type });
        return graffiti.postMedia({ ...media, data }, session);
      },
      async getMedia(...args: Parameters<Graffiti["getMedia"]>) {
        const graffiti = await getGraffiti();
        const result = await graffiti.getMedia(...args);
        const buffer = await result.data.arrayBuffer();
        const type = result.data.type;

        return new Reply(
          {
            ...result,
            data: { buffer, type },
          } satisfies SerializedMedia,
          { transferables: [buffer] },
        );
      },
      async discover(id: string, ...args: Parameters<Graffiti["discover"]>) {
        const graffiti = await getGraffiti();
        streams.set(id, graffiti.discover<{}>(...args));
      },
      async continueDiscover(
        id: string,
        ...args: Parameters<Graffiti["continueDiscover"]>
      ) {
        const graffiti = await getGraffiti();
        streams.set(id, graffiti.continueDiscover<{}>(...args));
      },
      streamNext(id: string) {
        return streams.get(id)?.next();
      },
      async streamReturn(id: string) {
        await streams.get(id)?.return({ cursor: "" });
        streams.delete(id);
      },
      async destroy() {
        await destroy();
      },
      async initialize() {
        const replayExistingSessions = graffiti !== undefined;
        await getGraffiti();
        if (!replayExistingSessions) return;
        replaySessions();
      },
    },
  });
  rpcConnection = connection;

  remoteReady = connection.promise.then((client) => {
    remote = client;
    showComponent(Status, { message: "Graffiti Guard iframe connected." });
    return client;
  });
  remoteReady.catch(() => {});
}

async function setFrameVisible(visible: boolean) {
  const client = remote ?? (await remoteReady);
  await client?.setFrameVisible(visible);
}

function onLogin(event: Event) {
  if (!(event instanceof CustomEvent)) return;
  const detail = event.detail as GraffitiLoginEvent["detail"];
  if (!detail.error) loggedInActors.add(detail.session.actor);
}

function onLogout(event: Event) {
  if (!(event instanceof CustomEvent)) return;
  const detail: GraffitiLogoutEvent["detail"] = event.detail;
  if (!detail.error) loggedInActors.delete(detail.actor);
}

async function destroy() {
  if (destroyed) return;
  destroyed = true;
  rpcConnection?.destroy();

  for (const type of sessionEventTypes) {
    graffiti?.sessionEvents.removeEventListener(type, forward);
  }
  graffiti?.sessionEvents.removeEventListener("login", onLogin);
  graffiti?.sessionEvents.removeEventListener("logout", onLogout);

  await Promise.allSettled(
    [...streams.values()].map((stream) => stream.return({ cursor: "" })),
  );
  streams.clear();
}

function replaySessions() {
  for (const actor of loggedInActors) {
    const event: GraffitiLoginEvent = new CustomEvent("login", {
      detail: { session: { actor } },
    });
    forward(event);
  }

  const event: GraffitiSessionInitializedEvent = new CustomEvent("initialized");
  forward(event);
}

function forward(event: Event) {
  if (destroyed) return;
  if (!(event instanceof CustomEvent)) return;
  void remote?.sessionEvent(event.type, event.detail);
}
