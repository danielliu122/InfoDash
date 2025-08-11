import { updateChartTheme} from './finance.js';
import { fetchNewsData, updateNews, updateNewsModeIndicator } from './news.js';
import { fetchTrendsData, updateTrends, initializeTrends, setTrendsRegion } from './trends.js'; // Import from trends.js
import { userPrefs } from './userPreferences.js'; // Import user preferences
import { initializeGeolocation } from './geolocation.js'; // Import geolocation functionality
import { initializeWeatherAutoRefresh, updateHeaderWeather } from './weather.js';

// Remove old weather logic (fetchWeatherData, updateHeaderWeather, initializeWeather, getUserLocationForWeather, etc.)

// Function to initialize weather display
async function initializeWeather() {
    try {
        const location = await userPrefs.getWeatherLocation() || 'New York, NY'; // Use user preference or default
        updateHeaderWeather(location); // Pass location string to updateHeaderWeather
        
        // Start weather refresh interval (every 10 minutes)
        if (initializeWeatherAutoRefresh) { // Check if initializeWeatherAutoRefresh is imported
            initializeWeatherAutoRefresh();
        }
        
    } catch (error) {
        console.error('Error initializing weather:', error);
        updateHeaderWeather(null);
    }
}

// Function to update weather location
async function updateWeatherLocation(newLocation) {
    userPrefs.setWeatherLocation(newLocation);
    updateHeaderWeather(newLocation);
}

// Function to handle weather display click
function handleWeatherClick() {
    const newLocation = prompt('Enter your location for weather updates (e.g., "New York, NY" or "London, UK"):', userPrefs.getWeatherLocation() || 'New York, NY');
    
    if (newLocation && newLocation.trim()) {
        updateWeatherLocation(newLocation.trim());
        
        // Show notification if available
        if (window.showNotification) {
            window.showNotification(`Weather location updated to ${newLocation.trim()}`, 3000);
        }
    }
}

// Make weather functions globally available
window.updateWeatherLocation = updateWeatherLocation;
window.initializeWeather = initializeWeather;
window.handleWeatherClick = handleWeatherClick;

// Make functions globally available immediately for HTML onclick handlers
window.handleButtonClick = async function(type, category, subCategory = 'all') {
    console.log(`handleButtonClick: Called with type=${type}, category=${category}, subCategory=${subCategory}`);
    
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

    let country = 'us';
    let language = 'en';

    //set default newsType to top-headlines
    let newsType = 'top-headlines';

    if (type === 'news') {
        country = countrySelect ? countrySelect.value : 'us';
        language = languageSelect ? languageSelect.value : 'en';
        console.log(`handleButtonClick: News request - country=${country}, language=${language}, category=${category}`);
    } else if (type === 'trends') {
        country = trendsCountrySelect ? trendsCountrySelect.value : 'US';
        language = trendsLanguageSelect ? trendsLanguageSelect.value : 'en';
    }

    try {
        let data;
        if (type === 'news') {
            console.log(`handleButtonClick: Fetching news data for category: ${category}`);
            // Fetch news data with the specified category
            data = await fetchNewsData(category, country, language, null, newsType);
            console.log(`handleButtonClick: Received news data, articles count: ${data?.length || 0}`);
            updateNews(data);
        } else if (type === 'trends') {
            data = await fetchTrendsData(category, subCategory, language, country);
            updateTrends(data, category);
        } 
    } catch (error) {
        console.error(`Error handling ${type} request:`, error);
        alert(`Failed to load ${type} data. Please try again.`);
    }
};

// Add handleNewsTypeClick function
window.handleNewsTypeClick = async function(newsType) {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    
    const country = countrySelect ? countrySelect.value : 'us';
    const language = languageSelect ? languageSelect.value : 'en';

    try {
        const data = await fetchNewsData('world', country, language, false, newsType);
        updateNews(data);
    } catch (error) {
        console.error('Error handling news type request:', error);
        alert('Failed to load news data. Please try again.');
    }
};


// Make updateNewsModeIndicator globally available
window.updateNewsModeIndicator = updateNewsModeIndicator;

// Export refreshNews function
export async function refreshNews() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    
    // Check if elements exist (only on news page)
    if (!countrySelect || !languageSelect) {
        console.log('News controls not found on this page, skipping news refresh');
        return;
    }
    
    const country = countrySelect.value;
    const language = languageSelect.value;

    // newsAPI set default news to top headlines
    let newsType= 'top-headlines';

    const newsData = await fetchNewsData('world', country, language, true, newsType); // Force refresh
    updateNews(newsData);
}

// Make refreshNews globally available
window.refreshNews = refreshNews;

// Function to refresh trends data
async function refreshTrends() {
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    const country = trendsCountrySelect.value;
    const language = trendsLanguageSelect.value;

    const trendsData = await fetchTrendsData('daily', 'all', language, country);
    updateTrends(trendsData, 'daily');
}

// Make refreshTrends globally available
window.refreshTrends = refreshTrends;

// Function to toggle section visibility
window.toggleSection = function(sectionContentId) {
    const sectionContent = document.getElementById(sectionContentId);
    if (sectionContent.style.display === 'none') {
        sectionContent.style.display = 'block';
    } else {
        sectionContent.style.display = 'none';
    }
};

// Add theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Update the theme class
    body.classList.remove(`${currentTheme}-theme`);
    body.classList.add(`${newTheme}-theme`);

    // Save the theme preference
    userPrefs.setTheme(newTheme);

    // Update the theme toggle button icon
    const themeToggleButton = document.getElementById('themeToggle');
    if (themeToggleButton) {
        themeToggleButton.textContent = newTheme === 'light' ? '🌞' : '🌙';
    }
    
    // Update chart theme
    updateChartTheme();
    
    // Update map theme if map is initialized
    if (window.applyThemeToMap && typeof window.applyThemeToMap === 'function') {
        window.applyThemeToMap();
    }
}

// Make toggleTheme globally available for HTML onclick handlers
window.toggleTheme = toggleTheme;

// Initialize theme based on user preference
function initializeTheme() {
    const savedTheme = userPrefs.getTheme() || 'dark'; // Add fallback to 'dark' if no theme is set
    document.body.classList.add(`${savedTheme}-theme`);
    
    // Update theme toggle button if it exists
    const themeToggleButton = document.getElementById('themeToggle');
    if (themeToggleButton) {
        themeToggleButton.textContent = savedTheme === 'light' ? '🌞' : '🌙';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize geolocation and region dropdown
    await initializeGeolocation();

    // Initialize trends section
    initializeTrends();

    // Make setTrendsRegion globally available for geolocation.js
    window.setTrendsRegion = setTrendsRegion;

    // Apply user preferences to UI
    userPrefs.applyPreferences();
    
    // Make userPrefs globally available for HTML functions
    window.userPrefs = userPrefs;
    
    // Update preferences display
    if (window.updatePreferencesDisplay) {
        window.updatePreferencesDisplay();
    }

    // Show cookie consent banner if needed (from userPreferences.js)
    if (window.checkCookieConsent) {
        window.checkCookieConsent();
    }

    // Initialize the news mode indicator
    updateNewsModeIndicator();

    // Initialize weather display and auto-refresh
    initializeWeather();

    //set default newsType as top-headlines
    let newsType= 'top-headlines';

    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

    if (!countrySelect || !languageSelect || !trendsCountrySelect || !trendsLanguageSelect) {
        console.log('Some controls not found on this page - this is expected in multipage setup');
        return;
    }

    // Add event listeners for country and language select to update trends data and save preferences
    trendsCountrySelect.addEventListener('change', () => {
        refreshTrends();
        userPrefs.saveCurrentState();
    });
    trendsLanguageSelect.addEventListener('change', () => {
        refreshTrends();
        userPrefs.saveCurrentState();
    });

    // Add event listeners for country and language select to update news data and save preferences
    countrySelect.addEventListener('change', () => {
        console.log("COUNTRY SELECTED CHANGED");
        refreshNews();
        userPrefs.saveCurrentState();
    });
    languageSelect.addEventListener('change', () => {
        console.log(`Language changed to: ${languageSelect.value}`);
        // Force refresh news data when language changes to ensure proper mode selection
        refreshNews();
        userPrefs.saveCurrentState();
        
        // Update the news mode indicator
        updateNewsModeIndicator();
    });

    // Fetch and display world news 
    try {
        const country = countrySelect.value;
        const language = languageSelect.value;

        // Fetch prioritized news data
        const newsData = await fetchNewsData('world', country, language, false, newsType);
        updateNews(newsData);
        
        const trendsData = await fetchTrendsData('daily', 'all', trendsLanguageSelect.value, trendsCountrySelect.value);
        updateTrends(trendsData, 'daily');
    } 
    catch (error) {
        console.error('Error during initial data fetch:', error);
    }
    console.log("DOM fully loaded")

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

    // Only add scroll functionality if the button exists on this page
    if (scrollToTopBtn) {
        // Show the button when the user scrolls down 100px from the top of the document
        window.onscroll = function() {
            if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
                scrollToTopBtn.style.display = "flex"; // Use flex to ensure it is centered
            } else {
                scrollToTopBtn.style.display = "none";
            }
        };

        // Scroll to the top when the button is clicked
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Smooth scroll effect
            });
        });
    } else {
        console.log('Scroll to top button not found on this page, skipping scroll functionality');
    }
    // Initialize theme
    initializeTheme();
});


function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}


// Add handleDateRangeChange function
window.handleDateRangeChange = async function() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    
    if (!countrySelect || !languageSelect || !dateRangeSelect) {
        console.log('Date range controls not found on this page, skipping date range change');
        return;
    }

    const country = countrySelect.value;
    const language = languageSelect.value;
    const dateRange = dateRangeSelect.value;

    try {
        // Force refresh to get new data with the selected date range
        const newsData = await fetchNewsData('world', country, language, true, newsType);
        updateNews(newsData);
    } catch (error) {
        console.error('Error updating news with new date range:', error);
        alert('Failed to update news with new date range. Please try again.');
    }
};

// Note: Global functions are already assigned at the top of the file
