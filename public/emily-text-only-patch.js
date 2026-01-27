// EMILY TEXT-ONLY CHAT - SIMPLIFIED VERSION
// Replace the Emily section in script.js (starting around line 936)

// Emily Assistant State (text-only)
let emilyRecognition = null;
let emilySynthesis = null;
let emilyVoice = null;
let isListening = false;

// Initialize Emily (text-only chat)
function initializeEmily() {
    // Event listeners for text chat only
    document.getElementById('emilyToggle').addEventListener('click', toggleEmilyPanel);
    document.getElementById('emilyClose').addEventListener('click', toggleEmilyPanel);
    document.getElementById('emilySend').addEventListener('click', sendEmilyMessage);
    document.getElementById('emilyInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendEmilyMessage();
    });
}

function toggleEmilyPanel() {
    const panel = document.getElementById('emilyPanel');
    panel.classList.toggle('active');
}

// REMOVE these functions entirely:
// - toggleListening()
// - startListening()
// - stopListening()
// - speakResponse()

function sendEmilyMessage() {
    const input = document.getElementById('emilyInput');
    const question = input.value.trim();

    if (!question) return;

    input.value = '';
    handleEmilyQuestion(question);
}

function handleEmilyQuestion(question) {
    // Add user message to chat
    addUserMessage(question);

    // Generate and add Emily's response (TEXT ONLY - no voice)
    const response = generateEmilyResponse(question);
    addEmilyMessage(response);
    // REMOVED: speakResponse(response);
}

// Keep all the rest of the functions:
// - generateEmilyResponse()
// - addUserMessage()
// - addEmilyMessage()
// - emilyKnowledge object

// Initialize Emily when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeEmily();
});
