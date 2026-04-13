window.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.photo-sidebar');
    sidebar.addEventListener('mouseenter', () => {
        sidebar.classList.add('show-scrollbar');
    });
    sidebar.addEventListener('mouseleave', () => {
        sidebar.classList.remove('show-scrollbar');
    });
    // sidebar
});