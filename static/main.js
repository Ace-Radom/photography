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

    if (landscapePhotos.length > 0) {
        landscapePhotos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
        preloadMacroMap(landscapePhotos);
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

let landscapePhotos = [];
let figurePhotos = [];
const markers = {};
const markerArray = [];
const landscapeListContainer = document.getElementById('landscape-list');
const figureListContainer = document.getElementById('figure-list')
const targetZoomLevel = 14;
let activePhotoId = null;

function handleLandscapePhotoFocus(photo) {
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

function handleFigurePhotoFocus(photo) {
    openImageModal(photo.fullUrl, photo.title);
}

function latLngToTile(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
}

function preloadMapTileImg(x, y, zoom) {
    const tileData = {
        x: x,
        y: y,
        z: zoom,
        s: activeLayer._getSubdomain ? activeLayer._getSubdomain({ x: x, y: y }) : 'a',
        r: L.Browser.retina ? '@2x' : ''
    };
    const tileUrl = L.Util.template(activeLayer._url, L.extend({}, activeLayer.options, tileData));
    const img = new Image();
    img.src = tileUrl;
}

function preloadMapTiles(lat, lng, zoom) {
    const { x, y } = latLngToTile(lat, lng, zoom);

    for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
            preloadMapTileImg(x + i, y + j, zoom);
        }
    }
}

function preloadMacroMap(photosList) {
    if (!photosList || photosList.length === 0) return;

    const latLngs = photosList.map(p => L.latLng(p.lat, p.lng));
    const bounds = L.latLngBounds(latLngs);
    const macroZoom = Math.max(1, map.getBoundsZoom(bounds) - 1);

    const northWest = bounds.getNorthWest();
    const southEast = bounds.getSouthEast();

    const nwTile = latLngToTile(northWest.lat, northWest.lng, macroZoom);
    const seTile = latLngToTile(southEast.lat, southEast.lng, macroZoom);

    for (let x = nwTile.x; x <= seTile.x; x++) {
        for (let y = nwTile.y; y <= seTile.y; y++) {
            preloadMapTileImg(x, y, macroZoom);
        }
    }
}

function createYearDivider(year) {
    const yearDivider = document.createElement('div');
    yearDivider.className = 'year-divider';
    yearDivider.innerHTML = `
        <span>${year} 年</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    `;

    const groupForThisYear = document.createElement('div');
    groupForThisYear.className = 'year-group';

    const innerWrapper = document.createElement('div');
    innerWrapper.className = 'year-group-inner';
    groupForThisYear.appendChild(innerWrapper);
    // wrapper for show / hide animation

    yearDivider.addEventListener('click', () => {
        yearDivider.classList.toggle('collapsed');
        groupForThisYear.classList.toggle('collapsed');
    }); // click to show / hide

    return { yearDivider, groupForThisYear, innerWrapper };
}

async function initGallery() {
    try {
        const metaUrl = (isLocalDev) ? './assets/meta.json' : 'https://raw.githubusercontent.com/Ace-Radom/photography/refs/heads/main/assets/meta.json';
        const derivativeIconSvgUrl = (isLocalDev) ? './assets/icon-derivative.svg' : 'https://raw.githubusercontent.com/Ace-Radom/photography/refs/heads/main/assets/icon-derivative.svg';

        const [metaResponse, derivativeIconSvgResponse] = await Promise.all([
            fetch(metaUrl),
            fetch(derivativeIconSvgUrl)
        ]);

        if (!metaResponse.ok) {
            throw new Error(`数据获取失败，状态码: ${metaResponse.status}`);
        }
        if (!derivativeIconSvgResponse.ok) {
            throw new Error(`图标获取失败，状态码: ${metaResponse.status}`);
        }

        let metaString = await metaResponse.json();
        let derivativeIconSvgString = await derivativeIconSvgResponse.text();

        // ============================
        // Init Landscape Photo Gallery
        // ============================

        landscapePhotos = metaString.landscape || [];
        landscapePhotos.sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            if (b.month !== a.month) return b.month - a.month;
            if (b.day !== a.day) return b.day - a.day;
            return b.id - a.id;
        }); // sort

        let lastYear = null;
        let currentYearGroup = null;
        landscapePhotos.forEach(photo => {
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
                const correspondingCard = document.getElementById(`landscape-card-${photo.id}`);
                if (correspondingCard) {
                    correspondingCard.classList.add('highlight');
                    correspondingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
            marker.on('mouseout', () => {
                const correspondingCard = document.getElementById(`landscape-card-${photo.id}`);
                if (correspondingCard) {
                    correspondingCard.classList.remove('highlight');
                }
                if (activePhotoId === photo.id) {
                    marker.openTooltip();
                } // do not close tooltip if it is the img on focus
            });
            marker.on('click', () => {
                handleLandscapePhotoFocus(photo);
            });
            // build img map tooltip

            if (photo.year !== lastYear) {
                const { yearDivider, groupForThisYear, innerWrapper } = createYearDivider(photo.year);
                landscapeListContainer.appendChild(yearDivider);
                landscapeListContainer.appendChild(groupForThisYear);
                lastYear = photo.year;
                currentYearGroup = innerWrapper;
            } // update year tag if needed

            const barDiv = document.createElement('div');
            barDiv.className = 'photo-bar';
            barDiv.id = `landscape-card-${photo.id}`;
            const locationArray = [photo.country, photo.state, photo.city];
            const locationString = locationArray.filter(item => item).join(' · ');
            const dateString = `${photo.year}年${photo.month}月${photo.day}日`;
            let tag = '';
            if (photo.type === 'derivative') {
                tag = `
                <div class="creative-indicator" data-tooltip="这是一幅二创作品">
                    ${derivativeIconSvgString}
                </div>
                `
            } // derivative work
            barDiv.innerHTML = `
                <img src="${photo.thumbUrl}" alt="${photo.title}"> 
                <div class="info">
                    <h3>${photo.title}</h3>
                    <p class="location">${locationString}</p>
                    <p class="date">${dateString}</p>
                </div>
                ${tag}
            `;
            barDiv.addEventListener('click', () => {
                handleLandscapePhotoFocus(photo);
            });
            // build img card

            currentYearGroup.appendChild(barDiv);
        });

        if (markerArray.length > 0) {
            const group = new L.featureGroup(markerArray);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } // zoom wide enough to show all tooptips on the map

        setTimeout(() => {
            landscapePhotos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
            preloadMacroMap(landscapePhotos);
        }, 1500);
        // delayed map preload

        // =========================
        // Init Figure Photo Gallery
        // =========================

        figurePhotos = metaString.figure || [];
        figurePhotos.sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            if (b.month !== a.month) return b.month - a.month;
            if (b.day !== a.day) return b.day - a.day;
            return b.id - a.id;
        }); // sort

        lastYear = null;
        currentYearGroup = null;
        figurePhotos.forEach(photo => {
            if (photo.year !== lastYear) {
                const { yearDivider, groupForThisYear, innerWrapper } = createYearDivider(photo.year);
                figureListContainer.appendChild(yearDivider);
                figureListContainer.appendChild(groupForThisYear);
                lastYear = photo.year;
                currentYearGroup = innerWrapper;
            } // update year tag if needed

            const barDiv = document.createElement('div');
            barDiv.className = 'photo-bar';
            barDiv.id = `figure-card-${photo.id}`;
            const dateString = `${photo.year}年${photo.month}月${photo.day}日`;
            let tag = '';
            if (photo.type === 'derivative') {
                tag = `
                <div class="creative-indicator" data-tooltip="这是一幅二创作品">
                    ${derivativeIconSvgString}
                </div>
                `
            } // derivative work
            barDiv.innerHTML = `
                <img src="${photo.thumbUrl}" alt="${photo.title}"> 
                <div class="info">
                    <h3>${photo.title}</h3>
                    <p class="original-title">${photo["title-original"]}</p>
                    <p class="date">${dateString}</p>
                </div>
                ${tag}
            `;
            barDiv.addEventListener('click', () => {
                handleFigurePhotoFocus(photo);
            });
            // build img card

            currentYearGroup.appendChild(barDiv);
        });

    } catch (error) {
        console.error("加载数据失败:", error);
        landscapeListContainer.innerHTML = '<div style="padding: 20px; color: #e53e3e;">未能加载摄影作品数据，请检查网络或 URL 设置。</div>';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
