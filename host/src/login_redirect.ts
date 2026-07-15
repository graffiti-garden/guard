import type { Graffiti, GraffitiLoginEvent } from "@graffiti-garden/api";
import { showComponent } from "./show_component";
import Status from "./templates/Status.vue";

type HandleLoginOptions = {
  pageUrl: URL;
  graffiti: Graffiti;
};

const redirectUrlStorageKey = "graffiti-guard-redirect-url";
const redirectUrlStorageMaxAge = 10 * 60 * 1000;

export function isLoginRedirect(pageUrl: URL) {
  return isStartingLogin(pageUrl) || getStoredRedirectUrl() !== null;
}

export async function handleLoginRedirect({
  pageUrl,
  graffiti,
}: HandleLoginOptions) {
  const redirectUrl = getRedirectUrl(pageUrl);
  if (redirectUrl === null) {
    showComponent(Status, { message: "Missing redirect URL." });
    return;
  }

  const startingLogin = isStartingLogin(pageUrl);
  const completingLogin = !startingLogin;
  let initialized = false;
  let shouldRedirect = false;

  const redirectIfReady = () => {
    if (!initialized || !shouldRedirect) return;
    clearStoredRedirectUrl();
    window.location.assign(redirectUrl);
  };

  showComponent(Status, {
    message: completingLogin ? "Completing login..." : "Opening login...",
  });
  graffiti.sessionEvents.addEventListener("login", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as GraffitiLoginEvent["detail"];
    if (detail.error && !loginWasManuallyCanceled(detail)) return;
    if (!initialized && !completingLogin) return;
    shouldRedirect = true;
    redirectIfReady();
  });
  graffiti.sessionEvents.addEventListener("initialized", () => {
    initialized = true;
    redirectIfReady();
  });

  if (startingLogin) {
    await graffiti.login(pageUrl.searchParams.get("suggestedActor") ?? undefined);
  }
}

function isStartingLogin(pageUrl: URL) {
  return pageUrl.searchParams.get("guardLogin") === "1";
}

function getRedirectUrl(pageUrl: URL) {
  const redirectUrl = pageUrl.searchParams.get("redirectUrl");
  if (redirectUrl !== null) {
    setStoredRedirectUrl(redirectUrl);
    return redirectUrl;
  }

  return getStoredRedirectUrl();
}

function setStoredRedirectUrl(redirectUrl: string) {
  const value = JSON.stringify({
    redirectUrl,
    expiresAt: Date.now() + redirectUrlStorageMaxAge,
  });
  sessionStorage.setItem(redirectUrlStorageKey, value);
  localStorage.setItem(redirectUrlStorageKey, value);
}

function getStoredRedirectUrl() {
  return readStoredRedirectUrl(sessionStorage) ?? readStoredRedirectUrl(localStorage);
}

function readStoredRedirectUrl(storage: Storage) {
  const value = storage.getItem(redirectUrlStorageKey);
  if (value === null) return null;

  try {
    const parsed = JSON.parse(value) as {
      redirectUrl?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.redirectUrl === "string" &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed.redirectUrl;
    }
  } catch {
    clearStoredRedirectUrl();
    return null;
  }

  clearStoredRedirectUrl();
  return null;
}

function clearStoredRedirectUrl() {
  sessionStorage.removeItem(redirectUrlStorageKey);
  localStorage.removeItem(redirectUrlStorageKey);
}

function loginWasManuallyCanceled(detail: GraffitiLoginEvent["detail"]) {
  return (
    detail.error !== undefined &&
    (detail as GraffitiLoginEvent["detail"] & { manual?: boolean }).manual ===
      true
  );
}
