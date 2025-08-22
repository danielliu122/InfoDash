import { userPrefs } from './userPreferences.js';
import logger from './logger.js';
import { 
    addToWatchlist, 
    removeFromWatchlist, 
    loadWatchlistFromPreferences,
    startStockDashboard,
    setupAutocomplete,
} from './financeWatchlist.js';


// initialization variables and states
let updateInterval;
let lastUpdateTime = 0;
let lastHistoricalUpdate = 0;
let lastTimestamp = null;
let isDashboardPaused = false;
let userSelectedSymbol = false
let MAX_POINTS = 50;
let stockSymbols = loadStockSymbols();

const DEFAULT_TIME_RANGE = '2h';
const DEFAULT_INTERVAL = '1m';

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
let currentSymbol = getDefaultSymbol();

// Load stock symbols for autocomplete
async function loadStockSymbols() {
    try {
        const response = await fetch('/data/stockSymbols.json');
        stockSymbols = await response.json();
    } catch (error) {
        console.error('Error loading stock symbols:', error);
    }
}

function addData(chart, label, newData) {
    if (chart && chart.update) {
        chart.update('none');
    }
}

// Enhanced real-time data display
function updateRealTimeFinance(data) {
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

function isMarketOpen() {
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

// Modify the processChartData function to accept symbol as a parameter
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

// Function to fetch financial data
const fetchFinancialData = async (symbol = '^IXIC', timeRange = '5m', interval = '1m') => {
    try {
        // Use original endpoint for chart data
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
const fetchRealTimeYahooFinanceData = async (symbol = '^IXIC') => {
    try {
        // Use original endpoint for chart data
        const response = await fetch(`/api/finance/${symbol}?range=5m&interval=1m`)
        
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

// Function to update Chart with financial data
function updateChart(data) {
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

async function updateFinanceData(symbol, timeRange = DEFAULT_TIME_RANGE, interval = DEFAULT_INTERVAL, isRefresh = false) {
    try {
        currentSymbol = symbol;
        
        // Existing code...
        const realTimeData = await fetchRealTimeYahooFinanceData(symbol);
        updateRealTimeFinance(realTimeData);

        if (isRefresh && window.financeChart) {
            if (realTimeData && realTimeData.price && realTimeData.timestamp) {
                addData(window.financeChart, realTimeData.timestamp.toISOString(), realTimeData.price);
            }
        } else {
            const historicalData = await fetchFinancialData(symbol, timeRange, interval);
            updateChart(historicalData);
        }
        
        // Always update stock parameters when finance data is updated
        updateStockParameters(symbol);
        
        updateWatchlistUI();
    } catch (error) {
        logger.error('Error updating finance data:', error);
        // Error handling...
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

// Update your selectStock function:
function selectStock(symbol) {
    userSelectedSymbol = true;
    document.getElementById('stockSymbolInput').value = symbol;
    handleFinanceUpdate(DEFAULT_TIME_RANGE, DEFAULT_INTERVAL);
    
    // Add this line to update parameters
    updateStockParameters(symbol);
}
// Update startAutoRefresh to respect pause and user selection
function startAutoRefresh() {
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
function handleMarketCloseTransition() {
    const currentSymbol = document.getElementById('stockSymbolInput')?.value.toUpperCase();
    // If we're currently showing a stock (not crypto) and market just closed, and user hasn't manually selected a symbol
    if (currentSymbol && !currentSymbol.endsWith('-USD') && !isMarketOpen() && !userSelectedSymbol) {
        // Switch to BTC-USD only if user hasn't selected a symbol
        const newSymbol = 'BTC-USD';
        document.getElementById('stockSymbolInput').value = newSymbol;
        userSelectedSymbol = false; // App is now in auto mode
        userSelectedSymbol = false; // Update global variable
        updateFinanceData(newSymbol, DEFAULT_TIME_RANGE, DEFAULT_INTERVAL, false);
        if (updateInterval) {
            stopAutoRefresh();
            startAutoRefresh();
        }
        logger.info(`Market closed, switched from ${currentSymbol} to ${newSymbol}`);
    }
}

// In handleFinanceUpdate, only start auto-refresh if not paused
async function handleFinanceUpdate(timeRange, interval) {
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

function togglePauseFinance() {
    let button = document.getElementById('pause-finance-button');
    if (!button) return;
    const isPaused = button.classList.toggle('paused');
    if (isPaused) {
        button.innerHTML = '⏵'; // Play icon
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
                },
                legend: {
                    labels: {
                        color: textColor
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
                        display: true,
                        color: gridColor
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
                        display: true,
                        color: gridColor
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
function initializeFinance() {
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

// Reset chart zoom
function resetChartZoom() {
    const chart = Chart.getChart('financeChart');
    if (chart) {
        chart.resetZoom();
    }
}

// Reset finance card positions to grid layout
function resetFinanceCardPositions() {
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

// Utility: Detect if device is mobile
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

// Listen for fullscreen changes on the chart
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', async function () {
    const chartContainer = document.querySelector('.chart-container');
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

function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

if (document.getElementById('stock-dashboard') || document.getElementById('stockChart')) {
    initializeFinance();
    startStockDashboard();
}

// Initialize finance functionality on page load
try {
    // Only start finance functionality if finance chart elements exist on this page
    const stockChart = document.getElementById('stockChart');
    const stockDashboard = document.getElementById('stock-dashboard');
    
    if (stockChart || stockDashboard) {
        console.log('Finance elements found, initializing finance functionality');
        // Start auto-refresh with default values (minutely) only if the market is open
        if (isMarketOpen()) {
            startAutoRefresh();
        } else {
            console.log('Market is closed. Auto-refresh will not start.');
            // Update the chart once even if the market is closed
            handleFinanceUpdate(DEFAULT_TIME_RANGE, DEFAULT_INTERVAL);
        }
    } else {
        console.log('No finance chart elements found on this page, skipping finance initialization');
    }
} catch (error) {
    console.error('Error during initial data fetch:', error);
}

// Function to update stock parameters section with historical data
async function updateStockParameters(symbol, dateIndex = -1) {
    const parametersSection = document.getElementById('stock-parameters-section');
    if (!parametersSection) {
        console.log('Stock parameters section not found on this page');
        return;
    }

    try {
        // Show loading state
        const elements = {
            date: document.getElementById('param-date'),
            open: document.getElementById('param-open'),
            high: document.getElementById('param-high'),
            low: document.getElementById('param-low'),
            close: document.getElementById('param-close'),
            volume: document.getElementById('param-volume'),
            lastUpdated: document.getElementById('param-last-updated')
        };

        // Fetch historical data using the corrected function
        const historyData = await fetchFinanceHistoryArray(symbol);
        
        if (!historyData || historyData.length === 0) {
            // No data available
            Object.values(elements).forEach(element => {
                if (element) element.textContent = 'N/A';
            });
            
            // Update card title to show error
            const cardTitle = parametersSection.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.textContent = `Stock Data - No data available for ${symbol}`;
            }
            return;
        }

        // Use the specified index, or default to the last available data point
        const dataIndex = dateIndex >= 0 && dateIndex < historyData.length ? dateIndex : historyData.length - 1;
        const stockData = historyData[dataIndex];

        if (!stockData) {
            throw new Error('No stock data available for the selected date');
        }

        // Helper function to format numbers with commas
        const formatNumber = (num) => {
            if (num === null || num === undefined || isNaN(num)) return 'N/A';
            return Number(num).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        // Helper function to format volume (in millions/billions)
        const formatVolume = (volume) => {
            if (volume === null || volume === undefined || isNaN(volume)) return 'N/A';
            const num = Number(volume);
            if (num >= 1000000000) {
                return (num / 1000000000).toFixed(1) + 'B';
            } else if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            } else {
                return num.toLocaleString('en-US');
            }
        };

        // Helper function to format date
        const formatDate = (dateStr) => {
            try {
                // Handle both Date objects and string formats
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return dateStr; // Return original if invalid date
                }
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (error) {
                console.error('Error formatting date:', error);
                return dateStr; // Return original if formatting fails
            }
        };

        // Helper function to format last updated time
        const formatLastUpdated = () => {
            const now = new Date();
            return now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        };

        // Update the HTML elements
        if (elements.date) elements.date.textContent = formatDate(stockData.date);
        if (elements.open) elements.open.textContent = `$${formatNumber(stockData.open)}`;
        if (elements.high) elements.high.textContent = `$${formatNumber(stockData.high)}`;
        if (elements.low) elements.low.textContent = `$${formatNumber(stockData.low)}`;
        if (elements.close) elements.close.textContent = `$${formatNumber(stockData.close)}`;
        if (elements.volume) elements.volume.textContent = formatVolume(stockData.volume);
        if (elements.lastUpdated) elements.lastUpdated.textContent = formatLastUpdated();

        // Update card title to show current symbol and date
        const cardTitle = parametersSection.querySelector('.card-title');
        if (cardTitle) {
            cardTitle.textContent = `Stock Data - ${symbol} (${formatDate(stockData.date)})`;
        }

        // Add visual indicators for price movement
        if (stockData.close !== null && stockData.open !== null) {
            const priceChange = stockData.close - stockData.open;
            const changePercent = ((priceChange / stockData.open) * 100);
            
            // Color the close price based on daily performance
            if (elements.close) {
                if (priceChange > 0) {
                    elements.close.style.color = '#4caf50'; // Green for positive
                    elements.close.title = `+$${formatNumber(Math.abs(priceChange))} (+${changePercent.toFixed(2)}%)`;
                } else if (priceChange < 0) {
                    elements.close.style.color = '#f44336'; // Red for negative
                    elements.close.title = `-$${formatNumber(Math.abs(priceChange))} (${changePercent.toFixed(2)}%)`;
                } else {
                    elements.close.style.color = '#757575'; // Gray for unchanged
                    elements.close.title = 'No change';
                }
            }
        }

        //console.log(`Stock parameters updated for ${symbol}:`, stockData);

    } catch (error) {
        console.error('Error updating stock parameters:', error);
        
        // Show error state
        const elements = {
            date: document.getElementById('param-date'),
            open: document.getElementById('param-open'),
            high: document.getElementById('param-high'),
            low: document.getElementById('param-low'),
            close: document.getElementById('param-close'),
            volume: document.getElementById('param-volume'),
            lastUpdated: document.getElementById('param-last-updated')
        };

        Object.values(elements).forEach(element => {
            if (element) element.textContent = 'Error';
        });

        // Update card title to show error
        const cardTitle = parametersSection.querySelector('.card-title');
        if (cardTitle) {
            cardTitle.textContent = `Stock Data - Error loading ${symbol}`;
        }
    }
}


// Function to update parameters when symbol changes
function onSymbolChange(newSymbol) {
    if (newSymbol && newSymbol.trim()) {
        updateStockParameters(newSymbol.toUpperCase());
    }
}

// Enhanced fetchFinanceHistoryArray function (updated version)
async function fetchFinanceHistoryArray(symbol = 'AAPL') {
    try {
        // Use the correct endpoint that matches your server route
        const response = await fetch(`/api/finance/history/${encodeURIComponent(symbol)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        // Handle the response structure from your server
        if (result && result.success && Array.isArray(result.data)) {
            return result.data;
        } else {
            console.error('Unexpected response structure:', result);
            return [];
        }
    } catch (error) {
        console.error('Error fetching finance history array:', error);
        return [];
    }
}

// Set up event listeners for stock symbol buttons
document.querySelectorAll('[data-stock-symbol]').forEach(button => {
    button.addEventListener('click', (e) => {
        const symbol = e.currentTarget.dataset.stockSymbol;
        const stockSymbolInput = document.getElementById('stockSymbolInput');
        if (stockSymbolInput) {
            stockSymbolInput.value = symbol;
            handleFinanceUpdate('1d', '1m');
        }
    });
});

// Close the autocomplete list when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.matches('#stockSymbolInput')) {
        const autocompleteList = document.getElementById('autocomplete-list');
        if (autocompleteList) {
            autocompleteList.innerHTML = '';
        }
    }
});

// Handle fullscreen changes for pac-container elements
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

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    loadStockSymbols();
    // Set initial active state for time range buttons
    const realtimeButton = document.getElementById('realtimeButton');
    if (realtimeButton) {
        realtimeButton.classList.add('active');
    }
    // Theme toggle functionality
    const themeToggleButton = document.getElementById('themeToggle');
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', () => {
            toggleTheme();
            // Update chart theme after theme toggle
            setTimeout(() => {
                updateChartTheme();
            }, 100);
        });
    }
    const stockSymbolInput = document.getElementById('stockSymbolInput');
    if (stockSymbolInput) {
        // Update parameters when user changes symbol
        stockSymbolInput.addEventListener('change', (event) => {
            const symbol = event.target.value.trim().toUpperCase();
            if (symbol) {
                updateStockParameters(symbol);
            }
        });

        // Also update when user presses Enter
        stockSymbolInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const symbol = event.target.value.trim().toUpperCase();
                if (symbol) {
                    updateStockParameters(symbol);
                }
            }
        });
    }
});

// Export to app.js for light/dark mode theme user prefs
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
        grid: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        background: isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        border: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
    };

    logger.logChart('colors', colors);

    // Update chart options
    chart.options.scales.x.grid.color = colors.grid;
    chart.options.scales.y.grid.color = colors.grid;
    chart.options.scales.x.ticks.color = colors.text;
    chart.options.scales.y.ticks.color = colors.text;
    chart.options.plugins.legend.labels.color = colors.text;
    chart.options.backgroundColor = colors.background;
    chart.options.scales.x.border.color = colors.border;
    chart.options.scales.y.border.color = colors.border;

    // Update chart
    chart.update('none');

    logger.success('Chart theme updated successfully');
}


// Make functions available globally for HTML onclick handlers
window.addToWatchlist = addToWatchlist;
window.removeFromWatchlist = removeFromWatchlist;
window.clearWatchlist = clearWatchlist;
window.searchAndAddStock = searchAndAddStock;
window.startStockDashboard = startStockDashboard;
window.stopStockDashboard = stopStockDashboard;
window.selectStock = selectStock;
window.resetChartZoom = resetChartZoom;
window.resetFinanceCardPositions = resetFinanceCardPositions;
window.togglePauseFinance = togglePauseFinance;
window.toggleStockDashboard = toggleStockDashboard;
window.handleMarketCloseTransition = handleMarketCloseTransition;
window.userSelectedSymbol = userSelectedSymbol;
window.resetToDefaultWatchlist = resetToDefaultWatchlist;
window.updateChartTheme = updateChartTheme;
window.fetchTopStocks = fetchTopStocks;
window.updateFinanceData = updateFinanceData;
window.handleFinanceUpdate = handleFinanceUpdate;
window.setupAutocomplete = setupAutocomplete;
window.loadWatchlistFromPreferences = loadWatchlistFromPreferences;
window.updateWatchlistUI = updateWatchlistUI;
window.isMarketOpen = isMarketOpen;
window.updateRealTimeFinance = updateRealTimeFinance;
window.fetchFinancialData = fetchFinancialData;
window.fetchRealTimeYahooFinanceData = fetchRealTimeYahooFinanceData;
window.updateChart = updateChart;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.initializeFinance = initializeFinance;
window.updateStockParameters = updateStockParameters;
window.onSymbolChange = onSymbolChange;

//unused

// Enhanced stock information display
// async function fetchStockInfo(symbol) {
//     try {
//         const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
//         if (!response.ok) throw new Error('Failed to fetch stock info');
        
//         const data = await response.json();
//         const result = data.chart.result[0];
//         const meta = result.meta;
        
//         return {
//             symbol: meta.symbol,
//             name: meta.shortName || stockSymbols[symbol] || symbol,
//             price: meta.regularMarketPrice,
//             change: meta.regularMarketChange,
//             changePercent: meta.regularMarketChangePercent,
//             marketCap: meta.marketCap,
//             volume: meta.volume,
//             avgVolume: meta.averageVolume,
//             high: meta.regularMarketDayHigh,
//             low: meta.regularMarketDayLow,
//             open: meta.regularMarketOpen,
//             previousClose: meta.previousClose,
//             marketState: meta.marketState
//         };
//     } catch (error) {
//         console.error('Error fetching stock info:', error);
//         return null;
//     }
// }

// Fetch historical data for stocks to calculate open-to-close percentage
// async function fetchStockHistoricalData(symbol) {
//     try {
//         // Fetch 1 day of data with 1-minute intervals to get open and close prices
//         const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
//         if (!response.ok) throw new Error('Failed to fetch historical data');
        
//         const data = await response.json();
//         const result = data.chart.result[0];
        
//         if (!result || !result.timestamp || !result.indicators.quote[0].open || !result.indicators.quote[0].close) {
//             return null;
//         }
        
//         const timestamps = result.timestamp;
//         const opens = result.indicators.quote[0].open;
//         const closes = result.indicators.quote[0].close;
        
//         // Find the first valid open price (market open)
//         let marketOpen = null;
//         for (let i = 0; i < opens.length; i++) {
//             if (opens[i] !== null && opens[i] !== undefined) {
//                 marketOpen = opens[i];
//                 break;
//             }
//         }
        
//         // Find the last valid close price (market close)
//         let marketClose = null;
//         for (let i = closes.length - 1; i >= 0; i--) {
//             if (closes[i] !== null && closes[i] !== undefined) {
//                 marketClose = closes[i];
//                 break;
//             }
//         }
        
//         if (marketOpen && marketClose) {
//             const change = marketClose - marketOpen;
//             const changePercent = (change / marketOpen) * 100;
            
//             return {
//                 symbol: symbol,
//                 openPrice: marketOpen,
//                 closePrice: marketClose,
//                 change: change,
//                 changePercent: changePercent
//             };
//         }
        
//         return null;
//     } catch (error) {
//         console.error(`Error fetching historical data for ${symbol}:`, error);
//         return null;
//     }
// }