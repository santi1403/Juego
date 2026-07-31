/**
 * BURGER MASTER PRO - Minijuego de Reparto en Moto (Ultimate Edition Engine)
 * Motor arcade 2D basado en HTML5 Canvas con Web Audio API, partículas, bonus y físicas fluidas.
 */

const canvas = document.getElementById('roadCanvas');
const ctx = canvas.getContext('2d');

// --- VARIABLES DEL JUEGO Y ESTADO ---
let score = 0;
let level = 1;
let isGameOver = false;
let isVictory = false;
let isPaused = false;
let highScore = localStorage.getItem('motoHighScore') || 0;

// Ajuste de dificultad según el modo elegido en el menú principal
const savedDifficulty = localStorage.getItem('burgerDifficulty') || 'normal';
let gameSpeed = savedDifficulty === 'extreme' ? 6.5 : (savedDifficulty === 'hard' ? 5.5 : 4.5);

// Actualizar HUD de Récord Inicial
document.getElementById('high-score-hud').innerText = highScore;

// Estado del Jugador (Moto 🏍️)
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 110,
    width: 48,
    height: 76,
    speed: 7.5
};

// Colecciones de elementos dinámicos
let obstacles = [];
let collectibles = [];
let roadLines = [];
let particles = [];
let cityBuildings = [];

// Inicializar líneas de la carretera
for (let i = 0; i < 12; i++) {
    roadLines.push({
        y: i * 70 - 35,
        height: 35
    });
}

// Inicializar edificios laterales decorativos en la banqueta
for (let i = 0; i < 6; i++) {
    cityBuildings.push({
        y: i * 140 - 70,
        leftHeight: 90 + Math.random() * 50,
        rightHeight: 90 + Math.random() * 50
    });
}

// --- WEB AUDIO API (Efectos de Sonido Sintetizados Sin Archivos Externos) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'coin') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'victory') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

// --- CONTROL DE TECLADO Y TÁCTIL ---
const keys = {};
window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
        keys[e.key] = true;
    }
    if (e.key === 'Escape') {
        togglePause();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Soporte para botones táctiles en móviles
const setupTouchButton = (id, keyName) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    ['touchstart', 'mousedown'].forEach(evt => {
        btn.addEventListener(evt, (e) => { e.preventDefault(); keys[keyName] = true; });
    });
    ['touchend', 'mouseup', 'mouseleave'].forEach(evt => {
        btn.addEventListener(evt, (e) => { e.preventDefault(); keys[keyName] = false; });
    });
};

setupTouchButton('left-btn', 'ArrowLeft');
setupTouchButton('right-btn', 'ArrowRight');

document.getElementById('pause-trigger-btn').addEventListener('click', () => {
    togglePause();
});
document.getElementById('resume-btn').addEventListener('click', () => {
    togglePause();
});

function togglePause() {
    if (isGameOver || isVictory) return;
    isPaused = !isPaused;
    const pauseScreen = document.getElementById('pause-screen');
    if (isPaused) {
        pauseScreen.classList.remove('hidden');
    } else {
        pauseScreen.classList.add('hidden');
        gameLoop();
    }
}

// --- GESTIÓN DE OBSTÁCULOS Y COLECCIONABLES ---
const carEmojis = ['🚗', '🚕', '🚙', '🚚', '🚓', '🏎️', '🚐'];

function spawnEntity() {
    const lanes = [55, 185, 315];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    
    // 25% de probabilidad de generar una hamburguesa bonus en vez de un carro
    if (Math.random() < 0.25) {
        collectibles.push({
            x: laneX + 5,
            y: -80,
            width: 40,
            height: 40,
            collected: false
        });
    } else {
        const carEmoji = carEmojis[Math.floor(Math.random() * carEmojis.length)];
        obstacles.push({
            x: laneX,
            y: -100,
            width: 50,
            height: 80,
            emoji: carEmoji,
            passed: false
        });
    }
}

let spawnTimer = 0;
let spawnInterval = savedDifficulty === 'extreme' ? 52 : (savedDifficulty === 'hard' ? 62 : 75);

// --- SISTEMA DE PARTÍCULAS VISUALES ---
function createExplosion(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.5) * 9,
            alpha: 1,
            emoji: ['🔥', '💥', '🍔', '✨', '⚡'][Math.floor(Math.random() * 5)]
        });
    }
}

// --- BUCLE PRINCIPAL DE ACTUALIZACIÓN ---
function update() {
    if (isGameOver || isVictory || isPaused) return;

    // 1. Movimiento fluido de la moto dentro de la carretera
    if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && player.x > 30) {
        player.x -= player.speed;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D']) && player.x < canvas.width - 78) {
        player.x += player.speed;
    }

    // 2. Movimiento de la carretera y edificios laterales
    roadLines.forEach(line => {
        line.y += gameSpeed;
        if (line.y > canvas.height) line.y = -70;
    });

    cityBuildings.forEach(b => {
        b.y += gameSpeed * 0.5;
        if (b.y > canvas.height) b.y = -140;
    });

    // 3. Generación de tráfico y elementos
    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
        spawnEntity();
        spawnTimer = 0;
    }

    // 4. Actualización y colisiones de obstáculos (Carros)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += gameSpeed;

        // Detección de colisión AABB ajustada
        if (
            player.x < obs.x + obs.width - 10 &&
            player.x + player.width - 10 > obs.x &&
            player.y < obs.y + obs.height - 10 &&
            player.y + player.height - 10 > obs.y
        ) {
            playSound('crash');
            createExplosion(player.x + player.width / 2, player.y + player.height / 2);
            triggerGameOver();
        }

        // Puntuación por esquivar carros
        if (!obs.passed && obs.y > player.y + player.height) {
            obs.passed = true;
            score += 100;
            checkProgression();
        }

        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
        }
    }

    // 5. Actualización y recogida de hamburguesas bonus 🍔
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let col = collectibles[i];
        col.y += gameSpeed;

        if (
            player.x < col.x + col.width &&
            player.x + player.width > col.x &&
            player.y < col.y + col.height &&
            player.y + player.height > col.y
        ) {
            playSound('coin');
            score += 300; // Bonificación extra por recoger hamburguesa
            createExplosion(col.x + col.width / 2, col.y + col.height / 2, 6);
            collectibles.splice(i, 1);
            checkProgression();
            continue;
        }

        if (col.y > canvas.height) {
            collectibles.splice(i, 1);
        }
    }

    // 6. Actualización de partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.035;
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    updateHUD();
}

function checkProgression() {
    // Progresión de dificultad por niveles (cada 1500 puntos)
    if (score >= level * 1500) {
        level++;
        gameSpeed += 1.1;
        if (spawnInterval > 22) spawnInterval -= 8;
    }

    // Condición de Victoria Total (10,000 puntos)
    if (score >= 10000) {
        triggerVictory();
    }
}

// --- RENDERIZADO GRÁFICO EN CANVAS ---
function draw() {
    // Fondo de la pista
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Edificios laterales decorativos (Ciber-ciudad)
    cityBuildings.forEach(b => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(5, b.y, 18, b.leftHeight);
        ctx.fillRect(canvas.width - 23, b.y + 30, 18, b.rightHeight);

        // Ventanas iluminadas en los edificios
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(9, b.y + 10, 4, 6);
        ctx.fillRect(9, b.y + 22, 4, 6);
        ctx.fillRect(canvas.width - 19, b.y + 40, 4, 6);
    });

    // Aceras / Bordes verdes
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(22, 0, 10, canvas.height);
    ctx.fillRect(canvas.width - 32, 0, 10, canvas.height);

    // Asfalto de la carretera
    ctx.fillStyle = '#111827';
    ctx.fillRect(32, 0, canvas.width - 64, canvas.height);

    // Líneas divisorias de carriles con patrón neón
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    
    ctx.beginPath();
    ctx.moveTo(140, 0);
    ctx.lineTo(140, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(280, 0);
    ctx.lineTo(280, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Líneas de velocidad móviles centrales
    roadLines.forEach(line => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(canvas.width / 2 - 2, line.y, 4, line.height);
    });

    // Renderizar Coleccionables (Hamburguesas 🍔)
    collectibles.forEach(col => {
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍔', col.x + col.width / 2, col.y + col.height / 2);
    });

    // Renderizar Obstáculos (Tráfico 🚗)
    obstacles.forEach(obs => {
        ctx.font = '38px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obs.emoji, obs.x + obs.width / 2, obs.y + obs.height / 2);
    });

    // Renderizar Jugador (Moto 🏍️)
    ctx.font = '42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏍️', player.x + player.width / 2, player.y + player.height / 2);

    // Renderizar Partículas de efectos
    particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.font = '22px sans-serif';
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.globalAlpha = 1.0;
    });
}

// --- ACTUALIZACIÓN DE HUD HTML ---
function updateHUD() {
    document.getElementById('score-display').innerText = score;
    document.getElementById('level-display').innerText = level;
    document.getElementById('speed-display').innerText = gameSpeed.toFixed(1) + 'x';
}

// --- BUCLE GLOBAL DE ANIMACIÓN (60 FPS) ---
function gameLoop() {
    update();
    draw();
    if (!isGameOver && !isVictory && !isPaused) {
        requestAnimationFrame(gameLoop);
    }
}

// --- GESTIÓN DE FINES DE PARTIDA Y PERSISTENCIA ---
function triggerGameOver() {
    isGameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('motoHighScore', highScore);
    }
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-highscore').innerText = highScore;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function triggerVictory() {
    isVictory = true;
    playSound('victory');
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('motoHighScore', highScore);
    }
    document.getElementById('victory-score').innerText = score;
    document.getElementById('victory-highscore').innerText = highScore;
    document.getElementById('victory-screen').classList.remove('hidden');
}

// Inicio automático al cargar
window.onload = () => {
    gameLoop();
};