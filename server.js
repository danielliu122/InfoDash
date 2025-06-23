const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const axios = require('axios');
const googleTrends = require('google-trends-api');
const yahooFinance = require('yahoo-finance2').default;
const NodeCache = require('node-cache');
const newsCache = new NodeCache({ stdTTL: 43200, checkperiod: 14400 }); 
// Cache with TTL of 12 hours (43200 seconds)
//const rateLimit = require('express-rate-limit');
const geoip = require('geoip-lite');
const OpenAI = require('openai'); // Import OpenAI directly
// Initialize OpenAI API directly with the API key
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
});
const DDG = require('duck-duck-scrape');
const weather = require('weather-js');
const fs = require('fs').promises;

// News cache file path
const NEWS_CACHE_FILE = path.join(__dirname, 'data', 'news-cache.json');

// Function to load news cache from file
async function loadNewsCache() {
    try {
        const data = await fs.readFile(NEWS_CACHE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // console.log('No existing news cache found, starting fresh');
        return {};
    }
}

// Function to save news cache to file
async function saveNewsCache(cacheData) {
    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        await fs.writeFile(NEWS_CACHE_FILE, JSON.stringify(cacheData, null, 2));
        // console.log('News cache saved to file');
    } catch (error) {
        console.error('Error saving news cache:', error);
    }
}

// Function to check if cache is stale (older than 6 hours)
function isCacheStale(timestamp) {
    const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    return Date.now() - timestamp > sixHours;
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Global variable to store the daily summary
let dailySummary = null;
let lastSummaryDate = null;

// Function to check if market is closed (4:00 PM ET)
function isMarketClosed() {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = etNow.getDay();
    const hour = etNow.getHours();
    const minute = etNow.getMinutes();
    
    // Check if it's a weekday and past 4:00 PM ET
    if (day >= 1 && day <= 5) {
        return hour >= 16; // 4:00 PM or later
    }
    return true; // Weekend
}

// Function to save daily summary to file
async function saveDailySummary(summaryData, date) {
    try {
        const summaryFile = path.join(__dirname, 'data', 'daily-summaries.json');
        
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        // Read existing summaries
        let summaries = {};
        try {
            const existingData = await fs.readFile(summaryFile, 'utf8');
            summaries = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
            summaries = {};
        }
        
        // Add today's summary
        summaries[date] = {
            ...summaryData,
            timestamp: new Date().toISOString(),
            marketClosed: isMarketClosed()
        };
        
        // Save to file
        await fs.writeFile(summaryFile, JSON.stringify(summaries, null, 2));
        
        // Update global variables if it's for today
        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
        dailySummary = summaryData;
        lastSummaryDate = today;
        }
        
        // console.log(`Daily summary saved for ${date}`);
        return true;
    } catch (error) {
        console.error('Error saving daily summary:', error);
        return false;
    }
}

// Function to load daily summary from file
async function loadDailySummary(date = null) {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const summaryFile = path.join(__dirname, 'data', 'daily-summaries.json');
        
        const data = await fs.readFile(summaryFile, 'utf8');
        const summaries = JSON.parse(data);
        
        return summaries[targetDate] || null;
    } catch (error) {
        console.error('Error loading daily summary:', error);
        return null;
    }
}

// Initialize daily summary on server start
async function initializeDailySummary() {
    const today = new Date().toISOString().split('T')[0];
    const savedSummary = await loadDailySummary(today);
    
    if (savedSummary) {
        dailySummary = savedSummary;
        lastSummaryDate = today;
        // console.log(`Loaded existing daily summary for ${today}`);
    } else {
        // console.log('No existing daily summary found');
    }
}

// Call initialization
initializeDailySummary();

// Rate limiter middleware
// const limiter = rateLimit({
//     windowMs: 1 * 60 * 1000, // 1 minute
//     max: 1000, // limit each IP to 100 requests per windowMs
//     skip: (req) => {
//         const ip = req.ip;
//         const devIp = process.env.DEV_IP || '127.0.0.1';
//         return ip === '127.0.0.1' || ip === '::1' || ip === devIp;
//     }
// });

// // Geo-restrictor middleware
// const restrictedCountries = [
//     'RU', 'CN', 'KP', 'IR', 'NG', 'UA', 'BR', 'BI', 'AF', 'SD', 'CD', 'VE', 'CU',
// ];

// const geoRestrictor = (req, res, next) => {
//     const ip = req.ip;
//     const geo = geoip.lookup(ip);
//     if (geo && restrictedCountries.includes(geo.country)) {
//         return res.status(403).json({ error: 'Access restricted from your location' });
//     }
//     next();
// };

// // Apply rate limiter and geo-restrictor to all routes
// //app.use(limiter);
// app.use(geoRestrictor);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/news', async (req, res) => {
    const newsApiKey = process.env.NEWS_API_KEY;
    const { query, country, language, category, from } = req.query;
    const cacheKey = `${query}-${country}-${language}-${category || 'general'}-${from || 'all'}`;

    if (!newsApiKey) {
        console.error('News API key is not set in the environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Load existing cache from file
        let fileCache = await loadNewsCache();
        
        // Check if we have cached data for this request
        if (fileCache[cacheKey] && !isCacheStale(fileCache[cacheKey].timestamp)) {
            // console.log(`Using cached news data for: ${cacheKey}`);
            return res.json(fileCache[cacheKey].data);
    }

        // If cache is stale or doesn't exist, fetch fresh data
        // console.log(`Fetching fresh news data for: ${cacheKey}`);

    // Build API URL based on parameters
    let newsUrl;
    if (category) {
        newsUrl = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&language=${language}&apiKey=${newsApiKey}`;
    } else {
        newsUrl = `https://newsapi.org/v2/everything?q=${query}&language=${language}&sortBy=popularity${from ? `&from=${from}` : ''}&apiKey=${newsApiKey}`;
    }

        const response = await axios.get(newsUrl);
        
        if (response.status === 200 && response.data) {
            // Store the fresh data in file cache
            fileCache[cacheKey] = {
                data: response.data,
                timestamp: Date.now()
            };
            
            // Save updated cache to file
            await saveNewsCache(fileCache);
            
            // console.log(`Fresh news data cached for: ${cacheKey}`);
            res.json(response.data);
        } else {
            res.status(response.status).json({ error: 'Error fetching news data' });
        }
        
    } catch (error) {
        console.error('Error in news API:', error);
        
        // Check if it's a rate limit error
        if (error.response && error.response.status === 429) {
            // console.log('News API rate limit reached, checking for cached data...');
            
            // Try to load any cached data, even if stale
            const fileCache = await loadNewsCache();
            if (fileCache[cacheKey]) {
                // console.log(`Using stale cached data for: ${cacheKey}`);
                return res.json({
                    ...fileCache[cacheKey].data,
                    _cached: true,
                    _stale: isCacheStale(fileCache[cacheKey].timestamp),
                    _message: 'Rate limit reached, showing cached data'
                });
            } else {
                return res.status(429).json({ 
                    error: 'News API rate limit reached and no cached data available',
                    message: 'Please try again later or upgrade your API plan'
                });
            }
        }
        
        // Check if it's an API key error
        if (error.response && error.response.status === 401) {
            // console.log('News API key error, checking for cached data...');
            
            const fileCache = await loadNewsCache();
            if (fileCache[cacheKey]) {
                // console.log(`Using cached data due to API key error for: ${cacheKey}`);
                return res.json({
                    ...fileCache[cacheKey].data,
                    _cached: true,
                    _message: 'API key error, showing cached data'
                });
            } else {
                return res.status(401).json({ 
                    error: 'News API key error and no cached data available',
                    message: 'Please check your API key configuration'
                });
            }
        }
        
        res.status(500).json({ error: 'Error fetching news data' });
    }
});

// Route to fetch Google Trends data
app.get('/api/trends', async (req, res) => {
    try {
        const type = req.query.type || 'daily';
        const geo = req.query.geo || 'US';
        const category = req.query.category || 'all';
        const language = req.query.language || 'en';

        if (type === 'daily') {
            const trends = await googleTrends.dailyTrends({ geo, hl: language });
            res.json(JSON.parse(trends));
        } else if (type === 'realtime') {
            const trends = await googleTrends.realTimeTrends({ geo, hl: language });
            res.json(JSON.parse(trends));
        } else {
            res.status(400).json({ error: 'Invalid type specified' });
        }
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(200).json({});
    }
});

// Route to fetch Google Trends data
app.get('/api/trends2', async (req, res) => {
    try {
        const geo = req.query.geo || 'US';
        const language = req.query.language || 'en-US';
        const session = axios.create();
        
        // New API endpoint with batch request
        const response = await session.post(
            'https://trends.google.com/_/TrendsUi/data/batchexecute',
            `f.req=[[["i0OFE","[null, null, \\"${geo}\\", 0, null, 48]"]]]`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'Referer': 'https://trends.google.com/trends/explore'
                }
            }
        );

        // Extract JSON from the nested response
        const jsonData = response.data.split('\n').find(line => line.trim().startsWith('['));
        const parsed = JSON.parse(JSON.parse(jsonData)[0][2]);
        
        // Map the response to match previous format
        const mappedData = parsed[1].map(item => ({
            title: { query: item[0] },
            relatedQueries: item[9] ? item[9].slice(1).map(q => ({ query: q })) : [],
            articles: item[3]?.map(article => ({
                title: article[0],
                url: article[1],
                source: article[2],
                image: { imageUrl: article[3] }
            })) || []
        }));

        res.json({
            default: {
                trendingSearchesDays: [{
                    trendingSearches: mappedData
                }]
            }
        });
        
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(200).json({});
    }
});

// Proxy endpoint to fetch financial data
app.get('/api/finance/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const range = req.query.range || '1d';
    const interval = req.query.interval || '1m';
    const baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/';
    const url = `${baseUrl}${symbol}?range=${range}&interval=${interval}`;

    try {
        const response = await axios.get(url);
        // console.log(`Finance API response for ${symbol}:`, {
        //     status: response.status,
        //     hasData: !!response.data,
        //     hasChart: !!response.data?.chart,
        //     hasResult: !!response.data?.chart?.result,
        //     resultLength: response.data?.chart?.result?.length || 0,
        //     metaKeys: response.data?.chart?.result?.[0]?.meta ? Object.keys(response.data.chart.result[0].meta) : []
        // });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching financial data:', error);
        res.status(500).json({ error: 'Error fetching financial data' });
    }
});

// New endpoint to proxy Google Maps script
app.get('/api/googlemaps/script', (req, res) => {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleMapsApiKey) {
        console.error('Google Maps API key is not set in the environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&loading=async&callback=initMap&libraries=places,geometry`;
    res.redirect(scriptUrl);
});

app.post('/api/chat', async (req, res) => {
    try {
        // console.log('Chat API: Received request');
        const { messages, model = 'deepseek/deepseek-r1:free' } = req.body;
        
        // console.log('Chat API: Request body parsed, model:', model);
        // console.log('Chat API: Messages count:', messages?.length || 0);
        
        if (!messages || messages.length === 0) {
            // console.log('Chat API: No messages provided');
            return res.status(400).json({ error: 'Messages are required' });
        }

        // console.log('Chat API: Making OpenAI API call...');
        const response = await openai.chat.completions.create({
            model,
            messages,
            max_tokens: 3333,
        });

        // console.log('Chat API: OpenAI response received');

        // Validate API response structure
        if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
            console.error('Chat API: Invalid API response structure:', response);
            return res.status(500).json({ 
                error: 'Invalid response from AI service',
                details: 'The AI service returned an unexpected response format'
            });
        }

        const reply = response.choices[0].message.content;
        // console.log('Chat API: Sending response, length:', reply.length);
        res.json({ reply });
    } catch (error) {
        console.error('Chat API: Error communicating with OpenRouter:', error);
        res.status(500).json({ 
            error: 'Error communicating with OpenRouter',
            details: error.message 
        });
    }
});

// Update lookup endpoint to use selected model
app.post('/api/lookup', async (req, res) => {
    try {
        const { query, model = 'deepseek/deepseek-r1:free' } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // First try DuckDuckGo
        const searchResults = await DDG.search(query, {
            safeSearch: DDG.SafeSearchType.STRICT
        });

        if (searchResults.noResults || !searchResults.results || searchResults.results.length === 0) {
            return res.json({ result: null });
        }

        // Get the first result
        const firstResult = searchResults.results[0];
        const rawResult = firstResult.description || firstResult.title || null;

        // If it's a direct answer (for a simple query), return it
        if (rawResult) {
            return res.json({ result: rawResult });
        }

        // Otherwise, use selected model to process the result
        const processedResponse = await openai.chat.completions.create({
            model,
            messages: [{
                role: 'user',
                content: `Based on this information: "${rawResult}", answer: ${query}`
            }],
            max_tokens: 3333
        });

        const finalResult = processedResponse.choices[0].message.content;
        res.json({ result: finalResult });
    } catch (error) {
        console.error('Error performing lookup:', error);
        res.status(500).json({ error: 'Error performing lookup' });
    }
});

// New weather API endpoint using weather-js
app.get('/api/weather', async (req, res) => {
    try {
        const { location = 'New York, NY' } = req.query;
        
        // Use weather-js to get weather information
        weather.find({search: location, degreeType: 'F'}, function(err, result) {
            if(err) {
                console.error('Error fetching weather:', err);
                return res.status(500).json({ error: 'Error fetching weather information' });
            }
            
            if (!result || result.length === 0) {
                return res.status(404).json({ error: 'Weather information not found for this location' });
            }
            
            const weatherData = result[0];
            const current = weatherData.current;
            const locationData = weatherData.location;
            
            // Return the complete weather data structure
            const formattedWeather = {
                location: {
                    name: locationData.name,
                    country: locationData.country,
                    timezone: locationData.timezone
                },
                current: {
                    temperature: current.temperature,
                    temperatureUnit: 'F',
                    condition: current.skytext,
                    humidity: current.humidity,
                    wind: current.winddisplay,
                    windUnit: 'mph',
                    feelslike: current.feelslike,
                    uv: current.uv || 'N/A',
                    description: `Current weather in ${locationData.name}: ${current.temperature}°F, ${current.skytext}, ${current.humidity}% humidity, wind ${current.winddisplay}`
                }
            };
            
            res.json(formattedWeather);
        });
    } catch (error) {
        console.error('Error fetching weather:', error);
        res.status(500).json({ error: 'Error fetching weather information' });
    }
});

// Enhanced lookup endpoint for real-time information
app.post('/api/enhanced-lookup', async (req, res) => {
    try {
        const { query, model = 'deepseek/deepseek-r1:free' } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const queryLower = query.toLowerCase();
        let result = null;

        // Check if it's a weather query
        if (queryLower.includes('weather') || queryLower.includes('temperature') || queryLower.includes('forecast')) {
            // Extract location from query
            const locationMatch = query.match(/(?:weather|temperature|forecast)\s+(?:in\s+)?([^?]+)/i);
            const location = locationMatch ? locationMatch[1].trim() : 'New York';
            
            try {
                const weatherResponse = await fetch(`${req.protocol}://${req.get('host')}/api/weather?location=${encodeURIComponent(location)}`);
                if (weatherResponse.ok) {
                    const weatherData = await weatherResponse.json();
                    result = weatherData.description || `Weather in ${location}: ${weatherData.temperature || 'N/A'} ${weatherData.condition || ''}`;
                }
            } catch (weatherError) {
                console.error('Weather lookup error:', weatherError);
            }
        }
        
        // Check if it's a stock query
        else if (queryLower.includes('stock') || queryLower.includes('price') || queryLower.includes('market') || 
                 queryLower.includes('nasdaq') || queryLower.includes('dow') || queryLower.includes('s&p')) {
            try {
                // Extract stock symbol from query
                const stockMatch = query.match(/\$?([A-Z]{1,5})/);
                if (stockMatch) {
                    const symbol = stockMatch[1];
                    const stockResponse = await fetch(`${req.protocol}://${req.get('host')}/api/finance/${symbol}?range=1d&interval=1m`);
                    if (stockResponse.ok) {
                        const stockData = await stockResponse.json();
                        if (stockData.chart && stockData.chart.result && stockData.chart.result[0]) {
                            const meta = stockData.chart.result[0].meta;
                            const price = meta.regularMarketPrice;
                            const change = meta.regularMarketPrice - meta.previousClose;
                            const changePercent = (change / meta.previousClose) * 100;
                            result = `${symbol} stock: $${price.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}, ${changePercent.toFixed(2)}%)`;
                        }
                    }
                }
            } catch (stockError) {
                console.error('Stock lookup error:', stockError);
            }
        }

        // If no specific data found, use general DuckDuckGo search
        if (!result) {
            const searchResults = await DDG.search(query, {
                safeSearch: DDG.SafeSearchType.STRICT
            });

            if (searchResults.noResults || !searchResults.results || searchResults.results.length === 0) {
                return res.json({ result: null });
            }

            const firstResult = searchResults.results[0];
            result = firstResult.description || firstResult.title || null;
        }

        // If we have a result, optionally enhance it with AI
        if (result) {
            try {
                const enhancedResponse = await openai.chat.completions.create({
                    model,
                    messages: [{
                        role: 'user',
                        content: `Based on this information: "${result}", provide a clear and concise answer to: ${query}`
                    }],
                    max_tokens: 200
                });

                result = enhancedResponse.choices[0].message.content;
            } catch (aiError) {
                console.error('Error enhancing result:', aiError);
                // Return the raw result if AI enhancement fails
            }
        }

        res.json({ result });
    } catch (error) {
        console.error('Error performing enhanced lookup:', error);
        res.status(500).json({ error: 'Error performing lookup' });
    }
});

// Daily Summary API endpoints
app.post('/api/summary/save', async (req, res) => {
    try {
        // console.log('Received summary save request');
        // console.log('Request body:', req.body);
        
        const { news, trends, finance, overall, date } = req.body;
        
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        // Determine if the date is today
        const today = new Date().toISOString().split('T')[0];
        
        // Only block overwriting for past dates
        if (date !== today) {
            const existingSummary = await loadDailySummary(date);
            if (existingSummary) {
                // console.log(`Daily summary already exists for ${date}`);
                return res.json({ 
                    success: false, 
                    message: `Daily summary already exists for ${date}`,
                    summary: existingSummary 
                });
            }
        }
        
        // console.log('Extracted summary data:', { news: !!news, trends: !!trends, finance: !!finance, overall: !!overall });
        
        if (!news && !trends && !finance && !overall) {
            // console.log('No summary data provided');
            return res.status(400).json({ 
                success: false, 
                message: 'No summary data provided' 
            });
        }
        
        const summaryData = {
            news,
            trends,
            finance,
            overall,
            generatedAt: new Date().toISOString()
        };
        
        // console.log('Saving summary data...');
        const saved = await saveDailySummary(summaryData, date);
        
        if (saved) {
            // console.log(`Summary saved successfully for ${date}`);
            res.json({ 
                success: true, 
                message: 'Daily summary saved successfully',
                summary: summaryData
            });
        } else {
            // console.log('Failed to save summary');
            res.status(500).json({ 
                success: false, 
                message: 'Failed to save daily summary' 
            });
        }
    } catch (error) {
        console.error('Error saving summary:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while saving summary' 
        });
    }
});

app.get('/api/summary/daily', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const summary = await loadDailySummary(targetDate);
        
        if (summary) {
            res.json({ 
                success: true, 
                summary,
                date: targetDate
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No summary found for the specified date',
                date: targetDate
            });
        }
    } catch (error) {
        console.error('Error retrieving daily summary:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving summary' 
        });
    }
});

app.get('/api/summary/history', async (req, res) => {
    try {
        const summaryFile = path.join(__dirname, 'data', 'daily-summaries.json');
        
        try {
            const data = await fs.readFile(summaryFile, 'utf8');
            const summaries = JSON.parse(data);
            
            // Convert to array format for easier frontend consumption
            const summaryArray = Object.entries(summaries).map(([date, summary]) => ({
                date,
                timestamp: summary.timestamp,
                marketClosed: summary.marketClosed,
                hasData: !!(summary.news || summary.trends || summary.finance || summary.overall)
            })).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            res.json({ 
                success: true, 
                summaries: summaryArray
            });
        } catch (error) {
            // File doesn't exist
            res.json({ 
                success: true, 
                summaries: []
            });
        }
    } catch (error) {
        console.error('Error retrieving summary history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving summary history' 
        });
    }
});

// Endpoint to clear news cache (for testing/maintenance)
app.post('/api/news/clear-cache', async (req, res) => {
    try {
        await saveNewsCache({});
        // console.log('News cache cleared');
        res.json({ success: true, message: 'News cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing news cache:', error);
        res.status(500).json({ error: 'Error clearing news cache' });
    }
});

// Endpoint to get cache status (for debugging)
app.get('/api/news/cache-status', async (req, res) => {
    try {
        const fileCache = await loadNewsCache();
        const cacheKeys = Object.keys(fileCache);
        const cacheInfo = cacheKeys.map(key => ({
            key,
            timestamp: fileCache[key].timestamp,
            age: Date.now() - fileCache[key].timestamp,
            stale: isCacheStale(fileCache[key].timestamp),
            articleCount: fileCache[key].data.articles?.length || 0
        }));
        
        res.json({
            totalEntries: cacheKeys.length,
            entries: cacheInfo
        });
    } catch (error) {
        console.error('Error getting cache status:', error);
        res.status(500).json({ error: 'Error getting cache status' });
    }
});

// --- NEW ROBUST BULK FINANCE ENDPOINT ---
app.post('/api/finance/bulk-real-time', async (req, res) => {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({ error: 'Symbols must be an array' });
    }

    try {
        const results = {};
        const promises = symbols.map(async (symbol) => {
            try {
                const quote = await yahooFinance.quote(symbol);
                if (quote) {
                    results[symbol] = {
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent,
                        symbol: quote.symbol,
                        name: quote.shortName || quote.longName || symbol,
                    };
                } else {
                    results[symbol] = { error: 'No data available' };
                }
            } catch (error) {
                console.error(`Error fetching bulk data for symbol: ${symbol}`, error.message);
                results[symbol] = { error: 'Failed to fetch' };
            }
        });

        await Promise.all(promises);
        res.json(results);
    } catch (error) {
        console.error('Error fetching bulk real-time data:', error);
        res.status(500).json({ error: 'Failed to fetch bulk real-time financial data' });
    }
});

app.get('/api/reddit', async (req, res) => {
    const timePeriod = req.query.t || 'day';
    const redditUrl = `https://www.reddit.com/top.json?sort=top&t=${timePeriod}`;
    try {
        const response = await fetch(redditUrl);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch from Reddit' });
    }
});

// Catch-all route for undefined routes
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, () => {
    // console.log(`Server is running on port ${port}`);
});