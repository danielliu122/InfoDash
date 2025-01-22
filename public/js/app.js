// app.js
// The 'require' statement is not needed in browser-side JavaScript.
// Configuration is now fetched from the server.

import { loadGoogleMapsScript, initMap, startPeriodicTrafficUpdates, updateTrafficInfo } from './map.js';
import { fetchFinancialData, fetchRealTimeYahooFinanceData, updateRealTimeFinance, refreshRealTimeFinanceData, updateFinance, updateFinanceDataWithPercentage, startAutoRefresh, stopAutoRefresh } from './finance.js';
import { fetchNewsData, updateNews } from './news.js';
import { fetchTrendsData, updateTrends } from './trends.js'; // Import from trends.js
import { fetchRedditData, updateReddit } from './reddit.js'; // Import from reddit.js

// Add these functions at the top of your file
let lastUpdateTime = 0;

function isMarketOpen() {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = etNow.getDay();
    const hour = etNow.getHours();
    const minute = etNow.getMinutes();

    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (day >= 1 && day <= 5) {
        // Check if it's between 9:30 AM and 4:00 PM ET
        if ((hour === 9 && minute >= 30) || (hour > 9 && hour < 16) || (hour === 16 && minute === 0)) {
            return true;
        }
    }
    return false;
}

// Modify the updateFinanceData function
function updateFinanceData(timeRange, interval) {
    const now = Date.now();
    if (now - lastUpdateTime < 500) {
        console.log('Please wait before requesting new data');
        return;
    }
    
    lastUpdateTime = now;
    
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const symbol = stockSymbolInput.value || '^IXIC';
    
    // Update once for all timeframes
    updateFinanceDataWithPercentage(symbol, timeRange, interval)
        .catch(error => {
            console.error('Error updating finance data:', error);
            const chartContainer = document.querySelector('#finance .chart-container');
            if (chartContainer) {
                chartContainer.innerHTML = '<p>Unable to fetch data. Please try again.</p>';
            }
        });
    
    // Start new auto-refresh only for the minute interval during market hours
    if (timeRange === '5m' && interval === '1m' && isMarketOpen()) {
        startAutoRefresh(symbol, timeRange, interval);
    } else {
        stopAutoRefresh(); // Stop auto-refresh for other intervals
    }
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

// Function to toggle pause state for finance module
function togglePauseFinance() {
    isPaused['finance'] = !isPaused['finance'];
    
    const button = document.querySelector('#finance .pause-button');
    button.textContent = isPaused['finance'] ? 'Resume' : 'Pause';
    button.classList.toggle('paused', isPaused['finance']); // Add or remove 'paused' class
    
    console.log(`Finance data fetching is ${isPaused['finance'] ? 'paused' : 'resumed'}.`);
    
    if (!isPaused['finance']) {
        const stockSymbolInput = document.getElementById('stockSymbolInput');
        const symbol = stockSymbolInput.value || '^IXIC';
        
        // Check if the button exists before trying to get its attribute
        const minutelyButton = document.getElementById('realtimeButton'); // Change to the correct button ID
        if (minutelyButton) {
            const match = minutelyButton.getAttribute('onclick').match(/updateFinanceData\('([^']*)', '([^']*)'\)/i);
            if (match) {
                const timeRange = match[1];
                const interval = match[2];
                
                // Restart auto-refresh when resumed
                startAutoRefresh(symbol, timeRange, interval);
            } else {
                console.error('Could not parse timeRange and interval from onclick attribute.');
            }
        } else {
            console.error('Minutely button not found. Cannot resume auto-refresh.');
        }
    } else {
        stopAutoRefresh(); // Stop refreshing when paused
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

    const trendsData = await fetchTrendsData('daily', 'all', country, language);
    updateTrends(trendsData, 'daily');
}

// Function to refresh data for a module
async function refreshData(module) {
    const container = document.querySelector(`#${module} .data-container`);
    showLoading(container);
    
    try {
        let data;
        switch (module) {
            case 'news':
                data = await fetchNewsData();
                updateNews(data);
                break;
            case 'finance':
                data = await fetchFinancialData();
                updateFinance(data);
                break;
            case 'traffic':
                if (map) {
                    const currentCenter = map.getCenter();
                    data = await updateTrafficInfo({
                        lat: currentCenter.lat(),
                        lng: currentCenter.lng()
                    });
                } else {
                    console.warn('Map not initialized, skipping traffic update');
                    data = { status: 'Map not initialized' };
                }
                updateTrafficUI(data);
                break;
            case 'trends':
                data = await fetchTrendsData('daily');
                updateTrends(data, 'daily');
                break;
            case 'realtime-trends':
                data = await fetchTrendsData('realtime');
                updateTrends(data, 'realtime');
                break;
            case 'reddit':
                data = await fetchRedditData('day'); // Default to 'day' time period for Reddit
                updateReddit(data);
                break;
            default:
                console.log(`Module ${module} not supported.`);
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading data. Please try again later.</p>';
        console.error(`Error fetching ${module} data:`, error);
    }
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

        const trendsData = await fetchTrendsData('daily', 'all', trendsCountrySelect.value, trendsLanguageSelect.value);
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
            themeToggleButton.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
            });
        } else {
            console.warn('Theme toggle button not found');
        }

        // Update the event listeners for the time range buttons
        document.getElementById('realtimeButton').addEventListener('click', () => updateFinanceData('5m', '1m'));
        document.getElementById('hourlyButton').addEventListener('click', () => updateFinanceData('3h', '1m'));
        document.getElementById('dailyButton').addEventListener('click', () => updateFinanceData('1d', '5m'));
        document.getElementById('weeklyButton').addEventListener('click', () => updateFinanceData('1wk', '1h'));
        document.getElementById('monthlyButton').addEventListener('click', () => updateFinanceData('1mo', '1d'));
        document.getElementById('yearlyButton').addEventListener('click', () => updateFinanceData('1y', '1wk'));
    } catch (error) {
        console.error('Error initializing data:', error);
    }
    console.log("DOM fully loaded")
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
            document.getElementById('stockSymbolInput').value = symbol; // Set input value
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

const stockSymbols = {
    'ETH-USD': 'Ethereum',
    'BTC-USD': 'BTC',
    'SOL-USD': 'Solana',
    'XRP-USD': 'XRP',
    'AAPL': 'Apple',
    'GOOGL': 'Google',
    'MSFT': 'Microsoft',
    'AMZN': 'Amazon',
    'TSLA': 'Tesla',
    'META': 'Meta',
    'NFLX': 'Netflix',
    'NVDA': 'NVIDIA',
    'BRK.A': 'Berkshire Hathaway',
    'JPM': 'JPMorgan Chase',
    'V': 'Visa',
    'JNJ': 'Johnson & Johnson',
    'PG': 'Procter & Gamble',
    'UNH': 'UnitedHealth Group',
    'HD': 'Home Depot',
    'DIS': 'Walt Disney',
    'PYPL': 'PayPal',
    'VZ': 'Verizon',
    'INTC': 'Intel',
    'CMCSA': 'Comcast',
    'PEP': 'PepsiCo',
    'T': 'AT&T',
    'CSCO': 'Cisco Systems',
    'MRK': 'Merck & Co.',
    'XOM': 'Exxon Mobil',
    'NKE': 'Nike',
    'PFE': 'Pfizer',
    'TMO': 'Thermo Fisher Scientific',
    'ABT': 'Abbott Laboratories',
    'CVX': 'Chevron',
    'LLY': 'Eli Lilly and Company',
    'MDT': 'Medtronic',
    'IBM': 'IBM',
    'WMT': 'Walmart',
    'CRM': 'Salesforce',
    'TXN': 'Texas Instruments',
    'QCOM': 'Qualcomm',
    'NOW': 'ServiceNow',
    'HON': 'Honeywell',
    'COST': 'Costco',
    'AMGN': 'Amgen',
    'SBUX': 'Starbucks',
    'LMT': 'Lockheed Martin',
    'BA': 'Boeing',
    'CAT': 'Caterpillar',
    'GS': 'Goldman Sachs',
    'BLK': 'BlackRock',
    'MDLZ': 'Mondelez International',
    'SYK': 'Stryker',
    'ISRG': 'Intuitive Surgical',
    'ADBE': 'Adobe',
    'NFLX': 'Netflix',
    'FISV': 'Fiserv',
    'ATVI': 'Activision Blizzard',
    'GILD': 'Gilead Sciences',
    'AMAT': 'Applied Materials',
    'VRTX': 'Vertex Pharmaceuticals',
    'ADP': 'Automatic Data Processing',
    'NEM': 'Newmont Corporation',
    'SPGI': 'S&P Global',
    'DHR': 'Danaher',
    'ZTS': 'Zoetis',
    'LRCX': 'Lam Research',
    'KMX': 'Kimberly-Clark',
    'CARR': 'Carrier Global',
    '^IXIC': 'Nasdaq Composite',
    'MCO': 'Moody\'s',
    'C': 'Citigroup',
    'USB': 'U.S. Bancorp',
    'BKNG': 'Booking Holdings',
    'TROW': 'T. Rowe Price',
    'NTRS': 'Northern Trust',
    'MS': 'Morgan Stanley',
    'SCHW': 'Charles Schwab',
    'AON': 'Aon plc',
    'MMC': 'Marsh & McLennan',
    'DOV': 'Dover Corporation',
    'ETR': 'Entergy',
    'DTE': 'DTE Energy',
    'PGR': 'Progressive Corporation',
    'CNP': 'CenterPoint Energy',
    'WBA': 'Walgreens Boots Alliance',
    'VTRS': 'Viatris',
    'KHC': 'Kraft Heinz',
    'OXY': 'Occidental Petroleum',
    'HIG': 'The Hartford',
    'CAG': 'Conagra Brands',
    'NWL': 'Newell Brands',
    'KMX': 'CarMax',
    'DHI': 'D.R. Horton',
    'PHM': 'PulteGroup',
    'LEN': 'Lennar',
    'RMD': 'ResMed',
    'DRE': 'Duke Realty',
    'PLD': 'Prologis',
    'ESS': 'Essex Property Trust',
    'VTR': 'Ventas',
    'O': 'Realty Income',
    'REG': 'Regency Centers',
    'SPG': 'Simon Property Group',
    'AMT': 'American Tower',
    'PLD': 'Prologis',
    'SBRA': 'Sabra Health Care REIT',
    'WPC': 'W.P. Carey',
    'DLR': 'Digital Realty',
    'CPT': 'Camden Property Trust',
    'AVB': 'AvalonBay Communities',
    'EQR': 'Equity Residential',
    'ESS': 'Essex Property Trust',
    'HST': 'Host Hotels & Resorts',
    'MPC': 'Marathon Petroleum',
    'VFC': 'V.F. Corporation',
    'NKE': 'Nike',
    'LVS': 'Las Vegas Sands',
    'WYNN': 'Wynn Resorts',
    'MGM': 'MGM Resorts',
    'RCL': 'Royal Caribbean',
    'CCL': 'Carnival Corporation',
    'NCLH': 'Norwegian Cruise Line',
    'RCL': 'Royal Caribbean',
    'HST': 'Host Hotels & Resorts',
    'MAR': 'Marriott International',
    'HLT': 'Hilton Worldwide',
    'IHG': 'InterContinental Hotels Group',
    'CHH': 'Choice Hotels',
    'WYN': 'Wyndham Hotels & Resorts',
    '^DJI': 'Dow Jones Industrial Average',
}; // Top 100+ stock symbols

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
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('btcButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'BTC-USD'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('solButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'SOL-USD'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

document.getElementById('xrpButton').addEventListener('click', () => {
    document.getElementById('stockSymbolInput').value = 'XRP-USD'; // Set input value
    updateFinanceData('1d', '1m'); // Refresh chart with daily data
});

