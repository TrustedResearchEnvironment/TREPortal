// Microsoft Entra ID sign-in for the API. The login opens in a popup because the app runs inside
// the Loome iframe and Microsoft's login page cannot be framed.
import { LogLevel, PublicClientApplication } from '@azure/msal-browser';

let contextPromise = null;
let signInPromise = null;

// Resolves to null when /config.json has no IDs (local dev), which leaves sign-in off.
async function createContext() {
    let config;
    try {
        const response = await fetch('/config.json', { cache: 'no-store' });
        config = response.ok ? await response.json() : null;
    } catch {
        config = null;
    }
    if (!config?.clientId || !config?.tenantId) return null;

    const msal = new PublicClientApplication({
        auth: {
            clientId: config.clientId,
            authority: `https://login.microsoftonline.com/${config.tenantId}`,
            redirectUri: `${window.location.origin}/auth-redirect.html`,
        },
        cache: { cacheLocation: 'localStorage' },
        system: {
            // Open the popup once the login URL is ready; a popup opened early can stay on about:blank.
            asyncPopups: true,
            // Run localStorage.setItem('msalDebug', '1') in the console to see MSAL's own log.
            loggerOptions: {
                logLevel: LogLevel.Verbose,
                loggerCallback: (level, message, containsPii) => {
                    if (!containsPii && localStorage.getItem('msalDebug')) console.log('[msal]', message);
                },
            },
        },
    });
    await msal.initialize();
    return { msal, scopes: [`api://${config.clientId}/access_as_user`] };
}

async function signInWithPopup({ msal, scopes }) {
    const result = await msal.loginPopup({ scopes });
    msal.setActiveAccount(result.account);
    return result.accessToken;
}

// Fallback for when the browser blocks the automatic popup (no user click) or it was closed.
function promptSignIn(context, notice) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;'
            + 'align-items:center;justify-content:center;gap:12px;background:#fff;font-family:Roboto,Arial,sans-serif;';

        const title = document.createElement('div');
        title.textContent = 'Sign in to continue';
        title.style.cssText = 'font-size:20px;';

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Sign in with Microsoft';
        button.style.cssText = 'padding:10px 20px;font-size:16px;cursor:pointer;';

        const message = document.createElement('div');
        message.textContent = notice;
        message.style.cssText = 'color:#b00020;min-height:1.2em;';

        button.addEventListener('click', async () => {
            button.disabled = true;
            message.textContent = '';
            try {
                const token = await signInWithPopup(context);
                overlay.remove();
                resolve(token);
            } catch {
                message.textContent = 'Sign-in did not complete. Please try again.';
                button.disabled = false;
            }
        });

        overlay.append(title, button, message);
        document.body.append(overlay);
    });
}

/** Returns an access token for the API, or null when Entra sign-in is not configured. */
export async function getAccessToken() {
    contextPromise ??= createContext();
    const context = await contextPromise;
    if (!context) return null;

    const { msal, scopes } = context;
    const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
    if (account) {
        try {
            const result = await msal.acquireTokenSilent({ scopes, account });
            return result.accessToken;
        } catch {
            // Expired session or blocked silent renewal: fall through to an interactive sign-in.
        }
    }

    signInPromise ??= signInWithPopup(context)
        .catch((error) => {
            console.warn('Automatic sign-in popup did not complete:', error?.errorCode ?? error);
            return promptSignIn(context, 'The sign-in window was blocked or closed.');
        })
        .finally(() => {
            signInPromise = null;
        });
    return signInPromise;
}
