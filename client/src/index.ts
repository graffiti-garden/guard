import {
  Graffiti,
  type GraffitiMedia,
  type GraffitiObjectStream,
  type GraffitiPostMedia,
  type GraffitiSession,
} from "@graffiti-garden/api";
import {
  CallOptions,
  connect,
  type RemoteProxy,
  WindowMessenger,
} from "penpal";

type MethodsOf<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

type SerializedMedia = Omit<GraffitiMedia, "data"> & {
  data: { buffer: ArrayBuffer; type: string };
};

type SerializedPostMedia = Omit<GraffitiPostMedia, "data"> & {
  data: { buffer: ArrayBuffer; type: string };
};

type RPCMethods = MethodsOf<Graffiti> & {
  getMedia: (...args: Parameters<Graffiti["getMedia"]>) => Promise<SerializedMedia>;
  postMedia: (
    media: SerializedPostMedia,
    session: GraffitiSession,
  ) => Promise<string>;
  discover: (id: string, ...args: Parameters<Graffiti["discover"]>) => void;
  continueDiscover: (
    id: string,
    ...args: Parameters<Graffiti["continueDiscover"]>
  ) => void;
  streamNext: (id: string) => ReturnType<GraffitiObjectStream<{}>["next"]>;
  streamReturn: (id: string) => void;
  initialize: () => void;
  destroy: () => void;
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

/**
 * A thin Graffiti client that forwards all operations to a guard iframe.
 */
// @ts-ignore - simple methods are attached programmatically in the constructor.
export class GraffitiGuarded extends Graffiti {
  readonly sessionEvents = new EventTarget();
  private readonly connection: { destroy(): void };
  private readonly remote_: Promise<RemoteProxy<RPCMethods>>;

  constructor(options: { hostUrl: string | URL }) {
    super();

    const hostUrl = new URL(options.hostUrl.toString(), document.baseURI);
    const iframe = document.createElement("iframe");
    iframe.src = hostUrl.href;
    iframe.title = "Graffiti Guard";
    iframe.style.display = "none";
    document.body.append(iframe);

    if (iframe.contentWindow == null) {
      throw new Error("Could not create Graffiti guard iframe.");
    }

    const connection = connect<RPCMethods>({
      messenger: new WindowMessenger({
        remoteWindow: iframe.contentWindow,
        allowedOrigins: [hostUrl.origin],
      }),
      methods: {
        sessionEvent: (type: string, detail: unknown) => {
          this.sessionEvents.dispatchEvent(new CustomEvent(type, { detail }));
        },
      },
    });

    this.connection = {
      destroy() {
        connection.destroy();
        iframe.remove();
      },
    };
    this.remote_ = connection.promise;

    for (const method of simpleMethods) {
      (this as any)[method] = async (...args: unknown[]) => {
        const remote = await this.remote();
        const fn = remote[method] as (...methodArgs: unknown[]) => unknown;
        return fn(...clone(args));
      };
    }

    setTimeout(async () => (await this.remote()).initialize(), 0);
  }

  destroy() {
    void this.remote()
      .then((remote) => remote.destroy())
      .catch(() => {});
    this.connection.destroy();
  }

  private remote() {
    return this.remote_;
  }

  getMedia: Graffiti["getMedia"] = async (...args) => {
    const remote = await this.remote();
    const result = await remote.getMedia(...clone(args));
    return {
      ...result,
      data: new Blob([result.data.buffer], { type: result.data.type }),
    };
  };

  postMedia: Graffiti["postMedia"] = async (...args) => {
    const [media, session] = args;
    const buffer = await media.data.arrayBuffer();
    const remote = await this.remote();

    return remote.postMedia(
      {
        ...clone(media),
        data: { buffer, type: media.data.type },
      },
      clone(session),
      new CallOptions({ transferables: [buffer] }),
    );
  };

  protected remoteStream(
    startStream: (remote: RemoteProxy<RPCMethods>, id: string) => Promise<void>,
  ): GraffitiObjectStream<{}> {
    const id = crypto.randomUUID();

    return (async function* (remotePromise: Promise<RemoteProxy<RPCMethods>>) {
      const remote = await remotePromise;
      try {
        await startStream(remote, id);
        while (true) {
          const result = await remote.streamNext(id);
          if (result.done) return result.value;
          yield result.value;
        }
      } finally {
        await remote.streamReturn(id);
      }
    })(this.remote());
  }

  // @ts-ignore - Graffiti schema inference is preserved at the boundary.
  discover: Graffiti["discover"] = (...args) => {
    return this.remoteStream((remote, id) => remote.discover(id, ...clone(args)));
  };

  // @ts-ignore - Graffiti schema inference is preserved at the boundary.
  continueDiscover: Graffiti["continueDiscover"] = (...args) => {
    return this.remoteStream((remote, id) =>
      remote.continueDiscover(id, ...clone(args)),
    );
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
