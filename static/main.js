// 1. 初始化地图和图层 (这部分不需要等数据，直接运行)
const colorfulSimpleMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' });
const esriMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

const map = L.map('map', { layers: [colorfulSimpleMap] });
L.control.layers({ "彩色简易 (Carto)": colorfulSimpleMap, "防报错备用 (Esri)": esriMap }).addTo(map);

// ==========================================
// 【新增逻辑 1】：跟踪当前激活的地图图层
// ==========================================
let activeLayer = colorfulSimpleMap; // 默认是 esriMap

// 监听 Leaflet 的图层切换事件
map.on('baselayerchange', function (e) {
    activeLayer = e.layer; // 更新为用户选中的新图层
    console.log("检测到图层切换，开始预加载新图层...");
    
    // 切换图层后，立刻对新图层执行一轮预加载
    if (photos.length > 0) {
        photos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
    }
});

// ==========================================
// 【新增】：全屏浮窗控制逻辑
// ==========================================
const modal = document.getElementById("image-modal");
const modalImg = document.getElementById("full-size-img");
const captionText = document.getElementById("caption");
const closeBtn = document.querySelector(".close-btn");

function openImageModal(url, title) {
    modalImg.src = url;               // 填入高清图 URL
    captionText.innerHTML = title;    // 填入标题
    modal.classList.add("show");      // 触发 CSS 动画显示浮窗
}

function closeModal() {
    modal.classList.remove("show");   // 触发 CSS 动画隐藏浮窗
    // 延迟清除 src，防止旧图在下次打开的瞬间闪烁
    setTimeout(() => { modalImg.src = ""; }, 350); 
}

// 绑定关闭事件：点击 X 按钮
closeBtn.addEventListener('click', closeModal);

// 绑定关闭事件：点击照片外围的空白/模糊背景也能关闭
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// 2. 准备全局变量
let photos = []; // 改为 let，因为数据是后来装进去的
const markers = {}; 
const markerArray = []; 
const photoListContainer = document.getElementById('photo-list');
const targetZoomLevel = 14;
let activePhotoId = null;

// 3. 点击卡片或图标的公共处理函数
function handlePhotoFocus(photo) {
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const targetLatLng = L.latLng(photo.lat, photo.lng); 

    const isSameLat = Math.abs(currentCenter.lat - photo.lat) < 0.0001;
    const isSameLng = Math.abs(currentCenter.lng - photo.lng) < 0.0001;
    const isSameZoom = currentZoom === targetZoomLevel;

    // ==========================================
    // 【核心修复 1】：手动清理上一个残留的弹窗
    // ==========================================
    if (activePhotoId && activePhotoId !== photo.id) {
        markers[activePhotoId].closeTooltip();
    }

    // 如果已经在目标位置，直接确保弹窗打开并返回
    if (activePhotoId === photo.id && isSameLat && isSameLng && isSameZoom) {
        console.log(`[准备就绪] 触发打开照片大图: ${photo.title}`);
        markers[photo.id].openTooltip();

        // ==========================================
        // 【核心连结】：在这里调用刚写好的开窗函数！
        // ==========================================
        openImageModal(photo.fullUrl, photo.title);

        return; 
    }

    // 更新当前激活的照片 ID
    activePhotoId = photo.id;

    const inBounds = map.getBounds().contains(targetLatLng);
    const streetLevelZoom = targetZoomLevel - 1; 
    const isZoomedInEnough = currentZoom >= streetLevelZoom; 

    if (inBounds && isZoomedInEnough) {
        // 平移逻辑
        const p1 = map.project(currentCenter, currentZoom);
        const p2 = map.project(targetLatLng, currentZoom);
        const slideDuration = Math.max(0.25, Math.min(0.8, p1.distanceTo(p2) / 1000));

        map.panTo(targetLatLng, { animate: true, duration: slideDuration });
        
        // ==========================================
        // 【核心修复 2】：等待平移动画结束后再打开气泡
        // map.once('moveend', ...) 意味着“只监听下一次地图停止移动的时刻”
        // ==========================================
        map.once('moveend', () => {
            if (activePhotoId === photo.id) markers[photo.id].openTooltip();
        });
        
    } else {
        // 飞行缩放逻辑
        const distanceKm = currentCenter.distanceTo(targetLatLng) / 1000;
        let flyDuration = 1.5; 
        if (distanceKm < 20) flyDuration = 0.6; 
        else if (distanceKm < 300) flyDuration = 0.9; 
        else if (distanceKm < 1500) flyDuration = 1.2; 

        map.flyTo(targetLatLng, targetZoomLevel, { duration: flyDuration });

        // ==========================================
        // 【核心修复 2】：等待飞行缩放彻底结束后再打开气泡
        // ==========================================
        map.once('moveend', () => {
            // 增加一层判断：防止在飞行过程中，用户又手快点击了其他卡片
            if (activePhotoId === photo.id) {
                markers[photo.id].openTooltip();
            }
        });
    }
}

// 4. 后台预加载地图瓦片函数
function preloadMapTiles(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const img = new Image();
                // 核心黑科技：不再手写 URL，而是传入坐标对象，让当前激活的图层自己生成对应的真实链接！
                img.src = activeLayer.getTileUrl({ x: x + i, y: y + j, z: zoom });
            }
        }
}

// ==========================================
// 5. 【核心更新】：异步加载数据并渲染界面
// ==========================================
async function initGallery() {
    try {
        // 请将此处的 URL 替换为你真实的 meta.json 网络地址
        // 如果是本地测试，且 json 文件与 html 在同一目录下，可以写 './assets/meta.json'
        const jsonUrl = './assets/meta.json'; 
        
        // 发起网络请求获取数据
        const response = await fetch(jsonUrl);
        
        if (!response.ok) {
            throw new Error(`网络响应不正常，状态码: ${response.status}`);
        }

        // 将获取到的 JSON 文本解析为 JavaScript 数组
        photos = await response.json();

        // 数据加载成功后，开始渲染地图标记和左侧卡片
        photos.forEach(photo => {
            // --- 创建地图图标 ---
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
                // ==========================================
                // 【核心修复 3】：如果是当前正在聚焦的照片，拒绝自动关闭气泡
                // ==========================================
                if (activePhotoId === photo.id) {
                    marker.openTooltip(); 
                }
            });

            marker.on('click', () => {
                handlePhotoFocus(photo);
            });

            // --- 创建左侧条状卡片 ---
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
            
            photoListContainer.appendChild(barDiv);
        });

        // 所有的 marker 都创建好之后，缩放地图边界
        if (markerArray.length > 0) {
            const group = new L.featureGroup(markerArray);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

        // 延迟执行地图预加载，避免抢占图片资源带宽
        setTimeout(() => {
            photos.forEach(photo => preloadMapTiles(photo.lat, photo.lng, targetZoomLevel));
        }, 1500);

    } catch (error) {
        // 如果读取 json 失败，会在控制台和左侧栏给出提示
        console.error("加载数据失败:", error);
        photoListContainer.innerHTML = '<div style="padding: 20px; color: #e53e3e;">未能加载摄影作品数据，请检查网络或 URL 设置。</div>';
    }
}

// 页面加载时执行主函数
window.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
