// Global cache object for news data
const newsCache = {};

const TTL_MS = 43200000;

export const fetchNewsData = async (query = 'world', country = 'us', language = 'en', forceRefresh = false) => {
    const cacheKey = `${query}-${country}-${language}`;

    // Check if cache exists and remove expired data
    if (newsCache[cacheKey] && (Date.now() - newsCache[cacheKey].timestamp >= newsCache[cacheKey].ttl)) {
        console.log(`Cache expired for ${cacheKey}, clearing it...`);
        delete newsCache[cacheKey];
    }

  // Check if cached data is available and still valid
if (newsCache[cacheKey]?.data?.length > 0 && (Date.now() - newsCache[cacheKey].timestamp < TTL_MS)) {
    console.log(`Using cached news data for: ${cacheKey}`);
    return newsCache[cacheKey].data;
} else {
    console.log(`Fetching fresh news data for: ${cacheKey}`);
    const newsUrl = `/api/news?query=${query}&country=${country}&language=${language}`;

    try {
        const response = await fetch(newsUrl);
        if (!response.ok) {
            console.error(`Error fetching news data: ${response.status}`);
            return [];
        }

        const data = await response.json();
        if (data.articles) {
            // Sort articles by `publishedAt` date (newest first)
            const sortedArticles = data.articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            // Cache the fetched data and timestamp
            newsCache[cacheKey] = {
                data: sortedArticles,
                timestamp: Date.now(),
                ttl: TTL_MS, // 12-hour TTL
            };

            return sortedArticles;
        }
        console.error('Invalid news API response:', data);
        return [];
    } catch (error) {
        console.error('Error fetching news data:', error);
        return []; // Return an empty array on error
    }
}}



// Function to update UI with news data
export function updateNews(data) {
    const container = document.querySelector('#news .data-container');
    container.innerHTML = ''; // Clear previous data

    if (!data || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<p>No news articles found.</p>';
        return;
    }

    // Use the original data and filter to ensure each article has an image and description
    const articlesToDisplay = data.filter(article => article.urlToImage && article.description);

    // Pagination
    let currentPage = 1;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(articlesToDisplay.length / itemsPerPage);

    const renderPage = (page) => {
        container.innerHTML = ''; // Clear previous data
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

            const title = document.createElement('h3');
            title.classList.add('article-title');
            title.textContent = article.title;

            const description = document.createElement('p');
            description.classList.add('article-text');
            description.textContent = article.description;

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