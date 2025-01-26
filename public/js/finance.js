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

// Function to update UI with financial data
export function updateFinance(data) {
    const chartContainer = document.querySelector('#finance .chart-container');
    if (data.error) {
        chartContainer.innerHTML = '<p>Unable to fetch financial data.</p>';
        return;
    }

    // Debugging: Log the data to ensure it's correct
    //console.log('Finance data:', data);

    // Clear the inner HTML and destroy existing chart if it exists
    chartContainer.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
            <div class="zoom-controls">
                <button class="zoom-button" id="zoomIn">+</button>
                <button class="zoom-button" id="zoomOut">-</button>
                <button class="zoom-button" id="mobileToggle">📱</button>
            </div>
            <canvas id="financeChart"></canvas>
            <input type="range" id="chartSlider" min="0" max="100" value="0" class="chart-slider">
        </div>
    `;

    const canvas = document.getElementById('financeChart');
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight - 30; // Subtract space for slider

    const ctx = document.getElementById('financeChart').getContext('2d');

    let timeUnit;
    switch (data.timeRange) {
        case '1m':
            timeUnit = 'minute';
            break;
        case '2m':
            timeUnit = 'minute';
            break;
        case '5m':
            timeUnit = 'minute';
            break;
        case '15m':
            timeUnit = 'minute';
            break;
        case '30m':
            timeUnit = 'minute';
            break;
        case '60m':
            timeUnit = 'hour';
            break;
        case '90m':
            timeUnit = 'hour';
            break;
        case '1h':
            timeUnit = 'hour';
            break;
        case '1d':
            timeUnit = 'minute';
            break;
        case '5d':
            timeUnit = 'day';
            break;
        case '1wk':
            timeUnit = 'week';
            break;
        case '1mo':
            timeUnit = 'day';
            break;
        case '3mo':
            timeUnit = 'week';
            break;
        case '6mo':
            timeUnit = 'month';
            break;
        case '1y':
            timeUnit = 'week';
            break;
        case '2y':
            timeUnit = 'month';
            break;
        case '5y':
            timeUnit = 'year';
            break;
        case '10y':
            timeUnit = 'year';
            break;
        case 'ytd':
            timeUnit = 'day';
            break;
        default:
            timeUnit = 'minute';
    }

    // Ensure data.dates and data.prices are arrays and have the same length
    if (!Array.isArray(data.dates) || !Array.isArray(data.prices) || data.dates.length !== data.prices.length) {
        console.error('Invalid data format for chart:', data);
        chartContainer.innerHTML = '<p>Invalid data format for chart.</p>';
        return;
    }

    // Check if data is empty or has only one data point
    if (data.dates.length === 0 || data.prices.length === 0) {
        console.error('No data available for chart:', data);
        chartContainer.innerHTML = '<p>No data available for chart.</p>';
        return;
    }

    // Fill missing points with null to ensure continuity
    const filledPrices = data.prices.map((price, index) => {
        return price !== null ? price : (index > 0 ? data.prices[index - 1] : null);
    });

    console.log('Creating new chart');

    // Before creating the chart, decimate data if needed
    let chartDates = data.dates;
    let chartPrices = filledPrices;
    
    if (data.timeRange === '1wk' || data.timeRange === '1mo') {
        const decimated = decimateData(data.dates, filledPrices);
        chartDates = decimated.dates;
        chartPrices = decimated.prices;
    }

    window.financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartDates,
            datasets: [{
                label: `${data.symbol} Closing Prices`,
                data: chartPrices,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                pointRadius: 2,  // Set point size to 1px
                pointHoverRadius: 10  // Keep hover size same as regular size
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                zoom: {
                    limits: {
                        x: {min: 'original', max: 'original'},
                        y: {min: 'original', max: 'original'},
                        minScale: 0.1  // This means you can only zoom out to show 10x the initial view
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: null
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: null
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Price: $${Number(context.parsed.y).toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    display: !isMobile(),
                    ticks: {
                        callback: function(value) {
                            return '$' + Number(value).toFixed(2);
                        }
                    }
                },
                x: {
                    display: !isMobile(),
                    type: 'time',
                    time: {
                        unit: timeUnit
                    }
                }
            }
        }
    });

    // After creating the chart, add this code
    const slider = document.getElementById('chartSlider');
    slider.addEventListener('input', function(e) {
        if (!window.financeChart) return;
        
        const chart = window.financeChart;
        const data = chart.data;
        const totalPoints = data.labels.length;
        const visiblePoints = Math.floor(totalPoints * 0.1); // 10% of total points
        
        // Calculate the start index based on slider position
        const percent = e.target.value / 100;
        const maxStartIndex = totalPoints - visiblePoints;
        const startIndex = Math.floor(percent * maxStartIndex);
        
        // Set the viewport to show 10% of points starting from the calculated position
        chart.options.scales.x.min = data.labels[startIndex];
        chart.options.scales.x.max = data.labels[startIndex + visiblePoints];
        chart.update('none');
    });

    // Initialize slider position
    if (slider) {
        slider.value = 0;
    }

    // Add zoom button functionality
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');

    if (zoomIn && zoomOut) {
        zoomIn.addEventListener('click', function() {
            if (!window.financeChart) return;
            window.financeChart.zoom(1.2); // Zoom in by 20%
        });

        zoomOut.addEventListener('click', function() {
            if (!window.financeChart) return;
            window.financeChart.zoom(0.8); // Zoom out by 20%
        });
    }

    // Add after the zoom button event listeners
    const mobileToggle = document.getElementById('mobileToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            isMobileMode = !isMobileMode;
            const chartContainer = document.querySelector('.chart-container');
            const slider = document.getElementById('chartSlider');
            
            if (isMobileMode) {
                chartContainer.style.height = '200px';
                slider.style.display = 'block';
                window.financeChart.options.scales.x.display = false;
                window.financeChart.options.scales.y.display = false;
            } else {
                chartContainer.style.height = '400px';
                slider.style.display = 'none';
                window.financeChart.options.scales.x.display = true;
                window.financeChart.options.scales.y.display = true;
            }
            window.financeChart.update();
        });
    }

    // Add this near the end of the function, before the chart creation
    const pauseButton = document.querySelector('#finance .pause-button');
    if (pauseButton) {
        if (data.timeRange === '5m') {
            pauseButton.style.display = 'block';
        } else {
            pauseButton.style.display = 'none';
        }
    }
}

// Function to refresh real-time financial data
export async function refreshRealTimeFinanceData(symbol) {
    const financeData = await fetchRealTimeYahooFinanceData(symbol);
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

// Function to calculate change percentage
export function calculateChangePercentage(prices) {
    if (!prices || prices.length < 2) {
        return 0;
    }

    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const changePercentage = ((endPrice - startPrice) / startPrice) * 100;

    return changePercentage;
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
let updateInterval;
let lastKnownChange = null;
let lastKnownChangePercent = null;

// Function to start minutely updates
export function startAutoRefresh(symbol, timeRange, interval) {
    // Stop any existing interval
    stopAutoRefresh();

    // Initial update
    updateFinanceDataWithPercentage(symbol, timeRange, interval);

    // Set up interval for updates every 2-3 seconds only for minutely timeframe
    if (timeRange === '5m' && interval === '1m') {
        updateInterval = setInterval(() => {
            updateFinanceDataWithPercentage(symbol, timeRange, interval);
        }, Math.floor(Math.random() * (3000 - 2000 + 1) + 2000)); // Random interval between 2000-3000 ms
    }
}

// Function to stop minutely updates
export function stopAutoRefresh() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Event listener for stock symbol input change
document.getElementById('stockSymbolInput').addEventListener('change', (event) => {
    const symbol = event.target.value.toUpperCase();
    const [timeRange, interval] = document.getElementById('minutelyButton').getAttribute('onclick').match(/updateFinanceData\('[^']*', '([^']*)', '([^']*)'\)/i).slice(1);
    
    // Check if auto-refresh is already running
    if (updateInterval) {
        stopAutoRefresh();
    }
    
    startAutoRefresh(symbol, timeRange, interval);
});

// Add this helper function at the top of the file
function decimateData(dates, prices, maxPoints = 200) {
    if (dates.length <= maxPoints) return { dates, prices };
    
    const step = Math.ceil(dates.length / maxPoints);
    const decimatedDates = [];
    const decimatedPrices = [];
    
    for (let i = 0; i < dates.length; i += step) {
        decimatedDates.push(dates[i]);
        decimatedPrices.push(prices[i]);
    }
    
    return { dates: decimatedDates, prices: decimatedPrices };
}

// Add this function at the top of the file
function isMobile() {
    return window.innerWidth <= 768;
}

// Add at the top of the file
let isMobileMode = false;