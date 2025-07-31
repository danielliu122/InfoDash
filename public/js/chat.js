const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

// Allow sending message with Enter key
chatInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendButton.click();
    }
});

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

function isSimpleQuery(message) {
    const trimmed = message.trim().toLowerCase();
    
    // Exclude greetings and small talk
    if (/^(hi|hello|hey|how are you|what's up|sup)[!., ]*$/i.test(trimmed)) return false;
    
    // Single word queries are always simple
    if (!/\s/.test(trimmed)) return true;
    
    // Check for complex query indicators
    if (/^(if|suppose|imagine|assume|consider|let's say|what if)\b/i.test(trimmed)) return false;
    
    // Check for word problem indicators (longer queries with numbers or specific structures)
    if (trimmed.split(' ').length > 10 || /\d+/.test(trimmed)) return false;
    
    // Match simple lookup patterns
    return /^(what|where|when|why|who|how|define|capital of|weather in|meaning of)\b/i.test(trimmed);
}

function appendMessage(message, isAI = false) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;

    // Append to chat log for both user and AI messages
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // Scroll to the bottom
}

async function fetchAIResponse(history, attempt = 0) {
    const maxRetries = 5;
    const retryDelay = 5000; // 5 seconds
    try {
        const selectedModel = document.getElementById('model-select').value;
        const lastMessage = history[history.length - 1];
        
        // Always try lookup first since it's free
        const lookupResult = await performOnlineLookup(lastMessage);
        console.log('lookup result:', lookupResult);

        // If we have a lookup result, use it directly (free option)
        if (lookupResult) {
            return lookupResult;
        }

        // Only use AI chat if lookup failed and the query is complex enough to warrant AI
        if (!isSimpleQuery(lastMessage)) {
            const messages = [
                {
                    role: 'system',
                    content: 'This is a conversation between a user and an AI engine. Please determine the next appropriate response to the current user query. Each user query is independent unless explicitly related to previous queries.'
                },
                ...history.slice(0, -1).map((message, index) => ({
                    role: index % 2 === 0 ? 'user' : 'assistant',
                    content: message
                })),
                {
                    role: 'user',
                    content: lastMessage
                }
            ];

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    messages,
                    model: selectedModel 
                }),
            });
            
            if (!response.ok) {
                let errorMsg = 'Sorry, the AI service is temporarily unavailable.';
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMsg = errorData.error;
                    }
                } catch (e) {}
                return errorMsg;
            }
            
            const data = await response.json();
            return data.reply || 'Sorry, I did not understand that.';
        } else {
            // For simple queries that didn't get a lookup result, provide a helpful response
            return "I couldn't find specific information for that query. Could you try rephrasing your question or ask something more specific?";
        }
    } catch (error) {
        console.error('Error fetching AI response:', error);
        return 'Error: Unable to get response.';
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