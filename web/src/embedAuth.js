// Popup page for the Loome Portal catalogue embedding: signs in on this origin, where the Entra
// redirect URI is registered, and hands the API token back to the opener via postMessage.
import { getAccessToken } from './auth.js';

async function main() {
    const response = await fetch('/config.json', { cache: 'no-store' });
    const { embedOrigin } = response.ok ? await response.json() : {};
    const requestedOrigin = new URLSearchParams(window.location.search).get('origin');

    // Only the configured Portal origin may receive a token.
    if (!window.opener || !embedOrigin || requestedOrigin !== embedOrigin) {
        document.body.textContent = 'This page can only be opened from Loome Portal.';
        return;
    }

    const token = await getAccessToken();
    window.opener.postMessage({ type: 'tre-api-token', token }, embedOrigin);
    window.close();
}

main().catch((error) => {
    document.body.textContent = `Sign-in failed: ${error.message}`;
});
