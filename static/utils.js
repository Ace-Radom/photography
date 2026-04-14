window.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.photo-sidebar');
    sidebar.addEventListener('mouseenter', () => {
        sidebar.classList.add('show-scrollbar');
    });
    sidebar.addEventListener('mouseleave', () => {
        sidebar.classList.remove('show-scrollbar');
    });
    // sidebar

    const segments = document.querySelectorAll('.segment-btn');
    const listSections = document.querySelectorAll('.list-section');
    const contentSections = document.querySelectorAll('.content-section');
    segments.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;
            // btn activated

            segments.forEach(b => b.classList.remove('active'));
            listSections.forEach(l => l.classList.remove('active'));
            contentSections.forEach(c => c.classList.remove('active'));
            // remove active status

            btn.classList.add('active');
            const target = btn.dataset.target; // 'landscape' or 'figure'           
            document.getElementById(`${target}-list`).classList.add('active');
            document.getElementById(`${target}-view`).classList.add('active');
            // add active status to selected btn & section

            if (target === 'landscape' && typeof map !== 'undefined') {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
                // wait for DOM redraw, then recalc map container size
            } // fix leaflet re-render bug after changing to display:none
        });
    });
    // section select
});