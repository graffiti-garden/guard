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

type ClientMethods = {
  sessionEvent(type: string, detail: unknown): Promise<void>;
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

const graffiti = new GraffitiDecentralized();
const loggedInActors = new Set<string>();
const streams = new Map<string, GraffitiObjectStream<{}>>();
let remote: ClientMethods | undefined;
let destroyed = false;

graffiti.sessionEvents.addEventListener("login", (event) => {
  if (!(event instanceof CustomEvent)) return;
  const detail: GraffitiLoginEvent["detail"] = event.detail;
  if (!detail.error) loggedInActors.add(detail.session.actor);
});

graffiti.sessionEvents.addEventListener("logout", (event) => {
  if (!(event instanceof CustomEvent)) return;
  const detail: GraffitiLogoutEvent["detail"] = event.detail;
  if (!detail.error) loggedInActors.delete(detail.actor);
});

const rpcSimpleMethods = Object.fromEntries(
  simpleMethods.map((method) => [
    method,
    (...args: unknown[]) => {
      const fn = graffiti[method] as (...methodArgs: unknown[]) => unknown;
      return fn.apply(graffiti, args);
    },
  ]),
);

const connection = connect<ClientMethods>({
  messenger: new WindowMessenger({
    remoteWindow: window.parent,
    allowedOrigins: ["*"],
  }),
  methods: {
    ...rpcSimpleMethods,
    postMedia(media: SerializedPostMedia, session: GraffitiSession) {
      const data = new Blob([media.data.buffer], { type: media.data.type });
      return graffiti.postMedia({ ...media, data }, session);
    },
    async getMedia(...args: Parameters<Graffiti["getMedia"]>) {
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
    discover(id: string, ...args: Parameters<Graffiti["discover"]>) {
      streams.set(id, graffiti.discover<{}>(...args))
    },
    continueDiscover(
      id: string,
      ...args: Parameters<Graffiti["continueDiscover"]>
    ) {
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
    initialize() {
      for (const actor of loggedInActors) {
        const event: GraffitiLoginEvent = new CustomEvent("login", {
          detail: { session: { actor } },
        });
        forward(event);
      }

      const event: GraffitiSessionInitializedEvent = new CustomEvent(
        "initialized",
      );
      forward(event);
    },
  },
});

connection.promise.then((client) => {
  remote = client;
});

for (const type of sessionEventTypes) {
  graffiti.sessionEvents.addEventListener(type, forward);
}

createApp(Home).mount("#app");

async function destroy() {
  if (destroyed) return;
  destroyed = true;

  for (const type of sessionEventTypes) {
    graffiti.sessionEvents.removeEventListener(type, forward);
  }

  await Promise.allSettled(
    [...streams.values()].map((stream) => stream.return({ cursor: "" })),
  );
  streams.clear();
}

function forward(event: Event) {
  if (destroyed) return;
  if (!(event instanceof CustomEvent)) return;
  void remote?.sessionEvent(event.type, event.detail);
}
