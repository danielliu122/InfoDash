// map.js
// Google Maps JS API: Directions, Dark/Light Mode Toggle, Locate Me

let map;
let directionsService;
let directionsRenderer;
let isDarkMode = false;
let locationMarker = null;

const lightModeStyle = [];
const darkModeStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] }
];

window.initMap = function() {
  // Try to use user's geolocation for default center
  let defaultCenter = { lat: 40.7128, lng: -74.0060 }; // Fallback: New York City
  let defaultZoom = 15;

  // Create the map with fallback center
  map = new google.maps.Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: defaultZoom,
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
    styles: lightModeStyle
  });

  // Add the traffic layer by default
  const trafficLayer = new google.maps.TrafficLayer();
  trafficLayer.setMap(map);

  // Try to get user's location and recenter map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setCenter(pos);
        if (locationMarker) locationMarker.setMap(null);
        locationMarker = new google.maps.Marker({
          map,
          position: pos,
          title: 'Your Location',
          icon: {
            url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png',
            scaledSize: new google.maps.Size(36, 36)
          }
        });
      },
      () => {/* do nothing, fallback to default center */}
    );
  }

  // Directions
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);
  directionsRenderer.setPanel(document.getElementById('directions-panel'));

  // Directions form
  const originInput = document.getElementById('origin-input');
  const destinationInput = document.getElementById('destination-input');
  const travelModeSelect = document.getElementById('travel-mode');
  const form = document.getElementById('directions-form');

  // Places Autocomplete for origin/destination
  const originAutocomplete = new google.maps.places.Autocomplete(originInput);
  const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput);

  form.onsubmit = function(e) {
    e.preventDefault();
    calculateAndDisplayRoute();
  };

  travelModeSelect.onchange = calculateAndDisplayRoute;
  originAutocomplete.addListener('place_changed', calculateAndDisplayRoute);
  destinationAutocomplete.addListener('place_changed', calculateAndDisplayRoute);

  function calculateAndDisplayRoute() {
    const origin = originInput.value;
    const destination = destinationInput.value;
    const travelMode = travelModeSelect.value;
    if (!origin || !destination) return;
    directionsService.route({
      origin,
      destination,
      travelMode: travelMode.toUpperCase()
    }, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
            } else {
        directionsRenderer.setDirections({ routes: [] });
        document.getElementById('directions-panel').innerHTML = '<p>No route found.</p>';
      }
    });
  }

  // --- Dark/Light Mode Toggle ---
  const themeToggleBtn = document.createElement('button');
  themeToggleBtn.textContent = 'Dark Mode';
  themeToggleBtn.className = 'map-theme-toggle styled-map-btn';
  themeToggleBtn.setAttribute('aria-label', 'Toggle dark/light mode');
  themeToggleBtn.style.margin = '8px';
  themeToggleBtn.onclick = function() {
    isDarkMode = !isDarkMode;
    map.setOptions({ styles: isDarkMode ? darkModeStyle : lightModeStyle });
    themeToggleBtn.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
  };
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(themeToggleBtn);

  // --- Controls container (top left) ---
  const controlsContainer = document.createElement('div');
  controlsContainer.style.display = 'flex';
  controlsContainer.style.alignItems = 'center';
  controlsContainer.style.gap = '8px';
  controlsContainer.style.background = 'transparent';

  // --- Locate Me Button (modern icon) ---
  const locateBtn = document.createElement('button');
  locateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="#1976d2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8" stroke="#1976d2" fill="none"/><circle cx="12" cy="12" r="3" fill="#1976d2"/><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /></svg>`;
  locateBtn.title = 'Locate Me';
  locateBtn.className = 'map-locate-btn styled-map-btn';
  locateBtn.setAttribute('aria-label', 'Locate Me');
  locateBtn.onclick = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(pos);
          if (locationMarker) locationMarker.setMap(null);
          locationMarker = new google.maps.Marker({
            map,
            position: pos,
            title: 'Your Location',
            icon: {
              url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png',
              scaledSize: new google.maps.Size(36, 36)
            }
          });
        },
        () => alert('Unable to retrieve your location.')
        );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };
  controlsContainer.appendChild(locateBtn);

  // --- Search Bar (Google Places Autocomplete) ---
  const searchForm = document.createElement('form');
  searchForm.style.display = 'flex';
  searchForm.style.alignItems = 'center';
  searchForm.style.background = '#fff';
  searchForm.style.borderRadius = '24px';
  searchForm.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  searchForm.style.padding = '0 12px';
  searchForm.style.height = '40px';
  searchForm.style.gap = '8px';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search location...';
  searchInput.style.border = 'none';
  searchInput.style.outline = 'none';
  searchInput.style.fontSize = '16px';
  searchInput.style.background = 'transparent';
  searchInput.style.height = '38px';
  searchInput.style.width = '220px';
  searchInput.style.padding = '0 0 0 32px';
  searchInput.setAttribute('aria-label', 'Search location');

  // Search icon
  const searchIcon = document.createElement('span');
  searchIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  searchIcon.style.position = 'absolute';
  searchIcon.style.left = '12px';
  searchIcon.style.top = '10px';
  searchIcon.style.pointerEvents = 'none';

  // Position search icon absolutely inside the form
  searchForm.style.position = 'relative';
  searchForm.appendChild(searchIcon);
  searchForm.appendChild(searchInput);

  // Google Places Autocomplete
  const autocomplete = new google.maps.places.Autocomplete(searchInput);
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    map.setCenter(place.geometry.location);
    map.setZoom(17);
    if (locationMarker) locationMarker.setMap(null);
    locationMarker = new google.maps.Marker({
      map,
      position: place.geometry.location,
      title: place.name || 'Selected Location',
      icon: {
        url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png',
        scaledSize: new google.maps.Size(36, 36)
      }
    });
  });
  searchForm.onsubmit = function(e) {
    e.preventDefault();
    google.maps.event.trigger(searchInput, 'focus');
    google.maps.event.trigger(searchInput, 'keydown', { keyCode: 13 });
  };
  controlsContainer.appendChild(searchForm);

  // Add controls to map
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(controlsContainer);
};

// Add styles for the map buttons
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .styled-map-btn {
      background: #fff;
      border: none;
      border-radius: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      padding: 10px 18px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s, box-shadow 0.2s, color 0.2s;
      margin: 8px;
      outline: none;
      color: #222;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .styled-map-btn:hover, .styled-map-btn:focus {
      background: #f5f5f5;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      color: #1976d2;
    }
    .map-theme-toggle {
      min-width: 110px;
    }
    .map-locate-btn {
      font-size: 22px;
      min-width: 48px;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);
})();