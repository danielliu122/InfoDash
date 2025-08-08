// Get the blog container element
const blogContainer = document.getElementById('blog-container');

// Function to create and append a blog post
function createBlogPost(title, content, date, thumbnail, href) {
    const postDiv = document.createElement('div');
    postDiv.className = 'blog-post';

    const postTitle = document.createElement('h2');
    postTitle.textContent = title;
    
    const postDate = document.createElement('p');
    postDate.className = 'post-date';
    postDate.textContent = date;
    
    const postContent = document.createElement('div');
    postContent.innerHTML = content;

    // Add thumbnail if provided
    if (thumbnail) {
        const thumbnailLink = document.createElement('a');
        thumbnailLink.href = href || '#';
        const thumbnailImg = document.createElement('img');
        thumbnailImg.src = thumbnail;
        thumbnailImg.alt = title;
        thumbnailImg.className = 'zoom';
        thumbnailImg.style.display = 'block';
        thumbnailLink.appendChild(thumbnailImg);
        postContent.insertBefore(thumbnailLink, postContent.firstChild);
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
                post.thumbnail,
                post.href
            );
        });
    } catch (error) {
        console.error('Error loading blog posts:', error);
        blogContainer.innerHTML = '<p>Error loading blog posts. Please try again later.</p>';
    }
});
