import { userPrefs } from './userPreferences.js';
import logger from './logger.js';

// Watchlist state
let watchlist = JSON.parse(localStorage.getItem('financeWatchlist') || '[]');
let stockSymbols = {};
let topStocks = [];
let stockDashboardInterval = null;
let previousStockData = {};
let isDashboardPaused = false;

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

// Check if market is open (needed for dashboard)
function isMarketOpen() {
    const symbol = document.getElementById('stockSymbolInput')?.value?.toUpperCase() || '^IXIC';
    
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

// Fetch real-time data for a single stock
async function fetchRealTimeYahooFinanceData(symbol) {
    try {
        const response = await fetch(`/api/finance/${symbol}?range=5m&interval=1m`, {
            redirect: 'follow'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Stock symbol ${symbol} not found (404)`);
                return { error: `Stock ${symbol} not found` };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            console.warn(`Invalid data structure for ${symbol}`);
            return { error: `Invalid data for ${symbol}` };
        }
        
        const result = data.chart.result[0];
        const meta = result.meta;
        
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
}

// Update stock dashboard display
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

// Add to watchlist function
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
                        newCard.onclick = () => window.selectStock(symbol);
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
                if (window.updateFinanceData) {
                    window.updateFinanceData(symbol, undefined, undefined, false);
                }
                
                if (window.fetchStockInfo) {
                    window.fetchStockInfo(symbol);
                }
                
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

// Remove from watchlist function
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

// Update watchlist UI
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
                if (window.updateFinanceData) {
                    window.updateFinanceData(symbol);
                }
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

// Fetch top stocks for dashboard
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
        if (window.handleMarketCloseTransition) {
            window.handleMarketCloseTransition();
        }
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

// Getters for external access
export function getWatchlist() {
    return [...watchlist];
}

export function getStockSymbols() {
    return stockSymbols;
}

export function getTopStocks() {
    return [...topStocks];
}

// Make functions available globally for HTML onclick handlers
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
window.clearWatchlist = clearWatchlist;
window.resetToDefaultWatchlist = resetToDefaultWatchlist;
window.toggleStockDashboard = toggleStockDashboard;
window.startStockDashboard = startStockDashboard;
window.stopStockDashboard = stopStockDashboard;
window.fetchTopStocks = fetchTopStocks;
window.loadWatchlistFromPreferences = loadWatchlistFromPreferences;
window.updateWatchlistUI = updateWatchlistUI;