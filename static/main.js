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

function handleFigurePhotoFocus(photo, hpoiData) {
    const viewContainer = document.getElementById('figure-view');
    const hpoiId = photo['hpoi-id'];

    const detailData = hpoiData[hpoiId];
    if (!detailData) {
        viewContainer.innerHTML = `<div class="placeholder-msg">未找到 ID 为 ${hpoiId} 的详细资料</div>`;
        return;
    }

    const shipmentDate = detailData.shipment_date_year
        ? `${detailData.shipment_date_year}年${detailData.shipment_date_month}月${detailData.shipment_date_day}日`
        : "未知";

    viewContainer.innerHTML = `
        <div class="figure-detail-container">
            <header class="figure-header">
                <h1>${detailData.title}</h1>
                <div class="original-name">${detailData.original_title}</div>
            </header>

            <div class="figure-content">
                <div class="figure-visual">
                    <div class="img-display-frame">
                        <img id="detail-main-img" 
                             src="${photo.fullUrl}" 
                             alt="${detailData.title}">
                    </div>
                    
                    <div class="view-selector">
                        <button class="view-tab-btn active" data-type="work">个人摄影作品</button>
                        <button class="view-tab-btn" data-type="official">官方资料图</button>
                    </div>
                </div>

                <div class="figure-specs">
                    <div class="spec-item">
                        <span class="spec-label">制作</span>
                        <span class="spec-value">${detailData.manufacture}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">系列</span>
                        <span class="spec-value">${detailData.series}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">角色</span>
                        <span class="spec-value">${detailData.character}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">作品</span>
                        <span class="spec-value">${detailData.work}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">价格</span>
                        <span class="spec-value">${detailData.price}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">发售日</span>
                        <span class="spec-value">${shipmentDate}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">比例与尺寸</span>
                        <span class="spec-value">${detailData.ratio} / ${detailData.size}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">材质</span>
                        <span class="spec-value">${detailData.material}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const mainImg = viewContainer.querySelector('#detail-main-img');
    const tabs = viewContainer.querySelectorAll('.view-tab-btn');

    mainImg.style.transition = 'opacity 0.2s ease';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active')) {
                return;
            }

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const type = tab.dataset.type;
            const targetSrc = (type === 'official') ? detailData.official_img_url : photo.fullUrl;
            mainImg.style.opacity = '0.4';
            setTimeout(() => {
                mainImg.src = targetSrc;
                mainImg.onload = () => { mainImg.style.opacity = '1'; };
                mainImg.onerror = () => {
                    mainImg.style.opacity = '1';
                    console.error("图片加载失败:", targetSrc);
                };
                if (type === 'official') {
                    mainImg.style.cursor = 'default';
                    mainImg.onclick = null;
                } else {
                    mainImg.style.cursor = 'zoom-in';
                    mainImg.onclick = () => openImageModal(photo.fullUrl, photo.title);
                } // only zoom on self
                mainImg.onload = () => { mainImg.style.opacity = '1'; };
            }, 150);
        });
    });
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
        const hpoiUrl = (isLocalDev) ? './assets/hpoi.json' : 'https://raw.githubusercontent.com/Ace-Radom/photography/refs/heads/main/assets/hpoi.json';
        const derivativeIconSvgUrl = (isLocalDev) ? './assets/icon-derivative.svg' : 'https://raw.githubusercontent.com/Ace-Radom/photography/refs/heads/main/assets/icon-derivative.svg';

        const [metaResponse, hpoiResponse, derivativeIconSvgResponse] = await Promise.all([
            fetch(metaUrl),
            fetch(hpoiUrl),
            fetch(derivativeIconSvgUrl)
        ]);

        if (!metaResponse.ok || !hpoiResponse.ok) {
            throw new Error(`数据获取失败，状态码: ${metaResponse.status}`);
        }
        if (!derivativeIconSvgResponse.ok) {
            throw new Error(`图标获取失败，状态码: ${metaResponse.status}`);
        }

        let metaData = await metaResponse.json();
        let hpoiData = await hpoiResponse.json();
        let derivativeIconSvgString = await derivativeIconSvgResponse.text();

        // ============================
        // Init Landscape Photo Gallery
        // ============================

        landscapePhotos = metaData.landscape || [];
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

        figurePhotos = metaData.figure || [];
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
                handleFigurePhotoFocus(photo, hpoiData);
            });
            // build img card

            currentYearGroup.appendChild(barDiv);
        });

    } catch (error) {
        console.error("加载数据失败:", error);
        landscapeListContainer.innerHTML = '<div style="padding: 20px; color: #e53e3e;">未能加载摄影作品数据，请检查网络设置。</div>';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
