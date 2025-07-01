// summary.js - Handles the summary section functionality

import { userPrefs } from './userPreferences.js';

let summaryData = {
    news: null,
    trends: null,
    finance: null,
    weather: null
};

let summaryGenerated = false;
let lastError = null;

// Function to get a YYYY-MM-DD string from a Date object in local time
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to check if user has already generated a summary today
function hasGeneratedToday() {
    const today = getLocalDateString();
    const lastGeneratedDate = localStorage.getItem('lastSummaryGeneratedDate');
    return lastGeneratedDate === today;
}

// Function to mark that a summary was generated today
function markGeneratedToday() {
    const today = getLocalDateString();
    localStorage.setItem('lastSummaryGeneratedDate', today);
}

// Function to get selected date or today's date
function getSelectedDate() {
    const dateInput = document.getElementById('summaryDate');
    return dateInput && dateInput.value ? dateInput.value : getLocalDateString();
}

// Function to collect data from all sections
async function collectSectionData() {
    //console.log('collectSectionData: Starting to collect section data...');
    
    const data = {
        news: null,
        trends: null,
        finance: null
    };
    
    // Collect news data
    //console.log('collectSectionData: Collecting news data...');
    data.news = collectNewsData();
    console.log('collectSectionData: News data collected:', {
        hasData: !!data.news,
        count: data.news?.length || 0
    });
    
    // Collect trends data
    //console.log('collectSectionData: Collecting trends data...');
    data.trends = await collectTrendsData();
    console.log('collectSectionData: Trends data collected:', {
        hasData: !!data.trends,
        count: data.trends?.length || 0
    });
    
    // Collect finance data
    //console.log('collectSectionData: Collecting finance data...');
    data.finance = await collectFinanceData();
    console.log('collectSectionData: Finance data collected:', {
        hasData: !!data.finance,
        hasNasdaq: !!data.finance?.nasdaq,
        techStocksCount: Object.keys(data.finance?.techStocks || {}).length,
        cryptoCount: Object.keys(data.finance?.crypto || {}).length
    });
    
    console.log('collectSectionData: Section data collection completed:', {
        hasNews: !!data.news,
        hasTrends: !!data.trends,
        hasFinance: !!data.finance
    });
    
    return data;
}

// Function to collect news data
function collectNewsData() {
    //console.log('collectNewsData: Starting news data collection...');
    const newsContainer = document.querySelector('#news .data-container');
    //console.log('collectNewsData: News container found:', !!newsContainer);
    
    if (!newsContainer) {
        console.log('collectNewsData: No news container found');
        return null;
    }
    
    const newsItems = newsContainer.querySelectorAll('li');
    //console.log('collectNewsData: News items found:', newsItems.length);
    
    if (newsItems.length === 0) {
        console.log('collectNewsData: No news items found');
        return null;
    }
    
    const newsData = [];
    newsItems.forEach((item, index) => {
        if (index < 5) { // Limit to top 5 news items
            // Try multiple selectors for title
            const title = item.querySelector('h3')?.textContent?.trim() || 
                         item.querySelector('h5')?.textContent?.trim() || 
                         item.querySelector('.article-title')?.textContent?.trim() ||
                         item.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
            
            const description = item.querySelector('.article-text')?.textContent?.trim();
            const source = item.querySelector('.article-descriptor')?.textContent?.trim();
            
            // console.log(`collectNewsData: News item ${index}:`, { 
            //     title: title?.substring(0, 50), 
            //     hasDescription: !!description, 
            //     hasSource: !!source,
            //     titleFound: !!title
            // });
            
            if (title) {
                newsData.push({
                    title,
                    description: description || '',
                    source: source || ''
                });
            } else {
                console.log(`collectNewsData: No title found for item ${index}, skipping`);
            }
        }
    });
    
    // console.log('collectNewsData: News data collected:', {
    //     totalItems: newsData.length,
    //     items: newsData.map(item => item.title.substring(0, 30))
    // });
    
    return newsData.length > 0 ? newsData : null;
}

// Function to collect trends data
async function collectTrendsData() {
    // console.log('Collecting trends data...');
    
    try {
        // Get the current country and language settings
        const trendsCountrySelect = document.getElementById('trendsCountrySelect');
        const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
        
        if (!trendsCountrySelect || !trendsLanguageSelect) {
            // console.log('Trends select elements not found');
            return null;
        }
        
        const country = trendsCountrySelect.value;
        const language = trendsLanguageSelect.value;
        
        // console.log(`Fetching trends for country: ${country}, language: ${language}`);
        
        // Fetch trends data directly from the API
        const response = await fetch(`/api/trends2?type=daily&category=all&language=${language}&geo=${country}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('Raw trends data received');
        
        if (!data || !data.default || !data.default.trendingSearchesDays) {
            // console.log('No trends data available');
            return null;
        }
        
        // Extract all trends from the data
        let allTopics = [];
        const trendingSearchesDays = data.default.trendingSearchesDays || [];
        trendingSearchesDays.forEach(day => {
            if (day.trendingSearches) {
                allTopics = allTopics.concat(day.trendingSearches);
            }
        });
        
        // console.log(`Total trends found: ${allTopics.length}`);
        
        // Take the top 25 trends
        const top25Trends = allTopics.slice(0, 25).map(topic => ({
            title: topic.title?.query || topic.title || 'Unknown',
            traffic: topic.formattedTraffic || 'N/A'
        }));
        
        // console.log('Top 25 trends processed');
        // console.log('Top 25 trends processed:', top25Trends);
        return top25Trends.length > 0 ? top25Trends : null;
        
    } catch (error) {
        console.error('Error collecting trends data:', error);
        return null;
    }
}

// Function to collect finance data
async function collectFinanceData() {
    console.log('collectFinanceData: Starting finance data collection...');
    
    const financeData = {
        nasdaq: null,
        techStocks: {},
        crypto: {}
    };
    
    try {
        // First, check if the finance dashboard has already loaded data
        const dashboardContainer = document.getElementById('stock-dashboard');
        const dashboardGrid = dashboardContainer?.querySelector('.stock-dashboard-grid');
        const stockCards = dashboardGrid?.querySelectorAll('.stock-card');
        
        // console.log('collectFinanceData: Dashboard check:', {
        //     hasDashboard: !!dashboardContainer,
        //     hasGrid: !!dashboardGrid,
        //     stockCardsCount: stockCards?.length || 0
        // });
        
        // If dashboard has data, try to extract it first
        if (stockCards && stockCards.length > 0) {
            console.log('collectFinanceData: Using dashboard data');
            
            stockCards.forEach(card => {
                const symbol = card.getAttribute('data-symbol');
                if (!symbol) return;
                
                const priceElement = card.querySelector('.stock-price');
                const changeElement = card.querySelector('.stock-change');
                
                if (priceElement && changeElement) {
                    const priceText = priceElement.textContent.replace('$', '').replace(',', '');
                    const changeText = changeElement.textContent;
                    
                    // Extract percentage change
                    const changeMatch = changeText.match(/([+-]?\d+\.\d+)%/);
                    const changePercent = changeMatch ? parseFloat(changeMatch[1]) : 0;
                    
                    // Determine if it's crypto or stock
                    const isCrypto = symbol.endsWith('-USD');
                    
                    const stockData = {
                        price: parseFloat(priceText) || 0,
                        change: 0, // We don't have absolute change, only percentage
                        changePercent: changePercent,
                        timeframe: 'Current'
                    };
                    
                    if (symbol === '^IXIC') {
                        financeData.nasdaq = stockData;
                        //console.log('collectFinanceData: NASDAQ data from dashboard:', stockData);
                    } else if (isCrypto) {
                        financeData.crypto[symbol] = stockData;
                        //console.log(`collectFinanceData: ${symbol} data from dashboard:`, stockData);
                    } else {
                        financeData.techStocks[symbol] = stockData;
                        //console.log(`collectFinanceData: ${symbol} data from dashboard:`, stockData);
                    }
                }
            });
            
            // If we got good data from dashboard, return it
            const hasDashboardData = financeData.nasdaq || 
                                   Object.keys(financeData.techStocks).length > 0 || 
                                   Object.keys(financeData.crypto).length > 0;
            
            if (hasDashboardData) {
                // //console.log('collectFinanceData: Using dashboard data, skipping API calls');
                // console.log('collectFinanceData: Dashboard data summary:', {
                //     hasNasdaq: !!financeData.nasdaq,
                //     techStocksCount: Object.keys(financeData.techStocks).length,
                //     cryptoCount: Object.keys(financeData.crypto).length,
                //     techStocks: Object.keys(financeData.techStocks),
                //     crypto: Object.keys(financeData.crypto)
                // });
                return financeData;
            }
        }
        
        console.log('collectFinanceData: Dashboard data not available, making API calls...');
        
        // Fallback to API calls if dashboard data is not available
        // Fetch NASDAQ data
        console.log('collectFinanceData: Fetching NASDAQ data...');
        const nasdaqResponse = await fetch('/api/finance/^IXIC?range=1d&interval=1m');
        if (nasdaqResponse.ok) {
            const nasdaqData = await nasdaqResponse.json();
            //console.log('collectFinanceData: NASDAQ data received');
            if (nasdaqData.chart && nasdaqData.chart.result && nasdaqData.chart.result[0]) {
                const result = nasdaqData.chart.result[0];
                const meta = result.meta;
                //console.log('collectFinanceData: NASDAQ meta data processed');
                
                // Calculate current day's open-to-close (or latest) change
                const currentPrice = meta.regularMarketPrice;
                const openPrice = meta.regularMarketOpen;
                
                if (openPrice && currentPrice) {
                    const change = currentPrice - openPrice;
                    const changePercent = (change / openPrice) * 100;
                    
                    financeData.nasdaq = {
                        price: currentPrice?.toFixed(2) || 'N/A',
                        open: openPrice?.toFixed(2) || 'N/A',
                        change: change?.toFixed(2) || 'N/A',
                        changePercent: changePercent?.toFixed(2) || 'N/A',
                        timeframe: 'Today'
                    };
                } else {
                    // Fallback to previous close if open price not available
                    const previousClose = meta.previousClose;
                    const change = currentPrice - previousClose;
                    const changePercent = (change / previousClose) * 100;
                    
                    financeData.nasdaq = {
                        price: currentPrice?.toFixed(2) || 'N/A',
                        open: 'N/A',
                        change: change?.toFixed(2) || 'N/A',
                        changePercent: changePercent?.toFixed(2) || 'N/A',
                        timeframe: 'Since Previous Close'
                    };
                }
                //console.log('collectFinanceData: NASDAQ data collected:', financeData.nasdaq);
            } else {
                //console.log('collectFinanceData: NASDAQ data structure invalid');
            }
        } else {
            console.log('collectFinanceData: NASDAQ response not ok:', nasdaqResponse.status);
        }
        
        // Fetch tech stocks data
        const techStocks = ['META', 'AAPL', 'GOOGL', 'AMZN', 'TSLA'];
        console.log('collectFinanceData: Fetching tech stocks data...');
        for (const symbol of techStocks) {
            try {
                const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.chart && data.chart.result && data.chart.result[0]) {
                        const result = data.chart.result[0];
                        const meta = result.meta;
                        
                        const currentPrice = meta.regularMarketPrice;
                        const openPrice = meta.regularMarketOpen;
                        
                        if (openPrice && currentPrice) {
                            const change = currentPrice - openPrice;
                            const changePercent = (change / openPrice) * 100;
                            
                            financeData.techStocks[symbol] = {
                                price: currentPrice?.toFixed(2) || 'N/A',
                                open: openPrice?.toFixed(2) || 'N/A',
                                change: change?.toFixed(2) || 'N/A',
                                changePercent: changePercent?.toFixed(2) || 'N/A',
                                timeframe: 'Today'
                            };
                        } else {
                            const previousClose = meta.previousClose;
                            const change = currentPrice - previousClose;
                            const changePercent = (change / previousClose) * 100;
                            
                            financeData.techStocks[symbol] = {
                                price: currentPrice?.toFixed(2) || 'N/A',
                                open: 'N/A',
                                change: change?.toFixed(2) || 'N/A',
                                changePercent: changePercent?.toFixed(2) || 'N/A',
                                timeframe: 'Since Previous Close'
                            };
                        }
                        //console.log(`collectFinanceData: ${symbol} data collected`);
                    }
                }
            } catch (error) {
                console.log(`collectFinanceData: Error fetching ${symbol} data:`, error);
            }
        }
        
        // Fetch crypto data
        const cryptoStocks = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD'];
        //console.log('collectFinanceData: Fetching crypto data...');
        for (const symbol of cryptoStocks) {
            try {
                const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.chart && data.chart.result && data.chart.result[0]) {
                        const result = data.chart.result[0];
                        const meta = result.meta;
                        
                        const currentPrice = meta.regularMarketPrice;
                        const openPrice = meta.regularMarketOpen;
                        
                        if (openPrice && currentPrice) {
                            const change = currentPrice - openPrice;
                            const changePercent = (change / openPrice) * 100;
                            
                            financeData.crypto[symbol] = {
                                price: currentPrice?.toFixed(2) || 'N/A',
                                open: openPrice?.toFixed(2) || 'N/A',
                                change: change?.toFixed(2) || 'N/A',
                                changePercent: changePercent?.toFixed(2) || 'N/A',
                                timeframe: 'Today'
                            };
                        } else {
                            const previousClose = meta.previousClose;
                            const change = currentPrice - previousClose;
                            const changePercent = (change / previousClose) * 100;
                            
                            financeData.crypto[symbol] = {
                                price: currentPrice?.toFixed(2) || 'N/A',
                                open: 'N/A',
                                change: change?.toFixed(2) || 'N/A',
                                changePercent: changePercent?.toFixed(2) || 'N/A',
                                timeframe: 'Since Previous Close'
                            };
                        }
                        //console.log(`collectFinanceData: ${symbol} data collected`);
                    }
                }
            } catch (error) {
                console.log(`collectFinanceData: Error fetching ${symbol} data:`, error);
            }
        }
        
        // console.log('collectFinanceData: Finance data collection completed:', {
        //     hasNasdaq: !!financeData.nasdaq,
        //     techStocksCount: Object.keys(financeData.techStocks).length,
        //     cryptoCount: Object.keys(financeData.crypto).length,
        //     techStocks: Object.keys(financeData.techStocks),
        //     crypto: Object.keys(financeData.crypto)
        // });
        
        return financeData;
        
    } catch (error) {
        console.error('collectFinanceData: Error collecting finance data:', error);
        return null;
    }
}

// Function to collect weather data
async function collectWeatherData() {
    const location = userPrefs.getWeatherLocation();
    
    if (!location) {
        return null;
    }
    
    try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error collecting weather data:', error);
        return null;
    }
}

// Function to generate summary using AI
async function generateSummary(sectionData) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries && !summaryGenerated) {
        try {
            console.log('generateSummary: Starting AI generation...');
            //console.log('Generating summary with data:', sectionData);
            
            const selectedModel = document.getElementById('model-select')?.value || 'deepseek/deepseek-chat-v3-0324:free';
            //console.log('generateSummary: Using model:', selectedModel);
            
            // Prepare the data for AI analysis
            const analysisPrompt = createAnalysisPrompt(sectionData);
            //console.log('generateSummary: Analysis prompt created, length:', analysisPrompt.length);
            //console.log('Analysis prompt:', analysisPrompt);
            
            console.log('generateSummary: Making API call to /api/chat...');
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'system',
                            content: `You are a data analyst specializing in creating clear, concise summaries of current news, trends, and market data.
                            CRITICAL INSTRUCTIONS:
                                - Only report the specific data provided. Do **not** infer, speculate, or add context from outside knowledge.
                                - For percentage changes:
                                - If the change is positive, describe it as "up," "gaining," or "rose."
                                - If the change is negative, describe it as "down," "declining," or "fell."
                                - If the change is between -1% and +1%, refer to it as a "slight movement" or "minimal change."
                                - Only use dramatic terms like "surged," "plunged," or "soared" for percentage changes greater than ±10%.
                                - Do not interpret sentiment or market trends unless explicitly stated in the data.
                                - For cryptocurrency, follow the same rules—do not infer excitement, volatility, or interest unless shown by large percentage changes.
                                - Always refer to performance as part of "today's trading" or the "current session" (not longer timeframes) unless otherwise specified.
                            Ensure your tone remains professional, neutral, and fact-based at all times.`
                        },
                        {
                            role: 'user',
                            content: analysisPrompt
                        }
                    ],
                    model: selectedModel
                }),
            });
            
            console.log('generateSummary: API response received, status:', response.status);
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                console.error('generateSummary: API response not ok:', response.status, response.statusText);
                
                // Try to get more details about the error
                let errorDetails = '';
                try {
                    const errorResponse = await response.text();
                    errorDetails = errorResponse;
                    console.error('generateSummary: Error response body:', errorResponse);
                } catch (e) {
                    console.error('generateSummary: Could not read error response body');
                }
                
                // If it's a 404 or 503 error, retry after a delay
                if (response.status === 404 || response.status === 503) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
                        console.log(`generateSummary: Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                
                throw new Error(`HTTP error! status: ${response.status}${errorDetails ? ` - ${errorDetails}` : ''}`);
            }
            
            //console.log('generateSummary: Parsing JSON response...');
            const data = await response.json();
            //console.log('generateSummary: JSON parsed successfully');
            //console.log('API response data:', data);
            
            const result = data.reply || 'Unable to generate summary at this time.';
            //console.log('generateSummary: Returning result, length:', result.length);
            
            if (result && !result.includes('Error:') && !result.includes('Unable to generate')) {
                updateSummaryDisplay(result);
                await saveCurrentSummary();
                await updateSavedSummariesList();
                summaryGenerated = true;
            } else {
                updateSummaryDisplay(result);
            }
        } catch (error) {
            console.error('generateSummary: Error in AI generation:', error);
            console.error('generateSummary: Error details:', {
                message: error.message,
                stack: error.stack
            });
            
            retryCount++;
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
                console.log(`generateSummary: Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    if (!summaryGenerated) {
        updateSummaryDisplay(lastError?.message || 'Error: Unable to generate summary after multiple attempts.');
    }
}

// Function to create analysis prompt
function createAnalysisPrompt(sectionData) {
    let prompt = 'Please analyze the following current data and provide a comprehensive summary:';
    const selectedDate = new Date(getSelectedDate() + 'T00:00:00'); // Use selected date to check for weekend
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
    
    if (sectionData.news && sectionData.news.length > 0) {
        prompt += ' TOP HEADLINES:';
        sectionData.news.forEach((item, index) => {
            prompt += ` ${index + 1}. ${item.title}`;
            if (item.description) {
                prompt += ` ${item.description.substring(0, 100)}...`;
            }
        });
    }
    
    if (sectionData.trends && sectionData.trends.length > 0) {
        prompt += ' TRENDING TOPICS:';
        prompt += ' Group the top trending topics by category (such as Sports, Technology, Entertainment, or Other). Under each category, list the relevant trending topics. If you are unsure of a topic\'s category, place it under \'Other\'. Only use categories that are relevant for the current set of topics.';
        sectionData.trends.forEach((item, index) => {
            prompt += ` ${index + 1}. ${item.title} ${item.traffic ? `(${item.traffic})` : ''}`;
        });
    }
    
    if (sectionData.finance) {
        prompt += ' MARKET DATA:';
        if (isWeekend) {
            prompt += ' Stock markets are closed for the weekend. Here is the latest crypto data:';
        }

        if (sectionData.finance.nasdaq && !isWeekend) {
            const timeframe = sectionData.finance.nasdaq.timeframe || 'Today';
            prompt += ` NASDAQ (^IXIC): $${sectionData.finance.nasdaq.price} (${sectionData.finance.nasdaq.changePercent}% ${timeframe})`;
        }
        if (sectionData.finance.techStocks && !isWeekend) {
            Object.entries(sectionData.finance.techStocks).forEach(([symbol, data]) => {
                const timeframe = data.timeframe || 'Today';
                prompt += ` ${symbol}: $${data.price} (${data.changePercent}% ${timeframe})`;
            });
        }
        if (sectionData.finance.crypto) {
            Object.entries(sectionData.finance.crypto).forEach(([symbol, data]) => {
                const timeframe = data.timeframe || 'Today';
                prompt += ` ${symbol}: $${data.price} (${data.changePercent}% ${timeframe})`;
            });
        }
    }
    
    prompt += ' Please provide a structured summary with the following sections. Use the exact headers shown and format your response professionally with clear section breaks.';

    prompt += ' NEWS HIGHLIGHTS: Summarize the key news stories. Place each distinct story in its own paragraph for readability. MAXIMUM 300 WORDS.';
    prompt += ' TRENDING TOPICS: Group the top trending topics by category (Sports, Technology, Entertainment, Other). For each category, list the topics. If a topic\'s category is unclear, place it under \'Other\'. MAXIMUM 300 WORDS.';

    if (isWeekend) {
        prompt += ' MARKET OVERVIEW: Provide insights on cryptocurrency performance. Note that traditional stock markets are closed. MAXIMUM 300 WORDS.';
        prompt += ' KEY INSIGHTS: Overall analysis and what users should pay attention to. MAXIMUM 300 WORDS.';
    } else {
        prompt += ' MARKET OVERVIEW: Provide insights on today\'s trading session including tech stocks and crypto performance. MAXIMUM 300 WORDS.';
        prompt += ' KEY INSIGHTS: Overall analysis and what users should pay attention to. MAXIMUM 300 WORDS.';
    }

    prompt += ' IMPORTANT: Format your response professionally with clear section headers (NEWS HIGHLIGHTS:, TRENDING TOPICS:, MARKET OVERVIEW:, KEY INSIGHTS:). Use proper paragraph breaks between sections and within sections. Keep each section concise and focused. Do not exceed 300 words per section. Use a professional but accessible tone.';

    return prompt;
}

// Function to display current weather in the summary and preferences sections
async function displayCurrentWeather() {
    const location = userPrefs.getWeatherLocation();
    
    // Wait 2 seconds to allow DOM to render weather-info structure
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const weatherSummaryContainer = document.querySelector('.weather-summary .weather-info');
    const preferencesWeatherContainer = document.getElementById('preferences-weather');

    if (!location) {
        if (weatherSummaryContainer) {
            // Check if cookies are declined
            const cookiesDeclined = getCookie('cookiesDeclined') === 'true';
            
            if (cookiesDeclined) {
                weatherSummaryContainer.innerHTML = `
                    <p>No location set. <button onclick="showLocationModal()">Set Location</button></p>
                    <p style="font-style: italic; color: #9e9e9e; font-size: 0.85em; margin-top: 10px;">
                        ⚠️ Cookies are disabled. Please click "🍪 Reset Cookies" above and accept cookies to save your weather location.
                    </p>
                `;
            } else {
                weatherSummaryContainer.innerHTML = '<p>No location set. <button onclick="showLocationModal()">Set Location</button></p>';
            }
        }
        if (preferencesWeatherContainer) {
            preferencesWeatherContainer.innerHTML = '<p>No location set.</p>';
        }
        return;
    }
    
    try {
        const weatherData = await collectWeatherData();
        
        if (!weatherData) {
            if (weatherSummaryContainer) {
                weatherSummaryContainer.innerHTML = '<p>No weather data available.</p>';
            }
            if (preferencesWeatherContainer) {
                preferencesWeatherContainer.innerHTML = '<p>No weather data available.</p>';
            }
            return;
        }
        
        // Handle both old flat format and new nested format
        let current, locationData;
        
        if (weatherData && weatherData.current && weatherData.location) {
            // New nested format
            current = weatherData.current;
            locationData = weatherData.location;
        } else if (weatherData && weatherData.temperature) {
            // Old flat format - convert to new format
            current = {
                temperature: weatherData.temperature,
                temperatureUnit: 'F',
                condition: weatherData.condition,
                humidity: weatherData.humidity,
                wind: weatherData.wind,
                windUnit: 'mph',
                feelslike: weatherData.feelslike
            };
            locationData = {
                name: weatherData.location || location,
                country: 'Unknown',
                timezone: 'Unknown'
            };
        } else {
            console.error('Weather data structure is invalid:', weatherData);
            if (weatherSummaryContainer) {
                weatherSummaryContainer.innerHTML = '<p>No weather data available.</p>';
            }
            if (preferencesWeatherContainer) {
                preferencesWeatherContainer.innerHTML = '<p>No weather data available.</p>';
            }
            return;
        }
        
        // Clean up location display - handle undefined country properly
        const locationName = locationData.name || 'Unknown Location';
        const locationCountry = locationData.country;
        
        // Only show country if it exists and is not empty/undefined
        const locationDisplay = locationCountry && locationCountry !== 'undefined' && locationCountry.trim() !== '' 
            ? `${locationName}, ${locationCountry}` 
            : locationName;
        
        // Fix wind display - remove duplicate units and clean up the data
        let wind = current.wind || 'N/A';
        let windUnit = current.windUnit || '';
        
        // If wind already contains the unit, extract just the number
        if (typeof wind === 'string' && wind.includes('mph')) {
            wind = wind.replace(' mph', '').replace('mph', '').trim();
            windUnit = 'mph';
        } else if (typeof wind === 'string' && wind.includes('m/s')) {
            wind = wind.replace(' m/s', '').replace('m/s', '').trim();
            windUnit = 'm/s';
        }
        
        // Get current timestamp for when the request was made
        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        // Update the weather-info card in summary
        if (weatherSummaryContainer) {
            weatherSummaryContainer.querySelector('.weather-location').innerHTML = `<h4>📍 ${locationDisplay}</h4>`;
            weatherSummaryContainer.querySelector('.weather-updated').innerHTML = `<div style="font-size: 0.8em; color: var(--text-secondary); text-align: right;">🕐 Updated: ${timestamp}</div>`;
            weatherSummaryContainer.querySelector('.weather-condition').textContent = current.condition;
            weatherSummaryContainer.querySelector('.weather-temp').textContent = `Temperature: ${current.temperature}°${current.temperatureUnit}`;
            weatherSummaryContainer.querySelector('.weather-feelslike').textContent = `Feels like: ${current.feelslike}°${current.temperatureUnit}`;
            weatherSummaryContainer.querySelector('.weather-humidity').textContent = `Humidity: ${current.humidity}%`;
            weatherSummaryContainer.querySelector('.weather-wind').textContent = `Wind: ${wind} ${windUnit}`;
        }
        // For preferences section, just show a simple summary
        if (preferencesWeatherContainer) {
            preferencesWeatherContainer.innerHTML = `<div><strong>${locationDisplay}</strong><br>${current.condition}, ${current.temperature}°${current.temperatureUnit}, Feels like: ${current.feelslike}°${current.temperatureUnit}, Humidity: ${current.humidity}%, Wind: ${wind} ${windUnit} <span style='font-size:0.8em;color:var(--text-secondary);'>🕐 ${timestamp}</span></div>`;
        }
    } catch (error) {
        console.error('Error displaying weather:', error);
        if (weatherSummaryContainer) {
            weatherSummaryContainer.innerHTML = '<p>Error loading weather data.</p>';
        }
        if (preferencesWeatherContainer) {
            preferencesWeatherContainer.innerHTML = '<p>Error loading weather data.</p>';
        }
    }
}

// Function to update summary display
function updateSummaryDisplay(summaryText) {
    // console.log('Updating summary display with:', summaryText);
    
    // Debug: Check if summary elements exist
    const newsSummary = document.querySelector('.news-summary .summary-text');
    const trendsSummary = document.querySelector('.trends-summary .summary-text');
    const financeSummary = document.querySelector('.finance-summary .summary-text');
    const weatherSummary = document.querySelector('.weather-summary .summary-text');
    const overallSummary = document.querySelector('.overall-summary .summary-text');
    const summaryContentDiv = document.querySelector('.summary-content');
    
    // console.log('Summary elements found:', {
    //     newsSummary: !!newsSummary,
    //     trendsSummary: !!trendsSummary,
    //     financeSummary: !!financeSummary,
    //     weatherSummary: !!weatherSummary,
    //     overallSummary: !!overallSummary,
    //     summaryContentDiv: !!summaryContentDiv
    // });
    
    // Force the summary content to be visible
    if (summaryContentDiv) {
        summaryContentDiv.style.display = 'block';
        summaryContentDiv.classList.add('show');
        // console.log('Forced summary content to be visible');
    }
    
    if (!summaryText || summaryText === 'Error: Unable to generate summary. Please try again later.') {
        // Update all summary text elements with error message
        if (newsSummary) newsSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        if (trendsSummary) trendsSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        if (financeSummary) financeSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        if (weatherSummary) weatherSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        if (overallSummary) overallSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        return;
    }
    
    // Parse the summary text and extract sections
    const sections = parseSummarySections(summaryText);
    // console.log('Parsed sections:', sections);
    
    // Update each section with specific selectors
    if (sections.news && newsSummary) {
        newsSummary.innerHTML = sections.news;
    }
    
    if (sections.trends && trendsSummary) {
        trendsSummary.innerHTML = sections.trends;
    }
    
    if (sections.finance && financeSummary) {
        financeSummary.innerHTML = sections.finance;
    }
    
    if (sections.insights && overallSummary) {
        overallSummary.innerHTML = sections.insights;
    }
    
    // Fetch and display current weather separately
    displayCurrentWeather();
}

// Function to parse summary sections
function parseSummarySections(summaryText) {
    const sections = {};
    
    // Extract news highlights - handle both markdown and plain text
    const newsMatch = summaryText.match(/(?:###\s*1\.\s*NEWS HIGHLIGHTS|NEWS HIGHLIGHTS:)(.*?)(?=###\s*2\.\s*TRENDING TOPICS|TRENDING TOPICS:|###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:|###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (newsMatch) {
        sections.news = newsMatch[1].trim();
    }
    
    // Extract trending topics - handle both markdown and plain text
    const trendsMatch = summaryText.match(/(?:###\s*2\.\s*TRENDING TOPICS|TRENDING TOPICS:)(.*?)(?=###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:|###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (trendsMatch) {
        sections.trends = trendsMatch[1].trim();
    }
    
    // Extract market overview - handle both markdown and plain text
    const financeMatch = summaryText.match(/(?:###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:)(.*?)(?=###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (financeMatch) {
        sections.finance = financeMatch[1].trim();
    }
    
    // Extract key insights - handle both markdown and plain text
    const insightsMatch = summaryText.match(/(?:###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:)(.*?)$/s);
    if (insightsMatch) {
        sections.insights = insightsMatch[1].trim();
    }
    return sections;
}

// Function to show loading state
function showSummaryLoading() {
    const loadingDiv = document.querySelector('.summary-loading');
    const contentDiv = document.querySelector('.summary-content');
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (contentDiv) contentDiv.style.display = 'none';
}

// Function to hide loading state
function hideSummaryLoading() {
    // console.log('Hiding summary loading...');
    
    const loadingDiv = document.querySelector('.summary-loading');
    const contentDiv = document.querySelector('.summary-content');
    
    // console.log('Loading div found:', !!loadingDiv);
    // console.log('Content div found:', !!contentDiv);
    
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
        // console.log('Loading div hidden');
    }
    
    if (contentDiv) {
        contentDiv.style.display = 'block';
        // console.log('Content div shown');
    }
    
    // Also ensure the summary section itself is visible
    const summarySection = document.querySelector('#summary');
    if (summarySection) {
        summarySection.style.display = 'block';
        // console.log('Summary section is visible');
    }
}

// Function to update the loading text
function setSummaryLoadingText(text) {
    const loadingText = document.getElementById('summary-loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

// Function to show a non-blocking notification
function showNotification(message, duration = 3000) {
    const notificationBar = document.getElementById('notification-bar');
    if (notificationBar) {
        notificationBar.textContent = message;
        notificationBar.classList.add('show');
        setTimeout(() => {
            notificationBar.classList.remove('show');
        }, duration);
    }
}

// Function to enable/disable summary controls
async function setControlsDisabled(disabled) {
    const dateInput = document.getElementById('summaryDate');
    const refreshBtn = document.getElementById('summary-refresh-btn');
    
    if (dateInput) dateInput.disabled = disabled;
    if (refreshBtn) {
        await new Promise(resolve => setTimeout(resolve, 500));
        refreshBtn.disabled = disabled || hasGeneratedToday();
        // Add visual indication when refresh is disabled due to daily limit
        if (hasGeneratedToday()) {
            refreshBtn.title = 'You have already generated a summary today';
        } else {
            refreshBtn.title = 'Refresh current summary';
        }
    }
}

// Export functions for use in other modules
export { collectSectionData, generateSummary, initializeSummarySection }; 

// Daily Summary Management (Server-side)
let currentDailySummary = null;

// Function to save current summary to server
export async function saveCurrentSummary() {
    try {
        console.log('saveCurrentSummary: Starting save process...');
        const date = getSelectedDate();
        console.log('saveCurrentSummary: Date to save:', date);
        
        // Get current summary content
        const newsSummary = document.querySelector('.news-summary .summary-text')?.innerHTML || '';
        const trendsSummary = document.querySelector('.trends-summary .summary-text')?.innerHTML || '';
        const financeSummary = document.querySelector('.finance-summary .summary-text')?.innerHTML || '';
        const overallSummary = document.querySelector('.overall-summary .summary-text')?.innerHTML || '';
        
        // console.log('saveCurrentSummary: Summary content lengths:', {
        //     news: newsSummary.length,
        //     trends: trendsSummary.length,
        //     finance: financeSummary.length,
        //     overall: overallSummary.length
        // });
        
        if (!newsSummary && !trendsSummary && !financeSummary && !overallSummary) {
            console.warn('saveCurrentSummary: No summary data available to save');
            alert('No summary data available to save. Please generate a summary first.');
            return;
        }
        
        const summaryData = {
            news: newsSummary,
            trends: trendsSummary,
            finance: financeSummary,
            overall: overallSummary,
            date: date
            // Weather is excluded from saved data - will be fetched fresh each time
        };
        
        //console.log('saveCurrentSummary: Sending data to server...');
        const response = await fetch('/api/summary/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(summaryData),
        });
        
        //console.log('saveCurrentSummary: Server response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('saveCurrentSummary: Save successful:', result);
            showNotification('Summary saved successfully!', 3000);
            await updateSavedSummariesList(); // Refresh the archive list
        } else {
            const errorData = await response.json();
            console.error('saveCurrentSummary: Save failed:', errorData);
            showNotification(`Error saving summary: ${errorData.error || errorData.message}`, 5000);
        }
    } catch (error) {
        console.error('saveCurrentSummary: Error in save process:', error);
        showNotification('Error saving summary. Please try again.', 5000);
    }
}

// Function to load daily summary from server
async function loadDailySummary(date = null) {
    try {
        const url = date ? `/api/summary/daily?date=${date}` : '/api/summary/daily';
        //console.log('loadDailySummary: Fetching from URL:', url);
        const response = await fetch(url);
        //console.log('loadDailySummary: Response status:', response.status);
        const result = await response.json();
        //console.log('loadDailySummary: Response result:', result);
        
        if (result.success) {
            console.log('loadDailySummary: Summary found and returned');
            return result.summary;
        } else {
            console.log('loadDailySummary: No daily summary found:', result.message);
            return null;
        }
    } catch (error) {
        console.error('loadDailySummary: Error loading daily summary:', error);
        return null;
    }
}

// Function to load summary history from server
async function loadSummaryHistory() {
    try {
        const response = await fetch('/api/summary/history');
        const result = await response.json();
        
        if (result.success) {
            return result.summaries;
        } else {
            console.error('Error loading summary history:', result.message);
            return [];
        }
    } catch (error) {
        console.error('Error loading summary history:', error);
        return [];
    }
}

// Function to update the saved summaries list in the UI
async function updateSavedSummariesList() {
    const container = document.getElementById('saved-summaries-list');
    if (!container) return;
    
    const summaries = await loadSummaryHistory();
    const list = container.querySelector('.collapsible-body') || container; // Handle new structure
    
    list.innerHTML = '';
    
    if (summaries.length === 0) {
        list.innerHTML = '<p class="empty-state">No past summaries found.</p>';
        return; 
    }
    
    summaries.forEach((summary, index) => {
        const item = document.createElement('div');
        item.className = 'saved-summary-item';
        item.dataset.date = summary.date;
        item.onclick = () => selectSummaryItem(summary.date);
        
        const date = new Date(summary.date + 'T00:00:00'); // Treat date string as local, not UTC
        
        const formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const time = new Date(summary.timestamp).toLocaleTimeString();
        const marketStatus = summary.marketClosed ? '📈 Market Closed' : '📊 Trading Day';
        
        item.innerHTML = `
            <div>
                <div class="saved-summary-date">${formattedDate}</div>
                <div class="saved-summary-time">${time} - ${marketStatus}</div>
            </div>
        `;
        
        list.appendChild(item);
    });
}

// Function to select a summary item
async function selectSummaryItem(date) {
    // Remove previous selection
    document.querySelectorAll('.saved-summary-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked item
    const selectedItem = document.querySelector(`[data-date="${date}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Update date input
    document.getElementById('summaryDate').value = date;
    
    // Load and display the selected summary
    const summary = await loadDailySummary(date);
    if (summary) {
        displayHistoricalSummary(summary);
    }
}

// Function to load summary for a specific date from the datepicker
export async function loadSummaryForDate() {
    const dateInput = document.getElementById('summaryDate');
    const date = dateInput.value;
    const today = getLocalDateString();
    
    setControlsDisabled(true);
    setSummaryLoadingText(`Loading summary for ${new Date(date + 'T00:00:00').toLocaleDateString()}...`);
    showSummaryLoading();
    
    const summary = await loadDailySummary(date);
    
    if (summary) {
        updateSummaryDisplayFromData(summary);
    } else {
        // No summary exists for this date. Clear the display.
        updateSummaryDisplay(null); 
        showNotification('No summary found for the selected date.');
    }
    
    // The refresh button should only be active for the current day
    document.getElementById('summary-refresh-btn').style.display = (date === today) ? 'inline-block' : 'none';

    hideSummaryLoading();
    setControlsDisabled(false);
}

// Function to display historical summary (now combined with main display)
function displayHistoricalSummary(summary) {
    const newsSummary = document.querySelector('.news-summary .summary-text');
    const trendsSummary = document.querySelector('.trends-summary .summary-text');
    const financeSummary = document.querySelector('.finance-summary .summary-text');
    const overallSummary = document.querySelector('.overall-summary .summary-text');
    
    if (newsSummary) newsSummary.innerHTML = summary.news || '<p>No news data available</p>';
    if (trendsSummary) trendsSummary.innerHTML = summary.trends || '<p>No trends data available</p>';
    if (financeSummary) financeSummary.innerHTML = summary.finance || '<p>No finance data available</p>';
    if (overallSummary) overallSummary.innerHTML = summary.overall || '<p>No overall insights available</p>';
    
    // Fetch and display current weather (not historical)
    displayCurrentWeather();
}

// Function to delete selected summary (disabled for server-side summaries)
export async function deleteSelectedSummary() {
    alert('Daily summaries are shared across all users and cannot be deleted. Contact the administrator if you need to remove a summary.');
}

// Function to update summary display from saved data
function updateSummaryDisplayFromData(summaryData) {
    const newsSummary = document.querySelector('.news-summary .summary-text');
    const trendsSummary = document.querySelector('.trends-summary .summary-text');
    const financeSummary = document.querySelector('.finance-summary .summary-text');
    const overallSummary = document.querySelector('.overall-summary .summary-text');
    
    if (newsSummary) newsSummary.innerHTML = summaryData.news || '<p>No news data available</p>';
    if (trendsSummary) trendsSummary.innerHTML = summaryData.trends || '<p>No trends data available</p>';
    if (financeSummary) financeSummary.innerHTML = summaryData.finance || '<p>No finance data available</p>';
    if (overallSummary) overallSummary.innerHTML = summaryData.overall || '<p>No overall insights available</p>';
    
    // Fetch and display current weather separately
    displayCurrentWeather();
}

// Helper: Get current time slot
function getCurrentTimeSlot(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 19) return 'afternoon';
    if (hour >= 19 && hour < 23) return 'evening';
    return 'night'; // 23:00-8:59
}

// Helper: Get time slot for a given timestamp string
function getTimeSlotForTimestamp(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return getCurrentTimeSlot(date);
}

// Function to check if user has already refreshed summary today (for manual refresh limit)
function hasRefreshedToday() {
    const today = getLocalDateString();
    const lastRefreshDate = localStorage.getItem('lastSummaryRefreshDate');
    return lastRefreshDate === today;
}

// Function to mark that a summary was refreshed today
function markRefreshedToday() {
    const today = getLocalDateString();
    localStorage.setItem('lastSummaryRefreshDate', today);
}

// Function to warm up the chat endpoint before generating the summary
async function warmUpChatEndpoint() {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'ping' }],
                model: document.getElementById('model-select')?.value || 'deepseek/deepseek-chat-v3-0324:free'
            })
        });
        // Optionally check response.ok, but ignore errors
        if (!response.ok) {
            console.warn('warmUpChatEndpoint: Non-OK response', response.status);
        }
    } catch (e) {
        console.warn('warmUpChatEndpoint: Error warming up chat endpoint', e);
    }
}

// This function will now orchestrate the entire summary section's initial state
async function loadOrGenerateTodaySummary() {
    const today = getLocalDateString();
    console.log('loadOrGenerateTodaySummary: Starting for date:', today);
    setControlsDisabled(true);
    setSummaryLoadingText(`Loading summary for ${new Date(today + 'T00:00:00').toLocaleDateString()}...`);
    showSummaryLoading();

    const summary = await loadDailySummary(today);
    console.log('loadOrGenerateTodaySummary: Summary found:', !!summary);
    
    if (summary) {
        console.log('loadOrGenerateTodaySummary: Displaying existing summary');
        // A summary for today already exists, just display it
        updateSummaryDisplayFromData(summary);
    } else {
        console.log('loadOrGenerateTodaySummary: No summary found, generating new one');
        setSummaryLoadingText(`No summary found for today. Waiting for data to load...`);
        
        // Wait longer for other sections to load their data
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Warm up the chat endpoint before generating the summary
        await warmUpChatEndpoint();
        
        // Check if we have data from other sections before proceeding
        let retryCount = 0;
        const maxRetries = 3;
        let sectionData = null;
        
        while (retryCount < maxRetries) {
            console.log(`loadOrGenerateTodaySummary: Attempt ${retryCount + 1} to collect section data`);
            setSummaryLoadingText(`Collecting data from other sections... (attempt ${retryCount + 1}/${maxRetries})`);
            
            sectionData = await collectSectionData();
            
            // Check if we have sufficient data
            const hasNews = sectionData.news && sectionData.news.length > 0;
            const hasTrends = sectionData.trends && sectionData.trends.length > 0;
            const hasFinance = sectionData.finance && (
                sectionData.finance.nasdaq || 
                Object.keys(sectionData.finance.techStocks).length > 0 || 
                Object.keys(sectionData.finance.crypto).length > 0
            );
            
            console.log('loadOrGenerateTodaySummary: Data check:', {
                hasNews,
                hasTrends,
                hasFinance,
                newsCount: sectionData.news?.length || 0,
                trendsCount: sectionData.trends?.length || 0,
                techStocksCount: Object.keys(sectionData.finance?.techStocks || {}).length,
                cryptoCount: Object.keys(sectionData.finance?.crypto || {}).length
            });
            
            // If we have at least 2 out of 3 data types, proceed
            const dataTypesAvailable = [hasNews, hasTrends, hasFinance].filter(Boolean).length;
            if (dataTypesAvailable >= 2) {
                console.log(`loadOrGenerateTodaySummary: Sufficient data available (${dataTypesAvailable}/3 types)`);
                break;
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`loadOrGenerateTodaySummary: Insufficient data, waiting 2 seconds before retry...`);
                setSummaryLoadingText(`Waiting for more data to load... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        if (retryCount >= maxRetries) {
            console.warn('loadOrGenerateTodaySummary: Max retries reached, proceeding with available data');
        }
        
        setSummaryLoadingText(`Generating summary with available data...`);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Summary generation timed out after 120 seconds')), 120000);
        });
        
        try {
            const summaryPromise = (async () => {
                const summaryText = await generateSummary(sectionData);
                if (summaryText && !summaryText.includes('Error:') && !summaryText.includes('Unable to generate')) {
                    updateSummaryDisplay(summaryText);
                    await saveCurrentSummary();
                    await updateSavedSummariesList();
                } else {
                    updateSummaryDisplay(summaryText);
                }
            })();
            await Promise.race([summaryPromise, timeoutPromise]);
        } catch (error) {
            // console.error('Error auto-generating summary:', error);
            if (error.message.includes('timed out')) {
                updateSummaryDisplay('Error: Summary generation timed out after 5 minutes. Please try refreshing the page.');
            } else {
                updateSummaryDisplay('Error: Unable to automatically generate the daily summary.');
            }
        }
    }
    hideSummaryLoading();
    setControlsDisabled(false);
    updateRefreshButtonStatus();
}

// Function to initialize the entire summary feature
async function initializeSummarySection() {
    console.log('Initializing summary section...');
    
    // Set up event listeners
    const dateInput = document.getElementById('summaryDate');
    if (dateInput) {
        dateInput.addEventListener('change', loadSummaryForDate);
        // Initialize the date picker with today's date
        const today = getLocalDateString();
        dateInput.value = today;
    }
    
    // Add a slight delay before loading or generating today's summary
    await new Promise(resolve => setTimeout(resolve, 3000));
    await loadOrGenerateTodaySummary();
    
    // Update saved summaries list
    await updateSavedSummariesList();
    
    // Initialize weather display
    displayCurrentWeather();
    
    // Update refresh button status
    updateRefreshButtonStatus();
    
    console.log('Summary section initialized');
}

// Function to refresh summary (generates new one and saves to server)
export async function refreshSummary() {
    const today = getLocalDateString();
    // Only allow one manual refresh per user per day
    if (hasRefreshedToday()) {
        showNotification('You have already refreshed the summary today. Daily limit: 1 manual refresh per day.');
        return;
    }
    setSummaryLoadingText(`Generating a new summary for ${new Date(today + 'T00:00:00').toLocaleDateString()}...`);
    summaryGenerated = false;
    setControlsDisabled(true);
    showSummaryLoading();
    // Warm up the chat endpoint before generating the summary
    //await warmUpChatEndpoint();
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Summary generation timed out after 60 seconds')), 60000);
    });
    try {
        const summaryPromise = (async () => {
            const sectionData = await collectSectionData();
            const summaryText = await generateSummary(sectionData);
            if (summaryText && !summaryText.includes('Error:') && !summaryText.includes('Unable to generate')) {
                updateSummaryDisplay(summaryText);
                await saveCurrentSummary();
                await updateSavedSummariesList();
                markRefreshedToday();
                showNotification('Summary refreshed and saved successfully! Daily limit: 1 manual refresh per day.');
            } else {
                updateSummaryDisplay(summaryText);
                showNotification('Summary refreshed but could not be saved due to generation errors.');
            }
            setControlsDisabled(false);
        })();
        await Promise.race([summaryPromise, timeoutPromise]);
    } catch (error) {
        console.error('Error refreshing summary:', error);
        if (error.message.includes('timed out')) {
            updateSummaryDisplay('Error: Summary generation timed out after 5 minutes. Please try again.');
        } else {
            updateSummaryDisplay('Error: Unable to refresh summary. Please try again later.');
        }
    } finally {
        hideSummaryLoading();
        setControlsDisabled(false);
        updateRefreshButtonStatus();
    }
}

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }
}

// Make functions available globally for HTML onclick handlers
window.saveCurrentSummary = saveCurrentSummary;
window.loadSummaryForDate = loadSummaryForDate;
window.deleteSelectedSummary = deleteSelectedSummary; 
window.refreshSummary = refreshSummary;
window.toggleSection = toggleSection;

// Function to initialize location button
function initializeLocationButton() {
    // Location button functionality moved to modal and weather card header
    // No longer need to initialize a specific button
}

// Make functions globally available
window.initializeLocationButton = initializeLocationButton;
window.displayCurrentWeather = displayCurrentWeather;

// After setting weather location, update weather display in both sections
window.setWeatherLocation = function() {
    const input = document.getElementById('weatherLocationInput');
    const location = input.value.trim();
    if (!location) {
        alert('Please enter a location');
        return;
    }
    
    // Save location using userPrefs system
    userPrefs.setWeatherLocation(location);
    
    // Close modal
    const modal = document.getElementById('locationModal');
    const instance = M.Modal.getInstance(modal);
    if (instance) {
        instance.close();
    }
    
    // Show notification
    if (window.showNotification) {
        window.showNotification(`Weather location set to: ${location}`, 3000);
    } else {
        alert(`Weather location set to: ${location}`);
    }
    
    // Update weather in both summary and preferences
    displayCurrentWeather();
};

// Function to reset daily summary generation limit (for testing or admin use)
export function resetDailySummaryLimit() {
    localStorage.removeItem('lastSummaryGeneratedDate');
    // console.log('Daily summary generation limit reset');
    showNotification('Daily summary limit reset. You can now generate a new summary.');
    updateRefreshButtonStatus();
}

// Function to update refresh button status based on daily limit
function updateRefreshButtonStatus() {
    const refreshBtn = document.getElementById('summary-refresh-btn');
    if (!refreshBtn) return;
    if (hasRefreshedToday()) {
        refreshBtn.textContent = '🔄 Daily Limit Reached';
        refreshBtn.title = 'You have already refreshed the summary today. Daily limit: 1 manual refresh per day.';
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.6';
    } else {
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.title = 'Generate a new summary (Daily limit: 1 manual refresh per day)';
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = '1';
    }
}

// Make functions globally available
window.resetDailySummaryLimit = resetDailySummaryLimit;

// Helper function to get cookie value
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null;
} 