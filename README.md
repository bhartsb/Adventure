# Adventure
An encounter based adventure game


PRD:
# Product Requirements Document: Adventure (MVP 1.0 - Farmstead Raid)

**Version:** 1.0
**Date:** 2024-05-16

## 1. Introduction

*   **Product:** Adventure - A Javascript web application combining video storytelling with an LLM-powered text-based adventure encounter.
*   **Vision:** To create immersive, interactive narrative experiences driven by AI, starting with classic fantasy adventure tropes.
*   **Scope (MVP 1.0):** This document outlines the requirements for the initial Proof of Concept (POC). The focus is on demonstrating the core gameplay loop for a specific scenario: A 7th level Fighter (Garen) intervenes during or immediately after a raid on a farmstead by 3 Orcs and 1 Ogre who have captured the inhabitants. The loop includes: Video Introduction -> LLM-driven Text Encounter (Combat Focus) -> Video Conclusion (Win/Loss). It utilizes Javascript, Tailwind CSS for styling, and integrates with an LLM (OpenAI/Groq) as the Game Master (GM), loosely based on D&D 3.0 rules. Three.js is included in the tech stack, but its initial role will be minimal (e.g., potentially setting up a basic scene or placeholder, not core gameplay mechanics for this MVP).

## 2. Goals

*   Develop a functional web application demonstrating the core gameplay loop with the defined Farmstead Raid encounter.
*   Successfully integrate an LLM (OpenAI or Groq) to act as a responsive GM for this single combat encounter.
*   Implement a basic text-based chat interface for player interaction with the LLM GM.
*   Display dynamic player (Garen) and foe (Orcs, Ogre) status information during the encounter.
*   Implement simplified D&D 3.0-based combat mechanics (Attack Rolls vs. AC, Damage) using the defined character/foe stats.
*   Establish foundational JSON structures for the specific player character, foes, and LLM instructions.
*   Validate the technical feasibility of the core concept within a short timeframe (< 1 day development target).

## 3. Target Audience

*   **Primary (MVP):** Internal Development Team (for testing and validation).
*   **Secondary (Future):** Single players interested in text-based RPGs and interactive stories.

## 4. Key Features (Functional Requirements)

*   **F1: Video Playback Module**
    *   **F1.1:** Display and play a specified `.mp4` video file upon game start (Introduction Video depicting the farmstead raid aftermath/discovery).
    *   **F1.2:** Automatically stop the Introduction Video upon completion.
    *   **F1.3:** Display and play a specified `.mp4` video file upon encounter conclusion (Win Video - e.g., Garen surveying the scene; Loss Video - e.g., Garen overwhelmed).
*   **F2: Chat Interface Module**
    *   **F2.1:** Display text output from the LLM GM in a ticker-tape style (text appears sequentially).
    *   **F2.2:** Provide a simple text input field for the player to type commands (e.g., "attack Grok", "attack Ogre", focus on `attack [target_id]`).
    *   **F2.3:** Submit player input to the Game Logic Engine upon pressing Enter or clicking a Submit button.
    *   **F2.4:** Clear the input field after submission.
    *   **F2.5:** Scroll automatically to show the latest messages.
*   **F3: LLM Game Master Integration**
    *   **F3.1:** Service to communicate with the chosen LLM API (OpenAI or Groq). Configuration for API key required.
    *   **F3.2:** Construct prompts for the LLM based on game state, player actions, Garen's data, Orc/Ogre data, and predefined LLM Instructions (See Section 6.4). The prompt must clearly list the available targets by ID/Name.
    *   **F3.3:** Parse LLM responses to extract narrative text, NPC actions (Orcs/Ogre attacking Garen), and potential game state changes.
    *   **F3.4:** The LLM will narrate the scene (burning farmstead, captives, foe positions), describe foe actions, respond to player actions, and determine outcomes based on simplified rules provided in the prompt.
*   **F4: Encounter Logic Engine**
    *   **F4.1:** Manage the state of the encounter (e.g., `PRE_ENCOUNTER`, `PLAYER_TURN`, `GM_TURN`, `POST_ENCOUNTER_WIN`, `POST_ENCOUNTER_LOSS`).
    *   **F4.2:** Initiate the encounter after the intro video stops, triggering the first GM message setting the scene.
    *   **F4.3:** Process player commands (primarily 'attack [target_id]'). Validate target ID exists and is not defeated.
    *   **F4.4:** Implement simplified D&D 3.0 combat using data from JSON:
        *   Player Attack: Roll d20 + Garen's `attackBonus` vs. Target Foe's `ac`. If hit, roll Garen's `damage` dice.
        *   GM (Foe) Attack: LLM determines foe action (likely 'attack Garen'). If attacking, the logic engine rolls d20 + Foe's `attackBonus` vs. Garen's `ac`. If hit, roll Foe's `damage` dice. (Simple turn order: Player -> Orc1 -> Orc2 -> Orc3 -> Ogre -> Player...)
    *   **F4.5:** Update PC and Foe HP based on damage dealt. Handle negative HP (set to 0).
    *   **F4.6:** Update Foe `condition` based on HP percentage using `conditionMapping.json` (See Section 6.3). Update `isDefeated` flag when HP reaches 0.
    *   **F4.7:** Determine encounter end conditions: Garen's HP <= 0 -> Loss; All Foes (`isDefeated === true`) -> Win.
    *   **F4.8:** Trigger the appropriate Win/Loss video (F1.3) upon encounter end.
*   **F5: Status Display Module**
    *   **F5.1:** Display Player Character (Garen) stats: Current HP, Max HP, AC. These values must update dynamically.
    *   **F5.2:** Display Foe stats for each *active* (not defeated) foe: Name, Type, AC, Condition (Text/Emoji representation). Foe condition updates dynamically. Defeated foes may be hidden or marked clearly.
*   **F6: Dice Rolling Utility**
    *   **F6.1:** Provide functions to simulate rolling standard D&D dice (d4, d6, d8, d10, d12, d20) and parse dice strings (e.g., "1d8+3").
    *   **F6.2:** When a roll is triggered, display a brief text-based animation in the chat log (e.g., "Garen attacks Grok (Rolls d20)... 🎲✨").
    *   **F6.3:** Display the numerical result clearly in the chat log (e.g., "...Result: 18! Hit!"). Include damage rolls similarly.

## 5. User Interface (UI) / User Experience (UX)

*   **Layout:**
    *   **Top:** Video player.
    *   **Middle:** Ticker-tape chat interface.
    *   **Right:** Status pane displaying Garen's stats and the condition/AC of the 3 Orcs and 1 Ogre.
*   **Styling:** Use Tailwind CSS for clean, functional styling.
*   **Interaction Flow:**
    1.  App loads, Intro video plays.
    2.  Video finishes. Chat interface activates. GM describes the scene (farmstead, foes, captives).
    3.  Player types command (e.g., "attack orc1") and submits.
    4.  Dice roll animation/result appears for attack.
    5.  If hit, damage roll animation/result appears. Foe condition updates in status pane.
    6.  GM response (narrative, foe actions, results) appears in chat. Orcs/Ogre take turns attacking Garen.
    7.  Status pane updates (Garen's HP, Foe Conditions).
    8.  Turns cycle until end condition met.
    9.  Encounter ends (Win/Loss). Outro video plays.

## 6. Data Structures (JSON)

*   **6.1: Player Character (`playerCharacter.json`)**
    ```json
    {
      "name": "Garen",
      "level": 7,
      "class": "Fighter",
      "hp": 60,
      "maxHp": 60,
      "ac": 19,
      "armor": {
         "name": "Full Plate",
         "acBonus": 8
       },
      "favoredWeapon": {
        "name": "Longsword",
        "attackBonus": "+10", // BAB + Str + Other (Magic assumed 0 for MVP)
        "damage": "1d8+3"  // 1d8 + Str Bonus
      },
      "description_for_llm": "Garen is a seasoned human fighter of 7th level, heavily armored in full plate mail and wielding a trusty longsword. He looks determined and dangerous, ready to face the raiders."
    }
    ```
*   **6.2: Foes (`foes.json`)** - Array for the specific encounter.
    ```json
    [
      {
        "id": "orc1",
        "name": "Grok",
        "type": "Orc",
        "level": 1,
        "hp": 6,
        "maxHp": 6,
        "ac": 15,
         "armor": {
            "name": "Scale Mail",
            "acBonus": 4
         },
        "condition": "Unharmed ✨",
        "favoredWeapon": {
          "name": "Longsword",
          "attackBonus": "+4", // BAB + Str
          "damage": "1d8+3" // 1d8 + Str Bonus
        },
        "description_for_llm": "A brutish orc in scale mail, snarling and hefting a longsword.",
        "isDefeated": false
      },
      {
        "id": "orc2",
        "name": "Thrag",
        "type": "Orc",
        "level": 1,
        "hp": 6,
        "maxHp": 6,
        "ac": 15,
        "armor": {
            "name": "Scale Mail",
            "acBonus": 4
         },
        "condition": "Unharmed ✨",
        "favoredWeapon": {
          "name": "Longsword",
          "attackBonus": "+4",
          "damage": "1d8+3"
        },
        "description_for_llm": "Another savage orc, hefting a longsword and eyeing the fighter with malice.",
        "isDefeated": false
      },
       {
        "id": "orc3",
        "name": "Zarg",
        "type": "Orc",
        "level": 1,
        "hp": 6,
        "maxHp": 6,
        "ac": 15,
        "armor": {
            "name": "Scale Mail",
            "acBonus": 4
         },
        "condition": "Unharmed ✨",
        "favoredWeapon": {
          "name": "Longsword",
          "attackBonus": "+4",
          "damage": "1d8+3"
        },
        "description_for_llm": "This orc seems particularly eager for a fight, gripping its longsword tightly.",
        "isDefeated": false
      },
      {
        "id": "ogre1",
        "name": "Krug",
        "type": "Ogre",
        "level": 4, // Estimated HD equivalent
        "hp": 30,
        "maxHp": 30,
        "ac": 12, // Natural Armor + Dex penalty
         "armor": {
            "name": "Thick Hide", // Natural Armor represented here
            "acBonus": 3 // Effective bonus (10 + 3 Natural - 1 Dex = 12)
         },
        "condition": "Unharmed ✨",
        "favoredWeapon": {
           "name": "Greatclub",
           "attackBonus": "+8", // BAB + Str
           "damage": "2d8+5" // 2d8 + Str Bonus
         },
        "description_for_llm": "A hulking ogre, easily twice the height of a man, wearing crude hides and swinging a massive greatclub. It bellows orders at the orcs.",
        "isDefeated": false
      }
    ]
    ```
*   **6.3: Foe Condition Mapping (`conditionMapping.json`)** - (Unchanged from previous version)
    ```json
    {
      "100":    "Unharmed ✨",
      "75-99":  "Slightly Hurt 🙂",
      "25-74":  "Badly Hurt 🤕",
      "1-24":   "Near Death 🩸",
      "0":      "Defeated 💀"
    }
    ```
*   **6.4: LLM Instructions (`llmInstructions.json`)** - Tailored slightly for the scenario.
    ```json
    {
      "system_prompt": "You are the Game Master (GM) for a fantasy adventure game based on Dungeons & Dragons 3.0 rules. You are running a single combat encounter where the player character, Garen (a 7th level Fighter), confronts 3 Orcs (Grok, Thrag, Zarg) and 1 Ogre (Krug) who have raided a farmstead and taken captives (a farmer, wife, daughter - mention them briefly initially but they are non-combatants). Narrate the scene (burning farmstead backdrop), describe NPC/monster actions vividly (they will attack Garen), respond to Garen's actions (provide target IDs: orc1, orc2, orc3, ogre1), and determine combat outcomes based on the simplified rules provided. Keep responses concise and focused on the current action. Player input will be simple commands like 'attack [target_id]'.",
      "rules_summary": "Combat Rules: Player turn, then foes turn (Orc1, Orc2, Orc3, Ogre1 order). Attack: d20 + bonus vs AC. If roll >= AC, it hits. Damage: Roll damage dice + bonus. Player HP is tracked exactly. Foe HP is tracked, but only their general condition (Unharmed, Slightly Hurt, Badly Hurt, Near Death, Defeated) is revealed to the player via the UI (you don't need to state it explicitly unless describing an obvious injury). Foes are defeated at 0 HP. Focus foe actions on attacking Garen.",
      "encounter_goal_player": "Defeat Grok, Thrag, Zarg, and Krug.",
      "encounter_goal_foes": "Defeat Garen."
      // Note: Current player/foe data and encounter context will be dynamically added to the prompt at runtime.
    }
    ```

## 7. Technical Specifications

*   **Frontend:** Javascript (ES6+), HTML5, Tailwind CSS
*   **3D Engine:** Three.js (Minimal initial use - placeholder canvas/scene setup).
*   **LLM API:** OpenAI API or Groq API (To be configured).
*   **State Management:** In-memory Javascript objects/variables. Simple state management pattern.
*   **Hosting:** Static web hosting.
*   **Build Tools:** Optional (e.g., Vite).

## 8. Non-Functional Requirements

*   **Simplicity (KISS):** Implement only essential features for this specific encounter.
*   **Maintainability (SOLID):** Structure code with clear separation (UI, Game Logic, API Service).
*   **Testability (TDD):** Aim for testable units (Dice Roller, Combat Logic). Write unit tests if feasible within the timeframe.
*   **Performance:** Handle LLM calls asynchronously. Basic web performance.
*   **Scalability:** Design with future potential in mind (data persistence hooks, etc.), but don't implement now.

## 9. Future Considerations (Out of Scope for MVP 1.0)

*   Saving/Loading game state.
*   Advanced D&D rules (Skills, Saves, Spells, Movement).
*   Inventory, Loot.
*   Multiple linked encounters, narrative branching.
*   Natural Language Input.
*   Meaningful Three.js visualization.
*   Audio.
*   Multiplayer.
*   NPC interaction beyond combat (e.g., freeing captives).

## 10. Success Metrics (MVP)

*   Application runs, plays intro video for Farmstead Raid.
*   LLM GM sets the scene correctly (farmstead, Garen, Orcs, Ogre, captives mentioned).
*   Player can target and attack Orcs/Ogre by ID; commands are processed.
*   Dice rolls (d20, damage) function and display correctly per JSON stats.
*   Combat mechanics update Garen's HP and Foe conditions accurately.
*   Status pane reflects the state of Garen, Grok, Thrag, Zarg, and Krug.
*   Encounter concludes when Garen wins (all foes defeated) or loses (HP <= 0).
*   Correct Win/Loss video plays.
*   Code structure shows good separation of concerns.
*   Development completed within ~1 day target.
