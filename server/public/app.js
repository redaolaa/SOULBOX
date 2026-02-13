const API_BASE = '/api/exercises';

let allExercises = [];
let filteredExercises = [];
let currentIndex = 0;

// DOM elements
const exerciseCard = document.getElementById('exerciseCard');
const currentIndexSpan = document.getElementById('currentIndex');
const totalExercisesSpan = document.getElementById('totalExercises');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const markUsedBtn = document.getElementById('markUsedBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Filter elements
const filterBoxing = document.getElementById('filterBoxing');
const filterKickboxing = document.getElementById('filterKickboxing');
const filterStation = document.getElementById('filterStation');
const filterFocus = document.getElementById('filterFocus');

// Initialize
async function init() {
    await loadExercises();
    setupEventListeners();
    applyFilters();
}

// Load exercises from API
async function loadExercises() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to load exercises');
        allExercises = await response.json();
        applyFilters();
    } catch (error) {
        console.error('Error loading exercises:', error);
        exerciseCard.innerHTML = '<div class="empty-state">Error loading exercises. Please check your connection.</div>';
    }
}

// Apply filters
function applyFilters() {
    filteredExercises = allExercises.filter(exercise => {
        // Day type filter
        const dayTypeMatch = 
            (filterBoxing.checked && exercise.dayType === 'Boxing') ||
            (filterKickboxing.checked && exercise.dayType === 'Kickboxing');
        
        if (!dayTypeMatch) return false;

        // Station filter
        if (filterStation.value !== 'all' && exercise.station !== parseInt(filterStation.value)) {
            return false;
        }

        // Focus filter
        if (filterFocus.value !== 'all' && exercise.focus !== filterFocus.value) {
            return false;
        }

        return true;
    });

    currentIndex = 0;
    displayCurrentExercise();
}

// Display current exercise
function displayCurrentExercise() {
    if (filteredExercises.length === 0) {
        exerciseCard.innerHTML = '<div class="empty-state">No exercises match your filters.</div>';
        totalExercisesSpan.textContent = '0';
        currentIndexSpan.textContent = '0';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        markUsedBtn.disabled = true;
        return;
    }

    const exercise = filteredExercises[currentIndex];
    
    const lastUsedDate = exercise.lastUsed 
        ? new Date(exercise.lastUsed).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })
        : 'Never';

    exerciseCard.innerHTML = `
        <div class="exercise-name">${exercise.name || 'Unnamed Exercise'}</div>
        <div class="exercise-details">
            <div class="detail-item">
                <div class="detail-label">Station</div>
                <div class="detail-value">${exercise.station || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Focus</div>
                <div class="detail-value">${exercise.focus || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Day Type</div>
                <div class="detail-value">${exercise.dayType || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Type</div>
                <div class="detail-value">${exercise.isStatic ? 'Non-stop Sparring' : 'Regular'}</div>
            </div>
        </div>
        <div class="last-used">Last used: ${lastUsedDate}</div>
    `;

    currentIndexSpan.textContent = currentIndex + 1;
    totalExercisesSpan.textContent = filteredExercises.length;
    
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === filteredExercises.length - 1;
    markUsedBtn.disabled = false;
}

// Navigate to previous exercise
function goToPrevious() {
    if (currentIndex > 0) {
        currentIndex--;
        displayCurrentExercise();
    }
}

// Navigate to next exercise
function goToNext() {
    if (currentIndex < filteredExercises.length - 1) {
        currentIndex++;
        displayCurrentExercise();
    }
}

// Mark current exercise as used
async function markAsUsed() {
    const exercise = filteredExercises[currentIndex];
    if (!exercise || !exercise._id) return;

    try {
        const response = await fetch(`${API_BASE}/${exercise._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lastUsed: new Date() }),
        });

        if (!response.ok) throw new Error('Failed to update exercise');

        // Reload exercises to get updated data
        await loadExercises();
    } catch (error) {
        console.error('Error marking exercise as used:', error);
        alert('Failed to mark exercise as used. Please try again.');
    }
}

// Setup event listeners
function setupEventListeners() {
    prevBtn.addEventListener('click', goToPrevious);
    nextBtn.addEventListener('click', goToNext);
    markUsedBtn.addEventListener('click', markAsUsed);
    refreshBtn.addEventListener('click', loadExercises);

    // Filter listeners
    filterBoxing.addEventListener('change', applyFilters);
    filterKickboxing.addEventListener('change', applyFilters);
    filterStation.addEventListener('change', applyFilters);
    filterFocus.addEventListener('change', applyFilters);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') goToPrevious();
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            markAsUsed();
        }
    });
}

// Start the app
init();
