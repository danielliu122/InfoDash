// User Preferences Management System
class UserPreferences {
    constructor() {
        this.storageKey = 'infoDash_preferences';
        this.defaultPreferences = {
            weatherLocation: '',
            financeWatchlist: [],
            newsCountry: 'US',
            newsLanguage: 'en',
            trendsCountry: 'US',
            trendsLanguage: 'en',
            theme: 'light',
            lastNewsCategory: 'top-headlines',
            lastTrendsCategory: 'daily'
        };
        this.preferences = this.loadPreferences();
    }

    // Helper function to set a cookie
    setCookie(name, value, days = 365) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; samesite=Lax`;
    }

    // Helper function to get a cookie
    getCookie(name) {
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

    // Helper function to delete a cookie
    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    // Check if cookies are accepted
    isCookiesAccepted() {
        return this.getCookie('cookiesAccepted') === 'true';
    }

    // Check if cookies are declined
    isCookiesDeclined() {
        return this.getCookie('cookiesDeclined') === 'true';
    }

    // Load preferences from cookies
    loadPreferences() {
        // Don't load preferences if cookies are declined
        if (this.isCookiesDeclined()) {
            return { ...this.defaultPreferences };
        }

        try {
            const stored = this.getCookie(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure financeWatchlist is always an array, even if cleared
                if (parsed.financeWatchlist === undefined) {
                    parsed.financeWatchlist = [];
                }
                return { ...this.defaultPreferences, ...parsed };
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
        return { ...this.defaultPreferences };
    }

    // Save preferences to cookies
    savePreferences() {
        // Don't save preferences if cookies are declined
        if (this.isCookiesDeclined()) {
            // console.log('Preferences not saved: cookies declined');
            return;
        }

        try {
            this.setCookie(this.storageKey, JSON.stringify(this.preferences));
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    // Get a specific preference
    get(key) {
        return this.preferences[key];
    }

    // Set a specific preference
    set(key, value) {
        this.preferences[key] = value;
        this.savePreferences();
    }

    // Update multiple preferences at once
    updateMultiple(updates) {
        this.preferences = { ...this.preferences, ...updates };
        this.savePreferences();
    }

    // Clear all preferences
    clear() {
        // Only reset financeWatchlist if it is not already an empty array
        // This allows external code (like clearWatchlist in finance.js) to clear just the watchlist
        // without it being reset to default on next load
        this.preferences = { ...this.defaultPreferences };
        this.savePreferences();
    }

    // Explicitly clear only the finance watchlist
    clearFinanceWatchlist() {
        this.setFinanceWatchlist([]);
    }

    // Weather location methods
    setWeatherLocation(location) {
        this.set('weatherLocation', location);
        // Only save to cookie if cookies are accepted
        if (this.isCookiesAccepted()) {
            this.setCookie('userWeatherLocation', location); // Keep for backward compatibility
        }
    }

    getWeatherLocation() {
        if (this.isCookiesDeclined()) {
            return '';
        }
        return this.get('weatherLocation') || this.getCookie('userWeatherLocation') || '';
    }

    // Finance watchlist methods
    setFinanceWatchlist(watchlist) {
        // Always set the financeWatchlist, even if it's an empty array
        this.preferences['financeWatchlist'] = Array.isArray(watchlist) ? watchlist : [];
        this.savePreferences();
        // Only save to cookie if cookies are accepted
        if (this.isCookiesAccepted()) {
            this.setCookie('financeWatchlist', JSON.stringify(this.preferences['financeWatchlist'])); // Keep for backward compatibility
        }
    }

    getFinanceWatchlist() {
        if (this.isCookiesDeclined()) {
            return [];
        }

        // Always return the financeWatchlist, even if it's an empty array
        const stored = this.get('financeWatchlist');
        if (Array.isArray(stored)) {
            return stored;
        }
        // Fallback to old storage method
        try {
            const oldStored = this.getCookie('financeWatchlist');
            if (oldStored) {
                const parsed = JSON.parse(oldStored);
                this.setFinanceWatchlist(parsed);
                return parsed;
            }
        } catch (error) {
            console.error('Error loading old watchlist:', error);
        }
        return [];
    }

    // News preferences methods
    setNewsCountry(country) {
        this.set('newsCountry', country);
    }

    getNewsCountry() {
        return this.get('newsCountry');
    }

    setNewsLanguage(language) {
        this.set('newsLanguage', language);
    }

    getNewsLanguage() {
        return this.get('newsLanguage');
    }

    setLastNewsCategory(category) {
        this.set('lastNewsCategory', category);
    }

    getLastNewsCategory() {
        return this.get('lastNewsCategory');
    }

    // Trends preferences methods
    setTrendsCountry(country) {
        this.set('trendsCountry', country);
    }

    getTrendsCountry() {
        return this.get('trendsCountry');
    }

    setTrendsLanguage(language) {
        this.set('trendsLanguage', language);
    }

    getTrendsLanguage() {
        return this.get('trendsLanguage');
    }

    setLastTrendsCategory(category) {
        this.set('lastTrendsCategory', category);
    }

    getLastTrendsCategory() {
        return this.get('lastTrendsCategory');
    }

    // Theme methods
    setTheme(theme) {
        this.set('theme', theme);
    }

    getTheme() {
        return this.get('theme');
    }

    // Apply saved preferences to UI
    applyPreferences() {
        // Apply weather location
        const weatherLocation = this.getWeatherLocation();
        if (weatherLocation) {
            // Update weather location display if it exists
            const locationDisplay = document.querySelector('.weather-location-display');
            if (locationDisplay) {
                locationDisplay.textContent = weatherLocation;
            }
        }

        // Apply news preferences
        const newsCountry = this.getNewsCountry();
        const newsLanguage = this.getNewsLanguage();
        const countrySelect = document.getElementById('countrySelect');
        const languageSelect = document.getElementById('languageSelect');
        
        if (countrySelect && newsCountry) {
            countrySelect.value = newsCountry;
        }
        if (languageSelect && newsLanguage) {
            languageSelect.value = newsLanguage;
        }

        // Apply trends preferences
        const trendsCountry = this.getTrendsCountry();
        const trendsLanguage = this.getTrendsLanguage();
        const trendsCountrySelect = document.getElementById('trendsCountrySelect');
        const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
        
        if (trendsCountrySelect && trendsCountry) {
            trendsCountrySelect.value = trendsCountry;
        }
        if (trendsLanguageSelect && trendsLanguage) {
            trendsLanguageSelect.value = trendsLanguage;
        }

        // Apply theme
        const theme = this.getTheme();
        if (theme) {
            document.body.classList.remove('light-theme', 'dark-theme');
            document.body.classList.add(`${theme}-theme`);
        }

        // console.log('User preferences applied:', this.preferences);
    }

    // Save current UI state to preferences
    saveCurrentState() {
        // Save news preferences
        const countrySelect = document.getElementById('countrySelect');
        const languageSelect = document.getElementById('languageSelect');
        
        if (countrySelect) {
            this.setNewsCountry(countrySelect.value);
        }
        if (languageSelect) {
            this.setNewsLanguage(languageSelect.value);
        }

        // Save trends preferences
        const trendsCountrySelect = document.getElementById('trendsCountrySelect');
        const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
        
        if (trendsCountrySelect) {
            this.setTrendsCountry(trendsCountrySelect.value);
        }
        if (trendsLanguageSelect) {
            this.setTrendsLanguage(trendsLanguageSelect.value);
        }

        // Save theme
        const isDarkTheme = document.body.classList.contains('dark-theme');
        this.setTheme(isDarkTheme ? 'dark' : 'light');

        // console.log('Current state saved to preferences');
    }
}

// Create global instance
const userPrefs = new UserPreferences();

// Export for use in other modules
export { userPrefs, UserPreferences };

// Cookie consent and banner logic
export function showCookieBanner() {
    const banner = document.getElementById('cookie-notification');
    if (banner) {
        banner.style.display = 'block';
        banner.classList.add('show');
    }
}

export function hideCookieBanner() {
    const banner = document.getElementById('cookie-notification');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }
}

export function getCookie(name) {
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

export function acceptCookies() {
    document.cookie = 'cookiesAccepted=true; expires=' + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString() + '; path=/; samesite=Lax';
    document.cookie = 'cookiesDeclined=false; expires=' + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString() + '; path=/; samesite=Lax';
    hideCookieBanner();
    if (window.showNotification) {
        window.showNotification('Cookies accepted! Your preferences will be saved.', 3000);
    }
}

export function declineCookies() {
    document.cookie = 'cookiesAccepted=false; expires=' + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString() + '; path=/; samesite=Lax';
    document.cookie = 'cookiesDeclined=true; expires=' + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString() + '; path=/; samesite=Lax';
    // Clear any existing cookies
    document.cookie = 'userWeatherLocation=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userTheme=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userNewsCountry=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userNewsLanguage=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userTrendsCountry=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userTrendsLanguage=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'userWatchlist=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'infoDash_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'financeWatchlist=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    hideCookieBanner();
    if (window.showNotification) {
        window.showNotification('Cookies declined. No preferences will be saved.', 3000);
    }
}

export function resetCookieConsent() {
    if (!window.confirm('Are you sure you want to reset your cookie consent? You will be prompted again to accept or decline cookies.')) {
        return;
    }
    document.cookie = 'cookiesAccepted=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'cookiesDeclined=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    showCookieBanner();
    if (window.showNotification) {
        window.showNotification('Cookie consent reset. Please accept cookies to save preferences.', 5000);
    } else {
        alert('Cookie consent reset. Please accept cookies to save preferences.');
    }
}

export function checkCookieConsent() {
    const cookiesAccepted = getCookie('cookiesAccepted');
    const cookiesDeclined = getCookie('cookiesDeclined');
    if (!cookiesAccepted && !cookiesDeclined) {
        setTimeout(() => {
            showCookieBanner();
        }, 1000);
    }
}

// Preference management helpers
export function clearAllPreferences() {
    if (!window.confirm('Are you sure you want to clear all your preferences? This will reset your location, watchlist, and other settings. This action cannot be undone.')) {
        return;
    }
    if (window.userPrefs) {
        window.userPrefs.clear();
        // Reset UI elements
        const locationInput = document.getElementById('weatherLocationInput');
        if (locationInput) locationInput.value = '';
        const locationBtn = document.getElementById('set-location-btn');
        if (locationBtn) locationBtn.textContent = '📍 Set Location';
        // Clear weather display
        const weatherContainer = document.getElementById('preferences-weather');
        if (weatherContainer) {
            weatherContainer.innerHTML = '';
        }
        // Refresh the page to apply all changes
        location.reload();
    } else {
        alert('Preferences system not available');
    }
}

export function updatePreferencesDisplay() {
    if (!window.userPrefs) return;
    // Update weather location display
    const locationInput = document.getElementById('weatherLocationInput');
    if (locationInput) {
        const savedLocation = window.userPrefs.getWeatherLocation();
        locationInput.value = savedLocation;
        // Fetch and display weather data if location is saved
        if (savedLocation && window.fetchAndDisplayWeatherInPreferences) {
            window.fetchAndDisplayWeatherInPreferences(savedLocation);
        }
    }
    // Update news settings display
    const currentNewsCountry = document.getElementById('currentNewsCountry');
    const currentNewsLanguage = document.getElementById('currentNewsLanguage');
    if (currentNewsCountry) {
        const country = window.userPrefs.getNewsCountry();
        currentNewsCountry.textContent = country;
    }
    if (currentNewsLanguage) {
        const language = window.userPrefs.getNewsLanguage();
        const languageNames = {
            'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
            'ru': 'Русский', 'zh': '中文', 'ja': '日本語', 'ko': '한국어',
            'pt': 'Português', 'ar': 'العربية', 'hi': 'हिन्दी', 'it': 'Italiano'
        };
        currentNewsLanguage.textContent = languageNames[language] || language;
    }
    // Update theme display
    const currentTheme = document.getElementById('currentTheme');
    if (currentTheme) {
        const theme = window.userPrefs.getTheme();
        currentTheme.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
    // Update watchlist display
    const preferencesWatchlist = document.getElementById('preferencesWatchlist');
    if (preferencesWatchlist) {
        const watchlist = window.userPrefs.getFinanceWatchlist();
        if (watchlist && watchlist.length > 0) {
            preferencesWatchlist.innerHTML = watchlist.map(symbol => 
                `<span class="chip">${symbol}</span>`
            ).join(' ');
        } else {
            preferencesWatchlist.innerHTML = '<p>No stocks in watchlist</p>';
        }
    }
} 

// Ultra-early theme application to prevent flicker
function injectTheme()
    {
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
    let cookieRaw = null;
    try {
        cookieRaw = getCookie('infoDash_preferences');
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

    // Preemptively set <body> class and style as soon as possible
    function applyBodyTheme() {
        if (!document.body) return;
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(savedTheme + '-theme');
        // Remove inline background/color to let CSS take over after initial paint
        document.body.style.background = '';
        document.body.style.color = '';
        // Remove inline styles from <html> so CSS rules can apply
        document.documentElement.style.background = '';
        document.documentElement.style.color = '';
        // Force a reflow to ensure CSS rules are applied immediately
        void document.body.offsetWidth;
    }

    // If body is already available, apply theme class right away
    if (document.body) {
        applyBodyTheme();
    } else {
        // Otherwise, apply as soon as DOM is interactive (before images/styles load)
        document.addEventListener('DOMContentLoaded', function() {
            applyBodyTheme();
        }, { once: true });

        // Also try to catch body as soon as it appears (for even less flicker)
        const observer = new MutationObserver(function() {
            if (document.body) {
                applyBodyTheme();
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
}