// Global cache object for news data
const newsCache = {};

const TTL_MS = 43200000;

// Define priority countries
const PRIORITY_COUNTRIES = ['us', 'ca', 'gb'];

// Import user preferences
import { userPrefs } from './userPreferences.js';

// Function to update the news mode indicator
export function updateNewsModeIndicator(newsType) {
    let modeStatus=document.getElementById("mode-status");

    if (newsType === 'top-headlines') {
        modeStatus.innerHTML = '📰 Mode: Top Headlines';
        modeStatus.style.color = '#4CAF50';
    } 
    else if (newsType === 'everything') {
        modeStatus.innerHTML = '🌍 Mode: Everything';
        modeStatus.style.color = '#FF9800';
    }
}

export const fetchNewsData = async (query = 'world', country = 'us', language = 'en', forceRefresh = false, newsType = 'top-headlines') => {
    console.log(`fetchNewsData: Called with query=${query}, country=${country}, language=${language}, newsType=${newsType}`);
    
    // Auto-switch to "everything" mode for non-English languages, because newsAPI has limited support 
    // News API top-headlines has limited language support
    if (language != "en") {
        newsType = 'everything';
    }
    //update html mode status indicator
    updateNewsModeIndicator(newsType);

    const cacheKey = `${query}-${country}-${language}-${newsType}`;
    console.log(`fetchNewsData: Cache key: ${cacheKey}`);

    // Check if cache exists and remove expired data
    if (newsCache[cacheKey] && (Date.now() - newsCache[cacheKey].timestamp >= newsCache[cacheKey].ttl)) {
        console.log(`fetchNewsData: Cache expired for ${cacheKey}, clearing it...`);
        delete newsCache[cacheKey];
    }

    // Check if cached data is available and still valid
    if (newsCache[cacheKey]?.data?.length > 0 && (Date.now() - newsCache[cacheKey].timestamp < TTL_MS)) {
        console.log(`fetchNewsData: Using cached news data for: ${cacheKey}`);
        return newsCache[cacheKey].data;
    }

    try {
        let articles = [];
        
        if (newsType === 'top-headlines') {
            console.log(`fetchNewsData: Fetching top headlines for category: ${query}`);
            // Fetch top headlines from priority countries
            for (const priorityCountry of PRIORITY_COUNTRIES) {
                const headlinesUrl = `/api/news?query=${query}&country=${priorityCountry}&language=${language}&category=${query === 'world' ? 'general' : query}`;
                console.log(`fetchNewsData: Making request to: ${headlinesUrl}`);
                const headlinesResponse = await fetch(headlinesUrl);
                console.log(`fetchNewsData: Response status: ${headlinesResponse.status}`);
                if (headlinesResponse.ok) {
                    const headlinesData = await headlinesResponse.json();
                    console.log(`fetchNewsData: Received data with ${headlinesData.articles?.length || 0} articles`);
                    if (headlinesData.articles) {
                        articles.push(...headlinesData.articles);
                    }
                } else {
                    console.error(`fetchNewsData: Request failed with status ${headlinesResponse.status}`);
                    const errorText = await headlinesResponse.text();
                    console.error(`fetchNewsData: Error response: ${errorText}`);
                }
            }
        } else {
            console.log(`fetchNewsData: Fetching everything for query: ${query}`);
            // Fetch from the everything API
            const everythingUrl = `/api/news?query=${query}&country=${country}&language=${language}`;
            console.log(`fetchNewsData: Making request to: ${everythingUrl}`);
            const everythingResponse = await fetch(everythingUrl);
            console.log(`fetchNewsData: Response status: ${everythingResponse.status}`);
            if (everythingResponse.ok) {
                const everythingData = await everythingResponse.json();
                console.log(`fetchNewsData: Received data with ${everythingData.articles?.length || 0} articles`);
                if (everythingData.articles) {
                    articles.push(...everythingData.articles);
                }
            } else {
                console.error(`fetchNewsData: Request failed with status ${everythingResponse.status}`);
                const errorText = await everythingResponse.text();
                console.error(`fetchNewsData: Error response: ${errorText}`);
            }
        }

        console.log(`fetchNewsData: Total articles collected: ${articles.length}`);

        // Sort articles by date (newest first) and then by popularity
        const sortedArticles = articles.sort((a, b) => {
            const dateDiff = new Date(b.publishedAt) - new Date(a.publishedAt);
            if (dateDiff !== 0) return dateDiff;
            return (b.popularity || 0) - (a.popularity || 0);
        });

        // Cache the fetched data and timestamp
        newsCache[cacheKey] = {
            data: sortedArticles,
            timestamp: Date.now(),
            ttl: TTL_MS,
        };

        console.log(`fetchNewsData: Returning ${sortedArticles.length} articles`);
        return sortedArticles;
    } catch (error) {
        console.error('fetchNewsData: Error fetching news data:', error);
        return [];
    }
}

// Function to update UI with news data
export function updateNews(data) {
    const container = document.querySelector('#news .data-container');
    container.innerHTML = ''; // Clear previous data

    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h4>📰 No News Available</h4>
                <p>Unable to fetch news at this time.</p>
                <p><small>This could be due to API rate limits or network issues.</small></p>
            </div>
        `;
        return;
    }

    // Check if we have cached data indicators
    const isCached = data._cached;
    const isStale = data._stale;
    const cacheMessage = data._message;
    
    // Check if we're using "Everything" mode for non-English languages
    const languageSelect = document.getElementById('languageSelect');
    const currentLanguage = languageSelect ? languageSelect.value : 'en';
    const isNonEnglishMode = currentLanguage !== 'en';
    
    if (isCached) {
        // Show cache status message
        const cacheDiv = document.createElement('div');
        cacheDiv.style.cssText = 'background-color: #e3f2fd; border: 1px solid #2196f3; padding: 10px; margin-bottom: 15px; border-radius: 4px;';
        
        let message = '📋 Showing cached news data';
        if (isStale) {
            message += ' (data may be outdated)';
        }
        if (cacheMessage) {
            message += ` - ${cacheMessage}`;
        }
        
        cacheDiv.innerHTML = `<strong>${message}</strong>`;
        container.appendChild(cacheDiv);
    }
    
    // Show language mode indicator for non-English languages
    if (isNonEnglishMode) {
        const languageDiv = document.createElement('div');
        languageDiv.style.cssText = 'background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin-bottom: 15px; border-radius: 4px;';
        languageDiv.innerHTML = `<strong>🌍 Language Mode: Using "Everything" search for ${currentLanguage.toUpperCase()} language (better coverage for non-English content)</strong>`;
        container.appendChild(languageDiv);
    }

    // Use the original data and filter to ensure each article has an image and description
    const articlesToDisplay = data.filter(article => article.urlToImage && article.description);

    // Pagination
    let currentPage = 1;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(articlesToDisplay.length / itemsPerPage);

    const renderPage = (page) => {
        // Clear previous data but keep cache message
        const existingCacheMessage = container.querySelector('div[style*="background-color: #e3f2fd"]');
        container.innerHTML = '';
        if (existingCacheMessage) {
            container.appendChild(existingCacheMessage);
        }
        
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = articlesToDisplay.slice(start, end);

        const ul = document.createElement('ul');
        pageData.forEach(article => {
            const li = document.createElement('li');
            li.classList.add('news-item');

            const img = document.createElement('img');
            img.src = article.urlToImage;
            img.alt = 'Thumbnail';
            img.classList.add('news-thumbnail');

            const title = document.createElement('h5');
            title.classList.add('article-title');
            title.textContent = article.title;

            const description = document.createElement('p');
            description.classList.add('article-text');
            description.textContent = article.description;

            const space1 = document.createElement('br');
            description.appendChild(space1);
            const space2 = document.createElement('br');
            description.appendChild(space2);

            const authorDate = document.createElement('p');
            authorDate.classList.add('article-descriptor');
            authorDate.textContent = `Written by: ${article.author || 'Unknown'} on ${new Date(article.publishedAt).toLocaleDateString() || 'N/A'}`;

            const source = document.createElement('p');
            source.classList.add('article-descriptor');
            source.textContent = `From: ${article.source.name || 'N/A'}`;

            const readMore = document.createElement('a');
            readMore.href = article.url;
            readMore.target = '_blank';
            readMore.textContent = 'Read more';

            // Append all elements to the list item
            li.appendChild(img);
            li.appendChild(title);
            li.appendChild(description);
            li.appendChild(authorDate);
            li.appendChild(source);
            li.appendChild(readMore);

            // Append the list item to the unordered list
            ul.appendChild(li);
        });

        container.appendChild(ul);

        // Pagination controls
        const paginationControls = document.createElement('div');
        paginationControls.classList.add('pagination-controls');

        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.type = 'button';
            prevButton.onclick = (event) => {
                event.preventDefault();
                currentPage--;
                renderPage(currentPage);
            };
            paginationControls.appendChild(prevButton);
        }

        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.type = 'button';
            nextButton.onclick = (event) => {
                event.preventDefault();
                currentPage++;
                renderPage(currentPage);
            };
            paginationControls.appendChild(nextButton);
        }

        container.appendChild(paginationControls);
    };

    renderPage(currentPage);
}