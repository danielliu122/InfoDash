// weather.js - Shared weather logic for InfoDash
import { userPrefs } from './userPreferences.js';

// Weather icon mapping
const weatherIcons = {
    'Clear': '☀️', 'Sunny': '☀️', 'Partly Cloudy': '⛅', 'Mostly Cloudy': '⛅', 'Cloudy': '☁️', 'Overcast': '☁️',
    'Rain': '🌧️', 'Light Rain': '🌦️', 'Heavy Rain': '🌧️', 'Showers': '🌦️', 'Thunderstorm': '⛈️', 'Storm': '⛈️',
    'Snow': '❄️', 'Light Snow': '🌨️', 'Heavy Snow': '❄️', 'Sleet': '🌨️', 'Fog': '🌫️', 'Mist': '🌫️', 'Haze': '🌫️',
    'Windy': '💨', 'Breezy': '💨'
};

function getWeatherIcon(condition) {
    if (!condition) return '🌤️';
    const conditionLower = condition.toLowerCase();
    for (const [key, icon] of Object.entries(weatherIcons)) {
        if (conditionLower.includes(key.toLowerCase())) return icon;
    }
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) return '☀️';
    if (conditionLower.includes('cloud')) return '☁️';
    if (conditionLower.includes('rain')) return '🌧️';
    if (conditionLower.includes('snow')) return '❄️';
    if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return '⛈️';
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) return '🌫️';
    if (conditionLower.includes('wind')) return '💨';
    return '🌤️';
}

export async function collectWeatherData(location) {
    if (!location) return null;
    try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error collecting weather data:', error);
        return null;
    }
}

export async function updateHeaderWeather() {
    const location = userPrefs.getWeatherLocation();
    const header = document.getElementById('header-weather');
    if (!header) return;
    const weatherIcon = document.getElementById('weather-icon');
    const weatherTemp = document.getElementById('weather-temp');
    const weatherLocation = document.getElementById('weather-location');
    if (!location) {
        if (weatherIcon) weatherIcon.textContent = '🌤️';
        if (weatherTemp) weatherTemp.textContent = '--°F';
        if (weatherLocation) weatherLocation.textContent = 'No location set';
        return;
    }
    const data = await collectWeatherData(location);
    if (!data || !data.current) {
        if (weatherIcon) weatherIcon.textContent = '🌤️';
        if (weatherTemp) weatherTemp.textContent = '--°F';
        if (weatherLocation) weatherLocation.textContent = 'No data';
        return;
    }
    if (weatherIcon) weatherIcon.textContent = getWeatherIcon(data.current.condition || data.current.skytext);
    if (weatherTemp) weatherTemp.textContent = `${data.current.temperature}°${data.current.temperatureUnit || 'F'}`;
    if (weatherLocation) weatherLocation.textContent = data.location?.name || location;
}

export async function updateSummaryWeather() {
    const location = userPrefs.getWeatherLocation();
    const weatherSummaryContainer = document.querySelector('.weather-summary .weather-info');
    if (!weatherSummaryContainer) return;
    if (!location) {
        weatherSummaryContainer.innerHTML = '<p>No location set. <button onclick="showLocationModal()">Set Location</button></p>';
        return;
    }
    const data = await collectWeatherData(location);
    if (!data || !data.current) {
        weatherSummaryContainer.innerHTML = '<p>No weather data available.</p>';
        return;
    }
    const current = data.current;
    const locationData = data.location || {};
    const locationName = locationData.name || 'Unknown Location';
    const locationCountry = locationData.country;
    const locationDisplay = locationCountry && locationCountry !== 'undefined' && locationCountry.trim() !== '' 
        ? `${locationName}, ${locationCountry}` 
        : locationName;
    let wind = current.wind || 'N/A';
    let windUnit = current.windUnit || '';
    if (typeof wind === 'string' && wind.includes('mph')) {
        wind = wind.replace(' mph', '').replace('mph', '').trim();
        windUnit = 'mph';
    } else if (typeof wind === 'string' && wind.includes('m/s')) {
        wind = wind.replace(' m/s', '').replace('m/s', '').trim();
        windUnit = 'm/s';
    }
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
    weatherSummaryContainer.querySelector('.weather-location').innerHTML = `<h4>📍 ${locationDisplay}</h4>`;
    weatherSummaryContainer.querySelector('.weather-updated').innerHTML = `<div style="font-size: 0.8em; color: var(--text-secondary); text-align: right;">🕐 Updated: ${timestamp}</div>`;
    weatherSummaryContainer.querySelector('.weather-condition').textContent = current.condition;
    weatherSummaryContainer.querySelector('.weather-temp').textContent = `Temperature: ${current.temperature}°${current.temperatureUnit}`;
    weatherSummaryContainer.querySelector('.weather-feelslike').textContent = `Feels like: ${current.feelslike}°${current.temperatureUnit}`;
    weatherSummaryContainer.querySelector('.weather-humidity').textContent = `Humidity: ${current.humidity}%`;
    weatherSummaryContainer.querySelector('.weather-wind').textContent = `Wind: ${wind} ${windUnit}`;
}

export async function initializeWeatherAutoRefresh() {
    await updateHeaderWeather();
    setInterval(updateHeaderWeather, 60000); // 1 minute
}

// For manual update button
window.updateHeaderWeather = updateHeaderWeather;
window.updateSummaryWeather = updateSummaryWeather; 