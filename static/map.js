const photos = [
    { id: 1, title: "莱茵塔", country: "德国", state: "北莱茵-威斯特法伦州", city: "杜塞尔多夫", date: "2023年10月", url: "https://via.placeholder.com/600x400/4299e1/ffffff?text=Rhine+Tower", lat: 51.2179, lng: 6.7628 },
    { id: 2, title: "勃兰登堡门", country: "德国", state: "", city: "柏林", date: "2023年12月", url: "https://via.placeholder.com/600x400/48bb78/ffffff?text=Brandenburg+Gate", lat: 52.5163, lng: 13.3777 },
    { id: 3, title: "玛利亚广场", country: "德国", state: "巴伐利亚州", city: "慕尼黑", date: "2024年1月", url: "https://via.placeholder.com/600x400/ed8936/ffffff?text=Marienplatz", lat: 48.1372, lng: 11.5756 },
    { id: 4, title: "微缩景观世界", country: "德国", state: "", city: "汉堡", date: "2024年3月", url: "https://via.placeholder.com/600x400/9f7aea/ffffff?text=Miniatur+Wunderland", lat: 53.5438, lng: 9.9890 },
    { id: 5, title: "科隆大教堂", country: "德国", state: "北莱茵-威斯特法伦州", city: "科隆", date: "2024年4月", url: "https://via.placeholder.com/600x400/e53e3e/ffffff?text=Cologne+Cathedral", lat: 50.9413, lng: 6.9583 }
];

const esriMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
const colorfulSimpleMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' });

const map = L.map('map', { layers: [esriMap] });
L.control.layers({ "防报错备用 (Esri)": esriMap, "彩色简易 (Carto)": colorfulSimpleMap }).addTo(map);

const markers = {}; 
const markerArray = []; 

// 核心更新 2：给卡片赋予唯一 ID，与地图上的 Marker 建立联系
const photoListContainer = document.getElementById('photo-list');
const targetZoomLevel = 14;

// 【新增 1】：用于记录当前系统聚焦的照片 ID
let activePhotoId = null;

// 【新增 2】：核心点击处理函数 (抽取为公共逻辑)
function handlePhotoFocus(photo) {
    // 获取当前地图实时的中心点经纬度和缩放级别
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // 判断地图是否完全聚焦在目标点 (由于浮点数精度问题，我们允许 0.0001 的微小误差)
    const isSameLat = Math.abs(currentCenter.lat - photo.lat) < 0.0001;
    const isSameLng = Math.abs(currentCenter.lng - photo.lng) < 0.0001;
    const isSameZoom = currentZoom === targetZoomLevel;

    // 核心判断逻辑：如果是同一张图，且地图完全没被挪动过
    if (activePhotoId === photo.id && isSameLat && isSameLng && isSameZoom) {
        // TODO: 这里是为你下一步预留的“打开大图”接口
        console.log(`[准备就绪] 触发打开照片大图: ${photo.title}`);
        
        // 确保气泡依然是打开状态
        markers[photo.id].openTooltip();
        
        // 【关键】：直接返回，终止函数，不再执行下方的 flyTo
        return; 
    }

    // 如果地图被挪动过，或者是点击了新照片：执行正常聚焦飞行
    activePhotoId = photo.id; // 更新当前聚焦的 ID
    map.flyTo([photo.lat, photo.lng], targetZoomLevel, { duration: 1.5 });
    markers[photo.id].openTooltip();
}

// 核心更新 1：使用 Tooltip 替代 Popup，并绑定鼠标悬浮事件
photos.forEach(photo => {
    const marker = L.marker([photo.lat, photo.lng])
        .bindTooltip(`<b>${photo.title}</b>`, {
            direction: 'top',      
            // 修复错位：默认图标宽25px，高41px，锚点在底部中心。
            // X轴偏移0，Y轴向上偏移40像素，刚好悬浮在图标正上方
            offset: [-15, -5],      
            opacity: 1,            // 改为1（不透明），因为我们在CSS中已经用阴影做好了层次感
            className: 'modern-tooltip' // 【新增】应用我们刚刚写好的现代化 CSS 样式
        })
        .addTo(map);
        
    markers[photo.id] = marker; 
    markerArray.push(marker);   

    // 当鼠标移入地图图标时 (逻辑保持不变)
    marker.on('mouseover', () => {
        const correspondingCard = document.getElementById(`card-${photo.id}`);
        if (correspondingCard) {
            correspondingCard.classList.add('highlight'); 
            correspondingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    // 当鼠标移出地图图标时 (逻辑保持不变)
    marker.on('mouseout', () => {
        const correspondingCard = document.getElementById(`card-${photo.id}`);
        if (correspondingCard) {
            correspondingCard.classList.remove('highlight'); 
        }
    });

    marker.on('click', () => {
        handlePhotoFocus(photo);
    });

    // --- 2. 创建左侧条状卡片部分 ---
    const barDiv = document.createElement('div');
    barDiv.className = 'photo-bar';
    barDiv.id = `card-${photo.id}`; // 给卡片打上标签，方便地图找到它
    
    const locationArray = [photo.country, photo.state, photo.city];
    const locationString = locationArray.filter(item => item).join(' · ');
    
    barDiv.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}">
        <div class="info">
            <h3>${photo.title}</h3>
            <p class="location">${locationString}</p>
            <p class="date">${photo.date}</p>
        </div>
    `;
    
    barDiv.addEventListener('click', () => {
        handlePhotoFocus(photo);
    });
    
    photoListContainer.appendChild(barDiv);
});

const group = new L.featureGroup(markerArray);
map.fitBounds(group.getBounds(), { padding: [50, 50] });

// 后台预加载地图瓦片
function preloadMapTiles(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const img = new Image();
            img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y + j}/${x + i}`;
        }
    }
}

window.addEventListener('load', () => {
    setTimeout(() => {
        photos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
    }, 1500); 
});