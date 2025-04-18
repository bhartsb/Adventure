// --- Global Game State Variables ---
let playerCharacter = null;
let foes = [];
let conditionMap = null;
let llmInstructions = null;
let encounterState = 'PRE_ENCOUNTER'; // Add state management later

// --- DOM References ---
const video = document.getElementById('intro-video');
const mainInterface = document.getElementById('main-interface');
const chatContainer = document.getElementById('chat-container');
const statusContainer = document.getElementById('status-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure video is muted for autoplay policies
    video.muted = true;

    // Attempt to play, log errors if browser blocks it
    video.play().then(() => {
        console.log("Intro video playback started.");
    }).catch(error => {
        console.error("Autoplay was prevented:", error);
        // In a real app, you might show a manual play button here
        // For this POC, we'll assume it works or user interacts
        // We can manually trigger the end logic if needed for testing:
        // videoEndedHandler(); // Uncomment for testing if autoplay fails
    });

    // Listen for the 'ended' event on the video
    video.addEventListener('ended', videoEndedHandler);
});

function videoEndedHandler() {
    console.log("Intro video finished.");

    // Hide the video container (optional)
    // document.getElementById('video-container').classList.add('hidden');

    // Show the main interface (chat and status)
    mainInterface.classList.remove('hidden');
    mainInterface.style.display = 'flex'; // Ensure display is set back to flex

    // Start the game initialization process
    initializeGame();
}

// --- Game Initialization and Data Loading ---
async function initializeGame() {
    console.log("Initializing game elements...");
    encounterState = 'LOADING';
    updateStatusDisplay(); // Show loading state
    updateChatDisplay("System", "Loading game data...");

    try {
        // Fetch all JSON data concurrently - UPDATED PATHS
        const [pcData, foesData, condMapData, instructionData] = await Promise.all([
            fetch('json/playerCharacter.json').then(res => res.json()), // <-- UPDATED
            fetch('json/foes.json').then(res => res.json()),           // <-- UPDATED
            fetch('json/conditionMapping.json').then(res => res.json()),// <-- UPDATED
            fetch('json/llmInstructions.json').then(res => res.json()) // <-- UPDATED
        ]);

        // Store loaded data in global state
        playerCharacter = pcData;
        foes = foesData; // Keep the array reference
        conditionMap = condMapData;
        llmInstructions = instructionData;

        console.log("Game data loaded:", { playerCharacter, foes, conditionMap, llmInstructions });

        // Data loaded, update displays and proceed
        encounterState = 'GM_TURN'; // Indicate GM's turn to provide initial text
        updateStatusDisplay(); // Render initial stats
        updateChatDisplay("System", "Game ready. The adventure begins!");

        // --- Next Step Placeholder ---
        // Start the actual encounter (e.g., get initial GM description)
        startEncounter();

    } catch (error) {
        console.error("Failed to load game data:", error);
        encounterState = 'ERROR';
        updateStatusDisplay(); // Show error state
        updateChatDisplay("System", "Error loading game data. Cannot start adventure.");
    }
}

// --- UI Update Functions ---

function updateStatusDisplay() {
    if (encounterState === 'LOADING') {
        statusContainer.innerHTML = `<p><em>Loading stats...</em></p>`;
        return;
    }
    if (encounterState === 'ERROR') {
        statusContainer.innerHTML = `<p style="color: red;">Error loading data!</p>`;
        return;
    }
    // Ensure data is loaded before trying to display it
    if (!playerCharacter || !foes || !conditionMap) {
        // This case might briefly appear if updateStatusDisplay is called before await finishes,
        // though ideally the state machine prevents this. Added safety check.
        statusContainer.innerHTML = `<p><em>Waiting for data...</em></p>`;
        return;
    }

    // Player Stats
    let pcHtml = `
        <div class="status-section">
            <h3>${playerCharacter.name} (Player)</h3>
            <p>HP: <span id="player-hp">${playerCharacter.hp}</span> / ${playerCharacter.maxHp}</p>
            <p>AC: ${playerCharacter.ac}</p>
        </div>
        <hr>
    `;

    // Foe Stats
    let foesHtml = `<div class="status-section"><h3>Foes</h3>`;
    foes.forEach(foe => {
        // Get text representation of condition (using '100', '75-99' etc keys)
        let conditionText = 'Unknown'; // Default
        // Find the correct range key in the map based on current HP %
        const hpPercent = (foe.hp / foe.maxHp) * 100;

        if (hpPercent <= 0) {
            conditionText = conditionMap['0']; // Defeated
        } else if (hpPercent < 25) {
            conditionText = conditionMap['1-24'];
        } else if (hpPercent < 75) {
            conditionText = conditionMap['25-74'];
        } else if (hpPercent < 100) {
            conditionText = conditionMap['75-99'];
        } else { // hpPercent === 100
             conditionText = conditionMap['100'];
        }
        // Update the foe's condition property if needed (or just use the text directly)
        // foe.condition = ... // Maybe update the foe object itself later during damage calc

        if (!foe.isDefeated) {
             foesHtml += `
                <div class="foe-status" id="foe-status-${foe.id}">
                    <strong>${foe.name} (${foe.type})</strong>
                    <p>AC: ${foe.ac}</p>
                    <p>Condition: <span class="foe-condition">${conditionText}</span></p>
                </div>
            `;
        } else {
             // Optionally show defeated foes differently
             // foesHtml += `<div class="foe-status defeated"><strong>${foe.name} (${foe.type})</strong><p>Condition: ${conditionText}</p></div>`;
        }
    });
    foesHtml += `</div>`; // Close foes section

    statusContainer.innerHTML = pcHtml + foesHtml;
}

// Basic Chat Update Function (can be expanded later)
function updateChatDisplay(sender, message) {
    // Clear placeholder only if it exists and we're adding the *first* real message
    const placeholder = chatContainer.querySelector('p em'); // More specific selector
    if (placeholder && placeholder.textContent.includes('Placeholder')) {
         chatContainer.innerHTML = '';
    }

    const messageElement = document.createElement('p');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`; // Use innerHTML for potential formatting/emojis
    chatContainer.appendChild(messageElement);
    // Auto-scroll to the bottom
    // Use requestAnimationFrame to ensure scrolling happens after DOM update
    requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}


// --- Encounter Start (Placeholder for next step) ---
function startEncounter() {
    console.log("Starting encounter...");
    // Display the initial GM narrative text (can be moved to LLM later)
    updateChatDisplay("GM", "The air smells of smoke and fear. Before you, the farmstead is ablaze. Crude shapes move in the firelight - Orcs! And a larger form, an Ogre, directs them as they herd terrified figures towards the woodline...");

    // --- Next logical steps to implement ---
    // 1. Add Player Input Field to HTML
    // 2. Add Event Listener for Player Input Submission
    // 3. Set encounter state to PLAYER_TURN (or similar)
    // 4. Implement handlePlayerInput function
    // (LLM Integration comes after basic input/output)
}

// --- NO CODE BELOW THIS LINE --- (Removed duplicated block)