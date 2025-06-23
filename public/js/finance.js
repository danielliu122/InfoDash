import { userPrefs } from './userPreferences.js';
import logger from './logger.js';

// At the top of the file
export let updateInterval;
let lastUpdateTime = 0;
let lastHistoricalUpdate = 0;
let lastTimestamp = null;
let watchlist = JSON.parse(localStorage.getItem('financeWatchlist') || '[]');
let stockSymbols = {};
let currentSymbol = '^IXIC';
let topStocks = [];
let stockDashboardInterval = null;
let cryptoDashboardInterval = null; // Dedicated interval for crypto
let previousStockData = {};
let isDashboardPaused = false; // Track pause state

// Default watchlist with popular stocks and cryptocurrencies
const DEFAULT_WATCHLIST = [
    'NVDA',    // NVIDIA - AI/GPU leader
    'AAPL',    // Apple - Tech giant
    'GOOGL',   // Google (Alphabet) - Tech/Advertising
    'META',    // Meta (Facebook) - Social media/AI
    'BTC-USD', // Bitcoin - Leading cryptocurrency
    'ETH-USD', // Ethereum - Smart contract platform
    '^IXIC',   // NASDAQ Composite - Tech index
    'NFLX',    // Netflix - Streaming entertainment
    'DJT',     // Trump Media & Technology Group
    'TSLA',    // Tesla - Electric vehicles/AI
    'MSFT',    // Microsoft - Software/AI
    'AMZN',    // Amazon - E-commerce/Cloud
    'SPY',     // S&P 500 ETF - Market benchmark
    '^DJI',    // Dow Jones Industrial Average
    '^GSPC'    // S&P 500 Index
];

// Helper function to get default symbol based on market status
function getDefaultSymbol() {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    
    if (isWeekend) {
        return 'BTC-USD'; // Default to Bitcoin on weekends
    } else {
        return '^IXIC'; // Default to NASDAQ on weekdays
    }
}

// Initialize with the appropriate default symbol
currentSymbol = getDefaultSymbol();

// Load stock symbols for autocomplete
async function loadStockSymbols() {
    try {
        const response = await fetch('/stockSymbols.json');
        stockSymbols = await response.json();
    } catch (error) {
        console.error('Error loading stock symbols:', error);
    }
}

// Initialize stock symbols on load
loadStockSymbols();

// Helper function to format price with commas and determine font size
function formatPriceWithCommas(price) {
    if (price === null || price === undefined || price === 'N/A') {
        return { formatted: 'N/A', fontSize: '1.2em' };
    }
    
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
        return { formatted: 'N/A', fontSize: '1.2em' };
    }
    
    // Format with commas
    const formatted = numPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    // Determine font size based on number length
    let fontSize = '1.2em'; // Default size
    const priceStr = formatted.replace(/[^0-9]/g, ''); // Remove non-digits
    
    if (priceStr.length >= 7) { // 1,000,000+
        fontSize = '0.9em';
    } else if (priceStr.length >= 5) { // 10,000+
        fontSize = '1.0em';
    } else if (priceStr.length >= 3) { // 100+
        fontSize = '1.1em';
    }
    
    return { formatted, fontSize };
}

// Helper function to format change values
function formatChangeValue(value) {
    if (value === null || value === undefined) {
        return '0.00';
    }
    return parseFloat(value).toFixed(2);
}

function addData(chart, label, newData) {
    // Check if the data has actually changed
    const lastDataPoint = chart.data.datasets[0].data[chart.data.datasets[0].data.length - 1];
    const lastLabel = chart.data.labels[chart.data.labels.length - 1];
    
    // Only add data if the price has changed OR if it's a new timestamp
    if (lastDataPoint !== newData || lastLabel !== label) {
        // Keep only the last 200 points (adjust as needed)
        if (chart.data.labels.length > 200) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        // Add new data point
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(newData);
        
        // Update the chart
        chart.update('none'); // Use 'none' mode for better performance
        
        // Update the last timestamp
        lastTimestamp = label;
    }
}

function updateStockDashboard() {
    const dashboardContainer = document.getElementById('stock-dashboard');
    if (!dashboardContainer) {
        console.error('Dashboard container not found');
        return;
    }

    if (!topStocks || topStocks.length === 0) {
        dashboardContainer.innerHTML = `<div class="stock-dashboard-error"><p>No stocks in watchlist.</p></div>`;
        return;
    }

    // Check if this is the first time rendering the dashboard
    const existingGrid = dashboardContainer.querySelector('.stock-dashboard-grid');
    const isFirstRender = !existingGrid;

    if (isFirstRender) {
        // Initial render - create the full structure
        const marketStatus = isMarketOpen() ? 'OPEN' : 'CLOSED';
        const marketColor = isMarketOpen() ? '#4caf50' : '#f44336';

        let html = `
            <div class="market-status-indicator" style="text-align: center; margin-bottom: 15px; padding: 8px; background: ${marketColor}; color: white; border-radius: 6px; font-weight: bold;">
                Market: ${marketStatus}
            </div>
            <div class="stock-dashboard-grid">
        `;

        topStocks.forEach(stock => {
            if (!stock || stock.error) return;

            const change = stock.change || 0;
            const changePercent = stock.changePercent || 0;
            const changeColor = change >= 0 ? 'green' : 'red';
            const changeIcon = change >= 0 ? '↗' : '↘';

            // Format price with commas
            const priceFormat = formatPriceWithCommas(stock.price || 0);

            html += `
                <div class="stock-card" data-symbol="${stock.symbol}" onclick="selectStock('${stock.symbol}')">
                    <div class="stock-header">
                        <span class="stock-symbol">${stock.symbol}</span>
                        <span class="stock-name">${stockSymbols[stock.symbol] || stock.symbol}</span>
                    </div>
                    <div class="stock-price" style="color: ${changeColor}; font-size: ${priceFormat.fontSize};">$${priceFormat.formatted}</div>
                    <div class="stock-change">
                        ${changeIcon} <span style="color: ${changeColor};">${changePercent.toFixed(2)}%</span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        dashboardContainer.innerHTML = html;
    } else {
        // Update existing cards in place
        const marketStatusIndicator = dashboardContainer.querySelector('.market-status-indicator');
        if (marketStatusIndicator) {
            const marketStatus = isMarketOpen() ? 'OPEN' : 'CLOSED';
            const marketColor = isMarketOpen() ? '#4caf50' : '#f44336';
            marketStatusIndicator.style.background = marketColor;
            marketStatusIndicator.textContent = `Market: ${marketStatus}`;
        }

        // Update each stock card individually
        topStocks.forEach(stock => {
            if (!stock || stock.error) return;

            const stockCard = dashboardContainer.querySelector(`[data-symbol="${stock.symbol}"]`);
            if (!stockCard) return;

            const previousData = previousStockData[stock.symbol];
            let animationClass = '';
            
            if (previousData && isMarketOpen()) {
                if (stock.price > previousData.price) {
                    animationClass = 'price-up';
                    stockCard.classList.remove('price-down');
                    stockCard.classList.add('price-up');
                } else if (stock.price < previousData.price) {
                    animationClass = 'price-down';
                    stockCard.classList.remove('price-up');
                    stockCard.classList.add('price-down');
                } else {
                    stockCard.classList.remove('price-up', 'price-down');
                }
            }

            const change = stock.change || 0;
            const changePercent = stock.changePercent || 0;
            const changeColor = change >= 0 ? 'green' : 'red';
            const changeIcon = change >= 0 ? '↗' : '↘';

            // Format price with commas
            const priceFormat = formatPriceWithCommas(stock.price || 0);

            // Update price
            const priceElement = stockCard.querySelector('.stock-price');
            if (priceElement) {
                priceElement.style.color = changeColor;
                priceElement.textContent = `$${priceFormat.formatted}`;
            }

            // Update change
            const changeElement = stockCard.querySelector('.stock-change');
            if (changeElement) {
                changeElement.innerHTML = `${changeIcon} <span style="color: ${changeColor};">${changePercent.toFixed(2)}%</span>`;
            }

            // Remove animation classes after animation completes
            if (animationClass) {
                setTimeout(() => {
                    stockCard.classList.remove('price-up', 'price-down');
                }, 1000);
            }
        });
    }

    // Store current data for next comparison
    topStocks.forEach(stock => {
        if (stock && !stock.error) {
            previousStockData[stock.symbol] = { ...stock };
        }
    });
}

// Watchlist management functions
export function addToWatchlist(symbol) {
    if (!watchlist.includes(symbol)) {
        watchlist.push(symbol);
        userPrefs.setFinanceWatchlist(watchlist);
        updateWatchlistUI();

        // If the dashboard is live, add the new stock card dynamically
        if (stockDashboardInterval) {
            fetchRealTimeYahooFinanceData(symbol).then(newStockData => {
                if (newStockData && !newStockData.error) {
                    topStocks.push(newStockData);
                    
                    // Add the new stock card to the existing dashboard
                    const dashboardContainer = document.getElementById('stock-dashboard');
                    const grid = dashboardContainer?.querySelector('.stock-dashboard-grid');
                    
                    if (grid) {
                        const change = newStockData.change || 0;
                        const changePercent = newStockData.changePercent || 0;
                        const changeColor = change >= 0 ? 'green' : 'red';
                        const changeIcon = change >= 0 ? '↗' : '↘';
                        
                        // Format price with commas
                        const priceFormat = formatPriceWithCommas(newStockData.price || 0);

                        const newCard = document.createElement('div');
                        newCard.className = 'stock-card';
                        newCard.setAttribute('data-symbol', symbol);
                        newCard.onclick = () => selectStock(symbol);
                        newCard.innerHTML = `
                            <div class="stock-header">
                                <span class="stock-symbol">${symbol}</span>
                                <span class="stock-name">${stockSymbols[symbol] || symbol}</span>
                            </div>
                            <div class="stock-price" style="color: ${changeColor}; font-size: ${priceFormat.fontSize};">$${priceFormat.formatted}</div>
                            <div class="stock-change">
                                ${changeIcon} <span style="color: ${changeColor};">${changePercent.toFixed(2)}%</span>
                            </div>
                        `;
                        
                        // Add with a fade-in effect
                        newCard.style.opacity = '0';
                        newCard.style.transform = 'scale(0.8)';
                        grid.appendChild(newCard);
                        
                        // Animate in
                        setTimeout(() => {
                            newCard.style.transition = 'all 0.3s ease';
                            newCard.style.opacity = '1';
                            newCard.style.transform = 'scale(1)';
                        }, 10);
                    }
                }
            });
        }
    }
}

export function removeFromWatchlist(symbol) {
    watchlist = watchlist.filter(s => s !== symbol);
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();

    // If the dashboard is live, remove the stock card dynamically
    if (stockDashboardInterval) {
        topStocks = topStocks.filter(stock => stock.symbol !== symbol);
        
        // Remove the stock card from the dashboard with animation
        const dashboardContainer = document.getElementById('stock-dashboard');
        const stockCard = dashboardContainer?.querySelector(`[data-symbol="${symbol}"]`);
        
        if (stockCard) {
            stockCard.style.transition = 'all 0.3s ease';
            stockCard.style.opacity = '0';
            stockCard.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                if (stockCard.parentNode) {
                    stockCard.parentNode.removeChild(stockCard);
                }
            }, 300);
        }
    }
}

export function updateWatchlistUI() {
    const watchlistContainer = document.getElementById('watchlist-container');
    if (!watchlistContainer) return;

    watchlistContainer.innerHTML = '';
    
    if (watchlist.length === 0) {
        watchlistContainer.innerHTML = '<p class="no-watchlist">No stocks in watchlist. Add some stocks to get started!</p>';
    } else {
        watchlist.forEach(symbol => {
            const watchlistItem = document.createElement('div');
            watchlistItem.className = 'watchlist-item';
            watchlistItem.innerHTML = `
                <span class="symbol">${symbol}</span>
                <span class="company-name">${stockSymbols[symbol] || symbol}</span>
                <button class="btn-small remove-watchlist" onclick="removeFromWatchlist('${symbol}')">×</button>
            `;
            watchlistItem.addEventListener('click', () => {
                document.getElementById('stockSymbolInput').value = symbol;
                updateFinanceData(symbol);
            });
            watchlistContainer.appendChild(watchlistItem);
        });
    }
    
    // Update preferences display if available
    if (window.updatePreferencesDisplay) {
        window.updatePreferencesDisplay();
    }
}

// Load watchlist from preferences
export function loadWatchlistFromPreferences() {
    const savedWatchlist = userPrefs.getFinanceWatchlist();
    if (savedWatchlist && savedWatchlist.length > 0) {
        watchlist = savedWatchlist;
    } else {
        // Use default watchlist for new users
        watchlist = [...DEFAULT_WATCHLIST];
        userPrefs.setFinanceWatchlist(watchlist);
    }
    updateWatchlistUI();
}

// Enhanced autocomplete functionality
export function setupAutocomplete() {
    const input = document.getElementById('stockSymbolInput');
    const autocompleteList = document.getElementById('autocomplete-list');
    if (!input || !autocompleteList) return;

    function renderSuggestions() {
        const value = input.value.toUpperCase();
        autocompleteList.innerHTML = '';
        if (value.length < 1) {
            autocompleteList.style.display = 'none';
            return;
        }
        const matches = Object.entries(stockSymbols)
            .filter(([symbol, name]) => symbol.includes(value) || name.toUpperCase().includes(value))
            .slice(0, 10);
        let symbolInMatches = false;
        if (matches.length > 0) {
            autocompleteList.style.display = 'block';
            matches.forEach(([symbol, name]) => {
                if (symbol === value.trim()) symbolInMatches = true;
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = `
                    <span class="symbol">${symbol}</span>
                    <span class="name">${name}</span>
                    <button class="btn-small add-watchlist" onclick="addToWatchlist('${symbol}')">+</button>
                `;
                item.addEventListener('click', () => {
                    input.value = symbol;
                    autocompleteList.style.display = 'none';
                    updateFinanceData(symbol);
                    fetchStockInfo(symbol);
                });
                autocompleteList.appendChild(item);
            });
        } else {
            autocompleteList.style.display = 'block';
        }
        // Only show persistent add button if not already in matches
        const symbol = value.trim();
        if (symbol && stockSymbols[symbol] && !watchlist.includes(symbol) && !symbolInMatches) {
            const addBtn = document.createElement('div');
            addBtn.className = 'autocomplete-item';
            addBtn.innerHTML = `<span class="symbol">${symbol}</span><span class="name">${stockSymbols[symbol]}</span><button class="btn-small add-watchlist" onclick="addToWatchlist('${symbol}')">Add to Watchlist</button>`;
            addBtn.addEventListener('click', () => {
                addToWatchlist(symbol);
                autocompleteList.style.display = 'none';
            });
            autocompleteList.appendChild(addBtn);
        }
    }

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', renderSuggestions);

    // Pressing Enter with a valid symbol adds to watchlist
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const symbol = this.value.trim().toUpperCase();
            if (symbol && stockSymbols[symbol]) {
                if (!watchlist.includes(symbol)) {
                    addToWatchlist(symbol);
                    autocompleteList.style.display = 'none';
                } else {
                    updateFinanceData(symbol);
                    fetchStockInfo(symbol);
                    autocompleteList.style.display = 'none';
                }
            } else {
                if (window.showNotification) {
                    window.showNotification(`Symbol "${symbol}" not found. Please check the spelling or try a different symbol.`, 4000);
                } else {
                    alert(`Symbol "${symbol}" not found. Please check the spelling or try a different symbol.`);
                }
            }
        }
    });

    // Add a visual indicator for valid symbols
    input.addEventListener('input', function() {
        const symbol = this.value.trim().toUpperCase();
        const isValidSymbol = stockSymbols[symbol];
        if (symbol && isValidSymbol) {
            this.style.borderColor = '#4CAF50';
            this.title = `Valid symbol: ${symbol}`;
        } else if (symbol && !isValidSymbol) {
            this.style.borderColor = '#f44336';
            this.title = `Invalid symbol: ${symbol}`;
        } else {
            this.style.borderColor = '';
            this.title = 'Enter a stock symbol';
        }
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !autocompleteList.contains(e.target)) {
            autocompleteList.style.display = 'none';
        }
    });
}

// Enhanced stock information display
export async function fetchStockInfo(symbol) {
    try {
        const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
        if (!response.ok) throw new Error('Failed to fetch stock info');
        
        const data = await response.json();
        const result = data.chart.result[0];
        const meta = result.meta;
        
        return {
            symbol: meta.symbol,
            name: meta.shortName || stockSymbols[symbol] || symbol,
            price: meta.regularMarketPrice,
            change: meta.regularMarketChange,
            changePercent: meta.regularMarketChangePercent,
            marketCap: meta.marketCap,
            volume: meta.volume,
            avgVolume: meta.averageVolume,
            high: meta.regularMarketDayHigh,
            low: meta.regularMarketDayLow,
            open: meta.regularMarketOpen,
            previousClose: meta.previousClose,
            marketState: meta.marketState
        };
    } catch (error) {
        console.error('Error fetching stock info:', error);
        return null;
    }
}

// Enhanced real-time data display
export function updateRealTimeFinance(data) {
    const realTimeContainer = document.querySelector('#finance .real-time-data-container');
    if (data.error) {
        realTimeContainer.innerHTML = '<p>Unable to fetch real-time financial data.</p>';
        return;
    }

    // Update last known values if new data is available
    if (data.change !== undefined && data.changePercent !== undefined) {
        lastKnownChange = data.change;
        lastKnownChangePercent = data.changePercent;
    }
}

export function isMarketOpen() {
    const symbol = document.getElementById('stockSymbolInput').value.toUpperCase();
    
    // Check if it's a crypto symbol
    if (symbol.endsWith('-USD')) {
        return true; // Crypto markets are always open
    }

    // Existing stock market hour checks
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

// Add this helper function to ensure data points are properly connected
// Modify the processChartData function to accept symbol as a parameter
// ... existing code ...

function processChartData(dates, prices, symbol) {
    // Create arrays to store valid data points
    const validDates = [];
    const validPrices = [];
    
    // Simply collect all valid data points
    for (let i = 0; i < prices.length; i++) {
        if (prices[i] !== null && prices[i] !== undefined) {
            validDates.push(new Date(dates[i]));
            validPrices.push(prices[i]);
        }
    }

    return {
        dates: validDates,
        prices: validPrices,
        symbol: symbol
    };
}

// ... existing code ...


// Function to fetch financial data
export const fetchFinancialData = async (symbol = '^IXIC', timeRange = '5m', interval = '1m') => {
    try {
        const response = await fetch(`/api/finance/${symbol}?range=${timeRange}&interval=${interval}`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            throw new Error('Invalid data format received');
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp || [];
        const prices = result.indicators.quote[0].close || [];
        const volumes = result.indicators.quote[0].volume || [];

        const dates = timestamps.map(ts => new Date(ts * 1000).toISOString());
        return { dates, prices, symbol, timeRange };
    } catch (error) {
        console.error('Error fetching financial data:', error);
        throw error; // Re-throw to handle in the UI
    }
};

// Function to fetch real-time financial data from the server
export const fetchRealTimeYahooFinanceData = async (symbol = '^IXIC') => {
    try {
        const response = await fetch(`/api/finance/${symbol}?range=5m&interval=1m`, {
            redirect: 'follow' // Ensure fetch follows redirects
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Stock symbol ${symbol} not found (404)`);
                return { error: `Stock ${symbol} not found` };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if the data has the expected structure
        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            console.warn(`Invalid data structure for ${symbol}`);
            return { error: `Invalid data for ${symbol}` };
        }
        
        const result = data.chart.result[0];
        const meta = result.meta;
        
        // Check if meta data exists
        if (!meta) {
            console.warn(`No meta data for ${symbol}`);
            return { error: `No data available for ${symbol}` };
        }
        
        const price = meta.regularMarketPrice;
        const change = meta.regularMarketChange;
        const changePercent = meta.regularMarketChangePercent;
        const timestamp = new Date(meta.regularMarketTime * 1000);

        return { symbol, price, change, changePercent, timestamp };
    } catch (error) {
        console.error(`Error fetching real-time Yahoo Finance data for ${symbol}:`, error);
        return { error: `Unable to fetch data for ${symbol}` };
    }
};

// Function to update UI with financial data
export function updateFinance(data) {
    const chartContainer = document.querySelector('#finance .chart-container');
    if (data.error) {
        chartContainer.innerHTML = '<p>Unable to fetch financial data.</p>';
        return;
    }

    if (!data.dates || !data.prices) {
        chartContainer.innerHTML = '<p>No data available for the selected range.</p>';
        return;
    }

    // Clear the inner HTML and rebuild the chart structure
    chartContainer.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
            <div class="zoom-controls">
                <button class="zoom-button" id="zoomIn">+</button>
                <button class="zoom-button" id="zoomOut">-</button>
                <button class="zoom-button" id="resetZoom">↺</button>
                <button class="fullscreenButton" id="fullscreenButton">⤢</button>
            </div>
            <canvas id="financeChart"></canvas>
            <input type="range" id="chartSlider" min="0" max="100" value="0" class="chart-slider">
            <div class="chart-resize-handle chart-resize-handle-se" title="Drag to resize"></div>
        </div>
    `;

    const canvas = document.getElementById('financeChart');
    if (!canvas) return;

    // Destroy existing chart if it exists
    if (window.financeChart && typeof window.financeChart.destroy === 'function') {
        window.financeChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    const processedData = processChartData(data.dates, data.prices, data.symbol);
    processedData.timeRange = data.timeRange; 
    
    window.financeChart = initializeChart(ctx, processedData);

    // Re-attach event listeners
    document.getElementById('zoomIn').addEventListener('click', () => window.financeChart.zoom(1.1));
    document.getElementById('zoomOut').addEventListener('click', () => window.financeChart.zoom(0.9));
    document.getElementById('resetZoom').addEventListener('click', resetChartZoom);
    document.getElementById('fullscreenButton').addEventListener('click', () => {
        const chartElement = document.getElementById('financeChart').parentElement;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            chartElement.requestFullscreen();
        }
    });

    const slider = document.getElementById('chartSlider');
    slider.addEventListener('input', function(e) {
        if (!window.financeChart) return;
        const chart = window.financeChart;
        const totalPoints = chart.data.labels.length;
        if (totalPoints < 2) return;
        const visiblePoints = Math.floor(totalPoints * 0.1); 
        const maxStartIndex = totalPoints - visiblePoints;
        const startIndex = Math.floor((e.target.value / 100) * maxStartIndex);
        chart.options.scales.x.min = chart.data.labels[startIndex];
        chart.options.scales.x.max = chart.data.labels[startIndex + visiblePoints - 1];
        chart.update('none');
    });

    setupChartResize(chartContainer);
}

// Function to setup chart resize functionality
function setupChartResize(chartContainer) {
    const resizeHandle = chartContainer.querySelector('.chart-resize-handle-se');
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
        let startX = e.clientX;
        let startY = e.clientY;
        let startWidth = chartContainer.offsetWidth;
        let startHeight = chartContainer.offsetHeight;

        function doDrag(e) {
            if (!isResizing) return;
            const newWidth = startWidth + e.clientX - startX;
            const newHeight = startHeight + e.clientY - startY;
            chartContainer.style.width = `${newWidth}px`;
            chartContainer.style.height = `${newHeight}px`;
            if (window.financeChart) {
                window.financeChart.resize();
            }
        }

        function stopDrag() {
            isResizing = false;
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        }

        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    });
}

// This function handles fetching data and deciding how to update the chart.
export async function updateFinanceData(symbol, timeRange = '1d', interval = '1m', isRefresh = false) {
    try {
        currentSymbol = symbol; // Keep track of the current symbol
        
        // Always fetch latest real-time data for the header display
        const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
        updateRealTimeFinance(realTimeData);

        if (isRefresh && window.financeChart) {
            // For a live refresh, just add the new data point to the existing chart.
            if (realTimeData && realTimeData.price && realTimeData.timestamp) {
                 addData(window.financeChart, realTimeData.timestamp, realTimeData.price);
            }
        } else {
            // For a new symbol or initial load, fetch historical data and do a full redraw.
            const historicalData = await fetchFinancialData(symbol, timeRange, interval);
            updateFinance(historicalData);
        }
        updateWatchlistUI(); // Keep watchlist UI in sync
    } catch (error) {
        logger.error('Error updating finance data:', error);
        const chartContainer = document.querySelector('#finance .chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<p class="error">Error loading stock data. Please try again.</p>';
        }
    }
}

// The auto-refresh loop now correctly calls for a refresh.
export function startAutoRefresh() {
    stopAutoRefresh(); 
    if (!currentSymbol) return;

    const isCrypto = currentSymbol.endsWith('-USD');
    
    // Only auto-refresh if the market is open OR if it's a cryptocurrency.
    if (isMarketOpen() || isCrypto) {
        updateInterval = setInterval(() => {
            // Pass `true` for the `isRefresh` flag to prevent full chart recreation
            updateFinanceData(currentSymbol, undefined, undefined, true);
        }, 5000); // Refresh every 5 seconds
    } else {
        logger.warn(`Market is closed for ${currentSymbol}. Auto-refresh will not start.`);
    }
}

// Stop function now only needs to clear the main interval
export function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Update the event listener for stock symbol input
document.getElementById('stockSymbolInput').addEventListener('change', (event) => {
    const symbol = event.target.value.toUpperCase();
    
    // Get the currently active time range button
    const activeButton = document.querySelector('.time-range-button.active') || document.getElementById('realtimeButton');
    
    // Use data attributes instead of parsing onclick
    let timeRange = '1d';
    let interval = '1m';
    
    if (activeButton) {
        timeRange = activeButton.getAttribute('data-time-range') || '1d';
        interval = activeButton.getAttribute('data-interval') || '1m';
    }
    
    // Check if auto-refresh is already running
    if (updateInterval) {
        stopAutoRefresh();
    }
    
    startAutoRefresh();
});


// Function to get the current theme
function getCurrentTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}


export function togglePauseFinance() {
    const header = document.querySelector('.finance-header .controls');
    let button = document.getElementById('pause-finance-button');

    if (!button) {
        button = document.createElement('button');
        button.id = 'pause-finance-button';
        button.className = 'btn';
        header.appendChild(button);
    }

    const isPaused = button.classList.toggle('paused');
    if (isPaused) {
        button.textContent = 'Resume';
        stopAutoRefresh();
    } else {
        button.textContent = 'Pause';
        // When resuming, restart the auto-refresh loop
        startAutoRefresh();
    }
}

document.querySelectorAll('.time-range-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.time-range-button').forEach(btn => {
            btn.classList.remove('active');
        });
        // Add active class to clicked button
        button.classList.add('active');
        
        const timeRange = button.getAttribute('data-time-range');
        const interval = button.getAttribute('data-interval');
        const symbol = document.getElementById('stockSymbolInput').value || '^IXIC';
        handleFinanceUpdate(timeRange, interval);
    });
});

export async function handleFinanceUpdate(timeRange, interval) {
    const symbolInput = document.getElementById('stockSymbolInput');
    const symbol = symbolInput.value.toUpperCase() || currentSymbol;

    try {
        // Stop any ongoing updates first
        stopAutoRefresh();

        // Use the correct, consolidated update function
        await updateFinanceData(symbol, timeRange, interval);

        // Resume auto-refresh if the feature is not paused
        const pauseButton = document.getElementById('pause-finance-button');
        if (!pauseButton || !pauseButton.classList.contains('paused')) {
             startAutoRefresh();
        }

    } catch (error) {
        logger.error('Error in handleFinanceUpdate:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    function handleFullscreen(event) {
        const fullscreenButton = event.target.closest('#fullscreenButton');
        if (!fullscreenButton) return;
    
        const chartContainer = fullscreenButton.closest('.chart-container');
        if (!chartContainer) return;
    
        const canvas = chartContainer.querySelector('canvas');
        if (!canvas) return;
    
        const existingData = window.financeChart?.data || {};
        const ctx = canvas.getContext('2d');
    
        if (!document.fullscreenElement) {
            chartContainer.requestFullscreen().then(() => {
                setTimeout(() => {
                    if (window.financeChart) window.financeChart.destroy();
                    
                    canvas.width = chartContainer.clientWidth;
                    canvas.height = chartContainer.clientHeight;
                    
                    window.financeChart = initializeChart(ctx, {
                        dates: existingData.labels || [],
                        prices: existingData.datasets?.[0]?.data || [],
                        symbol: document.getElementById('stockSymbolInput').value || '^IXIC'
                    });
                }, 100); // second delay after entering fullscreen
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => {
                    if (window.financeChart) window.financeChart.destroy();
                    
                    canvas.width = chartContainer.clientWidth;
                    canvas.height = 400;
                    
                    window.financeChart = initializeChart(ctx, {
                        dates: existingData.labels || [],
                        prices: existingData.datasets?.[0]?.data || [],
                        symbol: document.getElementById('stockSymbolInput').value || '^IXIC'
                    });
                }, 100); // second delay after exiting fullscreen
            });
        }
    }

    document.body.addEventListener('click', handleFullscreen);
});

function initializeChart(ctx, data) {
    // Check if it's a crypto symbol
    const isCrypto = data.symbol.endsWith('-USD');
    
    // Get current theme with debugging
    const isDarkTheme = document.body.classList.contains('dark-theme');
    logger.logChart('initialization', {
        symbol: data.symbol,
        isDarkTheme: isDarkTheme,
        dataPoints: data.prices?.length || 0
    });
    
    // Set colors based on theme
    const backgroundColor = isDarkTheme ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const borderColor = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    
    logger.logChart('colors', {
        backgroundColor,
        textColor,
        gridColor,
        borderColor
    });
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: `${data.symbol} Closing Prices`,
                data: data.prices,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 10,
                spanGaps: true,
                segment: {
                    borderColor: ctx => {
                        // Optional: Add color coding for positive/negative segments
                        const value = ctx.p0.parsed.y;
                        const nextValue = ctx.p1.parsed.y;
                        return nextValue >= value ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)';
                    }
                }
            }]
        },
        options: {
            plugins: {
                zoom: {
                  zoom: {
                    wheel: {
                      enabled: true,
                    },
                    pinch: {
                      enabled: true
                    },
                    mode: 'xy',
                    onZoom: function(ctx) {
                        // If trying to zoom out, reset to previous state
                        if (ctx.chart.getZoomLevel() < 1) {
                            ctx.chart.resetZoom();
                        }
                    }
                  }
                }
            },
            animation: true,
            responsive: true,
            maintainAspectRatio: true,
            backgroundColor: backgroundColor,
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + Number(value).toFixed(2);
                        },
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    },
                    border: {
                        color: borderColor
                    },
                    offset: true,
                    beginAtZero: false
                },
                x: {
                    type: 'time',
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: gridColor
                    },
                    border: {
                        color: borderColor
                    },
                    offset: true,
                    bounds: 'data'
                }
            }
            
        }
    });
}

// Initialize finance features when DOM is loaded
export function initializeFinance() {
    // Set the default symbol based on current day
    currentSymbol = getDefaultSymbol();
    
    // Update the input field with the default symbol
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    if (stockSymbolInput) {
        stockSymbolInput.value = currentSymbol;
    }
    
    // Load initial data with the default symbol
    handleFinanceUpdate('1d', '1m');
    
    // Start the dashboard automatically
    startStockDashboard();
    
    // Set initial button state to "Pause" since dashboard is running
    const button = document.getElementById('dashboardToggle');
    if (button) {
        button.textContent = 'Pause';
        button.className = 'btn-small waves-effect waves-light green';
        isDashboardPaused = false;
    }
    
    setupAutocomplete();
    loadWatchlistFromPreferences();
    
    // Set up event listeners for stock symbol buttons
    document.querySelectorAll('[data-stock-symbol]').forEach(button => {
        button.addEventListener('click', function() {
            const symbol = this.getAttribute('data-stock-symbol');
            document.getElementById('stockSymbolInput').value = symbol;
            updateFinanceData(symbol);
        });
    });
    
    // Set up event listeners for time range buttons
    document.querySelectorAll('.time-range-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            document.querySelectorAll('.time-range-button').forEach(btn => {
                btn.classList.remove('active');
            });
            // Add active class to clicked button
            button.classList.add('active');
            
            const timeRange = button.getAttribute('data-time-range');
            const interval = button.getAttribute('data-interval');
            const symbol = document.getElementById('stockSymbolInput').value || '^IXIC';
            handleFinanceUpdate(timeRange, interval);
        });
    });
    
    // Set initial active state
    const realtimeButton = document.getElementById('realtimeButton');
    if (realtimeButton) {
        realtimeButton.classList.add('active');
    }
}

// Clear entire watchlist
export function clearWatchlist() {
    if (!window.confirm('Are you sure you want to clear your entire watchlist? This action cannot be undone.')) {
        return;
    }
    watchlist = [];
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();
}

// Reset watchlist to default selection
export function resetToDefaultWatchlist() {
    watchlist = [...DEFAULT_WATCHLIST];
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();
    logger.success('Watchlist reset to default selection');
}

// Reset chart zoom
export function resetChartZoom() {
    const chart = Chart.getChart('financeChart');
    if (chart) {
        chart.resetZoom();
    }
}

// Reset finance card positions to grid layout
export function resetFinanceCardPositions() {
    const cards = document.querySelectorAll('#finance .card');
    cards.forEach(card => {
        card.style.position = 'static';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
        card.style.transform = '';
    });
    logger.success('Card positions reset to grid layout');
}

// Update chart theme based on current theme
export function updateChartTheme() {
    const chart = window.financeChart;
    if (!chart) {
        logger.warn('No chart found to update theme');
        return;
    }

    const isDark = document.body.classList.contains('dark-theme');
    logger.logChart('theme update', { isDark });

    const colors = {
        text: isDark ? '#ffffff' : '#333333',
        grid: isDark ? '#444444' : '#e0e0e0',
        background: isDark ? '#1e1e1e' : '#ffffff',
        border: isDark ? '#666666' : '#cccccc'
    };

    logger.logChart('colors', colors);

    // Update chart options
    chart.options.scales.x.grid.color = colors.grid;
    chart.options.scales.y.grid.color = colors.grid;
    chart.options.scales.x.ticks.color = colors.text;
    chart.options.scales.y.ticks.color = colors.text;
    chart.options.plugins.legend.labels.color = colors.text;

    // Update chart background
    chart.canvas.style.backgroundColor = colors.background;

    // Update chart
    chart.update('none');

    logger.success('Chart theme updated successfully');
}

// Fetch historical data for stocks to calculate open-to-close percentage
async function fetchStockHistoricalData(symbol) {
    try {
        // Fetch 1 day of data with 1-minute intervals to get open and close prices
        const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
        if (!response.ok) throw new Error('Failed to fetch historical data');
        
        const data = await response.json();
        const result = data.chart.result[0];
        
        if (!result || !result.timestamp || !result.indicators.quote[0].open || !result.indicators.quote[0].close) {
            return null;
        }
        
        const timestamps = result.timestamp;
        const opens = result.indicators.quote[0].open;
        const closes = result.indicators.quote[0].close;
        
        // Find the first valid open price (market open)
        let marketOpen = null;
        for (let i = 0; i < opens.length; i++) {
            if (opens[i] !== null && opens[i] !== undefined) {
                marketOpen = opens[i];
                break;
            }
        }
        
        // Find the last valid close price (market close)
        let marketClose = null;
        for (let i = closes.length - 1; i >= 0; i--) {
            if (closes[i] !== null && closes[i] !== undefined) {
                marketClose = closes[i];
                break;
            }
        }
        
        if (marketOpen && marketClose) {
            const change = marketClose - marketOpen;
            const changePercent = (change / marketOpen) * 100;
            
            return {
                symbol: symbol,
                openPrice: marketOpen,
                closePrice: marketClose,
                change: change,
                changePercent: changePercent
            };
        }
        
        return null;
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        return null;
    }
}

// A smarter fetch function for the dashboard
export async function fetchTopStocks(symbolsOverride = null) {
    const symbolsToFetch = symbolsOverride || userPrefs.getFinanceWatchlist() || DEFAULT_WATCHLIST;
    if (symbolsToFetch.length === 0) {
        topStocks = [];
        updateStockDashboard();
        return;
    }

    try {
        const startTime = Date.now();
        const response = await fetch('/api/finance/bulk-real-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: symbolsToFetch }),
        });
        
        const responseTime = Date.now() - startTime;
        logger.logApiRequest('bulk-real-time', response.status, responseTime);
        
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Bulk endpoint error response:', errorText);
            throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        logger.logBulkStockUpdate(symbolsToFetch, data);

        let fetchedStocks = Object.values(data).filter(stock => !stock.error);

        // On weekends, sort crypto to the top
        const day = new Date().getDay();
        if (day === 0 || day === 6) { // Sunday or Saturday
            fetchedStocks.sort((a, b) => {
                const aIsCrypto = a.symbol.endsWith('-USD');
                const bIsCrypto = b.symbol.endsWith('-USD');
                if (aIsCrypto && !bIsCrypto) return -1;
                if (!aIsCrypto && bIsCrypto) return 1;
                return 0;
            });
        }

        topStocks = fetchedStocks;
        updateStockDashboard();
    } catch (error) {
        logger.error("Error fetching top stocks:", error);
    }
}

// Toggle stock dashboard pause/resume functionality
export function toggleStockDashboard() {
    const button = document.getElementById('dashboardToggle');
    
    if (isDashboardPaused) {
        // Resume the dashboard
        resumeStockDashboard();
        button.textContent = 'Pause';
        button.className = 'btn-small waves-effect waves-light green';
        isDashboardPaused = false;
    } else {
        // Pause the dashboard
        pauseStockDashboard();
        button.textContent = 'Resume';
        button.className = 'btn-small waves-effect waves-light red';
        isDashboardPaused = true;
    }
}

// Pause the stock dashboard
function pauseStockDashboard() {
    if (stockDashboardInterval) {
        clearInterval(stockDashboardInterval);
        stockDashboardInterval = null;
        logger.logDashboardStatus('paused');
    }
}

// Resume the stock dashboard
function resumeStockDashboard() {
    if (!stockDashboardInterval) {
        // Fetch current data immediately
        fetchTopStocks();
        // Start the interval again
        stockDashboardInterval = setInterval(fetchTopStocks, 5000);
        logger.logDashboardStatus('resumed');
    }
}

// Start stock dashboard auto-refresh (initial start)
export function startStockDashboard() {
    if (!stockDashboardInterval && !isDashboardPaused) {
        fetchTopStocks(); // Initial fetch
        stockDashboardInterval = setInterval(fetchTopStocks, 5000); // Refresh every 5 seconds
        logger.logDashboardStatus('started');
    }
}

// Stop stock dashboard (for cleanup)
export function stopStockDashboard() {
    if (stockDashboardInterval) {
        clearInterval(stockDashboardInterval);
        stockDashboardInterval = null;
        logger.logDashboardStatus('stopped');
    }
}

// Function to add current symbol to watchlist
export function addCurrentSymbolToWatchlist() {
    const input = document.getElementById('stockSymbolInput');
    if (!input) return;
    
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) {
        if (window.showNotification) {
            window.showNotification('Please enter a stock symbol first', 3000);
        }
        return;
    }
    
    if (!stockSymbols[symbol]) {
        if (window.showNotification) {
            window.showNotification(`Symbol "${symbol}" not found. Please check the spelling.`, 4000);
        }
        return;
    }
    
    // Check if already in watchlist
    const currentWatchlist = userPrefs.getFinanceWatchlist();
    if (currentWatchlist.includes(symbol)) {
        if (window.showNotification) {
            window.showNotification(`${symbol} is already in your watchlist`, 3000);
        }
        return;
    }
    
    // Add to watchlist
    addToWatchlist(symbol);
    
    if (window.showNotification) {
        window.showNotification(`${symbol} added to watchlist!`, 3000);
    }
}

// Make functions available globally for HTML onclick handlers
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
window.clearWatchlist = clearWatchlist;
window.addCurrentSymbolToWatchlist = addCurrentSymbolToWatchlist;
window.startStockDashboard = startStockDashboard;
window.stopStockDashboard = stopStockDashboard;
window.selectStock = selectStock;
window.resetChartZoom = resetChartZoom;
window.resetFinanceCardPositions = resetFinanceCardPositions;
window.togglePauseFinance = togglePauseFinance;

// Select stock for detailed view
export function selectStock(symbol) {
    document.getElementById('stockSymbolInput').value = symbol;
    handleFinanceUpdate('1d', '1m');
}






