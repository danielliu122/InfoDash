// trends.js

// Function to decode HTML entities
const decodeHtmlEntities = (text) => {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = text;
    return tempElement.textContent || tempElement.innerText || '';
};

// Function to fetch Google Trends data
export const fetchTrendsData = async (type = 'daily', category = 'all', language = 'en', country = 'US') => {
    try {
        // original trends1 
        //const response = await fetch(`/api/trends?type=${type}&category=${category}&language=${language}&geo=${country}`);

        // trends2
        const response = await fetch(`/api/trends2?type=${type}&category=${category}&language=${language}&geo=${country}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Received non-JSON response');
        }

        const data = JSON.parse(responseText);
        
        // Log the data response to the console
        //console.log('Fetched trends data:', data);
        
        return data;
    } catch (error) {
        return null; // Suppress all errors
    }
};
// Add event listeners for the dropdowns
document.getElementById('trendsCountrySelect').addEventListener('change', refreshTrends);
document.getElementById('trendsLanguageSelect').addEventListener('change', refreshTrends);

// Function to refresh trends data
async function refreshTrends() {
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    const country = trendsCountrySelect.value;

    // Update language options based on selected country
    updateLanguageOptions(country);

    const language = trendsLanguageSelect.value;

    // Validate language for the selected country
    if (!validLanguageCountryMap[country] || !validLanguageCountryMap[country].includes(language)) {
        console.error(`Invalid language "${language}" for country "${country}".`);
        return; // Exit the function to prevent further execution
    }

    try {
        const trendsData = await fetchTrendsData('daily', 'all', language, country);
        updateTrends(trendsData, 'daily');
    } catch (error) {
        console.error('Error fetching trends data:', error);
    }
}

// Function to update language options based on selected country
function updateLanguageOptions(country) {
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    trendsLanguageSelect.innerHTML = ''; // Clear existing options

    const languages = validLanguageCountryMap[country] || [];
    languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : lang; // Display 'Français' for 'fr'
        trendsLanguageSelect.appendChild(option);
    });

    // Optionally, set the first language as selected
    if (languages.length > 0) {
        trendsLanguageSelect.value = languages[0];
    }
}

export const updateTrends = (data, category) => {
    const trendsSection = document.querySelector('#trends .data-container');
    if (!trendsSection) return;

    // Clear previous data
    trendsSection.innerHTML = '';
    
    if (!data || !data.default || !data.default.trendingSearchesDays) {
        trendsSection.style.display = 'none';
        return;
    }
    
    trendsSection.style.display = 'block';
    
    // Rest of existing rendering logic
    let topics = [];

    if (category === 'daily') {
        const trendingSearchesDays = data.default.trendingSearchesDays || [];
        trendingSearchesDays.forEach(day => {
            topics = topics.concat(day.trendingSearches);
        });
    } else if (category === 'realtime') {
        topics = data.storySummaries.trendingStories || [];
    }

    // Create buttons for each topic title
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons-container');

    // Modify the topic buttons creation (around line 103)
    topics.slice(0, 25).forEach((topic, index) => { // Limit to 5 buttons
        const topicButton = document.createElement('button');
        topicButton.classList.add('topic-button');
        topicButton.innerHTML = `
            ${decodeHtmlEntities(topic.title.query || topic.title)}
            ${topic.image?.imgUrl ? `<img src="${topic.image.imgUrl}" alt="Trend thumbnail">` : ''}
        `;
        topicButton.onclick = () => renderTopicArticles(index);
        buttonsContainer.appendChild(topicButton);
    });

    trendsSection.appendChild(buttonsContainer); // Ensure buttons are added first

    let currentPage = 1;
    const itemsPerPage = 1;
    const totalPages = Math.ceil(topics.length / itemsPerPage);

    const renderPage = (page) => {
        trendsSection.innerHTML = ''; // Clear previous data
        trendsSection.appendChild(buttonsContainer); // Re-add the buttons container first

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = topics.slice(start, end);

        pageData.forEach(topic => {
            const topicElement = document.createElement('div');
            topicElement.classList.add('trend-item');

            const title = document.createElement('h4');
            title.textContent = decodeHtmlEntities(topic.title.query || topic.title);
            topicElement.appendChild(title);

            const traffic = document.createElement('p');
            traffic.textContent = `Traffic: ${topic.formattedTraffic || 'N/A'}`;
            topicElement.appendChild(traffic);

            if (topic.articles && Array.isArray(topic.articles)) {
                const articles = document.createElement('ul');
                topic.articles.slice(0, 5).forEach(article => { // Limit to 5 articles per topic
                    const articleItem = document.createElement('li');
                    const articleLink = document.createElement('a');
                    articleLink.href = article.url;
                    articleLink.textContent = decodeHtmlEntities(article.title || article.articleTitle);
                    articleLink.target = '_blank';
                    articleItem.appendChild(articleLink);

                    // New: Display source for each article
                    const source = document.createElement('p');
                    source.textContent = `Source: ${article.source || 'N/A'}`; // Accessing the source from the article
                    articleItem.appendChild(source);

                    // Handle image for daily trends
                    if (article.image && article.image.imageUrl) {
                        const image = document.createElement('img');
                        image.src = article.image.imageUrl;
                        image.alt = decodeHtmlEntities(article.title || article.articleTitle);
                        articleItem.appendChild(image);
                    }

                    if (article.videoUrl) {
                        const video = document.createElement('video');
                        video.src = article.videoUrl;
                        video.controls = true;
                        articleItem.appendChild(video);
                    }

                    const snippet = document.createElement('p');
                    snippet.textContent = decodeHtmlEntities(article.snippet?.split('\n')[0] || 'N/A'); // Add null check
                    articleItem.appendChild(snippet);

                    articles.appendChild(articleItem);
                });
                topicElement.appendChild(articles);
            }

            trendsSection.appendChild(topicElement);
        });

        // Pagination controls
        const paginationControls = document.createElement('div');
        paginationControls.classList.add('pagination-controls');

        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.onclick = () => {
                currentPage--;
                renderPage(currentPage);
            };
            paginationControls.appendChild(prevButton);
        }

        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.onclick = () => {
                currentPage++;
                renderPage(currentPage);
            };
            paginationControls.appendChild(nextButton);
        }

        trendsSection.appendChild(paginationControls);
    };

    const renderTopicArticles = (index) => {
        trendsSection.innerHTML = ''; // Clear previous data
        trendsSection.appendChild(buttonsContainer); // Re-add the buttons container first

        const topic = topics[index];
        const topicElement = document.createElement('div');
        topicElement.classList.add('trend-item');

        const title = document.createElement('h4');
        title.textContent = decodeHtmlEntities(topic.title.query || topic.title);
        topicElement.appendChild(title);

        const traffic = document.createElement('p');
        traffic.textContent = `Traffic: ${topic.formattedTraffic || 'N/A'}`;
        topicElement.appendChild(traffic);

        if (topic.articles && Array.isArray(topic.articles)) {
            const articles = document.createElement('ul');
            topic.articles.slice(0, 5).forEach(article => { // Limit to 5 articles per topic
                const articleItem = document.createElement('li');
                const articleLink = document.createElement('a');
                articleLink.href = article.url;
                articleLink.textContent = decodeHtmlEntities(article.title || article.articleTitle);
                articleLink.target = '_blank';
                articleItem.appendChild(articleLink);

                // New: Display source for each article
                const source = document.createElement('p');
                source.textContent = `Source: ${article.source || 'N/A'}`; // Accessing the source from the article
                articleItem.appendChild(source);

                // Handle image for daily trends
                if (article.image && article.image.imageUrl) {
                    const image = document.createElement('img');
                    image.src = article.image.imageUrl;
                    image.alt = decodeHtmlEntities(article.title || article.articleTitle);
                    articleItem.appendChild(image);
                }

                if (article.videoUrl) {
                    const video = document.createElement('video');
                    video.src = article.videoUrl;
                    video.controls = true;
                    articleItem.appendChild(video);
                }

                const snippet = document.createElement('p');
                snippet.textContent = decodeHtmlEntities(article.snippet?.split('\n')[0] || 'N/A'); // Add null check
                articleItem.appendChild(snippet);

                articles.appendChild(articleItem);
            });
            topicElement.appendChild(articles);
        }

        trendsSection.appendChild(topicElement);

        // Re-render pagination controls
        renderPaginationControls();
    };

    const renderPaginationControls = () => {
        const paginationControls = document.createElement('div');
        paginationControls.classList.add('pagination-controls');

        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.onclick = () => {
                currentPage--;
                renderPage(currentPage);
            };
            paginationControls.appendChild(prevButton);
        }

        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.onclick = () => {
                currentPage++;
                renderPage(currentPage);
            };
            paginationControls.appendChild(nextButton);
        }

        trendsSection.appendChild(paginationControls);
    };

    renderPage(currentPage);
}

function displayNoTrendsMessage() {
    const trendsSection = document.querySelector('#trends .data-container');
    trendsSection.innerHTML = '<p>No trending searches available at this time.</p>';
}

function processRealtimeTrends(data) {
    //console.log('Processing real-time trends data');
    const trendsSection = document.querySelector('#trends .data-container');
    trendsSection.innerHTML = ''; // Clear previous data

    const topics = data.storySummaries.trendingStories || [];
    topics.forEach(topic => {
        const topicElement = createTopicElement(topic);
        trendsSection.appendChild(topicElement);
    });
}

function processDailyTrends(data) {
    //console.log('Processing daily trends data');
    const trendsSection = document.querySelector('#trends .data-container');
    trendsSection.innerHTML = ''; // Clear previous data

    const trendingSearchesDays = data.default.trendingSearchesDays || [];
    let topics = [];
    trendingSearchesDays.forEach(day => {
        topics = topics.concat(day.trendingSearches);
    });

    topics.forEach(topic => {
        const topicElement = createTopicElement(topic);
        trendsSection.appendChild(topicElement);
    });
}

function createTopicElement(topic) {
    const topicElement = document.createElement('div');
    topicElement.classList.add('trend-item');

    // Determine the title based on the data format
    let topicTitle;
    if (typeof topic.title === 'object' && topic.title.query) {
        topicTitle = topic.title.query;
    } else if (typeof topic.title === 'string') {
        topicTitle = topic.title;
    } else if (typeof topic.query === 'string') {
        topicTitle = topic.query;
    } else {
        topicTitle = 'No Title';
    }

    const title = document.createElement('h4');
    title.classList.add('article-title');
    title.textContent = decodeHtmlEntities(topicTitle);
    topicElement.appendChild(title);

    const traffic = document.createElement('p');
    traffic.classList.add('article-descriptor');
    traffic.textContent = `Traffic: ${topic.formattedTraffic || 'N/A'}`;
    topicElement.appendChild(traffic);

    // Handle image for real-time trends
    if (topic.image && topic.image.imgUrl) {
        const image = document.createElement('img');
        image.src = topic.image.imgUrl;
        image.alt = decodeHtmlEntities(topicTitle);
        topicElement.appendChild(image);
    }

    if (topic.articles && Array.isArray(topic.articles)) {
        const articles = document.createElement('ul');
        topic.articles.slice(0, 5).forEach(article => { // Limit to 5 articles per topic
            const articleItem = document.createElement('li');

            const articleLink = document.createElement('a');
            articleLink.href = article.url;
            articleLink.textContent = decodeHtmlEntities(article.title || article.articleTitle);
            articleLink.target = '_blank';
            articleItem.appendChild(articleLink);

            // Handle image for daily trends
            if (article.image && article.image.imageUrl) {
                const articleImage = document.createElement('img');
                articleImage.src = article.image.imageUrl;
                articleImage.alt = decodeHtmlEntities(article.title || article.articleTitle);
                articleItem.appendChild(articleImage);
            }

            if (article.videoUrl) {
                const video = document.createElement('video');
                video.src = article.videoUrl;
                video.controls = true;
                articleItem.appendChild(video);
            }

            const snippet = document.createElement('p');
            snippet.classList.add('article-text');
            snippet.textContent = decodeHtmlEntities(article.snippet?.split('\n')[0] || 'N/A'); // Add null check            articleItem.appendChild(snippet);

            articles.appendChild(articleItem);
        });
        topicElement.appendChild(articles);
    }

    return topicElement;
}

// Example usage
document.getElementById('dailyTrendsButton').addEventListener('click', () => {
    const type = 'daily';
    const geo = document.getElementById('trendsCountrySelect').value;
    const language = document.getElementById('trendsLanguageSelect').value;
    fetchTrendsData(type, 'all', language, geo);
});

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state
    const trendsSection = document.getElementById('trends'); // Updated to match the correct ID
    trendsSection.style.display = 'none'; // Hide trends section initially

    try {
        await refreshTrends(); // Fetch and display trends data
        trendsSection.style.display = 'block'; // Show trends section after data is loaded
    } catch (error) {
        console.error('Error loading trends data:', error);
    }
});

const validLanguageCountryMap = {
    'US': ['en'],
    'CA': ['en', 'fr'],
    'GB': ['en'],
    'AU': ['en'],
    'DE': ['de', 'en'],
    'FR': ['fr', 'en'],
    'JP': ['ja', 'en'],
    'TW': ['zh', 'en'],
    'BR': ['pt', 'en'],
    'ES': ['es', 'en'],
    // Add more countries and their valid languages as needed
};