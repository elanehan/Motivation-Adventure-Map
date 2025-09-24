let sheetData = null; // This will hold { allTasks, stats }
let totalXP = 0;
let isConnected = false;

// --- Default XP & Level values ---
const DEFAULT_QUEST_XP = 10;
const DEFAULT_BOSS_XP = 25;
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850, 4500, 5200, 5950, 6750];
// --- Emoji constants for the Guild Board ---
const BOSS_EMOJI = "♖";
const REGION_EMOJIS = {
    "Forest": "🌳",
    "Mountains": "⛰️",
    "Ocean": "🌊",
    "Kingdom": "🏰"
};

function openSettings() {
    // Load current settings into the panel, if they exist
    if (sheetData && sheetData.config) {
        document.getElementById('inputAdventureName').value = sheetData.config.AdventureName || '';
        document.getElementById('inputRegion1Name').value = sheetData.config.Region1_Name || '';
        document.getElementById('inputRegion2Name').value = sheetData.config.Region2_Name || '';
        document.getElementById('inputRegion3Name').value = sheetData.config.Region3_Name || '';
        document.getElementById('inputRegion4Name').value = sheetData.config.Region4_Name || '';
    }
    document.getElementById('settingsPanel').style.display = 'flex';
}

function closeSettings() {
    document.getElementById('settingsPanel').style.display = 'none';
}

function saveSettings() {
    // Create a config object if it doesn't exist
    if (!sheetData) sheetData = { allTasks: [], stats: {}, config: {} };
    if (!sheetData.config) sheetData.config = {};

    // Read values from the form
    sheetData.config.AdventureName = document.getElementById('inputAdventureName').value;
    sheetData.config.Region1_Name = document.getElementById('inputRegion1Name').value;
    sheetData.config.Region2_Name = document.getElementById('inputRegion2Name').value;
    sheetData.config.Region3_Name = document.getElementById('inputRegion3Name').value;
    sheetData.config.Region4_Name = document.getElementById('inputRegion4Name').value;
    
    saveToLocal();
    closeSettings();
    loadDataFromSheet();
    showStatus('Settings saved!', 'connected', 3000);
}

function showStatus(message, type = 'loading', duration = null) {
    const status = document.getElementById('connectionStatus');
    if (!status) return; 
    status.style.display = 'block';
    status.textContent = message;
    status.className = `connection-status status-${type}`;
    if (duration) {
        setTimeout(() => {
            status.style.display = 'none';
        }, duration);
    }
}

function exportQuestsToCSV() {
    if (!sheetData || !sheetData.allTasks) {
        alert("No data to export!");
        return;
    }

    let csvContent = "# --- Your Adventure Map Backup ---\r\n";
    csvContent += "# This file contains all your current quests and stats.\r\n";
    csvContent += "## TASKS\r\n";
    csvContent += "Region,Task,Status,Is_Boss,ID,Description,CompletionDate\r\n";
    
    sheetData.allTasks.forEach(task => {
        // Handle potentially missing data and wrap the description in quotes
        const description = task.description ? `"${task.description.replace(/"/g, '""')}"` : '""';
        const completionDate = task.completionDate || '';
        csvContent += `${task.region},"${task.task}",${task.status},${task.isBoss ? 'TRUE' : 'FALSE'},${task.id},${description},${completionDate}\r\n`;
    });
    
    csvContent += "\r\n## STATS\r\n";
    csvContent += "Metric,Value\r\n";
    Object.keys(sheetData.stats).forEach(statKey => {
        const value = sheetData.stats[statKey] || '';
        csvContent += `${statKey},${value}\r\n`;
    });

    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-adventure-quests-backup.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        showStatus('❌ Failed to export data.', 'error');
    }
}

// --- Load built-in sample data ---
function loadSampleData() {
    const sampleCSV = generateSheetTemplate();
    try {
        // Parse sampleCSV directly for sample data
        const lines = sampleCSV.split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#') && !l.startsWith('##'));
        let allTasks = [];
        lines.forEach((line, idx) => {
            if (idx === 0 && line.toLowerCase().startsWith('region')) return;
            const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
            const [region, task, isBoss, description] = parts;
            if (region && task) {
                allTasks.push({
                    id: `task-${Math.random().toString(36).slice(2, 11)}`,
                    region,
                    task,
                    status: 'todo',
                    isBoss: (isBoss || '').toUpperCase() === 'TRUE',
                    description: (description || ''),
                    completionDate: null
                });
            }
        });
        sheetData = {
            allTasks,
            stats: { streak: 0, totalXP: 0, lastCompletedDate: null, currentWeekStartDate: null, monthlyRewardClaimed: false, lastMonthLevel: 0, lastMonthlyClaim: null }
        };
        sheetData.config = {
            AdventureName: "Adventure Map - Get Your Job Offer",
            Region1_Name: "Forest of Algorithms",
            Region2_Name: "Mountains of Systems",
            Region3_Name: "Ocean of Projects",
            Region4_Name: "Kingdom of Interviews"
        };
        isConnected = true;
        totalXP = sheetData.stats.totalXP || 0;
        saveToLocal();
        loadDataFromSheet();
        showStatus('✅ Sample data loaded from built-in template.', 'connected');
    } catch (err) {
        console.error("Failed to parse sample data:", err);
        showStatus('❌ Failed to load sample data.', 'error');
    }
}

// CSV upload and parsing
function handleCSVUpload(event) {
    const file = event.target.files[0];
    const importModeSelect = document.getElementById('importModeSelect');

    if (!file) return;

    const selectedMode = importModeSelect.value;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        
        if (selectedMode === 'overwrite') {
            if (!confirm("Are you sure? This will completely overwrite all current quests and stats with the backup file.")) {
                event.target.value = '';
                return;
            }
            try {
                const parsed = parseCSVToTemplateData(text);
                sheetData = parsed;
                totalXP = sheetData.stats.totalXP || 0;
                saveToLocal();
                loadDataFromSheet();
                showStatus('✅ Successfully restored from backup!', 'connected');
            } catch (err) {
                showStatus('❌ Failed to restore from backup: ' + err.message, 'error');
            }

        } else { // 'add' is the default mode
            try {
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('##'));
                let questsAdded = 0;

                lines.forEach((line, idx) => {
                    // Skip the header row if it exists
                    if (idx === 0 && line.toLowerCase().startsWith('region')) return; 

                    // Simple split for the new format
                    const [region, task, isBoss, description] = line.split(',');
                    if (region && task) {
                        const newTask = {
                            id: `task-${Math.random().toString(36).slice(2, 11)}`,
                            region: region.trim(),
                            task: task.trim().replace(/"/g, ''), // Remove quotes
                            status: 'todo', // Always add as 'todo' for new quests
                            isBoss: (isBoss || '').toUpperCase().trim() === 'TRUE',
                            description: (description || '').trim().replace(/"/g, ''),
                            completionDate: null 
                        };
                        sheetData.allTasks.push(newTask);
                        questsAdded++;
                    }
                });

                saveToLocal();
                loadDataFromSheet();
                showStatus(`✅ Imported ${questsAdded} new quests!`, 'connected', 4000);
            } catch (err) {
                showStatus('❌ Failed to import new quests: ' + err.message, 'error');
            }
        }
        
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Master CSV Parser 
function parseCSVToTemplateData(csvText) {
    const lines = csvText.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && (!l.startsWith('#') || l.startsWith('##'))); 
    
    const allTasks = [];
    const newStats = { streak: 0, totalXP: 0, lastCompletedDate: null, currentWeekStartDate: null, monthlyRewardClaimed: false, lastMonthLevel: 0, lastMonthlyClaim: null };
    let currentSection = "";

    for (const line of lines) {
        if (line.startsWith('##')) {
            currentSection = line.replace('##', '').trim().toUpperCase();
            continue;
        }

        if (currentSection === "TASKS") {
            if (line.startsWith('Region,')) continue;
            const [region, task, status, isBoss, id, description, completionDate] = line.split(',');
            if (region && task && status) {
                allTasks.push({
                    id: (id ? id.trim() : `task-${Math.random().toString(36).slice(2, 11)}`),
                    region: region.trim(),
                    task: task.trim(),
                    status: status.trim().toLowerCase(), // Use status from CSV for restore backup
                    isBoss: (isBoss || '').toUpperCase() === 'TRUE',
                    description: (description || '').trim().replace(/"/g, ''), // Remove quotes
                    completionDate: (completionDate || null)
                });
            }
        } else if (currentSection === "STATS") {
            if (line.startsWith('Metric,')) continue;
            const [metric, value] = line.split(',');
            
            if (metric && value !== undefined && newStats.hasOwnProperty(metric)) {
                const trimmedValue = value.trim();
                
                if (metric === 'lastCompletedDate' || metric === 'currentWeekStartDate' || metric === 'lastMonthlyClaim') {
                    newStats[metric] = trimmedValue || null;
                } else {
                    newStats[metric] = Number(trimmedValue) || 0;
                }
            }
        }
    }
    
    return { allTasks, stats: newStats };
}

// ---This is now the "brain" of the app ---
function loadDataFromSheet() {
    if (sheetData && sheetData.config) {
        document.getElementById('adventureName').textContent = sheetData.config.AdventureName || 'My Adventure Map';
        document.getElementById('forest-title').textContent = sheetData.config.Region1_Name || 'Forest';
        document.getElementById('mountains-title').textContent = sheetData.config.Region2_Name || 'Mountains';
        document.getElementById('ocean-title').textContent = sheetData.config.Region3_Name || 'Ocean';
        document.getElementById('kingdom-title').textContent = sheetData.config.Region4_Name || 'Kingdom';
    }
    if (!sheetData || !sheetData.allTasks) {
        console.error("sheetData is missing or malformed.", sheetData);
        return;
    }

    // 1. Initialize empty data structures for the UI
    const regionsData = {
        forest: { name: "Forest of Algorithms", quests: [], boss: null, progress: { current: 0, max: 0 } },
        mountains: { name: "Mountains of Systems", quests: [], boss: null, progress: { current: 0, max: 0 } },
        ocean: { name: "Ocean of Projects", quests: [], boss: null, progress: { current: 0, max: 0 } },
        kingdom: { name: "Kingdom of Interviews", quests: [], boss: null, progress: { current: 0, max: 0 } }
    };
    // Board now uses all lowercase keys to match 'task.status'
    const tasksData = { todo: [], inprogress: [], review: [], done: [] }; 
    
    let totalQuests = 0;
    let completedQuests = 0;
    let totalBosses = 0;
    let completedBosses = 0;

    // 2. Sort all tasks from the CSV into the UI structures
    sheetData.allTasks.forEach(task => {
        let regionKey = task.region.toLowerCase();
        if (regionKey === 'village') { // Convert old CSV data
            regionKey = 'ocean'; 
            task.region = 'Ocean'; 
        }
        const targetRegion = regionsData[regionKey];
        const questData = { 
            ...task, // Pass the full task object
            completed: task.status === 'done' 
        };

        // --- Calculate TOTAL stats (for the bottom stat cards) ---
        if (task.isBoss) {
            totalBosses++;
            if (task.status === 'done') completedBosses++;
        } else {
            totalQuests++;
            if (task.status === 'done') completedQuests++;
        }
        
        // Sort into Guild Board (todo, inprogress, done)
        if (tasksData[task.status]) {
            tasksData[task.status].push(task);
        }

        // ALSO sort into 2D Region Map (for the 0/2 progress)
        // This now includes 'inprogress' AND 'done' tasks
        if (targetRegion && task.status !== 'todo') {
            if (task.isBoss) {
                targetRegion.boss = questData;
            } else {
                targetRegion.quests.push(questData);
            }
        }
    });

    // 3. Calculate 'SPRINT' progress for each region
    Object.keys(regionsData).forEach(regionKey => {
        const region = regionsData[regionKey];
        
        const activeQuests = region.quests;
        const activeBoss = region.boss;

        let completedInSprint = 0;
        activeQuests.forEach(q => {
            if (q.completed) completedInSprint++;
        });

        let totalInSprint = activeQuests.length;

        region.progress.current = completedInSprint;
        region.progress.max = totalInSprint;
        
        // 4. Load this region's data onto the Map UI
        loadRegionQuests(regionKey, region);
        updateProgress(regionKey, region.progress); 
    });

    // 5. Load Guild Board UI
    loadGuildBoard(tasksData);

    // 6. Load Stats UI
    loadStats({ ...sheetData.stats, completedQuests, bossesDefeated: completedBosses });
    
    // 7. Load Leveling UI
    updateLevel(sheetData.stats.totalXP);

    const playerLevel = document.getElementById('playerLevel').textContent || 1;
    
    // 8. Check and update reward button states
    updateRewards(completedBosses, totalBosses);
    
    showStatus('✅ Data loaded successfully! Your adventure map is ready!', 'connected');
    ThreeMap.buildWorldFromQuests(sheetData.allTasks, playerLevel);
}

// --- To show 'inProgress' quests WITH a "Complete" button ---
function loadRegionQuests(regionKey, regionData) {
    const questsContainer = document.getElementById(`${regionKey}Quests`);
    const bossContainer = document.getElementById(`${regionKey}Boss`);

    questsContainer.innerHTML = '';
    const questsFragment = document.createDocumentFragment();
    
    // Handle Regular Quests
    regionData.quests.forEach(quest => {
        if (!quest.completed) {
            const questElement = document.createElement('div');
            questElement.className = 'quest-item';
            const span = document.createElement('span');
            span.textContent = quest.task;
            
            const button = document.createElement('button');
            button.className = 'quest-btn';
            button.textContent = `Complete (+${DEFAULT_QUEST_XP} XP)`;
            button.addEventListener('click', () => completeQuest(button, DEFAULT_QUEST_XP, quest));
            
            questElement.appendChild(span);
            questElement.appendChild(button);
            questsFragment.appendChild(questElement);
        }
    });
    questsContainer.appendChild(questsFragment);

    // Handle Boss Quests
    bossContainer.innerHTML = '';
    if (regionData.boss && !regionData.boss.completed) {
        const boss = regionData.boss;
        const bossSpan = document.createElement('span');
        bossSpan.textContent = boss.task;
        const bossButton = document.createElement('button');
        bossButton.className = 'quest-btn';
        bossButton.textContent = `Challenge Boss (+${DEFAULT_BOSS_XP} XP)`;
        bossButton.addEventListener('click', () => completeBoss(bossButton, DEFAULT_BOSS_XP, boss));

        bossContainer.appendChild(bossSpan);
        bossContainer.appendChild(bossButton);
    } else if (regionData.boss && regionData.boss.completed) {
        bossContainer.innerHTML = `<span>Boss Defeated! ✅</span>`;
    }
}

// --- To load 3-column board WITH all buttons ---
function loadGuildBoard(tasks) {
    const todoContainer = document.getElementById('todoTasks');
    const inProgressContainer = document.getElementById('inProgressTasks');
    const doneContainer = document.getElementById('doneTasks');
    
    if (!todoContainer || !inProgressContainer || !doneContainer) {
        console.error("Guild Board containers not found!");
        return;
    }

    todoContainer.innerHTML = '';
    inProgressContainer.innerHTML = '';
    doneContainer.innerHTML = '';

    // Load 'todo' - Show "Take" button
    if (tasks.todo.length > 0) {
        tasks.todo.forEach(task => todoContainer.appendChild(createTaskElement(task)));
    } else {
        todoContainer.innerHTML = `<div class="task-item">No tasks in backlog.</div>`;
    }
    
    // Load 'inprogress' - Show "Untake" & "Complete"
    if (tasks.inprogress.length > 0) {
        tasks.inprogress.forEach(task => inProgressContainer.appendChild(createTaskElement(task)));
    } else {
        inProgressContainer.innerHTML = `<div class="task-item">No tasks in progress.</div>`;
    }

    // Load 'done' - Show "Undo"
    if (tasks.done.length > 0) {
        tasks.done.forEach(task => doneContainer.appendChild(createTaskElement(task)));
    } else {
        doneContainer.innerHTML = `<div class="task-item">No completed tasks.</div>`;
    }
}

// --- This function now builds ALL buttons AND emojis ---
function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';

    // --- Create the new label with emojis ---
    let label = task.task; // Start with the task name
    
    if (task.isBoss) {
        label += ` ${BOSS_EMOJI}`; // Add boss emoji
    }
    if (REGION_EMOJIS[task.region]) {
        label += ` ${REGION_EMOJIS[task.region]}`; // Add region emoji
    }
    // --- End new label logic ---
    
    const span = document.createElement('span');
    span.textContent = label;
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => openQuestModal(task));
    taskElement.appendChild(span);

    // Create a wrapper for the buttons
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'quest-actions';

    // Add buttons based on status (This is the logic from 19:40:34 UTC)
    if (task.status === 'todo') {
        const button = document.createElement('button');
        button.className = 'quest-btn';
        button.textContent = 'Take';
        button.addEventListener('click', () => takeTask(task.id));
        actionsWrapper.appendChild(button);
        const removeButton = document.createElement('button');
        removeButton.className = 'quest-btn btn-remove'; // New CSS class
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => removeTask(task.id));
        actionsWrapper.appendChild(removeButton);

    } else if (task.status === 'inprogress') {
        const untakeButton = document.createElement('button');
        untakeButton.className = 'quest-btn btn-untake';
        untakeButton.textContent = 'Untake';
        untakeButton.addEventListener('click', () => untakeTask(task.id));
        actionsWrapper.appendChild(untakeButton);
        
        // NO "Complete" button here, it's on the Map
        
    } else if (task.status === 'done') {
        const undoButton = document.createElement('button');
        undoButton.className = 'quest-btn btn-undo';
        undoButton.textContent = 'Undo';
        undoButton.addEventListener('click', () => undoTask(task.id));
        actionsWrapper.appendChild(undoButton);
    }
    
    taskElement.appendChild(actionsWrapper);
    return taskElement;
}

let activeQuestId = null; // A global variable to track which quest is being edited

function openQuestModal(task) {
    activeQuestId = task.id; // Store the ID of the quest we are editing
    console.log("Opening modal for task:", task);
    
    // 1. Find all the form elements
    const titleInput = document.getElementById('questTitleInput');
    const regionSelect = document.getElementById('questRegionSelect');
    const logTextarea = document.getElementById('questLogTextarea');
    const isBossInput = document.getElementById('questIsBossInput');

    // 2. Fill the form with the task's data
    titleInput.value = task.task || '';
    regionSelect.value = task.region || 'Forest';
    logTextarea.value = task.description || '';
    isBossInput.checked = task.isBoss || false;
    
    document.getElementById('questModal').style.display = 'flex';
}

function closeQuestModal() {
    document.getElementById('questModal').style.display = 'none';
    activeQuestId = null; // Clear the active quest ID
}

function saveQuestChanges() {
    console.log("Saving changes for quest ID:", activeQuestId);
    // We'll build the save logic in the next step
    closeQuestModal();
}

function duplicateQuest() {
    if (!activeQuestId) return;
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === activeQuestId);
    if (taskIndex === -1) return;

    const originalTask = sheetData.allTasks[taskIndex];

    // 1. Create the fresh copy
    const newTask = {
        ...originalTask, // Copy region, task name, isBoss, description
        id: `task-${Math.random().toString(36).slice(2, 11)}`,
        status: 'todo', // Always starts as 'todo'
        completionDate: null, // New copy has no completion date
        shouldDuplicate: false // Reset this flag on the new copy
    };
    
    // 2. Add it to the list
    sheetData.allTasks.push(newTask);
    
    // 3. Save and refresh
    saveToLocal();
    loadDataFromSheet();
    closeQuestModal();
    showStatus(`Quest '${originalTask.task}' duplicated.`, 'connected', 3000);
}


function toggleRepeatable(taskId) {
    if (!sheetData || !sheetData.allTasks) return;
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = sheetData.allTasks[taskIndex];
    // Toggle the boolean value
    task.shouldDuplicate = !task.shouldDuplicate;

    saveToLocal();
    loadDataFromSheet(); // Refresh the UI to update the button's text
}

function loadStats(stats) {
    document.getElementById('streak').textContent = stats.streak || 0;
    document.getElementById('completedQuests').textContent = stats.completedQuests || 0;
    document.getElementById('bossesDefeated').textContent = stats.bossesDefeated || 0;
}

// --- Leveling System UI ---
function updateLevel(xp) {
    let newLevel = 1;
    let nextLevelXP = LEVEL_THRESHOLDS[1];
    let playerLevelEl = document.getElementById('playerLevel');
    
    if (!playerLevelEl) return; // Safety check

    // Find current level
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            newLevel = i + 1;
            nextLevelXP = (i + 1 < LEVEL_THRESHOLDS.length) ? LEVEL_THRESHOLDS[i+1] : LEVEL_THRESHOLDS[i];
            break;
        }
    }
    
    // Check for level up
    const oldLevel = playerLevelEl.dataset.level || 1;
    if (newLevel > oldLevel) {
        showCelebration(0, false, `LEVEL UP! You are now Level ${newLevel}!`);
        playerLevelEl.dataset.level = newLevel;
    }
    
    playerLevelEl.textContent = newLevel;
    document.getElementById('currentXP').textContent = xp; // Show total XP
    document.getElementById('nextLevelXP').textContent = nextLevelXP;
}

function updateProgress(regionKey, progress) {
    const max = progress.max || 0; 
    const percentage = (max === 0) ? 0 : (progress.current / max) * 100;
    
    const progressEl = document.getElementById(`${regionKey}Progress`);
    const countEl = document.getElementById(`${regionKey}Count`);
    
    if (progressEl) progressEl.style.width = percentage + '%';
    // This now shows the sprint progress, e.g., "1/2"
    if (countEl) countEl.textContent = `${progress.current}/${progress.max}`;
}

// --- Function to move a task from 'todo' to 'inProgress' ---
function takeTask(taskId) {
    if (!sheetData || !sheetData.allTasks) return;
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    sheetData.allTasks[taskIndex].status = 'inprogress';
    saveToLocal();
    loadDataFromSheet();
    showStatus('Quest accepted! It has been added to your Adventure Map.', 'connected');
}

function completeTask(button, xp, task, isBoss) {
    // 1. Find the task in the master list
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === task.id);
    if (taskIndex === -1) {
        console.error("Could not find task to complete:", task);
        return;
    }

    // 2. Update its status
    sheetData.allTasks[taskIndex].status = 'done';

    // Record the completion date (YYYY-MM-DD) on the task itself
    sheetData.allTasks[taskIndex].completionDate = new Date().toISOString().split('T')[0];
    
    // 3. Update Stats
    totalXP += xp;
    sheetData.stats.totalXP = totalXP;
    
    // --- New Streak Logic ---
    const today = new Date().toISOString().split('T')[0];
    if (sheetData.stats.lastCompletedDate !== today) {
        // It's a new day, increment streak.
        // 'checkDateBasedResets' already reset it to 0 if we missed a day.
        sheetData.stats.streak++;
        sheetData.stats.lastCompletedDate = today;
    }
    // --- NEW: Daily Reward Tracking Logic ---
    if (!sheetData.stats.dailyCompletions || sheetData.stats.dailyCompletions.date !== today) {
        // It's a new day (or first time), reset the daily tracker
        sheetData.stats.dailyCompletions = { date: today, regions: [] };
    }
    
    // Add the region (if it's not already there)
    const taskRegion = task.region; // e.g., "Forest"
    if (!sheetData.stats.dailyCompletions.regions.includes(taskRegion)) {
        sheetData.stats.dailyCompletions.regions.push(taskRegion);
    }
    
    // 4. Update UI (This is the only change from the old version)
    if (button) { // Check if a button was passed
        button.textContent = 'Completed! ✅';
        button.disabled = true;
        button.parentElement.classList.add('completed');
    }
    ThreeMap.updateQuestStatus(task.id, 'done');
        
    // 5. Show celebration
    showCelebration(xp, isBoss, isBoss ? `BOSS DEFEATED! +${xp} XP!` : `Quest Complete! +${xp} XP!`);
    
    // 6. Reload all data to reflect the change
    // (This moves the item from 'inProgress' to 'done' on the board)
    loadDataFromSheet();

    // 7. Save to local storage
    saveToLocal();
}

function completeQuest(button, xp, quest) {
    completeTask(button, xp, quest, false); 
}

function completeBoss(button, xp, boss) {
    completeTask(button, xp, boss, true); 
}

// --- Function to move a task from 'inProgress' back to 'todo' ---
function untakeTask(taskId) {
    if (!sheetData || !sheetData.allTasks) return;
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    sheetData.allTasks[taskIndex].status = 'todo';
    ThreeMap.updateQuestStatus(taskId, 'todo');
    saveToLocal();
    loadDataFromSheet();
    showStatus('Quest returned to backlog.', 'connected');
}
function removeTask(taskId) {
    // Add a confirmation pop-up
    if (!confirm("Are you sure you want to permanently remove this quest?")) {
        return; // Stop if the user clicks "Cancel"
    }
    
    if (!sheetData || !sheetData.allTasks) return;
    
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    // 1. Remove the task from the master list
    sheetData.allTasks.splice(taskIndex, 1);
    
    // 2. Save the new, shorter list
    saveToLocal();
    
    // 3. Refresh the entire UI (this will also rebuild the 3D map)
    loadDataFromSheet();
    
    showStatus('Quest removed.', 'connected', 5000);
}

// --- Function to move a task from 'done' back to 'inProgress' ---
function undoTask(taskId) {
    if (!sheetData || !sheetData.allTasks) return;
    const taskIndex = sheetData.allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    const task = sheetData.allTasks[taskIndex];
    task.status = 'inprogress';
    ThreeMap.updateQuestStatus(task.id, 'inprogress');

    // SUBTRACT XP, but never go below 0
    const xpToSubtract = task.isBoss ? DEFAULT_BOSS_XP : DEFAULT_QUEST_XP;
    totalXP = Math.max(0, totalXP - xpToSubtract);
    sheetData.stats.totalXP = totalXP;
    updateLevel(totalXP);

    saveToLocal();
    loadDataFromSheet();
    showStatus('Task set to "In Progress" again.', 'connected');
}

// --- Celebration function ---
function showCelebration(xp, isBoss = false, customMessage = "") {
    let message = customMessage;
    
    if (!message) {
        const messages = isBoss ? [
            `🏆 BOSS DEFEATED! +${xp} XP! Epic victory!`,
            `👑 You are the champion! +${xp} XP earned!`,
        ] : [
            `Great job! +${xp} XP earned! 🎉`,
            `Quest completed! The guild is proud! ⭐`,
        ];
        message = messages[Math.floor(Math.random() * messages.length)];
    }
    
    const popup = document.createElement('div');
    popup.className = isBoss ? 'celebration-popup celebration-boss' : 'celebration-popup celebration-quest';
    popup.textContent = message;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.remove();
    }, isBoss ? 3000 : 2000);
}

// --- To save the new sheetData structure ---
function saveToLocal() {
    if (!sheetData) return;
    try {
        const payload = JSON.stringify(sheetData); // Saves { allTasks, stats }
        localStorage.setItem('jobSearchGameData', payload);
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl && !statusEl.textContent.includes('saving')) {
             showStatus('✅ Progress saved locally.', 'connected');
        }
    } catch (e) {
        console.error('Local save error:', e);
        showStatus('❌ Failed to save locally.', 'error');
    }
}

// --- To load the new sheetData structure ---
async function refreshData() {
    try {
        const raw = localStorage.getItem('jobSearchGameData');
        if (raw) {
            sheetData = JSON.parse(raw); // { allTasks, stats }
            isConnected = true;
            totalXP = sheetData.stats.totalXP || 0;
            showStatus('🔄 Refreshing data from local storage...', 'loading');
            setTimeout(() => {
                loadDataFromSheet();
                showStatus('✅ Data refreshed from local storage!', 'connected');
            }, 300);
        } else {
            showStatus('ℹ️ No saved data found. Load sample data.', 'error');
        }
    } catch (e) {
        console.error('Refresh error:', e);
        showStatus('❌ Failed to refresh from local storage.', 'error');
    }
}

// --- Reward Functions ---
function updateRewards(completedBosses, totalBosses) {
    const dailyBtn = document.getElementById('claimDailyBtn');
    const weeklyBtn = document.getElementById('claimWeeklyBtn');
    const monthlyBtn = document.getElementById('claimMonthlyBtn');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Enable daily button if 1 quest from all 4 regions is done *today*
    let dailyGoalMet = false;
    if (sheetData.stats.dailyCompletions && sheetData.stats.dailyCompletions.date === today) {
        if (sheetData.stats.dailyCompletions.regions.length >= 4) {
            dailyGoalMet = true;
        }
    }
    
    // 2. Check if it's already been claimed today
    const alreadyClaimed = (sheetData.stats.dailyRewardClaimed === today);

    // 3. Disable button if goal is NOT met OR if it's already claimed
    dailyBtn.disabled = !dailyGoalMet || alreadyClaimed;

    // Enable weekly button if all bosses are done
    if (totalBosses > 0 && completedBosses === totalBosses) {
        weeklyBtn.disabled = false;
    } else {
        weeklyBtn.disabled = true;
    }
    
    // Enable monthly button if player is level 10+
    const playerLevel = document.getElementById('playerLevel').textContent;
    const currentLevel = Number(playerLevel);

    // Get the level you were at when the month started
    const lastMonthLevel = sheetData.stats.lastMonthLevel || 0;
    // Check if you've gained 5 levels
    const hasGained5Levels = (currentLevel - lastMonthLevel) >= 5;
    // Check if you've already claimed this month
    const canClaimMonthly = sheetData.stats.monthlyRewardClaimed === false;

    // You can claim if you've gained 5 levels AND you haven't claimed this month
    monthlyBtn.disabled = !(hasGained5Levels && canClaimMonthly);
}

function checkDateBasedResets() {
    if (!sheetData || !sheetData.stats) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Standardize to midnight

    // --- 1. DAILY STREAK RESET ---
    const lastCompleted = new Date(sheetData.stats.lastCompletedDate || 0);
    lastCompleted.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (lastCompleted.getTime() !== yesterday.getTime() && lastCompleted.getTime() !== today.getTime()) {
        sheetData.stats.streak = 0;
    }
    
    // --- 2. WEEKLY BOSS RESET ---
    if (!sheetData.stats.currentWeekStartDate) {
        // If the week has *never* been set, set it to today to start the clock.
        sheetData.stats.currentWeekStartDate = today.toISOString();
    }

    let weekStartDate = new Date(sheetData.stats.currentWeekStartDate);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const daysDifference = (today - weekStartDate) / (1000 * 60 * 60 * 24);
    if (daysDifference >= 7) {
        resetWeeklyBosses(); 
        sheetData.stats.currentWeekStartDate = today.toISOString();
        showStatus('A new week has begun! Boss quests have been reset.', 'connected', 4000);
    }
    
    // --- 3. MONTHLY REWARD RESET ---
    const lastClaim = new Date(sheetData.stats.lastMonthlyClaim || 0);
    if (today.getMonth() !== lastClaim.getMonth() || today.getFullYear() !== lastClaim.getFullYear()) {
        // It's a new month!
        const playerLevelEl = document.getElementById('playerLevel');
        
        // Only update the 'lastMonthLevel' *if* a claim has been made before.
        // Otherwise, it stays 0, so the user can get their first reward.
        if (sheetData.stats.lastMonthlyClaim) { 
            const currentLevel = Number(playerLevelEl.textContent || 1);
            sheetData.stats.lastMonthLevel = currentLevel; 
        }

        sheetData.stats.monthlyRewardClaimed = false; // Reset the flag
    }
}

function resetWeeklyBosses() {
    if (!sheetData || !sheetData.allTasks) return;
    
    let bossesReset = 0;
    
    // We must loop BACKWARDS when deleting items from an array
    for (let i = sheetData.allTasks.length - 1; i >= 0; i--) {
        const task = sheetData.allTasks[i];

        if (task.isBoss) {
            if (task.status === 'done') {
                // If it's "Done", remove it to make way for a new one
                sheetData.allTasks.splice(i, 1);
                bossesReset++;
            } else if (task.status === 'inprogress') {
                // If it's "In Progress", reset it to "To Do"
                task.status = 'todo';
                bossesReset++;
            }
            // If it's 'todo' already, do nothing
        }
    }
    
    if (bossesReset > 0) {
        console.log(`Reset/Removed ${bossesReset} weekly bosses.`);
    }
}

function claimDailyReward() {
    const xp = 19;
    totalXP = Math.max(0, totalXP + xp);
    sheetData.stats.totalXP = totalXP;
    
    // Set a "claimed" flag for today
    const today = new Date().toISOString().split('T')[0];
    sheetData.stats.dailyRewardClaimed = today;
    
    updateLevel(totalXP);
    saveToLocal();
    showCelebration(xp, false, "Daily reward claimed! +19 XP 🧪");
    document.getElementById('claimDailyBtn').disabled = true;
}

function claimWeeklyReward() {
    const xp = 100;
    totalXP = Math.max(0, totalXP + xp);
    sheetData.stats.totalXP = totalXP;
    updateLevel(totalXP);
    saveToLocal();
    showCelebration(xp, true, "Weekly Chest claimed! +100 XP 👑");
    document.getElementById('claimWeeklyBtn').disabled = true;
}

function claimMonthlyReward() {
    // 1. Set the flag to true
    sheetData.stats.monthlyRewardClaimed = true;
    // 2. Set the *date* of the claim
    sheetData.stats.lastMonthlyClaim = new Date().toISOString();
    // 3. Save the changes
    saveToLocal();
    // 4. Disable the button
    document.getElementById('claimMonthlyBtn').disabled = true;

    // This part is the same
    showCelebration(0, true, "Go celebrate your victory! You've earned it! 📜");
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    const addBtn = document.getElementById('addQuestBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addNewQuest);
    }
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
    
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettings);
    }

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    const closeQuestModalBtn = document.getElementById('closeQuestModalBtn');
    if (closeQuestModalBtn) {
        closeQuestModalBtn.addEventListener('click', closeQuestModal);
    }
    const saveQuestBtn = document.getElementById('saveQuestBtn');
    if (saveQuestBtn) {
        saveQuestBtn.addEventListener('click', saveQuestChanges);
    }
    const duplicateQuestBtn = document.getElementById('duplicateQuestBtn');
    if (duplicateQuestBtn) {
        duplicateQuestBtn.addEventListener('click', duplicateQuest);
    }
    
    // Auto-load from local storage if available
    try {
        const raw = localStorage.getItem('jobSearchGameData');
        if (raw) {
            sheetData = JSON.parse(raw);
            isConnected = true;
            if (sheetData.stats) {
                totalXP = sheetData.stats.totalXP || 0;
            }
            // 1. Check all dates and apply resets
            checkDateBasedResets(); 
            // 2. Save any changes (like resets)
            saveToLocal(); 
            // 3. Init the 3D map
            ThreeMap.init();
            // 4. Load the UI (which now has the reset data)
            loadDataFromSheet(); 
            // Run the test AND initialize the map before returning
            if (!document.getElementById('connectionStatus').textContent.includes('reset')) {
                showStatus('✅ Loaded your last session from local storage.', 'connected', 5000);
            }
            
            return; // Now it's safe to return
        }
    } catch (e) {
        console.error("Failed to load from local storage:", e);
        localStorage.removeItem('jobSearchGameData'); // Clear corrupted data
    }

    // This code now only runs if no saved data was found (first-time run)
    console.log("Testing for THREE library (no data):", THREE); 
    ThreeMap.init(); // Initialize the 3D Map

    // Show initial instructions
    showStatus('👆 Download the CSV template, then upload it to get started.', 'connected', 5000);
});

// --- NEW: Generates the simplified, master task list CSV ---
function generateSheetTemplate() {
    return `# --- MASTER QUEST LIST ---
# This is the single source of truth for all quests and bosses.
# Region: Forest, Mountains, Ocean, Kingdom
# Is_Boss: TRUE or FALSE
#
## TASKS
Region,Task,Is_Boss,Description
Forest,Solve 2 Easy LeetCode Problems,FALSE,""
Forest,Practice Binary Search Problems,FALSE,""
Forest,Timed Medium Problem,TRUE,""
Mountains,Study Load Balancing Concepts,FALSE,""
Mountains,Design URL Shortener System,TRUE,""
Ocean,Refactor Code & Add Comments,FALSE,""
Ocean,Complete Resume Deep Dive Session,TRUE,""
Kingdom,Practice 'Tell me about yourself',FALSE,""
Kingdom,30-Min Mock Interview,TRUE,"Mock interview with Jane Doe."
`;
}

function addNewQuest() {
    const input = document.getElementById('newQuestInput');
    const regionSelect = document.getElementById('newQuestRegion');
    const isBossInput = document.getElementById('newQuestIsBoss');
    
    const taskName = input.value.trim();
    const regionName = regionSelect.value;
    const isBoss = isBossInput.checked;
    
    if (taskName === "") {
        alert("Please enter a quest name.");
        return;
    }
    
    // 1. Create a new task object
    const newTask = {
        id: `task-${Math.random().toString(36).slice(2, 11)}`,
        region: regionName,
        task: taskName,
        status: 'todo', // New quests always start as 'todo'
        isBoss: isBoss 
    };
    
    // 2. Add it to our main data
    sheetData.allTasks.push(newTask);
    
    // 3. Save to localStorage
    saveToLocal();
    
    // 4. Refresh the entire UI
    loadDataFromSheet();
    
    // 5. Clear the input field
    input.value = "";
    isBossInput.checked = false;
}

