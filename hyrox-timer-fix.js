/**
 * HYROX TIMER FIX
 * 
 * Ce script corrige l'affichage des timers FOR TIME et AMRAP
 * pour afficher TOUS les exercices au lieu d'une seule ligne.
 * 
 * INSTALLATION :
 * Ajouter cette ligne AVANT la balise </body> dans index.html :
 * <script src="hyrox-timer-fix.js"></script>
 */

(function() {
    console.log('🔧 Hyrox Timer Fix chargé');
    
    // Attendre que le DOM soit chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        // Surcharger la fonction startHyroxSession
        const originalStartHyroxSession = window.startHyroxSession;
        
        window.startHyroxSession = function(weekNum) {
            const option = window.selectedOption[weekNum];
            if (!option) return;
            
            const hyrox = window.trainingData.hyrox[weekNum - 1];
            const optionData = option === 'A' ? hyrox.option_a : hyrox.option_b;
            
            // Parse format to determine timer type
            const format = optionData.format.toLowerCase();
            let config = {
                weekNum: weekNum,
                option: option,
                type: 'simple',
                totalRounds: 0,
                minutesPerRound: 0,
                exercises: [],
                restTime: 0
            };
            
            // Detect EMOM
            if (format.includes('emom')) {
                const match = format.match(/(\d+)min.*?(\d+)\s*rounds.*?(\d+)min/i);
                if (match) {
                    const totalMin = parseInt(match[1]);
                    const rounds = parseInt(match[2]);
                    const minPerRound = parseInt(match[3]);
                    
                    config.type = 'emom';
                    config.totalRounds = rounds;
                    config.minutesPerRound = minPerRound;
                    
                    // Parse exercises from content
                    const lines = optionData.contenu.split('\n');
                    lines.forEach(line => {
                        if (line.includes('Min') && line.includes(':')) {
                            const parts = line.split(':');
                            if (parts.length > 1) {
                                config.exercises.push(parts[1].trim());
                            }
                        }
                    });
                }
            }
            // Detect FOR TIME - CORRECTION ICI
            else if (format.includes('for time') || format.includes('rounds')) {
                const match = format.match(/(\d+)\s*rounds/i);
                if (match) {
                    config.type = 'fortime';
                    config.totalRounds = parseInt(match[1]);
                    
                    // Check for rest time
                    const restMatch = optionData.contenu.match(/(\d+)min(\d+)?\s*repos/i);
                    if (restMatch) {
                        const restMin = parseInt(restMatch[1]);
                        const restSec = restMatch[2] ? parseInt(restMatch[2]) : 0;
                        config.restTime = (restMin * 60 + restSec) * 1000;
                    }
                    
                    // ✅ CORRECTION : Parser TOUTES les lignes (pas juste la première)
                    const lines = optionData.contenu.split('\n');
                    config.exercises = lines
                        .filter(line => line.trim() && !line.toLowerCase().includes('repos'))
                        .map(line => line.trim());
                }
            }
            // Detect AMRAP - CORRECTION ICI
            else if (format.includes('amrap')) {
                config.type = 'amrap';
                const match = format.match(/(\d+)min/i);
                if (match) {
                    config.totalTime = parseInt(match[1]) * 60 * 1000;
                }
                
                // ✅ CORRECTION : Parser les exercices de l'AMRAP
                const lines = optionData.contenu.split('\n');
                config.exercises = lines
                    .filter(line => line.trim())
                    .map(line => line.trim());
            }
            
            window.openTimer(config);
        };
        
        // Surcharger la fonction updateTimerDisplay
        const originalUpdateTimerDisplay = window.updateTimerDisplay;
        
        window.updateTimerDisplay = function() {
            const timeDisplay = document.getElementById('timerTime');
            timeDisplay.textContent = window.formatTime(window.timerElapsed);
            
            if (window.currentTimerConfig.type === 'emom') {
                const totalSeconds = Math.floor(window.timerElapsed / 1000);
                const currentMinInRound = totalSeconds % (window.currentTimerConfig.minutesPerRound * 60);
                const newMinute = Math.floor(currentMinInRound / 60);
                const newRound = Math.floor(totalSeconds / (window.currentTimerConfig.minutesPerRound * 60));
                
                if (newRound !== window.currentRound && newRound < window.currentTimerConfig.totalRounds) {
                    window.currentRound = newRound;
                    window.currentMinute = 0;
                    window.playBellAndVibrate();
                } else if (newMinute !== window.currentMinute) {
                    window.currentMinute = newMinute;
                    window.playBellAndVibrate();
                }
                
                document.getElementById('timerRound').textContent = `Round ${window.currentRound + 1}/${window.currentTimerConfig.totalRounds}`;
                document.getElementById('timerMinute').textContent = `Minute ${window.currentMinute + 1}/${window.currentTimerConfig.minutesPerRound}`;
                
                const exerciseIdx = window.currentMinute % window.currentTimerConfig.exercises.length;
                document.getElementById('timerExercise').textContent = window.currentTimerConfig.exercises[exerciseIdx] || '';
                document.getElementById('timerDetails').textContent = '';
            } 
            // ✅ CORRECTION FOR TIME : Afficher tous les exercices + repos
            else if (window.currentTimerConfig.type === 'fortime') {
                document.getElementById('timerRound').textContent = `Round ${window.currentRound + 1}/${window.currentTimerConfig.totalRounds}`;
                document.getElementById('timerMinute').textContent = '';
                
                // Afficher TOUS les exercices séparés par des bullets
                const allExercises = window.currentTimerConfig.exercises.join(' • ');
                document.getElementById('timerExercise').textContent = allExercises || 'FOR TIME';
                
                // Afficher le temps de repos si défini
                if (window.currentTimerConfig.restTime > 0) {
                    const restMin = Math.floor(window.currentTimerConfig.restTime / 60000);
                    const restSec = Math.floor((window.currentTimerConfig.restTime % 60000) / 1000);
                    document.getElementById('timerDetails').textContent = `Repos: ${restMin}:${restSec.toString().padStart(2, '0')} entre rounds`;
                } else {
                    document.getElementById('timerDetails').textContent = '';
                }
            }
            // ✅ CORRECTION AMRAP : Afficher tous les exercices + temps restant
            else if (window.currentTimerConfig.type === 'amrap') {
                document.getElementById('timerRound').textContent = '';
                const remainingMs = window.currentTimerConfig.totalTime - window.timerElapsed;
                const remainingMin = Math.floor(remainingMs / 60000);
                const remainingSec = Math.floor((remainingMs % 60000) / 1000);
                document.getElementById('timerMinute').textContent = `Temps restant: ${remainingMin}:${remainingSec.toString().padStart(2, '0')}`;
                
                // Afficher tous les exercices de l'AMRAP
                const allExercises = window.currentTimerConfig.exercises.join(' • ');
                document.getElementById('timerExercise').textContent = allExercises || 'AMRAP';
                document.getElementById('timerDetails').textContent = 'Faire le maximum de tours';
            }
            else {
                document.getElementById('timerRound').textContent = '';
                document.getElementById('timerMinute').textContent = '';
                document.getElementById('timerExercise').textContent = 'Chrono en cours';
                document.getElementById('timerDetails').textContent = '';
            }
        };
        
        console.log('✅ Corrections timer appliquées');
    }
})();
