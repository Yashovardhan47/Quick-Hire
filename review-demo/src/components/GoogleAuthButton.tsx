import { useEffect, useRef, useState } from "react";


type GoogleCredentialResponse = { credential: string };
type GoogleButtonText = "signin_with" | "signup_with" | "continue_with";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; shape: string; text: GoogleButtonText; width: number },
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let activeCredentialHandler: ((credential: string) => void) | null = null;
let initializedClientId: string | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-quickhire-google]");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google sign-in could not load")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.quickhireGoogle = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google sign-in could not load"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect();
}

export default function GoogleAuthButton({
  clientId,
  onCredential,
  onError,
  text = "continue_with",
  width = 360,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  text?: GoogleButtonText;
  width?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlerRef = useRef(onCredential);
  const [loading, setLoading] = useState(true);
  handlerRef.current = onCredential;

  useEffect(() => {
    activeCredentialHandler = credential => handlerRef.current(credential);
    let cancelled = false;
    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: response => activeCredentialHandler?.(response.credential),
            use_fedcm_for_prompt: true,
          });
          initializedClientId = clientId;
        }
        containerRef.current.replaceChildren();
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text,
          width,
        });
        setLoading(false);
      })
      .catch(reason => {
        if (!cancelled) onError(reason instanceof Error ? reason.message : "Google sign-in could not load");
      });
    return () => {
      cancelled = true;
      activeCredentialHandler = null;
    };
  }, [clientId, onError, text, width]);

  return <div className="google-button-slot" aria-busy={loading} ref={containerRef} />;
}
