

// ----- FILE SEPARATOR: scripts.js -----

// ...existing code...

const shopSystem = {
    battleCount: 0,
    inventory: [],

    shouldShowShop() {
        return this.battleCount % 3 === 0;
    },

    generateShopInventory() {
        const shopItems = [];
        const allEquipment = [
            ...gameData.equipment.weapons,
            ...gameData.equipment.armor,
            ...gameData.equipment.accessories
        ];
        for (let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({ ...item, price: item.value });
        }
        shopItems.push({
            id: 'potion',
            name: 'Health Potion',
            type: 'consumable',
            heal: 30,
            price: 50
        });
        shopItems.push({
            id: 'scroll',
            name: 'SG Scroll',
            type: 'consumable',
            sg: 25,
            price: 75
        });

        this.inventory = shopItems;
    },

    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');

        if (!shopItems || !shopGold) return;

        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';

        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <h4>${item.name}</h4>
                <p>Price: ${item.price} Yaga</p>
            `;
            itemElement.addEventListener('click', () => this.buyItem(item.id));
            shopItems.appendChild(itemElement);
        });
    },

    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;

        gameState.gold -= item.price;
        const boughtItem = { ...item };
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();
        addLogEntry(`Purchased ${item.name}`, 'special');
    },

    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
};

// Removed duplicate terrains object

const terrains = {
    "Forest": {
        name: "Dryad Forest",
        description: "A dense, magical forest that's being invaded by a misty dragon",
        effects: {
            "Nature": "SG +5 when healing",
            "Fire": "SG -3 per attack",
            "Dragon": "SG +2 when using abilities",
            "Mist": "SG +3 when attacking from stealth"
        },
        sprite: "&#127787;&#65039;"
    },
    "Volcano": {
        name: "Warped Peak",
        description: "The summit of Yadallo Mountain, twisted by chaotic flames",
        effects: {
            "Fire": "SG +7 when attacking",
            "Water": "SG -5 when using abilities",
            "Ice": "SG +10 on freeze attempts",
            "Blast": "SG +5 on area attacks"
        },
        sprite: "&#127956;&#65039;"
    },
    "Stormy Coast": {
        name: "Kraken Port Shores",
        description: "A clamoring shoreline with chilling waves",
        effects: {
            "Water": "SG +10 when hitting multiple targets",
            "Thunder": "SG +5 on stuns",
            "Sound": "SG +3 per active debuff",
            "Heal": "SG +4 when healing"
        },
        sprite: "&#127754;"
    },
    "Ruins": {
        name: "Forgotten Ruins",
        description: "An ancient temple of cosmic origin",
        effects: {
            "Dark": "SG +8 on critical hits",
            "Blade": "SG +5 when countering",
            "Stealth": "SG +10 on first attack",
            "Precision": "SG +3 per hit"
        },
        sprite: "&#127963;&#65039;"
    },
    "Mountain Peak": {
        name: "Lush Cliffs",
        description: "A windswept high altitude battlefield",
        effects: {
            "Ice": "SG +6 when slowing enemies",
            "Sound": "SG +4 when debuffing",
            "Nature": "SG -2 per turn",
            "Fire": "SG +2 per active buff"
        },
        sprite: "&#9968;&#65039;"
    }
};


// Utility Functions
function showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = message;
    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight}px`;

    element.addEventListener('mouseleave', () => {
        tooltip.remove();
    }, { once: true });
}

function isOccupied(row, col) {
    return gameState.gridUnits.some(unit => unit.row === row && unit.col === col);
}

function playSound(audioElement) {
    if (!audioElement) {
        console.error('Audio element is not provided.');
        return;
    }
    try {
        audioElement.currentTime = 0;
        audioElement.play();
    } catch (error) {
        console.error('Error playing sound:', error);
    }
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Game Logic Functions
function handleGridClick(row, col) {
    if (!gameState.selectedUnit || gameState.battleEnded) return;

    const unitId = gameState.selectedUnit.id;
    const unitPos = gameState.gridUnits[unitId];
    if (!unitPos) return;

    // Handle movement mode
    if (gameState.movementMode) {
        if (isValidMove(unitPos.row, unitPos.col, row, col, gameState.selectedUnit.movement)) {
            gameState.gridUnits[unitId] = {
                row: row,
                col: col,
                unit: gameState.selectedUnit
            };
            addLogEntry(`${gameState.selectedUnit.name} moved to (${row}, ${col})`, 'player');
            gameState.movementMode = false;
            renderBattleGrid();
        }
        return;
    }

    // Handle ability usage
    if (gameState.selectedAbility) {
        const rowDiff = Math.abs(row - unitPos.row);
        const colDiff = Math.abs(col - unitPos.col);
        const distance = Math.max(rowDiff, colDiff);

        if (distance <= (gameState.selectedAbility.range || 1)) {
            if (gameState.selectedAbility.aoe) {
                gameState.targets = getUnitsInRadius(row, col, 1);
            } else {
                const targetId = Object.keys(gameState.gridUnits).find((id) => {
                    const pos = gameState.gridUnits[id];
                    return pos.row === row && pos.col === col && pos.unit.current_hp > 0;
                });
                if (targetId) {
                    gameState.targets = [gameState.gridUnits[targetId].unit];
                }
            }

            if (gameState.targets.length > 0) {
                const isEnemyTeam = gameState.enemyTeam.some((u) => u.id === gameState.targets[0].id);
                if ((isEnemyTeam && !gameState.selectedAbility.heal) || (!isEnemyTeam && gameState.selectedAbility.heal)) {
                    confirmAction();
                }
            }
        }
    }
}

function confirmAction() {
    if (!gameState.selectedUnit || !gameState.selectedAbility ||
        gameState.targets.length === 0 || gameState.battleEnded) return;

    const ability = gameState.selectedAbility;
    const sourceUnit = gameState.selectedUnit;
    const abilityKey = `${sourceUnit.id}-${ability.name}`;
    const terrainBonus = calculateTerrainEffects(sourceUnit, ability);

    // Initialize ability use count if not exists
    if (!gameState.gameStats.abilityUseCount[abilityKey]) {
        gameState.gameStats.abilityUseCount[abilityKey] = 0;
    }
    
    gameState.gameStats.abilityUseCount[abilityKey]++;
    const effectiveness = Math.max(0.5, 1 - (gameState.gameStats.abilityUseCount[abilityKey] * 0.1));

    gameState.targets.forEach(target => {
        if (!target) return;
        
        if (ability.heal) {
            const healAmount = Math.round((ability.power || 0) * effectiveness);
            target.current_hp = Math.min(target.max_hp, target.current_hp + healAmount);
            addLogEntry(`${sourceUnit.name} heals ${target.name} for ${healAmount} HP!`, 'heal');
            playSound(elements.audio.healSound);

            const baseSG = ability.sg_gain || 0;
            const actualSG = Math.max(5, Math.round((baseSG + terrainBonus) * effectiveness));
            sourceUnit.sg = Math.min(100, sourceUnit.sg + actualSG);
            if (effectiveness < 0.8) {
                addLogEntry(`(Healing effectiveness reduced to ${Math.round(effectiveness * 100)}%)`, 'special');
            }
        } else {
            const damage = Math.round((ability.power || 0) * effectiveness);
            target.current_hp = Math.max(0, target.current_hp - damage);
            addLogEntry(`${sourceUnit.name} hits ${target.name} with ${ability.name} for ${damage} damage!`, 'damage');
            playSound(elements.audio.attackSound);

            const baseSG = ability.sg_gain || 0;
            const actualSG = Math.max(3, Math.round((baseSG + terrainBonus) * effectiveness));
            sourceUnit.sg = Math.min(100, sourceUnit.sg + actualSG);
            target.sg = Math.min(100, target.sg + Math.round(damage / 2));
            if (effectiveness < 0.8) {
                addLogEntry(`(Attack effectiveness reduced to ${Math.round(effectiveness * 100)}%)`, 'special');
            }
        }
    });

    if (ability.sg_cost) {
        sourceUnit.sg = 0;
        playSound(elements.audio.comboSound);
        addLogEntry(`${sourceUnit.name} unleashes a powerful combo!`, 'special');
        gameState.gameStats.combosUsed++;
    }

    gameState.selectedUnit = null;
    gameState.selectedAbility = null;
    gameState.targets = [];

    if (!checkBattleEnd()) {
        nextUnit();
    }
    renderBattleGrid();
}

function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

function endBattleAsDraw() {
    gameState.battleEnded = true;
    addLogEntry("Battle ended in a draw!", 'special');
    elements.displays.resultTitle.textContent = "Draw!";
    elements.displays.resultDetails.innerHTML = `
<p>All units were defeated!</p>
<p>No rewards were earned.</p>
`;
showSection('battle-results');
}

function showBattleResults(playerWon) {
    if (!elements.displays.resultTitle || !elements.displays.resultDetails) return;
    
    gameState.battleEnded = true;
    elements.displays.resultTitle.textContent = playerWon ? "Victory!" : "Defeat!";
    
    if (playerWon) {
        const xp = calculateXPRewards();
        const gold = Math.floor(Math.random() * 100) + 50;
        gameState.gold += gold;
        
        elements.displays.resultDetails.innerHTML = `
            <p>Victory! You defeated all enemy units!</p>
            <p>Rewards:</p>
            <ul>
                <li>XP Gained: ${xp}</li>
                <li>Gold Earned: ${gold}</li>
            </ul>
        `;
        
        shopSystem.battleCount++;
        if (shopSystem.shouldShowShop()) {
            setTimeout(() => shopSystem.show(), 1500);
        } else {
            setTimeout(() => pauseSystem.show(), 1500);
        }
    } else {
        elements.displays.resultDetails.innerHTML = `
            <p>Your team was defeated.</p>
            <p>Better luck next time!</p>
        `;
    }
    
    showSection('battle-results');
}

// Rendering Functions
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

function renderEquipmentScreen() {
    elements.displays.equipmentTeam.innerHTML = '';
    elements.displays.inventoryDisplay.innerHTML = '';
    elements.displays.goldAmount.textContent = gameState.gold;

    gameState.playerTeam.forEach((unit, index) => {
        const unitElement = document.createElement('div');
        unitElement.className = 'unit-card';
        unitElement.innerHTML = `
            <h4>${unit.name}</h4>
            <div class="equipment-slots">
                <div class="equipment-slot" data-unit="${index}" data-slot="weapon">
                    <h5>Weapon</h5>
                    <div class="equipment-item">${unit.equipment?.weapon?.name || 'Empty'}</div>
                </div>
                <div class="equipment-slot" data-unit="${index}" data-slot="armor">
                    <h5>Armor</h5>
                    <div class="equipment-item">${unit.equipment?.armor?.name || 'Empty'}</div>
                </div>
                <div class="equipment-slot" data-unit="${index}" data-slot="accessory">
                    <h5>Accessory</h5>
                    <div class="equipment-item">${unit.equipment?.accessory?.name || 'Empty'}</div>
                </div>
            </div>
        `;
        elements.displays.equipmentTeam.appendChild(unitElement);
    });

    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.addEventListener('click', handleEquipmentSlotClick);
    });

    gameState.inventory.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.index = index;
        itemElement.textContent = item.name;
        itemElement.addEventListener('click', handleInventoryItemClick);
        elements.displays.inventoryDisplay.appendChild(itemElement);
    });
}

// Shop System
const unitshopSystem = {
    battleCount: 0,
    inventory: [],
    shouldShowShop() {
        return this.battleCount % 3 === 0;
    },
    generateShopInventory() {
        const shopUnits = [];
        const allUnits = Object.values(gameData.factions)
            .flat()
            .filter(unit => !gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id));

        for (let i = 0; i < 5; i++) {
            const unit = allUnits[Math.floor(Math.random() * allUnits.length)];
            shopUnits.push({ ...unit, healthCost: Math.floor(unit.max_hp * 0.2) });
        }

        this.inventory = shopUnits;
    },
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        if (!shopItems || !shopGold) return;

        shopGold.textContent = `Current HP: ${gameState.playerTeam.reduce((sum, unit) => sum + unit.current_hp, 0)}`;
        shopItems.innerHTML = '';

        this.inventory.forEach(unit => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${unit.name} ${unit.sprite}</h4>
                    <p>Role: ${unit.role}</p>
                    <p>HP: ${unit.max_hp}</p>
                    <p>Health Cost: ${unit.healthCost}</p>
                </div>
                <div>
                    <button class="buy-btn" data-id="${unit.id}" ${this.getTotalTeamHealth() < unit.healthCost ? 'disabled' : ''}>
                        Recruit
                    </button>
                </div>
            `;

            const buyBtn = itemElement.querySelector('.buy-btn');
            buyBtn.addEventListener('click', () => this.buyUnit(unit.id));

            shopItems.appendChild(itemElement);
        });
    },
    buyUnit(unitId) {
        const unit = this.inventory.find(u => u.id === unitId);
        if (!unit || this.getTotalTeamHealth() < unit.healthCost) return;

        let remainingCost = unit.healthCost;
        for (const teamUnit of gameState.playerTeam) {
            if (remainingCost <= 0) break;
            const deduction = Math.min(teamUnit.current_hp, remainingCost);
            teamUnit.current_hp -= deduction;
            remainingCost -= deduction;
        }

        const recruitedUnit = { ...unit };
        delete recruitedUnit.healthCost;
        gameState.playerTeam.push(recruitedUnit);
        this.inventory = this.inventory.filter(u => u.id !== unitId);
        this.renderShop();

        addLogEntry(`Recruited ${unit.name} for ${unit.healthCost} HP`, 'special');
    },
    getTotalTeamHealth() {
        return gameState.playerTeam.reduce((sum, unit) => sum + unit.current_hp, 0);
    },
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
}; // Add this closing brace to properly end the unitshopSystem object

// Game State Management
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Event Handlers
function initializeButtonHandlers() {
    const endTurnButton = document.getElementById('end-turn-btn');
    if (endTurnButton) {
        endTurnButton.addEventListener('click', endTurn);
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }

    const leaveShopButton = document.getElementById('leave-shop-btn');
    if (leaveShopButton) {
        leaveShopButton.addEventListener('click', () => {
            showSection('terrain-select');
        });
    }
}

function handleSoundToggle() {
    gameState.soundEnabled = !gameState.soundEnabled;
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.textContent = `Sound: ${gameState.soundEnabled ? 'ON' : 'OFF'}`;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
});

// Core Game Flow
function initGame() {
    console.log("Initializing game...");
    try {
        initializeBattle();
        gameState.currentUnitIndex = 0;
        gameState.selectedUnit = gameState.playerTeam[0];
        renderBattleGrid();
        updateTurnIndicator();
        addLogEntry('Battle Started!', 'special');
    } catch (error) {
        console.error("Error during game initialization:", error);
    }
}

function endTurn() {
    gameState.currentTurn++;
    updateTurnIndicator();
    nextUnit();
}

function preloadAudio() {
    const audioElements = [
        elements.audio.bgMusic,
        elements.audio.attackSound,
        elements.audio.comboSound,
        elements.audio.healSound,
        elements.audio.victorySound,
        elements.audio.defeatSound,
        elements.audio.moveSound
    ];

    audioElements.forEach(audio => {
        audio.load();
        audio.volume = 0;
    });

    setTimeout(() => {
        elements.audio.bgMusic.volume = 0.3;
        elements.audio.attackSound.volume = 0.6;
        elements.audio.comboSound.volume = 0.6;
        elements.audio.healSound.volume = 0.6;
        elements.audio.victorySound.volume = 0.6;
        elements.audio.defeatSound.volume = 0.6;
        elements.audio.moveSound.volume = 0.6;
    }, 1000);
}

function addLogEntry(message, type) {
    const battleLog = document.getElementById('battle-log');
    if (battleLog) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        battleLog.appendChild(logEntry);
        battleLog.scrollTop = battleLog.scrollHeight;
    }
}

function calculateXPRewards() {
    const xpGained = gameState.enemyTeam.reduce((total, enemy) => {
        return total + (enemy.isBoss ? 100 : 50);
    }, 0);
    gameState.xp += xpGained;
    return xpGained;
}

function getUnitsInRadius(row, col, radius) {
    const unitsInRadius = [];
    Object.keys(gameState.gridUnits).forEach(unitId => {
        const unitPos = gameState.gridUnits[unitId];
        const rowDiff = Math.abs(unitPos.row - row);
        const colDiff = Math.abs(unitPos.col - col);
        if (Math.max(rowDiff, colDiff) <= radius) {
            unitsInRadius.push(gameState.gridUnits[unitId].unit);
        }
    });
    return unitsInRadius;
}

function calculateTerrainEffects(unit, ability) {
    if (!unit || !unit.types || !gameState.terrain || !gameState.terrain.effects) {
        return 0;
    }

    let bonus = 0;
    const effects = gameState.terrain.effects;
    unit.types.forEach(type => {
        if (type && effects[type]) {
            const match = effects[type].match(/SG ([+-]\d+)/);
            if (match && match[1]) {
                bonus += parseInt(match[1], 10);
            }
        }
    });
    return bonus;
}

const gameData = {
    factions: {
        "Fog Leaf": [{
                id: "CG01",
                name: "Castle Guard",
                max_hp: 210,
                current_hp: 210,
                types: ["Power", "Blade"],
                role: "Tank",
                basic_abilities: {
                    "Shield Strike": {
                        power: 15,
                        sg_gain: 10,
                        range: 1
                    }
                    "Counter": {
                        power: 10,
                        sg_gain: 15,
                        range: 1
                    }
                }
                combo_abilities: {
                    "Astral Crash": {
                        requirements: ["Shield Strike", "Counter"],
                        power: 40,
                        sg_cost: 100,
                        range: 1
                    }
                }
                sg: 0,
                sg_rate: 1.2,
                movement: 2,
                notes: "Got lost in the forest on the way back to the castle",
                sprite: "&#129338;"
            }
            {
                id: "MM02",
                name: "Mist Moth",
                max_hp: 150,
                current_hp: 150,
                types: ["Nature", "Mist"],
                role: "Evasion",
                basic_abilities: {
                    "Mist Veil": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                    "Wing Strike": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Powder Fog": {
                        requirements: ["Mist Veil", "Wing Strike"],
                        power: 45,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 3,
                notes: "Highly Territorial Species of Moth",
                sprite: "&#129419;"
            },
            {
                id: "DR03",
                name: "Dryad",
                max_hp: 160,
                current_hp: 160,
                types: ["Nature", "Spirit"],
                role: "Support",
                basic_abilities: {
                    "Heal": {
                        power: 20,
                        sg_gain: 5,
                        heal: true,
                        range: 2
                    },
                    "Spirit Thorn": {
                        power: 12,
                        sg_gain: 8,
                        range: 2
                    }
                },
                combo_abilities: {
                    "Spectral Overgrowth": {
                        requirements: ["Heal", "Spirit Thorn"],
                        power: 30,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 0.8,
                movement: 2,
                notes: "Forest Resident who's afraid of the fog",
                sprite: "&#127795;"
            },
            {
                id: "BM05",
                name: "Blade Merc",
                max_hp: 180,
                current_hp: 180,
                types: ["Blade", "Power"],
                role: "Burst DPS",
                basic_abilities: {
                    "Lucky Cut": {
                        power: 25,
                        sg_gain: 20,
                        range: 1
                    },
                    "Sleepy Slash": {
                        power: 8,
                        sg_gain: 15,
                        counter: true,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Slumber Frenzy": {
                        requirements: ["Lucky Cut", "Sleepy Slash"],
                        power: 60,
                        sg_cost: 100,
                        multi: 3,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.4,
                movement: 2,
                notes: "Was sent to investigate the fog, but fell asleep ",
                sprite: "&#9876;&#65039;"
            },
            {
                id: "FS07",
                name: "Forest Slime",
                max_hp: 170,
                current_hp: 170,
                types: ["Nature", "Debuff"],
                role: "Debuffer",
                basic_abilities: {
                    "Toxic Ooze": {
                        power: 10,
                        sg_gain: 15,
                        debuff: true,
                        range: 1
                    },
                    "Root Crash": {
                        power: 15,
                        sg_gain: 10,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Corrosive Vines": {
                        requirements: ["Toxic Ooze", "Root Crash"],
                        power: 40,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 0.8,
                movement: 1,
                notes: "Has a symbiotic relationship with a special root in order to keep their form ",
                sprite: "&#128994;"
            },
            {
                id: "SW09",
                name: "Slash Weed",
                max_hp: 220,
                current_hp: 220,
                types: ["Nature", "Blade"],
                role: "Boss (DPS)",
                basic_abilities: {
                    "Razor Leaf": {
                        power: 30,
                        sg_gain: 20,
                        range: 2
                    },
                    "Root Slam": {
                        power: 25,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Overgrowth Frenzy": {
                        requirements: ["Razor Leaf", "Root Slam"],
                        power: 70,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 1,
                isBoss: true,
                notes: "The Forest guardian, now in a fog-induced frenzy",
                sprite: "&#127793;"
            },
            {
                id: "FW10",
                name: "Fog Wyrm",
                max_hp: 250,
                current_hp: 250,
                types: ["Mist", "Dragon"],
                role: "Boss (AOE)",
                basic_abilities: {
                    "Fog Breath": {
                        power: 20,
                        sg_gain: 15,
                        aoe: true,
                        range: 2
                    },
                    "Shadow Claw": {
                        power: 30,
                        sg_gain: 10,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Abyssal Wrath": {
                        requirements: ["Fog Breath", "Drake Claw"],
                        power: 80,
                        sg_cost: 100,
                        aoe: true,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.1,
                movement: 2,
                isBoss: true,
                notes: "An old fog dragon who got bored and took over the forest",
                sprite: "&#128009;"
            }
            ]
        },
        "Summit Flame": [

            {
                id: "KF80",
                name: "Kraken",
                max_hp: 100,
                current_hp: 100,
                types: ["Water", "Burst"],
                role: "Burst DPS",
                basic_abilities: {
                    "Suction Cut": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Water Film": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tentacle Whips": {
                        requirements: ["Suction Cut", "Water Film"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Young kraken found in Yadallo's icey cave ponds",
                sprite: "&#129425;"
            },
            {
                id: "CG11",
                name: "Cryogeist",
                max_hp: 170,
                current_hp: 170,
                types: ["Ice", "Burst"],
                role: "DPS",
                basic_abilities: {
                    "Dark Lash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Icy  Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Cruel Winds": {
                        requirements: ["Dark Lash", "Icy Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Spirits of those who had died on Yadallo",
                sprite: "&#10052;"
            },
            {
                id: "FG43",
                name: "Model F Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Ice", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Cryo Release": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Ice Wall": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Blizzard Slam": {
                        requirements: ["Cryo Release", "Ice Wall"],
                        power: 50,
                        sg_cost: 100,
                        aoe: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help mercenaries trek to the summit the mountain and help in medics",
                sprite: "&#129482;"
            },
            {
                id: "BG03",
                name: "Model B Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Fire", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Heat Dispel": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Slash", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help surivivors get off the mountain and guard medics",
                sprite: "&#128293;"
            },
            {
                id: "SH04",
                name: "Summit Medic",
                max_hp: 150,
                current_hp: 150,
                types: ["Fire", "Heal"],
                role: "Healer",
                basic_abilities: {
                    "Heal": {
                        power: 25,
                        sg_gain: 10,
                        heal: true,
                        range: 2
                    },
                    "Sparker": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Healing Hearth": {
                        requirements: ["Heal", "Sparker"],
                        power: 35,
                        sg_cost: 100,
                        heal: true,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 0.9,
                movement: 2,
                notes: "Stuck on the mountain due to the golems acting out",
                sprite: "&#10084;&#65039;"
            },
            {
                id: "FS06",
                name: "Fire Soldier",
                max_hp: 180,
                current_hp: 180,
                types: ["Fire", "Power"],
                role: "Bruiser",
                basic_abilities: {
                    "Burn Slash": {
                        power: 22,
                        sg_gain: 20,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Strike", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 2,
                notes: "Stationed on the mountain to help protect survivors",
                sprite: "&#129686;"
            },
            {
                id: "RH07",
                name: "Red Hono",
                max_hp: 170,
                current_hp: 170,
                types: ["Fire", "Burst"],
                role: "Burst",
                basic_abilities: {
                    "Fire Flash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Light Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Crimson Rays": {
                        requirements: ["Fire Flash", "Light Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 2,
                notes: "Hardened Fire Magic trapped in a crystal",
                sprite: "&#127801;"
            },
            {
                id: "PF08",
                name: "Pyre Dreky",
                max_hp: 160,
                current_hp: 160,
                types: ["Fire", "Mobility"],
                role: "Mobile DPS",
                basic_abilities: {
                    "Dive Strike": {
                        power: 20,
                        sg_gain: 20,
                        range: 2
                    },
                    "Talon Slash": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Scale Dive": {
                        requirements: ["Dive Strike", "Talon Slash"],
                        power: 50,
                        sg_cost: 100,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 3,
                notes: "A prehistoric looking bird native to Yadallo",
                sprite: "&#129413;"
            },
            {
                id: "CC09",
                name: "Catcus",
                max_hp: 140,
                current_hp: 140,
                types: ["Nature", "Magic"],
                role: "Burst Caster",
                basic_abilities: {
                    "Cat Launch": {
                        power: 30,
                        sg_gain: 25,
                        range: 3
                    },
                    "Needle Shots": {
                        power: 15,
                        sg_gain: 15,
                        aoe: true,
                        range: 2
                    }
                },
                combo_abilities: {
                    "Pin Burst": {
                        requirements: ["Cat Launch", "Needle Shots"],
                        power: 70,
                        sg_cost: 100,
                        aoe: true,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.1,
                movement: 1,
                notes: "A potted cactus possessed by a house cat",
                sprite: "&#128570;"
            },
            {
                id: "CT01",
                name: "Chilled Titan",
                max_hp: 240,
                current_hp: 240,
                types: ["Ice", "Fire"],
                role: "Boss (Hybrid)",
                basic_abilities: {
                    "Heat Up": {
                        power: 35,
                        sg_gain: 25,
                        range: 1
                    },
                    "Flame Stoke": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Chaos Wheel": {
                        requirements: ["Heat Up", "Flame  Stoke"],
                        power: 75,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 1,
                isBoss: true,
                notes: "A Titan that has had it's fire cooled",
                sprite: "&#10052;&#65039;&#128293;"
            },
            {
                id: "CM02",
                name: "Chill Maw",
                max_hp: 260,
                current_hp: 260,
                types: ["Ice", "Execute"],
                role: "Boss (Execute)",
                basic_abilities: {
                    "Frostbite": {
                        power: 40,
                        sg_gain: 30,
                        execute: true,
                        range: 1
                    },
                    "Drake Claw": {
                        power: 0,
                        sg_gain: 25,
                        stun: true,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Absolute Zero": {
                        requirements: ["Frostbite", "Drake Claw"],
                        power: 80,
                        sg_cost: 100,
                        execute: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 1,
                isBoss: true,
                notes: "A subterranean species of ice dragons",
                sprite: "&#129482;&#128056;"
            }
            ]
        },
    "Sound Wave": [
        {
            id: "MA02",
            name: "Maullusk",
            max_hp: 250,
            current_hp: 250,
            types: ["Water", "Tank"],
            role: "HP Tank",
            basic_abilities: {
                "Shell Crunch": {
                    power: 20,
                    sg_gain: 15,
                    range: 1
                },
                "Harden": {
                    power: 0,
                    sg_gain: 25,
                    defensive: true,
                    range: 0
                }
            },
            combo_abilities: {
                "Tidal Jaw": {
                    requirements: ["Shell Crunch", "Harden"],
                    power: 45,
                    sg_cost: 100,
                    aoe: true,
                    range: 1
                }
            },
            sg: 0,
            sg_rate: 0.9,
            movement: 1,
            notes: "A cephalopod with a hard shell covering their body and jaws",
            sprite: "&#128026;"
        },
        {
            id: "NY03",
            name: "Nymph",
            max_hp: 160,
            current_hp: 160,
            types: ["Water", "Heal"],
            role: "Healer",
            basic_abilities: {
                "Heal Pool": {
                    power: 25,
                    sg_gain: 10,
                    heal: true,
                    range: 2
                },
                "Aqua Whip": {
                    power: 15,
                    sg_gain: 15,
                    range: 2
                }
            },
            combo_abilities: {
                "Wave Crash": {
                    requirements: ["Heal Pool", "Aqua Whip"],
                    power: 40,
                    sg_cost: 100,
                    aoe: true,
                    range: 2
                }
            },
            sg: 0,
            sg_rate: 0.8,
            movement: 2,
            notes: "Dryads who live by shores and seas",
            sprite: "&#127796;"
        },
        {
            id: "HE05",
            name: "Hyper Eel",
            max_hp: 170,
            current_hp: 170,
            types: ["Water", "Burst"],
            role: "Burst",
            basic_abilities: {
                "Energy Jaw": {
                    power: 30,
                    sg_gain: 25,
                    range: 2
                },
                "Static Dispel": {
                    power: 0,
                    sg_gain: 20,
                    defensive: true,
                    range: 0
                }
            },
            combo_abilities: {
                "Storm Pool": {
                    requirements: ["Energy Jaw", "Static Dispel"],
                    power: 65,
                    sg_cost: 100,
                    aoe: true,
                    range: 2
                }
            },
            sg: 0,
            sg_rate: 1.4,
            movement: 2,
            notes: "A subspecies of electric eel capable of expelling stronger bursts of electricity and capable of making energy constructs",
            sprite: "&#9889;"
        },
        {
            id: "KM06",
            name: "Koni Merc",
            max_hp: 180,
            current_hp: 180,
            types: ["Thunder", "Blade"],
            role: "Nuker",
            basic_abilities: {
                "Flash Strike": {
                    power: 28,
                    sg_gain: 25,
                    range: 1
                },
                "Riposte": {
                    power: 10,
                    sg_gain: 20,
                    counter: true,
                    range: 1
                }
            },
            combo_abilities: {
                "Blade Tempest": {
                    requirements: ["Flash Strike", "Riposte"],
                    power: 70,
                    sg_cost: 100,
                    multi: 3,
                    range: 1
                }
            },
            sg: 0,
            sg_rate: 1.3,
            movement: 2,
            notes: "A Koni who has been sent to help prevent harm to Kraken Port",
            sprite: "&#128481;&#65039;"
        },
        {
            id: "HSC07",
            name: "Starborn Construct i",
            max_hp: 150,
            current_hp: 150,
            types: ["Water", "Debuff"],
            role: "Disruptor",
            basic_abilities: {
                "Energy Surge": {
                    power: 10,
                    sg_gain: 20,
                    debuff: true,
                    range: 2
                },
                "Star Strike": {
                    power: 15,
                    sg_gain: 15,
                    range: 1
                }
            },
            combo_abilities: {
                "Star Burst": {
                    requirements: ["Energy Surge", "Star Strike"],
                    power: 45,
                    sg_cost: 100,
                    aoe: true,
                    range: 2
                }
            },
            sg: 0,
            sg_rate: 0.9,
            movement: 2,
            notes: "Strange constructs that bear resemblance to Hyper Eels",
            sprite: "&#127925;"
        },
        {
            id: "SI08",
            name: "Siren",
            max_hp: 190,
            current_hp: 190,
            types: ["Water", "Debuff"],
            role: "Crowd Control",
            basic_abilities: {
                "Luring Whisper": {
                    power: 0,
                    sg_gain: 25,
                    debuff: true,
                    range: 3
                },
                "Tide Pull": {
                    power: 20,
                    sg_gain: 20,
                    range: 1
                }
            },
            combo_abilities: {
                "Abyssal Call": {
                    requirements: ["Luring Whisper", "Tide Pull"],
                    power: 50,
                    sg_cost: 100,
                    aoe: true,
                    range: 3
                }
            },
            sg: 0,
            sg_rate: 1.1,
            movement: 1,
            notes: "Spirits who lure people near the water to drain parts of their soul",
            sprite: "&#129500;&zwj;&#9792;&#65039;"
        },
        {
            id: "CS09",
            name: "Cry of the Sea",
            max_hp: 230,
            current_hp: 230,
            types: ["Water", "Sound"],
            role: "Boss (CC)",
            basic_abilities: {
                "Wailing Song": {
                    power: 0,
                    sg_gain: 30,
                    stun: true,
                    range: 3
                },
                "Tidal Wave": {
                    power: 35,
                    sg_gain: 25,
                    aoe: true,
                    range: 2
                }
            },
            combo_abilities: {
                "Cry for Help": {
                    requirements: ["Wailing Song", "Tidal Wave"],
                    power: 75,
                    sg_cost: 100,
                    aoe: true,
                    range: 3
                }
            },
            sg: 0,
            sg_rate: 1.2,
            movement: 1,
            isBoss: true,
            notes: "An ancient warning system to alert the awakening of a great blizzard",
            sprite: "&#127754;"
        },
        {
            id: "MK10",
            name: "Mother Kraken",
            max_hp: 280,
            current_hp: 280,
            types: ["Water", "AOE"],
            role: "Boss (AOE)",
            basic_abilities: {
                "Tentacle Lash": {
                    power: 30,
                    sg_gain: 25,
                    aoe: true,
                    range: 2
                },
                "Icy Shroud": {
                    power: 0,
                    sg_gain: 30,
                    defensive: true,
                    range: 0
                }
            },
            combo_abilities: {
                "Abyssal Maw": {
                    requirements: ["Tentacle Lash", "Icy Shroud"],
                    power: 80,
                    sg_cost: 100,
                    aoe: true,
                    range: 3
                }
            },
            sg: 0,
            sg_rate: 1.1,
            movement: 1,
            isBoss: true,
            notes: "When female Kraken reach maturity, they return to their original hatching waters to lay their eggs",
            sprite: "&#128025;"
        }
    ],
    },

    terrains: {
        "Forest": {
            name: "Dryad Forest",
            description: "A dense, magical forest that's being invaded by a misty dragon",
            effects: {
                "Nature": "SG +5 when healing",
                "Fire": "SG -3 per attack",
                "Dragon": "SG +2 when using abilities",
                "Mist": "SG +3 when attacking from stealth"
            },
            sprite: "&#127787;&#65039;"
        },
        "Volcano": {
            name: "Warped Peak",
            description: "The summit of Yadallo Mountain, twisted by chaotic flames",
            effects: {
                "Fire": "SG +7 when attacking",
                "Water": "SG -5 when using abilities",
                "Ice": "SG +10 on freeze attempts",
                "Blast": "SG +5 on area attacks"
            },
            sprite: "&#127956;&#65039;"
        },
        "Stormy Coast": {
            name: "Kraken Port Shores",
            description: "A clammoring shoreline with chilling waves",
            effects: {
                "Water": "SG +10 when hitting multiple targets",
                "Thunder": "SG +5 on stuns",
                "Sound": "SG +3 per active debuff",
                "Heal": "SG +4 when healing"
            },
            sprite: "&#127754;"
        },
        "Ruins": {
            name: "Forgotten Ruins",
            description: "An ancient temple of cosmic origin",
            effects: {
                "Dark": "SG +8 on critical hits",
                "Blade": "SG +5 when countering",
                "Stealth": "SG +10 on first attack",
                "Precision": "SG +3 per hit"
            },
            sprite: "&#127963;&#65039;"
        },
        "Mountain Peak": {
            name: "Lush Cliffs",
            description: "A windswept high altitude battlefield",
            effects: {
                "Ice": "SG +6 when slowing enemies",
                "Sound": "SG +4 when debuffing",
                "Nature": "SG -2 per turn",
                "Fire": "SG +2 per active buff"
            },
            sprite: "&#9968;&#65039;"
        }
    terrains: {
        "Forest": {
            name: "Dryad Forest",
            description: "A dense, magical forest that's being invaded by a misty dragon",
            effects: {
                "Nature": "SG +5 when healing",
                "Fire": "SG -3 per attack",
                "Dragon": "SG +2 when using abilities",
                "Mist": "SG +3 when attacking from stealth"
            },
            sprite: "&#127787;&#65039;"
        },
        "Volcano": {
            name: "Warped Peak",
            description: "The summit of Yadallo Mountain, twisted by chaotic flames",
            effects: {
                "Fire": "SG +7 when attacking",
                "Water": "SG -5 when using abilities",
                "Ice": "SG +10 on freeze attempts",
                "Blast": "SG +5 on area attacks"
            },
            sprite: "&#127956;&#65039;"
        },
        "Stormy Coast": {
            name: "Kraken Port Shores",
            description: "A clamoring shoreline with chilling waves",
            effects: {
                "Water": "SG +10 when hitting multiple targets",
                "Thunder": "SG +5 on stuns",
                "Sound": "SG +3 per active debuff",
                "Heal": "SG +4 when healing"
            },
            sprite: "&#127754;"
        },
        "Ruins": {
            name: "Forgotten Ruins",
            description: "An ancient temple of cosmic origin",
            effects: {
                "Dark": "SG +8 on critical hits",
                "Blade": "SG +5 when countering",
                "Stealth": "SG +10 on first attack",
                "Precision": "SG +3 per hit"
            },
            sprite: "&#127963;&#65039;"
        },
        "Mountain Peak": {
            name: "Lush Cliffs",
            description: "A windswept high altitude battlefield",
            effects: {
                "Ice": "SG +6 when slowing enemies",
                "Sound": "SG +4 when debuffing",
                "Nature": "SG -2 per turn",
                "Fire": "SG +2 per active buff"
            },
            sprite: "&#9968;&#65039;"
        }
    },
        ],
        armor: [{
                id: "a1",
                name: "Shroom Armor",
                type: "armor",
                defense: 5,
                value: 140
            },
            {
                id: "a2",
                name: "Scale Cloak",
                type: "armor",
                defense: 10,
                value: 50
            },
            {
                id: "a3",
                name: "Ice Growths",
                type: "armor",
                defense: 4,
                magic: 8,
                value: 600
            },
            {
                id: "a4",
                name: "Burning Tattoo",
                type: "armor",
                defense: 2,
                magic: 10,
                value: 50
            },
            {
                id: "a5",
                name: "Rune Bells",
                type: "armor",
                defense: 12,
                value: 900
            },
            {
                id: "a6",
                name: "Whetstone Armor",
                type: "armor",
                defense: 10,
                magic: 8,
                value: 70
            },
            {
                id: "a7",
                name: "Spiral Shell",
                type: "armor",
                defense: 20,
                value: 999
            },
        ],
        accessories: [{
                id: "ac1",
                name: "Dragon Soul",
                type: "accessory",
                power: 10,
                value: 190
            },
            {
                id: "ac2",
                name: "Beast Hide",
                type: "accessory",
                defense: 10,
                value: 190
            },
            {
                id: "ac3",
                name: "Star Needle",
                type: "accessory",
                sg_gain: 10,
                value: 190
            },
            {
                id: "ac4",
                name: "Chaos Rune",
                type: "accessory",
                healing: 10,
                value: 190
            },
        ]
    },
    lootTable: [{
            id: "gold",
            name: "Yaga",
            type: "currency",
            min: 1,
            max: 999
        },
        {
            id: "potion",
            name: "Health Potion",
            type: "consumable",
            heal: 30
        },
        {
            id: "scroll",
            name: "Spiral Scroll",
            type: "consumable",
            sg: 25
        },
    ],
    xpRequirements: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110,115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 2000] // XP needed for each level
    };


// Game State
const gameState = {
    playerFaction: null,
    playerTeam: [],
    enemyFaction: null,
    enemyTeam: [],
    terrain: null,
    currentTurn: 0,
    currentUnitIndex: 0,
    battleLog: [],
    selectedUnit: null,
    selectedAbility: null,
    targets: [],
    soundEnabled: true,
    battleEnded: false,
    gridUnits: {}, // Tracks unit positions on grid {id: {row, col}}
    selectedCell: null,
    movementMode: false,
    playerLevel: 1,
    xp: 0,
    gold: 100,
    inventory: [],
    equippedItems: {},
    gameStats: {
        battlesWon: 0,
        enemiesDefeated: 0,
        combosUsed: 0,
        abilityUseCount: {}, // Tracks how many times each ability is used
        selectedEquipmentSlot: null
    },
    savedGames: [],
};
const elements = {
    audio: {
        bgMusic: document.getElementById('bgMusic'),
        attackSound: document.getElementById('attackSound'),
        comboSound: document.getElementById('comboSound'),
        healSound: document.getElementById('healSound'),
        victorySound: document.getElementById('victorySound'),
        defeatSound: document.getElementById('defeatSound'),
        moveSound: document.getElementById('moveSound'),
    },
    displays: {
        equipmentTeam: document.getElementById('equipment-team'),
        inventoryDisplay: document.getElementById('inventory-display'),
        goldAmount: document.getElementById('gold-amount'),
        resultTitle: document.getElementById('result-title'),
        resultDetails: document.getElementById('result-details'),
    }
};

// Helper Functions
function isValidMove(startRow, startCol, endRow, endCol, movementRange) {
    const rowDiff = Math.abs(endRow - startRow);
    const colDiff = Math.abs(endCol - startCol);
    return Math.max(rowDiff, colDiff) <= movementRange;
}

function addLogEntry(message, type) {
    // ...existing code...
}

function renderBattleGrid() {
    const grid = document.getElementById('battle-grid');
    grid.innerHTML = '';
    
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // Add click handler to each cell
            cell.addEventListener('click', () => handleGridClick(row, col));
            
            // Check if there's a unit in this cell
            const unitInCell = Object.entries(gameState.gridUnits)
                .find(([_, pos]) => pos.row === row && pos.col === col);
            
            if (unitInCell) {
                const [unitId, pos] = unitInCell;
                const unit = pos.unit;
                const unitElement = document.createElement('div');
                unitElement.className = `grid-unit ${gameState.playerTeam.includes(unit) ? 'player' : 'enemy'}`;
                if (unit.isBoss) unitElement.classList.add('boss');
                if (unit.current_hp <= 0) unitElement.classList.add('dead');
                if (gameState.selectedUnit === unit) unitElement.classList.add('active');
                
                unitElement.innerHTML = unit.sprite;
                
                // Add health and SG bars
                const healthBar = document.createElement('div');
                healthBar.className = 'unit-health';
                const healthFill = document.createElement('div');
                healthFill.className = 'unit-health-fill';
                healthFill.style.width = `${(unit.current_hp / unit.max_hp) * 100}%`;
                healthBar.appendChild(healthFill);
                
                const sgBar = document.createElement('div');
                sgBar.className = 'unit-sg';
                const sgFill = document.createElement('div');
                sgFill.className = 'unit-sg-fill';
                sgFill.style.width = `${unit.sg}%`;
                sgBar.appendChild(sgFill);
                
                unitElement.appendChild(healthBar);
                unitElement.appendChild(sgBar);
                cell.appendChild(unitElement);
            }
            
            grid.appendChild(cell);
        }
    }
    
    // Update battle interface
    const currentUnit = document.getElementById('current-unit');
    const abilityChoices = document.getElementById('ability-choices');
    const endTurnBtn = document.getElementById('end-turn-btn');
    
    if (gameState.selectedUnit) {
        currentUnit.innerHTML = `
            <h4>${gameState.selectedUnit.name}</h4>
            <p>HP: ${gameState.selectedUnit.current_hp}/${gameState.selectedUnit.max_hp}</p>
            <p>SG: ${gameState.selectedUnit.sg}%</p>
        `;
        
        // Create ability buttons
        abilityChoices.innerHTML = '';
        Object.entries(gameState.selectedUnit.basic_abilities).forEach(([name, ability]) => {
            const btn = document.createElement('button');
            btn.className = 'ability-btn';
            btn.dataset.ability = name;
            btn.textContent = name;
            abilityChoices.appendChild(btn);
        });
        
        // Add combo abilities if SG is 100%
        if (gameState.selectedUnit.sg >= 100) {
            Object.entries(gameState.selectedUnit.combo_abilities).forEach(([name, ability]) => {
                const btn = document.createElement('button');
                btn.className = 'combo-btn';
                btn.dataset.ability = name;
                btn.textContent = name;
                abilityChoices.appendChild(btn);
            });
        }
        
        // Add move button
        const moveBtn = document.createElement('button');
        moveBtn.className = 'move-btn';
        moveBtn.textContent = 'Move';
        moveBtn.onclick = handleMoveButton;
        abilityChoices.appendChild(moveBtn);
        
        endTurnBtn.style.display = 'block';
    } else {
        currentUnit.innerHTML = '';
        abilityChoices.innerHTML = '';
        endTurnBtn.style.display = 'none';
    }
}

function nextUnit() {
    gameState.currentUnitIndex = (gameState.currentUnitIndex + 1) % gameState.playerTeam.length;
    gameState.selectedUnit = gameState.playerTeam[gameState.currentUnitIndex];
    addLogEntry(`It's now ${gameState.selectedUnit.name}'s turn!`, 'special');
}

function showSection(sectionId) {
    document.querySelectorAll('.game-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showBattleResults(playerWon) {
    if (!elements.displays.resultTitle || !elements.displays.resultDetails) return;
    
    gameState.battleEnded = true;
    elements.displays.resultTitle.textContent = playerWon ? "Victory!" : "Defeat!";
    
    if (playerWon) {
        const xp = calculateXPRewards();
        const gold = Math.floor(Math.random() * 100) + 50;
        gameState.gold += gold;
        
        elements.displays.resultDetails.innerHTML = `
            <p>Victory! You defeated all enemy units!</p>
            <p>Rewards:</p>
            <ul>
                <li>XP Gained: ${xp}</li>
                <li>Gold Earned: ${gold}</li>
            </ul>
        `;
        
        shopSystem.battleCount++;
        if (shopSystem.shouldShowShop()) {
            setTimeout(() => shopSystem.show(), 1500);
        } else {
            setTimeout(() => pauseSystem.show(), 1500);
        }
    } else {
        elements.displays.resultDetails.innerHTML = `
            <p>Your team was defeated.</p>
            <p>Better luck next time!</p>
        `;
    }
    
    showSection('battle-results');
}

function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

function showSaveLoadScreen() {
    showSection('save-load-screen');
    const saveSlots = document.getElementById('save-slots');
    saveSlots.innerHTML = ''; // Clear existing slots
    for (let i = 1; i <= 3; i++) {
        const saveKey = `saveSlot${i}`;
        const saveData = localStorage.getItem(saveKey);
        const slotElement = document.createElement('div');
        slotElement.className = 'save-slot';
        slotElement.textContent = saveData ? `Save Slot ${i}` : `Empty Slot ${i}`;
        slotElement.addEventListener('click', () => {
            if (saveData) loadGame(saveKey);
            else saveGame(saveKey);
        });
        saveSlots.appendChild(slotElement);
    }
}

function isValidAbilityTarget(target, ability) {
    const isEnemy = gameState.enemyTeam.some(u => u.id === target.id);
    return (isEnemy && !ability.heal) || (!isEnemy && ability.heal);
}

// Game Logic Functions
function handleGridClick(row, col) {
    if (!gameState.selectedUnit || gameState.battleEnded) return;

    const unitId = gameState.selectedUnit.id;
    const unitPos = gameState.gridUnits[unitId];
    if (!unitPos) return;

    // Handle movement mode
    if (gameState.movementMode) {
        if (isValidMove(unitPos.row, unitPos.col, row, col, gameState.selectedUnit.movement)) {
            gameState.gridUnits[unitId] = {
                row: row,
                col: col,
                unit: gameState.selectedUnit,
            };
            addLogEntry(`${gameState.selectedUnit.name} moved to (${row}, ${col})`, 'player');
            gameState.movementMode = false;
            renderBattleGrid();
        }
        return;
    }

    // Handle ability usage
    if (gameState.selectedAbility) {
        const rowDiff = Math.abs(row - unitPos.row);
        const colDiff = Math.abs(col - unitPos.col);
        const distance = Math.max(rowDiff, colDiff);

        if (distance <= (gameState.selectedAbility.range || 1)) {
            if (gameState.selectedAbility.aoe) {
                gameState.targets = getUnitsInRadius(row, col, 1);
            } else {
                const targetId = Object.keys(gameState.gridUnits).find((id) => {
                    const pos = gameState.gridUnits[id];
                    return pos.row === row && pos.col === col && pos.unit.current_hp > 0;
                });
                if (targetId) {
                    gameState.targets = [gameState.gridUnits[targetId].unit];
                }
            }

            if (gameState.targets.length > 0) {
                const isEnemyTeam = gameState.enemyTeam.some((u) => u.id === gameState.targets[0].id);
                if ((isEnemyTeam && !gameState.selectedAbility.heal) || (!isEnemyTeam && gameState.selectedAbility.heal)) {
                    confirmAction();
                }
            }
        }
    }
}

function confirmAction() {
    if (!gameState.selectedUnit || !gameState.selectedAbility ||
        gameState.targets.length === 0 || gameState.battleEnded) return;

    const ability = gameState.selectedAbility;
    const sourceUnit = gameState.selectedUnit;
    const abilityKey = `${sourceUnit.id}-${ability.name}`;
    const terrainBonus = calculateTerrainEffects(sourceUnit, ability);

    // Initialize ability use count if not exists
    if (!gameState.gameStats.abilityUseCount[abilityKey]) {
        gameState.gameStats.abilityUseCount[abilityKey] = 0;
    }
    
    gameState.gameStats.abilityUseCount[abilityKey]++;
    const effectiveness = Math.max(0.5, 1 - (gameState.gameStats.abilityUseCount[abilityKey] * 0.1));

    gameState.targets.forEach(target => {
        if (!target) return;
        
        if (ability.heal) {
            const healAmount = Math.round((ability.power || 0) * effectiveness);
            target.current_hp = Math.min(target.max_hp, target.current_hp + healAmount);
            addLogEntry(`${sourceUnit.name} heals ${target.name} for ${healAmount} HP!`, 'heal');
            playSound(elements.audio.healSound);

            const baseSG = ability.sg_gain || 0;
            const actualSG = Math.max(5, Math.round((baseSG + terrainBonus) * effectiveness));
            sourceUnit.sg = Math.min(100, sourceUnit.sg + actualSG);
            if (effectiveness < 0.8) {
                addLogEntry(`(Healing effectiveness reduced to ${Math.round(effectiveness * 100)}%)`, 'special');
            }
        } else {
            const damage = Math.round((ability.power || 0) * effectiveness);
            target.current_hp = Math.max(0, target.current_hp - damage);
            addLogEntry(`${sourceUnit.name} hits ${target.name} with ${ability.name} for ${damage} damage!`, 'damage');
            playSound(elements.audio.attackSound);

            const baseSG = ability.sg_gain || 0;
            const actualSG = Math.max(3, Math.round((baseSG + terrainBonus) * effectiveness));
            sourceUnit.sg = Math.min(100, sourceUnit.sg + actualSG);
            target.sg = Math.min(100, target.sg + Math.round(damage / 2));
            if (effectiveness < 0.8) {
                addLogEntry(`(Attack effectiveness reduced to ${Math.round(effectiveness * 100)}%)`, 'special');
            }
        }
    });

    if (ability.sg_cost) {
        sourceUnit.sg = 0;
        playSound(elements.audio.comboSound);
        addLogEntry(`${sourceUnit.name} unleashes a powerful combo!`, 'special');
        gameState.gameStats.combosUsed++;
    }

    gameState.selectedUnit = null;
    gameState.selectedAbility = null;
    gameState.targets = [];

    if (!checkBattleEnd()) {
        nextUnit();
    }
    renderBattleGrid();
}

function renderEquipmentScreen() {
    elements.displays.equipmentTeam.innerHTML = '';
    elements.displays.inventoryDisplay.innerHTML = '';
    elements.displays.goldAmount.textContent = gameState.gold;

    gameState.playerTeam.forEach((unit, index) => {
        const unitElement = document.createElement('div');
        unitElement.className = 'unit-card';
        unitElement.innerHTML = `
            <h4>${unit.name}</h4>
            <div class="equipment-slots">
                <div class="equipment-slot" data-unit="${index}" data-slot="weapon">
                    <h5>Weapon</h5>
                    <div class="equipment-item">${unit.equipment?.weapon?.name || 'Empty'}</div>
                </div>
                <div class="equipment-slot" data-unit="${index}" data-slot="armor">
                    <h5>Armor</h5>
                    <div class="equipment-item">${unit.equipment?.armor?.name || 'Empty'}</div>
                </div>
                <div class="equipment-slot" data-unit="${index}" data-slot="accessory">
                    <h5>Accessory</h5>
                    <div class="equipment-item">${unit.equipment?.accessory?.name || 'Empty'}</div>
                </div>
            </div>
        `;
        elements.displays.equipmentTeam.appendChild(unitElement);
    });

    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.addEventListener('click', handleEquipmentSlotClick);
    });

    gameState.inventory.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.index = index;
        itemElement.textContent = item.name;
        itemElement.addEventListener('click', handleInventoryItemClick);
        elements.displays.inventoryDisplay.appendChild(itemElement);
    });
}

function handleEquipmentSlotClick(e) {
    const slot = e.currentTarget;
    const unitIndex = parseInt(slot.dataset.unit);
    const slotType = slot.dataset.slot;
    gameState.selectedEquipmentSlot = {
        unitIndex,
        slotType
    };
    document.querySelectorAll('.inventory-item').forEach(item => {
        const itemData = gameState.inventory[parseInt(item.dataset.index)];
        item.classList.toggle('highlight', itemData.type === slotType);
    });
}

function handleInventoryItemClick(e) {
    if (!gameState.selectedEquipmentSlot) return;
    const itemIndex = parseInt(e.currentTarget.dataset.index);
    const item = gameState.inventory[itemIndex];
    const {
        unitIndex,
        slotType
    } = gameState.selectedEquipmentSlot;

    const currentItem = gameState.playerTeam[unitIndex].equipment?.[slotType];
    if (currentItem) gameState.inventory.push(currentItem);

    gameState.playerTeam[unitIndex].equipment = gameState.playerTeam[unitIndex].equipment || {};
    gameState.playerTeam[unitIndex].equipment[slotType] = item;
    gameState.inventory.splice(itemIndex, 1);

    renderEquipmentScreen();
    gameState.selectedEquipmentSlot = null;
}

function saveGame(saveKey) {
    const saveData = {
        version: 1.1,
        timestamp: Date.now(),
        playerFaction: gameState.playerFaction,
        playerTeam: gameState.playerTeam,
        playerLevel: gameState.playerLevel,
        xp: gameState.xp,
        gold: gameState.gold,
        inventory: gameState.inventory,
        gameStats: gameState.gameStats,
    };

    try {
        localStorage.setItem(saveKey, JSON.stringify(saveData));
        alert('Game saved successfully!');
        showSaveLoadScreen();
    } catch (e) {
        console.error('Save failed:', e);
        alert('Save failed: Not enough storage space. Please clear some space and try again.');
    }
}

function loadGame(saveKey) {
    try {
        const saveData = JSON.parse(localStorage.getItem(saveKey));
        if (!saveData) throw new Error('No save data found');
        if (!saveData.version || saveData.version < 1.0) throw new Error('Outdated save format');
        if (!saveData.playerTeam || !Array.isArray(saveData.playerTeam)) throw new Error('Corrupted save data');

        Object.assign(gameState, {
            playerFaction: saveData.playerFaction,
            playerTeam: saveData.playerTeam,
            playerLevel: saveData.playerLevel || 1,
            xp: saveData.xp || 0,
            gold: saveData.gold || 100,
            inventory: saveData.inventory || [],
            gameStats: saveData.gameStats || {
                battlesWon: 0,
                enemiesDefeated: 0,
                combosUsed: 0,
            },
            enemyFaction: null,
            enemyTeam: [],
            terrain: null,
            currentTurn: 0,
            currentUnitIndex: 0,
            battleLog: [],
            selectedUnit: null,
            selectedAbility: null,
            targets: [],
            gridUnits: {},
            battleEnded: false
        });

        alert('Game loaded successfully!');
        showSection('main-menu');
    } catch (e) {
        console.error('Load failed:', e);
        alert(`Failed to load game: ${e.message}`);
    }
} // End of loadGame function

// Game utility functions
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

function preloadAudio() {
    const audioElements = [
        elements.audio.bgMusic,
        elements.audio.attackSound,
        elements.audio.comboSound,
        elements.audio.healSound,
        elements.audio.victorySound,
        elements.audio.defeatSound,
        elements.audio.moveSound
    ];

    audioElements.forEach(audio => {
        audio.load();
        audio.volume = 0;
    });

    setTimeout(() => {
        elements.audio.bgMusic.volume = 0.3;
        elements.audio.attackSound.volume = 0.6;
        elements.audio.comboSound.volume = 0.6;
        elements.audio.healSound.volume = 0.6;
        elements.audio.victorySound.volume = 0.6;
        elements.audio.defeatSound.volume = 0.6;
        elements.audio.moveSound.volume = 0.6;
    }, 1000);
}

function initGame() {
    console.log("Initializing game...");
    try {
        preloadAudio();
    } catch (error) {
        console.error("Game initialization failed:", error);
        document.body.innerHTML = `
            <div class="container" style="color: white; text-align: center;">
                <h1>Game Failed to Load</h1>
                <p>${error.message || 'Initialization error'}</p>
                <button onclick="location.reload()">Try Again</button>
            </div>
        `;
    }
}

function getUnitsInRadius(row, col, radius) {
    const unitsInRadius = [];
    Object.keys(gameState.gridUnits).forEach(unitId => {
        const unitPos = gameState.gridUnits[unitId];
        const rowDiff = Math.abs(unitPos.row - row);
        const colDiff = Math.abs(unitPos.col - col);
        if (Math.max(rowDiff, colDiff) <= radius) {
            unitsInRadius.push(gameState.gridUnits[unitId].unit);
        }
    });
    return unitsInRadius;
}

function calculateTerrainEffects(unit, ability) {
    if (!unit || !unit.types || !gameState.terrain || !gameState.terrain.effects) {
        return 0;
    }

    let bonus = 0;
    const effects = gameState.terrain.effects;
    unit.types.forEach(type => {
        if (type && effects[type]) {
            const match = effects[type].match(/SG ([+-]\d+)/);
            if (match && match[1]) {
                bonus += parseInt(match[1], 10);
            }
        }
    });
    return bonus;
}

function endBattleAsDraw() {
    gameState.battleEnded = true;
    addLogEntry("Battle ended in a draw!", 'special');
    elements.displays.resultTitle.textContent = "Draw!";
    elements.displays.resultDetails.innerHTML = `
<p>All units were defeated!</p>
<p>No rewards were earned.</p>
`;
showSection('battle-results');
} // Ensure this closing brace matches the correct opening brace

function showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = message;
    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight}px`;

    element.addEventListener('mouseleave', () => {
        tooltip.remove();
    });
} // Ensure this block is properly closed or completed

function endTurn() {
    gameState.currentTurn++;
    updateTurnIndicator();
    nextUnit();
} // Ensure this block is properly closed or completed

function handleSoundToggle() {
    gameState.soundEnabled = !gameState.soundEnabled;
    const soundToggleBtn = document.getElementById('sound-toggle');
    soundToggleBtn.textContent = `Sound: ${gameState.soundEnabled ? 'ON' : 'OFF'}`;
} // Ensure this block is properly closed

// Attach event listener
document.getElementById('sound-toggle').addEventListener('click', handleSoundToggle);

function updateBattleLog(message, type) {
    addLogEntry(message, type);
    const battleLog = document.getElementById('battle-log');
    if (battleLog) {
        battleLog.scrollTop = battleLog.scrollHeight;
    } // Ensure this closing brace matches the correct opening brace
// Remove this unmatched closing brace

function calculateXPRewards() {
    const xpGained = gameState.enemyTeam.reduce((total, enemy) => {
        return total + (enemy.isBoss ? 100 : 50);
    }, 0);
    gameState.xp += xpGained;
    return xpGained;
// Remove this closing brace as it is misplaced and causes a syntax error.

function levelUp() {
    const nextLevelXP = gameData.xpRequirements[gameState.playerLevel];
    if (gameState.xp >= nextLevelXP) {
        gameState.playerLevel++;
        gameState.xp -= nextLevelXP;
        alert(`Level Up! You are now level ${gameState.playerLevel}`);
    // Removed the unnecessary closing brace to fix the syntax error
}

// Event Handlers
function initializeButtonHandlers() {
    // ...existing code...
}

function initializeRestBreakHandlers() {
    // ...existing code...
}

document.addEventListener('DOMContentLoaded', () => {
    initializeButtonHandlers();
    initializeRestBreakHandlers();
    window.shopSystem = shopSystem;
    // ...existing code...
});

// Team Selection Events
document.querySelectorAll('.select-faction').forEach(button => {
    button.addEventListener('click', (e) => {
        gameState.playerFaction = e.target.dataset.faction;
        document.getElementById('selected-faction').textContent = 
            `Selected Faction: ${gameState.playerFaction}`;
        showSection('team-select');
        renderTeamSelect();
    });
});

document.getElementById('random-team-btn').addEventListener('click', () => {
    const faction = gameData.factions[gameState.playerFaction];
    gameState.playerTeam = [];
    const availableUnits = [...faction];
    
    for (let i = 0; i < 4 && availableUnits.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableUnits.length);
        const unit = structuredClone(availableUnits.splice(randomIndex, 1)[0]);
        gameState.playerTeam.push(unit);
    }

    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
    renderTeamSelect();
});

document.getElementById('clear-team-btn').addEventListener('click', () => {
    gameState.playerTeam = [];
    document.getElementById('team-count').textContent = '(0/4)';
    document.getElementById('confirm-team-btn').disabled = true;
    renderTeamSelect();
});

// Battle Flow Events
document.getElementById('confirm-team-btn').addEventListener('click', () => {
    showSection('terrain-select');
    renderTerrainSelect();
});

document.getElementById('confirm-terrain-btn').addEventListener('click', () => {
    initializeBattle();
    showSection('battle-interface');
});

document.getElementById('end-turn-btn').addEventListener('click', () => {
    endTurn();
    renderBattleGrid();
});

// Battle Grid Events
document.getElementById('battle-grid').addEventListener('click', (e) => {
    if (!e.target.classList.contains('grid-cell')) return;
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    if (!isNaN(row) && !isNaN(col)) {
        handleGridClick(row, col);
    }
});

// Battle Results Events
document.getElementById('continue-btn').addEventListener('click', () => {
    showSection('equipment-screen');
    renderEquipmentScreen();
});

document.getElementById('new-battle-btn').addEventListener('click', () => {
    showSection('terrain-select');
    renderTerrainSelect();
});

document.getElementById('main-menu-end-btn').addEventListener('click', () => {
    if (confirm('Return to main menu? Progress will be lost if not saved.')) {
        showSection('main-menu');
    }
});

// Equipment Screen Events
document.querySelectorAll('.equipment-slot').forEach(slot => {
    slot.addEventListener('click', handleEquipmentSlotClick);
});

document.querySelectorAll('.inventory-item').forEach(item => {
    item.addEventListener('click', handleInventoryItemClick);
});

// Sound Controls
document.getElementById('sound-toggle').addEventListener('click', () => {
    gameState.soundEnabled = !gameState.soundEnabled;
    const btn = document.getElementById('sound-toggle');
    btn.textContent = `Sound: ${gameState.soundEnabled ? 'ON' : 'OFF'}`;
    if (!gameState.soundEnabled) {
        elements.audio.bgMusic.pause();
    } else {
        elements.audio.bgMusic.play();
    }
});

// Save/Load Events
document.querySelectorAll('.save-slot').forEach((slot, index) => {
    slot.addEventListener('click', () => {
        const saveKey = `saveSlot${index + 1}`;
        const hasData = localStorage.getItem(saveKey);
        if (hasData) {
            if (confirm('Load this save?')) {
                loadGame(saveKey);
            }
        } else {
            if (confirm('Save to this slot?')) {
                saveGame(saveKey);
            }
        }
        showSaveLoadScreen();
    });
});

// Core Button Functions
function handleAbilityButton(ability) {
    if (!gameState.selectedUnit || gameState.battleEnded) return;
    gameState.selectedAbility = ability;
    gameState.movementMode = false;
    gameState.targets = [];
    highlightValidTargets(ability);
}

// Rest Break System
function restBreak(player) {
    console.log("Rest break started. You can save, rearrange team members, or use items.");

    // Save game functionality
    function saveGame() {
        console.log("Game saved!");
        const saveData = {
            playerLevel: gameState.playerLevel,
            xp: gameState.xp,
            gold: gameState.gold,
            inventory: gameState.inventory,
            gameStats: gameState.gameStats,
        }

        try {
            localStorage.setItem('restBreakSave', JSON.stringify(saveData));
            alert('Game saved successfully during rest break!');
        } catch (e) {
            console.error('Save failed:', e);
            alert('Save failed: Not enough storage space. Please clear some space and try again.');
        }
    }

    // Rearrange team members functionality
    function rearrangeTeam() {
        console.log("Rearranging team members...");
        const teamContainer = document.getElementById('player-team');
        if (!teamContainer) return;

        // Allow drag-and-drop for rearranging team members
        teamContainer.querySelectorAll('.unit-card').forEach(card => {
            card.draggable = true;

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.dataset.unitId);
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedUnitId = e.dataTransfer.getData('text/plain');
                const targetUnitId = e.target.dataset.unitId;

                const draggedIndex = gameState.playerTeam.findIndex(unit => unit.id === draggedUnitId);
                const targetIndex = gameState.playerTeam.findIndex(unit => unit.id === targetUnitId);

                if (draggedIndex !== -1 && targetIndex !== -1) {
                    // Swap units in the team array
                    [gameState.playerTeam[draggedIndex], gameState.playerTeam[targetIndex]] =
                        [gameState.playerTeam[targetIndex], gameState.playerTeam[draggedIndex]];

                    // Re-render the team
                    renderTeamSelect();
                }
            });
        });
    }

    // Use items functionality
    function useItems() {
        console.log("Using items...");
        const inventory = gameState.inventory;
        if (inventory.length === 0) {
            alert("No items available to use.");
            return;
        }

        const itemList = inventory.map((item, index) => `${index + 1}: ${item.name}`).join('\n');
        const choice = prompt(`Select an item to use:\n${itemList}`);

        const itemIndex = parseInt(choice, 10) - 1;
        if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= inventory.length) {
            alert("Invalid selection.");
            return;
        }

        const selectedItem = inventory[itemIndex];
        if (selectedItem.type === 'consumable') {
            if (selectedItem.heal) {
                gameState.playerTeam.forEach(unit => {
                    unit.current_hp = Math.min(unit.max_hp, unit.current_hp + selectedItem.heal);
                });
                alert(`${selectedItem.name} used! Healed all units for ${selectedItem.heal} HP.`);
            }
            inventory.splice(itemIndex, 1); // Remove the used item
        } else {
            alert("This item cannot be used.");
        }
    }

    // Display options to the player
    console.log("Options: 1) Save Game  2) Rearrange Team  3) Use Items  4) Exit Rest Break");
    // ...implement input handling to call the above functions based on player choice...
}

// Button Handlers for Rest Break
function initializeRestBreakHandlers() {
    const saveButton = document.getElementById("saveButton");
    const rearrangeButton = document.getElementById("rearrangeButton");
    const useItemsButton = document.getElementById("useItemsButton");

    if (saveButton) {
        saveButton.addEventListener("click", () => {
            console.log("Save button clicked.");
            saveGame();
        });
    }

    if (rearrangeButton) {
        rearrangeButton.addEventListener("click", () => {
            console.log("Rearrange button clicked.");
            rearrangeTeam();
        });
    }

    if (useItemsButton) {
        useItemsButton.addEventListener("click", () => {
            console.log("Use Items button clicked.");
            useItems();
        });
    }
}

function handleMoveButton() {
    if (!gameState.selectedUnit || gameState.battleEnded) return;
    gameState.movementMode = true;
    gameState.selectedAbility = null;
    gameState.targets = [];
    highlightValidMoves();
}

function handleEndTurnButton() {
    if (gameState.battleEnded) return;
    endTurn();
    renderBattleGrid();
}

// UI Button Event Handlers
function initializeButtonHandlers() {
    // Ability Panel Buttons
    const abilityPanel = document.getElementById('ability-choices');
    if (abilityPanel) {
        abilityPanel.addEventListener('click', (e) => {
            if (e.target.classList.contains('ability-btn')) {
                const abilityName = e.target.dataset.ability;
                const ability = gameState.selectedUnit.basic_abilities[abilityName] || 
                              gameState.selectedUnit.combo_abilities[abilityName];
                if (ability) {
                    handleAbilityButton(ability);
                }
            }
        });
    }

    // Movement Button
    const moveBtn = document.createElement('button');
    moveBtn.textContent = 'Move';
    moveBtn.classList.add('move-btn');
    moveBtn.addEventListener('click', handleMoveButton);
    abilityPanel?.appendChild(moveBtn);

    // End Turn Button
    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
        endTurnBtn.addEventListener('click', handleEndTurnButton);
    }
}

function highlightValidTargets(ability) {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('highlight', 'attackable', 'movement');
    });

    if (!gameState.selectedUnit || !ability) return;

    const unitPos = gameState.gridUnits[gameState.selectedUnit.id];
    if (!unitPos) return;

    const range = ability.range || 1;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
            const distance = Math.max(
                Math.abs(row - unitPos.row),
                Math.abs(col - unitPos.col)
            );
            if (distance <= range) {
                const cell = document.querySelector(
                    `.grid-cell[data-row="${row}"][data-col="${col}"]`
                );
                if (cell) {
                    cell.classList.add(ability.heal ? 'highlight' : 'attackable');
                }
            }
        }
    }
}

function highlightValidMoves() {
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('highlight', 'attackable', 'movement');
    });

    if (!gameState.selectedUnit) return;

    const unitPos = gameState.gridUnits[gameState.selectedUnit.id];
    if (!unitPos) return;

    const moveRange = gameState.selectedUnit.movement || 2;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
            const distance = Math.max(
                Math.abs(row - unitPos.row),
                Math.abs(col - unitPos.col)
            );
            if (distance <= moveRange) {
                const cell = document.querySelector(
                    `.grid-cell[data-row="${row}"][data-col="${col}"]`
                );
                if (cell && !isOccupied(row, col)) {
                    cell.classList.add('movement');
                }
            }
        }
    }
}

function isOccupied(row, col) {
    return Object.values(gameState.gridUnits).some(unit => 
        unit.row === row && unit.col === col);
}

// Initialize all button handlers when game starts
document.addEventListener('DOMContentLoaded', () => {
    initializeButtonHandlers();
    // Add touch support for mobile
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'BUTTON') {
            e.preventDefault();
        }
    }, false);
});

function initializeBattle() {
    // Set up initial game state
    gameState.currentTurn = 1;
    gameState.currentUnitIndex = 0;
    gameState.battleEnded = false;
    gameState.gridUnits = {};

    // Position player team at bottom
    gameState.playerTeam.forEach((unit, index) => {
        gameState.gridUnits[unit.id] = {
            row: 4,
            col: index * 2 + 1,
            unit: unit
        }
    });

    // Create and position enemy team at top
    const enemyFactions = Object.keys(gameData.factions)
        .filter(f => f !== gameState.playerFaction);
    gameState.enemyFaction = enemyFactions[Math.floor(Math.random() * enemyFactions.length)];

    const possibleEnemies = gameData.factions[gameState.enemyFaction];
    gameState.enemyTeam = [];

    // Select 3 regular units and 1 boss
    const regularUnits = possibleEnemies.filter(u => !u.isBoss);
    const bossUnits = possibleEnemies.filter(u => u.isBoss);
    
    for (let i = 0; i < 3; i++) {
        const randomUnit = structuredClone(
            regularUnits[Math.floor(Math.random() * regularUnits.length)]
        );
        gameState.enemyTeam.push(randomUnit);
    }

    const boss = structuredClone(
        bossUnits[Math.floor(Math.random() * bossUnits.length)]
    );
    gameState.enemyTeam.push(boss);
    
    // Position enemy team
    gameState.enemyTeam.forEach((unit, index) => {
        gameState.gridUnits[unit.id] = {
            row: 0,
            col: index * 2 + 1,
            unit: unit
        };
    });

    // Set initial selected unit
    gameState.selectedUnit = gameState.playerTeam[0];
    // Initialize battle interface
    renderBattleGrid();
    updateTurnIndicator();
    
    // Start background music
    if (gameState.soundEnabled) {
        elements.audio.bgMusic.play();
    }

    // Add battle start message
    addLogEntry('Battle Started!', 'special');
    addLogEntry(`${gameState.playerFaction} vs ${gameState.enemyFaction}`, 'special');
}

// Constants
const MAX_TURNS = 30;

// Core game systems
// Remove this duplicate declaration of shopSystem
    battleCount: 0,
    inventory; [],
    
    shouldShowShop() ;
        return this.battleCount % 3 === 0;
    
    generateShopInventory() ;
        const shopItems = [];
        const allEquipment = [
            ...gameData.equipment.weapons,
            ...gameData.equipment.armor,
            ...gameData.equipment.accessories
        ];
        
        // Select 5 random items
        for(let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({...item, price: item.value});
        }
        
        // Add consumables
        shopItems.push({
            id: 'potion',
            name: 'Health Potion',
            type: 'consumable',
            heal: 30,
            price: 50
        });
        
        shopItems.push({
            id: 'scroll',
            name: 'Spiral Scroll',
            type: 'consumable',
            sg: 25,
            price: 75
        });
        
        this.inventory = shopItems;
    }
    
    function renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');

        if (!shopItems || !shopGold) return;

        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';

        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button onclick="shopSystem.buyItem('${item.id}')" 
                            ${gameState.gold < item.price ? 'disabled' : ''}>
                        Buy
                    </button>
                </div>
            `;
            shopItems.appendChild(itemElement);
        });
        console.log('Placeholder logic executed.');
    }
    
    buyItem(itemId) ;
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;
        
        gameState.gold -= item.price;
        const boughtItem = {...item};
        delete boughtItem.price; // Remove price property before adding to inventory
        gameState.inventory.push(boughtItem);
        this.renderShop();
        
        addLogEntry(`Purchased ${item.name} for ${item.price} Yaga`, 'special');
    }
    
    show() ;
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    };


const pauseSystem = {
    show() {
        showSection('pause-screen');
    },
    
    hide() {
        showSection('battle-interface');
    }
};

// Add these missing render functions
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix the ability panel event handling
function initializeButtonHandlers() {
    // ...existing code...
    
    // Update ability panel click handling
    const abilityPanel = document.getElementById('ability-choices');
    if (abilityPanel) {
        abilityPanel.innerHTML = ''; // Clear existing
        
        // Recreate ability buttons with proper event listeners
        if (gameState.selectedUnit) {
            Object.entries(gameState.selectedUnit.basic_abilities).forEach(([name, ability]) => {
                const btn = document.createElement('button');
                btn.className = 'ability-btn';
                btn.textContent = name;
                btn.onclick = () => handleAbilityButton(ability);
                abilityPanel.appendChild(btn);
            });
            
            if (gameState.selectedUnit.sg >= 100) {
                Object.entries(gameState.selectedUnit.combo_abilities).forEach(([name, ability]) => {
                    const btn = document.createElement('button');
                    btn.className = 'combo-btn';
                    btn.textContent = name;
                    btn.onclick = () => handleAbilityButton(ability);
                    abilityPanel.appendChild(btn);
                });
            }
        }
    }
    
    // ...existing code...
}

// Remove this duplicate declaration of shopSystem
    battleCount: 0,
    inventory: [],
    
    shouldShowShop() {
        return (this.battleCount + 1) % 10 === 0;
    },
    
    generateShopInventory() {
        // Add logic for generating shop inventory here
    }
        const shopItems = [];
        // Add random selection of equipment
        const allEquipment = [
            ...gameData.equipment.weapons,
            ...gameData.equipment.armor,
            ...gameData.equipment.accessories
        ];
        
        // Select 5 random items
        for(let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({...item, price: item.value});
        }
        
        // Always add consumables
        shopItems.push({
            id: 'potion',
            name: 'Health Potion',
            type: 'consumable',
            heal: 30,
            price: 50
        });
        
        shopItems.push({
            id: 'scroll',
            name: 'SG Scroll',
            type: 'consumable',
            sg: 25,
            price: 75
        });
        
        this.inventory = shopItems;
    },
    
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        
        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';
        
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button onclick="shopSystem.buyItem('${item.id}')" 
                            ${gameState.gold < item.price ? 'disabled' : ''}>
                        Buy
                    </button>
                </div>
            `;
            shopItems.appendChild(itemElement);
        });
    },
    
    buyItem(itemId) {
    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;

        gameState.gold -= item.price;
        const boughtItem = { ...item };
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();

        addLogEntry(`Purchased ${item.name}`, 'special');
    },
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
};

// Modify the battle results code to check for shop
function showBattleResults(playerWon) {
    gameState.battleEnded = true;
    elements.displays.resultTitle.textContent = playerWon ? "Victory!" : "Defeat!";
    elements.displays.resultDetails.innerHTML = playerWon
        ? `<p>You defeated all enemy units!</p><p>Rewards: XP and loot.</p>`
        : `<p>Your team was defeated.</p><p>Better luck next time!</p>`;
    showSection('battle-results');
    
    if (playerWon) {
        shopSystem.battleCount++;
        if (shopSystem.shouldShowShop()) {
            setTimeout(() => {
                shopSystem.show();
            }, 1500);
        } else {
            setTimeout(() => {
                pauseSystem.show();
            }, 1500);
        }
    }
}

// Add shop leave handler
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            if (!isNaN(row) && !isNaN(col)) {
                handleGridClick(row, col);
            }
        }
    });

    // Ensure shopSystem is globally accessible
    window.shopSystem = shopSystem;
});

// Fix shop system initialization
// Removed duplicate definition of shopSystem to avoid conflicts
 
    shouldShowShop() {
        return (this.battleCount + 1) % 10 === 0;
    },
    
    generateShopInventory() {
        const shopItems = [];
        // Add random selection of equipment
        const allEquipment = [
            ...gameData.equipment.weapons,
            ...gameData.equipment.armor,
            ...gameData.equipment.accessories
        ];
        
        // Select 5 random items
        for(let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({...item, price: item.value});
        }
        
        // Always add consumables
        shopItems.push({
            id: 'potion',
            name: 'Health Potion',
            type: 'consumable',
            heal: 30,
            price: 50
        });
        
        shopItems.push({
            id: 'scroll',
            name: 'SG Scroll',
            type: 'consumable',
            sg: 25,
            price: 75
        });
        
        this.inventory = shopItems;
    },
    
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        
        if (!shopItems || !shopGold) return;
        
        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';
        
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button class="buy-btn" data-id="${item.id}"
                            ${gameState.gold < item.price ? 'disabled' : ''}>
                        Buy
                    </button>
                </div>
            `;
            
            const buyBtn = itemElement.querySelector('.buy-btn');
            buyBtn.addEventListener('click', () => this.buyItem(item.id));
            
            shopItems.appendChild(itemElement);
        });
    },
    
    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;
        
        gameState.gold -= item.price;
        const boughtItem = {...item};
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();
        
        // Show confirmation
        addLogEntry(`Purchased ${item.name}`, 'special');
    },
    
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
};

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top

        

// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top

    battleCount: 0,
    inventory: [],
    
    shouldShowShop() {
        return this.battleCount % 3 === 0; // Show shop every 3 battles
    },
    
    generateShopInventory() {
        const shopItems = [];
        const allEquipment = [
            ...gameData.equipment.weapons,
            ...gameData.equipment.armor,
            ...gameData.equipment.accessories
        ];
        
        // Select 5 random items
        for(let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({...item, price: item.value});
        }
        
        // Add consumables
        shopItems.push({
            id: 'potion',
            name: 'Health Potion',
            type: 'consumable',
            heal: 30,
            price: 50
        });
        
        shopItems.push({
            id: 'scroll',
            name: 'SG Scroll',
            type: 'consumable',
            sg: 25,
            price: 75
        });
        
        this.inventory = shopItems;
    },
    
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        
        if (!shopItems || !shopGold) return;
        
        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';
        
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button class="buy-btn" data-id="${item.id}"
                            ${gameState.gold < item.price ? 'disabled' : ''}>
                        Buy
                    </button>
                </div>
            `;
            
            const buyBtn = itemElement.querySelector('.buy-btn');
            buyBtn.addEventListener('click', () => this.buyItem(item.id));
            
            shopItems.appendChild(itemElement);
        });
    },
    
    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;
        
        gameState.gold -= item.price;
        const boughtItem = {...item};
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();
        
        // Show confirmation
        addLogEntry(`Purchased ${item.name}`, 'special');
    },
    
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    

// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top


// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    
    // Render selected team
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Fix terrain selection
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    
    terrainOptions.innerHTML = '';
    
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) {
            terrainCard.classList.add('selected');
        }
        
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) => 
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => 
                card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        
        terrainOptions.appendChild(terrainCard);
    });
}

// Fix battle state updates
function checkBattleEnd() {
    if (!gameState.playerTeam || !gameState.enemyTeam) return false;
    
    const playerAlive = gameState.playerTeam.some(u => u.current_hp > 0);
    const enemyAlive = gameState.enemyTeam.some(u => u.current_hp > 0);

    if (gameState.currentTurn >= MAX_TURNS) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive && !enemyAlive) {
        endBattleAsDraw();
        return true;
    }
    if (!playerAlive || !enemyAlive) {
        gameState.battleEnded = true;
        setTimeout(() => {
            showBattleResults(playerAlive);
        }, 1000);
        return true;
    }
    return false;
}

// Add error handling for audio
function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) {
                playPromise.catch(() => {
                    // Ignore failed playback
                });
            }
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Remove duplicate shopSystem definition and merge them into a single one at the top
;

// Complete resetGameState function
function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

// Add missing updateTurnIndicator function
function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.textContent = `Turn: ${gameState.currentTurn}`;
    }
}

// Initialize event listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    initGame();
    initializeButtonHandlers();
    
    // Make shopSystem globally available
    window.shopSystem = shopSystem;
    
    // Add shop button handler
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    
    // Initialize sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', handleSoundToggle);
    }
});

// Fix renderTeamSelect function
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    
    // Clear previous content
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    
    // Render available units
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push



// ----- FILE SEPARATOR: Untitled-1.js -----

// scripts.js

// -- DATA & CONSTANTS --------------------------------------------------

const MAX_TURNS = 30;

const gameData = {
    factions: {
        // SAMPLE, replace/add your full data here!
        "Fog Leaf": [
            {
                id: "CG01",
                name: "Castle Guard",
                max_hp: 210,
                current_hp: 210,
                types: ["Power", "Blade"],
                role: "Tank",
                basic_abilities: {
                    "Shield Strike": { power: 15, sg_gain: 10, range: 1 },
                    "Counter": { power: 10, sg_gain: 15, range: 1 }
                },
                combo_abilities: {
                    "Astral Crash": { requirements: ["Shield Strike", "Counter"], power: 40, sg_cost: 100, range: 1 }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 2,
                notes: "Got lost in the forest on the way back to the castle",
                sprite: "🛡️"
            },
           {
            id: "MM02",
            name: "Mist Moth",
            max_hp: 150,
            current_hp: 150,
            types: ["Nature", "Mist"],
            role: "Evasion",
            basic_abilities: {
                "Mist Veil": {
                power: 0,
                sg_gain: 20,
                defensive: true,
                range: 0
                },
                "Wing Strike": {
                power: 20,
                sg_gain: 15,
                range: 1
                }
            },
            combo_abilities: {
                "Powder Fog": {
                requirements: ["Mist Veil", "Wing Strike"],
                power: 45,
                sg_cost: 100,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 1.3,
            movement: 3,
            notes: "Highly Territorial Species of Moth",
            sprite: "🦋"
            },
            {
            id: "DR03",
            name: "Dryad",
            max_hp: 160,
            current_hp: 160,
            types: ["Nature", "Spirit"],
            role: "Support",
            basic_abilities: {
                "Heal": {
                power: 20,
                sg_gain: 5,
                heal: true,
                range: 2
                },
                "Spirit Thorn": {
                power: 12,
                sg_gain: 8,
                range: 2
                }
            },
            combo_abilities: {
                "Spectral Overgrowth": {
                requirements: ["Heal", "Spirit Thorn"],
                power: 30,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 0.8,
            movement: 2,
            notes: "Forest Resident who's afraid of the fog",
            sprite: "🌿"
            },
            {
            id: "BM05",
            name: "Blade Merc",
            max_hp: 180,
            current_hp: 180,
            types: ["Blade", "Power"],
            role: "Burst DPS",
            basic_abilities: {
                "Lucky Cut": {
                power: 25,
                sg_gain: 20,
                range: 1
                },
                "Sleepy Slash": {
                power: 8,
                sg_gain: 15,
                counter: true,
                range: 1
                }
            },
            combo_abilities: {
                "Slumber Frenzy": {
                requirements: ["Lucky Cut", "Sleepy Slash"],
                power: 60,
                sg_cost: 100,
                multi: 3,
                range: 1
                }
            },
            sg: 0,
            sg_rate: 1.4,
            movement: 2,
            notes: "Was sent to investigate the fog, but fell asleep ",
            sprite: "⚔️"
            },
            {
            id: "FS07",
            name: "Forest Slime",
            max_hp: 170,
            current_hp: 170,
            types: ["Nature", "Debuff"],
            role: "Debuffer",
            basic_abilities: {
                "Toxic Ooze": {
                power: 10,
                sg_gain: 15,
                debuff: true,
                range: 1
                },
                "Root Crash": {
                power: 15,
                sg_gain: 10,
                range: 1
                }
            },
            combo_abilities: {
                "Corrosive Vines": {
                requirements: ["Toxic Ooze", "Root Crash"],
                power: 40,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 0.8,
            movement: 1,
            notes: "Has a symbiotic relationship with a special root in order to keep their form ",
            sprite: "🟢"
            },
            {
            id: "SW09",
            name: "Slash Weed",
            max_hp: 220,
            current_hp: 220,
            types: ["Nature", "Blade"],
            role: "Boss (DPS)",
            basic_abilities: {
                "Razor Leaf": {
                power: 30,
                sg_gain: 20,
                range: 2
                },
                "Root Slam": {
                power: 25,
                sg_gain: 15,
                range: 1
                }
            },
            combo_abilities: {
                "Overgrowth Frenzy": {
                requirements: ["Razor Leaf", "Root Slam"],
                power: 70,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 1.2,
            movement: 1,
            isBoss: true,
            notes: "The Forest guardian, now in a fog-induced frenzy",
            sprite: "🌳"
            },
            {
            id: "FW10",
            name: "Fog Wyrm",
            max_hp: 250,
            current_hp: 250,
            types: ["Mist", "Dragon"],
            role: "Boss (AOE)",
            basic_abilities: {
                "Fog Breath": {
                power: 20,
                sg_gain: 15,
                aoe: true,
                range: 2
                },
                "Shadow Claw": {
                power: 30,
                sg_gain: 10,
                range: 1
                }
            },
            combo_abilities: {
                "Abyssal Wrath": {
                requirements: ["Fog Breath", "Drake Claw"],
                power: 80,
                sg_cost: 100,
                aoe: true,
                range: 3
                }
            },
            sg: 0,
            sg_rate: 1.1,
            movement: 2,
            isBoss: true,
            notes: "An old fog dragon who got bored and took over the forest",
            sprite: "🐉"
            }
        ],
    },
      "Summit Flame": [

            {
                id: "KF80",
                name: "Kraken",
                max_hp: 100,
                current_hp: 100,
                types: ["Water", "Burst"],
                role: "Burst DPS",
                basic_abilities: {
                    "Suction Cut": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Water Film": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tentacle Whips": {
                        requirements: ["Suction Cut", "Water Film"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Young kraken found in Yadallo's icey cave ponds",
                sprite: "&#129425;"
            },
            {
                id: "CG11",
                name: "Cryogeist",
                max_hp: 170,
                current_hp: 170,
                types: ["Ice", "Burst"],
                role: "DPS",
                basic_abilities: {
                    "Dark Lash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Icy  Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Cruel Winds": {
                        requirements: ["Dark Lash", "Icy Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Spirits of those who had died on Yadallo",
                sprite: "&#10052;"
            },
            {
                id: "FG43",
                name: "Model F Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Ice", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Cryo Release": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Ice Wall": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Blizzard Slam": {
                        requirements: ["Cryo Release", "Ice Wall"],
                        power: 50,
                        sg_cost: 100,
                        aoe: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help mercenaries trek to the summit the mountain and help in medics",
                sprite: "&#129482;"
            },
            {
                id: "BG03",
                name: "Model B Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Fire", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Heat Dispel": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Slash", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help surivivors get off the mountain and guard medics",
                sprite: "&#128293;"
            },
            {
                id: "SH04",
                name: "Summit Medic",
                max_hp: 150,
                current_hp: 150,
                types: ["Fire", "Heal"],
                role: "Healer",
                basic_abilities: {
                    "Heal": {
                        power: 25,
                        sg_gain: 10,
                        heal: true,
                        range: 2
                    },
                    "Sparker": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Healing Hearth": {
                        requirements: ["Heal", "Sparker"],
                        power: 35,
                        sg_cost: 100,
                        heal: true,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 0.9,
                movement: 2,
                notes: "Stuck on the mountain due to the golems acting out",
                sprite: "&#10084;&#65039;"
            },
            {
                id: "FS06",
                name: "Fire Soldier",
                max_hp: 180,
                current_hp: 180,
                types: ["Fire", "Power"],
                role: "Bruiser",
                basic_abilities: {
                    "Burn Slash": {
                        power: 22,
                        sg_gain: 20,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Strike", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 2,
                notes: "Stationed on the mountain to help protect survivors",
                sprite: "&#129686;"
            },
            {
                id: "RH07",
                name: "Red Hono",
                max_hp: 170,
                current_hp: 170,
                types: ["Fire", "Burst"],
                role: "Burst",
                basic_abilities: {
                    "Fire Flash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Light Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Crimson Rays": {
                        requirements: ["Fire Flash", "Light Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 2,
                notes: "Hardened Fire Magic trapped in a crystal",
                sprite: "&#127801;"
            },
            {
                id: "PF08",
                name: "Pyre Dreky",
                max_hp: 160,
                current_hp: 160,
                types: ["Fire", "Mobility"],
                role: "Mobile DPS",
                basic_abilities: {
                    "Dive Strike": {
                        power: 20,
                        sg_gain: 20,
                        range: 2
                    },
                    "Talon Slash": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Scale Dive": {
                        requirements: ["Dive Strike", "Talon Slash"],
                        power: 50,
                        sg_cost: 100,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 3,
                notes: "A prehistoric looking bird native to Yadallo",
                sprite: "&#129413;"
            },
            {
                id: "CC09",
                name: "Catcus",
                max_hp: 140,
                current_hp: 140,
                types: ["Nature", "Magic"],
                role: "Burst Caster",
                basic_abilities: {
                    "Cat Launch": {
                        power: 30,
                        sg_gain: 25,
                        range: 3
                    },
                    "Needle Shots": {
                        power: 15,
                        sg_gain: 15,
                        aoe: true,
                        range: 2
                    }
                },
                combo_abilities: {
                    "Pin Burst": {
                        requirements: ["Cat Launch", "Needle Shots"],
                        power: 70,
                        sg_cost: 100,
                        aoe: true,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.1,
                movement: 1,
                notes: "A potted cactus possessed by a house cat",
                sprite: "&#128570;"
            },
            {
                id: "CT01",
                name: "Chilled Titan",
                max_hp: 240,
                current_hp: 240,
                types: ["Ice", "Fire"],
                role: "Boss (Hybrid)",
                basic_abilities: {
                    "Heat Up": {
                        power: 35,
                        sg_gain: 25,
                        range: 1
                    },
                    "Flame Stoke": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Chaos Wheel": {
                        requirements: ["Heat Up", "Flame  Stoke"],
                        power: 75,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 1,
                isBoss: true,
                notes: "A Titan that has had it's fire cooled",
                sprite: "&#10052;&#65039;&#128293;"
            },
            {
                id: "CM02",
                name: "Chill Maw",
                max_hp: 260,
                current_hp: 260,
                types: ["Ice", "Execute"],
                role: "Boss (Execute)",
                basic_abilities: {
                    "Frostbite": {
                        power: 40,
                        sg_gain: 30,
                        execute: true,
                        range: 1
                    },
                    "Drake Claw": {
                        power: 0,
                        sg_gain: 25,
                        stun: true,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Absolute Zero": {
                        requirements: ["Frostbite", "Drake Claw"],
                        power: 80,
                        sg_cost: 100,
                        execute: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 1,
                isBoss: true,
                notes: "A subterranean species of ice dragons",
                sprite: "&#129482;&#128056;"
            }
            ]
        },
        terrains: {
        "Forest": {
            name: "Dryad Forest",
            description: "A dense, magical forest that's being invaded by a misty dragon",
            effects: {
                "Nature": "SG +5 when healing",
                "Fire": "SG -3 per attack",
                "Dragon": "SG +2 when using abilities",
                "Mist": "SG +3 when attacking from stealth"
            },
            sprite: "🌳"
        },
        "Volcano": {
            name: "Warped Peak",
            description: "The summit of Yadallo Mountain, twisted by chaotic flames",
            effects: {
                "Fire": "SG +7 when attacking",
                "Water": "SG -5 when using abilities",
                "Ice": "SG +10 on freeze attempts",
                "Blast": "SG +5 on area attacks"
            },
            sprite: "🌋"
        },
        // ...other terrains...
    },
    equipment: {
        weapons: [
            { id: "w1", name: "Sword of Light", type: "weapon", power: 12, value: 200 }
            // ...add all weapon data
        ],
        armor: [
            { id: "a1", name: "Shroom Armor", type: "armor", defense: 5, value: 140 }
            // ...add all armor data
        ],
        accessories: [
            { id: "ac1", name: "Dragon Soul", type: "accessory", power: 10, value: 190 }
            // ...add all accessory data
        ]
    },
    lootTable: [
        { id: "gold", name: "Yaga", type: "currency", min: 1, max: 999 },
        { id: "potion", name: "Health Potion", type: "consumable", heal: 30 },
        { id: "scroll", name: "SG Scroll", type: "consumable", sg: 25 }
        // ...etc.
    ],
    xpRequirements: [
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 999 // etc.
    ]
};

const gameState = {
    playerFaction: null,
    playerTeam: [],
    enemyFaction: null,
    enemyTeam: [],
    terrain: null,
    currentTurn: 0,
    currentUnitIndex: 0,
    battleLog: [],
    selectedUnit: null,
    selectedAbility: null,
    targets: [],
    soundEnabled: true,
    battleEnded: false,
    gridUnits: {},
    selectedCell: null,
    movementMode: false,
    playerLevel: 1,
    xp: 0,
    gold: 100,
    inventory: [],
    equippedItems: {},
    gameStats: {
        battlesWon: 0,
        enemiesDefeated: 0,
        combosUsed: 0,
        abilityUseCount: {},
        selectedEquipmentSlot: null
    },
    savedGames: [],
};

// ---- MAIN SYSTEMS ---------------------------------------------------

const shopSystem = {
    battleCount: 0,
    inventory: [],
    shouldShowShop() { return this.battleCount % 3 === 0; },
    generateShopInventory() {
        const allEquipment = [
            ...(gameData.equipment.weapons || []),
            ...(gameData.equipment.armor || []),
            ...(gameData.equipment.accessories || [])
        ];
        const shopItems = [];
        for (let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({ ...item, price: item.value });
        }
        shopItems.push({ id: 'potion', name: 'Health Potion', type: 'consumable', heal: 30, price: 50 });
        shopItems.push({ id: 'scroll', name: 'SG Scroll', type: 'consumable', sg: 25, price: 75 });
        this.inventory = shopItems;
    },
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        if (!shopItems || !shopGold) return;
        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button class="buy-btn" data-id="${item.id}" ${gameState.gold < item.price ? 'disabled' : ''}>Buy</button>
                </div>
            `;
            itemElement.querySelector('.buy-btn').addEventListener('click', () => this.buyItem(item.id));
            shopItems.appendChild(itemElement);
        });
    },
    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;
        gameState.gold -= item.price;
        const boughtItem = { ...item };
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();
        addLogEntry(`Purchased ${item.name}`, 'special');
    },
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
};

const pauseSystem = {
    show() { showSection('pause-screen'); },
    hide() { showSection('battle-interface'); }
};

// ---- UTILITY & LOGIC FUNCTIONS --------------------------------------

// Add a message to the battle log
function addLogEntry(message, type) {
    const battleLog = document.getElementById('battle-log');
    if (battleLog) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        battleLog.appendChild(logEntry);
        battleLog.scrollTop = battleLog.scrollHeight;
    }
}

// Example: Render team select UI
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Render terrain selection UI
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    terrainOptions.innerHTML = '';
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) terrainCard.classList.add('selected');
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) =>
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        terrainOptions.appendChild(terrainCard);
    });
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) indicator.textContent = `Turn: ${gameState.currentTurn}`;
}

function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.game-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) playPromise.catch(() => {});
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Add more utility functions as necessary...
// (renderBattleGrid, checkBattleEnd, initializeBattle, etc.)

// ---- INITIALIZATION & EVENT WIRING -----------------------------------

function initializeButtonHandlers() {
    // Example: Attach handlers to buttons
    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        document.getElementById('sound-toggle').textContent =
            `Sound: ${gameState.soundEnabled ? 'ON' : 'OFF'}`;
        if (!gameState.soundEnabled) {
            document.getElementById('bgMusic')?.pause();
        } else {
            document.getElementById('bgMusic')?.play();
        }
    });
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    // ...add handlers for team/terrain selection etc.
}

function initGame() {
    // Place all startup logic here, e.g. preloadAudio(), initial UI, etc.
    updateTurnIndicator();
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    initializeButtonHandlers();
    window.shopSystem = shopSystem;
    // Add any additional initialization/setup
});


// ----- FILE SEPARATOR: Untitled-2.js -----

// scripts.js

// -- DATA & CONSTANTS --------------------------------------------------

const MAX_TURNS = 30;

const gameData = {
    factions: {
        // SAMPLE, replace/add your full data here!
        "Fog Leaf": [
            {
                id: "CG01",
                name: "Castle Guard",
                max_hp: 210,
                current_hp: 210,
                types: ["Power", "Blade"],
                role: "Tank",
                basic_abilities: {
                    "Shield Strike": { power: 15, sg_gain: 10, range: 1 },
                    "Counter": { power: 10, sg_gain: 15, range: 1 }
                },
                combo_abilities: {
                    "Astral Crash": { requirements: ["Shield Strike", "Counter"], power: 40, sg_cost: 100, range: 1 }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 2,
                notes: "Got lost in the forest on the way back to the castle",
                sprite: "🛡️"
            },
           {
            id: "MM02",
            name: "Mist Moth",
            max_hp: 150,
            current_hp: 150,
            types: ["Nature", "Mist"],
            role: "Evasion",
            basic_abilities: {
                "Mist Veil": {
                power: 0,
                sg_gain: 20,
                defensive: true,
                range: 0
                },
                "Wing Strike": {
                power: 20,
                sg_gain: 15,
                range: 1
                }
            },
            combo_abilities: {
                "Powder Fog": {
                requirements: ["Mist Veil", "Wing Strike"],
                power: 45,
                sg_cost: 100,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 1.3,
            movement: 3,
            notes: "Highly Territorial Species of Moth",
            sprite: "🦋"
            },
            {
            id: "DR03",
            name: "Dryad",
            max_hp: 160,
            current_hp: 160,
            types: ["Nature", "Spirit"],
            role: "Support",
            basic_abilities: {
                "Heal": {
                power: 20,
                sg_gain: 5,
                heal: true,
                range: 2
                },
                "Spirit Thorn": {
                power: 12,
                sg_gain: 8,
                range: 2
                }
            },
            combo_abilities: {
                "Spectral Overgrowth": {
                requirements: ["Heal", "Spirit Thorn"],
                power: 30,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 0.8,
            movement: 2,
            notes: "Forest Resident who's afraid of the fog",
            sprite: "🌿"
            },
            {
            id: "BM05",
            name: "Blade Merc",
            max_hp: 180,
            current_hp: 180,
            types: ["Blade", "Power"],
            role: "Burst DPS",
            basic_abilities: {
                "Lucky Cut": {
                power: 25,
                sg_gain: 20,
                range: 1
                },
                "Sleepy Slash": {
                power: 8,
                sg_gain: 15,
                counter: true,
                range: 1
                }
            },
            combo_abilities: {
                "Slumber Frenzy": {
                requirements: ["Lucky Cut", "Sleepy Slash"],
                power: 60,
                sg_cost: 100,
                multi: 3,
                range: 1
                }
            },
            sg: 0,
            sg_rate: 1.4,
            movement: 2,
            notes: "Was sent to investigate the fog, but fell asleep ",
            sprite: "⚔️"
            },
            {
            id: "FS07",
            name: "Forest Slime",
            max_hp: 170,
            current_hp: 170,
            types: ["Nature", "Debuff"],
            role: "Debuffer",
            basic_abilities: {
                "Toxic Ooze": {
                power: 10,
                sg_gain: 15,
                debuff: true,
                range: 1
                },
                "Root Crash": {
                power: 15,
                sg_gain: 10,
                range: 1
                }
            },
            combo_abilities: {
                "Corrosive Vines": {
                requirements: ["Toxic Ooze", "Root Crash"],
                power: 40,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 0.8,
            movement: 1,
            notes: "Has a symbiotic relationship with a special root in order to keep their form ",
            sprite: "🟢"
            },
            {
            id: "SW09",
            name: "Slash Weed",
            max_hp: 220,
            current_hp: 220,
            types: ["Nature", "Blade"],
            role: "Boss (DPS)",
            basic_abilities: {
                "Razor Leaf": {
                power: 30,
                sg_gain: 20,
                range: 2
                },
                "Root Slam": {
                power: 25,
                sg_gain: 15,
                range: 1
                }
            },
            combo_abilities: {
                "Overgrowth Frenzy": {
                requirements: ["Razor Leaf", "Root Slam"],
                power: 70,
                sg_cost: 100,
                aoe: true,
                range: 2
                }
            },
            sg: 0,
            sg_rate: 1.2,
            movement: 1,
            isBoss: true,
            notes: "The Forest guardian, now in a fog-induced frenzy",
            sprite: "🌳"
            },
            {
            id: "FW10",
            name: "Fog Wyrm",
            max_hp: 250,
            current_hp: 250,
            types: ["Mist", "Dragon"],
            role: "Boss (AOE)",
            basic_abilities: {
                "Fog Breath": {
                power: 20,
                sg_gain: 15,
                aoe: true,
                range: 2
                },
                "Shadow Claw": {
                power: 30,
                sg_gain: 10,
                range: 1
                }
            },
            combo_abilities: {
                "Abyssal Wrath": {
                requirements: ["Fog Breath", "Drake Claw"],
                power: 80,
                sg_cost: 100,
                aoe: true,
                range: 3
                }
            },
            sg: 0,
            sg_rate: 1.1,
            movement: 2,
            isBoss: true,
            notes: "An old fog dragon who got bored and took over the forest",
            sprite: "🐉"
            }
        ],
    },
      "Summit Flame": [

            {
                id: "KF80",
                name: "Kraken",
                max_hp: 100,
                current_hp: 100,
                types: ["Water", "Burst"],
                role: "Burst DPS",
                basic_abilities: {
                    "Suction Cut": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Water Film": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tentacle Whips": {
                        requirements: ["Suction Cut", "Water Film"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Young kraken found in Yadallo's icey cave ponds",
                sprite: "&#129425;"
            },
            {
                id: "CG11",
                name: "Cryogeist",
                max_hp: 170,
                current_hp: 170,
                types: ["Ice", "Burst"],
                role: "DPS",
                basic_abilities: {
                    "Dark Lash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Icy  Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Cruel Winds": {
                        requirements: ["Dark Lash", "Icy Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 3,
                notes: "Spirits of those who had died on Yadallo",
                sprite: "&#10052;"
            },
            {
                id: "FG43",
                name: "Model F Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Ice", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Cryo Release": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Ice Wall": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Blizzard Slam": {
                        requirements: ["Cryo Release", "Ice Wall"],
                        power: 50,
                        sg_cost: 100,
                        aoe: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help mercenaries trek to the summit the mountain and help in medics",
                sprite: "&#129482;"
            },
            {
                id: "BG03",
                name: "Model B Golem",
                max_hp: 230,
                current_hp: 230,
                types: ["Fire", "Tank"],
                role: "Tank",
                basic_abilities: {
                    "Heat Dispel": {
                        power: 20,
                        sg_gain: 15,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Slash", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.0,
                movement: 1,
                notes: "Meant to help surivivors get off the mountain and guard medics",
                sprite: "&#128293;"
            },
            {
                id: "SH04",
                name: "Summit Medic",
                max_hp: 150,
                current_hp: 150,
                types: ["Fire", "Heal"],
                role: "Healer",
                basic_abilities: {
                    "Heal": {
                        power: 25,
                        sg_gain: 10,
                        heal: true,
                        range: 2
                    },
                    "Sparker": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Healing Hearth": {
                        requirements: ["Heal", "Sparker"],
                        power: 35,
                        sg_cost: 100,
                        heal: true,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 0.9,
                movement: 2,
                notes: "Stuck on the mountain due to the golems acting out",
                sprite: "&#10084;&#65039;"
            },
            {
                id: "FS06",
                name: "Fire Soldier",
                max_hp: 180,
                current_hp: 180,
                types: ["Fire", "Power"],
                role: "Bruiser",
                basic_abilities: {
                    "Burn Slash": {
                        power: 22,
                        sg_gain: 20,
                        range: 1
                    },
                    "Heat Shield": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Tempered Strike": {
                        requirements: ["Burn Strike", "Heat Shield"],
                        power: 55,
                        sg_cost: 100,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 2,
                notes: "Stationed on the mountain to help protect survivors",
                sprite: "&#129686;"
            },
            {
                id: "RH07",
                name: "Red Hono",
                max_hp: 170,
                current_hp: 170,
                types: ["Fire", "Burst"],
                role: "Burst",
                basic_abilities: {
                    "Fire Flash": {
                        power: 25,
                        sg_gain: 25,
                        range: 2
                    },
                    "Light Veil": {
                        power: 0,
                        sg_gain: 15,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Crimson Rays": {
                        requirements: ["Fire Flash", "Light Veil"],
                        power: 65,
                        sg_cost: 100,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.5,
                movement: 2,
                notes: "Hardened Fire Magic trapped in a crystal",
                sprite: "&#127801;"
            },
            {
                id: "PF08",
                name: "Pyre Dreky",
                max_hp: 160,
                current_hp: 160,
                types: ["Fire", "Mobility"],
                role: "Mobile DPS",
                basic_abilities: {
                    "Dive Strike": {
                        power: 20,
                        sg_gain: 20,
                        range: 2
                    },
                    "Talon Slash": {
                        power: 15,
                        sg_gain: 15,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Scale Dive": {
                        requirements: ["Dive Strike", "Talon Slash"],
                        power: 50,
                        sg_cost: 100,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 3,
                notes: "A prehistoric looking bird native to Yadallo",
                sprite: "&#129413;"
            },
            {
                id: "CC09",
                name: "Catcus",
                max_hp: 140,
                current_hp: 140,
                types: ["Nature", "Magic"],
                role: "Burst Caster",
                basic_abilities: {
                    "Cat Launch": {
                        power: 30,
                        sg_gain: 25,
                        range: 3
                    },
                    "Needle Shots": {
                        power: 15,
                        sg_gain: 15,
                        aoe: true,
                        range: 2
                    }
                },
                combo_abilities: {
                    "Pin Burst": {
                        requirements: ["Cat Launch", "Needle Shots"],
                        power: 70,
                        sg_cost: 100,
                        aoe: true,
                        range: 3
                    }
                },
                sg: 0,
                sg_rate: 1.1,
                movement: 1,
                notes: "A potted cactus possessed by a house cat",
                sprite: "&#128570;"
            },
            {
                id: "CT01",
                name: "Chilled Titan",
                max_hp: 240,
                current_hp: 240,
                types: ["Ice", "Fire"],
                role: "Boss (Hybrid)",
                basic_abilities: {
                    "Heat Up": {
                        power: 35,
                        sg_gain: 25,
                        range: 1
                    },
                    "Flame Stoke": {
                        power: 0,
                        sg_gain: 20,
                        defensive: true,
                        range: 0
                    }
                },
                combo_abilities: {
                    "Chaos Wheel": {
                        requirements: ["Heat Up", "Flame  Stoke"],
                        power: 75,
                        sg_cost: 100,
                        aoe: true,
                        range: 2
                    }
                },
                sg: 0,
                sg_rate: 1.2,
                movement: 1,
                isBoss: true,
                notes: "A Titan that has had it's fire cooled",
                sprite: "&#10052;&#65039;&#128293;"
            },
            {
                id: "CM02",
                name: "Chill Maw",
                max_hp: 260,
                current_hp: 260,
                types: ["Ice", "Execute"],
                role: "Boss (Execute)",
                basic_abilities: {
                    "Frostbite": {
                        power: 40,
                        sg_gain: 30,
                        execute: true,
                        range: 1
                    },
                    "Drake Claw": {
                        power: 0,
                        sg_gain: 25,
                        stun: true,
                        range: 1
                    }
                },
                combo_abilities: {
                    "Absolute Zero": {
                        requirements: ["Frostbite", "Drake Claw"],
                        power: 80,
                        sg_cost: 100,
                        execute: true,
                        range: 1
                    }
                },
                sg: 0,
                sg_rate: 1.3,
                movement: 1,
                isBoss: true,
                notes: "A subterranean species of ice dragons",
                sprite: "&#129482;&#128056;"
            }
            ]
        },
        terrains: {
        "Forest": {
            name: "Dryad Forest",
            description: "A dense, magical forest that's being invaded by a misty dragon",
            effects: {
                "Nature": "SG +5 when healing",
                "Fire": "SG -3 per attack",
                "Dragon": "SG +2 when using abilities",
                "Mist": "SG +3 when attacking from stealth"
            },
            sprite: "🌳"
        },
        "Volcano": {
            name: "Warped Peak",
            description: "The summit of Yadallo Mountain, twisted by chaotic flames",
            effects: {
                "Fire": "SG +7 when attacking",
                "Water": "SG -5 when using abilities",
                "Ice": "SG +10 on freeze attempts",
                "Blast": "SG +5 on area attacks"
            },
            sprite: "🌋"
        },
        // ...other terrains...
    },
    equipment: {
        weapons: [
            { id: "w1", name: "Sword of Light", type: "weapon", power: 12, value: 200 }
            // ...add all weapon data
        ],
        armor: [
            { id: "a1", name: "Shroom Armor", type: "armor", defense: 5, value: 140 }
            // ...add all armor data
        ],
        accessories: [
            { id: "ac1", name: "Dragon Soul", type: "accessory", power: 10, value: 190 }
            // ...add all accessory data
        ]
    },
    lootTable: [
        { id: "gold", name: "Yaga", type: "currency", min: 1, max: 999 },
        { id: "potion", name: "Health Potion", type: "consumable", heal: 30 },
        { id: "scroll", name: "SG Scroll", type: "consumable", sg: 25 }
        // ...etc.
    ],
    xpRequirements: [
        0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 999 // etc.
    ]
};

const gameState = {
    playerFaction: null,
    playerTeam: [],
    enemyFaction: null,
    enemyTeam: [],
    terrain: null,
    currentTurn: 0,
    currentUnitIndex: 0,
    battleLog: [],
    selectedUnit: null,
    selectedAbility: null,
    targets: [],
    soundEnabled: true,
    battleEnded: false,
    gridUnits: {},
    selectedCell: null,
    movementMode: false,
    playerLevel: 1,
    xp: 0,
    gold: 100,
    inventory: [],
    equippedItems: {},
    gameStats: {
        battlesWon: 0,
        enemiesDefeated: 0,
        combosUsed: 0,
        abilityUseCount: {},
        selectedEquipmentSlot: null
    },
    savedGames: [],
};

// ---- MAIN SYSTEMS ---------------------------------------------------

const shopSystem = {
    battleCount: 0,
    inventory: [],
    shouldShowShop() { return this.battleCount % 3 === 0; },
    generateShopInventory() {
        const allEquipment = [
            ...(gameData.equipment.weapons || []),
            ...(gameData.equipment.armor || []),
            ...(gameData.equipment.accessories || [])
        ];
        const shopItems = [];
        for (let i = 0; i < 5; i++) {
            const item = allEquipment[Math.floor(Math.random() * allEquipment.length)];
            shopItems.push({ ...item, price: item.value });
        }
        shopItems.push({ id: 'potion', name: 'Health Potion', type: 'consumable', heal: 30, price: 50 });
        shopItems.push({ id: 'scroll', name: 'SG Scroll', type: 'consumable', sg: 25, price: 75 });
        this.inventory = shopItems;
    },
    renderShop() {
        const shopItems = document.getElementById('shop-items');
        const shopGold = document.getElementById('shop-gold');
        if (!shopItems || !shopGold) return;
        shopGold.textContent = gameState.gold;
        shopItems.innerHTML = '';
        this.inventory.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.innerHTML = `
                <div>
                    <h4>${item.name}</h4>
                    <p>${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                </div>
                <div>
                    <p>${item.price} Gold</p>
                    <button class="buy-btn" data-id="${item.id}" ${gameState.gold < item.price ? 'disabled' : ''}>Buy</button>
                </div>
            `;
            itemElement.querySelector('.buy-btn').addEventListener('click', () => this.buyItem(item.id));
            shopItems.appendChild(itemElement);
        });
    },
    buyItem(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item || gameState.gold < item.price) return;
        gameState.gold -= item.price;
        const boughtItem = { ...item };
        delete boughtItem.price;
        gameState.inventory.push(boughtItem);
        this.renderShop();
        addLogEntry(`Purchased ${item.name}`, 'special');
    },
    show() {
        this.generateShopInventory();
        showSection('shop-screen');
        this.renderShop();
    }
};

const pauseSystem = {
    show() { showSection('pause-screen'); },
    hide() { showSection('battle-interface'); }
};

// ---- UTILITY & LOGIC FUNCTIONS --------------------------------------

// Add a message to the battle log
function addLogEntry(message, type) {
    const battleLog = document.getElementById('battle-log');
    if (battleLog) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        battleLog.appendChild(logEntry);
        battleLog.scrollTop = battleLog.scrollHeight;
    }
}

// Example: Render team select UI
function renderTeamSelect() {
    const availableUnits = document.getElementById('available-units');
    const playerTeamDiv = document.getElementById('player-team');
    if (!availableUnits || !playerTeamDiv || !gameState.playerFaction) return;
    availableUnits.innerHTML = '';
    playerTeamDiv.innerHTML = '';
    gameData.factions[gameState.playerFaction].forEach(unit => {
        if (!gameState.playerTeam.some(teamUnit => teamUnit.id === unit.id)) {
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-card';
            unitCard.innerHTML = `
                <h4>${unit.name} ${unit.sprite}</h4>
                <p>HP: ${unit.max_hp}</p>
                <p>Role: ${unit.role}</p>
            `;
            unitCard.addEventListener('click', () => {
                if (gameState.playerTeam.length < 4) {
                    gameState.playerTeam.push(structuredClone(unit));
                    document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
                    document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
                    renderTeamSelect();
                }
            });
            availableUnits.appendChild(unitCard);
        }
    });
    gameState.playerTeam.forEach((unit, index) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.innerHTML = `
            <h4>${unit.name} ${unit.sprite}</h4>
            <p>HP: ${unit.max_hp}</p>
            <p>Role: ${unit.role}</p>
        `;
        unitCard.addEventListener('click', () => {
            gameState.playerTeam.splice(index, 1);
            document.getElementById('team-count').textContent = `(${gameState.playerTeam.length}/4)`;
            document.getElementById('confirm-team-btn').disabled = gameState.playerTeam.length !== 4;
            renderTeamSelect();
        });
        playerTeamDiv.appendChild(unitCard);
    });
}

// Render terrain selection UI
function renderTerrainSelect() {
    const terrainOptions = document.getElementById('terrain-options');
    if (!terrainOptions) return;
    terrainOptions.innerHTML = '';
    Object.entries(gameData.terrains).forEach(([id, terrain]) => {
        const terrainCard = document.createElement('div');
        terrainCard.className = 'terrain-card';
        if (gameState.terrain === id) terrainCard.classList.add('selected');
        terrainCard.innerHTML = `
            <h3>${terrain.name} ${terrain.sprite}</h3>
            <p>${terrain.description}</p>
            <div class="terrain-effects">
                ${Object.entries(terrain.effects).map(([type, effect]) =>
                    `<p>${type}: ${effect}</p>`
                ).join('')}
            </div>
        `;
        terrainCard.addEventListener('click', () => {
            document.querySelectorAll('.terrain-card').forEach(card => card.classList.remove('selected'));
            terrainCard.classList.add('selected');
            gameState.terrain = id;
            document.getElementById('confirm-terrain-btn').disabled = false;
        });
        terrainOptions.appendChild(terrainCard);
    });
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) indicator.textContent = `Turn: ${gameState.currentTurn}`;
}

function resetGameState() {
    Object.assign(gameState, {
        playerFaction: null,
        playerTeam: [],
        enemyFaction: null,
        enemyTeam: [],
        terrain: null,
        currentTurn: 0,
        currentUnitIndex: 0,
        battleLog: [],
        selectedUnit: null,
        selectedAbility: null,
        targets: [],
        soundEnabled: true,
        battleEnded: false,
        gridUnits: {},
        selectedCell: null,
        movementMode: false,
        playerLevel: 1,
        xp: 0,
        gold: 100,
        inventory: [],
        equippedItems: {},
        gameStats: {
            battlesWon: 0,
            enemiesDefeated: 0,
            combosUsed: 0,
            abilityUseCount: {},
            selectedEquipmentSlot: null
        }
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.game-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function playSound(audioElement) {
    if (gameState.soundEnabled && audioElement) {
        try {
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise) playPromise.catch(() => {});
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

// Add more utility functions as necessary...
// (renderBattleGrid, checkBattleEnd, initializeBattle, etc.)

// ---- INITIALIZATION & EVENT WIRING -----------------------------------

function initializeButtonHandlers() {
    // Example: Attach handlers to buttons
    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        document.getElementById('sound-toggle').textContent =
            `Sound: ${gameState.soundEnabled ? 'ON' : 'OFF'}`;
        if (!gameState.soundEnabled) {
            document.getElementById('bgMusic')?.pause();
        } else {
            document.getElementById('bgMusic')?.play();
        }
    });
    document.getElementById('leave-shop-btn')?.addEventListener('click', () => {
        showSection('terrain-select');
    });
    // ...add handlers for team/terrain selection etc.
}

function initGame() {
    // Place all startup logic here, e.g. preloadAudio(), initial UI, etc.
    updateTurnIndicator();
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    initializeButtonHandlers();
    window.shopSystem = shopSystem;
    // Add any additional initialization/setup
});
