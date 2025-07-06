// geolocation.js - Handles IP geolocation and region switching

import { userPrefs } from './userPreferences.js';

// Country to language mapping
const COUNTRY_TO_LANGUAGE = {
    'US': 'en', 'CA': 'en', 'GB': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en',
    'ES': 'es', 'MX': 'es', 'AR': 'es', 'CL': 'es', 'CO': 'es', 'PE': 'es',
    'FR': 'fr', 'CA': 'fr', // Canada supports both
    'DE': 'de', 'AT': 'de', 'CH': 'de',
    'IT': 'it',
    'PT': 'pt', 'BR': 'pt',
    'RU': 'ru',
    'JP': 'jp',
    'KR': 'ko',
    'CN': 'zh',
    'AR': 'ar', 'SA': 'ar', 'EG': 'ar',
    'IN': 'hi',
    'NL': 'nl',
    'SE': 'sv',
    'NO': 'no',
    'FI': 'fi',
    'DK': 'da',
    'PL': 'pl',
    'CZ': 'cs',
    'HU': 'hu',
    'GR': 'el',
    'TR': 'tr',
    'TH': 'th',
    'VN': 'vi',
    'ID': 'id',
    'MY': 'ms',
    'PH': 'tl',
    'ZA': 'af',
    'IL': 'he',
    'IR': 'fa',
    'BD': 'bn',
    'IN': 'ml', // Kerala
    'NP': 'ne',
    'UA': 'uk',
    'AZ': 'az',
    'GE': 'ka',
    'RO': 'ro',
    'RS': 'sr',
    'MK': 'mk',
    'SI': 'sl',
    'SK': 'sk',
    'EE': 'et',
    'IS': 'is'
};

// Language names mapping
const LANGUAGE_NAMES = {
    'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
    'ru': 'Русский', 'zh': '中文', 'jp': '日本語', 'ko': '한국어',
    'pt': 'Português', 'ar': 'العربية', 'hi': 'हिन्दी', 'it': 'Italiano',
    'nl': 'Nederlands', 'sv': 'Svenska', 'no': 'Norsk', 'fi': 'Suomi',
    'da': 'Dansk', 'pl': 'Polski', 'cs': 'Čeština', 'hu': 'Magyar',
    'el': 'Ελληνικά', 'tr': 'Türkçe', 'th': 'ไทย', 'vi': 'Tiếng Việt',
    'id': 'Bahasa Indonesia', 'ms': 'Bahasa Melayu', 'tl': 'Filipino',
    'af': 'Afrikaans', 'he': 'עברית', 'fa': 'فارسی', 'bn': 'বাংলা',
    'ml': 'മലയാളം', 'ne': 'नेपाली', 'uk': 'Українська', 'az': 'Azərbaycan dili',
    'ka': 'ქართული', 'ro': 'Română', 'sr': 'Српски', 'mk': 'Македонски',
    'sl': 'Slovenščina', 'sk': 'Slovenčina', 'et': 'Eesti', 'is': 'Íslenska'
};

// Country names mapping
const COUNTRY_NAMES = {
    'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'AU': 'Australia',
    'NZ': 'New Zealand', 'IE': 'Ireland', 'ES': 'España', 'MX': 'México',
    'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
    'FR': 'France', 'DE': 'Deutschland', 'AT': 'Austria', 'CH': 'Switzerland',
    'IT': 'Italia', 'PT': 'Portugal', 'BR': 'Brasil', 'RU': 'Россия',
    'JP': '日本', 'KR': '한국', 'CN': '中国', 'SA': 'السعودية',
    'IN': 'भारत', 'VN': 'Việt Nam', 'TH': 'ไทย', 'ID': 'Indonesia',
    'TR': 'Türkiye', 'PL': 'Polska', 'NL': 'Nederland', 'SE': 'Sverige',
    'NO': 'Norge', 'FI': 'Suomi', 'DK': 'Danmark', 'CZ': 'Česko',
    'HU': 'Magyarország', 'GR': 'Ελλάδα', 'RO': 'România', 'UA': 'Україна',
    'IL': 'ישראל', 'IR': 'ایران', 'BD': 'বাংলাদেশ', 'NP': 'नेपाल',
    'AZ': 'Azərbaycan', 'GE': 'საქართველო', 'RS': 'Србија', 'MK': 'Македонија',
    'SI': 'Slovenija', 'SK': 'Slovensko', 'EE': 'Eesti', 'IS': 'Ísland'
};

// Flag emoji mapping
const COUNTRY_FLAGS = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'AU': '🇦🇺', 'NZ': '🇳🇿', 'IE': '🇮🇪',
    'ES': '🇪🇸', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴', 'PE': '🇵🇪',
    'FR': '🇫🇷', 'DE': '🇩🇪', 'AT': '🇦🇹', 'CH': '🇨🇭', 'IT': '🇮🇹', 'PT': '🇵🇹',
    'BR': '🇧🇷', 'RU': '🇷🇺', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'SA': '🇸🇦',
    'IN': '🇮🇳', 'VN': '🇻🇳', 'TH': '🇹🇭', 'ID': '🇮🇩', 'TR': '🇹🇷', 'PL': '🇵🇱',
    'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮', 'DK': '🇩🇰', 'CZ': '🇨🇿',
    'HU': '🇭🇺', 'GR': '🇬🇷', 'RO': '🇷🇴', 'UA': '🇺🇦', 'IL': '🇮🇱', 'IR': '🇮🇷',
    'BD': '🇧🇩', 'NP': '🇳🇵', 'AZ': '🇦🇿', 'GE': '🇬🇪', 'RS': '🇷🇸', 'MK': '🇲🇰',
    'SI': '🇸🇮', 'SK': '🇸🇰', 'EE': '🇪🇪', 'IS': '🇮🇸'
};

let currentLanguage = 'en';
let currentCountry = 'US';

// Function to detect user's location via IP
async function detectUserLocation() {
    try {
        console.log('Detecting user location...');
        const response = await fetch('/api/geolocation');
        const data = await response.json();
        
        if (data.success) {
            console.log('Location detected:', data);
            
            // Auto-set weather location if user doesn't have one set
            const currentWeatherLocation = userPrefs.getWeatherLocation();
            if (!currentWeatherLocation && data.city) {
                // Create a location string with city and region/country
                let locationString = data.city;
                if (data.region && data.region !== data.city) {
                    locationString += `, ${data.region}`;
                } else if (data.country && data.country !== 'US') {
                    locationString += `, ${data.country}`;
                }
                
                console.log(`Auto-setting weather location to: ${locationString}`);
                userPrefs.setWeatherLocation(locationString);
                userPrefs.savePreferences();
                
                // Update weather display after a short delay
                setTimeout(() => {
                    if (window.displayCurrentWeather) {
                        window.displayCurrentWeather();
                    }
                }, 2000);
            }
            
            return {
                country: data.suggestedCountry,
                language: data.suggestedLanguage,
                city: data.city,
                region: data.region
            };
        } else {
            console.log('Location detection failed, using defaults');
            return {
                country: 'US',
                language: 'en',
                city: null,
                region: null
            };
        }
    } catch (error) {
        console.error('Error detecting location:', error);
        return {
            country: 'US',
            language: 'en',
            city: null,
            region: null
        };
    }
}

// Function to set region and update UI
async function setRegion(language, country) {
    console.log(`Setting region: ${language}-${country}`);
    
    currentLanguage = language;
    currentCountry = country;
    
    // Update user preferences
    userPrefs.setNewsLanguage(language);
    userPrefs.setTrendsCountry(country);
    userPrefs.setTrendsLanguage(language);
    
    // Update UI elements first
    updateRegionDropdown(language, country);
    updateRegionInfo(language, country);
    updateDropdowns(language, country);
    
    // Small delay to ensure dropdowns are updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Refresh data
    await refreshAllSections();
    
    // Save preferences
    userPrefs.savePreferences();
}

// Function to update region dropdown selection
function updateRegionDropdown(language, country) {
    const regionSelect = document.getElementById('regionSelect');
    if (regionSelect) {
        // Find the option that matches the language and country
        const options = regionSelect.querySelectorAll('option');
        for (let option of options) {
            const optionLanguage = option.getAttribute('data-language');
            const optionCountry = option.getAttribute('data-country');
            
            if (optionLanguage === language && optionCountry === country) {
                regionSelect.value = option.value;
                break;
            }
        }
        
        // Trigger Materialize update if available
        if (window.M && window.M.FormSelect) {
            M.FormSelect.init(regionSelect);
        }
    }
}

// Function to update region info display (now handled by dropdown)
function updateRegionInfo(language, country) {
    // The dropdown now shows the current selection, so this function is no longer needed
    // The dropdown label and selected option will show the current region
    console.log(`Region updated: ${language}-${country}`);
}

// Function to update dropdowns
function updateDropdowns(language, country) {
    console.log(`updateDropdowns: Updating dropdowns with language=${language}, country=${country}`);
    
    // Update news language select
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = language;
        console.log(`updateDropdowns: Set languageSelect.value to ${language}`);
        // Trigger Materialize update
        if (window.M && window.M.FormSelect) {
            M.FormSelect.init(languageSelect);
        }
    }
    
    // Update news country select
    const countrySelect = document.getElementById('countrySelect');
    if (countrySelect) {
        countrySelect.value = country;
        console.log(`updateDropdowns: Set countrySelect.value to ${country}`);
        // Trigger Materialize update
        if (window.M && window.M.FormSelect) {
            M.FormSelect.init(countrySelect);
        }
    }
    
    // Update trends section with new region
    if (window.setTrendsRegion) {
        console.log(`updateDropdowns: Calling setTrendsRegion(${language}, ${country})`);
        window.setTrendsRegion(language, country);
    }
    
    console.log(`updateDropdowns: Updated dropdowns: language=${language}, country=${country}`);
}

// Function to refresh all sections with new region
async function refreshAllSections() {
    try {
        console.log(`refreshAllSections: Refreshing with language=${currentLanguage}, country=${currentCountry}`);
        
        // Refresh news with current language and country
        if (window.refreshNews) {
            // Update the dropdowns first so refreshNews picks up the new values
            const languageSelect = document.getElementById('languageSelect');
            const countrySelect = document.getElementById('countrySelect');
            
            if (languageSelect) languageSelect.value = currentLanguage;
            if (countrySelect) countrySelect.value = currentCountry;
            
            // Trigger Materialize update if available
            if (window.M && window.M.FormSelect) {
                if (languageSelect) M.FormSelect.init(languageSelect);
                if (countrySelect) M.FormSelect.init(countrySelect);
            }
            
            await window.refreshNews();
            
            // Update news mode indicator
            if (window.updateNewsModeIndicator) {
                window.updateNewsModeIndicator();
            }
        }
        
        // Refresh trends with current language and country
        if (window.setTrendsRegion) {
            await window.setTrendsRegion(currentLanguage, currentCountry);
        }
        
        // Refresh summary if it exists
        if (window.loadOrGenerateTodaySummary) {
            await window.loadOrGenerateTodaySummary();
        }
        
        console.log('All sections refreshed with new region');
    } catch (error) {
        console.error('Error refreshing sections:', error);
    }
}

// Function to initialize geolocation and region dropdown
async function initializeGeolocation() {
    console.log('Initializing geolocation...');
    
    // Set up region dropdown event listener
    const regionSelect = document.getElementById('regionSelect');
    if (regionSelect) {
        regionSelect.addEventListener('change', async (event) => {
            const selectedOption = event.target.options[event.target.selectedIndex];
            const language = selectedOption.getAttribute('data-language');
            const country = selectedOption.getAttribute('data-country');
            await setRegion(language, country);
        });
    }
    
    // Check if user has saved preferences
    const savedLanguage = userPrefs.getNewsLanguage();
    const savedCountry = userPrefs.getTrendsCountry();
    
    if (savedLanguage && savedCountry) {
        console.log('Using saved preferences:', savedLanguage, savedCountry);
        await setRegion(savedLanguage, savedCountry);
        
        // Still detect location for weather if no weather location is set
        const currentWeatherLocation = userPrefs.getWeatherLocation();
        if (!currentWeatherLocation) {
            console.log('No weather location set, detecting for weather...');
            const location = await detectUserLocation();
            // Note: detectUserLocation will auto-set weather location if city is available
        }
    } else {
        // Detect location and set region
        console.log('No saved preferences, detecting location...');
        const location = await detectUserLocation();
        await setRegion(location.language, location.country);
    }
}

// Function to get current region info
function getCurrentRegion() {
    return {
        language: currentLanguage,
        country: currentCountry
    };
}

// Export functions
export { 
    initializeGeolocation, 
    setRegion, 
    getCurrentRegion, 
    detectUserLocation,
    COUNTRY_TO_LANGUAGE,
    LANGUAGE_NAMES,
    COUNTRY_NAMES,
    COUNTRY_FLAGS
};

// Global function for HTML onchange handler
export async function handleRegionChange() {
    const regionSelect = document.getElementById('regionSelect');
    if (regionSelect) {
        const selectedOption = regionSelect.options[regionSelect.selectedIndex];
        const language = selectedOption.getAttribute('data-language');
        const country = selectedOption.getAttribute('data-country');
        await setRegion(language, country);
    }
}

// Make functions globally available
window.setRegion = setRegion;
window.getCurrentRegion = getCurrentRegion; 