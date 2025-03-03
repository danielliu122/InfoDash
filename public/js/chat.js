const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

// Initialize conversation memory
let conversationHistory = [];
let userMessageCount = 0; // Counter for user messages
const maxMessages = 100; // Maximum allowed messages
// let tokensUsed = 0; // Counter for tokens used
// const maxTokens = 99999; // Maximum allowed tokens for API calls

sendButton.addEventListener('click', async () => {
    const userMessage = chatInput.value;
    if (!userMessage) return;

    // Check if the user has reached the maximum message limit
    // if (userMessageCount >= maxMessages) {
    //     alert('You have reached the maximum number of messages allowed for this session.');
    //     return;
    // }

    // Check if the user has enough tokens
    // const estimatedUserTokens = estimateTokens(userMessage); // Estimate tokens for user message
    // if (tokensUsed + estimatedUserTokens > maxTokens) {
    //     alert('You have reached the maximum number of tokens allowed for API calls.');
    //     return;
    // }

    // Disable the send button to prevent spamming
    sendButton.disabled = true;

    // Display user message
    appendMessage('You: ' + userMessage);
    conversationHistory.push(userMessage); // Store user message
    chatInput.value = '';
    userMessageCount++; // Increment the message count
    //tokensUsed += estimatedUserTokens; // Increment tokens used for user message

    // Send message to the AI model with conversation history
    const response = await fetchAIResponse(conversationHistory);
    appendMessage('AI: ' + response, true);

    // // Estimate tokens for AI response and update total tokens used
    // const estimatedAIResponseTokens = estimateTokens(response);
    // tokensUsed += estimatedAIResponseTokens; // Increment tokens used for AI response

    // // Check if the total tokens used exceed the limit
    // if (tokensUsed > maxTokens) {
    //     alert('You have exceeded the maximum number of tokens allowed for API calls.');
    //     // Optionally, you can reset the conversation or take other actions here
    // }

    // Re-enable the send button after a 5-second delay
    setTimeout(() => {
        sendButton.disabled = false;
    }, 5000); // 5000 milliseconds = 5 seconds
});

// Function to estimate tokens based on message length
// function estimateTokens(message) {
//     // Simple estimation: 1 token per word (adjust as necessary)
//     return message.split(' ').length;
// }

function appendMessage(message, isAI = false) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;

    // Append to chat log for both user and AI messages
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // Scroll to the bottom
}

async function fetchAIResponse(history) {
    try {
        const selectedModel = document.getElementById('model-select').value;
        const lastMessage = history[history.length - 1];
        
        // Check if it's a lookup request
        if (lastMessage.toLowerCase().includes('lookup:')) {
            const query = lastMessage.split('lookup:')[1].trim();
            return await handleLookupWithReasoning(query, history, selectedModel);
        }

        // Regular chat response
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                messages: history,
                model: selectedModel 
            }),
        });
        const data = await response.json();
        return data.reply || 'Sorry, I did not understand that.';
    } catch (error) {
        console.error('Error fetching AI response:', error);
        return 'Error: Unable to get response.';
    }
}

async function handleLookupWithReasoning(query, history, model) {
    try {
        const lookupResult = await performOnlineLookup(query);
        
        if (lookupResult) {
            const messages = [
                ...history.slice(0, -1),
                {
                    role: 'user',
                    content: `Based on this information: "${lookupResult}", answer: ${query}`
                }
            ];

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    messages,
                    model 
                }),
            });
            const data = await response.json();
            return data.reply;
        }
        
        const messages = [
            ...history.slice(0, -1),
            {
                role: 'user',
                content: `Explain or answer: ${query}`
            }
        ];

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                messages,
                model 
            }),
        });
        const data = await response.json();
        return data.reply;
    } catch (error) {
        console.error('Error handling lookup with reasoning:', error);
        return 'Error: Unable to process your request.';
    }
}

async function performOnlineLookup(query) {
    try {
        const response = await fetch('/api/lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error('Error performing online lookup:', error);
        return null;
    }
}