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
const MAX_POINTS = 50;
let userSelectedSymbol = false; // Track if user manually selected a symbol

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
    '^GSPC',   // S&P 500 Index
    '^HSI',    // Hang Seng Index - Hong Kong
    '^N225',   // Nikkei 225 - Japan
    '^GDAXI',  // DAX - Germany
    '^FTSE',   // FTSE 100 - UK
    '^FCHI',   // CAC 40 - France
    '^STOXX50E', // EURO STOXX 50 - Europe
    'GC=F',    // Gold Futures
    'SI=F',    // Silver Futures
    'EURUSD=X', // Euro to US Dollar
    'USDJPY=X', // US Dollar to Japanese Yen
    'GBPUSD=X', // British Pound to US Dollar
    'USDCNY=X'  // US Dollar to Chinese Yuan
];

// Set default time range and interval
export const DEFAULT_TIME_RANGE = '2h';
export const DEFAULT_INTERVAL = '1m';

// Helper function to get default symbol based on market status
function getDefaultSymbol() {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = etNow.getDay();
    const hours = etNow.getHours();
    const minutes = etNow.getMinutes();
    
    // Check if it's a weekend
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    
    // Check if it's a weekday during market hours (9:30AM - 4:00PM ET)
    const isMarketHours = !isWeekend && 
                         (hours > 9 || (hours === 9 && minutes >= 30)) && 
                         (hours < 16);
    
    if (isWeekend || !isMarketHours) {
        return 'BTC-USD'; // Default to Bitcoin on weekends and outside market hours
    } else {
        return '^IXIC'; // Default to NASDAQ during market hours on weekdays
    }
}

// Initialize with the appropriate default symbol
currentSymbol = getDefaultSymbol();

// Load stock symbols for autocomplete
async function loadStockSymbols() {
    try {
        const response = await fetch('/data/stockSymbols.json');
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
    // Check if chart and required data structure exist
    if (!chart || !chart.data || !chart.data.labels || !chart.data.datasets || !chart.data.datasets[0]) {
        console.log('Chart data structure not properly initialized, skipping addData');
        return;
    }
    
    // Always use ISO string for comparison
    const labelStr = (typeof label === 'string') ? label : label.toISOString();
    // Convert all labels in chart to ISO strings for comparison
    const labelsISO = chart.data.labels.map(l => (typeof l === 'string' ? l : l.toISOString()));
    const lastLabel = labelsISO.length > 0 ? labelsISO[labelsISO.length - 1] : null;

    if (lastLabel !== labelStr && !labelsISO.includes(labelStr)) {
        if (chart.data.labels.length >= MAX_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.data.labels.push(labelStr);
        chart.data.datasets[0].data.push(newData);
        chart.update('none');
        lastTimestamp = labelStr;
    } else {
        // Optionally update the last point if the price changed
        const idx = labelsISO.lastIndexOf(labelStr);
        if (idx !== -1 && chart.data.datasets[0].data[idx] !== newData) {
            chart.data.datasets[0].data[idx] = newData;
            chart.update('none');
        }
    }
}

function updateStockDashboard() {
    const dashboardContainer = document.getElementById('stock-dashboard');
    if (!dashboardContainer) {
        console.log('Stock dashboard container not found on this page, skipping update');
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

        // Fetch real-time data and add to dashboard
            fetchRealTimeYahooFinanceData(symbol).then(newStockData => {
                if (newStockData && !newStockData.error) {
                // Check if already in topStocks to avoid duplicates
                const existingIndex = topStocks.findIndex(stock => stock.symbol === symbol);
                if (existingIndex === -1) {
                    topStocks.push(newStockData);
                } else {
                    // Update existing data
                    topStocks[existingIndex] = newStockData;
                }
                    
                    // Add the new stock card to the existing dashboard
                    const dashboardContainer = document.getElementById('stock-dashboard');
                    const grid = dashboardContainer?.querySelector('.stock-dashboard-grid');
                    
                    if (grid) {
                    // Check if card already exists
                    const existingCard = grid.querySelector(`[data-symbol="${symbol}"]`);
                    if (!existingCard) {
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
                
                // Update the finance chart to show the newly added stock
                userSelectedSymbol = true;
                window.userSelectedSymbol = true;
                document.getElementById('stockSymbolInput').value = symbol;
                updateFinanceData(symbol, DEFAULT_TIME_RANGE, DEFAULT_INTERVAL, false);
                fetchStockInfo(symbol);
                
                // Show notification
                if (window.showNotification) {
                    window.showNotification(`${symbol} added to watchlist`, 3000);
                }
            } else {
                // Show error notification
                if (window.showNotification) {
                    window.showNotification(`Failed to fetch data for ${symbol}`, 4000);
                }
            }
        }).catch(error => {
            console.error(`Error adding ${symbol} to watchlist:`, error);
            if (window.showNotification) {
                window.showNotification(`Error adding ${symbol} to watchlist`, 4000);
            }
        });
    } else {
        // Already in watchlist
        if (window.showNotification) {
            window.showNotification(`${symbol} is already in your watchlist`, 3000);
        }
    }
}

export function removeFromWatchlist(symbol) {
    // Remove from watchlist array
    watchlist = watchlist.filter(s => s !== symbol);
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();

    // Remove from topStocks array
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
    
    // Also remove from previousStockData to prevent memory leaks
    if (previousStockData[symbol]) {
        delete previousStockData[symbol];
    }
    
    // Show notification
    if (window.showNotification) {
        window.showNotification(`${symbol} removed from watchlist`, 3000);
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
            
            // Add click event to the watchlist item (but not the remove button)
            watchlistItem.addEventListener('click', (e) => {
                // Don't trigger if clicking the remove button
                if (e.target.classList.contains('remove-watchlist')) {
                    return;
                }
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

// Simplified stock symbol validation function
async function validateStockSymbol(symbol) {
    symbol = (symbol || '').trim().toUpperCase();
    if (!symbol) {
        return { valid: false, error: 'Symbol cannot be empty' };
    }
    // Most stock symbols are 1-5 alphanumerics, with some exceptions for indices/crypto
    if (!/^[A-Z0-9.^=-]{1,15}$/.test(symbol)) {
        return { valid: false, error: 'Invalid symbol format' };
    }

    const input = document.getElementById('stockSymbolInput');
    if (input) {
        input.style.borderColor = '#FFC107';
        input.title = `Validating ${symbol}...`;
    }

    try {
        const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            let msg = 'Unknown error';
            if (response.status === 404) msg = 'Symbol not found';
            else if (response.status === 429) msg = 'Rate limit exceeded. Please try again later.';
            else if (response.status >= 500) msg = 'Server error. Please try again later.';
            else msg = `HTTP ${response.status}: ${response.statusText}`;
            return { valid: false, error: msg };
        }

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        const meta = result?.meta;
        const closes = result?.indicators?.quote?.[0]?.close;

        if (!meta?.symbol || !Array.isArray(closes) || closes.every(v => v == null)) {
            return { valid: false, error: 'No valid price data available for this symbol' };
        }

        return {
            valid: true,
            name: meta.shortName || meta.longName || meta.symbol || symbol,
            symbol: meta.symbol,
            price: meta.regularMarketPrice,
            marketCap: meta.marketCap,
            volume: meta.volume
        };
    } catch (error) {
        console.error(`Error validating symbol ${symbol}:`, error);
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { valid: false, error: 'Network error. Please check your connection.' };
        }
        return { valid: false, error: 'Validation failed. Please try again.' };
    } finally {
        if (input) {
            input.style.borderColor = '';
            input.title = 'Enter a stock symbol';
        }
    }
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
        
        // Always show the autocomplete list when there's input
        autocompleteList.style.display = 'block';
        
        // Show matches from stockSymbols.json
        const matches = Object.entries(stockSymbols)
            .filter(([symbol, name]) => symbol.includes(value) || name.toUpperCase().includes(value))
            .slice(0, 10);
        let symbolInMatches = false;
        
        if (matches.length > 0) {
            matches.forEach(([symbol, name]) => {
                if (symbol === value.trim()) symbolInMatches = true;
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = `
                    <span class="symbol">${symbol}</span>
                    <span class="name">${name}</span>
                    <button class="btn-small add-watchlist" onclick="addToWatchlist('${symbol}')">+</button>
                `;
                item.addEventListener('click', (e) => {
                    // Don't trigger if clicking the add button
                    if (e.target.classList.contains('add-watchlist')) {
                        return;
                    }
                    userSelectedSymbol = true; // User manually selected this symbol
                    window.userSelectedSymbol = true; // Update global variable
                    input.value = symbol;
                    autocompleteList.style.display = 'none';
                    updateFinanceData(symbol);
                    fetchStockInfo(symbol);
                });
                autocompleteList.appendChild(item);
            });
        }
        
        // Always show add button for the current input if it's not already in the watchlist
        const symbol = value.trim();
        if (symbol && symbol.length > 0 && !watchlist.includes(symbol)) {
            const addBtn = document.createElement('div');
            addBtn.className = 'autocomplete-item';
            const displayName = stockSymbols[symbol] || symbol;
            addBtn.innerHTML = `<span class="symbol">${symbol}</span><span class="name">${displayName}</span><button class="btn-small add-watchlist" onclick="addToWatchlist('${symbol}')">Add to Watchlist</button>`;
            addBtn.addEventListener('click', async (e) => {
                // Don't trigger if clicking the add button
                if (e.target.classList.contains('add-watchlist')) {
                    return;
                }
                
                // Validate unknown symbols before adding
                if (!stockSymbols[symbol]) {
                    const validation = await validateStockSymbol(symbol);
                    if (!validation.valid) {
                        const errorMessage = validation.error || 'Unknown error occurred';
                        if (window.showNotification) {
                            window.showNotification(`Error: ${errorMessage}`, 5000);
                        }
                        return;
                    }
                    // Add to stockSymbols cache for future use
                    stockSymbols[symbol] = validation.name;
                }
                
                addToWatchlist(symbol);
                autocompleteList.style.display = 'none';
            });
            autocompleteList.appendChild(addBtn);
        }
    }

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', renderSuggestions);

    // Pressing Enter with any symbol - validate and add to watchlist
    input.addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            const symbol = this.value.trim().toUpperCase();
            if (symbol && symbol.length > 0) {
                userSelectedSymbol = true; // User manually entered this symbol
                window.userSelectedSymbol = true; // Update global variable
                
                // First check if it's already in watchlist
                if (watchlist.includes(symbol)) {
                    updateFinanceData(symbol);
                    fetchStockInfo(symbol);
                    autocompleteList.style.display = 'none';
                    return;
                }
                
                // Validate the symbol by attempting to fetch data
                const validation = await validateStockSymbol(symbol);
                if (validation.valid) {
                    // Add to stockSymbols cache for future use
                    stockSymbols[symbol] = validation.name;
                    
                    // Add to watchlist
                    addToWatchlist(symbol);
                    autocompleteList.style.display = 'none';
                    
                    // Show success notification with company name
                    if (window.showNotification) {
                        window.showNotification(`${symbol} (${validation.name}) added to watchlist!`, 3000);
                }
            } else {
                    // Show specific error message
                    const errorMessage = validation.error || 'Unknown error occurred';
                if (window.showNotification) {
                        window.showNotification(`Error: ${errorMessage}`, 5000);
                } else {
                        alert(`Error: ${errorMessage}`);
                    }
                }
            }
        }
    });

    // Add a visual indicator for symbols
    input.addEventListener('input', function() {
        const symbol = this.value.trim().toUpperCase();
        if (symbol && symbol.length > 0) {
            if (stockSymbols[symbol]) {
                // Known symbol from our list
            this.style.borderColor = '#4CAF50';
                this.title = `Known symbol: ${symbol} - ${stockSymbols[symbol]}`;
            } else if (watchlist.includes(symbol)) {
                // Symbol already in watchlist
                this.style.borderColor = '#2196F3';
                this.title = `Already in watchlist: ${symbol}`;
            } else {
                // Unknown symbol - will be validated when added
                this.style.borderColor = '#FF9800';
                this.title = `Unknown symbol: ${symbol} - Will validate when added`;
            }
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

    // Use Eastern Time for market hours check
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
        const response = await fetch(`/api/finance/${symbol}?range=${timeRange}&interval=${interval}`)
        
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
export function updateFinance2(data) {
    const chartContainer = document.querySelector('#finance .chart-container');
    if (!chartContainer) {
        console.log('Finance chart container not found on this page, skipping update');
        return;
    }
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
 
    <div class="zoom-controls">
        <button class="zoom-button" id="zoomIn">+</button>
        <button class="zoom-button" id="zoomOut">-</button>
        <button class="zoom-button" id="resetZoom">↺</button>
        <button class="fullscreenButton" id="fullscreenButton" >⤢</button>
        <button class="pause-button" id="pause-finance-button" onclick="togglePauseFinance()">⏸</button>
    </div>
    <canvas id="financeChart"></canvas>
    `;

    const canvas = document.getElementById('financeChart');
    if (!canvas) return;

    // Destroy existing chart if it exists
    if (window.financeChart && typeof window.financeChart.destroy === 'function') {
        window.financeChart.destroy();
    }

    // Ensure canvas has proper dimensions before initializing chart
    const ensureCanvasReady = () => {
    const parent = canvas.parentElement;
        if (!parent) return false;
        
        // Wait for parent to have dimensions
        if (parent.clientWidth === 0 || parent.clientHeight === 0) {
            return false;
        }
        
        // Set canvas dimensions
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
        
        return true;
    };

    // Initialize chart with proper timing
    const initializeChartWithRetry = () => {
        if (!ensureCanvasReady()) {
            // If canvas isn't ready, retry after a short delay
            setTimeout(initializeChartWithRetry, 50);
            return;
    }
    
    const ctx = canvas.getContext('2d');
    const processedData = processChartData(data.dates, data.prices, data.symbol);
    processedData.timeRange = data.timeRange; 
    
    window.financeChart = initializeChart(ctx, processedData);

        
        // Force a resize and update to ensure proper rendering
        if (window.financeChart) {
            setTimeout(() => {
                window.financeChart.resize();
                window.financeChart.update('none');
            }, 100);
        }
    };

    // Start initialization
    initializeChartWithRetry();

    // Re-attach event listeners
    document.getElementById('zoomIn').addEventListener('click', () => window.financeChart.zoom(1.1));
    document.getElementById('zoomOut').addEventListener('click', () => window.financeChart.zoom(0.9));
    document.getElementById('resetZoom').addEventListener('click', resetChartZoom);
    
    // Improved fullscreen functionality with proper chart resizing
    function handleFullscreen(event) {
        const fullscreenButton = event.target.closest('#fullscreenButton');
        if (!fullscreenButton) return;
    
        const chartContainer = fullscreenButton.closest('.chart-container');
        if (!chartContainer) return;
    
        const canvas = chartContainer.querySelector('canvas');
        if (!canvas) return;
    
        const isMobile = isMobileDevice();
        
        // Store the current timeframe when entering fullscreen
        let currentTimeRange = DEFAULT_TIME_RANGE;
        let currentInterval = DEFAULT_INTERVAL;
        const activeButton = document.querySelector('.time-range-button.active');
        if (activeButton) {
            currentTimeRange = activeButton.getAttribute('data-time-range') || DEFAULT_TIME_RANGE;
            currentInterval = activeButton.getAttribute('data-interval') || DEFAULT_INTERVAL;
        }
    
        if (!document.fullscreenElement) {
            // Entering fullscreen
            chartContainer.requestFullscreen().then(() => {
                // Wait for the fullscreen state to be fully established
                const checkFullscreen = () => {
                    if (document.fullscreenElement === chartContainer) {
                        // DOM is ready, now resize the chart
                        setTimeout(() => {
                            // Use dynamic viewport units for mobile
                            if (isMobile) {
                                // For mobile, use dynamic viewport units
                                const mobileWidth = window.innerWidth || document.documentElement.clientWidth;
                                const mobileHeight = window.innerHeight || document.documentElement.clientHeight;
                                canvas.width = mobileWidth;
                                canvas.height = mobileHeight;
                            } else {
                                canvas.width = chartContainer.clientWidth;
                                canvas.height = chartContainer.clientHeight;
                            }
                            
                            // Update chart options for fullscreen
                            if (window.financeChart) {
                                window.financeChart.options.maintainAspectRatio = true;
                                window.financeChart.resize();
                                window.financeChart.update('none'); // Force coordinate recalculation
                            }
                        }, 100);
                    } else {
                        // Still waiting for fullscreen to be established
                        requestAnimationFrame(checkFullscreen);
                    }
                };
                checkFullscreen();
            });
        } else {
            // Exiting fullscreen
            document.exitFullscreen().then(() => {
                // Wait for fullscreen to fully exit before resizing
                const checkExit = () => {
                    if (!document.fullscreenElement) {
                        // Fullscreen has exited, resize chart back to normal
                        window.financeChart.options.maintainAspectRatio = false;
                        canvas.width = chartContainer.clientWidth;
                        canvas.height = chartContainer.clientHeight;
                        
                        // Update chart options back to normal
                        if (window.financeChart) {
                            window.financeChart.resize();
                            window.financeChart.update('none');
                        }
                    } else {
                        // Still waiting for fullscreen to exit
                        requestAnimationFrame(checkExit);
                    }
                };
                checkExit();
            });
        }
    }
    document.body.addEventListener('click', handleFullscreen);
}

// This function handles fetching data and deciding how to update the chart.
export async function updateFinanceData(symbol, timeRange = DEFAULT_TIME_RANGE, interval = DEFAULT_INTERVAL, isRefresh = false) {
    try {
        currentSymbol = symbol; // Keep track of the current symbol
        
        // Always fetch latest real-time data for the header display
        const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
        updateRealTimeFinance(realTimeData);

        if (isRefresh && window.financeChart) {
            // For a live refresh, just add the new data point to the existing chart.
            if (realTimeData && realTimeData.price && realTimeData.timestamp) {
                 addData(window.financeChart, realTimeData.timestamp.toISOString(), realTimeData.price);
            }
        } else {
            // For a new symbol or initial load, fetch historical data and do a full redraw.
            const historicalData = await fetchFinancialData(symbol, timeRange, interval);
            updateFinance2(historicalData);
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

// Update the event listener for stock symbol input
// Set userSelectedSymbol to true when user changes input
const stockSymbolInput = document.getElementById('stockSymbolInput');
if (stockSymbolInput) {
    stockSymbolInput.addEventListener('change', (event) => {
        userSelectedSymbol = true;
        const symbol = event.target.value.toUpperCase();
        // ... existing code ...
        // Get the currently active time range button
        const activeButton = document.querySelector('.time-range-button.active') || document.getElementById('realtimeButton');
        let timeRange = DEFAULT_TIME_RANGE;
        let interval = DEFAULT_INTERVAL;
        if (activeButton) {
            timeRange = activeButton.getAttribute('data-time-range') || DEFAULT_TIME_RANGE;
            interval = activeButton.getAttribute('data-interval') || DEFAULT_INTERVAL;
        }
        if (updateInterval) {
            stopAutoRefresh();
        }
        startAutoRefresh();
    });
}

// Update selectStock to set userSelectedSymbol to true
export function selectStock(symbol) {
    userSelectedSymbol = true;
    window.userSelectedSymbol = true; // Update global variable
    document.getElementById('stockSymbolInput').value = symbol;
    handleFinanceUpdate(DEFAULT_TIME_RANGE, DEFAULT_INTERVAL);
}

// Update startAutoRefresh to respect pause and user selection
export function startAutoRefresh() {
    stopAutoRefresh(); 
    if (!currentSymbol) return;
    const isCrypto = currentSymbol.endsWith('-USD');
    const pauseButton = document.getElementById('pause-finance-button');
    if (pauseButton && pauseButton.classList.contains('paused')) {
        return; // Do not start if paused
    }
    
    // Determine if we should start auto-refresh
    const shouldStartRefresh = isMarketOpen() || isCrypto || userSelectedSymbol;
    
    if (shouldStartRefresh) {
        updateInterval = setInterval(() => {
            // Only check for market close transition if user hasn't manually selected a symbol
            if (!userSelectedSymbol) {
                const shouldSwitchToCrypto = !isMarketOpen() && !currentSymbol.endsWith('-USD');
                if (shouldSwitchToCrypto) {
                    // Market just closed, switch to BTC-USD only if user hasn't selected a symbol
                    currentSymbol = 'BTC-USD';
                    const stockSymbolInput = document.getElementById('stockSymbolInput');
                    if (stockSymbolInput) {
                        stockSymbolInput.value = currentSymbol;
                    }
                    userSelectedSymbol = false; // App is now in auto mode
                    window.userSelectedSymbol = false; // Update global variable
                    updateFinanceData(currentSymbol, undefined, undefined, false);
                    return;
                }
            }
            
            // Normal refresh - Pass `true` for the `isRefresh` flag to prevent full chart recreation
            updateFinanceData(currentSymbol, undefined, undefined, true);
        }, 5000); // Refresh every 5 seconds
    } else {
        logger.warn(`Market is closed for ${currentSymbol} and user hasn't selected a symbol. Auto-refresh will not start.`);
    }
}

// Update handleMarketCloseTransition to respect userSelectedSymbol
export function handleMarketCloseTransition() {
    const currentSymbol = document.getElementById('stockSymbolInput')?.value.toUpperCase();
    // If we're currently showing a stock (not crypto) and market just closed, and user hasn't manually selected a symbol
    if (currentSymbol && !currentSymbol.endsWith('-USD') && !isMarketOpen() && !userSelectedSymbol) {
        // Switch to BTC-USD only if user hasn't selected a symbol
        const newSymbol = 'BTC-USD';
        document.getElementById('stockSymbolInput').value = newSymbol;
        userSelectedSymbol = false; // App is now in auto mode
        window.userSelectedSymbol = false; // Update global variable
        updateFinanceData(newSymbol, DEFAULT_TIME_RANGE, DEFAULT_INTERVAL, false);
        if (updateInterval) {
            stopAutoRefresh();
            startAutoRefresh();
        }
        logger.info(`Market closed, switched from ${currentSymbol} to ${newSymbol}`);
    }
}

// In handleFinanceUpdate, only start auto-refresh if not paused
export async function handleFinanceUpdate(timeRange, interval) {
    const symbolInput = document.getElementById('stockSymbolInput');
    if (!symbolInput) {
        console.log('Stock symbol input not found on this page, skipping finance update');
        return;
    }
    const symbol = symbolInput.value.toUpperCase() || currentSymbol;
    try {
        stopAutoRefresh();
        await updateFinanceData(symbol, timeRange, interval);
        const pauseButton = document.getElementById('pause-finance-button');
        if (!pauseButton || !pauseButton.classList.contains('paused')) {
            startAutoRefresh();
        }
    } catch (error) {
        logger.error('Error in handleFinanceUpdate:', error);
    }
}

// Function to get the current theme
function getCurrentTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}

export function togglePauseFinance() {
    let button = document.getElementById('pause-finance-button');
    if (!button) return;
    const isPaused = button.classList.toggle('paused');
    if (isPaused) {
        button.textContent = 'Resume';
        stopAutoRefresh();
    } else {
        button.innerHTML = '⏸'; // Pause icon
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

function initializeChart(ctx, data) {
    const isMobile = isMobileDevice();

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
                pointRadius: 3,
                pointHoverRadius: 5,
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
                    mode: 'x',
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
            maintainAspectRatio: false,
            backgroundColor: backgroundColor,
            scales: {
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + Number(value).toFixed(2);
                        },
                        color: textColor
                    },
                    border: {
                        color: borderColor
                    },
                    offset: true,
                    beginAtZero: false
                },
                x: {
                    grid: {
                        display: false
                    },
                    type: 'time',
                    ticks: {
                        color: textColor
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
    
    // Load initial data with the default symbol, time range, and interval
    handleFinanceUpdate(DEFAULT_TIME_RANGE, DEFAULT_INTERVAL);
    
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
            updateFinanceData(symbol, DEFAULT_TIME_RANGE, DEFAULT_INTERVAL);
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
    
    // Set initial active state for the default time range button
    const defaultButton = Array.from(document.querySelectorAll('.time-range-button')).find(btn => btn.getAttribute('data-time-range') === DEFAULT_TIME_RANGE && btn.getAttribute('data-interval') === DEFAULT_INTERVAL);
    if (defaultButton) {
        defaultButton.classList.add('active');
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
    
    // Refresh the stock dashboard to show empty state
    if (stockDashboardInterval) {
        fetchTopStocks();
        logger.success('Watchlist cleared and dashboard refreshed');
    } else {
        logger.success('Watchlist cleared');
    }
}

// Reset watchlist to default selection
export function resetToDefaultWatchlist() {
    if (!window.confirm('Are you sure you want to reset your entire watchlist? This action cannot be undone.')) {
        return;
    }
    watchlist = [...DEFAULT_WATCHLIST];
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();
    
    // Refresh the stock dashboard to show the new symbols
    if (stockDashboardInterval) {
        fetchTopStocks();
        logger.success('Watchlist reset to default selection and dashboard refreshed');
    } else {
        logger.success('Watchlist reset to default selection');
    }
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

        // Sort stocks based on market hours
        const now = new Date();
        const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const day = etNow.getDay();
        const hours = etNow.getHours();
        const minutes = etNow.getMinutes();
        
        // Check if it's a weekend
        const isWeekend = day === 0 || day === 6; // Sunday or Saturday
        
        // Check if it's a weekday during market hours (9:30AM - 4:00PM ET)
        const isMarketHours = !isWeekend && 
                            (hours > 9 || (hours === 9 && minutes >= 30)) && 
                            (hours < 16);
        
        // If outside market hours, sort crypto to the top
        if (!isMarketHours) {
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
        
        // Check for market close transition during dashboard updates
        handleMarketCloseTransition();
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
export async function addCurrentSymbolToWatchlist() {
    const input = document.getElementById('stockSymbolInput');
    if (!input) return;
    
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) {
        if (window.showNotification) {
            window.showNotification('Please enter a stock symbol first', 3000);
        }
        return;
    }
    
    // Check if already in watchlist
    const currentWatchlist = userPrefs.getFinanceWatchlist();
    if (currentWatchlist.includes(symbol)) {
        if (window.showNotification) {
            window.showNotification(`${symbol} is already in your watchlist`, 3000);
        }
        updateFinanceData(symbol, undefined, undefined, false);
        return;
    }
    
    // If not in stockSymbols, validate it first
    if (!stockSymbols[symbol]) {
        const validation = await validateStockSymbol(symbol);
        if (!validation.valid) {
            const errorMessage = validation.error || 'Unknown error occurred';
        if (window.showNotification) {
                window.showNotification(`Error: ${errorMessage}`, 5000);
            }
            return;
        }
        // Add to stockSymbols cache for future use
        stockSymbols[symbol] = validation.name;
    }
    
    // Add to watchlist
    addToWatchlist(symbol);
}

// Function to search and add stock from the search button
export async function searchAndAddStock() {
    const input = document.getElementById('stockSymbolInput');
    if (!input) return;
    
    const symbol = input.value.trim().toUpperCase();
    if (!symbol) {
        if (window.showNotification) {
            window.showNotification('Please enter a stock symbol first', 3000);
        }
        return;
    }
    
    // Check if already in watchlist
    if (watchlist.includes(symbol)) {
        updateFinanceData(symbol);
        fetchStockInfo(symbol);
        if (window.showNotification) {
            window.showNotification(`${symbol} is already in your watchlist`, 3000);
        }
        return;
    }
    
    // Validate the symbol by attempting to fetch data
    const validation = await validateStockSymbol(symbol);
    if (validation.valid) {
        // Add to stockSymbols cache for future use
        stockSymbols[symbol] = validation.name;
    
    // Add to watchlist
    addToWatchlist(symbol);
    
        // Show success notification with company name
    if (window.showNotification) {
            window.showNotification(`${symbol} (${validation.name}) added to watchlist!`, 3000);
        }
    } else {
        // Show specific error message
        const errorMessage = validation.error || 'Unknown error occurred';
        if (window.showNotification) {
            window.showNotification(`Error: ${errorMessage}`, 5000);
        } else {
            alert(`Error: ${errorMessage}`);
        }
    }
}

// Make functions available globally for HTML onclick handlers
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
window.clearWatchlist = clearWatchlist;
window.addCurrentSymbolToWatchlist = addCurrentSymbolToWatchlist;
window.searchAndAddStock = searchAndAddStock;
window.startStockDashboard = startStockDashboard;
window.stopStockDashboard = stopStockDashboard;
window.selectStock = selectStock;
window.resetChartZoom = resetChartZoom;
window.resetFinanceCardPositions = resetFinanceCardPositions;
window.togglePauseFinance = togglePauseFinance;
window.toggleStockDashboard = toggleStockDashboard;
window.handleMarketCloseTransition = handleMarketCloseTransition;

// Make userSelectedSymbol globally accessible
window.userSelectedSymbol = userSelectedSymbol;

// Function to reset to auto mode (allow automatic symbol switching)
export function resetToAutoMode() {
    userSelectedSymbol = false;
    window.userSelectedSymbol = false;
    logger.info('Reset to auto mode - allowing automatic symbol switching');
}

// Make resetToAutoMode globally available
window.resetToAutoMode = resetToAutoMode;

// Utility: Detect if device is mobile
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

// Listen for fullscreen changes on the chart
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', async function () {
    const chartContainer = document.querySelector('.card.chart-container');
    if (!chartContainer) return;

    if (document.fullscreenElement === chartContainer && isMobileDevice()) {
      // Try to lock orientation to landscape (if supported)
      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock('landscape');
        } catch (e) {
          if (window.showNotification) {
            window.showNotification('For best experience, rotate your device to landscape.', 4000);
          } else {
            alert('For best experience, rotate your device to landscape.');
          }
        }
      } else {
        if (window.showNotification) {
          window.showNotification('For best experience, rotate your device to landscape.', 4000);
        } else {
          alert('For best experience, rotate your device to landscape.');
        }
      }
      
      // Add resize listener for mobile fullscreen
      const handleMobileResize = () => {
        if (document.fullscreenElement === chartContainer && window.financeChart) {
          const canvas = chartContainer.querySelector('canvas');
          if (canvas) {
            // Get actual viewport dimensions
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            
            // Set canvas size to match viewport
            canvas.width = viewportWidth;
            canvas.height = viewportHeight;
            
            // Resize and update chart
            window.financeChart.resize();
            window.financeChart.update('none');
          }
        }
      };
      
      // Listen for resize events
      window.addEventListener('resize', handleMobileResize);
      window.addEventListener('orientationchange', handleMobileResize);
      
      // Store the handler for cleanup
      chartContainer._mobileResizeHandler = handleMobileResize;
      
    } else if (!document.fullscreenElement && isMobileDevice()) {
      // Optionally unlock orientation when exiting fullscreen
      if (screen.orientation && screen.orientation.unlock) {
        try {
          screen.orientation.unlock();
        } catch (e) {}
      }
      
      // Remove resize listeners
      if (chartContainer._mobileResizeHandler) {
        window.removeEventListener('resize', chartContainer._mobileResizeHandler);
        window.removeEventListener('orientationchange', chartContainer._mobileResizeHandler);
        delete chartContainer._mobileResizeHandler;
      }

      // Force chart resize and update after exiting fullscreen
      setTimeout(() => {
        if (window.financeChart) {
          const canvas = chartContainer.querySelector('canvas');
          if (canvas) {
            // Reset canvas to container dimensions
            canvas.width = chartContainer.clientWidth;
            canvas.height = chartContainer.clientHeight;
            
            // Resize and update chart
            window.financeChart.resize();
            window.financeChart.update('none');
          }
        }
      }, 100); // Small delay to ensure DOM has updated
    }
  });
}

export function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}


