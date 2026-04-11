const cartoDbMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' });
const esriMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

const map = L.map('map', { layers: [cartoDbMap] });
L.control.layers({ "彩色简易 (Carto)": cartoDbMap, "防报错备用 (Esri)": esriMap }).addTo(map);
// init map & layers

const isLocalDev = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

if (isLocalDev) {
    const debugPopup = L.popup();

    map.on('click', function (e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        // get mouse clicked coord

        debugPopup.setLatLng(e.latlng)
            .setContent(`
                <div style="text-align: center; font-family: monospace;">
                    <b style="color: var(--accent-color);">📍 坐标已获取</b><br><br>
                    Lat: ${lat}<br>
                    Lng: ${lng}<br>
                    <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                    <span style="font-size: 11px; color: var(--text-sub);">已打印至 F12 控制台，可直接复制</span>
                </div>
            `)
            .openOn(map);

        console.log(`【新坐标】请复制以下代码:`);
        console.log(`"lat": ${lat},\n"lng": ${lng}`);
    });
} // local dev env

let activeLayer = cartoDbMap;
// use CartoDB as default

map.on('baselayerchange', function (e) {
    activeLayer = e.layer;

    if (photos.length > 0) {
        photos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
    } // call new preload
}); // listen map layer changes

const modal = document.getElementById("image-modal");
const modalImg = document.getElementById("full-size-img");
const captionText = document.getElementById("caption");
const closeBtn = document.querySelector(".close-btn");

function openImageModal(url, title) {
    modalImg.src = url;
    captionText.innerHTML = title;
    modal.classList.add("show");
}

function closeModal() {
    modal.classList.remove("show");
    setTimeout(() => { modalImg.src = ""; }, 350);
}

closeBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});
// full screen img show

let photos = [];
const markers = {};
const markerArray = [];
const photoListContainer = document.getElementById('photo-list');
const targetZoomLevel = 14;
let activePhotoId = null;

function handlePhotoFocus(photo) {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetLatLng = L.latLng(photo.lat, photo.lng);

    const isSameLat = Math.abs(currentCenter.lat - photo.lat) < 0.0001;
    const isSameLng = Math.abs(currentCenter.lng - photo.lng) < 0.0001;
    const isSameZoom = currentZoom === targetZoomLevel;

    if (activePhotoId && activePhotoId !== photo.id) {
        markers[activePhotoId].closeTooltip();
    } // cleanup last tooltip

    if (activePhotoId === photo.id && isSameLat && isSameLng && isSameZoom) {
        markers[photo.id].openTooltip();
        openImageModal(photo.fullUrl, photo.title);
        return;
    } // same pos, open img in full screen

    activePhotoId = photo.id;

    const inBounds = map.getBounds().contains(targetLatLng);
    const streetLevelZoom = targetZoomLevel - 1;
    const isZoomedInEnough = currentZoom >= streetLevelZoom;

    if (inBounds && isZoomedInEnough) {
        const p1 = map.project(currentCenter, currentZoom);
        const p2 = map.project(targetLatLng, currentZoom);
        const slideDuration = Math.max(0.25, Math.min(0.8, p1.distanceTo(p2) / 1000));

        map.panTo(targetLatLng, { animate: true, duration: slideDuration });

        map.once('moveend', () => {
            if (activePhotoId === photo.id) markers[photo.id].openTooltip();
        }); // open tooltip after move
    } // slide (new tooltip in view & enough zoom)
    else {
        const distanceKm = currentCenter.distanceTo(targetLatLng) / 1000;
        let flyDuration = 1.5;
        if (distanceKm < 20) flyDuration = 0.6;
        else if (distanceKm < 300) flyDuration = 0.9;
        else if (distanceKm < 1500) flyDuration = 1.2;
        // calc fly duration

        map.flyTo(targetLatLng, targetZoomLevel, { duration: flyDuration });

        map.once('moveend', () => {
            if (activePhotoId === photo.id) {
                markers[photo.id].openTooltip();
            }
        }); // open tooltip after move
    } // normal fly-to
}

function preloadMapTiles(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const img = new Image();
            img.src = activeLayer.getTileUrl({ x: x + i, y: y + j, z: zoom });
        }
    }
}

async function initGallery() {
    try {
        const jsonUrl = './assets/meta.json';
        const response = await fetch(jsonUrl);

        if (!response.ok) {
            throw new Error(`网络响应不正常，状态码: ${response.status}`);
        }

        photos = await response.json();
        photos.forEach(photo => {
            const marker = L.marker([photo.lat, photo.lng])
                .bindTooltip(`<b>${photo.title}</b>`, {
                    direction: 'top',
                    offset: [-15, -5],
                    opacity: 1,
                    className: 'modern-tooltip'
                })
                .addTo(map);
            markers[photo.id] = marker;
            markerArray.push(marker);
            marker.on('mouseover', () => {
                const correspondingCard = document.getElementById(`card-${photo.id}`);
                if (correspondingCard) {
                    correspondingCard.classList.add('highlight');
                    correspondingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
            marker.on('mouseout', () => {
                const correspondingCard = document.getElementById(`card-${photo.id}`);
                if (correspondingCard) {
                    correspondingCard.classList.remove('highlight');
                }
                if (activePhotoId === photo.id) {
                    marker.openTooltip();
                } // do not close tooltip if it is the img on focus
            });
            marker.on('click', () => {
                handlePhotoFocus(photo);
            });
            // build img map tooltip

            const barDiv = document.createElement('div');
            barDiv.className = 'photo-bar';
            barDiv.id = `card-${photo.id}`;
            const locationArray = [photo.country, photo.state, photo.city];
            const locationString = locationArray.filter(item => item).join(' · ');
            barDiv.innerHTML = `
                <img src="${photo.thumbUrl}" alt="${photo.title}"> 
                <div class="info">
                    <h3>${photo.title}</h3>
                    <p class="location">${locationString}</p>
                    <p class="date">${photo.date}</p>
                </div>
            `;
            barDiv.addEventListener('click', () => {
                handlePhotoFocus(photo);
            });
            // build img bar

            photoListContainer.appendChild(barDiv);
        });

        if (markerArray.length > 0) {
            const group = new L.featureGroup(markerArray);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } // zoom wide enough to show all tooptips on the map

        setTimeout(() => {
            photos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
        }, 1500);
        // delayed preload
    } catch (error) {
        console.error("加载数据失败:", error);
        photoListContainer.innerHTML = '<div style="padding: 20px; color: #e53e3e;">未能加载摄影作品数据，请检查网络或 URL 设置。</div>';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
