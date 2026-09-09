import { useEffect, useRef, useState } from "react";

type CredentialResponse = { credential?: string };
type GoogleButtonText = "signin_with" | "signup_with" | "continue_with";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: CredentialResponse) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

let initializedClientId = "";
let activeCredentialHandler: ((credential: string) => void) | null = null;

function initializeGoogle(clientId: string) {
  if (!window.google || initializedClientId) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: response => {
      if (response.credential) activeCredentialHandler?.(response.credential);
    },
  });
  initializedClientId = clientId;
}

export default function GoogleIdentityButton({
  onCredential,
  text = "continue_with",
}: {
  onCredential: (credential: string) => void;
  text?: GoogleButtonText;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    activeCredentialHandler = onCredential;
    if (!clientId) {
      setUnavailable(true);
      return () => { activeCredentialHandler = null; };
    }
    let attempts = 0;
    const render = () => {
      if (window.google && container.current) {
        initializeGoogle(clientId);
        if (initializedClientId !== clientId) {
          setUnavailable(true);
          return;
        }
        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text,
          width: Math.min(400, container.current.clientWidth || 400),
        });
        return;
      }
      attempts += 1;
      if (attempts < 80) window.setTimeout(render, 100);
      else setUnavailable(true);
    };
    render();
    return () => {
      if (activeCredentialHandler === onCredential) activeCredentialHandler = null;
    };
  }, [clientId, onCredential, text]);

  if (unavailable) return <p className="google-config-note">Google sign-in is unavailable until its client ID is configured.</p>;
  return <div className="google-button" ref={container} aria-label="Google account authentication" />;
}
