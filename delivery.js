/**
 * BURGER MASTER PRO - Minijuego de Reparto en Moto (Ultimate Edition Engine)
 * Motor arcade 2D basado en HTML5 Canvas con Web Audio API, nitro, power-ups,
 * vidas, monedas, motos desbloqueables y físicas fluidas.
 */

const canvas = document.getElementById('roadCanvas');
const ctx = canvas.getContext('2d');

// --- MOTOS DESBLOQUEABLES (se compran en la tienda del menú) ---
const MOTOS = [
    { name: 'Moto Clásica', emoji: '🏍️', color: '#38bdf8', speedBonus: 0 },
    { name: 'Scooter Turbo', emoji: '🛵', color: '#4ade80', speedBonus: 0.7 },
    { name: 'Moto Deportiva', emoji: '🏍️', color: '#f43f5e', speedBonus: 1.2 }
];
const selectedMotoIndex = parseInt(localStorage.getItem('burgerMoto')) || 0;
const moto = MOTOS[selectedMotoIndex] || MOTOS[0];

// --- VARIABLES DEL JUEGO Y ESTADO ---
let score = 0;
let level = 1;
let isGameOver = false;
let isVictory = false;
let isPaused = false;
let highScore = localStorage.getItem('motoHighScore') || 0;

// Bonus inicial según el puntaje conseguido en el restaurante
const cookBonus = Math.floor((parseInt(localStorage.getItem('currentBurgerScore')) || 0) / 20);
let bonusShown = false;
if (cookBonus > 0) score += cookBonus;

// Ajuste de dificultad según el modo elegido en el menú principal
const savedDifficulty = localStorage.getItem('burgerDifficulty') || 'normal';
const diffSpeed = { normal: 4.5, hard: 5.5, extreme: 6.5, nightmare: 7.5 };
let baseSpeed = (diffSpeed[savedDifficulty] || 4.5) + moto.speedBonus;
let gameSpeed = baseSpeed;
const diffSpawn = { normal: 75, hard: 62, extreme: 52, nightmare: 45 };
let spawnInterval = diffSpawn[savedDifficulty] || 75;

// Vidas y estados del jugador
let lives = 3;
let invincibleTimer = 0;
let shieldTimer = 0;
let magnetTimer = 0;
let nitro = 100;
let boosting = false;
let coinsEarned = 0;

// Actualizar HUD de Récord Inicial
document.getElementById('high-score-hud').innerText = highScore;

// Estado del Jugador (Moto 🏍️)
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 110,
    width: 48,
    height: 76,
    speed: 7.5 + moto.speedBonus
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
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    initAudio();
    if (!audioCtx) return;
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
    } else if (type === 'power') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gainNode.gain.setValueAtTime(0.18, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
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
    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        boosting = true;
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if (e.key === ' ' || e.key === 'Spacebar') {
        boosting = false;
    }
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

// Botón de NITRO táctil
const nitroBtn = document.getElementById('nitro-btn');
if (nitroBtn) {
    ['touchstart', 'mousedown'].forEach(evt => {
        nitroBtn.addEventListener(evt, (e) => { e.preventDefault(); boosting = true; initAudio(); });
    });
    ['touchend', 'mouseup', 'mouseleave'].forEach(evt => {
        nitroBtn.addEventListener(evt, (e) => { e.preventDefault(); boosting = false; });
    });
}

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

// --- GESTIÓN DE OBSTÁCULOS, COLECCIONABLES Y POWER-UPS ---
const carEmojis = ['🚗', '🚕', '🚙', '🚓', '🏎️', '🚐'];

function spawnEntity() {
    const lanes = [55, 185, 315];
    const laneX = lanes[Math.floor(Math.random() * lanes.length)];
    const r = Math.random();

    // Power-ups: escudo y magneto
    if (r < 0.06) {
        collectibles.push({ kind: 'shield', x: laneX + 5, y: -80, width: 40, height: 40, collected: false });
        return;
    }
    if (r < 0.10) {
        collectibles.push({ kind: 'magnet', x: laneX + 5, y: -80, width: 40, height: 40, collected: false });
        return;
    }
    // Coleccionables de puntos
    if (r < 0.22) {
        collectibles.push({ kind: 'burger', x: laneX + 5, y: -80, width: 40, height: 40, collected: false });
        return;
    }
    if (r < 0.30) {
        collectibles.push({ kind: 'coin', x: laneX + 5, y: -80, width: 40, height: 40, collected: false });
        return;
    }
    if (r < 0.36) {
        collectibles.push({ kind: 'star', x: laneX + 5, y: -80, width: 40, height: 40, collected: false });
        return;
    }

    // Obstáculos: carros, camiones, conos y huecos
    if (r < 0.56) {
        obstacles.push({ kind: 'car', x: laneX, y: -100, width: 50, height: 80, emoji: carEmojis[Math.floor(Math.random() * carEmojis.length)], passed: false });
    } else if (r < 0.70) {
        obstacles.push({ kind: 'truck', x: laneX - 10, y: -130, width: 70, height: 110, emoji: '🚛', passed: false });
    } else if (r < 0.84) {
        obstacles.push({ kind: 'cone', x: laneX + 10, y: -60, width: 30, height: 45, emoji: '🚧', passed: false });
    } else {
        obstacles.push({ kind: 'hole', x: laneX, y: -40, width: 55, height: 20, emoji: '🕳️', passed: false });
    }
}

let spawnTimer = 0;

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

    // NITRO: mantén Space o el botón para acelerar mientras tengas carga
    let effectiveSpeed = gameSpeed;
    if (boosting && nitro > 0) {
        nitro -= 0.6;
        effectiveSpeed = gameSpeed * 1.7;
    } else {
        nitro = Math.min(100, nitro + 0.15);
    }

    // 1. Movimiento fluido de la moto dentro de la carretera
    if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && player.x > 30) {
        player.x -= player.speed;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D']) && player.x < canvas.width - 78) {
        player.x += player.speed;
    }

    // Temporizadores de estados especiales
    if (invincibleTimer > 0) invincibleTimer -= 1 / 60;
    if (shieldTimer > 0) shieldTimer -= 1 / 60;
    if (magnetTimer > 0) magnetTimer -= 1 / 60;

    // 2. Movimiento de la carretera y edificios laterales
    roadLines.forEach(line => {
        line.y += effectiveSpeed;
        if (line.y > canvas.height) line.y = -70;
    });

    cityBuildings.forEach(b => {
        b.y += effectiveSpeed * 0.5;
        if (b.y > canvas.height) b.y = -140;
    });

    // 3. Generación de tráfico y elementos
    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
        spawnEntity();
        spawnTimer = 0;
    }

    // 4. Actualización y colisiones de obstáculos (Carros, camiones, conos, huecos)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += effectiveSpeed;

        // Detección de colisión AABB ajustada
        if (
            player.x < obs.x + obs.width - 8 &&
            player.x + player.width - 8 > obs.x &&
            player.y < obs.y + obs.height - 8 &&
            player.y + player.height - 8 > obs.y
        ) {
            if (invincibleTimer > 0) {
                // Sin daño mientras se es invencible tras un choque
            } else if (shieldTimer > 0) {
                // El escudo absorbe el golpe y destruye el obstáculo
                shieldTimer = 0;
                playSound('power');
                createExplosion(obs.x + obs.width / 2, obs.y + obs.height / 2);
                obstacles.splice(i, 1);
                continue;
            } else {
                // CHOQUE REAL
                playSound('crash');
                createExplosion(player.x + player.width / 2, player.y + player.height / 2);
                lives--;
                if (lives <= 0) {
                    triggerGameOver();
                } else {
                    invincibleTimer = 1.5;
                    updateHUD();
                }
            }
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

    // 5. Actualización y recogida de coleccionables y power-ups
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let col = collectibles[i];
        col.y += effectiveSpeed;

        // Con el magneto activo, los coleccionables se atraen hacia la moto
        if (magnetTimer > 0) {
            const dx = (player.x + player.width / 2) - (col.x + col.width / 2);
            const dy = (player.y + player.height / 2) - (col.y + col.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140) {
                col.x += (dx / dist) * 6;
                col.y += (dy / dist) * 6;
            }
        }

        let picked = false;
        if (
            player.x < col.x + col.width &&
            player.x + player.width > col.x &&
            player.y < col.y + col.height &&
            player.y + player.height > col.y
        ) {
            picked = true;
        }

        if (picked) {
            playSound('coin');
            if (col.kind === 'burger') {
                score += 300;
                coinsEarned += 5;
                createExplosion(col.x + col.width / 2, col.y + col.height / 2, 6);
            } else if (col.kind === 'coin') {
                score += 150;
                coinsEarned += 3;
                createExplosion(col.x + col.width / 2, col.y + col.height / 2, 4);
            } else if (col.kind === 'star') {
                score += 500;
                coinsEarned += 8;
                createExplosion(col.x + col.width / 2, col.y + col.height / 2, 10);
            } else if (col.kind === 'shield') {
                shieldTimer = 6;
                playSound('power');
            } else if (col.kind === 'magnet') {
                magnetTimer = 6;
                playSound('power');
            }
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

    // Renderizar Coleccionables y Power-ups
    collectibles.forEach(col => {
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emojiMap = { burger: '🍔', coin: '🪙', star: '⭐', shield: '🛡️', magnet: '🧲' };
        ctx.fillText(emojiMap[col.kind] || '🍔', col.x + col.width / 2, col.y + col.height / 2);
    });

    // Renderizar Obstáculos (carros, camiones, conos y huecos)
    obstacles.forEach(obs => {
        if (obs.kind === 'hole') {
            ctx.fillStyle = '#05080f';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.font = '38px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obs.emoji, obs.x + obs.width / 2, obs.y + obs.height / 2);
        }
    });

    // Dibujar la moto personalizada del jugador (según la moto elegida)
    drawMoto();

    // Aura de escudo activo
    if (shieldTimer > 0) {
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 46, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.5 + Math.sin(Date.now() / 120) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Renderizar Partículas de efectos
    particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.font = '22px sans-serif';
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.globalAlpha = 1.0;
    });
}

// --- UTILIDAD PARA RECTÁNGULOS REDONDEADOS (compatibilidad) ---
function roundRectPath(c, x, y, w, h, r) {
    if (typeof c.roundRect === 'function') {
        c.roundRect(x, y, w, h, r);
        return;
    }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}

// Moto dibujada con el color de la moto seleccionada
function drawMoto() {
    const cx = player.x + player.width / 2;
    const top = player.y;

    // Ruedas
    ctx.fillStyle = '#0b1120';
    ctx.beginPath();
    ctx.ellipse(cx - 14, top + 64, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 14, top + 64, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Manillar
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 12, top + 26);
    ctx.lineTo(cx + 12, top + 26);
    ctx.stroke();

    // Cuerpo de la moto (color personalizado)
    ctx.fillStyle = moto.color;
    ctx.beginPath();
    roundRectPath(ctx, cx - 16, top + 30, 32, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Visor / parabrisas
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    roundRectPath(ctx, cx - 10, top + 34, 20, 10, 4);
    ctx.fill();

    // Casco del conductor
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧑‍🚀', cx, top + 14);

    // Luces delanteras
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(cx - 18, top + 52, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 18, top + 52, 3.5, 0, Math.PI * 2);
    ctx.fill();
}

// --- ACTUALIZACIÓN DE HUD HTML ---
function updateHUD() {
    document.getElementById('score-display').innerText = score;
    document.getElementById('level-display').innerText = level;
    document.getElementById('speed-display').innerText = gameSpeed.toFixed(1) + 'x';
    const livesEl = document.getElementById('lives-display');
    if (livesEl) livesEl.innerText = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    const coinsEl = document.getElementById('coins-display');
    if (coinsEl) coinsEl.innerText = coinsEarned;
    const nitroFill = document.getElementById('nitro-fill');
    if (nitroFill) nitroFill.style.width = `${nitro}%`;

    // Estado de power-ups en pantalla
    const statusEl = document.getElementById('power-status');
    if (statusEl) {
        if (shieldTimer > 0) {
            statusEl.innerText = '🛡️ Escudo: ' + Math.ceil(shieldTimer) + 's';
        } else if (magnetTimer > 0) {
            statusEl.innerText = '🧲 Magneto: ' + Math.ceil(magnetTimer) + 's';
        } else if (boosting && nitro > 0) {
            statusEl.innerText = '🚀 NITRO!';
        } else {
            statusEl.innerText = '';
        }
    }
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
    saveCoins();
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
    saveCoins();
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('motoHighScore', highScore);
    }
    document.getElementById('victory-score').innerText = score;
    document.getElementById('victory-highscore').innerText = highScore;
    document.getElementById('victory-screen').classList.remove('hidden');
}

// Suma las monedas ganadas en la moto al total del jugador
function saveCoins() {
    const total = (parseInt(localStorage.getItem('burgerCoins')) || 0) + coinsEarned;
    localStorage.setItem('burgerCoins', total);
}

// --- BONIFICACIÓN INICIAL POR LA COCINA ---
function showCookBonus() {
    if (bonusShown || cookBonus <= 0) return;
    bonusShown = true;
    const banner = document.getElementById('bonus-banner');
    if (banner) {
        banner.classList.remove('hidden');
        banner.innerText = `🎁 ¡Bonificación de cocina! +${cookBonus} pts iniciales`;
        setTimeout(() => banner.classList.add('hidden'), 5000);
    }
}

// Inicio automático al cargar
window.onload = () => {
    showCookBonus();
    initAudio();
    const motoNameEl = document.getElementById('moto-display');
    if (motoNameEl) motoNameEl.innerText = `${moto.emoji} ${moto.name}`;
    updateHUD();
    gameLoop();
};
