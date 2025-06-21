// summary.js - Handles the summary section functionality

let summaryData = {
    news: null,
    trends: null,
    finance: null
};

let summaryGenerated = false;

// Function to get a YYYY-MM-DD string from a Date object in local time
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to get selected date or today's date
function getSelectedDate() {
    const dateInput = document.getElementById('summaryDate');
    return dateInput && dateInput.value ? dateInput.value : getLocalDateString();
}

// Function to collect data from all sections
async function collectSectionData() {
    // console.log('Starting to collect section data...');
    
    const data = {
        news: collectNewsData(),
        trends: await collectTrendsData(),
        finance: await collectFinanceData()
    };
    
    // console.log('Section data collection completed:', {
    //     hasNews: !!data.news,
    //     hasTrends: !!data.trends,
    //     hasFinance: !!data.finance
    // });
    
    // console.log('Collected section data:', data);
    return data;
}

// Function to collect news data
function collectNewsData() {
    // console.log('Collecting news data...');
    const newsContainer = document.querySelector('#news .data-container');
    // console.log('News container found:', !!newsContainer);
    
    if (!newsContainer) {
        // console.log('No news container found');
        return null;
    }
    
    const newsItems = newsContainer.querySelectorAll('li');
    // console.log('News items found:', newsItems.length);
    
    if (newsItems.length === 0) {
        // console.log('No news items found');
        return null;
    }
    
    const newsData = [];
    newsItems.forEach((item, index) => {
        if (index < 5) { // Limit to top 5 news items
            const title = item.querySelector('h3')?.textContent?.trim();
            const description = item.querySelector('.article-text')?.textContent?.trim();
            const source = item.querySelector('.article-descriptor')?.textContent?.trim();
            
            // console.log(`News item ${index}:`, { title, description: description?.substring(0, 50), source });
            
            if (title) {
                newsData.push({
                    title,
                    description: description || '',
                    source: source || ''
                });
            }
        }
    });
    
    // console.log('News data collected:', newsData.length, 'items');
    // console.log('Processed news data:', newsData);
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
    // console.log('Collecting finance data...');
    
    const financeData = {
        nasdaq: null,
        techStocks: {},
        crypto: {}
    };
    
    try {
        // Fetch NASDAQ data
        // console.log('Fetching NASDAQ data...');
        const nasdaqResponse = await fetch('/api/finance/^IXIC?range=1d&interval=1m');
        if (nasdaqResponse.ok) {
            const nasdaqData = await nasdaqResponse.json();
            // console.log('NASDAQ data received');
            if (nasdaqData.chart && nasdaqData.chart.result && nasdaqData.chart.result[0]) {
                const result = nasdaqData.chart.result[0];
                const meta = result.meta;
                // console.log('NASDAQ meta data processed');
                
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
                // console.log('NASDAQ data collected');
            } else {
                // console.log('NASDAQ data structure invalid');
            }
        } else {
            // console.log('NASDAQ response not ok:', nasdaqResponse.status);
        }
        
        // Fetch tech stocks data
        const techStocks = ['META', 'AAPL', 'GOOGL', 'AMZN', 'TSLA'];
        // console.log('Fetching tech stocks data...');
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
                    }
                }
            } catch (error) {
                // console.log(`Error fetching ${symbol} data:`, error);
            }
        }
        
        // Fetch crypto data
        const cryptoStocks = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD'];
        // console.log('Fetching crypto data...');
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
                    }
                }
            } catch (error) {
                // console.log(`Error fetching ${symbol} data:`, error);
            }
        }
        
        // console.log('Finance data collected:', {
        //     hasNasdaq: !!financeData.nasdaq,
        //     techStocksCount: Object.keys(financeData.techStocks).length,
        //     cryptoCount: Object.keys(financeData.crypto).length
        // });
        
        return financeData;
        
    } catch (error) {
        console.error('Error collecting finance data:', error);
        return null;
    }
}

// Function to generate summary using AI
async function generateSummary(sectionData) {
    try {
        // console.log('generateSummary: Starting AI generation...');
        // console.log('Generating summary with data:', sectionData);
        
        const selectedModel = document.getElementById('model-select')?.value || 'deepseek/deepseek-r1:free';
        // console.log('generateSummary: Using model:', selectedModel);
        
        // Prepare the data for AI analysis
        const analysisPrompt = createAnalysisPrompt(sectionData);
        // console.log('generateSummary: Analysis prompt created, length:', analysisPrompt.length);
        // console.log('Analysis prompt:', analysisPrompt);
        
        // console.log('generateSummary: Making API call to /api/chat...');
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a data analyst specializing in creating concise, informative summaries of current events, trends, and market data. CRITICAL INSTRUCTIONS: 1) Only report the exact data provided to you. 2) Do not make assumptions about market movements, trends, or sentiment. 3) If the data shows a negative percentage change, report it as "declining", "down", or "fell". 4) If it shows a positive percentage change, report it as "gaining", "up", or "rose". 5) For small changes (less than 1%), use "minimal change" or "slight movement". 6) NEVER use dramatic terms like "surged", "plunged", "soared", "crashed", "exploded", or "collapsed" unless the percentage change is substantial (more than 10%). 7) Always base your analysis on the factual data provided, not on general market knowledge or assumptions. 8) If you see cryptocurrency data, do not assume it represents a "surge" or positive movement unless the percentage data explicitly shows positive values. 9) The market data provided represents CURRENT TRADING DAY performance (open-to-close or latest), so describe them as "today\'s trading" or "current session".'
                    },
                    {
                        role: 'user',
                        content: analysisPrompt
                    }
                ],
                model: selectedModel
            }),
        });
        
        // console.log('generateSummary: API response received, status:', response.status);
        // console.log('API response status:', response.status);
        
        if (!response.ok) {
            console.error('generateSummary: API response not ok:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // console.log('generateSummary: Parsing JSON response...');
        const data = await response.json();
        // console.log('generateSummary: JSON parsed successfully');
        // console.log('API response data:', data);
        
        const result = data.reply || 'Unable to generate summary at this time.';
        // console.log('generateSummary: Returning result, length:', result.length);
        return result;
        
    } catch (error) {
        console.error('generateSummary: Error in AI generation:', error);
        console.error('generateSummary: Error details:', {
            message: error.message,
            stack: error.stack
        });
        return 'Error: Unable to generate summary. Please try again later.';
    }
}

// Function to create analysis prompt
function createAnalysisPrompt(sectionData) {
    let prompt = 'Please analyze the following current data and provide a comprehensive summary:\n\n';
    const selectedDate = new Date(getSelectedDate() + 'T00:00:00'); // Use selected date to check for weekend
    const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

    if (sectionData.news && sectionData.news.length > 0) {
        prompt += '📰 TOP HEADLINES:\n';
        sectionData.news.forEach((item, index) => {
            prompt += `${index + 1}. ${item.title}\n`;
            if (item.description) {
                prompt += `   ${item.description.substring(0, 100)}...\n`;
            }
        });
        prompt += '\n';
    }
    
    if (sectionData.trends && sectionData.trends.length > 0) {
        prompt += '🔥 TRENDING TOPICS:\n';
        sectionData.trends.forEach((item, index) => {
            prompt += `${index + 1}. ${item.title} ${item.traffic ? `(${item.traffic})` : ''}\n`;
        });
        prompt += '\n';
    }
    
    if (sectionData.finance) {
        prompt += '📈 MARKET DATA:\n';
        if (isWeekend) {
            prompt += 'Stock markets are closed for the weekend. Here is the latest crypto data:\n';
        }

        if (sectionData.finance.nasdaq && !isWeekend) {
            const timeframe = sectionData.finance.nasdaq.timeframe || 'Today';
            prompt += `NASDAQ (^IXIC): $${sectionData.finance.nasdaq.price} (${sectionData.finance.nasdaq.changePercent}% ${timeframe})\n`;
        }
        if (sectionData.finance.techStocks && !isWeekend) {
            Object.entries(sectionData.finance.techStocks).forEach(([symbol, data]) => {
                const timeframe = data.timeframe || 'Today';
                prompt += `${symbol}: $${data.price} (${data.changePercent}% ${timeframe})\n`;
            });
        }
        if (sectionData.finance.crypto) {
            Object.entries(sectionData.finance.crypto).forEach(([symbol, data]) => {
                const timeframe = data.timeframe || 'Today';
                prompt += `${symbol}: $${data.price} (${data.changePercent}% ${timeframe})\n`;
            });
        }
        prompt += '\n';
    }
    
    prompt += `Please provide a structured summary with the following sections (use plain text format, not markdown):

1. NEWS HIGHLIGHTS: Summarize the key news stories and their significance
2. TRENDING TOPICS: Highlight the top 25 most important trending topics and their context  
`;

    if (isWeekend) {
        prompt += `3. MARKET OVERVIEW: Provide insights on cryptocurrency performance. Note that traditional stock markets are closed.
4. KEY INSIGHTS: Overall analysis and what users should pay attention to`;
    } else {
        prompt += `3. MARKET OVERVIEW: Provide insights on today's trading session including tech stocks and crypto performance
4. KEY INSIGHTS: Overall analysis and what users should pay attention to`;
    }

    prompt += `

Keep each section concise (2-3 sentences) and focus on the most important information. Use a professional but accessible tone. Format each section with the exact headers shown above (e.g., "1. NEWS HIGHLIGHTS:"). Avoid numbered lists within sections and use proper grammar and punctuation. For trending topics, mention at least the top 25 trends. For market overview, focus on today's trading session performance for both traditional tech stocks and cryptocurrency movements.`;

    return prompt;
}

// Function to update summary display
function updateSummaryDisplay(summaryText) {
    // console.log('Updating summary display with:', summaryText);
    
    // Debug: Check if summary elements exist
    const newsSummary = document.querySelector('.news-summary .summary-text');
    const trendsSummary = document.querySelector('.trends-summary .summary-text');
    const financeSummary = document.querySelector('.finance-summary .summary-text');
    const overallSummary = document.querySelector('.overall-summary .summary-text');
    const summaryContentDiv = document.querySelector('.summary-content');
    
    // console.log('Summary elements found:', {
    //     newsSummary: !!newsSummary,
    //     trendsSummary: !!trendsSummary,
    //     financeSummary: !!financeSummary,
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
        if (overallSummary) overallSummary.innerHTML = '<p class="error-text">Unable to generate summary at this time.</p>';
        return;
    }
    
    // Parse the summary text and extract sections
    const sections = parseSummarySections(summaryText);
    // console.log('Parsed sections:', sections);
    
    // Clean up the content before displaying
    const cleanContent = (content) => {
        if (!content) return '';
        return content
            .replace(/^\d+\.\s*/, '') // Remove leading numbers like "2."
            .replace(/\d+\.\s*$/, '') // Remove trailing numbers like "3."
            .replace(/\/\/\/\/.*$/, '') // Remove any trailing slashes
            .trim();
    };
    
    // Update each section with specific selectors
    if (sections.news && newsSummary) {
        const cleanedNews = cleanContent(sections.news);
        newsSummary.innerHTML = `<p>${cleanedNews}</p>`;
        // console.log('Updated news section');
    }
    
    if (sections.trends && trendsSummary) {
        const cleanedTrends = cleanContent(sections.trends);
        trendsSummary.innerHTML = `<p>${cleanedTrends}</p>`;
        // console.log('Updated trends section');
    }
    
    if (sections.finance && financeSummary) {
        const cleanedFinance = cleanContent(sections.finance);
        financeSummary.innerHTML = `<p>${cleanedFinance}</p>`;
        // console.log('Updated finance section');
    }
    
    if (sections.insights && overallSummary) {
        const cleanedInsights = cleanContent(sections.insights);
        overallSummary.innerHTML = `<p>${cleanedInsights}</p>`;
        // console.log('Updated insights section');
    }
    
    // Final check - log the actual content
    // console.log('Final summary content check:');
    // if (newsSummary) console.log('News content:', newsSummary.innerHTML);
    // if (trendsSummary) console.log('Trends content:', trendsSummary.innerHTML);
    // if (financeSummary) console.log('Finance content:', financeSummary.innerHTML);
    // if (overallSummary) console.log('Overall content:', overallSummary.innerHTML);
}

// Function to parse summary sections
function parseSummarySections(summaryText) {
    const sections = {};
    
    // console.log('Parsing summary text:', summaryText);
    
    // Extract news highlights - handle both markdown and plain text
    const newsMatch = summaryText.match(/(?:###\s*1\.\s*NEWS HIGHLIGHTS|NEWS HIGHLIGHTS:)(.*?)(?=###\s*2\.\s*TRENDING TOPICS|TRENDING TOPICS:|###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:|###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (newsMatch) {
        sections.news = newsMatch[1].trim();
        // console.log('Extracted news section:', sections.news);
    }
    
    // Extract trending topics - handle both markdown and plain text
    const trendsMatch = summaryText.match(/(?:###\s*2\.\s*TRENDING TOPICS|TRENDING TOPICS:)(.*?)(?=###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:|###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (trendsMatch) {
        sections.trends = trendsMatch[1].trim();
        // console.log('Extracted trends section:', sections.trends);
    }
    
    // Extract market overview - handle both markdown and plain text
    const financeMatch = summaryText.match(/(?:###\s*3\.\s*MARKET OVERVIEW|MARKET OVERVIEW:)(.*?)(?=###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:|$)/s);
    if (financeMatch) {
        sections.finance = financeMatch[1].trim();
        // console.log('Extracted finance section:', sections.finance);
    }
    
    // Extract key insights - handle both markdown and plain text
    const insightsMatch = summaryText.match(/(?:###\s*4\.\s*KEY INSIGHTS|KEY INSIGHTS:)(.*?)$/s);
    if (insightsMatch) {
        sections.insights = insightsMatch[1].trim();
        // console.log('Extracted insights section:', sections.insights);
    }
    
    // console.log('Final parsed sections:', sections);
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

// Export functions for use in other modules
export { collectSectionData, generateSummary, initializeSummarySection }; 

// Daily Summary Management (Server-side)
let currentDailySummary = null;

// Function to save current summary to server
export async function saveCurrentSummary() {
    try {
        const date = getSelectedDate();
        
        // Get the current summary data from the DOM
        const newsSummary = document.querySelector('.news-summary .summary-text')?.innerHTML || '';
        const trendsSummary = document.querySelector('.trends-summary .summary-text')?.innerHTML || '';
        const financeSummary = document.querySelector('.finance-summary .summary-text')?.innerHTML || '';
        const overallSummary = document.querySelector('.overall-summary .summary-text')?.innerHTML || '';
        
        if (!newsSummary && !trendsSummary && !financeSummary && !overallSummary) {
            alert('No summary data available to save. Please generate a summary first.');
            return;
        }
        
        const summaryData = {
            news: newsSummary,
            trends: trendsSummary,
            finance: financeSummary,
            overall: overallSummary,
            date: date
        };
        
        console.log('Sending summary data to server:', summaryData);
        
        // Send to server
        const response = await fetch('/api/summary/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(summaryData)
        });
        
        console.log('Server response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Server response:', result);
        
        if (result.success) {
            alert(`Summary for ${date} saved successfully! This will be available to all users.`);
            currentDailySummary = result.summary;
            await updateSavedSummariesList(); // Refresh the list
            displayHistoricalSummary(result.summary); // Display it in the historical section
        } else {
            if (result.message.includes('already exists')) {
                alert(`A daily summary already exists for ${date}. You can view it in the Daily Summaries Archive section.`);
            } else {
                alert('Error saving summary: ' + result.message);
            }
        }
        
    } catch (error) {
        console.error('Error saving summary:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        alert('Error saving summary. Please try again. Check console for details.');
    }
}

// Function to load daily summary from server
async function loadDailySummary(date = null) {
    try {
        const url = date ? `/api/summary/daily?date=${date}` : '/api/summary/daily';
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            return result.summary;
        } else {
            console.log('No daily summary found:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Error loading daily summary:', error);
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
    
    container.innerHTML = '';
    
    if (summaries.length === 0) {
        return; // The CSS will show the empty state message
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
        
        container.appendChild(item);
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

// Function to load summary for a specific date
export async function loadSummaryForDate() {
    const dateInput = document.getElementById('summaryDate');
    const dateString = dateInput.value;
    
    if (!dateString) {
        alert('Please select a date first.');
        return;
    }
    
    showSummaryLoading();
    const summary = await loadDailySummary(dateString);
    hideSummaryLoading();
    
    if (!summary) {
        alert('No saved summary found for the selected date. You can generate a new one.');
        // Clear the historical display
        const displayContainer = document.getElementById('historical-summary-display');
        if (displayContainer) displayContainer.style.display = 'none';
        return;
    }
    
    // Display the historical summary
    displayHistoricalSummary(summary);
}

// Function to display historical summary
function displayHistoricalSummary(summary) {
    const displayContainer = document.getElementById('historical-summary-display');
    if (!displayContainer) return;
    
    // Update the historical summary cards
    const newsCard = document.querySelector('.historical-news-summary .summary-text');
    const trendsCard = document.querySelector('.historical-trends-summary .summary-text');
    const financeCard = document.querySelector('.historical-finance-summary .summary-text');
    const overallCard = document.querySelector('.historical-overall-summary .summary-text');
    
    if (newsCard) newsCard.innerHTML = summary.news || '<p>No news data available</p>';
    if (trendsCard) trendsCard.innerHTML = summary.trends || '<p>No trends data available</p>';
    if (financeCard) financeCard.innerHTML = summary.finance || '<p>No finance data available</p>';
    if (overallCard) overallCard.innerHTML = summary.overall || '<p>No overall insights available</p>';
    
    // Show the display container
    displayContainer.style.display = 'block';
    
    // Scroll to the historical summary
    displayContainer.scrollIntoView({ behavior: 'smooth' });
}

// Function to delete selected summary (disabled for server-side summaries)
export async function deleteSelectedSummary() {
    alert('Daily summaries are shared across all users and cannot be deleted. Contact the administrator if you need to remove a summary.');
}

// This function will now orchestrate the entire summary section's initial state
async function loadOrGenerateTodaySummary() {
    const today = getLocalDateString();
    setSummaryLoadingText(`Loading summary for ${new Date(today + 'T00:00:00').toLocaleDateString()}...`);
    showSummaryLoading();
    
    const summary = await loadDailySummary(today);
    
    if (summary) {
        // A summary for today already exists, just display it
        updateSummaryDisplayFromData(summary);
    } else {
        // No summary for today, we need to generate and save one
        setSummaryLoadingText(`No summary found for today. Generating a new one...`);
        try {
            const sectionData = await collectSectionData();
            const summaryText = await generateSummary(sectionData);
            updateSummaryDisplay(summaryText);
            
            // Automatically save the newly generated summary
            await saveCurrentSummary();
            await updateSavedSummariesList(); // Refresh the archive list
            
        } catch (error) {
            console.error('Error auto-generating summary:', error);
            updateSummaryDisplay('Error: Unable to automatically generate the daily summary.');
        }
    }
    
    hideSummaryLoading();
}

// Function to initialize the entire summary feature
async function initializeSummarySection() {
    // 1. Set up the historical summaries archive
    await updateSavedSummariesList();
    const dateInput = document.getElementById('summaryDate');
    if (dateInput) {
        const today = getLocalDateString();
        dateInput.value = today;
    }

    // 2. Load or generate the summary for the current day
    await loadOrGenerateTodaySummary();
}

// Function to refresh summary (generates new one but doesn't save to server)
export async function refreshSummary() {
    const today = getLocalDateString();
    setSummaryLoadingText(`Generating a new summary for ${new Date(today + 'T00:00:00').toLocaleDateString()}...`);
    summaryGenerated = false;
    showSummaryLoading();
    
    try {
        const sectionData = await collectSectionData();
        const summaryText = await generateSummary(sectionData);
        updateSummaryDisplay(summaryText);
        
    } catch (error) {
        console.error('Error refreshing summary:', error);
        updateSummaryDisplay('Error: Unable to refresh summary. Please try again later.');
    } finally {
        hideSummaryLoading();
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