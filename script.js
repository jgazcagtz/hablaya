// HablaYa! - AI English Speaking Assistant
// Main application script handling UI interactions, speech recognition, and API calls

class HablaYaApp {
    constructor() {
        // DOM Elements
        this.chatWindow = document.getElementById('chat-window');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.micButton = document.getElementById('mic-button');
        this.micIcon = document.getElementById('mic-icon');
        this.themeToggle = document.getElementById('theme-toggle');
        
        // Speech recognition and synthesis
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSynthesis = window.speechSynthesis;
        this.recognition = null;
        this.isListening = false;
        
        // Conversation history
        this.conversationHistory = [];
        
        // Initialize the app
        this.init();
    }
    
    init() {
        // Event listeners
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        
        this.micButton.addEventListener('click', () => this.toggleSpeechRecognition());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Check for speech recognition support
        if (!this.SpeechRecognition) {
            this.showUnsupportedMessage('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
            this.micButton.disabled = true;
        }
        
        // Check for speech synthesis support
        if (!this.speechSynthesis) {
            this.showUnsupportedMessage('Speech synthesis is not supported in your browser. Text responses will still work.');
        }
        
        // Initialize speech recognition
        this.initSpeechRecognition();
    }
    
    initSpeechRecognition() {
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.micButton.classList.add('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"></path>`;
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.micButton.classList.remove('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z"></path>`;
        };
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.handleUserMessage(transcript);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            this.addSystemMessage(`Error: ${event.error}. Please try again.`);
        };
    }
    
    toggleSpeechRecognition() {
        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Speech recognition start failed:', error);
                this.addSystemMessage('Could not start microphone. Please check permissions.');
            }
        }
    }
    
    handleSendMessage() {
        const message = this.textInput.value.trim();
        if (message) {
            this.handleUserMessage(message);
            this.textInput.value = '';
        }
    }
    
    async handleUserMessage(message) {
        // Add user message to chat
        this.addMessage('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Call API to get AI response
            const aiResponse = await this.getAIResponse(message);
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            // Add AI response to chat
            this.addMessage('ai', aiResponse);
            
            // Speak the response
            this.speakResponse(aiResponse);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.removeTypingIndicator();
            this.addSystemMessage('Sorry, there was an error processing your request. Please try again.');
        }
    }
    
    async getAIResponse(message) {
        // Add user message to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: this.conversationHistory,
                    model: 'gpt-4-turbo' // or the latest model you're using
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            
            // Add AI response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: data.message,
                timestamp: new Date().toISOString()
            });
            
            return data.message;
        } catch (error) {
            console.error('Error fetching AI response:', error);
            throw error;
        }
    }
    
    addMessage(sender, content) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-content">
                <p>${content}</p>
            </div>
            <div class="message-meta">
                <span class="timestamp">${timestamp}</span>
                ${sender === 'ai' ? '<button class="speak-button" aria-label="Speak message">🔊</button>' : ''}
            </div>
        `;
        
        this.chatWindow.appendChild(messageElement);
        
        // Scroll to bottom
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        
        // Add click event for speak buttons
        if (sender === 'ai') {
            const speakButton = messageElement.querySelector('.speak-button');
            speakButton.addEventListener('click', () => this.speakResponse(content));
        }
    }
    
    addSystemMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <p><em>${content}</em></p>
            </div>
        `;
        this.chatWindow.appendChild(messageElement);
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
    
    showTypingIndicator() {
        // Remove any existing typing indicator
        this.removeTypingIndicator();
        
        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        this.chatWindow.appendChild(typingElement);
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
    
    removeTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }
    
    speakResponse(text) {
        if (!this.speechSynthesis) return;
        
        // Cancel any ongoing speech
        this.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        // Select a voice that sounds good for English tutoring
        const voices = this.speechSynthesis.getVoices();
        const preferredVoices = voices.filter(voice => 
            voice.lang.includes('en') && 
            !voice.name.includes('Microsoft') && 
            !voice.name.includes('Google')
        );
        
        if (preferredVoices.length > 0) {
            utterance.voice = preferredVoices[0];
        }
        
        this.speechSynthesis.speak(utterance);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Update the theme icon
        const themeIcon = this.themeToggle.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        // Save preference to localStorage
        localStorage.setItem('hablaya-theme', newTheme);
    }
    
    showUnsupportedMessage(message) {
        const unsupportedElement = document.createElement('div');
        unsupportedElement.className = 'unsupported-message';
        unsupportedElement.innerHTML = `
            <p>⚠️ ${message}</p>
        `;
        this.chatWindow.appendChild(unsupportedElement);
    }
    
    // Load saved theme preference
    loadThemePreference() {
        const savedTheme = localStorage.getItem('hablaya-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            const themeIcon = this.themeToggle.querySelector('.theme-icon');
            themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new HablaYaApp();
    app.loadThemePreference();
    
    // Load voices for speech synthesis (needed for some browsers)
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = function() {
            // Voices are now loaded
        };
    }
});