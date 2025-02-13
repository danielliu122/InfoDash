// map.js
let test= null;
// Define light mode style with default colors
const lightModeStyle = [
    {
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#ffffff" // White background for light mode
            }
        ]
    },
    {
        "elementType": "labels.icon",
        "stylers": [
            {
                "visibility": "off"
            }
        ]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#000000" // Black text for light mode
            }
        ]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#e0e0e0" // Light gray roads
            }
        ]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#b0d3f1" // Light blue for water
            }
        ]
    },
    {
        "featureType": "landscape",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#f5f5f5" // Light color for landscape
            }
        ]
    },
    {
        "featureType": "administrative",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#e0e0e0" // Light gray for administrative areas
            }
        ]
    }
];

// Define night mode style
const darkModeStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
    },
    {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

let map;
let trafficLayer;
let trafficUpdateInterval;
let isMapInitialized = false;
let currentMapStyle = lightModeStyle; // Default to light mode

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

async function initMap() {
    // Import the ColorScheme from the Google Maps library
    const { ColorScheme } = await google.maps.importLibrary("core");

    // Set the default color scheme to DARK
    let currentColorScheme = ColorScheme.DARK;

    const mapOptions = {
        center: { lat: 40.674, lng: -73.945 }, // Example coordinates
        zoom: 12,
        colorScheme: currentColorScheme, // Set the initial color scheme to DARK
    };

    const map = new google.maps.Map(document.getElementById("map"), mapOptions);

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

    // Add event listener for map interaction to request location
    map.addListener('click', requestLocation);

    // Add a button to re-center the map to the user's current location
    const locationButton = document.createElement("button");
    locationButton.textContent = "Re-center Map";
    locationButton.className = "location-button";
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(locationButton);

    locationButton.addEventListener("click", requestLocation);

    const debouncedUpdate = debounce(async () => {
        const center = map.getCenter();
        await updateTrafficInfo({ lat: center.lat(), lng: center.lng() });
    }, 300);

    map.addListener('idle', debouncedUpdate);

    startPeriodicTrafficUpdates();

    // Add event listener for the theme toggle button
    document.getElementById('themeToggleButton').addEventListener('click', async () => {
        // Toggle between DARK and LIGHT
        currentColorScheme = currentColorScheme === ColorScheme.DARK ? ColorScheme.LIGHT : ColorScheme.DARK;
        map.setOptions({ colorScheme: currentColorScheme });
    });
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

// New function to request location
function requestLocation() {
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
}

// Function to toggle between light and dark mode
async function toggleMapStyle() {
    const { ColorScheme } = await google.maps.importLibrary("core");
    const currentColorScheme = map.get('colorScheme');

    // Toggle between LIGHT and DARK
    const newColorScheme = currentColorScheme === ColorScheme.LIGHT ? ColorScheme.DARK : ColorScheme.LIGHT;
    map.setOptions({ colorScheme: newColorScheme });
}

export { loadGoogleMapsScript, initMap, startPeriodicTrafficUpdates, updateTrafficInfo };