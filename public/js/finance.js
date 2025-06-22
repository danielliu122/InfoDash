import { userPrefs } from './userPreferences.js';

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
let previousStockData = {};

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

function addData(chart, label, newData) {
    // Only add data if the timestamp is different from the last one
    if (label !== lastTimestamp) {
        // Ensure we're working with the first dataset
        const dataset = chart.data.datasets[0];
        
        // Keep only the last 200 points (adjust as needed)
        if (chart.data.labels.length > 200) {
            chart.data.labels.shift();
            dataset.data.shift();
        }
        
        // Add new data point
        chart.data.labels.push(label);
        dataset.data.push(newData);
        
        // Update the chart
        chart.update();
        
        // Update the last timestamp
        lastTimestamp = label;
    }
}

// Watchlist management functions
export function addToWatchlist(symbol) {
    if (!watchlist.includes(symbol)) {
        watchlist.push(symbol);
        userPrefs.setFinanceWatchlist(watchlist);
        updateWatchlistUI();
    }
}

export function removeFromWatchlist(symbol) {
    watchlist = watchlist.filter(s => s !== symbol);
    userPrefs.setFinanceWatchlist(watchlist);
    updateWatchlistUI();
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
    watchlist = userPrefs.getFinanceWatchlist();
    updateWatchlistUI();
}

// Enhanced autocomplete functionality
export function setupAutocomplete() {
    const input = document.getElementById('stockSymbolInput');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    if (!input || !autocompleteList) return;

    input.addEventListener('input', function() {
        const value = this.value.toUpperCase();
        autocompleteList.innerHTML = '';
        
        if (value.length < 1) {
            autocompleteList.style.display = 'none';
            return;
        }

        const matches = Object.entries(stockSymbols)
            .filter(([symbol, name]) => 
                symbol.includes(value) || name.toUpperCase().includes(value)
            )
            .slice(0, 10);

        if (matches.length > 0) {
            autocompleteList.style.display = 'block';
            matches.forEach(([symbol, name]) => {
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
                    fetchStockInfo(symbol); // Show stock info card
                });
                autocompleteList.appendChild(item);
            });
        } else {
            autocompleteList.style.display = 'none';
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

    // Clear the container - no more stock info card
    realTimeContainer.innerHTML = '';
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

    // Clear the inner HTML
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
            <div class="chart-resize-handle chart-resize-handle-sw" title="Drag to resize"></div>
            <div class="chart-resize-handle chart-resize-handle-ne" title="Drag to resize"></div>
            <div class="chart-resize-handle chart-resize-handle-nw" title="Drag to resize"></div>
        </div>
    `;

    const canvas = document.getElementById('financeChart');
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight - 30;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if it exists
    if (window.financeChart && window.financeChart instanceof Chart) {
        window.financeChart.destroy();
    }

    // Process the data
    const processedData = processChartData(data.dates, data.prices, data.symbol);
    // Add timeRange to processed data for chart configuration
    processedData.timeRange = data.timeRange;
    
    // Initialize new chart
    window.financeChart = initializeChart(ctx, processedData);

    // Add zoom button functionality
    document.getElementById('zoomIn').addEventListener('click', () => {
        window.financeChart.zoom(1.1);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        window.financeChart.zoom(0.9);
    });

    // Add this after the existing zoom button event listeners
    document.getElementById('resetZoom').addEventListener('click', () => {
        if (window.financeChart) {
            // Reset zoom plugin state
            window.financeChart.resetZoom();
            
            // Reset axis bounds
            window.financeChart.options.scales.x.min = undefined;
            window.financeChart.options.scales.x.max = undefined;
            
            // Update chart
            window.financeChart.update();
            
            // Reset slider position
            const slider = document.getElementById('chartSlider');
            if (slider) {
                slider.value = 0;
            }
        }
    });

    // Slider functionality
    const slider = document.getElementById('chartSlider');
    slider.addEventListener('input', function(e) {
        if (!window.financeChart) return;

        const chart = window.financeChart;
        const totalPoints = chart.data.labels.length;
        const visiblePoints = Math.floor(totalPoints * 0.1);

        const percent = e.target.value / 100;
        const maxStartIndex = totalPoints - visiblePoints;
        const startIndex = Math.floor(percent * maxStartIndex);

        chart.options.scales.x.min = chart.data.labels[startIndex];
        chart.options.scales.x.max = chart.data.labels[startIndex + visiblePoints];
        chart.update('none');
    });

    if (slider) {
        slider.value = 0;
    }

    // Add chart resize functionality
    setupChartResize(chartContainer);
}

// Function to setup chart resize functionality
function setupChartResize(chartContainer) {
    const resizeHandles = chartContainer.querySelectorAll('.chart-resize-handle');
    
    resizeHandles.forEach(handle => {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        
        function startResize(e) {
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = chartContainer.offsetWidth;
            startHeight = chartContainer.offsetHeight;
            
            chartContainer.classList.add('resizing');
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        }
        
        function resize(e) {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            
            // Determine resize direction based on handle class
            if (handle.classList.contains('chart-resize-handle-se')) {
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
            } else if (handle.classList.contains('chart-resize-handle-sw')) {
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
            } else if (handle.classList.contains('chart-resize-handle-ne')) {
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
            } else if (handle.classList.contains('chart-resize-handle-nw')) {
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
            }
            
            // Apply minimum size constraints
            const minWidth = 300;
            const minHeight = 200;
            newWidth = Math.max(newWidth, minWidth);
            newHeight = Math.max(newHeight, minHeight);
            
            // Apply maximum size constraints (80% of viewport)
            const maxWidth = window.innerWidth * 0.8;
            const maxHeight = window.innerHeight * 0.8;
            newWidth = Math.min(newWidth, maxWidth);
            newHeight = Math.min(newHeight, maxHeight);
            
            // Update chart container size
            chartContainer.style.width = newWidth + 'px';
            chartContainer.style.height = newHeight + 'px';
            
            // Update canvas size
            const canvas = document.getElementById('financeChart');
            if (canvas && window.financeChart) {
                canvas.width = newWidth;
                canvas.height = newHeight - 30; // Account for slider
                window.financeChart.resize();
            }
        }
        
        function stopResize() {
            isResizing = false;
            chartContainer.classList.remove('resizing');
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        }
        
        handle.addEventListener('mousedown', startResize);
    });
}

// Modify the refreshRealTimeFinanceData function
export async function refreshRealTimeFinanceData(symbol) {
    const financeData = await fetchRealTimeYahooFinanceData(symbol);
    
    if (window.financeChart && financeData.price) {
        const timestamp = financeData.timestamp.toISOString();
        addData(window.financeChart, timestamp, financeData.price);
    }
    
    // Ensure labels are updated
    updateRealTimeFinance(financeData);
}

// Function to refresh financial data
export async function refreshFinanceData(symbol, timeRange, interval) {
    try {
        const data = await fetchFinancialData(symbol, timeRange, interval);
        updateFinance(data);
    } catch (error) {
        console.error('Error refreshing financial data:', error);
    }
}

// Function to update both real-time and chart data
export async function updateFinanceData(symbol, timeRange = '1d', interval = '1m') {
    try {
        currentSymbol = symbol;
        
        // Update real-time data
        const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
        updateRealTimeFinance(realTimeData);
        
        // Update chart data
        const chartData = await fetchFinancialData(symbol, timeRange, interval);
        updateFinance(chartData);
        
        // Update watchlist UI if needed
        updateWatchlistUI();
        
    } catch (error) {
        console.error('Error updating finance data:', error);
        const realTimeContainer = document.querySelector('#finance .real-time-data-container');
        if (realTimeContainer) {
            realTimeContainer.innerHTML = '<p class="error">Error loading stock data. Please try again.</p>';
        }
    }
}

export function calculateChangePercentage(prices) {
    // Check if the array is valid and contains at least two points
    if (!Array.isArray(prices) || prices.length < 2) {
        console.warn('Insufficient data points to calculate change percentage.');
        return 0; // Default to 0% if there aren't enough points
    }

    // Filter out invalid or zero/negative prices
    const validPrices = prices.filter(price => price > 0 && price !== null && price !== undefined);

    if (validPrices.length < 2) {
        console.warn('Not enough valid prices to calculate change percentage.', validPrices);
        return 0; // Default to 0% if there are less than two valid prices
    }

    // Use the first and last valid prices to calculate percentage change
    const startPrice = validPrices[0];
    const endPrice = validPrices[validPrices.length - 1];

    // Calculate percentage change
    const changePercentage = ((endPrice - startPrice) / startPrice) * 100;

    return parseFloat(changePercentage.toFixed(2)); // Round to two decimal places for display
}




// Function to display change percentage
export function displayChangePercentage(change, changePercentage) {
    const realTimeContainer = document.querySelector('#finance .real-time-data-container');
    if (realTimeContainer) {
        const changeElement = realTimeContainer.querySelector('p:nth-child(3)');
        if (changeElement) {
            const formattedChange = change.toFixed(2);
            const formattedPercentage = changePercentage.toFixed(2);
            const color = change >= 0 ? 'green' : 'red';
            changeElement.innerHTML = `Change: <span style="color: ${color}">$${formattedChange} (${formattedPercentage}%)</span>`;
        }
    }
}

// Function to update finance data with change percentage
export async function updateFinanceDataWithPercentage(symbol, timeRange, interval) {
    try {
        const data = await fetchFinancialData(symbol, timeRange, interval);
        if (data && data.prices && data.prices.length > 1) {
            const changePercentage = calculateChangePercentage(data.prices);
            const change = data.prices[data.prices.length - 1] - data.prices[0];
            
            // Update last known values
            lastKnownChange = change;
            lastKnownChangePercent = changePercentage;
            
            displayChangePercentage(change, changePercentage);
        }
        updateFinance(data);
        
        // Update real-time data as well
        const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
        updateRealTimeFinance(realTimeData);
        
        return data;
    } catch (error) {
        console.error('Error updating finance data:', error);
        throw error;
    }
}

// Declare updateInterval at the top of the file, outside any function
let lastKnownChange = null;
let lastKnownChangePercent = null;

// Modify the startAutoRefresh function
export function startAutoRefresh(symbol, timeRange, interval) {
    stopAutoRefresh();

    const isCrypto = symbol.endsWith('-USD');

    if (interval === '1m' && (isMarketOpen() || isCrypto)) {
        // Update both chart and labels initially
        // Only run initial update if NOT crypto
        if (!isCrypto) {
            updateFinanceDataWithPercentage(symbol, timeRange, interval);
        }

        updateInterval = setInterval(async () => {
            try {
                // Fetch real-time data only
                const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
                
                if (window.financeChart && realTimeData.price) {
                    // Add real-time data point to the chart
                    const timestamp = realTimeData.timestamp.toISOString();
                    addData(window.financeChart, timestamp, realTimeData.price);
                    
                    // Update real-time display
                    updateRealTimeFinance(realTimeData);
                }

                // Fetch historical data every 60 seconds
                const now = Date.now();
                if (!lastHistoricalUpdate || now - lastHistoricalUpdate >= 60000) {
                    const historicalData = await fetchFinancialData(symbol, timeRange, interval);
                    if (window.financeChart) {
                        // Ensure we don't overwrite real-time data
                        const existingLabels = window.financeChart.data.labels;
                        const existingData = window.financeChart.data.datasets[0].data;
                        
                        // Only update if we have new historical data
                        if (historicalData.dates.length > 0 && historicalData.prices.length > 0) {
                            window.financeChart.data.labels = historicalData.dates;
                            window.financeChart.data.datasets[0].data = historicalData.prices;
                            window.financeChart.update('none');
                        }
                    }
                    lastHistoricalUpdate = now;
                }
            } catch (error) {
                console.error('Error in auto-refresh:', error);
            }
        }, 1000); // Keep 1-second interval for real-time updates
    } else if (!isCrypto) {
        console.log('Market is closed. Auto-refresh will not start.');
    }
}

// Function to stop minutely updates
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
    const [timeRange, interval] = activeButton.getAttribute('onclick')
        .match(/updateFinanceData\('([^']*)', '([^']*)'\)/i)
        .slice(1);
    
    // Check if auto-refresh is already running
    if (updateInterval) {
        stopAutoRefresh();
    }
    
    startAutoRefresh(symbol, timeRange, interval);
});


// Function to get the current theme
function getCurrentTheme() {
    return document.body.classList.contains('dark-theme') ? 'dark' : 'light';
}


export function togglePauseFinance() {
    const isPaused = !updateInterval;
    const button = document.querySelector('#finance .pause-button');
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const symbol = stockSymbolInput.value || '^IXIC';
    
    // Get the currently active time range button
    const activeButton = document.querySelector('.time-range-button.active') || document.getElementById('realtimeButton');
    const timeRange = activeButton.getAttribute('onclick').match(/updateFinanceData\('([^']*)',/)[1];
    const interval = activeButton.getAttribute('onclick').match(/, '([^']*)'\)/)[1];
    
    if (isPaused && interval === '1m') {
        // Resume updates only for minute intervals
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
    const now = Date.now();
    if (now - lastUpdateTime < 250) {
        console.log('Please wait before requesting new data');
        return;
    }
    
    lastUpdateTime = now;
    
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const symbol = stockSymbolInput.value || '^IXIC';
    const isCrypto = symbol.endsWith('-USD');
    
    // Adjust timeRange for crypto if it's '3m'
    let adjustedTimeRange = timeRange;
    if (isCrypto && timeRange === '3m') {
        adjustedTimeRange = '10m';
    }
    
    try {
        const data = await updateFinanceDataWithPercentage(symbol, adjustedTimeRange, interval);
        
        if (window.financeChart) {
            window.financeChart.data.labels = data.dates;
            window.financeChart.data.datasets[0].data = data.prices;
            window.financeChart.update();
        }
        
        // Start auto-refresh for minute intervals or crypto
        if (interval === '1m') {
            startAutoRefresh(symbol, adjustedTimeRange, interval);
        } else {
            stopAutoRefresh();
            if (!isCrypto && !isMarketOpen()) {
                console.log('Market is closed. Auto-refresh will not start.');
            }
        }
    } catch (error) {
        console.error('Error updating finance data:', error);
        const chartContainer = document.querySelector('#finance .chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<p>Unable to fetch data. Please try again.</p>';
        }
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
    console.log('Chart initialization - Theme detection:', {
        isDarkTheme: isDarkTheme,
        bodyClasses: document.body.className,
        hasDarkTheme: document.body.classList.contains('dark-theme')
    });
    
    // Set colors based on theme
    const backgroundColor = isDarkTheme ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const borderColor = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    
    console.log('Chart colors:', {
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
    setupAutocomplete();
    loadWatchlistFromPreferences();
    setupDraggableCards();
    
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

// Setup draggable cards functionality
function setupDraggableCards() {
    const cards = document.querySelectorAll('#finance .card');
    const chartContainer = document.querySelector('#finance .chart-container');
    const financeSection = document.getElementById('finance');
    
    if (!financeSection) return;
    
    // Combine cards and chart container for draggable functionality
    const draggableElements = [...cards];
    if (chartContainer) {
        draggableElements.push(chartContainer);
    }
    
    draggableElements.forEach(card => {
        let isDragging = false;
        let isResizing = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        let initialWidth;
        let initialHeight;
        
        // Add drag handle and resize button to card header (only for actual cards)
        if (card.classList.contains('card')) {
            const cardTitle = card.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.innerHTML = `
                    <span>${cardTitle.textContent}</span>
                    <div class="card-controls">
                        <span class="drag-handle">⋮⋮</span>
                        <span class="resize-handle" title="Resize">⤡</span>
                    </div>
                `;
            }
        } else if (card === chartContainer) {
            // Add drag handle to chart container
            const chartHeader = document.createElement('div');
            chartHeader.className = 'chart-header';
            chartHeader.innerHTML = `
                <span>Stock Chart</span>
                <div class="card-controls">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="resize-handle" title="Resize">⤡</span>
                </div>
            `;
            chartContainer.insertBefore(chartHeader, chartContainer.firstChild);
        }
        
        card.addEventListener('mousedown', dragStart);
        card.addEventListener('mousemove', drag);
        card.addEventListener('mouseup', dragEnd);
        card.addEventListener('mouseleave', dragEnd);
        
        function dragStart(e) {
            // Check if clicking on resize handle
            if (e.target.closest('.resize-handle')) {
                isResizing = true;
                initialWidth = card.offsetWidth;
                initialHeight = card.offsetHeight;
                initialX = e.clientX;
                initialY = e.clientY;
                card.classList.add('resizing');
                return;
            }
            
            // Only start dragging if clicking on the header or drag handle
            if (!e.target.closest('.card-header') && !e.target.closest('.chart-header') && !e.target.closest('.drag-handle')) {
                return;
            }
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            
            if (e.target === card || card.contains(e.target)) {
                isDragging = true;
                card.classList.add('dragging');
            }
        }
        
        function drag(e) {
            if (isResizing) {
                e.preventDefault();
                const deltaX = e.clientX - initialX;
                const deltaY = e.clientY - initialY;
                
                const newWidth = Math.max(300, initialWidth + deltaX); // Minimum 300px width
                const newHeight = Math.max(200, initialHeight + deltaY); // Minimum 200px height
                
                card.style.width = newWidth + 'px';
                card.style.height = newHeight + 'px';
                return;
            }
            
            if (isDragging) {
                e.preventDefault();
                
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                // Get current finance section bounds
                const currentFinanceBounds = financeSection.getBoundingClientRect();
                const cardBounds = card.getBoundingClientRect();
                
                // Calculate boundaries to keep card within finance section
                const maxX = currentFinanceBounds.width - cardBounds.width;
                const maxY = currentFinanceBounds.height - cardBounds.height;
                
                // Constrain movement to finance section boundaries
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));
                
                // Update offsets
                xOffset = currentX;
                yOffset = currentY;
                
                setTranslate(currentX, currentY, card);
            }
        }
        
        function dragEnd(e) {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                card.classList.remove('dragging');
            }
            
            if (isResizing) {
                isResizing = false;
                card.classList.remove('resizing');
            }
        }
        
        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        }
    });
}

// Clear entire watchlist
export function clearWatchlist() {
    if (confirm('Are you sure you want to clear your entire watchlist?')) {
        watchlist = [];
        userPrefs.setFinanceWatchlist(watchlist);
        updateWatchlistUI();
    }
}

// Reset chart zoom
export function resetChartZoom() {
    const chart = Chart.getChart('financeChart');
    if (chart) {
        chart.resetZoom();
    }
}

// Reset finance card positions to original grid layout
export function resetFinanceCardPositions() {
    const cards = document.querySelectorAll('#finance .card');
    const chartContainer = document.querySelector('#finance .chart-container');
    
    // Combine cards and chart container for reset
    const allElements = [...cards];
    if (chartContainer) {
        allElements.push(chartContainer);
    }
    
    allElements.forEach((card, index) => {
        // Store current position for animation
        const currentTransform = window.getComputedStyle(card).transform;
        if (currentTransform && currentTransform !== 'none') {
            const matrix = new DOMMatrix(currentTransform);
            card.style.setProperty('--current-x', `${matrix.m41}px`);
            card.style.setProperty('--current-y', `${matrix.m42}px`);
        }
        
        // Add resetting class for animation
        card.classList.add('resetting');
        
        // Remove the resetting class after animation completes
        setTimeout(() => {
            card.classList.remove('resetting');
            // Clear any inline transform styles and positioning
            card.style.transform = '';
            card.style.left = '';
            card.style.top = '';
            card.style.position = '';
            card.style.zIndex = '';
            
            // Ensure card returns to its proper grid position
            card.style.float = 'left';
            card.style.width = '100%';
            card.style.margin = '0 0 20px 0';
        }, 500);
    });
    
    // Force a reflow to ensure proper grid layout
    setTimeout(() => {
        const financeSection = document.getElementById('finance');
        if (financeSection) {
            financeSection.style.display = 'none';
            financeSection.offsetHeight; // Force reflow
            financeSection.style.display = '';
        }
    }, 600);
    
    // Show success message
    if (window.showNotification) {
        window.showNotification('Card positions reset to grid layout', 2000);
    } else {
        console.log('Card positions reset to grid layout');
    }
}

// Update chart theme when switching between light/dark modes
export function updateChartTheme() {
    const chart = Chart.getChart('financeChart');
    if (chart) {
        // Get current theme
        const isDarkTheme = document.body.classList.contains('dark-theme');
        
        console.log('Updating chart theme:', {
            isDarkTheme: isDarkTheme,
            bodyClasses: document.body.className,
            hasDarkTheme: document.body.classList.contains('dark-theme')
        });
        
        // Set colors based on theme
        const backgroundColor = isDarkTheme ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
        const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const borderColor = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        
        console.log('Updated chart colors:', {
            backgroundColor,
            textColor,
            gridColor,
            borderColor
        });
        
        // Update chart options
        chart.options.backgroundColor = backgroundColor;
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.border.color = borderColor;
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.border.color = borderColor;
        
        // Update the chart
        chart.update();
        console.log('Chart theme updated successfully');
    } else {
        console.log('No chart found to update theme');
    }
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

// Fetch top 100 stocks data
export async function fetchTopStocks() {
    try {
        // Define popular tech stocks and major indices
        const popularStocks = [
            // Major indices
            '^GSPC', '^IXIC', '^DJI',  // S&P 500, NASDAQ, Dow Jones
            // Tech giants
            'NVDA', 'AAPL', 'GOOGL', 'META', 'NFLX', 'MSFT', 'AMZN', 'TSLA',
            // Other popular stocks
            'JPM', 'V', 'WMT', 'DIS', 'JNJ', 'PG', 'UNH', 'HD',
            // Cryptocurrencies (always open)
            'BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'ADA-USD',
            'XRP-USD', 'DOT-USD', 'DOGE-USD', 'AVAX-USD', 'MATIC-USD'
        ];

        // Combine watchlist with popular stocks, removing duplicates
        let symbolsToFetch = [];
        const allSymbols = new Set();
        
        // Add watchlist items first (priority)
        if (watchlist && watchlist.length > 0) {
            watchlist.forEach(symbol => {
                if (!allSymbols.has(symbol)) {
                    symbolsToFetch.push(symbol);
                    allSymbols.add(symbol);
                }
            });
        }
        
        // Add popular stocks (avoiding duplicates)
        popularStocks.forEach(symbol => {
            if (!allSymbols.has(symbol)) {
                symbolsToFetch.push(symbol);
                allSymbols.add(symbol);
            }
        });

        // Limit to a reasonable number (e.g., 20-25 stocks) to avoid API overload
        symbolsToFetch = symbolsToFetch.slice(0, 25);

        console.log(`Fetching data for ${symbolsToFetch.length} stocks and cryptocurrencies...`);
        console.log('Symbols to fetch:', symbolsToFetch);

        const promises = symbolsToFetch.map(async (symbol) => {
            try {
                console.log(`Fetching ${symbol}...`);
                const isCrypto = symbol.endsWith('-USD');
                
                if (isCrypto) {
                    // For crypto, fetch both real-time and historical data to get proper change values
                    const [currentData, historicalData] = await Promise.all([
                        fetchRealTimeYahooFinanceData(symbol),
                        fetchStockHistoricalData(symbol)
                    ]);
                    
                    if (currentData.error) {
                        console.warn(`Failed to fetch current data for ${symbol}: ${currentData.error}`);
                        return null;
                    }
                    
                    // Use historical data for change values if available, otherwise fall back to real-time data
                    const combinedData = {
                        ...currentData,
                        change: historicalData ? historicalData.change : (currentData.change || 0),
                        changePercent: historicalData ? historicalData.changePercent : (currentData.changePercent || 0)
                    };
                    
                    console.log(`Successfully fetched crypto ${symbol}: $${currentData.price} (Change: ${combinedData.changePercent.toFixed(2)}%)`);
                    return combinedData;
                } else {
                    const historicalData = await fetchStockHistoricalData(symbol);
                    if (!historicalData) {
                        console.warn(`Failed to fetch historical data for ${symbol}`);
                        return null;
                    }
                    const currentData = await fetchRealTimeYahooFinanceData(symbol);
                    if (currentData.error) {
                        console.warn(`Failed to fetch current price for ${symbol}: ${currentData.error}`);
                        return null;
                    }
                    const combinedData = {
                        ...currentData,
                        openToCloseChange: historicalData.change,
                        openToCloseChangePercent: historicalData.changePercent,
                        openPrice: historicalData.openPrice,
                        closePrice: historicalData.closePrice
                    };
                    console.log(`Successfully fetched stock ${symbol}: $${currentData.price} (Open-to-Close: ${historicalData.changePercent.toFixed(2)}%)`);
                    return combinedData;
                }
            } catch (error) {
                console.error(`Error fetching ${symbol}:`, error);
                return null;
            }
        });

        const results = await Promise.all(promises);
        topStocks = results.filter(stock => stock && !stock.error);
        console.log(`Successfully loaded ${topStocks.length} stocks/cryptocurrencies out of ${symbolsToFetch.length}`);
        updateStockDashboard();
    } catch (error) {
        console.error('Error fetching top stocks:', error);
    }
}

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

// Update stock dashboard with animations
function updateStockDashboard() {
    const dashboardContainer = document.getElementById('stock-dashboard');
    if (!dashboardContainer) {
        console.error('Dashboard container not found');
        return;
    }

    if (!topStocks || topStocks.length === 0) {
        console.warn('No stocks loaded, showing error message');
        dashboardContainer.innerHTML = `
            <div class="stock-dashboard-error">
                <p>Unable to load stock data. Please check your connection and try again.</p>
                <button class="btn-small waves-effect waves-light" onclick="startStockDashboard()">Retry</button>
            </div>
        `;
        return;
    }

    console.log(`Updating dashboard with ${topStocks.length} stocks`);

    const marketStatus = isMarketOpen() ? 'OPEN' : 'CLOSED';
    const marketColor = isMarketOpen() ? '#4caf50' : '#f44336';

    const stocksPerRow = 4;
    let html = `
        <div class="market-status-indicator" style="text-align: center; margin-bottom: 15px; padding: 8px; background: ${marketColor}; color: white; border-radius: 6px; font-weight: bold;">
            Market: ${marketStatus}
        </div>
        <div class="stock-dashboard-grid">
    `;

    topStocks.forEach((stock, index) => {
        if (!stock || stock.error) {
            console.warn(`Skipping invalid stock at index ${index}:`, stock);
            return;
        }

        const previousData = previousStockData[stock.symbol];
        const isCrypto = stock.symbol.endsWith('-USD');
        
        // Determine which percentage to show
        let priceChange, priceChangePercent, changeLabel;
        
        if (isCrypto) {
            // For crypto, use regular change percentage
            priceChange = stock.change || 0;
            priceChangePercent = stock.changePercent || 0;
            changeLabel = '1h';
        } else {
            // For stocks, use open-to-close percentage
            priceChange = stock.openToCloseChange || 0;
            priceChangePercent = stock.openToCloseChangePercent || 0;
            changeLabel = 'Daily';
        }
        
        // Determine animation class based on price change
        let animationClass = '';
        if (previousData && isMarketOpen()) {
            const prevPrice = previousData.price || 0;
            const currentPrice = stock.price || 0;
            if (currentPrice > prevPrice) {
                animationClass = 'price-up';
            } else if (currentPrice < prevPrice) {
                animationClass = 'price-down';
            }
        }

        const changeColor = priceChange >= 0 ? 'green' : 'red';
        const changeIcon = priceChange >= 0 ? '↗' : '↘';
        
        // Format price with commas and dynamic font size
        const priceFormat = formatPriceWithCommas(stock.price);
        const change = formatChangeValue(priceChange);
        const changePercent = formatChangeValue(priceChangePercent);

        // Define actual colors for inline styles
        const percentageColor = priceChange >= 0 ? '#4caf50' : '#f44336';
        const darkThemePercentageColor = priceChange >= 0 ? '#66bb6a' : '#ef5350';

        html += `
            <div class="stock-card ${animationClass}" onclick="selectStock('${stock.symbol}')">
                <div class="stock-header">
                    <span class="stock-symbol">${stock.symbol}</span>
                    <span class="stock-name">${stockSymbols[stock.symbol] || stock.symbol}</span>
                </div>
                <div class="stock-price" style="color: ${changeColor}; font-size: ${priceFormat.fontSize};">$${priceFormat.formatted}</div>
                <div class="stock-change">
                    ${changeIcon} <span class="percentage" style="color: ${percentageColor}; font-weight: bold; text-shadow: 0 0 1px ${percentageColor}40;">${changePercent}%</span>
                    <div class="change-label">${changeLabel}</div>
                </div>
            </div>
        `;

        // Add row break every 4 stocks
        if ((index + 1) % stocksPerRow === 0) {
            html += '</div><div class="stock-dashboard-grid">';
        }
    });

    html += '</div>';
    dashboardContainer.innerHTML = html;

    // Store current data for next comparison
    topStocks.forEach(stock => {
        if (stock && !stock.error) {
            previousStockData[stock.symbol] = { ...stock };
        }
    });

    console.log('Dashboard updated successfully');
}

// Select stock for detailed view
export function selectStock(symbol) {
    document.getElementById('stockSymbolInput').value = symbol;
    updateFinanceData(symbol);
    
    // Scroll to chart
    const chartSection = document.querySelector('.chart-container');
    if (chartSection) {
        chartSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Start stock dashboard auto-refresh
export function startStockDashboard() {
    if (stockDashboardInterval) {
        clearInterval(stockDashboardInterval);
    }
    
    // Initial fetch
    fetchTopStocks();
    
    // Set up auto-refresh every 3 seconds only if market is open
    stockDashboardInterval = setInterval(() => {
        if (isMarketOpen()) {
            fetchTopStocks();
        } else {
            console.log('Market is closed, skipping stock dashboard update');
        }
    }, 3000);
}

// Stop stock dashboard auto-refresh
export function stopStockDashboard() {
    if (stockDashboardInterval) {
        clearInterval(stockDashboardInterval);
        stockDashboardInterval = null;
    }
}






