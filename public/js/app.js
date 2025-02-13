import { loadGoogleMapsScript, updateTrafficInfo } from './map.js';
import { 
    updateInterval,
    fetchFinancialData, 
    updateFinance, 
    startAutoRefresh, 
    stopAutoRefresh,
    handleFinanceUpdate, 
    isMarketOpen
} from './finance.js';
import { fetchNewsData, updateNews } from './news.js';
import { fetchTrendsData, updateTrends } from './trends.js'; // Import from trends.js
import { fetchRedditData, updateReddit } from './reddit.js'; // Import from reddit.js

function updateFinanceData(timeRange, interval) {
    handleFinanceUpdate(timeRange, interval);
}


// Function to show loading state in a container
function showLoading(container) {
    container.innerHTML = '<p>Loading...</p>';
}

// Define variables to track pause state for each module
let isPaused = {
    'finance': false,
    'news': false,
    'traffic': false,
    'trends': false,
    'reddit': false
};

// Update the togglePauseFinance function in app.js
export function togglePauseFinance() {
    const isPaused = !updateInterval; // Check if currently paused
    const button = document.querySelector('#finance .pause-button');
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const symbol = stockSymbolInput.value || '^IXIC';
    
    // Get the currently active time range button
    const activeButton = document.querySelector('.time-range-button.active') || document.getElementById('realtimeButton');
    const [timeRange, interval] = activeButton.getAttribute('onclick')
        .match(/updateFinanceData\('([^']*)', '([^']*)'\)/i)
        .slice(1);
    
    if (isPaused) {
        // Resume updates
        startAutoRefresh(symbol, timeRange, interval);
        button.textContent = 'Pause';
        button.classList.remove('paused');
    } else {
        // Pause updates
        stopAutoRefresh();
        button.textContent = 'Resume';
        button.classList.add('paused');
    }
}

// Function to refresh news data
async function refreshNews() {
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

// Function to handle button clicks
async function handleButtonClick(type, category, subCategory) {
    //console.log(`handleButtonClick called with type: ${type}, category: ${category}, subCategory: ${subCategory}`);
    const countrySelect = document.getElementById('countrySelect');
    const languageSelect = document.getElementById('languageSelect');
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

    const country = type === 'trends' ? trendsCountrySelect.value : countrySelect.value;
    const language = type === 'trends' ? trendsLanguageSelect.value : languageSelect.value;
    //console.log(`Country: ${country}, Language: ${language}`);
    let data;
    if (type === 'news') {
        data = await fetchNewsData(category, country, language);
        updateNews(data);
    } else if (type === 'reddit') {
        data = await fetchRedditData(category);
        updateReddit(data);
    } else if (type === 'trends') {
        data = await fetchTrendsData(category, subCategory, country);
        updateTrends(data, category);
    }
}

// Attach functions to the window object to make them globally accessible
window.handleButtonClick = handleButtonClick;
window.updateFinanceData = updateFinanceData;
window.togglePauseFinance = togglePauseFinance;
window.refreshTrends = refreshTrends;
window.refreshNews = refreshNews; // Add this line

// Function to toggle section visibility
window.toggleSection = function(sectionContentId) {
    const sectionContent = document.getElementById(sectionContentId);
    if (sectionContent.style.display === 'none') {
        sectionContent.style.display = 'block';
    } else {
        sectionContent.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
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

    // Add event listener for country and language select to update trends data
    trendsCountrySelect.addEventListener('change', refreshTrends);
    trendsLanguageSelect.addEventListener('change', refreshTrends);

    // Add event listener for country and language select to update news data
    countrySelect.addEventListener('change', refreshNews);
    languageSelect.addEventListener('change', refreshNews);

    // Fetch and display world news and top Reddit posts of the day by default
    try {
        const country = countrySelect.value;
        const language = languageSelect.value;

        const newsData = await fetchNewsData('world', country, language);
        updateNews(newsData);

        const redditData = await fetchRedditData('day');
        updateReddit(redditData);

        const trendsData = await fetchTrendsData('daily', 'all', trendsLanguageSelect.value, trendsCountrySelect.value);
        updateTrends(trendsData, 'daily');

        // Start auto-refresh with default values (minutely) only if the market is open
        if (isMarketOpen()) {
            startAutoRefresh('^IXIC', '5m', '1m');
        } else {
            console.log('Market is closed. Auto-refresh will not start.');
            // Update the chart once even if the market is closed
            updateFinanceData('1d', '1m');
        }

        // Theme toggle functionality
        const themeToggleButton = document.getElementById('themeToggleButton');
        if (themeToggleButton) {
            themeToggleButton.addEventListener('click', async () => {
                // Toggle the theme class on the body
                document.body.classList.toggle('dark-theme');

                // Destroy the existing chart if it exists
                if (window.financeChart && window.financeChart instanceof Chart) {
                    window.financeChart.destroy();
                }

                // Get the current stock symbol and time range/interval
                const stockSymbolInput = document.getElementById('stockSymbolInput');
                const symbol = stockSymbolInput.value || '^IXIC';
                const timeRange = '1d'; // Set your default time range
                const interval = '1m'; // Set your default interval

                // Fetch the financial data again to recreate the chart
                try {
                    const data = await fetchFinancialData(symbol, timeRange, interval);
                    updateFinance(data); // This will recreate the chart with the new theme
                } catch (error) {
                    console.error('Error fetching financial data after theme toggle:', error);
                }
            });
        } else {
            console.warn('Theme toggle button not found');
        }
    } catch (error) {
        console.error('Error initializing data:', error);
    }
    console.log("DOM fully loaded")

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
            updateFinanceData('5m', '1m'); // Refresh chart with minutely data
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

document.getElementById('nvdaButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'NVDA'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('aaplButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'AAPL'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('msftButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'MSFT'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('googlButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'GOOGL'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('amznButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'AMZN'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('tslaButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'TSLA'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('fbButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'META'; // Set input value to META
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('nflxButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'NFLX'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('disButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'DIS'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('ethButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'ETH-USD'; // Set input value
    updateFinanceData('1d', '5m'); // Refresh chart with daily data
});

document.getElementById('btcButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'BTC-USD'; // Set input value
    updateFinanceData('1d', '5m'); // Refresh chart with daily data
});

document.getElementById('solButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'SOL-USD'; // Set input value
    updateFinanceData('1d', '5m'); // Refresh chart with daily data
});

document.getElementById('xrpButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'XRP-USD'; // Set input value
    updateFinanceData('1d', '5m'); // Refresh chart with daily data
});

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadStockSymbols();
    // Add click handlers for time range buttons
    document.querySelectorAll('.time-range-button').forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('.time-range-button').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to clicked button
            this.classList.add('active');
        });
    });
    
    // Set initial active state
    const realtimeButton = document.getElementById('realtimeButton');
    if (realtimeButton) {
        realtimeButton.classList.add('active');
    }
});
