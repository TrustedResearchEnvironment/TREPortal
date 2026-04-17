/**
 * Unified Requests Dashboard - Tab switching with lazy-loaded iframes.
 *
 * Each tab maps to one existing dashboard loaded in its own iframe,
 * keeping global variables fully isolated between dashboards.
 * Iframes are lazy-loaded on first activation to avoid unnecessary API calls.
 */
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const frames = {
        'data-access': document.getElementById('frame-data-access'),
        'import': document.getElementById('frame-import'),
        'export': document.getElementById('frame-export')
    };

    // The first tab is loaded immediately via its src attribute
    const loadedFrames = new Set(['data-access']);

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update active tab button
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show the selected frame, hide others
            Object.entries(frames).forEach(([id, frame]) => {
                if (id === tabId) {
                    frame.classList.add('active');
                    // Lazy-load: set iframe src on first activation
                    if (!loadedFrames.has(id) && frame.dataset.src) {
                        frame.src = frame.dataset.src;
                        loadedFrames.add(id);
                    }
                } else {
                    frame.classList.remove('active');
                }
            });
        });
    });

    // Track ResizeObservers per frame to avoid leaks on reload
    const observers = new Map();

    // Auto-resize iframes to match their content height
    Object.values(frames).forEach(frame => {
        frame.addEventListener('load', () => {
            resizeFrame(frame);
        });
    });

    function resizeFrame(frame) {
        // Disconnect any previous observer for this frame
        if (observers.has(frame)) {
            observers.get(frame).disconnect();
            observers.delete(frame);
        }

        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            const newHeight = doc.documentElement.scrollHeight;
            if (newHeight > 0) {
                frame.style.height = newHeight + 'px';
            }

            // Watch for dynamic content changes (accordion expansion, pagination, etc.)
            if (typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(() => {
                    const h = doc.documentElement.scrollHeight;
                    if (h > 0) {
                        frame.style.height = h + 'px';
                    }
                });
                observer.observe(doc.body);
                observers.set(frame, observer);
            }
        } catch (e) {
            // Cross-origin fallback: keep the min-height from CSS
            console.warn('Cannot auto-resize iframe:', e.message);
        }
    }
});
