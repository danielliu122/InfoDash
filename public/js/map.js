// map.js

let map;
let trafficLayer;
let trafficUpdateInterval;
let isMapInitialized = false;

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function loadGoogleMapsScript() {
    try {
        // Store original console methods
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;

        // Override console methods to suppress errors and warnings
        console.error = () => {};
        console.warn = () => {};

        const script = document.createElement('script');
        script.src = '/api/googlemaps/script';
        script.async = true;

        // Restore original console methods after the script is loaded
        script.onload = () => {
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
        };

        // Restore original console methods if there's an error loading the script
        script.onerror = () => {
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            console.error('Error loading Google Maps script');
        };

        document.head.appendChild(script);
    } catch (error) {
        console.error('Error loading Google Maps script:', error);
    }
}

// Ensure initMap is available globally
window.initMap = initMap;

function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map container element not found');
        return;
    }

    const defaultCenter = { lat: 39.8283, lng: -98.5795 };

    console.log('Initializing map with center:', defaultCenter);

    map = new google.maps.Map(mapElement, {
        zoom: 4,
        center: defaultCenter,
        // Remove mapId for now to isolate the issue
        // mapId: 'YOUR_MAP_ID_HERE'
    });

    const input = document.createElement("input");
    input.id = "MapsInput";
    input.type = "text";
    input.placeholder = "Enter a location";
    input.className = "controls";

    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    const searchBox = new google.maps.places.SearchBox(input);

    map.addListener("bounds_changed", () => {
        searchBox.setBounds(map.getBounds());
    });

    searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();

        if (places.length == 0) {
            return;
        }

        const bounds = new google.maps.LatLngBounds();

        places.forEach((place) => {
            if (!place.geometry || !place.geometry.location) {
                console.log("Returned place contains no geometry");
                return;
            }

            if (place.geometry.viewport) {
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
        });
        map.fitBounds(bounds);

        if (places[0] && places[0].geometry) {
            const location = places[0].geometry.location;
            updateTrafficInfo({ lat: location.lat(), lng: location.lng() });
        }
    });

    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    isMapInitialized = true;
    console.log('Map initialized');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                map.setCenter(pos);
                map.setZoom(12);

                updateTrafficInfo(pos);

                //console.log('Map centered on current location');
            },
            () => {
                console.warn('Geolocation permission denied or failed. Using default center.');
                updateTrafficInfo(defaultCenter);
            }
        );
    } else {
        console.warn('Geolocation not supported. Using default center.');
        updateTrafficInfo(defaultCenter);
    }

    // Add a button to re-center the map to the user's current location
    const locationButton = document.createElement("button");
    locationButton.textContent = "Re-center Map";
    locationButton.className = "location-button";
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(locationButton);

    locationButton.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    map.setCenter(pos);
                    map.setZoom(12);

                    updateTrafficInfo(pos);

                    //console.log('Map re-centered on current location');
                },
                () => {
                    console.warn('Geolocation permission denied or failed. Using default center.');
                    updateTrafficInfo(defaultCenter);
                }
            );
        } else {
            console.warn('Geolocation not supported. Using default center.');
            updateTrafficInfo(defaultCenter);
        }
    });

    const debouncedUpdate = debounce(async () => {
        const center = map.getCenter();
        await updateTrafficInfo({ lat: center.lat(), lng: center.lng() });
    }, 300);

    map.addListener('idle', debouncedUpdate);

    startPeriodicTrafficUpdates();
}

function startPeriodicTrafficUpdates() {
    trafficUpdateInterval = setInterval(async () => {
        const center = map.getCenter();
        await updateTrafficInfo({ lat: center.lat(), lng: center.lng() });
    }, 300000);
}

const updateTrafficInfo = async (location) => {
    if (!location || typeof location.lat === 'undefined' || typeof location.lng === 'undefined') {
        console.error('Invalid location provided to updateTrafficInfo');
        return;
    }
    //console.log('Updating traffic info for location:', location);
}

export { loadGoogleMapsScript, initMap, startPeriodicTrafficUpdates, updateTrafficInfo };