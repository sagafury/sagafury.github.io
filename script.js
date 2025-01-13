document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const modal = document.getElementById("eventModal");
    const addEventBtn = document.getElementById("addEventBtn");
    const closeBtn = document.querySelector(".close");
    const eventForm = document.getElementById("eventForm");
    const eventsList = document.getElementById("eventsList");
    const startButton = document.getElementById("startButton");

    let events = [];
    let currentEventIndex = 0;

    // Open modal
    addEventBtn.onclick = () => {
        modal.style.display = "block";
    };

    // Close modal
    closeBtn.onclick = () => {
        modal.style.display = "none";
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };

    // Form submission
    eventForm.onsubmit = (e) => {
        e.preventDefault();

        const newEvent = {
            id: Date.now(),
            name: document.getElementById("name").value,
            gender: document.getElementById("gender").value,
            mobile: document.getElementById("mobile").value,
            language: document.getElementById("language").value,
        };

        events.push(newEvent);
        updateEventsList();
        eventForm.reset();
        modal.style.display = "none";
        updateStartButton();
    };

    // Update events list
    function updateEventsList() {
        eventsList.innerHTML = "";
        events.forEach((event, index) => {
            const eventElement = document.createElement("div");
            eventElement.className = "event-item";
            eventElement.innerHTML = `
                <div class="event-item-content">
                    <strong>${index + 1}. ${event.name}</strong><br>
                    <span>📱 ${event.mobile}</span><br>
                    <span>🗣️ ${event.language.toUpperCase()} | 👤 ${event.gender}</span>
                </div>
                <button class="delete-btn" data-id="${event.id}">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            eventsList.appendChild(eventElement);
        });

        // Add delete event listeners
        document.querySelectorAll(".delete-btn").forEach((btn) => {
            btn.onclick = () => {
                const id = parseInt(btn.getAttribute("data-id"));
                events = events.filter((event) => event.id !== id);
                updateEventsList();
                updateStartButton();
            };
        });
    }

    // Update start button state
    function updateStartButton() {
        startButton.disabled = events.length === 0;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showCallInterface(eventIndex) {
        const phoneScreen = document.querySelector(".screen-content");
        const currentContact = events[eventIndex]?.name || "Unknown Contact";
        const currentNumber = events[eventIndex]?.number || "Unknown Contact";

        phoneScreen.innerHTML = `
            <div id = "call-inter" class="call-interface">
                <div class="caller-name">${currentContact}</div>
                <div class="caller-number">${currentNumber}</div>
                <div class="call-image-container">
                    <img src="assets/call.png" alt="Call Interface" class="call-image">
                </div>
                <div class="call-buttons">
                    <button  class="call-button reject-button" aria-label="Reject Call"></button>
                    <button  class="call-button accept-button" aria-label="Accept Call"></button>
                </div>
            </div>
        `;

        // Add event listeners to buttons
        const callInter = phoneScreen.querySelector(".call-interface");
        const callButtons = callInter.querySelector(".call-buttons");
        const rejectButton = callButtons.querySelector(".accept-button");
        const acceptButton = callButtons.querySelector(".reject-button");

        acceptButton.onclick = function () {
            moveToNextCall(eventIndex);
        };
        rejectButton.onclick = function () {
            showAcceptScreen(eventIndex);
        };
    }
    function showAcceptScreen(eventIndex) {
        const currentContact = events[eventIndex];
        const phoneScreen = document.querySelector(".screen-content");
        let isCallEnded = false;
        let currentAudio = null;
        let isProcessing = false;

        // Set up phone screen UI
        phoneScreen.innerHTML = `
            <div class="accept-interface">
                <div class="caller-name">${currentContact.name}</div>
                <div class="caller-number">${currentContact.mobile}</div>
                <div class="call-image-container">
                    <img src="assets/accept.png" alt="Accept Interface" class="call-image">
                </div>
                <div class="call-buttons">
                    <button class="call-button decline-button" aria-label="End Call"></button>
                </div>
            </div>
        `;

        // Initialize speech recognition with proper language
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = currentContact.language === 'hi' ? 'hi-IN' : 'en-US';
        console.log('Recognition language set to:', recognition.lang);

        // Recognition start handler
        recognition.onstart = () => {
            console.log('Recognition started');
            updateStatus('listening');
            addToLog('Listening...', 'system');
        };

        // Recognition end handler
        recognition.onend = () => {
            console.log('Recognition ended');
            if (!isCallEnded && !isProcessing) {
                startListeningAfterDelay();
            }
        };

        // Recognition error handler
        recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (!isCallEnded) {
                startListeningAfterDelay();
            }
        };

        // Helper function to start listening after delay
        function startListeningAfterDelay() {
            setTimeout(() => {
                if (!isCallEnded && !isProcessing) {
                    try {
                        recognition.start();
                        console.log('Restarted recognition');
                    } catch (error) {
                        console.error('Error restarting recognition:', error);
                    }
                }
            }, 1000);
        }

        // Recognition result handler
        recognition.onresult = async (event) => {
            if (isProcessing) return;
            
            isProcessing = true;
            const transcript = event.results[0][0].transcript;
            console.log('Recognized text:', transcript);
            
            updateStatus('processing');
            addToLog(transcript, 'user');

            try {
                const response = await fetch('http://localhost:3000/send-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: transcript,
                        language: currentContact.language,
                        name: currentContact.name,
                        gender: currentContact.gender
                    })
                });

                const data = await response.json();
                
                if (data.audio && !isCallEnded) {
                    updateStatus('speaking');
                    addToLog(data.aiResponse, 'ai');
                    
                    if (currentAudio) {
                        currentAudio.pause();
                        currentAudio = null;
                    }

                    currentAudio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    
                    currentAudio.onended = () => {
                        currentAudio = null;
                        isProcessing = false;
                        if (!isCallEnded) {
                            startListeningAfterDelay();
                        }
                    };

                    await currentAudio.play();
                }
            } catch (error) {
                console.error('Error:', error);
                addToLog('Error processing response', 'system');
                isProcessing = false;
                if (!isCallEnded) {
                    startListeningAfterDelay();
                }
            }
        };

        // Handle call end
        const declineButton = phoneScreen.querySelector(".decline-button");
        declineButton.onclick = () => {
            isCallEnded = true;
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
            recognition.stop();
            moveToNextCall(eventIndex);
        };

        // Initial greeting
        async function startInitialGreeting() {
            try {
                const response = await fetch('http://localhost:3000/send-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: 'initial_greeting',
                        language: currentContact.language,
                        name: currentContact.name,
                        gender: currentContact.gender
                    })
                });

                const data = await response.json();
                if (data.audio && !isCallEnded) {
                    updateStatus('speaking');
                    addToLog(data.aiResponse, 'ai');
                    
                    currentAudio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    
                    currentAudio.onended = () => {
                        currentAudio = null;
                        if (!isCallEnded) {
                            console.log('Starting recognition after greeting');
                            startListeningAfterDelay();
                        }
                    };

                    await currentAudio.play();
                }
            } catch (error) {
                console.error('Error in initial greeting:', error);
                if (!isCallEnded) {
                    startListeningAfterDelay();
                }
            }
        }

        // Start the call
        setTimeout(() => {
            startInitialGreeting();
        }, 500);
    }


    async function sendToBackend(text, contact) {
        try {
            const response = await fetch('http://localhost:3000/send-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    language: contact.language,
                    name: contact.name,
                    gender: contact.gender // Added gender for better personalization
                })
            });

            const data = await response.json();
            
            // Play the AI response
            if (data.audio) {
                const audioPlayer = new Audio(`data:audio/mp3;base64,${data.audio}`);
                await audioPlayer.play();

                audioPlayer.onended = () => {
                    setTimeout(() => {
                        updateStatus('listening');
                        recognition.start();
                    }, 1000);
                };
            }
        } catch (error) {
            console.error("Error:", error);
            // Restart listening even if there's an error
            setTimeout(() => {
                updateStatus('listening');
                recognition.start();
            }, 1000);
        }
    }

    function handleCallEnd(eventIndex) {
        const nextIndex = eventIndex + 1;
        if (nextIndex < events.length) {
            showCallInterface(nextIndex);
        } else {
            showCampaignComplete();
        }
    }

    function showCampaignComplete() {
        const phoneScreen = document.querySelector(".screen-content");
        phoneScreen.innerHTML = `
            <div class="campaign-complete">
                <h3>Campaign Completed</h3>
                <p>Total Calls: ${events.length}</p>
                <p>Click 'Start Campaign' to begin a new session</p>
            </div>
        `;
    }

    function moveToNextCall(currentIndex) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < events.length) {
            showCallInterface(nextIndex);
        } else {
            const phoneScreen = document.querySelector(".screen-content");
            phoneScreen.innerHTML = `
                <div style="color: white;">
                    <h3>Campaign Completed</h3>
                    <p>All calls processed</p>
                </div>
            `;
        }
    }

    // Update start button click handler
    startButton.onclick = () => {
        currentEventIndex = 0;
        showCallInterface(currentEventIndex);
    };

    function updateStatus(status) {
        const statusLight = document.getElementById('statusLight');
        const statusText = document.getElementById('statusText');
        
        switch(status) {
            case 'listening':
                statusLight.style.backgroundColor = '#00ff00';
                statusText.textContent = 'Listening';
                break;
            case 'speaking':
                statusLight.style.backgroundColor = '#ff0000';
                statusText.textContent = 'Speaking';
                break;
            default:
                statusLight.style.backgroundColor = '#666';
                statusText.textContent = 'Idle';
        }
    }

    function addToLog(message, type) {
        const logContent = document.getElementById('logContent');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}-message`;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const text = document.createElement('div');
        text.textContent = message;
        
        entry.appendChild(timestamp);
        entry.appendChild(text);
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }
});