import { loadGoogleMapsScript, updateTrafficInfo } from './map.js';
import { 
    updateInterval,
    fetchFinancialData, 
    updateFinance, 
    startAutoRefresh, 
    stopAutoRefresh,
    handleFinanceUpdate, 
    isMarketOpen,
    initializeFinance,
    clearWatchlist,
    resetToDefaultWatchlist,
    resetChartZoom,
    updateChartTheme,
    startStockDashboard,
    resetFinanceCardPositions
} from './finance.js';
import { fetchNewsData, updateNews } from './news.js';
import { fetchTrendsData, updateTrends } from './trends.js'; // Import from trends.js
import { refreshSummary, initializeSummarySection } from './summary.js'; // Import summary functionality
import { userPrefs } from './userPreferences.js'; // Import user preferences

// Make functions globally available immediately for HTML onclick handlers
window.handleButtonClick = async function(type, category, subCategory = 'all') {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

    let country = 'us';
    let language = 'en';

    if (type === 'news') {
        country = countrySelect ? countrySelect.value : 'us';
        language = languageSelect ? languageSelect.value : 'en';
    } else if (type === 'trends') {
        country = trendsCountrySelect ? trendsCountrySelect.value : 'US';
        language = trendsLanguageSelect ? trendsLanguageSelect.value : 'en';
    }

    try {
        let data;
        if (type === 'news') {
            // Fetch news data with the specified category
            data = await fetchNewsData(category, country, language);
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

// Update the togglePauseFinance function in app.js
export function togglePauseFinance() {
    const pauseButton = document.querySelector('.pause-button');
    if (pauseButton.classList.contains('paused')) {
        // Resume auto-refresh
        pauseButton.classList.remove('paused');
        pauseButton.textContent = 'Pause';
        startAutoRefresh('^IXIC', '5m', '1m');
    } else {
        // Pause auto-refresh
        pauseButton.classList.add('paused');
        pauseButton.textContent = 'Resume';
        stopAutoRefresh();
    }
}

// Make togglePauseFinance globally available
window.togglePauseFinance = togglePauseFinance;

// Make resetFinanceCardPositions globally available
window.resetFinanceCardPositions = resetFinanceCardPositions;

// Make resetToDefaultWatchlist globally available
window.resetToDefaultWatchlist = resetToDefaultWatchlist;

// Export refreshNews function
export async function refreshNews() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const country = countrySelect.value;
    const language = languageSelect.value;

    const newsData = await fetchNewsData('world', country, language, true); // Force refresh
    updateNews(newsData);
}

// Function to refresh trends data
async function refreshTrends() {
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    const country = trendsCountrySelect.value;
    const language = trendsLanguageSelect.value;

    const trendsData = await fetchTrendsData('daily', 'all', language, country);
    updateTrends(trendsData, 'daily');
}

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
}

// Make toggleTheme globally available for HTML onclick handlers
window.toggleTheme = toggleTheme;

// Initialize theme based on user preference
function initializeTheme() {
    const savedTheme = userPrefs.getTheme();
    document.body.classList.add(`${savedTheme}-theme`);
    const themeToggleButton = document.getElementById('themeToggle');
    if (themeToggleButton) {
        themeToggleButton.textContent = savedTheme === 'light' ? '🌞' : '🌙';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme
    initializeTheme();

    // Apply user preferences to UI
    userPrefs.applyPreferences();
    
    // Make userPrefs globally available for HTML functions
    window.userPrefs = userPrefs;
    
    // Update preferences display
    if (window.updatePreferencesDisplay) {
        window.updatePreferencesDisplay();
    }

    // Show cookie notification if consent not given
    if (window.showCookieNotification) {
        window.showCookieNotification();
    }

    // Initialize the summary section (this will load or generate today's summary)
    initializeSummarySection();

    // Initialize finance features
    initializeFinance();

    // Start the stock dashboard automatically
    startStockDashboard();

    // Scroll to the top of the page on reload
    window.scrollTo(0, 0);

    // Initialize Materialize components
    M.AutoInit();

    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

    if (!countrySelect || !languageSelect || !trendsCountrySelect || !trendsLanguageSelect) {
        console.error('One or more elements not found in the DOM');
        return;
    }

    // Enable the country select dropdown
    countrySelect.disabled = false;

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
        refreshNews();
        userPrefs.saveCurrentState();
    });
    languageSelect.addEventListener('change', () => {
        refreshNews();
        userPrefs.saveCurrentState();
    });

    // Fetch and display world news 
    try {
        const country = countrySelect.value;
        const language = languageSelect.value;

        // Fetch prioritized news data
        const newsData = await fetchNewsData('world', country, language, false, 'top-headlines');
        updateNews(newsData);

        const trendsData = await fetchTrendsData('daily', 'all', trendsLanguageSelect.value, trendsCountrySelect.value);
        updateTrends(trendsData, 'daily');

        // Start auto-refresh with default values (minutely) only if the market is open
        if (isMarketOpen()) {
            startAutoRefresh('^IXIC', '5m', '1m');
        } else {
            // console.log('Market is closed. Auto-refresh will not start.');
            // Update the chart once even if the market is closed
            handleFinanceUpdate('1d', '1m');
        }

        // Theme toggle functionality
        const themeToggleButton = document.getElementById('themeToggle');
        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', toggleTheme);
        }
    } catch (error) {
        console.error('Error during initial data fetch:', error);
    }
    // console.log("DOM fully loaded")

    // Add event listeners for pagination controls
    const paginationButtons = document.querySelectorAll('.pagination-controls button');
    paginationButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default button behavior

            // Your logic for pagination (e.g., fetching new data)
            // After fetching new data, the viewport will adjust automatically
            // No need to scroll to the top here, as it should maintain its position
        });
    });

    const scrollToTopBtn = document.getElementById('scrollToTopBtn');

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
});

// Make sure to call loadGoogleMapsScript in your initialization code
loadGoogleMapsScript().catch(error => {
    console.error('Error initializing map:', error);
});


// Update the autocomplete logic
document.getElementById('stockSymbolInput').addEventListener('input', function() {
    const input = this.value.toLowerCase();
    const autocompleteList = document.getElementById('autocomplete-list');
    autocompleteList.innerHTML = ''; // Clear previous suggestions

    if (!input) return; // Exit if input is empty

    const filteredSymbols = Object.keys(stockSymbols).filter(symbol => 
        stockSymbols[symbol].toLowerCase().startsWith(input) || symbol.toLowerCase().startsWith(input)
    );
    
    filteredSymbols.forEach(symbol => {
        const item = document.createElement('div');
        item.textContent = `${symbol} - ${stockSymbols[symbol]}`;
        item.classList.add('autocomplete-item');
        item.addEventListener('click', function() {
            document.getElementById('stockSymbolInput').value = symbol;
            handleFinanceUpdate('5m', '1m'); // Refresh chart with minutely data
            autocompleteList.innerHTML = ''; // Clear suggestions
        });
        autocompleteList.appendChild(item);
    });
});

// Close the autocomplete list when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.matches('#stockSymbolInput')) {
        document.getElementById('autocomplete-list').innerHTML = '';
    }
});

let stockSymbols = {};

async function loadStockSymbols() {
    try {
        const response = await fetch('/stockSymbols.json');
        stockSymbols = await response.json();
    } catch (error) {
        console.error('Error loading stock symbols:', error);
    }
}

document.onfullscreenchange = function ( event ) {
    let target = event.target;
    let pacContainerElements = document.getElementsByClassName("pac-container");
    if (pacContainerElements.length > 0) {
      let pacContainer = document.getElementsByClassName("pac-container")[0];
      if (pacContainer.parentElement === target) {
        document.getElementsByTagName("body")[0].appendChild(pacContainer);
        pacContainer.className += pacContainer.className.replace("fullscreen-pac-container", "");
      } else {
        target.appendChild(pacContainer);
        pacContainer.className += " fullscreen-pac-container";
      }
    }
  };

  document.querySelectorAll('[data-stock-symbol]').forEach(button => {
    button.addEventListener('click', (e) => {
        const symbol = e.currentTarget.dataset.stockSymbol;
        document.getElementById('stockSymbolInput').value = symbol;
        handleFinanceUpdate('1d', '1m');
    });
});

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStockSymbols();
    // Set initial active state for time range buttons
    const realtimeButton = document.getElementById('realtimeButton');
    if (realtimeButton) {
        realtimeButton.classList.add('active');
    }
});

// Add handleDateRangeChange function
window.handleDateRangeChange = async function() {
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const dateRangeSelect = document.getElementById('dateRangeSelect');
    
    if (!countrySelect || !languageSelect || !dateRangeSelect) {
        console.error('Required elements not found');
        return;
    }

    const country = countrySelect.value;
    const language = languageSelect.value;
    const dateRange = dateRangeSelect.value;

    try {
        // Force refresh to get new data with the selected date range
        const newsData = await fetchNewsData('world', country, language, true);
        updateNews(newsData);
    } catch (error) {
        console.error('Error updating news with new date range:', error);
        alert('Failed to update news with new date range. Please try again.');
    }
};

// Note: Global functions are already assigned at the top of the file
