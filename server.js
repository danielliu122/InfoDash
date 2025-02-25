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
    apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set in the environment
});

const app = express();
const port = process.env.PORT || 3000;

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
    const { query, country, language } = req.query;
    const cacheKey = `${query}-${country}-${language}`;

    if (!newsApiKey) {
        console.error('News API key is not set in the environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check if data is cached
    const cachedData = newsCache.get(cacheKey);
    if (cachedData) {
        //console.log('Using cached news data');
        return res.json(cachedData);
    }

    // If not cached, fetch fresh data
    const newsUrl = `https://newsapi.org/v2/everything?q=${query}&language=${language}&apiKey=${newsApiKey}`;

    try {
        const response = await axios.get(newsUrl);
        if (response.status === 200 && response.data) {
            // Cache the fresh news data
            newsCache.set(cacheKey, response.data);
            res.json(response.data);
        } else {
            res.status(response.status).json({ error: 'Error fetching news data' });
        }
    } catch (error) {
        console.error('Error fetching news data:', error);
        res.status(500).json({ error: 'Error fetching news data' });
    }
});

// Route to fetch Google Trends data
app.get('/api/trends', async (req, res) => {
    try {
        // Keep existing implementation but suppress errors
        const type = req.query.type || 'daily';
        const geo = req.query.geo || 'US';
        const category = req.query.category || 'all';
        const language = req.query.language || 'en';

        if (type === 'daily') {
            const trends = await googleTrends.dailyTrends({ geo, hl: language });
            return res.json(JSON.parse(trends));
        }
        
        return res.json({}); // Return empty response for other types
        
    } catch (error) {
        // Suppress error logging
        return res.status(200).json({}); // Always return 200 with empty object
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
    let body = '';

    // Collect data from the request body
    req.on('data', chunk => {
        body += chunk.toString(); // Convert Buffer to string
    });

    req.on('end', async () => {
        try {
            const { messages } = JSON.parse(body); // Parse the JSON body

            if (!messages || messages.length === 0) {
                return res.status(400).json({ error: 'Messages are required' });
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: messages.map(msg => ({ role: 'user', content: msg })), // Map messages to the required format
                max_tokens: 333 // Limit to 333 tokens
            });

            const reply = response.choices[0].message.content;
            res.json({ reply });
        } catch (error) {
            console.error('Error communicating with OpenAI:', error);
            res.status(500).json({ error: 'Error communicating with OpenAI' });
        }
    });
});


// Catch-all route for undefined routes
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.use(express.json());

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});