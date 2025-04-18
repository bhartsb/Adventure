// --- Global Game State Variables ---
let playerCharacter = null;
let foes = [];
let conditionMap = null;
let llmInstructions = null;
let encounterState = 'PRE_ENCOUNTER'; // States: PRE_ENCOUNTER, API_KEY_PENDING, LOADING, GM_NARRATIVE, PLAYER_TURN, PROCESSING_PLAYER, GM_TURN, PROCESSING_GM, ENCOUNTER_END, ERROR
let llmApiKey = null; // To store the API key
let chatHistory = []; // Store conversation for LLM context

// --- LLM Configuration (MODIFY THESE) ---
const LLM_PROVIDER = "openai"; // CHANGED TO OPENAI
// -- Groq Config -- (Kept for reference, but not used now)
const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";
// -- OpenAI Config -- (These will be used now)
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-3.5-turbo"; // Or "gpt-4", "gpt-4-turbo-preview", etc.

// --- DOM References ---
const video = document.getElementById('intro-video');
const mainInterface = document.getElementById('main-interface');
const chatContainer = document.getElementById('chat-container');
const statusContainer = document.getElementById('status-container');
const chatLog = document.getElementById('chat-log');
const playerInput = document.getElementById('player-input');
const submitButton = document.getElementById('submit-button');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!video || !mainInterface || !chatContainer || !statusContainer || !chatLog || !playerInput || !submitButton) {
        console.error("Fatal Error: Essential DOM element not found!");
        document.body.innerHTML = "<h1 style='color:red; text-align: center;'>Error: Page structure incomplete. Check console.</h1>";
        return;
    }

    requestApiKey(); // Request API key on load

    video.muted = true;
    video.play().then(() => {
        console.log("Intro video playback started.");
    }).catch(error => {
        console.error("Autoplay was prevented:", error);
        // videoEndedHandler(); // Uncomment for testing if autoplay fails
    });
    video.addEventListener('ended', videoEndedHandler);

    submitButton.addEventListener('click', processPlayerInput);
    playerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            processPlayerInput();
        }
    });
});

function requestApiKey() {
    encounterState = 'API_KEY_PENDING';
    updateChatDisplay("System", `Please provide your ${LLM_PROVIDER.toUpperCase()} API Key for the Game Master.`);
    // Use password type to obscure input slightly, though still insecure
    llmApiKey = prompt(`Enter your ${LLM_PROVIDER.toUpperCase()} API Key:`);

    if (!llmApiKey) {
        console.error("API Key not provided.");
        updateChatDisplay("System", "API Key not provided. Game cannot continue without a GM.");
        encounterState = 'ERROR';
        setPlayerInputEnabled(false);
        updateStatusDisplay(); // Show error in status
    } else {
        console.log("API Key received (not shown).");
        updateChatDisplay("System", "API Key received. Starting video...");
        // Key conceptually available, allow video playback/end to proceed
    }
}

function videoEndedHandler() {
    console.log("Intro video finished.");
    if (encounterState === 'ERROR' || !mainInterface) return;

    mainInterface.classList.remove('hidden');
    mainInterface.style.display = 'flex';

    if (llmApiKey) {
         initializeGame();
    } else {
        updateChatDisplay("System", "Waiting for API key before initializing game...");
        // This state shouldn't be reachable if prompt blocks, but as a fallback
        encounterState = 'ERROR';
        updateStatusDisplay();
    }
}

// --- Game Initialization and Data Loading ---
async function initializeGame() {
    if (encounterState === 'LOADING' || !llmApiKey) return;
    console.log("Initializing game elements...");
    encounterState = 'LOADING';
    updateStatusDisplay();
    updateChatDisplay("System", "Loading game data...");

    try {
        // Added specific error messages for fetch failures
        const fetchJson = async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} fetching ${url}`);
            }
            try {
                return await response.json();
            } catch (e) {
                throw new Error(`Failed to parse JSON from ${url}: ${e.message}`);
            }
        };

        const [pcData, foesData, condMapData, instructionData] = await Promise.all([
            fetchJson('json/playerCharacter.json'),
            fetchJson('json/foes.json'),
            fetchJson('json/conditionMapping.json'),
            fetchJson('json/llmInstructions.json')
        ]);

        // Basic validation
        if (!pcData || typeof pcData !== 'object') throw new Error("Player character data invalid.");
        if (!Array.isArray(foesData)) throw new Error("Foes data should be an array.");
        if (!condMapData || typeof condMapData !== 'object') throw new Error("Condition map data invalid.");

        playerCharacter = pcData;
        playerCharacter.hp = playerCharacter.maxHp; // Ensure HP reset
        foes = foesData.map(f => ({ ...f, hp: f.maxHp, isDefeated: false, condition: '100' }));
        conditionMap = condMapData;
        llmInstructions = instructionData;

        console.log("Game data fetched and validated.");

        encounterState = 'INITIALIZING';
        updateStatusDisplay();
        updateChatDisplay("System", "Game ready. The adventure begins!");

        startEncounter();

    } catch (error) {
        console.error("Failed during game initialization:", error);
        encounterState = 'ERROR';
        updateStatusDisplay();
        updateChatDisplay("System", `Error initializing game: ${error.message}. Cannot start adventure.`);
        setPlayerInputEnabled(false);
    }
}

// --- UI Update Functions ---
// updateStatusDisplay() remains the same robust version from previous step
function updateStatusDisplay() {
    if (!statusContainer) { console.error("Status container DOM element not found!"); return; }
    // console.log(`Updating status display. State: ${encounterState}`); // Reduce console noise

    if (encounterState === 'LOADING' || encounterState === 'API_KEY_PENDING') {
        statusContainer.innerHTML = `<div class="status-section"><p><em>Loading stats...</em></p></div>`; return;
    }
    if (encounterState === 'ERROR') {
        statusContainer.innerHTML = `<div class="status-section"><p style="color: red;"><strong>Error loading/initializing! Check console.</strong></p></div>`; return;
    }
    if (!playerCharacter || !foes || !conditionMap) {
        console.error("UpdateStatusDisplay called but critical data is missing!", { playerCharacter, foes, conditionMap });
        statusContainer.innerHTML = `<div class="status-section"><p style="color: orange;"><strong>Data missing!</strong></p></div>`; return;
    }

    try {
        // Player Stats
        let pcHtml = `
            <div class="status-section">
                <h3>${playerCharacter.name || 'Unknown Player'} (Player)</h3>
                <p>HP: <span id="player-hp">${playerCharacter.hp ?? 'N/A'}</span> / ${playerCharacter.maxHp ?? 'N/A'}</p>
                <p>AC: ${playerCharacter.ac ?? 'N/A'}</p>
            </div><hr>`;
        // Foe Stats
        let foesHtml = `<div class="status-section"><h3>Foes</h3>`;
        if (!Array.isArray(foes) || foes.length === 0) { foesHtml += `<p>No foes present.</p>`; }
        else {
            foes.forEach((foe, index) => {
                if (!foe || typeof foe !== 'object') { foesHtml += `<p style="color: orange;">Invalid foe data.</p>`; return; }
                let conditionText = 'Unknown';
                const maxHp = foe.maxHp ?? 0; const currentHp = foe.hp ?? 0;
                const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
                let conditionKey = '100';
                if (currentHp <= 0) conditionKey = '0';
                else if (hpPercent < 25) conditionKey = '1-24';
                else if (hpPercent < 75) conditionKey = '25-74';
                else if (hpPercent < 100) conditionKey = '75-99';
                conditionText = conditionMap[conditionKey] || `Status ${conditionKey}`;
                const isDefeated = foe.isDefeated || currentHp <= 0;
                const foeClass = isDefeated ? "foe-status defeated" : "foe-status";
                foesHtml += `
                    <div class="${foeClass}" id="foe-status-${foe.id || index}">
                        <strong>${foe.name || `Foe ${index + 1}`} (${foe.type || 'Unknown'})</strong>
                        <p>AC: ${foe.ac ?? 'N/A'}</p>
                        <p>Condition: <span class="foe-condition">${conditionText}</span></p>
                    </div>`;
            });
        }
        foesHtml += `</div>`;
        statusContainer.innerHTML = pcHtml + foesHtml;
    } catch (error) {
        console.error("Error occurred inside updateStatusDisplay while rendering:", error);
        statusContainer.innerHTML = `<div class="status-section"><p style="color: red;"><strong>Error rendering stats!</strong></p></div>`;
    }
}


// updateChatDisplay() remains the same robust version
function updateChatDisplay(sender, message) {
    if (!chatLog) return;
    const placeholder = chatLog.querySelector('p em');
    if (placeholder && placeholder.textContent.includes('Loading chat')) {
         chatLog.innerHTML = '';
    }
    const messageElement = document.createElement('p');
    const sanitizedMessage = String(message).replace(/</g, "<").replace(/>/g, ">");
    messageElement.innerHTML = `<strong>${sender}:</strong> ${sanitizedMessage}`;
    chatLog.appendChild(messageElement);
    scrollToChatBottom();
}

// scrollToChatBottom() remains the same
function scrollToChatBottom() {
     requestAnimationFrame(() => {
        if (chatLog) {
             chatLog.scrollTop = chatLog.scrollHeight;
        }
    });
}

// setPlayerInputEnabled() remains the same robust version
function setPlayerInputEnabled(isEnabled) {
    if (playerInput && submitButton) {
        playerInput.disabled = !isEnabled;
        submitButton.disabled = !isEnabled;
        if (isEnabled) {
            try { playerInput.focus(); } catch (e) { /* Ignore */ }
            playerInput.placeholder = "Enter command (e.g., attack orc1)...";
        } else {
             playerInput.placeholder = "Waiting...";
        }
    } else {
        if (!window.inputElementsMissingLogged) { console.error("Input elements missing!"); window.inputElementsMissingLogged = true; }
    }
}

// --- Game Logic Functions ---
// startEncounter() remains the same
function startEncounter() {
    console.log("Starting encounter sequence... Requesting initial GM narrative.");
    encounterState = 'GM_NARRATIVE';
    setPlayerInputEnabled(false);
    chatHistory = [];

    // Construct initial prompt
    let initialPrompt = (llmInstructions?.system_prompt || "You are a helpful assistant.") + "\n" +
                        (llmInstructions?.rules_summary || "Follow standard RPG rules.") + "\n";
    initialPrompt += `The player character is: ${playerCharacter?.description_for_llm || 'A brave adventurer.'}\n`;
    initialPrompt += "The foes present are:\n";
    if (Array.isArray(foes)) {
        foes.forEach(foe => {
             initialPrompt += `- ${foe.name || 'Unknown Foe'} (${foe.id || 'N/A'}, ${foe.type || 'Unknown'}): ${foe.description_for_llm || 'A mysterious enemy.'} Condition: Unharmed.\n`;
        });
    }
    initialPrompt += "\nDescribe the scene vividly (burning farmstead, captives being herded) and the initial positions/actions of the foes. The player has just arrived.";

    addMessageToHistory('system', initialPrompt);
    addMessageToHistory('user', "Describe the scene."); // Trigger initial narrative

    callLlmApi(chatHistory);
}


// setTurn() remains the same robust version
function setTurn(turn) {
    if (encounterState === 'ENCOUNTER_END') { console.log("Attempted to set turn after encounter ended. Ignoring."); return; }
    console.log(`Setting turn state to: ${turn}`);
    encounterState = turn;
    if (encounterState === 'PLAYER_TURN') {
        updateChatDisplay("System", "Your turn. What do you do?");
        setPlayerInputEnabled(true);
    } else {
        setPlayerInputEnabled(false);
        if (encounterState === 'GM_TURN') {
             updateChatDisplay("System", "GM is thinking...");
             setTimeout(() => { if (encounterState === 'GM_TURN') { prepareAndCallLlmForGmTurn(); } }, 1500); // Pass NO player action description
        }
    }
}

// processPlayerInput() remains the same
function processPlayerInput() {
    if (encounterState !== 'PLAYER_TURN' || !playerInput) return;
    const command = playerInput.value.trim().toLowerCase();
    if (!command) return;
    setPlayerInputEnabled(false);
    updateChatDisplay(playerCharacter?.name || 'Player', command);
    playerInput.value = '';
    handlePlayerCommand(command);
}


// handlePlayerCommand() remains the same robust version
function handlePlayerCommand(command) {
    if (encounterState === 'ENCOUNTER_END') return;
    encounterState = 'PROCESSING_PLAYER';
    const parts = command.split(' ');
    const action = parts[0];
    const targetId = parts[1];
    let playerActionDescription = ""; // Describe action for LLM

    if (action === 'attack') {
        if (!targetId) { updateChatDisplay("System", "Who do you want to attack? (e.g., attack orc1)"); setTurn('PLAYER_TURN'); return; }
        const target = foes.find(foe => foe.id === targetId);
         if (!target) { updateChatDisplay("System", `Invalid target ID: ${targetId}.`); setTurn('PLAYER_TURN'); return; }
         if (target.isDefeated) { updateChatDisplay("System", `${target.name || 'Target'} is already defeated.`); setTurn('PLAYER_TURN'); return; }

        playerActionDescription = `${playerCharacter?.name || 'Player'} attacks ${target.name || 'Target'} (${targetId}).`;
        playerAttack(targetId);
    }
    else {
        updateChatDisplay("System", `Unknown command: "${action}". Try 'attack [target_id]'.`);
        playerActionDescription = `${playerCharacter?.name || 'Player'} tried to use an unknown command: ${action}.`;
        // Still proceed to GM turn even on unknown command
    }

    if (checkWinCondition()) return;

    prepareAndCallLlmForGmTurn(playerActionDescription); // Pass description
}


// playerAttack() remains the same robust version
function playerAttack(targetId) {
    if (encounterState === 'ENCOUNTER_END') return;
    const attacker = playerCharacter;
    const target = foes.find(foe => foe.id === targetId);
    if (!attacker || !target) { console.error("Player attack issue.", { attacker, target }); setTurn('PLAYER_TURN'); return; }
    const attackRoll = rollDice('1d20');
    const attackBonus = parseInt(attacker.favoredWeapon?.attackBonus) || 0;
    const totalAttack = attackRoll + attackBonus;
    const targetAC = target.ac ?? 10;
    updateChatDisplay("System", `${attacker.name} attacks ${target.name} with ${attacker.favoredWeapon?.name || 'fists'}... Rolling d20 + ${attackBonus} vs AC ${targetAC}.`);
    updateChatDisplay("Roll", `🎲 Result: ${attackRoll} + ${attackBonus} = ${totalAttack}`);
    if (totalAttack >= targetAC) {
        updateChatDisplay("System", `Hit!`);
        const damageDice = attacker.favoredWeapon?.damage || '1d4';
        const damageResult = rollDice(damageDice);
        updateChatDisplay("Roll", `💥 Damage (${damageDice}): ${damageResult}`);
        target.hp = (target.hp ?? 0) - damageResult;
        updateChatDisplay("System", `${target.name} takes ${damageResult} damage.`);
        if (target.hp <= 0) {
            target.hp = 0; target.isDefeated = true; target.condition = '0';
            updateChatDisplay("System", `${target.name} is defeated! 💀`);
        } else {
            const maxHp = target.maxHp ?? 1;
            const hpPercent = (target.hp / maxHp) * 100;
            let conditionKey = '100';
            if (hpPercent < 25) conditionKey = '1-24';
            else if (hpPercent < 75) conditionKey = '25-74';
            else if (hpPercent < 100) conditionKey = '75-99';
            target.condition = conditionKey;
            updateChatDisplay("System", `${target.name}'s condition is now: ${conditionMap[target.condition] || `Status ${target.condition}`}`);
        }
    } else { updateChatDisplay("System", `Miss!`); }
    updateStatusDisplay();
}


// --- LLM Integration ---
// addMessageToHistory() remains the same
function addMessageToHistory(role, content) {
    chatHistory.push({ role, content });
    const MAX_HISTORY = 10;
    if (chatHistory.length > MAX_HISTORY) {
         chatHistory = [chatHistory[0], ...chatHistory.slice(-(MAX_HISTORY - 1))];
    }
}

// prepareAndCallLlmForGmTurn() remains the same robust version
async function prepareAndCallLlmForGmTurn(playerActionDescription = "Player finished their turn.") {
    if (encounterState === 'ENCOUNTER_END') return;
    encounterState = 'GM_TURN'; // Mark that we are waiting for the GM/LLM
    setPlayerInputEnabled(false);
    updateChatDisplay("System", "GM is thinking...");

    let gmTurnContext = "Current Game State:\n";
    gmTurnContext += `- ${playerCharacter?.name || 'Player'} HP: ${playerCharacter?.hp ?? 'N/A'}/${playerCharacter?.maxHp ?? 'N/A'}\n`;
    gmTurnContext += "Foes:\n";
    if(Array.isArray(foes)) {
        foes.forEach(foe => {
            const conditionText = conditionMap[foe.condition] || `Status ${foe.condition}`;
            gmTurnContext += `- ${foe.name || 'Foe'} (${foe.id || 'N/A'}): Condition ${conditionText} ${foe.isDefeated ? '(Defeated)' : ''}\n`;
        });
    }
    gmTurnContext += `\nPrevious player action result: ${playerActionDescription}\n`;
    gmTurnContext += "\nTask: Narrate the results of the player's action (if any noticeable effect). Then, describe the actions of ALL active (not defeated) foes based on the rules and their nature (they should prioritize attacking the player). Keep the narration engaging but concise. **Crucially, for each foe that attacks, state CLEARLY and EXACTLY 'ACTION: [Foe Name] attacks player.' on a new line.** Do not add extra words around this specific action line for attacking foes.";

    addMessageToHistory('user', gmTurnContext); // Add context as user message for LLM turn

    await callLlmApi(chatHistory);
}


// callLlmApi() - Logic for switching provider is already here
async function callLlmApi(messages) {
    if (!llmApiKey) {
        updateChatDisplay("System", "Error: API Key is missing.");
        encounterState = 'ERROR'; updateStatusDisplay(); return;
    }
    console.log(`Calling LLM API provider: ${LLM_PROVIDER}`);

    let endpoint = "";
    let model = "";
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    // Configure based on provider
    if (LLM_PROVIDER === "openai") {
        endpoint = OPENAI_API_ENDPOINT;
        model = OPENAI_MODEL;
        headers['Authorization'] = `Bearer ${llmApiKey}`;
        body = JSON.stringify({ model: model, messages: messages, temperature: 0.7, max_tokens: 300 });
    } else if (LLM_PROVIDER === "groq") {
        // Kept for reference, but openai is selected
        endpoint = GROQ_API_ENDPOINT;
        model = GROQ_MODEL;
        headers['Authorization'] = `Bearer ${llmApiKey}`;
        body = JSON.stringify({ model: model, messages: messages, temperature: 0.7, max_tokens: 300 });
    } else {
        updateChatDisplay("System", "Error: Invalid LLM_PROVIDER configured.");
        encounterState = 'ERROR'; updateStatusDisplay(); return;
    }

    try {
        const response = await fetch(endpoint, { method: 'POST', headers: headers, body: body });

        if (!response.ok) {
            const errorBody = await response.text();
            // Attempt to parse JSON error for more detail
             let errorDetails = errorBody;
             try {
                  const parsedError = JSON.parse(errorBody);
                  errorDetails = parsedError.error?.message || errorBody;
             } catch (e) { /* Ignore if not JSON */ }
            throw new Error(`LLM API request failed! Status: ${response.status}. Details: ${errorDetails}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
             throw new Error("LLM response format invalid or missing content.");
        }

        const gmResponseText = data.choices[0].message.content.trim();
        addMessageToHistory('assistant', gmResponseText);
        handleLlmResponse(gmResponseText);

    } catch (error) {
        console.error("Error calling LLM API:", error);
        updateChatDisplay("System", `Error communicating with GM: ${error.message}`);
        updateChatDisplay("System", "An error occurred. Giving turn back to player.");
        encounterState = 'ERROR'; // Mark as error but allow player turn
        setTurn('PLAYER_TURN'); // Give control back
    }
}

// handleLlmResponse() - Updated parsing
function handleLlmResponse(responseText) {
    if (encounterState === 'ENCOUNTER_END') return;

    updateChatDisplay("GM", responseText); // Display the narrative first

    // --- Improved Parsing for Foe Actions ---
    // Look for the specific line format: "ACTION: [Foe Name] attacks player."
    const attackingFoesIds = [];
    const actionLines = responseText.split('\n'); // Split response into lines

    actionLines.forEach(line => {
        const trimmedLine = line.trim();
        const match = trimmedLine.match(/^ACTION:\s*([\w\s]+)\s+attacks\s+player\.?$/i); // Case-insensitive match
        if (match) {
            const foeName = match[1].trim();
            // Find the foe ID corresponding to the name
            const foe = foes.find(f => f.name.toLowerCase() === foeName.toLowerCase() && !f.isDefeated);
            if (foe) {
                console.log(`Detected attack action for: ${foe.name} (ID: ${foe.id}) via specific format.`);
                if (!attackingFoesIds.includes(foe.id)) { // Avoid duplicate attacks if mentioned twice
                     attackingFoesIds.push(foe.id);
                }
            } else {
                 console.warn(`LLM mentioned attacking foe "${foeName}", but no active foe found with that name.`);
            }
        }
    });


    // Execute attacks for identified foes
    if (attackingFoesIds.length > 0) {
         encounterState = 'PROCESSING_GM';
         updateChatDisplay("System", "Resolving foe actions...");
         attackingFoesIds.forEach(foeId => {
            if (encounterState !== 'ENCOUNTER_END') { // Check if player lost mid-way
                foeAttack(foeId);
            }
         });
    } else {
        updateChatDisplay("System", "No specific foe attacks detected in GM response this turn.");
    }

    // Transition back to Player Turn (if game not ended)
    if (!checkWinCondition() && !checkLossCondition() && encounterState !== 'ENCOUNTER_END') {
        setTurn('PLAYER_TURN');
    } else {
         // If game ended, ensure input stays disabled
         setPlayerInputEnabled(false);
    }
}

// --- End Condition Checks ---
// checkWinCondition() remains the same robust version
function checkWinCondition() {
    if (!foes || foes.length === 0) return false;
    const allFoesDefeated = foes.every(foe => foe.isDefeated || foe.hp <= 0);
    if (allFoesDefeated) {
        if (encounterState !== 'ENCOUNTER_END') {
             console.log("ENCOUNTER WON!");
             encounterState = 'ENCOUNTER_END';
             updateChatDisplay("System", "Victory! All foes have been defeated!");
             setPlayerInputEnabled(false);
             // TODO: Trigger Win Video logic here
        }
        return true;
    }
    return false;
}

// checkLossCondition() remains the same robust version
function checkLossCondition() {
     if (playerCharacter && playerCharacter.hp <= 0) {
         if (encounterState !== 'ENCOUNTER_END') {
             console.log("ENCOUNTER LOST!");
             encounterState = 'ENCOUNTER_END';
             updateChatDisplay("System", "You have fallen in battle...");
             setPlayerInputEnabled(false);
             // TODO: Trigger Loss Video logic here
          }
         return true;
     }
     return false;
}

// --- Foe Attack Mechanics ---
// foeAttack() remains the same robust version
function foeAttack(foeId) {
    if (encounterState === 'ENCOUNTER_END') return;
    const attacker = foes.find(foe => foe.id === foeId);
    const target = playerCharacter;
    if (!attacker || attacker.isDefeated || !target) { console.error("Foe attack issue.", { attacker, target }); return; }
    const attackRoll = rollDice('1d20');
    const attackBonus = parseInt(attacker.favoredWeapon?.attackBonus) || 0;
    const totalAttack = attackRoll + attackBonus;
    const targetAC = target.ac ?? 10;
    updateChatDisplay("GM Action", `${attacker.name || 'Foe'} attacks ${target.name} with ${attacker.favoredWeapon?.name || 'claws'}... Rolling d20 + ${attackBonus} vs AC ${targetAC}.`); // Changed sender for clarity
    updateChatDisplay("Roll", `🎲 Result: ${attackRoll} + ${attackBonus} = ${totalAttack}`);
    if (totalAttack >= targetAC) {
        updateChatDisplay("GM Action", `Hit!`); // Changed sender
        const damageDice = attacker.favoredWeapon?.damage || '1d6';
        const damageResult = rollDice(damageDice);
        updateChatDisplay("Roll", `💥 Damage (${damageDice}): ${damageResult}`);
        target.hp = (target.hp ?? 0) - damageResult;
        updateChatDisplay("GM Action", `${target.name} takes ${damageResult} damage.`); // Changed sender
        if (target.hp <= 0) { target.hp = 0; updateChatDisplay("GM Action", `${target.name} HP is now: 0`); }
        else { updateChatDisplay("GM Action", `${target.name} HP is now: ${target.hp}`); }
    } else { updateChatDisplay("GM Action", `Miss!`); } // Changed sender
     updateStatusDisplay();
}


// --- Dice Rolling Utility ---
// rollDice() remains the same robust version
function rollDice(diceString) {
    if (typeof diceString !== 'string') { console.error(`Invalid dice string type: ${typeof diceString}`); return 0; }
    const match = diceString.toLowerCase().match(/(\d+)?d(\d+)([+-]\d+)?/);
    if (!match) { console.error(`Invalid dice string format: ${diceString}`); return 0; }
    const numDice = match[1] ? parseInt(match[1]) : 1;
    const diceType = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    if (isNaN(numDice) || isNaN(diceType) || isNaN(modifier) || diceType <= 0) { console.error(`Invalid parsed dice values: ${diceString}`); return 0; }
    let total = 0;
    for (let i = 0; i < numDice; i++) { total += Math.floor(Math.random() * diceType) + 1; }
    const result = total + modifier;
    return result;
}