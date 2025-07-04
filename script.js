class HablaYaApp {
    constructor() {
        // Core DOM Elements
        this.chatWindow = document.getElementById('chat-window');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.micButton = document.getElementById('mic-button');
        this.micIcon = document.getElementById('mic-icon');
        this.themeToggle = document.getElementById('theme-toggle');
        this.voiceSelect = document.getElementById('voice-select');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');
        this.settingsButton = document.getElementById('settings-button');
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsClose = document.getElementById('settings-close');
        this.userLevel = document.getElementById('user-level');
        this.learningFocus = document.getElementById('learning-focus');
        this.feedbackLevel = document.getElementById('feedback-level');
        this.modeTabs = document.querySelectorAll('.mode-tab');
        
        // Stats Elements
        this.sessionTimeElement = document.getElementById('session-time');
        this.wordsPracticedElement = document.getElementById('words-practiced');
        this.accuracyScoreElement = document.getElementById('accuracy-score');
        this.todayWordsElement = document.getElementById('today-words');
        this.todayAccuracyElement = document.getElementById('today-accuracy');
        this.todayTimeElement = document.getElementById('today-time');
        
        // Audio State
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.audioContext = null;
        this.currentAudio = null;
        
        // Speech Recognition
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isListening = false;
        this.hasMicPermission = false;
        this.browserSupportsRecording = false;
        
        // App State
        this.conversationHistory = [];
        this.currentMode = 'conversation';
        this.userSettings = {
            level: 'intermediate',
            focus: 'conversation',
            feedbackLevel: 'moderate'
        };
        this.sessionStats = {
            startTime: Date.now(),
            wordsPracticed: 0,
            messagesSent: 0,
            accuracyScore: 0,
            totalAccuracy: 0
        };
        this.sessionTimer = null;
        
        // Learning Progress
        this.learningProgress = {
            vocabulary: new Set(),
            grammarPoints: [],
            pronunciationFeedback: [],
            sessionHistory: []
        };
        
        this.init();
    }
    
    init() {
        this.checkBrowserSupport();
        this.setupEventListeners();
        this.loadUserPreferences();
        this.startSessionTimer();
        this.initAudioContext();
        this.setupAutoResize();
    }

    checkBrowserSupport() {
        this.browserSupportsRecording = !!(
            navigator.mediaDevices && 
            window.MediaRecorder &&
            (window.AudioContext || window.webkitAudioContext)
        );
        
        if (!this.browserSupportsRecording) {
            this.addSystemMessage('Voice features require Chrome, Edge, or Firefox for best results.');
        }
        
        if (!this.SpeechRecognition) {
            this.addSystemMessage('Live speech recognition may be limited in this browser.');
        }
    }

    setupEventListeners() {
        // Core interaction events
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        
        this.micButton.addEventListener('mousedown', () => this.startRecording());
        this.micButton.addEventListener('mouseup', () => this.stopRecording());
        this.micButton.addEventListener('mouseleave', () => this.stopRecording());
        
        // Touch events for mobile
        this.micButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording();
        });
        this.micButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecording();
        });
        
        // UI Controls
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.settingsButton.addEventListener('click', () => this.openSettings());
        this.settingsClose.addEventListener('click', () => this.closeSettings());
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettings();
        });
        
        // Voice controls
        this.voiceSelect.addEventListener('change', () => this.updateVoiceSettings());
        this.speedSlider.addEventListener('input', () => this.updateSpeedDisplay());
        
        // Learning mode tabs
        this.modeTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchLearningMode(tab.dataset.mode));
        });
        
        // Settings changes
        this.userLevel.addEventListener('change', () => this.updateUserSettings());
        this.learningFocus.addEventListener('change', () => this.updateUserSettings());
        this.feedbackLevel.addEventListener('change', () => this.updateUserSettings());
        
        // Initialize speech recognition if available
        if (this.SpeechRecognition) {
            this.initWebSpeechRecognition();
        }
    }

    setupAutoResize() {
        this.textInput.addEventListener('input', () => {
            this.textInput.style.height = 'auto';
            this.textInput.style.height = Math.min(this.textInput.scrollHeight, 120) + 'px';
        });
    }

    async startRecording() {
        if (this.isRecording) return;
        
        try {
            if (!this.hasMicPermission) {
                await this.requestMicrophonePermission();
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            this.mediaRecorder = new MediaRecorder(stream, { 
                mimeType: 'audio/webm;codecs=opus' 
            });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    
                    // Check if blob is valid
                    if (audioBlob.size === 0) {
                        this.addSystemMessage('No audio recorded. Please try again.');
                        return;
                    }
                    
                    this.addSystemMessage('Processing your voice input...');
                    const transcription = await this.transcribeAudio(audioBlob);
                    
                    if (transcription && transcription.text) {
                        this.handleVoiceInput(transcription);
                    } else {
                        // Fallback: try to use browser's speech recognition
                        this.addSystemMessage('Transcription failed. You can still type your message below.');
                        this.tryBrowserSpeechRecognition();
                    }
                } catch (error) {
                    console.error('Recording processing failed:', error);
                    this.addSystemMessage('Voice input failed. You can still type your message below.');
                }
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.updateMicButtonState();
            
        } catch (error) {
            console.error('Recording failed:', error);
            this.addSystemMessage('Could not start recording. Please check permissions or try typing instead.');
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

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            this.hasMicPermission = true;
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.hasMicPermission = false;
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

    async transcribeAudio(audioBlob) {
        this.showTypingIndicator();
        
        try {
            // Validate audio blob
            if (!audioBlob || audioBlob.size === 0) {
                throw new Error('Invalid audio data');
            }
            
            console.log('Audio blob size:', audioBlob.size, 'bytes');
            
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('language', 'en');
            formData.append('prompt', 'This is an English language learning session. Please transcribe clearly and provide pronunciation feedback.');
            
            console.log('Sending transcription request...');
            
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });
            
            console.log('Transcription response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Transcription error response:', errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: 'Unknown error', details: errorText };
                }
                
                throw new Error(`Transcription failed: ${response.status} - ${errorData.error || errorData.details || 'Unknown error'}`);
            }
            
            const result = await response.json();
            console.log('Transcription result:', result);
            
            if (!result.text) {
                throw new Error('No transcription text received');
            }
            
            return result;
            
        } catch (error) {
            console.error('Transcription error:', error);
            
            // Provide user-friendly error message
            let userMessage = 'Voice transcription unavailable. Please try typing.';
            
            if (error.message.includes('401') || error.message.includes('403')) {
                userMessage = 'API key issue. Please check your OpenAI API configuration.';
            } else if (error.message.includes('413')) {
                userMessage = 'Audio file too large. Please try a shorter recording.';
            } else if (error.message.includes('429')) {
                userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (error.message.includes('500')) {
                userMessage = 'Server error. Please try again in a moment.';
            }
            
            this.addSystemMessage(userMessage);
            return null;
        } finally {
            this.removeTypingIndicator();
        }
    }

    handleVoiceInput(transcription) {
        if (!transcription || !transcription.text) {
            console.warn('No transcription text available');
            this.addSystemMessage('Voice input failed. You can still type your message below.');
            return;
        }
        
        const message = {
            content: transcription.text,
            isVoiceInput: true,
            timestamp: new Date().toISOString(),
            pronunciationAnalysis: transcription.pronunciation_analysis,
            learningSuggestions: transcription.learning_suggestions
        };
        
        this.handleUserMessage(message);
        this.updateSessionStats(transcription.text);
        
        // Add pronunciation feedback if available and significant
        if (transcription.pronunciation_analysis && transcription.pronunciation_analysis.suggestions.length > 0) {
            this.addPronunciationFeedback(transcription.pronunciation_analysis);
        }
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
            this.textInput.style.height = 'auto';
            this.updateSessionStats(message);
        }
    }
    
    async handleUserMessage(message) {
        this.addMessage('user', message.content, message.isVoiceInput);
        this.showTypingIndicator();
        
        try {
            const aiResponse = await this.getAIResponse(message);
            this.removeTypingIndicator();
            this.addMessage('ai', aiResponse.message, false, aiResponse.metadata);
            await this.speakResponse(aiResponse.message);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.removeTypingIndicator();
            this.addSystemMessage('Error processing request. Please try again.');
        }
    }
    
    async getAIResponse(userMessage) {
        // Keep conversation history manageable
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        this.conversationHistory.push({
            role: 'user',
            content: userMessage.content,
            metadata: {
                isVoiceInput: userMessage.isVoiceInput,
                timestamp: userMessage.timestamp,
                mode: this.currentMode
            }
        });
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: this.conversationHistory,
                    model: 'gpt-4-turbo',
                    userLevel: this.userSettings.level,
                    learningFocus: this.userSettings.focus,
                    sessionData: {
                        mode: this.currentMode,
                        stats: this.sessionStats,
                        progress: this.learningProgress
                    }
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
            
            return data;
        } catch (error) {
            console.error('Error fetching AI response:', error);
            throw error;
        }
    }
    
    async speakResponse(text) {
        try {
            // Stop any currently playing audio
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }
            
            const voice = this.voiceSelect.value;
            const speed = parseFloat(this.speedSlider.value);
            
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: text.substring(0, 2000),
                    voice,
                    speed,
                    emphasis: this.currentMode === 'pronunciation' ? 'strong' : 'moderate'
                })
            });

            if (!response.ok) {
                throw new Error('TTS request failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            this.currentAudio = new Audio(audioUrl);
            
            this.currentAudio.play().catch(e => {
                console.error('Audio playback failed:', e);
                this.addSystemMessage('Tap the speaker icon to hear the response.');
            });
            
            this.currentAudio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };
            
        } catch (error) {
            console.error('Error with TTS:', error);
        }
    }
    
    addMessage(sender, content, isVoiceInput = false, metadata = {}) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const avatarIcon = sender === 'user' ? '👤' : '🎯';
        const senderName = sender === 'user' ? 'You' : 'HablaYa! AI Tutor';
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <div class="avatar-icon">${avatarIcon}</div>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender-name">${senderName}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-text">
                    <p>${content}</p>
                    ${isVoiceInput ? '<p class="voice-indicator">🎤 Voice input</p>' : ''}
                </div>
                ${sender === 'ai' ? `
                <div class="message-actions">
                    <button class="action-button speak-button" aria-label="Listen to message">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                        Listen
                    </button>
                    <button class="action-button practice-button" aria-label="Practice this">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        Practice
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        this.chatWindow.appendChild(messageElement);
        this.scrollToBottom();
        
        // Add event listeners for action buttons
        if (sender === 'ai') {
            const speakButton = messageElement.querySelector('.speak-button');
            const practiceButton = messageElement.querySelector('.practice-button');
            
            speakButton.addEventListener('click', () => this.speakResponse(content));
            practiceButton.addEventListener('click', () => this.startPracticeSession(content));
        }
    }
    
    addSystemMessage(content) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">
                    <p><em>${content}</em></p>
                </div>
            </div>
        `;
        this.chatWindow.appendChild(messageElement);
        this.scrollToBottom();
    }
    
    addPronunciationFeedback(analysis) {
        if (analysis.suggestions && analysis.suggestions.length > 0) {
            // Make feedback more natural and encouraging
            let feedbackMessage = "Great speaking! ";
            
            if (analysis.clarity === 'good') {
                feedbackMessage += "Your pronunciation is clear. ";
            } else if (analysis.clarity === 'needs improvement') {
                feedbackMessage += "Try speaking a bit more clearly. ";
            }
            
            if (analysis.pace === 'slow') {
                feedbackMessage += "You can try speaking a bit faster for more natural flow. ";
            } else if (analysis.pace === 'fast') {
                feedbackMessage += "Good pace! Consider adding small pauses for clarity. ";
            }
            
            if (analysis.suggestions.length > 0) {
                feedbackMessage += `Focus on: ${analysis.suggestions[0]}`;
            }
            
            this.addSystemMessage(feedbackMessage);
        }
    }
    
    showTypingIndicator() {
        this.removeTypingIndicator();
        
        const typingElement = document.createElement('div');
        typingElement.className = 'message ai-message typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <div class="message-avatar">
                <div class="avatar-icon">🎯</div>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        
        this.chatWindow.appendChild(typingElement);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }
    
    scrollToBottom() {
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
    
    // Learning Mode Management
    switchLearningMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        this.modeTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        
        // Add natural mode-specific messages
        const modeMessages = {
            conversation: "Great! Let's have a natural conversation. I'm here to chat and help you practice everyday English.",
            pronunciation: "Perfect! I'll help you with pronunciation. Feel free to speak naturally, and I'll give you tips when needed.",
            grammar: "Excellent choice! I'll help you with grammar as we talk. Don't worry about making mistakes - that's how we learn!",
            vocabulary: "Awesome! I'll introduce new words and expressions naturally as we chat. Let's expand your vocabulary together!"
        };
        
        this.addSystemMessage(modeMessages[mode] || "Switched to " + mode + " mode!");
    }
    
    // Settings Management
    openSettings() {
        this.settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    closeSettings() {
        this.settingsModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    updateUserSettings() {
        this.userSettings = {
            level: this.userLevel.value,
            focus: this.learningFocus.value,
            feedbackLevel: this.feedbackLevel.value
        };
        
        localStorage.setItem('hablaya-settings', JSON.stringify(this.userSettings));
    }
    
    loadUserPreferences() {
        // Load theme
        const savedTheme = localStorage.getItem('hablaya-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            this.updateThemeIcon(savedTheme);
        }
        
        // Load settings
        const savedSettings = localStorage.getItem('hablaya-settings');
        if (savedSettings) {
            this.userSettings = JSON.parse(savedSettings);
            this.userLevel.value = this.userSettings.level;
            this.learningFocus.value = this.userSettings.focus;
            this.feedbackLevel.value = this.userSettings.feedbackLevel;
        }
        
        // Load voice preferences
        const savedVoice = localStorage.getItem('hablaya-voice');
        if (savedVoice) {
            this.voiceSelect.value = savedVoice;
        }
        
        const savedSpeed = localStorage.getItem('hablaya-speed');
        if (savedSpeed) {
            this.speedSlider.value = savedSpeed;
            this.updateSpeedDisplay();
        }
    }
    
    updateVoiceSettings() {
        localStorage.setItem('hablaya-voice', this.voiceSelect.value);
    }
    
    updateSpeedDisplay() {
        const speed = this.speedSlider.value;
        this.speedValue.textContent = speed + 'x';
        localStorage.setItem('hablaya-speed', speed);
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        this.updateThemeIcon(newTheme);
        localStorage.setItem('hablaya-theme', newTheme);
    }
    
    updateThemeIcon(theme) {
        const themeIcon = this.themeToggle.querySelector('.theme-icon');
        themeIcon.innerHTML = theme === 'dark' 
            ? `<path fill="currentColor" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>`
            : `<path fill="currentColor" d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1-8.313-12.454z"/>`;
    }
    
    // Session Management
    startSessionTimer() {
        this.sessionTimer = setInterval(() => {
            const elapsed = Date.now() - this.sessionStats.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.sessionTimeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            this.todayTimeElement.textContent = this.sessionTimeElement.textContent;
        }, 1000);
    }
    
    updateSessionStats(text) {
        this.sessionStats.wordsPracticed += text.split(' ').length;
        this.sessionStats.messagesSent++;
        
        // Update display
        this.wordsPracticedElement.textContent = this.sessionStats.wordsPracticed;
        this.todayWordsElement.textContent = this.sessionStats.wordsPracticed;
        
        // Calculate accuracy (simplified)
        const words = text.toLowerCase().split(' ');
        const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const accuracy = words.filter(word => commonWords.includes(word) || word.length > 2).length / words.length * 100;
        
        this.sessionStats.totalAccuracy += accuracy;
        this.sessionStats.accuracyScore = Math.round(this.sessionStats.totalAccuracy / this.sessionStats.messagesSent);
        
        this.accuracyScoreElement.textContent = this.sessionStats.accuracyScore + '%';
        this.todayAccuracyElement.textContent = this.sessionStats.accuracyScore + '%';
    }
    
    startPracticeSession(content) {
        // Extract key phrases or words for practice
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        const practiceWords = words.filter(word => word.length > 4).slice(0, 3);
        
        if (practiceWords.length > 0) {
            const practiceMessage = `Let's practice these words: ${practiceWords.join(', ')}. Try saying them clearly!`;
            this.addSystemMessage(practiceMessage);
            this.switchLearningMode('pronunciation');
        }
    }
    
    // Cleanup
    destroy() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        if (this.mediaRecorder && this.isRecording) {
            this.stopRecording();
        }
    }

    initWebSpeechRecognition() {
        if (!this.SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }
        
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                const message = {
                    content: transcript,
                    isVoiceInput: true,
                    timestamp: new Date().toISOString()
                };
                this.handleUserMessage(message);
                this.updateSessionStats(transcript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.addSystemMessage('Speech recognition failed. Please try typing.');
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
        };
    }
    
    tryBrowserSpeechRecognition() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
                this.isListening = true;
                this.addSystemMessage('Using browser speech recognition...');
            } catch (error) {
                console.error('Browser speech recognition failed:', error);
                this.addSystemMessage('Speech recognition unavailable. Please type your message.');
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new HablaYaApp();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        app.destroy();
    });
});

// Add typing indicator styles
const style = document.createElement('style');
style.textContent = `
    .typing-indicator .message-content {
        background: var(--gray-100);
        border: 1px solid var(--gray-200);
    }
    
    .typing-dots {
        display: flex;
        gap: 4px;
        padding: 8px 0;
    }
    
    .typing-dot {
        width: 8px;
        height: 8px;
        background: var(--primary-500);
        border-radius: 50%;
        animation: typingBounce 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes typingBounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
    }
    
    .voice-indicator {
        font-size: 0.75rem;
        color: var(--gray-500);
        margin-top: 4px;
    }
    
    .system-message .message-content {
        background: var(--accent-50);
        border: 1px solid var(--accent-200);
    }
    
    [data-theme="dark"] .system-message .message-content {
        background: var(--accent-900);
        border-color: var(--accent-700);
    }
`;
document.head.appendChild(style);
