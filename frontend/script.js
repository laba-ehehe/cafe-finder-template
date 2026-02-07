// ===== Configuration =====
const API_BASE = "http://localhost:3001";

// ===== DOM Elements =====
const findBtn = document.getElementById("find-btn");
const radiusSelect = document.getElementById("radius");
const statusDiv = document.getElementById("status");
const cafeList = document.getElementById("cafe-list");
const cafeCount = document.getElementById("cafe-count");

// ===== Map Setup =====
const map = L.map("map", {
  zoomControl: false,
}).setView([29.6516, -82.3248], 13);

// Add zoom control to top-right
L.control.zoom({ position: "topright" }).addTo(map);

// Warm-toned map tiles (CartoDB Voyager — clean and pretty)
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
    subdomains: "abcd",
  }
).addTo(map);

let markers = [];
let userMarker = null;

// ===== Custom Marker Icons =====
const cafeIcon = L.divIcon({
  html: '<div class="marker-pin"><span>☕</span></div>',
  className: "cafe-marker",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -42],
});

const userIcon = L.divIcon({
  html: '<div class="user-pin"><span>💖</span></div>',
  className: "cafe-marker",
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  popupAnchor: [0, -46],
});

// ===== Event Listeners =====
findBtn.addEventListener("click", findCafes);

// ===== Main Function =====
async function findCafes() {
  findBtn.disabled = true;
  findBtn.innerHTML = '<span class="spinner"></span> searching...';

  showStatus("getting your location... 📍", "loading");

  try {
    const position = await getUserLocation();
    const { latitude: lat, longitude: lng } = position.coords;
    const radius = radiusSelect.value;

    showStatus("finding cozy cafes nearby... ☕✨", "loading");

    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], { icon: userIcon })
      .addTo(map)
      .bindPopup(
        '<div class="cafe-popup"><h3>💖 you are here!</h3></div>'
      )
      .openPopup();

    const response = await fetch(
      `${API_BASE}/api/cafes?lat=${lat}&lng=${lng}&radius=${radius}`
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data.cafes.length === 0) {
      showStatus("no cafes found nearby 😿 try a bigger radius!", "error");
      cafeList.innerHTML = `
        <div class="empty-state">
          <div class="empty-anim">
            <span class="empty-cup">😿</span>
          </div>
          <p>no cafes found here...<br/>try increasing the radius!</p>
        </div>`;
      cafeCount.textContent = "";
    } else {
      showStatus(
        `found ${data.cafes.length} cute cafes near you! 🎉`,
        "success"
      );
      displayCafes(data.cafes, lat, lng);
    }
  } catch (error) {
    console.error("Error:", error);

    if (error.code === 1) {
      showStatus(
        "location access denied 🔒 please allow location and try again!",
        "error"
      );
    } else if (
      error.message.includes("Server error") ||
      error.message.includes("fetch")
    ) {
      showStatus(
        "couldn't connect to server 💔 make sure backend is running on port 3001!",
        "error"
      );
    } else {
      showStatus(`oops: ${error.message} 😅`, "error");
    }
  } finally {
    findBtn.disabled = false;
    findBtn.innerHTML =
      '<span class="btn-emoji">✨</span><span class="btn-text">Find Cafes Near Me</span>';
  }
}

// ===== Get User Location =====
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    });
  });
}

// ===== Display Cafes =====
function displayCafes(cafes, userLat, userLng) {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  cafeCount.textContent = cafes.length;
  cafeList.innerHTML = "";

  const bounds = L.latLngBounds([[userLat, userLng]]);

  cafes.forEach((cafe, index) => {
    if (!cafe.lat || !cafe.lng) return;

    bounds.extend([cafe.lat, cafe.lng]);

    const marker = L.marker([cafe.lat, cafe.lng], { icon: cafeIcon })
      .addTo(map)
      .bindPopup(createPopupHTML(cafe));

    markers.push(marker);

    const card = document.createElement("div");
    card.className = "cafe-card";
    card.style.animationDelay = `${index * 0.03}s`;
    card.innerHTML = createCardHTML(cafe);

    card.addEventListener("click", () => {
      map.flyTo([cafe.lat, cafe.lng], 17, { duration: 0.8 });
      marker.openPopup();
      document
        .querySelectorAll(".cafe-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
    });

    marker.on("click", () => {
      document
        .querySelectorAll(".cafe-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    cafeList.appendChild(card);
  });

  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
}

// ===== Popup HTML =====
function createPopupHTML(cafe) {
  const ratingHTML = cafe.rating
    ? `<p class="popup-rating">⭐ ${cafe.rating}/10</p>`
    : "";
  const statusHTML =
    cafe.isOpen === true
      ? '<p style="color: #2E8B57;">✅ open now!</p>'
      : cafe.isOpen === false
        ? '<p style="color: #C44569;">💤 closed</p>'
        : "";

  return `
    <div class="cafe-popup">
      <h3>${escapeHTML(cafe.name)}</h3>
      <p>${escapeHTML(cafe.category)}</p>
      ${ratingHTML}
      ${statusHTML}
      <p style="font-size: 0.73rem; margin-top: 0.25rem; opacity: 0.7;">${escapeHTML(cafe.address)}</p>
    </div>
  `;
}

// ===== Card HTML =====
function createCardHTML(cafe) {
  // Pick a random cute placeholder emoji per card
  const cupEmojis = ["☕", "🧋", "🍵", "🫖", "🧁"];
  const randomCup = cupEmojis[Math.floor(Math.random() * cupEmojis.length)];

  const photoHTML = cafe.photo
    ? `<img class="cafe-photo" src="${cafe.photo}" alt="${escapeHTML(cafe.name)}" loading="lazy" />`
    : `<div class="cafe-photo-placeholder">${randomCup}</div>`;

  const ratingHTML = cafe.rating
    ? `<span class="cafe-rating">⭐ ${cafe.rating}/10</span>`
    : "";

  const statusHTML =
    cafe.isOpen === true
      ? `<span class="cafe-status open">open ♡</span>`
      : cafe.isOpen === false
        ? `<span class="cafe-status closed">closed</span>`
        : "";

  return `
    ${photoHTML}
    <div class="cafe-info">
      <div class="cafe-name">${escapeHTML(cafe.name)}</div>
      <div class="cafe-category">${escapeHTML(cafe.category)}</div>
      <div class="cafe-address">${escapeHTML(cafe.address)}</div>
      <div class="cafe-meta">
        ${ratingHTML}
        ${statusHTML}
      </div>
    </div>
  `;
}

// ===== Utilities =====
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}