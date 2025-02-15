// At the top of the file
export let updateInterval;
let lastUpdateTime = 0;
let lastHistoricalUpdate = 0;
let lastTimestamp = null;

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
    
    // Track the last valid price
    let lastValidPrice = null;

    // Check if it's a crypto symbol and set max points
    const isCrypto = symbol.endsWith('-USD');
    const maxPoints = 200;

    // Iterate through the data
    for (let i = 0; i < prices.length; i++) {
        // If current price is valid
        if (prices[i] !== null && prices[i] !== undefined) {
            // If there was a gap, add the last valid price to maintain continuity
            if (lastValidPrice !== null && validPrices.length > 0 && 
                dates[i] - validDates[validDates.length - 1] > 60 * 1000) {
                validDates.push(new Date(validDates[validDates.length - 1].getTime() + 60 * 1000));
                validPrices.push(lastValidPrice);
            }
            
            // Add the current valid data point
            validDates.push(new Date(dates[i]));
            validPrices.push(prices[i]);
            lastValidPrice = prices[i];
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const result = data.chart.result[0];
        const meta = result.meta;
        const price = meta.regularMarketPrice;
        const change = meta.regularMarketChange;
        const changePercent = meta.regularMarketChangePercent;
        const timestamp = new Date(meta.regularMarketTime * 1000);

        return { symbol, price, change, changePercent, timestamp };
    } catch (error) {
        console.error('Error fetching real-time Yahoo Finance data:', error);
        return { error: 'Unable to fetch real-time financial data' };
    }
};

// Function to update UI with real-time financial data
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
    //console.log("finance data" + data);

    // Use last known values or 'N/A' if not available
    const price = data.price !== undefined ? data.price.toFixed(2) : 'N/A';
    const timestamp = data.timestamp ? data.timestamp.toLocaleTimeString() : 'N/A';
    const change = lastKnownChange !== null ? lastKnownChange.toFixed(2) : 'N/A';
    const changePercent = lastKnownChangePercent !== null ? lastKnownChangePercent.toFixed(2) : 'N/A';

    const changeColor = lastKnownChange >= 0 ? 'green' : 'red';

    realTimeContainer.innerHTML = `
        <h3>Stock Data (${data.symbol})</h3>
        <p>Price: $${price}</p>
        <p>Change: <span style="color: ${changeColor}">$${change} (${changePercent}%)</span></p>
        <p>Last Updated: ${timestamp}</p>
    `;
}
function initializeChart(ctx, data) {
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
                spanGaps: true, // This allows the line to span gaps
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
                        if (ctx.chart.getZoomLevel() < .9) {
                            ctx.chart.resetZoom();
                        }
                    }
                  }
                }
            },
            animation: true,
            responsive: true,
            maintainAspectRatio: true,
            
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return '$' + Number(value).toFixed(2);
                        },
                        color: getCurrentTheme() === 'dark' ? '#FFFFFF' : '#000000'
                    },
                    offset: true,
                    beginAtZero: false
                },
                x: {
                    type: 'time',
                    ticks: {
                        color: getCurrentTheme() === 'dark' ? '#FFFFFF' : '#000000'
                    },
                    offset: true,
                    bounds: 'data'
                }
            }
            
        }
    });
}
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
                <button class="fullscreenButton" id="fullscreenButton">FSM</button>
            </div>
            <canvas id="financeChart"></canvas>
            <input type="range" id="chartSlider" min="0" max="100" value="0" class="chart-slider">
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
// Replace line 278
const processedData = processChartData(data.dates, data.prices, data.symbol);    // Initialize new chart
    window.financeChart = initializeChart(ctx, processedData);

    // Add zoom button functionality
    document.getElementById('zoomIn').addEventListener('click', () => {
        window.financeChart.zoom(1.1);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        window.financeChart.zoom(0.9);
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
    await refreshRealTimeFinanceData(symbol);
    await refreshFinanceData(symbol, timeRange, interval);
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
        updateFinanceDataWithPercentage(symbol, timeRange, interval);

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

        const financeChart = chartContainer.querySelector('#financeChart');
        if (!financeChart) return;

        const isMobile = window.innerWidth <= 768;

        if (!document.fullscreenElement) {
            chartContainer.requestFullscreen().then(() => {
                if (isMobile && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(err => {
                        console.warn('Orientation lock failed:', err);
                    });
                }
                }).catch(err => {
                    console.error('Fullscreen request failed:', err);
                });
        } else {
            document.exitFullscreen().then(() => {
                if (isMobile && screen.orientation.unlock) {
                    screen.orientation.unlock().catch(err => {
                        console.warn('Orientation unlock failed:', err);
                    });
                }
                // Reset canvas size after exiting fullscreen
                financeChart.width = 818;
                financeChart.height = 260;
            });
        }
    }
    // Use event delegation to handle dynamically added buttons
    document.body.addEventListener('click', handleFullscreen);
});






