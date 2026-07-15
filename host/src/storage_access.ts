type StorageAccessHandleSubset = {
  indexedDB?: IDBFactory;
  localStorage?: Storage;
};

type DocumentWithStorageAccess = Document & {
  hasStorageAccess?: () => Promise<boolean>;
  requestStorageAccess?: {
    (): Promise<void>;
    (types: {
      indexedDB: true;
      localStorage: true;
    }): Promise<StorageAccessHandleSubset>;
  };
};

const storageTypes = { indexedDB: true, localStorage: true } as const;

let storageAccess: Promise<void> | undefined;

export async function activateStorageAccess() {
  storageAccess ??= (async () => {
    const storageDocument = document as DocumentWithStorageAccess;
    const hasStorageAccess =
      (await storageDocument.hasStorageAccess?.()) === true;

    const requestStorageAccess =
      storageDocument.requestStorageAccess?.bind(document);
    if (requestStorageAccess === undefined) return;

    try {
      installStorageHandle(await requestStorageAccess(storageTypes));
    } catch (error) {
      if (error instanceof TypeError && !hasStorageAccess) {
        await requestStorageAccess().catch(() => {});
      }
    }
  })();
  return storageAccess;
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
