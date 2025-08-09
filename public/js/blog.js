// Get the blog container element
const blogContainer = document.getElementById('blog-container');

// Function to create and append a blog post
function createBlogPost(title, content, date, href) {
    const postDiv = document.createElement('div');
    postDiv.className = 'card blog-post';

    const postTitle = document.createElement('h2');
    postTitle.textContent = title;
    
    const postDate = document.createElement('p');
    postDate.className = 'post-date';
    postDate.textContent = date;
    
    const postContent = document.createElement('post-content');
    postDate.className = 'video-container';
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
    
    blogContainer.appendChild(postDiv);
}

// Load blog posts from blog.json when the page loads
window.addEventListener('load', async () => {
    try {
        const response = await fetch('./data/blog.json');
        if (!response.ok) {
            throw new Error('Failed to load blog posts');
        }
        const blogPosts = await response.json();
        
        blogPosts.forEach(post => {
            createBlogPost(
                post.title, 
                post.content, 
                post.date,
                post.href
            );
        });
    } catch (error) {
        console.error('Error loading blog posts:', error);
        blogContainer.innerHTML = '<p>Error loading blog posts. Please try again later.</p>';
    }
});
