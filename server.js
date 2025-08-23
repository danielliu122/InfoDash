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
const fetch = require('node-fetch');
const weather = require('weather-js');
const fs = require('fs').promises;
const cron = require('node-cron');

// Environment-based data paths
const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT;
const dataSubdir = isProduction ? 'production' : 'local';

// News cache file path
const NEWS_CACHE_FILE = path.join('public/data', dataSubdir, 'news-cache.json');

// Summary file path
const SUMMARY_FILE = path.join('public/data', dataSubdir, 'daily-summaries.json');

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
        // Ensure data directory and subdirectory exist
        const dataDir = path.dirname(NEWS_CACHE_FILE);
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
async function saveDailySummary(summaryData, date, language = 'en', country = 'US') {
    try {
        console.log(`saveDailySummary: Saving summary for date: ${date}, language: ${language}, country: ${country}`);
        console.log(`saveDailySummary: Using file path: ${SUMMARY_FILE}`);
        
        // Ensure data directory and subdirectory exist
        const dataDir = path.dirname(SUMMARY_FILE);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        // Read existing summaries
        let summaries = {};
        try {
            const existingData = await fs.readFile(SUMMARY_FILE, 'utf8');
            summaries = JSON.parse(existingData);
            console.log(`saveDailySummary: Loaded existing summaries for ${Object.keys(summaries).length} dates`);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
            console.log('saveDailySummary: No existing summaries file found, starting fresh');
            summaries = {};
        }
        
        // Create summary object with language and country info
        const summaryWithMetadata = {
            ...summaryData,
            language,
            country,
            timestamp: new Date().toISOString(),
            marketClosed: isMarketClosed()
        };
        
        // Check if we already have summaries for this date
        if (summaries[date]) {
            // If it's an array, add to it
            if (Array.isArray(summaries[date])) {
                // Remove existing summary with same language/country if it exists
                summaries[date] = summaries[date].filter(summary => 
                    !(summary.language === language && summary.country === country)
                );
                summaries[date].push(summaryWithMetadata);
            } else {
                // Convert single object to array and add new summary
                const existingSummary = summaries[date];
                summaries[date] = [existingSummary, summaryWithMetadata];
            }
        } else {
            // First summary for this date
            summaries[date] = summaryWithMetadata;
        }
        
        // Save to file
        await fs.writeFile(SUMMARY_FILE, JSON.stringify(summaries, null, 2));
        console.log(`saveDailySummary: Successfully saved summary for ${date} (${country}, ${language})`);
        
        // Update global variables if it's for today and default region
        const today = new Date().toISOString().split('T')[0];
        if (date === today && language === 'en' && country === 'US') {
            dailySummary = summaryData;
            lastSummaryDate = today;
            console.log('saveDailySummary: Updated global variables for today');
        }
        
        return true;
    } catch (error) {
        console.error('saveDailySummary: Error saving daily summary:', error);
        return false;
    }
}

// Function to load daily summary from file
async function loadDailySummary(date = null, language = 'en', country = 'US') {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        console.log(`loadDailySummary: Loading summary for date: ${targetDate}, language: ${language}, country: ${country}`);
        console.log(`loadDailySummary: Using file path: ${SUMMARY_FILE}`);
        console.log(`loadDailySummary: Current working directory: ${process.cwd()}`);
        console.log(`loadDailySummary: __dirname: ${__dirname}`);
        
        // Check if file exists first
        try {
            await fs.access(SUMMARY_FILE);
            console.log(`loadDailySummary: File exists at ${SUMMARY_FILE}`);
        } catch (error) {
            console.log(`loadDailySummary: File does not exist at ${SUMMARY_FILE}`);
            console.log(`loadDailySummary: Error accessing file: ${error.message}`);
            return null;
        }
        
        // Check if data directory exists
        const dataDir = path.dirname(SUMMARY_FILE);
        try {
            await fs.access(dataDir);
            console.log(`loadDailySummary: Data directory exists at ${dataDir}`);
            
            // List files in data directory
            const files = await fs.readdir(dataDir);
            console.log(`loadDailySummary: Files in data directory: ${files.join(', ')}`);
        } catch (error) {
            console.log(`loadDailySummary: Data directory does not exist at ${dataDir}`);
            console.log(`loadDailySummary: Error accessing data directory: ${error.message}`);
        }
        
        const data = await fs.readFile(SUMMARY_FILE, 'utf8');
        console.log(`loadDailySummary: File read successfully, size: ${data.length} characters`);
        
        const summaries = JSON.parse(data);
        console.log(`loadDailySummary: JSON parsed successfully`);
        console.log(`loadDailySummary: Found summaries for dates: ${Object.keys(summaries).join(', ')}`);
        
        // Look for summary with matching date, language, and country
        const dateSummary = summaries[targetDate];
        if (!dateSummary) {
            console.log(`loadDailySummary: No summary found for date: ${targetDate}`);
            return null;
        }
        
        // If dateSummary is an array, look for matching language/country
        if (Array.isArray(dateSummary)) {
            const matchingSummary = dateSummary.find(summary => 
                summary.language === language && summary.country === country
            );
            console.log(`loadDailySummary: Array format - found matching summary:`, !!matchingSummary);
            return matchingSummary || null;
        }
        
        // If dateSummary is an object, check if it has language/country properties
        if (dateSummary.language && dateSummary.country) {
            // New format with explicit language/country
            if (dateSummary.language === language && dateSummary.country === country) {
                console.log(`loadDailySummary: Object format - found matching summary`);
                return dateSummary;
            }
        } else {
            // Legacy format without language/country - treat as English/US
            if (language === 'en' && country === 'US') {
                console.log(`loadDailySummary: Using legacy summary for en-US (backward compatibility)`);
                return dateSummary;
            }
        }
        
        console.log(`loadDailySummary: No matching summary found for ${targetDate} (${country}, ${language})`);
        return null;
    } catch (error) {
        console.error('loadDailySummary: Error loading daily summary:', error);
        console.error('loadDailySummary: Error details:', error.message);
        console.error('loadDailySummary: Error stack:', error.stack);
        return null;
    }
}

// Initialize daily summary on server start
async function initializeDailySummary() {
    const today = new Date().toISOString().split('T')[0];
    const savedSummary = await loadDailySummary(today, 'en', 'US');
    
    if (savedSummary) {
        dailySummary = savedSummary;
        lastSummaryDate = today;
        // console.log(`Loaded existing daily summary for ${today}`);
    } else {
        // console.log('No existing daily summary found');
    }
}

// Function to clean up malformed summary data
async function cleanupSummaryData() {
    try {
        console.log('cleanupSummaryData: Starting cleanup of malformed summary data...');
        
        const data = await fs.readFile(SUMMARY_FILE, 'utf8');
        const summaries = JSON.parse(data);
        
        let hasChanges = false;
        const cleanedSummaries = {};
        
        for (const [key, value] of Object.entries(summaries)) {
            console.log(`cleanupSummaryData: Processing key: ${key}`);
            
            // Skip invalid keys like "2025" (just year)
            if (key === '2025' || key.length < 8) {
                console.log(`cleanupSummaryData: Skipping invalid key: ${key}`);
                continue;
            }
            
            // Handle the corrupted "2025" key that contains an array
            if (key === '2025' && Array.isArray(value)) {
                console.log(`cleanupSummaryData: Processing corrupted 2025 array with ${value.length} items`);
                
                value.forEach((item, index) => {
                    // Skip nested objects with numeric keys
                    if (typeof item === 'object' && item !== null && Object.keys(item).some(k => !isNaN(k))) {
                        console.log(`cleanupSummaryData: Skipping nested object with numeric keys at index ${index}`);
                        return;
                    }
                    
                    // Extract date from timestamp if available
                    if (item.timestamp) {
                        const date = new Date(item.timestamp).toISOString().split('T')[0];
                        console.log(`cleanupSummaryData: Extracted date ${date} from timestamp`);
                        
                        if (!cleanedSummaries[date]) {
                            cleanedSummaries[date] = [];
                        }
                        
                        // Fix the language/country values (they're corrupted)
                        const fixedItem = {
                            ...item,
                            language: 'en', // Default to English
                            country: 'US'   // Default to US
                        };
                        
                        // Remove duplicate language/country properties
                        delete fixedItem.language;
                        delete fixedItem.country;
                        
                        cleanedSummaries[date].push(fixedItem);
                        hasChanges = true;
                    }
                });
                continue;
            }
            
            // Handle normal date keys
            if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                console.log(`cleanupSummaryData: Valid date key: ${key}`);
                
                if (Array.isArray(value)) {
                    // Remove duplicates and fix any corrupted entries
                    const uniqueSummaries = [];
                    const seen = new Set();
                    
                    value.forEach(summary => {
                        // Skip nested objects with numeric keys
                        if (typeof summary === 'object' && summary !== null && Object.keys(summary).some(k => !isNaN(k))) {
                            console.log(`cleanupSummaryData: Skipping nested object with numeric keys in ${key}`);
                            return;
                        }
                        
                        // Create a unique identifier for deduplication
                        const identifier = `${summary.timestamp}-${summary.language || 'en'}-${summary.country || 'US'}`;
                        
                        if (!seen.has(identifier)) {
                            seen.add(identifier);
                            
                            // Ensure language and country are properly set
                            const fixedSummary = {
                                ...summary,
                                language: summary.language || 'en',
                                country: summary.country || 'US'
                            };
                            
                            uniqueSummaries.push(fixedSummary);
                        }
                    });
                    
                    if (uniqueSummaries.length > 0) {
                        cleanedSummaries[key] = uniqueSummaries;
                        hasChanges = true;
                    }
                } else {
                    // Single object
                    cleanedSummaries[key] = {
                        ...value,
                        language: value.language || 'en',
                        country: value.country || 'US'
                    };
                    hasChanges = true;
                }
            } else {
                console.log(`cleanupSummaryData: Skipping invalid key format: ${key}`);
            }
        }
        
        if (hasChanges) {
            // Save the cleaned data
            await fs.writeFile(SUMMARY_FILE, JSON.stringify(cleanedSummaries, null, 2));
            console.log('cleanupSummaryData: Successfully cleaned up malformed summary data');
        } else {
            console.log('cleanupSummaryData: No malformed data found');
        }
        
        return cleanedSummaries;
    } catch (error) {
        console.error('cleanupSummaryData: Error cleaning up summary data:', error);
        return null;
    }
}

// Call initialization
(async () => {
    // Clean up any malformed summary data first
    await cleanupSummaryData();
    
    // Then initialize daily summary
    await initializeDailySummary();
})();

// Automated Summary Generation System
class AutomatedSummaryGenerator {
    constructor() {
        this.isGenerating = false;
        this.lastGenerationDate = null;
        // Only generate for en-US, once per day
        this.region = { language: 'en', country: 'US', timezone: 'America/New_York' };
    }

    // Initialize the automated summary generation
    init() {
        // Schedule for 11:00 PM EST every day
        // '0 23 * * *' = At 23:00 (11:00 PM) every day
        cron.schedule('0 23 * * *', () => {
            console.log('Initializing automated summary generation...');
            this.generateDailySummary();
        }, {
            timezone: 'America/New_York'
        });

        // === TESTING ONLY: Run 1 minute after server starts ===
        setTimeout(() => {
            console.log('TEST: Triggering automated summary generation 3 minute after startup');
            this.generateDailySummary();
        }, 60 * 3000);

    }

    // Generate summary for en-US at 11:00PM EDT (America/New_York)
    async generateDailySummary() {
        if (this.isGenerating) {
            console.log('Summary generation already in progress, skipping...');
            return;
        }

        // Always use current date in America/New_York (EDT/EST) for summary date
        const now = new Date();
        const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayEDT = nyDate.toISOString().split('T')[0];

        // Prevent multiple generations on the same EDT day
        if (this.lastGenerationDate === todayEDT) {
            console.log('Summary already generated today (EDT), skipping...');
            return;
        }

        try {
            this.isGenerating = true;
            console.log(`Starting automated summary generation for ${todayEDT} (EDT)`);

            await this.generateSummaryForRegion(this.region, todayEDT);

            this.lastGenerationDate = todayEDT;
            console.log('Automated summary generation completed');

        } catch (error) {
            console.error('Error in automated summary generation:', error);
        } finally {
            this.isGenerating = false;
        }
    }

    // Generate summary for en-US only
    async generateSummaryForRegion(region, date) {
        try {
            console.log(`Generating summary for ${region.country} (${region.language}) on ${date} (EDT)`);

            // Check if summary already exists for this region and date
            const existingSummary = await loadDailySummary(date, region.language, region.country);
            if (existingSummary) {
                console.log(`Summary already exists for ${region.country} (${region.language}) on ${date} (EDT), skipping...`);
                return;
            }

            // Collect section data (same as manual generation)
            const sectionData = await this.collectAutomatedSectionData(region);

            if (!sectionData || (!sectionData.news && !sectionData.trends && !sectionData.finance)) {
                console.log(`No data available for ${region.country} (${region.language}), skipping summary generation`);
                return;
            }
            // second check for sectionData
            if (!sectionData) {
                console.log(`No section data available for ${region.country} (${region.language}), skipping...`);
                return;
            }

            // Generate AI summary
            const summaryText = await this.generateAutomatedSummary(sectionData);

            if (summaryText && !summaryText.includes('Error:') && !summaryText.includes('Unable to generate')) {
                // Parse and save the summary
                const sections = this.parseAutomatedSummarySections(summaryText);

                // Use generatedAt in EDT as well
                const now = new Date();
                const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
                const generatedAtEDT = nyDate.toISOString();

                const summaryData = {
                    news: sections.news || '',
                    trends: sections.trends || '',
                    finance: sections.finance || '',
                    overall: sections.insights || '',
                    generatedAt: generatedAtEDT,
                    automated: true
                };

                // Save the summary
                const saved = await saveDailySummary(summaryData, date, region.language, region.country);

                if (saved) {
                    console.log(`✅ Automated summary saved for ${region.country} (${region.language})`);
                } else {
                    console.log(`❌ Failed to save automated summary for ${region.country} (${region.language})`);
                }
            } else {
                console.log(`❌ Failed to generate valid summary for ${region.country} (${region.language})`);
            }

        } catch (error) {
            console.error(`Error generating summary for ${region.country} (${region.language}):`, error);
        }
    }

    // Collect section data for automated generation
    async collectAutomatedSectionData(region) {
        const data = {
            news: null,
            trends: null,
            finance: null
        };

        try {
            // Collect news data
            data.news = await this.collectAutomatedNewsData(region);
            
            // Collect trends data
            data.trends = await this.collectAutomatedTrendsData(region);
            
            // Collect finance data (same for all regions)
            data.finance = await this.collectAutomatedFinanceData();

            return data;
        } catch (error) {
            console.error('Error collecting automated section data:', error);
            return null;
        }
    }

    // Collect news data for automated generation
    async collectAutomatedNewsData(region) {
        try {
            const baseUrl = process.env.NODE_ENV === 'production' ? 'https://infodash.app' : `http://localhost:${port}`;
            const response = await fetch(`${baseUrl}/api/news?country=${region.country}&language=${region.language}&category=general&pageSize=5`);
            
            if (!response.ok) return null;
            
            const data = await response.json();
            
            if (!data || !data.articles || data.articles.length === 0) return null;

            return data.articles.slice(0, 5).map(article => ({
                title: article.title || 'Unknown',
                description: article.description || '',
                source: article.source?.name || article.author || ''
            }));
        } catch (error) {
            console.error('Error collecting automated news data:', error);
            return null;
        }
    }

    // Collect trends data for automated generation
    async collectAutomatedTrendsData(region) {
        try {
            const baseUrl = process.env.NODE_ENV === 'production' ? 'https://infodash.app' : `http://localhost:${port}`;
            const response = await fetch(`${baseUrl}/api/trends2?type=daily&category=all&language=${region.language}&geo=${region.country}`);
            
            if (!response.ok) return null;
            
            const data = await response.json();
            
            if (!data || !data.default || !data.default.trendingSearchesDays) return null;

            let allTopics = [];
            const trendingSearchesDays = data.default.trendingSearchesDays || [];
            
            trendingSearchesDays.forEach(day => {
                if (day.trendingSearches) {
                    allTopics = allTopics.concat(day.trendingSearches);
                }
            });

            return allTopics.slice(0, 25).map(topic => ({
                title: topic.title?.query || topic.title || 'Unknown',
                traffic: topic.formattedTraffic || 'N/A'
            }));
        } catch (error) {
            console.error('Error collecting automated trends data:', error);
            return null;
        }
    }

    // Collect finance data for automated generation
    async collectAutomatedFinanceData() {
        try {
            // Use the bulk finance endpoint for better performance
            const symbols = ['^IXIC', 'META', 'AAPL', 'GOOGL', 'AMZN', 'TSLA', 'BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD'];
            
            const baseUrl = process.env.NODE_ENV === 'production' ? 'https://infodash.app' : `http://localhost:${port}`;
            const response = await fetch(`${baseUrl}/api/finance/bulk-real-time`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });

            if (!response.ok) return null;
            
            const data = await response.json();
            
            const financeData = {
                nasdaq: null,
                techStocks: {},
                crypto: {}
            };

            // Process the bulk response
            for (const [symbol, stockData] of Object.entries(data)) {
                if (stockData.error) continue;

                const processedData = {
                    price: stockData.price?.toFixed(2) || 'N/A',
                    change: stockData.change?.toFixed(2) || 'N/A',
                    changePercent: stockData.changePercent?.toFixed(2) || 'N/A',
                    timeframe: 'Current'
                };

                if (symbol === '^IXIC') {
                    financeData.nasdaq = processedData;
                } else if (symbol.endsWith('-USD')) {
                    financeData.crypto[symbol] = processedData;
                } else {
                    financeData.techStocks[symbol] = processedData;
                }
            }

            return financeData;
        } catch (error) {
            console.error('Error collecting automated finance data:', error);
            return null;
        }
    }

    // Generate AI summary for automated generation, with retry logic
    async generateAutomatedSummary(sectionData) {
        const analysisPrompt = this.createAutomatedAnalysisPrompt(sectionData);
        const selectedModel = 'deepseek/deepseek-chat-v3-0324:free';
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await openai.chat.completions.create({
                    model: selectedModel,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a data analyst specializing in creating clear, concise summaries of current news, trends, and market data.
                            CRITICAL INSTRUCTIONS:
                            - Only report the specific data provided. Do not infer, speculate, or add context from outside knowledge.
                            - Act as a market predictor and future current events predictor (except for Info Genie section).
                            - For percentage changes: positive = "up/gaining/rose", negative = "down/declining/fell"
                            - Use "slight movement" for changes between -1% and +1%
                            - Use dramatic terms like "surged/plunged" only for changes > ±10%
                            - Refer to performance as "today's trading" or "current session"
                            - Maintain professional, neutral, fact-based tone.`
                        },
                        {
                            role: 'user',
                            content: analysisPrompt
                        }
                    ],
                    max_tokens: 5000
                });

                if (!response?.choices?.[0]?.message?.content) {
                    console.error(`AI did not return any content (attempt ${attempt})`, response);
                    lastError = new Error('AI did not return any content');
                    // Try again if not last attempt
                    continue;
                }
                
                return response.choices[0].message.content;
            } catch (error) {
                lastError = error;
                console.error(`Error generating automated summary (attempt ${attempt}):`, error);
                // Wait a bit before retrying, except after last attempt
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        // If we get here, all attempts failed
        return null;
    }

    // Create analysis prompt for automated generation
    createAutomatedAnalysisPrompt(sectionData) {
        let prompt = 'Please analyze the following current data and provide a comprehensive summary:';
        
        const selectedDate = new Date();
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
            prompt += ' Group the top trending topics by category (Sports, Technology, Entertainment, Other). Under each category, list relevant topics.';
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
                prompt += ` NASDAQ (^IXIC): $${sectionData.finance.nasdaq.price} (${sectionData.finance.nasdaq.changePercent}%)`;
            }
            if (sectionData.finance.techStocks && !isWeekend) {
                Object.entries(sectionData.finance.techStocks).forEach(([symbol, data]) => {
                    prompt += ` ${symbol}: $${data.price} (${data.changePercent}%)`;
                });
            }
            if (sectionData.finance.crypto) {
                Object.entries(sectionData.finance.crypto).forEach(([symbol, data]) => {
                    prompt += ` ${symbol}: $${data.price} (${data.changePercent}%)`;
                });
            }
        }
        
        prompt += ' Please provide a structured summary with the following sections: NEWS HIGHLIGHTS (max 300 words), TRENDING TOPICS (max 300 words), ';
        prompt += isWeekend ? 'MARKET OVERVIEW focusing on crypto (max 300 words), ' : 'MARKET OVERVIEW including tech stocks and crypto (max 300 words), ';
        prompt += 'INFO GENIE fortune teller predictions (max 300 words).';
        
        return prompt;
    }

    // Parse summary sections for automated generation
    parseAutomatedSummarySections(summaryText) {
        const sections = {};
        
        const newsMatch = summaryText.match(/(?:\*\*NEWS HIGHLIGHTS\*\*|NEWS HIGHLIGHTS:?)(.*?)(?=\*\*TRENDING TOPICS\*\*|TRENDING TOPICS:?|---)/s);
        if (newsMatch) sections.news = newsMatch[1].trim();
        
        const trendsMatch = summaryText.match(/(?:\*\*TRENDING TOPICS\*\*|TRENDING TOPICS:?)(.*?)(?=\*\*MARKET OVERVIEW\*\*|MARKET OVERVIEW:?|---)/s);
        if (trendsMatch) sections.trends = trendsMatch[1].trim();
        
        const financeMatch = summaryText.match(/(?:\*\*MARKET OVERVIEW\*\*|MARKET OVERVIEW:?)(.*?)(?=\*\*INFO GENIE\*\*|INFO GENIE:?|---)/s);
        if (financeMatch) sections.finance = financeMatch[1].trim();
        
        const insightsMatch = summaryText.match(/(?:\*\*INFO GENIE\*\*|INFO GENIE:?)(.*?)$/s);
        if (insightsMatch) sections.insights = insightsMatch[1].trim();
        
        return sections;
    }

    // Manual trigger for testing
    async triggerManualGeneration() {
        console.log('Manual trigger for automated summary generation');
        await this.generateDailySummary();
    }

    // Check generation status
    getStatus() {
        return {
            isGenerating: this.isGenerating,
            lastGenerationDate: this.lastGenerationDate,
            configuredRegions: this.region,
        };
    }
}

// Create global instance
const summaryGenerator = new AutomatedSummaryGenerator();

// Initialize when server starts
summaryGenerator.init();

// Add API endpoint to manually trigger generation (for testing)
app.post('/api/summary/trigger-automated', async (req, res) => {
    try {
        if (summaryGenerator.isGenerating) {
            return res.json({
                success: false,
                message: 'Automated generation already in progress'
            });
        }

        // Trigger generation in background
        summaryGenerator.triggerManualGeneration();
        
        res.json({
            success: true,
            message: 'Automated summary generation triggered'
        });
    } catch (error) {
        console.error('Error triggering automated generation:', error);
        res.status(500).json({
            success: false,
            message: 'Error triggering automated generation'
        });
    }
});

// Add API endpoint to check generation status
app.get('/api/summary/automation-status', (req, res) => {
    const status = summaryGenerator.getStatus();
    res.json({
        success: true,
        ...status
    });
});

module.exports = { summaryGenerator };

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

// Basic route to serve summary.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'news.html'));
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
    // NewsAPI top-headlines only supports English language
    // For non-English languages, always use everything endpoint
    let newsUrl;
    if (category && language === 'en') {
        // Use top-headlines for English with category
        newsUrl = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&apiKey=${newsApiKey}`;
    } else {
        // Use everything endpoint for non-English languages or when no category specified
        const searchQuery = category ? category : query;
        newsUrl = `https://newsapi.org/v2/everything?q=${searchQuery}&language=${language}&sortBy=popularity${from ? `&from=${from}` : ''}&apiKey=${newsApiKey}`;
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
        console.error('Error response status:', error.response?.status);
        console.error('Error response data:', error.response?.data);
        console.error('Error message:', error.message);
        
        // Check if it's a rate limit error
        if (error.response && error.response.status === 429) {
            console.log('News API rate limit reached, checking for cached data...');
            
            // Try to load any cached data, even if stale
            const fileCache = await loadNewsCache();
            if (fileCache[cacheKey]) {
                console.log(`Using stale cached data for: ${cacheKey}`);
                return res.json({
                    ...fileCache[cacheKey].data,
                    _cached: true,
                    _stale: isCacheStale(fileCache[cacheKey].timestamp),
                    _message: 'Rate limit reached, showing cached data'
                });
            } else {
                console.log('No cached data available for rate limited request');
                return res.status(429).json({ 
                    error: 'News API rate limit reached and no cached data available',
                    message: 'Please try again later or upgrade your API plan'
                });
            }
        }
        
        // Check if it's an API key error
        if (error.response && error.response.status === 401) {
            console.log('News API key error, checking for cached data...');
            
            const fileCache = await loadNewsCache();
            if (fileCache[cacheKey]) {
                console.log(`Using cached data due to API key error for: ${cacheKey}`);
                return res.json({
                    ...fileCache[cacheKey].data,
                    _cached: true,
                    _message: 'API key error, showing cached data'
                });
            } else {
                console.log('No cached data available for API key error');
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

// Helper function for retrying OpenRouter API calls with delay
async function callOpenRouterWithRetry(options, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await openai.chat.completions.create(options);
        } catch (error) {
            if (attempt === retries) throw error;
            // Only retry on network errors
            if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw error;
            // Wait with exponential backoff
            await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
        }
    }
}

app.post('/api/chat', async (req, res) => {
    // LLM readiness check (customize as needed)
    if (!process.env.DEEPSEEK_API_KEY) {
        return res.status(503).json({
            type: "https://infodash.app/errors/llm-not-ready",
            title: "LLM Not Ready",
            status: 503,
            detail: "The language model is still starting up or not configured. Please try again in a moment."
        });
    }
    try {
        // console.log('Chat API: Received request');
        const { messages, model = 'deepseek/deepseek-r1:free' } = req.body;
        
        // console.log('Chat API: Request body parsed, model:', model);
        // console.log('Chat API: Messages count:', messages?.length || 0);
        
        if (!messages || messages.length === 0) {
            // console.log('Chat API: No messages provided');
            return res.status(400).json({ error: 'Messages are required' });
        }

        // Use retry logic for OpenRouter API call
        const response = await callOpenRouterWithRetry({
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

        // Use DuckDuckGo Instant Answer API
        const ddgUrl = `https://api.duckduckgo.com/?q=${(query)}&format=json`;
        const ddgResponse = await fetch(ddgUrl);
        if (!ddgResponse.ok) {
            return res.json({ result: null });
        }
        const ddgData = await ddgResponse.json();
        let rawResult = null;
        if (ddgData.AbstractText) {
            rawResult = ddgData.AbstractText;
        } else if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
            const topic = ddgData.RelatedTopics[0];
            rawResult = topic.Text || topic.Name || null;
        } else if (ddgData.Results && ddgData.Results.length > 0) {
            rawResult = ddgData.Results[0].Text || null;
        }
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

// Reddit API proxy endpoint
app.get('/api/reddit/top', async (req, res) => {
    const timePeriod = req.query.timePeriod || 'day';
    
    try {
        const redditUrl = `https://www.reddit.com/r/all/top.json?t=${timePeriod}&limit=25`;
        const response = await fetch(redditUrl);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching Reddit data:', error);
        res.status(500).json({ error: 'Error fetching Reddit data' });
    }
});


// Daily Summary API endpoints
app.post('/api/summary/save', async (req, res) => {
    try {
        // console.log('Received summary save request');
        // console.log('Request body:', req.body);
        
        const { news, trends, finance, overall, date, language, country } = req.body;
        
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        // Use default values if not provided
        const targetLanguage = language || 'en';
        const targetCountry = country || 'US';

        // Determine if the date is today
        const today = new Date().toISOString().split('T')[0];
        
        // Only block overwriting for past dates
        // Convert both dates to Date objects and compare ISO strings to ensure same format
        const dateObj = new Date(date);
        const todayObj = new Date(today);
        if (dateObj.toISOString().split('T')[0] !== todayObj.toISOString().split('T')[0]) {
            const existingSummary = await loadDailySummary(date, targetLanguage, targetCountry);
            if (existingSummary) {
                // console.log(`Daily summary already exists for ${date} (${targetCountry}, ${targetLanguage})`);
                return res.json({ 
                    success: false, 
                    message: `Daily summary already exists for ${date} (${targetCountry}, ${targetLanguage})`,
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
        const saved = await saveDailySummary(summaryData, date, targetLanguage, targetCountry);
        
        if (saved) {
            // console.log(`Summary saved successfully for ${date} (${targetCountry}, ${targetLanguage})`);
            res.json({ 
                success: true, 
                message: `Daily summary saved successfully for ${targetCountry} (${targetLanguage})`,
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
        const { date, language, country } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const targetLanguage = language || 'en';
        const targetCountry = country || 'US';
        
        console.log(`/api/summary/daily: Request received for date: ${targetDate}, language: ${targetLanguage}, country: ${targetCountry}`);
        console.log(`/api/summary/daily: Query parameters:`, req.query);
        
        const summary = await loadDailySummary(targetDate, targetLanguage, targetCountry);
        
        console.log(`/api/summary/daily: loadDailySummary returned:`, !!summary);
        
        if (summary) {
            console.log(`/api/summary/daily: Sending success response with summary data`);
            res.json({ 
                success: true, 
                summary,
                date: targetDate,
                language: targetLanguage,
                country: targetCountry
            });
        } else {
            console.log(`/api/summary/daily: Sending failure response - no summary found`);
            res.json({ 
                success: false, 
                message: `No summary found for ${targetDate} (${targetCountry}, ${targetLanguage})`,
                date: targetDate,
                language: targetLanguage,
                country: targetCountry
            });
        }
    } catch (error) {
        console.error('/api/summary/daily: Error retrieving daily summary:', error);
        console.error('/api/summary/daily: Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving summary' 
        });
    }
});

app.get('/api/summary/history', async (req, res) => {
    try {
        console.log(`summary/history: Using file path: ${SUMMARY_FILE}`);
        
        try {
            const data = await fs.readFile(SUMMARY_FILE, 'utf8');
            const summaries = JSON.parse(data);
            console.log(`summary/history: Loaded summaries object with keys:`, Object.keys(summaries));
            
            // Convert to array format for easier frontend consumption
            const summaryArray = [];
            
            Object.entries(summaries).forEach(([date, summary]) => {
                // Skip malformed keys that contain language/country info (should have more than 3 parts when split by '-')
                if (date.includes('-') && date.split('-').length > 3) {
                    console.log(`summary/history: Skipping malformed date key: ${date}`);
                    return;
                }
                
                // Validate date format
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    console.log(`summary/history: Skipping invalid date format: ${date}`);
                    return;
                }
                
                // Handle both array format (new) and object format (legacy)
                if (Array.isArray(summary)) {
                    // New format: array of summaries with different languages/countries
                    summary.forEach(singleSummary => {
                        summaryArray.push({
                            date,
                            timestamp: singleSummary.timestamp,
                            marketClosed: singleSummary.marketClosed,
                            language: singleSummary.language || 'en',
                            country: singleSummary.country || 'US',
                            hasData: !!(singleSummary.news || singleSummary.trends || singleSummary.finance || singleSummary.overall)
                        });
                    });
                } else {
                    // Legacy format: single object without explicit language/country
                    summaryArray.push({
                        date,
                        timestamp: summary.timestamp,
                        marketClosed: summary.marketClosed,
                        language: summary.language || 'en',
                        country: summary.country || 'US',
                        hasData: !!(summary.news || summary.trends || summary.finance || summary.overall)
                    });
                }
            });
            
            // Sort by date (newest first)
            summaryArray.sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json({ 
                success: true, 
                summaries: summaryArray
            });
        } catch (error) {
            // File doesn't exist
            console.log('summary/history: No summary file found, returning empty array');
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

// Get historical data for a symbol using chart() method instead of historical()
app.get('/api/finance/history/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { period = '1mo', interval = '1d' } = req.query;

    try {
        //console.log(`Fetching historical data for ${symbol} with period: ${period}, interval: ${interval}`);

        // Use chart() method with proper options instead of historical()
        const chartData = await yahooFinance.chart(symbol, {
            period1: getPeriodDate(period), // Calculate start date based on period
            period2: new Date(), // End date is today
            interval: interval,
            includeAdjustedClose: false
        });

        // Extract the historical data from chart response
        if (!chartData || !chartData.quotes || chartData.quotes.length === 0) {
            console.log(`No historical data found for ${symbol}`);
            return res.json({
                success: false,
                error: 'No historical data available for this symbol',
                data: []
            });
        }

        // Transform the chart data to match the expected format
        const historicalData = chartData.quotes.map(quote => ({
            date: quote.date,
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            volume: quote.volume
        })).filter(item => {
            // Filter out invalid entries where all values are null
            return item.open !== null || item.high !== null || 
                   item.low !== null || item.close !== null;
        });

        //console.log(`Successfully fetched ${historicalData.length} data points for ${symbol}`);

        res.json({
            success: true,
            data: historicalData,
            symbol: symbol,
            period: period,
            interval: interval
        });

    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        
        // Provide more specific error messages based on the error type
        let errorMessage = 'Failed to fetch historical data';
        if (error.message && error.message.includes('Not Found')) {
            errorMessage = 'Symbol not found';
        } else if (error.message && error.message.includes('rate limit')) {
            errorMessage = 'Rate limit exceeded, please try again later';
        }

        res.status(500).json({ 
            success: false, 
            error: errorMessage,
            details: error.message 
        });
    }
});

// Helper function to calculate start date based on period string
function getPeriodDate(period) {
    const now = new Date();
    const date = new Date(now);
    
    switch (period) {
        case '1d':
            date.setDate(date.getDate() - 1);
            break;
        case '5d':
            date.setDate(date.getDate() - 5);
            break;
        case '1mo':
            date.setMonth(date.getMonth() - 1);
            break;
        case '3mo':
            date.setMonth(date.getMonth() - 3);
            break;
        case '6mo':
            date.setMonth(date.getMonth() - 6);
            break;
        case '1y':
            date.setFullYear(date.getFullYear() - 1);
            break;
        case '2y':
            date.setFullYear(date.getFullYear() - 2);
            break;
        case '5y':
            date.setFullYear(date.getFullYear() - 5);
            break;
        case '10y':
            date.setFullYear(date.getFullYear() - 10);
            break;
        case 'ytd':
            // Year to date
            date.setMonth(0);
            date.setDate(1);
            break;
        case 'max':
            // Maximum available data (go back 20 years as a reasonable limit)
            date.setFullYear(date.getFullYear() - 20);
            break;
        default:
            // Default to 1 month if period is not recognized
            date.setMonth(date.getMonth() - 1);
            break;
    }
    
    return date;
}
// Get market summary (major indices)
app.get('/api/finance/market-summary', async (req, res) => {
    const majorIndices = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX'];
    
    try {
        const results = {};
        const promises = majorIndices.map(async (symbol) => {
            try {
                const quote = await yahooFinance.quote(symbol);
                if (quote) {
                    const name = {
                        '^GSPC': 'S&P 500',
                        '^DJI': 'Dow Jones',
                        '^IXIC': 'NASDAQ',
                        '^RUT': 'Russell 2000',
                        '^VIX': 'VIX'
                    }[symbol] || symbol;
                    
                    results[symbol] = {
                        name,
                        price: quote.regularMarketPrice,
                        change: quote.regularMarketChange,
                        changePercent: quote.regularMarketChangePercent
                    };
                }
            } catch (error) {
                console.error(`Error fetching ${symbol}:`, error);
            }
        });
        
        await Promise.all(promises);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching market summary:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch market summary' });
    }
});


// Geolocation endpoint to detect user's location from IP
app.get('/api/geolocation', (req, res) => {
    try {
        // Get client IP address
        const clientIP = req.ip || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress || 
                        req.connection.socket?.remoteAddress ||
                        req.headers['x-forwarded-for']?.split(',')[0] ||
                        req.headers['x-real-ip'] ||
                        '127.0.0.1';
        
        console.log(`Geolocation request from IP: ${clientIP}`);
        
        // Use geoip-lite to get location data
        const geo = geoip.lookup(clientIP);
        
        if (!geo) {
            console.log('No geolocation data found, using defaults');
            return res.json({
                success: false,
                message: 'Unable to detect location',
                suggestedCountry: 'US',
                suggestedLanguage: 'en',
                city: null,
                region: null
            });
        }
        
        console.log('Geolocation data:', geo);
        
        // Extract country and region info
        const country = geo.country || 'US';
        const region = geo.region || null;
        const city = geo.city || null;
        
        // Determine suggested language based on country
        let suggestedLanguage = 'en'; // default
        
        // Map countries to languages (using the same mapping as frontend)
        const countryToLanguage = {
            'US': 'en', 'CA': 'en', 'GB': 'en', 'AU': 'en', 'NZ': 'en', 'IE': 'en',
            'ES': 'es', 'MX': 'es', 'AR': 'es', 'CL': 'es', 'CO': 'es', 'PE': 'es',
            'FR': 'fr', 'DE': 'de', 'AT': 'de', 'CH': 'de', 'IT': 'it', 'PT': 'pt',
            'BR': 'pt', 'RU': 'ru', 'JP': 'jp', 'KR': 'ko', 'CN': 'zh', 'AR': 'ar',
            'SA': 'ar', 'EG': 'ar', 'IN': 'hi', 'NL': 'nl', 'SE': 'sv', 'NO': 'no',
            'FI': 'fi', 'DK': 'da', 'PL': 'pl', 'CZ': 'cs', 'HU': 'hu', 'GR': 'el',
            'TR': 'tr', 'TH': 'th', 'VN': 'vi', 'ID': 'id', 'MY': 'ms', 'PH': 'tl',
            'ZA': 'af', 'IL': 'he', 'IR': 'fa', 'BD': 'bn', 'NP': 'ne', 'UA': 'uk',
            'AZ': 'az', 'GE': 'ka', 'RO': 'ro', 'RS': 'sr', 'MK': 'mk', 'SI': 'sl',
            'SK': 'sk', 'EE': 'et', 'IS': 'is'
        };
        
        suggestedLanguage = countryToLanguage[country] || 'en';
        
        res.json({
            success: true,
            ip: clientIP,
            country: country,
            region: region,
            city: city,
            suggestedCountry: country,
            suggestedLanguage: suggestedLanguage,
            timezone: geo.timezone || null
        });
        
    } catch (error) {
        console.error('Error in geolocation endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Error detecting location',
            suggestedCountry: 'US',
            suggestedLanguage: 'en',
            city: null,
            region: null
        });
    }
});

// Catch-all route for undefined routes
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, () => {
    // console.log(`Server is running on port ${port}`);
});