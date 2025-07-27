// Sidebar Navigation Functionality
class SidebarNavigation {
    constructor() {
        this.sidebar = null;
        this.sidebarToggle = null;
        this.sidebarOverlay = null;
        this.mainContent = null;
        this.currentPage = this.getCurrentPage();
        
        this.init();
    }
    
    init() {
        this.loadSidebar();
        this.setupEventListeners();
        this.setActivePage();
    }
    
    async loadSidebar() {
        try {
            const response = await fetch('/components/navigation.html');
            const sidebarHTML = await response.text();
            
            // Insert sidebar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
            
            // Get references to elements
            this.sidebar = document.getElementById('sidebar');
            this.sidebarToggle = document.getElementById('sidebarToggle');
            this.sidebarOverlay = document.getElementById('sidebarOverlay');
            this.mainContent = document.getElementById('mainContent');
            
            // Move existing content into main-content wrapper
            const existingContent = document.querySelector('header, main');
            if (existingContent) {
                const allContent = Array.from(document.body.children).filter(child => 
                    !child.classList.contains('sidebar') && 
                    !child.classList.contains('sidebar-overlay') &&
                    !child.classList.contains('main-content')
                );
                
                allContent.forEach(element => {
                    this.mainContent.appendChild(element);
                });
            }
            
        } catch (error) {
            console.error('Error loading sidebar:', error);
        }
    }
    
    setupEventListeners() {
        // Toggle sidebar on mobile
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        
        // Close sidebar when clicking overlay
        if (this.sidebarOverlay) {
            this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        }
        
        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.nav-link')) {
                this.handleNavClick(e);
            }
        });
        
        // Close sidebar on window resize if mobile
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeSidebar();
            }
        });
    }
    
    toggleSidebar() {
        if (this.sidebar && this.sidebarOverlay) {
            this.sidebar.classList.toggle('active');
            this.sidebarOverlay.classList.toggle('active');
        }
    }
    
    closeSidebar() {
        if (this.sidebar && this.sidebarOverlay) {
            this.sidebar.classList.remove('active');
            this.sidebarOverlay.classList.remove('active');
        }
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        // Map filenames to page identifiers
        const pageMap = {
            'index.html': 'summary',
            'news.html': 'news',
            'finance.html': 'finance',
            'trends.html': 'trends',
            'reddit.html': 'reddit'
        };
        
        return pageMap[filename] || 'summary';
    }
    
    setActivePage() {
        // Remove active class from all nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class to current page
        const currentNavLink = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (currentNavLink) {
            currentNavLink.classList.add('active');
        }
    }
    
    handleNavClick(e) {
        const link = e.target.closest('.nav-link');
        const page = link.getAttribute('data-page');
        
        // Update active state immediately for better UX
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 768) {
            this.closeSidebar();
        }
    }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SidebarNavigation();
});

// Export for use in other modules
window.SidebarNavigation = SidebarNavigation;
