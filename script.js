class HablaYaApp {
    constructor() {
        // DOM Elements
        this.chatWindow = document.getElementById('chat-window');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.micButton = document.getElementById('mic-button');
        this.micIcon = document.getElementById('mic-icon');
        this.themeToggle = document.getElementById('theme-toggle');
        this.voiceSelect = document.getElementById('voice-select');
        
        // Audio State
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.audioContext = null;
        
        // Speech Recognition
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isListening = false;
        this.hasMicPermission = false;
        this.browserSupportsRecording = false;
        
        // App State
        this.conversationHistory = [];
        
        this.init();
    }
    
    init() {
        // Check browser capabilities
        this.checkBrowserSupport();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Initialize audio context on first interaction
        document.addEventListener('click', this.initAudioContext.bind(this), { once: true });
        
        // Load theme preference
        this.loadThemePreference();
    }

    checkBrowserSupport() {
        // Check for MediaRecorder support
        this.browserSupportsRecording = !!(
            navigator.mediaDevices && 
            window.MediaRecorder &&
            (window.AudioContext || window.webkitAudioContext)
        );
        
        // Show appropriate warnings
        if (!this.browserSupportsRecording) {
            this.addSystemMessage('Voice transcription requires Chrome, Edge, or Firefox for best results.');
        }
        
        if (!this.SpeechRecognition) {
            this.addSystemMessage('Live speech recognition may be limited in this browser.');
        }
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });
        
        this.micButton.addEventListener('click', () => this.handleMicInteraction());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Initialize speech recognition if available
        if (this.SpeechRecognition) {
            this.initWebSpeechRecognition();
        }
    }

    async handleMicInteraction() {
        try {
            if (!this.hasMicPermission) {
                await this.requestMicrophonePermission();
            }
            
            if (this.browserSupportsRecording) {
                await this.toggleRecording();
            } else if (this.SpeechRecognition) {
                this.toggleWebSpeechRecognition();
            } else {
                this.addSystemMessage('Please type your message or use a supported browser for voice input.');
            }
        } catch (error) {
            console.error('Mic interaction failed:', error);
            this.addSystemMessage('Microphone access required. Please enable permissions in browser settings.');
        }
    }

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            this.hasMicPermission = true;
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.hasMicPermission = false;
            
            // Show iOS-specific instructions
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                this.addSystemMessage('Enable microphone in Settings > Safari > Microphone');
            }
            
            throw error;
        }
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('AudioContext initialization failed:', error);
        }
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
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const text = await this.transcribeAudio(audioBlob);
                    if (text) {
                        const messageWithContext = {
                            content: text,
                            isVoiceInput: true,
                            timestamp: new Date().toISOString()
                        };
                        this.handleUserMessage(messageWithContext);
                    }
                } catch (error) {
                    console.error('Transcription failed:', error);
                    this.addSystemMessage('Voice input failed. Please try typing your message.');
                }
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.updateMicButtonState();
            
        } catch (error) {
            console.error('Recording failed:', error);
            this.addSystemMessage('Could not start recording. Please check permissions.');
            this.isRecording = false;
            this.updateMicButtonState();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.updateMicButtonState();
        }
    }

    updateMicButtonState() {
        if (this.isRecording) {
            this.micButton.classList.add('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"></path>`;
        } else {
            this.micButton.classList.remove('listening');
            this.micIcon.innerHTML = `<path fill="currentColor" d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V20H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.08A7 7 0 0 0 19 11z"></path>`;
        }
    }

    async transcribeAudio(audioBlob) {
        this.showTypingIndicator();
        
        try {
            // Try Whisper first
            const whisperText = await this.tryWhisperAPI(audioBlob);
            if (whisperText) return whisperText;
            
            // Fallback to Web Speech if available
            if (this.SpeechRecognition) {
                return await this.fallbackToWebSpeech();
            }
            
            throw new Error('No transcription methods available');
            
        } catch (error) {
            console.error('Transcription error:', error);
            this.addSystemMessage('Voice transcription unavailable. Please try typing.');
            return null;
        } finally {
            this.removeTypingIndicator();
        }
    }

    async tryWhisperAPI(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-1');
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Whisper API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error('Whisper API failed:', error);
            return null;
        }
    }

    async fallbackToWebSpeech() {
        return new Promise((resolve) => {
            if (!this.SpeechRecognition) {
                resolve(null);
                return;
            }
            
            const recognition = new this.SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                resolve(transcript);
            };
            
            recognition.onerror = (event) => {
                console.error('Web Speech error:', event.error);
                resolve(null);
            };
            
            recognition.onend = () => {
                if (!recognition.result) resolve(null);
            };
            
            recognition.start();
        });
    }

    toggleWebSpeechRecognition() {
        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
            } catch (error) {
                console.error('Web Speech start failed:', error);
                this.addSystemMessage('Could not start voice recognition. Please try again.');
            }
        }
        this.updateMicButtonState();
    }

    handleSendMessage() {
        const message = this.textInput.value.trim();
        if (message) {
            const messageWithContext = {
                content: message,
                isVoiceInput: false,
                timestamp: new Date().toISOString()
            };
            this.handleUserMessage(messageWithContext);
            this.textInput.value = '';
        }
    }
    
    async handleUserMessage(message) {
        this.addMessage('user', message.content);
        this.showTypingIndicator();
        
        try {
            const aiResponse = await this.getAIResponse(message);
            this.removeTypingIndicator();
            this.addMessage('ai', aiResponse);
            await this.speakResponse(aiResponse);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.removeTypingIndicator();
            this.addSystemMessage('Error processing request. Please try again.');
        }
    }
    
    async getAIResponse(userMessage) {
        // Add context about voice capabilities
        const systemMessage = {
            role: 'system',
            content: `You are HablaYa! - an AI English tutor with voice capabilities.
            Current Features:
            - Whisper API: ${this.browserSupportsRecording ? 'Active' : 'Unavailable'}
            - Microphone: ${this.hasMicPermission ? 'Enabled' : 'Disabled'}
            - Voice Input: ${userMessage.isVoiceInput ? 'Used' : 'Not used'}
            
            Important:
            1. Acknowledge voice capabilities when asked
            2. Provide pronunciation guides when requested
            3. Current time: ${new Date().toLocaleString()}`
        };

        if (this.conversationHistory.length > 5) {
            this.conversationHistory = this.conversationHistory.slice(-5);
        }

        this.conversationHistory.push({
            role: 'user',
            content: userMessage.content,
            metadata: {
                isVoiceInput: userMessage.isVoiceInput,
                timestamp: userMessage.timestamp
            }
        });
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [systemMessage, ...this.conversationHistory],
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
            console.error('Error with TTS:', error);
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
});
