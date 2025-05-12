class HablaYaApp {
    constructor() {
        this.chatWindow = document.getElementById('chat-window');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.micButton = document.getElementById('mic-button');
        this.micIcon = document.getElementById('mic-icon');
        this.themeToggle = document.getElementById('theme-toggle');
        this.voiceSelect = document.getElementById('voice-select');
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.audioContext = null;
        
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isListening = false;
        
        this.conversationHistory = [];
        
        this.init();
    }
    
    init() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        
        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        if (this.SpeechRecognition) {
            this.initWebSpeechRecognition();
        }
        
        document.addEventListener('click', this.initAudioContext.bind(this), { once: true });
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const text = await this.transcribeAudioWithWhisper(audioBlob);
                if (text) this.handleUserMessage(text);
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.micButton.classList.add('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"></path>`;
            
        } catch (error) {
            console.error('Recording failed:', error);
            this.addSystemMessage('Microphone access denied. Please enable permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.micButton.classList.remove('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z"></path>`;
        }
    }

    async transcribeAudioWithWhisper(audioBlob) {
        this.showTypingIndicator();
        
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-1');
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Transcription failed');
            
            const data = await response.json();
            return data.text;
            
        } catch (error) {
            console.error('Whisper error:', error);
            this.addSystemMessage('Transcription service unavailable. Using fallback.');
            return this.fallbackToWebSpeech();
        } finally {
            this.removeTypingIndicator();
        }
    }

    async fallbackToWebSpeech() {
        if (!this.SpeechRecognition) return null;
        
        return new Promise((resolve) => {
            this.recognition.onresult = (event) => {
                resolve(event.results[0][0].transcript);
            };
            
            this.recognition.onerror = () => {
                resolve(null);
            };
            
            this.recognition.start();
        });
    }

    initWebSpeechRecognition() {
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
    }

    handleSendMessage() {
        const message = this.textInput.value.trim();
        if (message) {
            this.handleUserMessage(message);
            this.textInput.value = '';
        }
    }
    
    async handleUserMessage(message) {
        this.addMessage('user', message);
        this.showTypingIndicator();
        
        try {
            const aiResponse = await this.getAIResponse(message);
            this.removeTypingIndicator();
            this.addMessage('ai', aiResponse);
            await this.speakResponse(aiResponse);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.removeTypingIndicator();
            this.addSystemMessage('Sorry, there was an error processing your request. Please try again.');
        }
    }
    
    async getAIResponse(message) {
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
                    model: 'gpt-4-turbo'
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            
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
    
    async speakResponse(text) {
        try {
            const voice = this.voiceSelect ? this.voiceSelect.value : 'nova';
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: text.substring(0, 2000),
                    voice 
                })
            });

            if (!response.ok) {
                throw new Error('TTS request failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.play().catch(e => {
                console.error('Audio playback failed:', e);
                this.addSystemMessage('Tap the speaker icon to hear the response.');
            });
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };
            
        } catch (error) {
            console.error('Error with OpenAI TTS:', error);
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
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
        
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
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        
        const themeIcon = this.themeToggle.querySelector('.theme-icon');
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        localStorage.setItem('hablaya-theme', newTheme);
    }
    
    loadThemePreference() {
        const savedTheme = localStorage.getItem('hablaya-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            const themeIcon = this.themeToggle.querySelector('.theme-icon');
            themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new HablaYaApp();
    app.loadThemePreference();
});
