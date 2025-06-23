import { userPrefs } from './userPreferences.js';

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

    // Save preferences
    userPrefs.setTrendsCountry(country);
    userPrefs.setTrendsLanguage(language);

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
    
    // Extract trending topics
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

    // Create trend buttons (simplified - no thumbnails or descriptions)
    topics.slice(0, 25).forEach((topic, index) => {
        const topicButton = document.createElement('button');
        topicButton.classList.add('topic-button');
        topicButton.textContent = decodeHtmlEntities(topic.title.query || topic.title);
        
        // Add traffic info if available
        if (topic.formattedTraffic) {
            topicButton.title = `Traffic: ${topic.formattedTraffic}`;
        }
        
        // Add click handler for better UX
        topicButton.addEventListener('click', () => {
            // Visual feedback
            topicButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                topicButton.style.transform = '';
            }, 150);
            
            // Open Google News search in new tab
            const searchTerm = encodeURIComponent(topicButton.textContent);
            const googleNewsUrl = `https://news.google.com/search?for=${searchTerm}&hl=en-US&gl=US&ceid=US%3Aen`;
            window.open(googleNewsUrl, '_blank');
        });
        
        buttonsContainer.appendChild(topicButton);
    });

    trendsSection.appendChild(buttonsContainer);

    // Add a styled info message about the simplified display
    const infoMessage = document.createElement('div');
    infoMessage.style.cssText = `
        text-align: center; 
        padding: 20px; 
        color: var(--secondary-text); 
        font-style: italic;
        background: var(--card-bg);
        border-radius: 8px;
        margin-top: 16px;
        border: 1px solid var(--border-color);
    `;
    infoMessage.innerHTML = '<p>📊 Showing trending topics for the selected country. Click on topics to search Google News in a new tab.</p>';
    trendsSection.appendChild(infoMessage);
};

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
            snippet.textContent = decodeHtmlEntities(article.snippet?.split('\n')[0] || 'N/A'); // Add null check
            articleItem.appendChild(snippet);

            articles.appendChild(articleItem);
        });
        topicElement.appendChild(articles);
    }

    return topicElement;
}

// Remove the dailyTrendsButton event listener since the button no longer exists
// The trends data is now loaded automatically in app.js

// Note: DOMContentLoaded event listener is handled in app.js
// No need for duplicate event listeners here

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