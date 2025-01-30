// At the top of the file
export let updateInterval;

// Add this helper function to ensure data points are properly connected
function processChartData(dates, prices) {
    // Filter out any null/undefined prices and their corresponding dates
    const validData = dates.reduce((acc, date, index) => {
        if (prices[index] !== null && prices[index] !== undefined) {
            acc.dates.push(date);
            acc.prices.push(prices[index]);
        }
        return acc;
    }, { dates: [], prices: [] });

    return validData;
}

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

    // Clear the inner HTML and destroy existing chart if it exists
    chartContainer.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
            <div class="zoom-controls">
                <button class="zoom-button" id="zoomIn">+</button>
                <button class="zoom-button" id="zoomOut">-</button>
                <button class="fullscreenButton" id="fullscreenButton">FullScreen Mode</button>
            </div>
            <canvas id="financeChart"></canvas>
            <input type="range" id="chartSlider" min="0" max="100" value="0" class="chart-slider">
        </div>
    `;

    const canvas = document.getElementById('financeChart');
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight - 30; // Subtract space for slider

    const ctx = canvas.getContext('2d');

    // Destroy the existing chart if it exists
    if (window.financeChart && window.financeChart instanceof Chart) {
        window.financeChart.destroy();
    }

    // Ensure data.dates and data.prices are arrays and have the same length
    if (!Array.isArray(data.dates) || !Array.isArray(data.prices) || data.dates.length !== data.prices.length) {
        console.error('Invalid data format for chart:', data);
        return;
    }

    // Check if data is empty or has only one data point
    if (data.dates.length === 0 || data.prices.length === 0) {
        console.error('No data available for chart:', data);
        chartContainer.innerHTML = '<p>No data available for chart.</p>';
        return;
    }

    // Process the data before creating the chart
    const processedData = processChartData(data.dates, data.prices);
    // Create the new chart
    window.financeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: processedData.dates,
            datasets: [{
                label: `${data.symbol} Closing Prices`,
                data: processedData.prices,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 10
            }]
        },
        options: {
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
                    // time: {
                    //     unit: 'minute'
                    // },
                    ticks: {
                        color: getCurrentTheme() === 'dark' ? '#FFFFFF' : '#000000'
                    },
                    offset: true,
                    bounds: 'data'
                }
            },
            plugins: {
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: null,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        onZoom: function(ctx) {
                            // If trying to zoom out, reset to previous state
                            if (ctx.chart.getZoomLevel() < .5) {
                                ctx.chart.resetZoom();
                            }
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    }
                }
            }
        }
    });
    
     // Add zoom button functionality
     document.getElementById('zoomIn').addEventListener('click', () => {
        window.financeChart.zoom(1.1); // Zoom in by 10%
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
        window.financeChart.zoom(0.9); // Zoom out by 10%
    });



    // Slider functionality
    const slider = document.getElementById('chartSlider');
    slider.addEventListener('input', function(e) {
        if (!window.financeChart) return;

        const chart = window.financeChart;
        const totalPoints = chart.data.labels.length;
        const visiblePoints = Math.floor(totalPoints * 0.1); // 10% of total points

        // Calculate the start index based on slider position
        const percent = e.target.value / 100;
        const maxStartIndex = totalPoints - visiblePoints;
        const startIndex = Math.floor(percent * maxStartIndex);

        // Set the viewport to show 10% of points starting from the calculated position
        chart.options.scales.x.min = chart.data.labels[startIndex];
        chart.options.scales.x.max = chart.data.labels[startIndex + visiblePoints];
        chart.update('none'); // Update without animation
    });

    // Initialize slider position
    if (slider) {
        slider.value = 0;
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

// Function to start minutely updates
export function startAutoRefresh(symbol, timeRange, interval) {
    // Stop any existing interval
    stopAutoRefresh();

    const isCrypto = symbol.endsWith('-USD');
    
    // Only start auto-refresh if it's a crypto symbol or if using minute intervals
    if (interval === '1m') {
        // Initial update
        updateFinanceDataWithPercentage(symbol, timeRange, interval);

        updateInterval = setInterval(() => {
            updateFinanceDataWithPercentage(symbol, timeRange, interval);
        }, Math.floor(Math.random() * (3000 - 2000 + 1) + 2000));
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

document.addEventListener('DOMContentLoaded', () => {
    const checkButtonExistence = setInterval(() => {
        const fullscreenButton = document.getElementById('fullscreenButton');
        const financeChart = document.getElementById('financeChart');  // The canvas element
        const parentElement = financeChart ? financeChart.parentElement : null;  // The parent of the canvas
        
        if (fullscreenButton && financeChart && parentElement) {
            fullscreenButton.addEventListener('click', () => {
                // Check if the user is on mobile (example: width < 768px)
                const isMobile = window.innerWidth <= 768;

                if (!document.fullscreenElement) {
                    // Request fullscreen for the parent element
                    parentElement.requestFullscreen().catch(err => {
                        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                    });

                    // Lock orientation to landscape if on mobile
                    if (isMobile) {
                        screen.orientation.lock('landscape').catch(err => {
                            console.error(`Error locking orientation: ${err.message}`);
                        });
                    }

                } else {
                    // Exit fullscreen and reset everything
                    document.exitFullscreen();

                    // Reset the screen orientation when exiting fullscreen
                    if (isMobile) {
                        screen.orientation.unlock().catch(err => {
                            console.error(`Error unlocking orientation: ${err.message}`);
                        });
                    }

                    // Reset the parent element's dimensions and rotation
                    parentElement.style.width = ''; // Reset to default width
                    parentElement.style.height = ''; // Reset to default height

                    // Reset the canvas size to its original dimensions
                    financeChart.width = 800;  // Your original canvas width
                    financeChart.height = 600;  // Your original canvas height
                }
            });

            clearInterval(checkButtonExistence);  // Stop checking once the button is found
        }
    }, 100);  // Check every 100ms
});



