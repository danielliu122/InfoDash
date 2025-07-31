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
const trendsCountrySelect = document.getElementById('trendsCountrySelect');
const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');

if (trendsCountrySelect) {
    trendsCountrySelect.addEventListener('change', refreshTrends);
}
if (trendsLanguageSelect) {
    trendsLanguageSelect.addEventListener('change', refreshTrends);
}

// Function to refresh trends data
async function refreshTrends() {
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    
    // Check if elements exist (only on trends page)
    if (!trendsCountrySelect || !trendsLanguageSelect) {
        console.log('Trends controls not found on this page, skipping trends refresh');
        return;
    }
    
    const country = trendsCountrySelect.value;
    
    // Update language options based on the selected country
    updateLanguageOptions(country);
    
    // Get the language after updating options
    const language = trendsLanguageSelect.value;
    
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
    trendsLanguageSelect.innerHTML = '';
    
    // Country to language mapping for trends
    const countryLanguages = {
        'US': ['en'], 'CA': ['en'], 'GB': ['en'], 'AU': ['en'], 'NZ': ['en'], 'IE': ['en'],
        'ES': ['es', 'en'], 'MX': ['es', 'en'], 'AR': ['es', 'en'], 'CL': ['es', 'en'], 
        'CO': ['es', 'en'], 'PE': ['es', 'en'],
        'FR': ['fr', 'en'], 'DE': ['de', 'en'], 'AT': ['de', 'en'], 'CH': ['de', 'fr', 'en'],
        'IT': ['it', 'en'], 'PT': ['pt', 'en'], 'BR': ['pt', 'en'], 'RU': ['ru', 'en'],
        'JP': ['jp', 'en'], 'KR': ['ko', 'en'], 'CN': ['zh', 'en'], 'SA': ['ar', 'en'],
        'IN': ['hi', 'en'], 'VN': ['vi', 'en'], 'TH': ['th', 'en'], 'ID': ['id', 'en'],
        'TR': ['tr', 'en'], 'PL': ['pl', 'en'], 'NL': ['nl', 'en'], 'SE': ['sv', 'en'],
        'NO': ['no', 'en'], 'FI': ['fi', 'en'], 'DK': ['da', 'en'], 'CZ': ['cs', 'en'],
        'HU': ['hu', 'en'], 'GR': ['el', 'en'], 'RO': ['ro', 'en'], 'UA': ['uk', 'en'],
        'IL': ['he', 'en'], 'IR': ['fa', 'en'], 'BD': ['bn', 'en'], 'NP': ['ne', 'en'],
        'AZ': ['az', 'en'], 'GE': ['ka', 'en'], 'RS': ['sr', 'en'], 'MK': ['mk', 'en'],
        'SI': ['sl', 'en'], 'SK': ['sk', 'en'], 'EE': ['et', 'en'], 'IS': ['is', 'en']
    };
    
    // Language names mapping
    const languageNames = {
        'en': 'English', 'es': 'Español', 'fr': 'Français', 'de': 'Deutsch',
        'ru': 'Русский', 'zh': '中文', 'jp': '日本語', 'ko': '한국어',
        'pt': 'Português', 'ar': 'العربية', 'hi': 'हिन्दी', 'it': 'Italiano',
        'nl': 'Nederlands', 'sv': 'Svenska', 'no': 'Norsk', 'fi': 'Suomi',
        'da': 'Dansk', 'pl': 'Polski', 'cs': 'Čeština', 'hu': 'Magyar',
        'el': 'Ελληνικά', 'tr': 'Türkçe', 'th': 'ไทย', 'vi': 'Tiếng Việt',
        'id': 'Bahasa Indonesia', 'uk': 'Українська', 'fa': 'فارسی', 'bn': 'বাংলা',
        'ne': 'नेपाली', 'az': 'Azərbaycan dili', 'ka': 'ქართული', 'ro': 'Română',
        'sr': 'Српски', 'mk': 'Македонски', 'sl': 'Slovenščina', 'sk': 'Slovenčina',
        'et': 'Eesti', 'is': 'Íslenska'
    };
    
    // Get languages for the selected country, default to English if not found
    const languages = countryLanguages[country] || ['en'];
    
    languages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = languageNames[lang] || lang;
        trendsLanguageSelect.appendChild(option);
    });
    
    // Set default to first language (usually the primary language for the country)
    trendsLanguageSelect.value = languages[0];
    
    // Trigger Materialize update if available
    if (window.M && window.M.FormSelect) {
        M.FormSelect.init(trendsLanguageSelect);
    }
}

export const updateTrends = (data, category) => {
    const trendsSection = document.querySelector('.trends-container');
    if (!trendsSection) {
        console.log('Trends container not found on this page, skipping update');
        return;
    }

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
    const trendsSection = document.querySelector('.trends-container');
    trendsSection.innerHTML = '<p>No trending searches available at this time.</p>';
}

function processRealtimeTrends(data) {
    //console.log('Processing real-time trends data');
    const trendsSection = document.querySelector('.trends-container');
    if (!trendsSection) {
        console.log('Trends container not found on this page, skipping processRealtimeTrends');
        return;
    }
    trendsSection.innerHTML = ''; // Clear previous data

    const topics = data.storySummaries.trendingStories || [];
    topics.forEach(topic => {
        const topicElement = createTopicElement(topic);
        trendsSection.appendChild(topicElement);
    });
}

function processDailyTrends(data) {
    //console.log('Processing daily trends data');
    const trendsSection = document.querySelector('.trends-container');
    if (!trendsSection) {
        console.log('Trends container not found on this page, skipping processDailyTrends');
        return;
    }
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

// Function to initialize trends section
export function initializeTrends() {
    console.log('Initializing trends section...');
    
    // Initialize language options based on current country
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    if (trendsCountrySelect) {
        const currentCountry = trendsCountrySelect.value || 'US';
        updateLanguageOptions(currentCountry);
    }
    
    // Load initial trends data
    refreshTrends();
}

// Function to set trends region (called from geolocation.js)
export function setTrendsRegion(language, country) {
    console.log(`Setting trends region: ${language}-${country}`);
    
    const trendsCountrySelect = document.getElementById('trendsCountrySelect');
    const trendsLanguageSelect = document.getElementById('trendsLanguageSelect');
    
    if (trendsCountrySelect) {
        trendsCountrySelect.value = country;
        // Trigger Materialize update
        if (window.M && window.M.FormSelect) {
            M.FormSelect.init(trendsCountrySelect);
        }
    }
    
    // Update language options and set the language
    updateLanguageOptions(country);
    
    if (trendsLanguageSelect) {
        // Find the language in the updated options
        const options = trendsLanguageSelect.querySelectorAll('option');
        for (let option of options) {
            if (option.value === language) {
                trendsLanguageSelect.value = language;
                break;
            }
        }
        // If language not found, use the first available option
        if (!trendsLanguageSelect.value && options.length > 0) {
            trendsLanguageSelect.value = options[0].value;
        }
        
        // Trigger Materialize update
        if (window.M && window.M.FormSelect) {
            M.FormSelect.init(trendsLanguageSelect);
        }
    }
    
    // Refresh trends data with new region
    refreshTrends();
}

// Remove the dailyTrendsButton event listener since the button no longer exists
// The trends data is now loaded automatically in app.js

// Note: DOMContentLoaded event listener is handled in app.js
// No need for duplicate event listeners here
