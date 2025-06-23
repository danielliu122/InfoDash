// UI utility functions for InfoDash

/**
 * Show a notification message in the top-right corner.
 * @param {string} message - The message to display.
 * @param {number} duration - Duration in ms before auto-dismiss (default 3000).
 */
export function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * Render weather data in the preferences section.
 * @param {object} weatherData - The weather data object.
 * @param {HTMLElement} weatherContainer - The container to render into.
 */
export function displayWeatherInPreferences(weatherData, weatherContainer) {
    if (!weatherData || !weatherContainer) return;
    const { current = {}, location = {} } = weatherData;
    const temp = current.temperature !== undefined && current.temperature !== 'N/A' ? Math.round(current.temperature) : 'N/A';
    const tempUnit = current.temperatureUnit || '°';
    const condition = current.condition || 'Unknown';
    const feelsLike = current.feelslike !== undefined && current.feelslike !== 'N/A' ? Math.round(current.feelslike) : 'N/A';
    const humidity = current.humidity || 'N/A';
    let wind = current.wind || 'N/A';
    let windUnit = current.windUnit || '';
    if (typeof wind === 'string' && wind.includes('mph')) {
        wind = wind.replace(' mph', '').replace('mph', '').trim();
        windUnit = 'mph';
    } else if (typeof wind === 'string' && wind.includes('m/s')) {
        wind = wind.replace(' m/s', '').replace('m/s', '').trim();
        windUnit = 'm/s';
    }
    const uv = current.uv || 'N/A';
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const locationName = location.name || 'Unknown Location';
    const locationCountry = location.country;
    const locationDisplay = locationCountry && locationCountry !== 'undefined' && locationCountry.trim() !== '' 
        ? `${locationName}, ${locationCountry}` 
        : locationName;
    weatherContainer.innerHTML = `
        <div class="weather-display" style="background: var(--card-bg); padding: 15px; border-radius: 8px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <h6 style="margin: 0; color: var(--text-color);">📍 ${locationDisplay}</h6>
                <div style="font-size: 0.8em; color: var(--text-secondary); text-align: right;">
                    <div>🕐 Updated: ${timestamp}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--accent-color);">${temp}${tempUnit}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em;">${condition}</div>
                </div>
                <div style="flex: 1;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em;">
                        <div><strong>Feels like:</strong> ${feelsLike}${tempUnit}</div>
                        <div><strong>Humidity:</strong> ${humidity}%</div>
                        <div><strong>Wind:</strong> ${wind} ${windUnit}</div>
                        <div><strong>UV Index:</strong> ${uv}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Fetch weather data and display it in the preferences section.
 * @param {string} location - The location to fetch weather for.
 * @param {HTMLElement} weatherContainer - The container to render into.
 */
export async function fetchAndDisplayWeatherInPreferences(location, weatherContainer) {
    if (!location || !weatherContainer) return;
    try {
        const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
        if (!response.ok) throw new Error('Failed to fetch weather data');
        const weatherData = await response.json();
        displayWeatherInPreferences(weatherData, weatherContainer);
    } catch (error) {
        weatherContainer.innerHTML = '<p style="color: var(--text-secondary);">⚠️ Unable to fetch weather data.</p>';
    }
}

/**
 * Toggle the visibility of a section by ID, updating the toggle icon.
 * @param {string} sectionId - The ID of the section to toggle.
 * @param {Event} [event] - The event object (optional, for icon update).
 */
export function toggleSection(sectionId, event) {
    const section = document.getElementById(sectionId);
    const toggleButton = event ? event.target.closest('.section-toggle') : null;
    const toggleIcon = toggleButton ? toggleButton.querySelector('.toggle-icon') : null;
    if (!section) return;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        if (toggleIcon) toggleIcon.textContent = '−';
    } else {
        section.style.display = 'none';
        if (toggleIcon) toggleIcon.textContent = '+';
    }
}

/**
 * Show the weather location modal and prefill with saved location if available.
 */
export function showLocationModal() {
    const modal = document.getElementById('locationModal');
    const input = document.getElementById('weatherLocationInput');
    // Set current location if it exists
    const currentLocation = localStorage.getItem('userWeatherLocation');
    if (currentLocation) input.value = currentLocation;
    // Initialize modal if not already done
    if (!modal.classList.contains('initialized')) {
        M.Modal.init(modal);
        modal.classList.add('initialized');
    }
    // Open modal
    const instance = M.Modal.getInstance(modal);
    instance.open();
}

/**
 * Close the weather location modal.
 */
export function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    const instance = M.Modal.getInstance(modal);
    if (instance) instance.close();
} 