// reddit.js

// Function to fetch Reddit top posts based on time period
export const fetchRedditData = async (timePeriod = 'day') => {
    if (timePeriod !== 'day' && timePeriod !== 'week') {
        throw new Error('Invalid time period specified');
    }

    const redditUrl = `https://www.reddit.com/top.json?sort=top&t=${timePeriod}`;

    try {
        const response = await fetch(redditUrl);
        const data = await response.json();

        if (data && data.data && data.data.children) {
            return data.data.children
                .filter(child => child.kind === 't3') // Filter out non-posts
                .map(child => ({
                    title: child.data.title,
                    permalink: child.data.permalink,
                    score: child.data.score,
                    preview: child.data.preview,
                    media: child.data.media
                }));
        } else {
            throw new Error('Invalid Reddit API response format');
        }
    } catch (error) {
        console.error('Error fetching Reddit data:', error);
        throw error;
    }
};

// Function to update UI with Reddit data
export const updateReddit = (data) => {
    const container = document.querySelector('#reddit .data-container');
    container.innerHTML = ''; // Clear previous data

    if (!data || data.length === 0) {
        container.innerHTML = '<p>No Reddit posts found.</p>';
        return;
    }

    // Pagination
    let currentPage = 1;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);

    const renderPage = (page) => {
        container.innerHTML = ''; // Clear previous data
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = data.slice(start, end);

        container.innerHTML = `
            <ul>
                ${pageData.map(post => `
                    <li style="margin-bottom: 20px;">
                        <a href="https://www.reddit.com${post.permalink}" target="_blank">${post.title}</a>
                        <p>Score: ${post.score}</p>
                        ${renderMedia(post)}
                    </li>
                `).join('')}
            </ul>
        `;

        // Pagination controls
        const paginationControls = document.createElement('div');
        paginationControls.classList.add('pagination-controls');

        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.onclick = () => {
                currentPage--;
                renderPage(currentPage);
            };
            paginationControls.appendChild(prevButton);
        }

        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.onclick = () => {
                currentPage++;
                renderPage(currentPage);
            };
            paginationControls.appendChild(nextButton);
        }

        container.appendChild(paginationControls);
    };

    renderPage(currentPage);
};

// Function to render media content for a Reddit post
export const renderMedia = (post) => {
    let mediaHtml = '';

    // Render videos if available
    if (post.media && post.media.reddit_video && post.media.reddit_video.fallback_url) {
        const videoSrc = post.media.reddit_video.fallback_url;
        mediaHtml += `
            <video controls class="reddit-video">
                <source src="${videoSrc}" type="video/mp4">
                Your browser does not support the video tag.
            </video><br>`;
    } else if (post.preview && post.preview.images && post.preview.images.length > 0) {
        // Render images if available and no video is present
        const imageSrc = post.preview.images[0].source.url.replace('&amp;', '&');
        mediaHtml += `<img src="${imageSrc}" alt="Reddit Image" class="reddit-thumbnail"><br>`;
    }

    return mediaHtml;
}