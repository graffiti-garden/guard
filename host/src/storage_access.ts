type StorageAccessHandleSubset = {
  indexedDB?: IDBFactory;
  localStorage?: Storage;
};

type DocumentWithStorageAccess = Document & {
  hasStorageAccess?: () => Promise<boolean>;
  requestStorageAccess?: {
    (): Promise<void>;
    (types: {
      cookies: true;
      indexedDB: true;
      localStorage: true;
    }): Promise<StorageAccessHandleSubset>;
  };
};
type RequestStorageAccess = NonNullable<
  DocumentWithStorageAccess["requestStorageAccess"]
>;

const storageTypes = {
  cookies: true,
  indexedDB: true,
  localStorage: true,
} as const;

let storageAccess: Promise<void> | undefined;

export async function activateStorageAccess(
  setFrameVisible: (visible: boolean) => Promise<void> | void = () => {},
) {
  storageAccess ??= (async () => {
    const storageDocument = document as DocumentWithStorageAccess;
    const requestStorageAccess =
      storageDocument.requestStorageAccess?.bind(document);
    if (requestStorageAccess === undefined) return;

    if (await tryActivateStorageAccess(requestStorageAccess)) return;

    await requestStorageAccessWithPrompt(setFrameVisible, requestStorageAccess);
  })();
  return storageAccess;
}

async function tryActivateStorageAccess(
  requestStorageAccess: RequestStorageAccess,
) {
  try {
    await requestAndInstallStorageAccess(requestStorageAccess);
    return true;
  } catch {
    const hasStorageAccess = await (
      document as DocumentWithStorageAccess
    ).hasStorageAccess?.();
    return hasStorageAccess === true;
  }
}

async function requestAndInstallStorageAccess(
  requestStorageAccess: RequestStorageAccess,
) {
  // Durable sessions are cookie-backed. These handles are nice-to-have cache
  // access when a browser supports typed Storage Access requests.
  try {
    installStorageHandle(await requestStorageAccess(storageTypes));
  } catch {
    await requestStorageAccess();
  }
}

async function requestStorageAccessWithPrompt(
  setFrameVisible: (visible: boolean) => Promise<void> | void,
  requestStorageAccess: RequestStorageAccess,
) {
  await setFrameVisible(true);

  return new Promise<void>((resolve, reject) => {
    renderStorageAccessPrompt();
    const button = document.querySelector<HTMLButtonElement>(
      "#graffiti-guard-storage-access",
    );
    button?.addEventListener("click", async () => {
      try {
        await requestAndInstallStorageAccess(requestStorageAccess);
        await setFrameVisible(false);
        resolve();
      } catch (error) {
        renderStorageAccessError();
        reject(error);
      }
    });
  });
}

function installStorageHandle(handle: StorageAccessHandleSubset | undefined) {
  if (handle?.localStorage !== undefined) {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: handle.localStorage,
    });
  }
  if (handle?.indexedDB !== undefined) {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: handle.indexedDB,
    });
  }
}

function renderStorageAccessPrompt() {
  const app = document.querySelector("#app");
  if (app === null) return;
  app.innerHTML = `
    <main>
      <h1>Graffiti Guard</h1>
      <p>This app needs access to your Graffiti session.</p>
      <button id="graffiti-guard-storage-access">Continue</button>
    </main>
  `;
}

function renderStorageAccessError() {
  const app = document.querySelector("#app");
  if (app === null) return;
  app.innerHTML = `
    <main>
      <h1>Graffiti Guard</h1>
      <p>Storage access was not granted. Reload the app to try again.</p>
    </main>
  `;
}
