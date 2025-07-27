// Global cache object for news data
const newsCache = {};

const TTL_MS =  6 * 60 * 60 * 1000; // 6 hours

// Define priority countries
const PRIORITY_COUNTRIES = ['us', 'ca', 'gb'];

// Import user preferences
import { userPrefs } from './userPreferences.js';

// Function to update the news mode indicator
export function updateNewsModeIndicator(newsType) {
    let modeStatus=document.getElementById("mode-status");
    if (!modeStatus) {
        console.log('Mode status element not found on this page, skipping update');
        return;
    }

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
    if (!container) {
        console.log('News container not found on this page, skipping update');
        return;
    }
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

        const newsGrid = document.createElement('div');
        newsGrid.classList.add('news-grid');
        
        pageData.forEach(article => {
            const card = document.createElement('div');
            card.classList.add('news-card');
            card.onclick = () => window.open(article.url, '_blank');

            // Image section
            const imageDiv = document.createElement('div');
            imageDiv.classList.add('news-card-image');
            
            if (article.urlToImage) {
                const img = document.createElement('img');
                img.src = article.urlToImage;
                img.alt = article.title;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.onerror = () => {
                    imageDiv.innerHTML = '<i class="material-icons">image</i><br>No Image';
                };
                imageDiv.appendChild(img);
            } else {
                imageDiv.innerHTML = '<i class="material-icons">image</i><br>No Image';
            }

            // Content section
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('news-card-content');

            const title = document.createElement('div');
            title.classList.add('news-card-title');
            title.textContent = article.title;

            const description = document.createElement('div');
            description.classList.add('news-card-description');
            description.textContent = article.description || 'No description available.';

            const meta = document.createElement('div');
            meta.classList.add('news-card-meta');
            
            const source = document.createElement('span');
            source.classList.add('news-card-source');
            source.textContent = article.source.name || 'Unknown Source';
            
            const time = document.createElement('span');
            time.classList.add('news-card-time');
            const publishedDate = new Date(article.publishedAt);
            const now = new Date();
            const diffTime = Math.abs(now - publishedDate);
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffDays > 0) {
                time.textContent = `${diffDays}d ago`;
            } else if (diffHours > 0) {
                time.textContent = `${diffHours}h ago`;
            } else {
                time.textContent = 'Just now';
            }
            
            meta.appendChild(source);
            meta.appendChild(time);

            contentDiv.appendChild(title);
            contentDiv.appendChild(description);
            contentDiv.appendChild(meta);

            card.appendChild(imageDiv);
            card.appendChild(contentDiv);
            newsGrid.appendChild(card);
        });

        container.appendChild(newsGrid);

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