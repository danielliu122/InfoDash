(function () {
    // Helper to get cookie value
    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    }

    // Try to get theme from cookie, fallback to light
    let savedTheme = 'light';
    try {
        const cookieRaw = getCookie('infoDash_preferences');
        if (cookieRaw) {
            const parsed = JSON.parse(cookieRaw);
            if (parsed && parsed.theme) savedTheme = parsed.theme;
        }
    } catch (e) {
        // fallback to light
    }

    // Remove any previous theme classes from <html>
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    // Apply theme class to <html> immediately
    document.documentElement.classList.add(savedTheme + '-theme');

    // Set background and color directly on <html> to prevent flash
    if (savedTheme === 'dark') {
        document.documentElement.style.background = '#181a1b';
        document.documentElement.style.color = '#eee';
    } else {
        document.documentElement.style.background = '#f7f8fa';
        document.documentElement.style.color = '#222';
    }

    // Preemptively set <body> theme ASAP
    function applyBodyTheme() {
        if (!document.body) return;
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(savedTheme + '-theme');
        // Remove inline styles so CSS can take over
        document.body.style.background = '';
        document.body.style.color = '';
        document.documentElement.style.background = '';
        document.documentElement.style.color = '';
        void document.body.offsetWidth; // force reflow
    }

    if (document.body) {
        applyBodyTheme();
    } else {
        document.addEventListener('DOMContentLoaded', applyBodyTheme, { once: true });
        const observer = new MutationObserver(() => {
            if (document.body) {
                applyBodyTheme();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
