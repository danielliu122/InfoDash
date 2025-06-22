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
            console.log('Preferences not saved: cookies declined');
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
        this.preferences = { ...this.defaultPreferences };
        this.savePreferences();
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
        this.set('financeWatchlist', watchlist);
        // Only save to cookie if cookies are accepted
        if (this.isCookiesAccepted()) {
            this.setCookie('financeWatchlist', JSON.stringify(watchlist)); // Keep for backward compatibility
        }
    }

    getFinanceWatchlist() {
        if (this.isCookiesDeclined()) {
            return [];
        }
        
        const stored = this.get('financeWatchlist');
        if (stored && stored.length > 0) {
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

        console.log('User preferences applied:', this.preferences);
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

        console.log('Current state saved to preferences');
    }
}

// Create global instance
const userPrefs = new UserPreferences();

// Export for use in other modules
export { userPrefs, UserPreferences }; 