// --- Global Game State Variables ---
let playerCharacter = null;
let foes = [];
let conditionMap = null;
let llmInstructions = null;
let encounterState = 'PRE_ENCOUNTER'; // States: PRE_ENCOUNTER, LOADING, GM_TURN, PLAYER_TURN, PROCESSING, ENCOUNTER_END

// --- DOM References ---
const video = document.getElementById('intro-video');
const mainInterface = document.getElementById('main-interface');
const chatContainer = document.getElementById('chat-container');
const statusContainer = document.getElementById('status-container');
const chatLog = document.getElementById('chat-log'); // Specific log area
const playerInput = document.getElementById('player-input');
const submitButton = document.getElementById('submit-button');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure elements exist before adding listeners
    if (!video || !mainInterface || !chatContainer || !statusContainer || !chatLog || !playerInput || !submitButton) {
        console.error("Fatal Error: Essential DOM element not found!");
        return; // Stop initialization if critical elements are missing
    }

    video.muted = true;
    video.play().then(() => {
        console.log("Intro video playback started.");
    }).catch(error => {
        console.error("Autoplay was prevented:", error);
        // Manually trigger for testing if needed
        // console.log("Autoplay failed, manually triggering video end handler for testing...");
        // videoEndedHandler();
    });
    video.addEventListener('ended', videoEndedHandler);

    // Add listeners for player input
    submitButton.addEventListener('click', processPlayerInput);
    playerInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            processPlayerInput();
        }
    });
});

function videoEndedHandler() {
    console.log("Intro video finished.");
    if (!mainInterface) return; // Safety check
    mainInterface.classList.remove('hidden');
    mainInterface.style.display = 'flex';
    initializeGame();
}

// --- Game Initialization and Data Loading ---
async function initializeGame() {
    console.log("Initializing game elements...");
    encounterState = 'LOADING';
    updateStatusDisplay(); // Show initial loading state
    updateChatDisplay("System", "Loading game data...");

    try {
        const [pcData, foesData, condMapData, instructionData] = await Promise.all([
            fetch('json/playerCharacter.json').then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.json(); }),
            fetch('json/foes.json').then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.json(); }),
            fetch('json/conditionMapping.json').then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.json(); }),
            fetch('json/llmInstructions.json').then(res => { if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return res.json(); })
        ]);

        // --- Data Validation (Basic) ---
        if (!pcData || typeof pcData !== 'object') throw new Error("Player character data invalid.");
        if (!Array.isArray(foesData)) throw new Error("Foes data should be an array.");
        if (!condMapData || typeof condMapData !== 'object') throw new Error("Condition map data invalid.");
        // Add more specific checks if needed (e.g., pcData.name exists)

        playerCharacter = pcData;
        foes = foesData;
        conditionMap = condMapData;
        llmInstructions = instructionData;

        console.log("Game data fetched and validated (basic).", { playerCharacter, foes: foes.length, conditionMap, llmInstructions });

        // Explicitly set state *before* updating display
        encounterState = 'INITIALIZING'; // Temporary state before GM turn
        updateStatusDisplay(); // Render initial stats NOW with loaded data
        updateChatDisplay("System", "Game ready. The adventure begins!");

        startEncounter(); // This will set GM/PLAYER turn

    } catch (error) {
        console.error("Failed during game initialization:", error);
        encounterState = 'ERROR';
        updateStatusDisplay(); // Show error state in status pane
        updateChatDisplay("System", `Error initializing game: ${error.message}. Cannot start adventure.`);
        setPlayerInputEnabled(false);
    }
}

// --- UI Update Functions ---

function updateStatusDisplay() {
    // Ensure status container exists
    if (!statusContainer) {
        console.error("Status container DOM element not found!");
        return;
    }
    console.log(`Updating status display. State: ${encounterState}`); // Log state

    // Handle states where data might not be ready
    if (encounterState === 'LOADING') {
        statusContainer.innerHTML = `<div class="status-section"><p><em>Loading stats...</em></p></div>`;
        return;
    }
    if (encounterState === 'ERROR') {
        statusContainer.innerHTML = `<div class="status-section"><p style="color: red;"><strong>Error loading game data!</strong></p></div>`;
        return;
    }

    // --- Check if data is actually available NOW ---
    // This check is crucial. If we reach here post-loading, data MUST exist.
    if (!playerCharacter || !foes || !conditionMap) {
        console.error("UpdateStatusDisplay called but critical data is missing!", { playerCharacter, foes, conditionMap });
        statusContainer.innerHTML = `<div class="status-section"><p style="color: orange;"><strong>Data missing, cannot display stats!</strong></p></div>`;
        return; // Stop execution if data isn't loaded
    }

    console.log("Rendering status with loaded data:", { name: playerCharacter.name, hp: playerCharacter.hp, ac: playerCharacter.ac, foeCount: foes.length });

    try {
        // Player Stats
        let pcHtml = `
            <div class="status-section">
                <h3>${playerCharacter.name || 'Unknown Player'} (Player)</h3>
                <p>HP: <span id="player-hp">${playerCharacter.hp ?? 'N/A'}</span> / ${playerCharacter.maxHp ?? 'N/A'}</p>
                <p>AC: ${playerCharacter.ac ?? 'N/A'}</p>
            </div>
            <hr>
        `;

        // Foe Stats
        let foesHtml = `<div class="status-section"><h3>Foes</h3>`;
        if (!Array.isArray(foes) || foes.length === 0) {
             foesHtml += `<p>No foes present.</p>`;
        } else {
            foes.forEach((foe, index) => {
                // Basic validation for each foe object
                if (!foe || typeof foe !== 'object') {
                    console.warn(`Invalid foe data at index ${index}`);
                    foesHtml += `<p style="color: orange;">Invalid foe data found.</p>`;
                    return; // Skip this invalid foe entry
                }

                let conditionText = 'Unknown';
                const maxHp = foe.maxHp ?? 0; // Use default if maxHp is missing
                const currentHp = foe.hp ?? 0; // Use default if hp is missing
                const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;

                // Determine condition key (ensure keys exist in conditionMap or use defaults)
                let conditionKey = '100';
                if (currentHp <= 0) conditionKey = '0';
                else if (hpPercent < 25) conditionKey = '1-24';
                else if (hpPercent < 75) conditionKey = '25-74';
                else if (hpPercent < 100) conditionKey = '75-99';

                conditionText = conditionMap[conditionKey] || `Status ${conditionKey}`; // Use key if text missing

                // Determine display class
                const isDefeated = foe.isDefeated || currentHp <= 0; // Check flag or HP
                const foeClass = isDefeated ? "foe-status defeated" : "foe-status";

                 foesHtml += `
                    <div class="${foeClass}" id="foe-status-${foe.id || index}"> <!-- Use index if id missing -->
                        <strong>${foe.name || `Foe ${index + 1}`} (${foe.type || 'Unknown Type'})</strong>
                        <p>AC: ${foe.ac ?? 'N/A'}</p>
                        <p>Condition: <span class="foe-condition">${conditionText}</span></p>
                    </div>
                `;
            });
        }
        foesHtml += `</div>`;

        // --- Update the DOM ---
        statusContainer.innerHTML = pcHtml + foesHtml;
        console.log("Status display update complete.");

    } catch (error) {
        console.error("Error occurred inside updateStatusDisplay while rendering:", error);
        statusContainer.innerHTML = `<div class="status-section"><p style="color: red;"><strong>Error rendering stats! Check console.</strong></p></div>`;
    }
}

// Updated Chat Function
function updateChatDisplay(sender, message) {
    if (!chatLog) return; // Safety check
    const placeholder = chatLog.querySelector('p em');
    if (placeholder && placeholder.textContent.includes('Loading chat')) {
         chatLog.innerHTML = '';
    }

    const messageElement = document.createElement('p');
    // Basic sanitization
    const sanitizedMessage = String(message).replace(/</g, "<").replace(/>/g, ">"); // Ensure message is string
    messageElement.innerHTML = `<strong>${sender}:</strong> ${sanitizedMessage}`;
    chatLog.appendChild(messageElement);
    scrollToChatBottom();
}

function scrollToChatBottom() {
     requestAnimationFrame(() => {
        if (chatLog) {
             chatLog.scrollTop = chatLog.scrollHeight;
        }
    });
}

// Function to enable/disable player input
function setPlayerInputEnabled(isEnabled) {
    if (playerInput && submitButton) {
        playerInput.disabled = !isEnabled;
        submitButton.disabled = !isEnabled;
        if (isEnabled) {
            try { playerInput.focus(); } catch (e) { /* Ignore potential focus errors */ }
            playerInput.placeholder = "Enter command (e.g., attack orc1)...";
        } else {
             playerInput.placeholder = "Waiting...";
        }
    } else {
        // Log error only once if elements keep missing
        if (!window.inputElementsMissingLogged) {
            console.error("Input elements (player-input/submit-button) not found!");
            window.inputElementsMissingLogged = true; // Prevent spamming console
        }
    }
}

// --- Game Logic Functions ---

function startEncounter() {
    console.log("Starting encounter sequence...");
    encounterState = 'GM_NARRATIVE'; // State while GM gives intro text
    updateChatDisplay("GM", "The air smells of smoke and fear. Before you, the farmstead is ablaze. Crude shapes move in the firelight - Orcs! And a larger form, an Ogre, directs them as they herd terrified figures towards the woodline...");
    // Now transition to player's turn
    setTurn('PLAYER_TURN');
}

function setTurn(turn) {
    // Prevent state change if game ended
    if (encounterState === 'ENCOUNTER_END') {
        console.log("Attempted to set turn after encounter ended. Ignoring.");
        return;
    }
    console.log(`Setting turn state to: ${turn}`);
    encounterState = turn;

    if (encounterState === 'PLAYER_TURN') {
        updateChatDisplay("System", "Your turn. What do you do?");
        setPlayerInputEnabled(true);
    } else {
        setPlayerInputEnabled(false);
        if (encounterState === 'GM_TURN') {
             updateChatDisplay("System", "GM is thinking...");
             // Ensure handleGmTurn only runs if state is still GM_TURN after delay
             setTimeout(() => {
                 if (encounterState === 'GM_TURN') {
                     handleGmTurn();
                 }
             }, 1500);
        }
    }
}

function processPlayerInput() {
    if (encounterState !== 'PLAYER_TURN' || !playerInput) {
        return;
    }
    const command = playerInput.value.trim().toLowerCase();
    if (!command) return; // Ignore empty input

    setPlayerInputEnabled(false);
    updateChatDisplay(playerCharacter?.name || 'Player', command); // Use optional chaining
    playerInput.value = '';

    handlePlayerCommand(command);
}

function handlePlayerCommand(command) {
    if (encounterState === 'ENCOUNTER_END') return; // Don't process if game over
    encounterState = 'PROCESSING';
    const parts = command.split(' ');
    const action = parts[0];
    const targetId = parts[1];

    if (action === 'attack') {
        if (!targetId) {
            updateChatDisplay("System", "Who do you want to attack? (e.g., attack orc1)");
            setTurn('PLAYER_TURN');
            return;
        }
        // Validate target existence and status
        const target = foes.find(foe => foe.id === targetId);
         if (!target) {
             updateChatDisplay("System", `Invalid target ID: ${targetId}.`);
             setTurn('PLAYER_TURN');
             return;
         }
         if (target.isDefeated) {
            updateChatDisplay("System", `${target.name || 'Target'} is already defeated.`);
            setTurn('PLAYER_TURN');
            return;
         }
        playerAttack(targetId); // Proceed with attack
    }
    else {
        updateChatDisplay("System", `Unknown command: "${action}". Try 'attack [target_id]'.`);
        setTurn('PLAYER_TURN');
        return;
    }

    // Check win condition immediately after player action resolves
    // updateStatusDisplay was already called inside playerAttack if needed
    if (checkWinCondition()) {
        return; // Win logic handles state
    }

    // If player didn't win, proceed to GM turn
    setTurn('GM_TURN');
}

function playerAttack(targetId) {
    if (encounterState === 'ENCOUNTER_END') return; // Safety check
    const attacker = playerCharacter;
    const target = foes.find(foe => foe.id === targetId); // Assumes target is valid/active

    if (!attacker || !target) {
        console.error("Player attack called with invalid attacker or target.", { attacker, target });
        setTurn('PLAYER_TURN'); // Failsafe
        return;
    }

    const attackRoll = rollDice('1d20');
    const attackBonus = parseInt(attacker.favoredWeapon?.attackBonus) || 0; // Optional chaining
    const totalAttack = attackRoll + attackBonus;
    const targetAC = target.ac ?? 10; // Default AC if missing

    updateChatDisplay("System", `${attacker.name} attacks ${target.name} with ${attacker.favoredWeapon?.name || 'fists'}... Rolling d20 + ${attackBonus} vs AC ${targetAC}.`);
    updateChatDisplay("Roll", `🎲 Result: ${attackRoll} + ${attackBonus} = ${totalAttack}`);

    if (totalAttack >= targetAC) {
        updateChatDisplay("System", `Hit!`);
        const damageDice = attacker.favoredWeapon?.damage || '1d4'; // Default damage
        const damageResult = rollDice(damageDice);
        updateChatDisplay("Roll", `💥 Damage (${damageDice}): ${damageResult}`);

        target.hp = (target.hp ?? 0) - damageResult; // Ensure hp is a number
        updateChatDisplay("System", `${target.name} takes ${damageResult} damage.`);

        if (target.hp <= 0) {
            target.hp = 0;
            target.isDefeated = true;
            target.condition = '0'; // Use the key directly if preferred
            updateChatDisplay("System", `${target.name} is defeated! 💀`);
        } else {
            // Determine condition key
            const maxHp = target.maxHp ?? 1; // Avoid division by zero
            const hpPercent = (target.hp / maxHp) * 100;
            let conditionKey = '100';
            if (hpPercent < 25) conditionKey = '1-24';
            else if (hpPercent < 75) conditionKey = '25-74';
            else if (hpPercent < 100) conditionKey = '75-99';
            target.condition = conditionKey; // Update the foe's state
            // Log new condition text from map
            updateChatDisplay("System", `${target.name}'s condition is now: ${conditionMap[target.condition] || `Status ${target.condition}`}`);
        }
    } else {
        updateChatDisplay("System", `Miss!`);
    }
    // Update UI AFTER all calculations for this attack are done
    updateStatusDisplay();
}


function checkWinCondition() {
    if (!foes || foes.length === 0) return false; // Can't win if no foes loaded
    const allFoesDefeated = foes.every(foe => foe.isDefeated || foe.hp <= 0); // Check both flag and HP
    if (allFoesDefeated) {
        console.log("ENCOUNTER WON!");
        if (encounterState !== 'ENCOUNTER_END') { // Prevent multiple win messages
             encounterState = 'ENCOUNTER_END';
             updateChatDisplay("System", "Victory! All foes have been defeated!");
             setPlayerInputEnabled(false);
             // TODO: Trigger Win Video logic here
        }
        return true;
    }
    return false;
}

function checkLossCondition() {
     if (playerCharacter && playerCharacter.hp <= 0) { // Check PC exists
         console.log("ENCOUNTER LOST!");
          if (encounterState !== 'ENCOUNTER_END') { // Prevent multiple loss messages
             encounterState = 'ENCOUNTER_END';
             updateChatDisplay("System", "You have fallen in battle...");
             setPlayerInputEnabled(false);
             // TODO: Trigger Loss Video logic here
          }
         return true;
     }
     return false;
}

// --- Placeholder for GM's Turn Logic ---
function handleGmTurn() {
    if (encounterState !== 'GM_TURN') {
        console.log("handleGmTurn called but state is not GM_TURN, aborting.");
        return; // Abort if state changed during timeout
    }
    console.log("Handling GM Turn...");
    encounterState = 'PROCESSING'; // Mark as processing GM turn

    const activeFoes = foes.filter(foe => !foe.isDefeated && foe.hp > 0);

    if (activeFoes.length === 0) {
         console.warn("GM Turn: No active foes found, game should have ended via win condition.");
         // Force check win condition again? Or just proceed?
         if (!checkWinCondition()) { // If somehow not won, give turn back
              setTurn('PLAYER_TURN');
         }
         return;
    }

    // Simple Logic: First active foe attacks
    const attacker = activeFoes[0];
    foeAttack(attacker.id); // Foe attack logic remains largely the same


    // Check loss condition AFTER the foe's attack resolves
    // updateStatusDisplay was already called inside foeAttack
    if (checkLossCondition()) {
        return; // Loss logic handles state
    }

    // If player didn't lose, proceed to Player turn
    setTurn('PLAYER_TURN');
}


function foeAttack(foeId) {
    if (encounterState === 'ENCOUNTER_END') return; // Safety check
    const attacker = foes.find(foe => foe.id === foeId);
    const target = playerCharacter;

    if (!attacker || attacker.isDefeated || !target) {
        console.error("Foe attack called with invalid attacker/target or defeated foe.", { attacker, target });
        // Don't give turn back here, let handleGmTurn decide next step
        return;
    }

    const attackRoll = rollDice('1d20');
    const attackBonus = parseInt(attacker.favoredWeapon?.attackBonus) || 0;
    const totalAttack = attackRoll + attackBonus;
    const targetAC = target.ac ?? 10;

    updateChatDisplay("GM", `${attacker.name || 'Foe'} attacks ${target.name} with ${attacker.favoredWeapon?.name || 'claws'}... Rolling d20 + ${attackBonus} vs AC ${targetAC}.`);
    updateChatDisplay("Roll", `🎲 Result: ${attackRoll} + ${attackBonus} = ${totalAttack}`);

    if (totalAttack >= targetAC) {
        updateChatDisplay("GM", `Hit!`);
        const damageDice = attacker.favoredWeapon?.damage || '1d6'; // Default damage
        const damageResult = rollDice(damageDice);
        updateChatDisplay("Roll", `💥 Damage (${damageDice}): ${damageResult}`);

        target.hp = (target.hp ?? 0) - damageResult;
        updateChatDisplay("GM", `${target.name} takes ${damageResult} damage.`);

        if (target.hp <= 0) {
            target.hp = 0;
            updateChatDisplay("GM", `${target.name} HP is now: 0`);
            // Loss condition is checked in handleGmTurn after this function returns
        } else {
            updateChatDisplay("GM", `${target.name} HP is now: ${target.hp}`);
        }

    } else {
        updateChatDisplay("GM", `Miss!`);
    }
     updateStatusDisplay(); // Update player HP display
}

// --- Dice Rolling Utility ---
function rollDice(diceString) {
    if (typeof diceString !== 'string') { // Basic type check
        console.error(`Invalid dice string type: ${typeof diceString}`);
        return 0;
    }
    const match = diceString.toLowerCase().match(/(\d+)?d(\d+)([+-]\d+)?/);
    if (!match) {
        console.error(`Invalid dice string format: ${diceString}`);
        return 0;
    }
    const numDice = match[1] ? parseInt(match[1]) : 1;
    const diceType = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    if (isNaN(numDice) || isNaN(diceType) || isNaN(modifier) || diceType <= 0) {
        console.error(`Invalid parsed dice values: ${diceString}`);
        return 0; // Invalid numbers
    }

    let total = 0;
    for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * diceType) + 1;
    }
    const result = total + modifier;
    // console.log(`Rolled ${diceString}: ${result} (Dice: ${total}, Mod: ${modifier})`); // Keep console cleaner
    return result;
}