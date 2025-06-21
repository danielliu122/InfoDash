// summary.js - Handles the summary section functionality

let summaryData = {
    news: null,
    trends: null,
    finance: null
};

let summaryGenerated = false;

// Function to collect data from all sections
async function collectSectionData() {
    const data = {
        news: collectNewsData(),
        trends: await collectTrendsData(),
        finance: await collectFinanceData()
    };
    
    // console.log('Collected section data:', data);
    return data;
}

// Function to collect news data
function collectNewsData() {
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
        // console.log('Raw trends data:', data);
        
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
        const nasdaqResponse = await fetch('/api/finance/^IXIC?range=1d&interval=1m');
        if (nasdaqResponse.ok) {
            const nasdaqData = await nasdaqResponse.json();
            if (nasdaqData.chart && nasdaqData.chart.result && nasdaqData.chart.result[0]) {
                const result = nasdaqData.chart.result[0];
                const meta = result.meta;
                financeData.nasdaq = {
                    price: meta.regularMarketPrice?.toFixed(2) || 'N/A',
                    change: meta.regularMarketChange?.toFixed(2) || 'N/A',
                    changePercent: meta.regularMarketChangePercent?.toFixed(2) || 'N/A'
                };
                // console.log('NASDAQ data collected:', financeData.nasdaq);
            }
        }
        
        // Fetch tech stocks data
        const techStocks = ['META', 'AAPL', 'GOOGL', 'AMZN', 'TSLA'];
        for (const symbol of techStocks) {
            try {
                const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.chart && data.chart.result && data.chart.result[0]) {
                        const result = data.chart.result[0];
                        const meta = result.meta;
                        financeData.techStocks[symbol] = {
                            price: meta.regularMarketPrice?.toFixed(2) || 'N/A',
                            change: meta.regularMarketChange?.toFixed(2) || 'N/A',
                            changePercent: meta.regularMarketChangePercent?.toFixed(2) || 'N/A'
                        };
                        // console.log(`${symbol} data collected:`, financeData.techStocks[symbol]);
                    }
                }
            } catch (error) {
                console.error(`Error fetching ${symbol} data:`, error);
            }
        }
        
        // Fetch cryptocurrency data
        const cryptoStocks = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD'];
        for (const symbol of cryptoStocks) {
            try {
                const response = await fetch(`/api/finance/${symbol}?range=1d&interval=1m`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.chart && data.chart.result && data.chart.result[0]) {
                        const result = data.chart.result[0];
                        const meta = result.meta;
                        const shortSymbol = symbol.replace('-USD', '');
                        financeData.crypto[shortSymbol] = {
                            price: meta.regularMarketPrice?.toFixed(2) || 'N/A',
                            change: meta.regularMarketChange?.toFixed(2) || 'N/A',
                            changePercent: meta.regularMarketChangePercent?.toFixed(2) || 'N/A'
                        };
                        // console.log(`${shortSymbol} data collected:`, financeData.crypto[shortSymbol]);
                    }
                }
            } catch (error) {
                console.error(`Error fetching ${symbol} data:`, error);
            }
        }
        
        // console.log('Final finance data:', financeData);
        return financeData;
        
    } catch (error) {
        console.error('Error collecting finance data:', error);
        return null;
    }
}

// Function to generate summary using AI
async function generateSummary(sectionData) {
    try {
        // console.log('Generating summary with data:', sectionData);
        
        const selectedModel = document.getElementById('model-select')?.value || 'deepseek/deepseek-r1:free';
        
        // Prepare the data for AI analysis
        const analysisPrompt = createAnalysisPrompt(sectionData);
        // console.log('Analysis prompt:', analysisPrompt);
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a data analyst specializing in creating concise, informative summaries of current events, trends, and market data. Provide clear, actionable insights in a professional tone.'
                    },
                    {
                        role: 'user',
                        content: analysisPrompt
                    }
                ],
                model: selectedModel
            }),
        });
        
        // console.log('API response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // console.log('API response data:', data);
        
        return data.reply || 'Unable to generate summary at this time.';
        
    } catch (error) {
        console.error('Error generating summary:', error);
        return 'Error: Unable to generate summary. Please try again later.';
    }
}

// Function to create analysis prompt
function createAnalysisPrompt(sectionData) {
    let prompt = 'Please analyze the following current data and provide a comprehensive summary:\n\n';
    
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
        if (sectionData.finance.nasdaq) {
            prompt += `NASDAQ (^IXIC): $${sectionData.finance.nasdaq.price} (${sectionData.finance.nasdaq.changePercent}%)\n`;
        }
        if (sectionData.finance.techStocks) {
            Object.entries(sectionData.finance.techStocks).forEach(([symbol, data]) => {
                prompt += `${symbol}: $${data.price} (${data.changePercent}%)\n`;
            });
        }
        if (sectionData.finance.crypto) {
            Object.entries(sectionData.finance.crypto).forEach(([symbol, data]) => {
                prompt += `${symbol}: $${data.price} (${data.changePercent}%)\n`;
            });
        }
        prompt += '\n';
    }
    
    prompt += `Please provide a structured summary with the following sections (use plain text format, not markdown):

1. NEWS HIGHLIGHTS: Summarize the key news stories and their significance
2. TRENDING TOPICS: Highlight the top 25 most important trending topics and their context  
3. MARKET OVERVIEW: Provide insights on the current market situation including tech stocks and crypto
4. KEY INSIGHTS: Overall analysis and what users should pay attention to

Keep each section concise (2-3 sentences) and focus on the most important information. Use a professional but accessible tone. Format each section with the exact headers shown above (e.g., "1. NEWS HIGHLIGHTS:"). Avoid numbered lists within sections and use proper grammar and punctuation. For trending topics, mention at least the top 25 trends. For market overview, cover both traditional tech stocks and cryptocurrency movements.`;

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

// Main function to generate and display summary
export async function generateAndDisplaySummary() {
    // console.log('Starting summary generation...');
    
    if (summaryGenerated) {
        // console.log('Summary already generated, skipping...');
        return;
    }
    
    showSummaryLoading();
    
    try {
        // Wait a bit for other sections to load
        // console.log('Waiting for sections to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Collect data from all sections
        const sectionData = await collectSectionData();
        
        // Check if we have enough data
        const hasData = sectionData.news || sectionData.trends || sectionData.finance;
        // console.log('Has data:', hasData);
        // console.log('Section data details:', {
        //     newsCount: sectionData.news?.length || 0,
        //     trendsCount: sectionData.trends?.length || 0,
        //     hasFinance: !!sectionData.finance
        // });
        
        if (!hasData) {
            throw new Error('No data available from sections');
        }
        
        // Generate summary using AI
        // console.log('Calling AI to generate summary...');
        const summaryText = await generateSummary(sectionData);
        // console.log('AI summary generated:', summaryText);
        
        // Update display
        // console.log('Updating display with summary...');
        updateSummaryDisplay(summaryText);
        summaryGenerated = true;
        // console.log('Summary generation completed successfully');
        
    } catch (error) {
        console.error('Error in summary generation:', error);
        updateSummaryDisplay('Error: Unable to generate summary. Please try again later.');
    } finally {
        // console.log('Finally block - hiding loading state...');
        hideSummaryLoading();
    }
}

// Function to refresh summary
export async function refreshSummary() {
    // console.log('Refreshing summary...');
    summaryGenerated = false;
    await generateAndDisplaySummary();
}

// Export functions for use in other modules
export { collectSectionData, generateSummary }; 