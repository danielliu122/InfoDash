// Get the blog container element
const blogContainer = document.getElementById('blog-container');

// Create and insert the search bar and filter controls above the blog container
const blogParent = blogContainer.parentElement;
const searchBarContainer = document.createElement('div');
searchBarContainer.style.display = 'flex';
searchBarContainer.style.flexWrap = 'wrap';
searchBarContainer.style.alignItems = 'center';
searchBarContainer.style.gap = '12px';
searchBarContainer.style.marginBottom = '18px';

// Search input
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.placeholder = 'Search posts, content, etc...';
searchInput.style.flex = '1 1 200px';
searchInput.style.padding = '8px';
searchInput.style.fontSize = '16px';

// Category select
const categorySelect = document.createElement('select');
categorySelect.style.padding = '8px';
categorySelect.style.fontSize = '16px';
categorySelect.style.minWidth = '120px';
const defaultOption = document.createElement('option');
defaultOption.value = '';
defaultOption.textContent = 'All Categories';
categorySelect.appendChild(defaultOption);

// Date filter: From
const dateFromInput = document.createElement('input');
dateFromInput.type = 'date';
dateFromInput.style.padding = '8px';
dateFromInput.style.fontSize = '16px';
dateFromInput.style.minWidth = '140px';
dateFromInput.title = 'From date';

// Date filter: To
const dateToInput = document.createElement('input');
dateToInput.type = 'date';
dateToInput.style.padding = '8px';
dateToInput.style.fontSize = '16px';
dateToInput.style.minWidth = '140px';
dateToInput.title = 'To date';

// Label for date range (optional, for accessibility)
const dateLabel = document.createElement('span');
dateLabel.textContent = 'Date:';
dateLabel.style.fontWeight = 'bold';
dateLabel.style.fontSize = '15px';

// Add controls to the search bar container
searchBarContainer.appendChild(searchInput);
searchBarContainer.appendChild(categorySelect);
searchBarContainer.appendChild(dateLabel);
searchBarContainer.appendChild(dateFromInput);
searchBarContainer.appendChild(dateToInput);

// Insert the search bar container before the blog container
blogParent.insertBefore(searchBarContainer, blogContainer);

// Pagination variables
let currentPage = 1;
const postsPerPage = 2;
let allBlogPosts = [];
let filteredBlogPosts = [];

// Function to create and append a blog post
function createBlogPost(title, content, date, href) {
    const postDiv = document.createElement('div');
    postDiv.className = 'card blog-post';

    const postTitle = document.createElement('h2');
    postTitle.textContent = title;
    
    const postDate = document.createElement('p');
    postDate.className = 'post-date';
    postDate.textContent = date;
    
    const postContent = document.createElement('div');
    postContent.className = 'post-content';
    postContent.innerHTML = content;

    // Handle YouTube embeds
    if (href && href.includes('youtube.com/watch?v=')) {
        // Extract video ID
        const videoId = href.split('v=')[1].split('&')[0];
        // Create iframe for YouTube embed
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        postContent.insertBefore(iframe, postContent.firstChild);
    }

    postDiv.appendChild(postTitle);
    postDiv.appendChild(postDate);
    postDiv.appendChild(postContent);
    
    return postDiv;
}

// Function to display posts for current page (pagination logic is here)
function displayPostsForPage(page) {
    blogContainer.innerHTML = '';
    
    const startIndex = (page - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const postsToShow = filteredBlogPosts.slice(startIndex, endIndex);
    
    postsToShow.forEach(post => {
        const postElement = createBlogPost(
            post.title, 
            post.content, 
            post.date,
            post.href
        );
        blogContainer.appendChild(postElement);
    });
    
    createPaginationControls();
}

// Function to create pagination controls (pagination UI is here)
function createPaginationControls() {
    const totalPages = Math.ceil(filteredBlogPosts.length / postsPerPage);
    
    if (totalPages <= 1) return;
    
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayPostsForPage(currentPage);
        }
    });
    
    // Page numbers
    const pageNumbers = document.createElement('div');
    pageNumbers.className = 'page-numbers';
    
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = i === currentPage ? 'active' : '';
        pageButton.addEventListener('click', () => {
            currentPage = i;
            displayPostsForPage(currentPage);
        });
        pageNumbers.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayPostsForPage(currentPage);
        }
    });
    
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageNumbers);
    paginationContainer.appendChild(nextButton);
    
    blogContainer.appendChild(paginationContainer);
}

// Helper: get unique categories from all posts
function getAllCategories(posts) {
    const categories = new Set();
    posts.forEach(post => {
        if (post.category) {
            if (Array.isArray(post.category)) {
                post.category.forEach(cat => categories.add(cat));
            } else {
                categories.add(post.category);
            }
        }
    });
    return Array.from(categories).sort();
}

// Helper: filter posts by search, category, and date
function filterPosts() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categorySelect.value;
    const dateFrom = dateFromInput.value ? new Date(dateFromInput.value) : null;
    const dateTo = dateToInput.value ? new Date(dateToInput.value) : null;

    filteredBlogPosts = allBlogPosts.filter(post => {
        // Search in title, content, and (if present) category
        let matchesSearch = true;
        if (searchTerm) {
            const inTitle = post.title && post.title.toLowerCase().includes(searchTerm);
            const inContent = post.content && post.content.toLowerCase().includes(searchTerm);
            const inCategory = post.category && (
                (Array.isArray(post.category) && post.category.some(cat => cat.toLowerCase().includes(searchTerm))) ||
                (typeof post.category === 'string' && post.category.toLowerCase().includes(searchTerm))
            );
            matchesSearch = inTitle || inContent || inCategory;
        }
        let matchesCategory = true;
        if (selectedCategory) {
            if (Array.isArray(post.category)) {
                matchesCategory = post.category.includes(selectedCategory);
            } else {
                matchesCategory = post.category === selectedCategory;
            }
        }
        let matchesDate = true;
        if ((dateFrom || dateTo) && post.date) {
            // Try to parse post.date as ISO or yyyy-mm-dd
            let postDateObj = null;
            if (typeof post.date === 'string') {
                // Acceptable formats: "2023-05-01", "2023-05-01T12:00:00Z", etc.
                postDateObj = new Date(post.date);
            } else if (post.date instanceof Date) {
                postDateObj = post.date;
            }
            if (postDateObj && !isNaN(postDateObj)) {
                if (dateFrom && postDateObj < dateFrom) matchesDate = false;
                if (dateTo) {
                    // To date is inclusive, so add 1 day to dateTo
                    let dateToPlus = new Date(dateTo);
                    dateToPlus.setDate(dateToPlus.getDate() + 1);
                    if (postDateObj >= dateToPlus) matchesDate = false;
                }
            }
        }
        return matchesSearch && matchesCategory && matchesDate;
    });
}

// Update category select options
function updateCategoryOptions(posts) {
    // Remove all except the first (default) option
    while (categorySelect.options.length > 1) {
        categorySelect.remove(1);
    }
    const categories = getAllCategories(posts);
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
}

// Load blog posts from blog.json when the page loads
window.addEventListener('load', async () => {
    try {
        const response = await fetch('./data/blog.json');
        if (!response.ok) {
            throw new Error('Failed to load blog posts');
        }
        allBlogPosts = await response.json();

        updateCategoryOptions(allBlogPosts);

        // Initial filter (no search, all categories, all dates)
        filterPosts();
        currentPage = 1;
        displayPostsForPage(currentPage);
    } catch (error) {
        console.error('Error loading blog posts:', error);
        blogContainer.innerHTML = '<p>Error loading blog posts. Please try again later.</p>';
    }
});

// Event listeners for search, category, and date filters
searchInput.addEventListener('input', () => {
    filterPosts();
    currentPage = 1;
    displayPostsForPage(currentPage);
});
categorySelect.addEventListener('change', () => {
    filterPosts();
    currentPage = 1;
    displayPostsForPage(currentPage);
});
dateFromInput.addEventListener('change', () => {
    filterPosts();
    currentPage = 1;
    displayPostsForPage(currentPage);
});
dateToInput.addEventListener('change', () => {
    filterPosts();
    currentPage = 1;
    displayPostsForPage(currentPage);
});
