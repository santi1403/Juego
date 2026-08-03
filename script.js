/**
 * BURGER MASTER PRO - Lógica Core Masiva y Avanzada (Ultimate Edition)
 * Este código usa Clases (POO) para mantener un control absoluto del juego,
 * gestionando recetas complejas, clientes con IA de paciencia, combos, partículas,
 * almacenamiento local persistente y la transición fluida al minijuego de reparto en moto.
 */

// --- BASE DE DATOS AMPLIADA DE RECETAS GOURMET ---
// Cada receta tiene un nivel mínimo: las recetas se desbloquean al subir de nivel.
const RECIPES = [
    { name: "Hamburguesa Clásica", ingredients: ['🍞', '🥩', '🧀', '🍞'], points: 100, minLevel: 1 },
    { name: "Doble Queso", ingredients: ['🍞', '🥩', '🧀', '🥩', '🧀', '🍞'], points: 160, minLevel: 1 },
    { name: "La Vegana", ingredients: ['🍞', '🥬', '🍅', '🧅', '🍞'], points: 130, minLevel: 1 },
    { name: "BLT Especial", ingredients: ['🍞', '🥩', '🥓', '🥬', '🍅', '🍞'], points: 190, minLevel: 2 },
    { name: "Mega Tocino & Huevo", ingredients: ['🍞', '🥩', '🥓', '🍳', '🧀', '🍞'], points: 240, minLevel: 2 },
    { name: "Combo Fast Food (Papas + Gaseosa)", ingredients: ['🍞', '🥩', '🧀', '🍟', '🥤', '🍞'], points: 320, minLevel: 3 },
    { name: "Monstruo Supreme", ingredients: ['🍞', '🥩', '🧀', '🥓', '🥩', '🥬', '🍅', '🥒', '🍳', '🍟', '🥤', '🍞'], points: 500, minLevel: 3 },
    // --- NUEVAS RECETAS EXTRA (Hot Dogs, Malteadas y Papas) ---
    { name: "Hot Dog Americano", ingredients: ['🍞', '🌭', '🧅', '🥒', '🍞'], points: 110, minLevel: 1 },
    { name: "Perro Completo", ingredients: ['🍞', '🌭', '🥓', '🧀', '🥬', '🍞'], points: 180, minLevel: 2 },
    { name: "Malteada de Fresa", ingredients: ['🥤', '🍦', '🍓'], points: 90, minLevel: 1 },
    { name: "Papas Cheddar", ingredients: ['🍟', '🧀', '🧀'], points: 85, minLevel: 1 },
    { name: "Monster Doble Tocino", ingredients: ['🍞', '🥩', '🥓', '🥩', '🥓', '🧀', '🍞'], points: 280, minLevel: 3 }
];

const CUSTOMER_EMOJIS = ['👨', '👩', '👱‍♂️', '👩‍🦰', '👮‍♂️', '👷‍♀️', '🕵️‍♂️', '🧛‍♂️', '🤖', '🧑‍🎤'];

// --- MÓDULO DE SONIDOS DE COCINA (Web Audio API, sin archivos externos) ---
const Sound = {
    ctx: null,
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.ctx = null;
        }
    },
    tone(freq, dur, type = 'sine', vol = 0.12, when = 0) {
        if (!this.ctx) return;
        try {
            const t = this.ctx.currentTime + when;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(g);
            g.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        } catch (e) { /* silencio */ }
    },
    sizzle() { this.tone(700, 0.12, 'triangle', 0.07); this.tone(520, 0.12, 'triangle', 0.07, 0.08); },
    ding() { this.tone(880, 0.18, 'sine', 0.15); this.tone(1318, 0.28, 'sine', 0.12, 0.12); },
    coin() { this.tone(1046, 0.12, 'square', 0.09); this.tone(1568, 0.2, 'square', 0.09, 0.08); },
    error() { this.tone(210, 0.25, 'sawtooth', 0.12); this.tone(140, 0.3, 'sawtooth', 0.1, 0.1); },
    levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.11, i * 0.09)); }
};

// --- CLASE CLIENTE AVANZADA ---
class Customer {
    constructor(id, level, difficultyMultiplier) {
        this.id = id;
        // 15% de probabilidad de que el cliente sea VIP: pide el doble de recompensa
        this.isVIP = Math.random() < 0.15;
        this.recipe = this.pickRecipe(level);
        if (this.isVIP) {
            this.recipe = { ...this.recipe, name: 'VIP ' + this.recipe.name, points: this.recipe.points * 2 };
        }
        this.emoji = CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)];

        // La paciencia escala de forma agresiva según el nivel y la dificultad elegida
        this.basePatience = Math.max(6, 32 - (level * 2)) * (this.isVIP ? 0.85 : 1);
        this.maxPatience = Math.round(this.basePatience / difficultyMultiplier);
        this.currentPatience = this.maxPatience;
        this.spawnTime = Date.now();

        this.element = this.createHTML();
        this.timer = null;
    }

    // Solo pide recetas que ya estén desbloqueadas según el nivel del jugador
    pickRecipe(level) {
        const available = RECIPES.filter(r => r.minLevel <= level);
        return available[Math.floor(Math.random() * available.length)];
    }

    createHTML() {
        const div = document.createElement('div');
        div.className = 'customer-card glass-panel animate-pop';
        div.id = `customer-${this.id}`;

        div.innerHTML = `
            <div class="customer-header">
                <span class="customer-emoji">${this.emoji}${this.isVIP ? '👑' : ''}</span>
                <div class="customer-info-text">
                    <h4>${this.recipe.name}</h4>
                    <span class="customer-reward">💰 +${this.recipe.points} pts</span>
                </div>
            </div>
            <div class="order-recipe">${this.recipe.ingredients.join(' ')}</div>
            <div class="patience-row">
                <div class="patience-bar">
                    <div class="patience-fill" id="patience-fill-${this.id}"></div>
                </div>
                <span class="patience-time" id="patience-time-${this.id}">${this.maxPatience}s</span>
            </div>
        `;
        return div;
    }

    startWaiting(onTimeout) {
        const fillBar = this.element.querySelector(`#patience-fill-${this.id}`);
        const timeLabel = this.element.querySelector(`#patience-time-${this.id}`);

        this.timer = setInterval(() => {
            this.currentPatience -= 1;
            const percentage = (this.currentPatience / this.maxPatience) * 100;

            if (fillBar) {
                fillBar.style.width = `${percentage}%`;

                // Cambios de color dinámicos según el estrés del cliente
                if (percentage < 25) {
                    fillBar.style.backgroundColor = 'var(--danger)';
                    this.element.classList.add('shake-card');
                } else if (percentage < 55) {
                    fillBar.style.backgroundColor = 'var(--warning)';
                } else {
                    fillBar.style.backgroundColor = 'var(--success)';
                }
            }

            // Mostrar los segundos restantes del cliente
            if (timeLabel) timeLabel.innerText = `${Math.max(0, this.currentPatience)}s`;

            if (this.currentPatience <= 0) {
                clearInterval(this.timer);
                onTimeout(this);
            }
        }, 1000);
    }

    destroy() {
        clearInterval(this.timer);
        if (this.element) {
            this.element.classList.add('animate-fade-out');
            setTimeout(() => this.element.remove(), 400);
        }
    }
}

// --- CONTROLADOR PRINCIPAL DEL JUEGO (GAME MANAGER) ---
class GameManager {
    constructor() {
        this.score = parseInt(localStorage.getItem('currentBurgerScore')) || 0;
        this.lives = 3;
        this.combo = 1.0;
        this.level = 1;
        this.ordersCompleted = 0;
        this.plate = [];
        this.customers = [];
        this.customerCount = 0;
        this.spawnInterval = null;
        this.turnTimer = null;

        // Cargar dificultad guardada en el menú
        const savedDiff = localStorage.getItem('burgerDifficulty') || 'normal';
        this.difficulty = savedDiff;
        this.difficultyMultiplier = savedDiff === 'nightmare' ? 2.0 : (savedDiff === 'extreme' ? 1.6 : (savedDiff === 'hard' ? 1.3 : 1.0));
        // La velocidad de aparición de clientes también sube con la dificultad
        this.spawnSpeedFactor = savedDiff === 'nightmare' ? 0.55 : (savedDiff === 'extreme' ? 0.7 : (savedDiff === 'hard' ? 0.85 : 1.0));

        // Modo de juego: Clásico o Contra Reloj
        this.mode = localStorage.getItem('burgerMode') || 'classic';
        const timeByDiff = { normal: 180, hard: 150, extreme: 120, nightmare: 100 };
        this.maxTime = this.mode === 'time' ? 60 : (timeByDiff[savedDiff] || 180);
        this.timeLeft = this.maxTime;

        // Monedas y progreso persistente
        this.coins = parseInt(localStorage.getItem('burgerCoins')) || 0;
        this.maxLevelSaved = parseInt(localStorage.getItem('burgerMaxLevel')) || 1;

        this.DOM = {
            score: document.getElementById('score-display'),
            lives: document.getElementById('lives-display'),
            combo: document.getElementById('combo-display'),
            level: document.getElementById('level-display'),
            ordersProgress: document.getElementById('orders-progress-display'),
            plate: document.getElementById('plate'),
            zone: document.getElementById('customers-zone'),
            timer: document.getElementById('timer-display'),
            coins: document.getElementById('coins-display'),
            chef: document.getElementById('chef-display')
        };
    }

    init() {
        this.updateHUD();
        this.startSpawning();
        this.spawnCustomer();
        this.spawnCustomer(); // Arrancamos con 2 clientes en cola para más dinamismo
        this.startTurnTimer();
        this.initTutorial();
        Sound.init();
        const chef = localStorage.getItem('burgerChef') || '👨‍🍳';
        if (this.DOM.chef) this.DOM.chef.innerText = chef;
        console.log(`[GameManager] Turno iniciado (${this.mode}) con dificultad: ${this.difficulty}`);
    }

    startSpawning() {
        const spawnRate = Math.max(2500, (7500 - (this.level * 450)) * this.spawnSpeedFactor);
        this.spawnInterval = setInterval(() => {
            if (this.customers.length < 5) { // Máximo 5 clientes simultáneos
                this.spawnCustomer();
            }
        }, spawnRate);
    }

    spawnCustomer() {
        this.customerCount++;
        const customer = new Customer(this.customerCount, this.level, this.difficultyMultiplier);
        this.customers.push(customer);
        if (this.DOM.zone) {
            this.DOM.zone.appendChild(customer.element);
        }

        customer.startWaiting((c) => this.customerLeft(c));
    }

    // Cuenta regresiva del turno (en Contra Reloj el tiempo es el límite principal)
    startTurnTimer() {
        this.turnTimer = setInterval(() => {
            this.timeLeft--;
            if (this.DOM.timer) {
                this.DOM.timer.innerText = this.timeLeft;
                if (this.timeLeft <= 10) this.DOM.timer.classList.add('danger');
            }
            if (this.timeLeft <= 0) {
                clearInterval(this.turnTimer);
                this.showFloatingText('⏰ ¡TIEMPO AGOTADO!', window.innerWidth / 2, window.innerHeight / 2, '#ff4757');
                this.gameOver();
            }
        }, 1000);
    }

    // Tutorial interactivo (solo la primera vez)
    initTutorial() {
        if (localStorage.getItem('burgerTutorialDone')) return;
        const screen = document.getElementById('tutorial-screen');
        if (!screen) return;
        screen.classList.remove('hidden');
        const startBtn = document.getElementById('tutorial-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                screen.classList.add('hidden');
                localStorage.setItem('burgerTutorialDone', '1');
            });
        }
    }

    customerLeft(customer) {
        this.removeCustomer(customer);
        this.combo = 1.0;
        this.loseLife();
        this.showFloatingText("¡Cliente Furioso! 😡", window.innerWidth / 2, 150, '#ff4757');
        this.createParticles(window.innerWidth / 2, 120, '💢', 12);
    }

    removeCustomer(customer) {
        customer.destroy();
        this.customers = this.customers.filter(c => c.id !== customer.id);
    }

    // Suma monedas y actualiza el HUD + almacenamiento persistente
    addCoins(amount) {
        this.coins += amount;
        localStorage.setItem('burgerCoins', this.coins);
        if (this.DOM.coins) this.DOM.coins.innerText = this.coins;
    }

    // Interacción avanzada con la cocina
    addIngredient(emoji, name) {
        Sound.init();
        this.plate.push(emoji);
        this.renderPlate();
        Sound.sizzle();

        if (navigator.vibrate) navigator.vibrate(25);
        this.showFloatingText(`+ ${name}`, window.innerWidth / 2 - 50, window.innerHeight - 200, '#2ed573');
    }

    renderPlate() {
        if (!this.DOM.plate) return;
        this.DOM.plate.innerHTML = '';

        if (this.plate.length === 0) {
            this.DOM.plate.innerHTML = `<span class="empty-plate-text">Plato vacío listo para cocinar...</span>`;
            return;
        }

        this.plate.forEach((ing, index) => {
            const div = document.createElement('div');
            div.className = 'plate-item animate-pop';
            div.style.zIndex = index;
            div.innerText = ing;
            this.DOM.plate.appendChild(div);
        });
    }

    trashPlate() {
        if (this.plate.length === 0) return;
        this.plate = [];
        this.renderPlate();
        this.combo = 1.0;
        this.updateHUD();
        Sound.error();
        this.showFloatingText("¡Plato Desechado 🗑️!", window.innerWidth / 2, window.innerHeight - 250, '#ffa502');
    }

    servePlate() {
        if (this.plate.length === 0) {
            this.showFloatingText("¡El plato está vacío!", window.innerWidth / 2, window.innerHeight - 250, '#ff4757');
            return;
        }

        const currentRecipeStr = JSON.stringify(this.plate);

        // Buscar coincidencia exacta con algún cliente en espera
        const matchedCustomerIndex = this.customers.findIndex(c =>
            JSON.stringify(c.recipe.ingredients) === currentRecipeStr
        );

        if (matchedCustomerIndex !== -1) {
            // ¡PEDIDO CORRECTO EXITOSO!
            const customer = this.customers[matchedCustomerIndex];

            const pointsEarned = Math.floor(customer.recipe.points * this.combo);
            this.score += pointsEarned;
            this.ordersCompleted++;

            // Sistema de propinas: sirve rápido y gana monedas extra
            const elapsed = (Date.now() - customer.spawnTime) / 1000;
            const fastServe = elapsed <= 8;
            const tip = Math.floor(customer.recipe.points / 10) + (fastServe ? 25 : 0);
            this.addCoins(tip + 5);
            if (fastServe) {
                this.score += Math.floor(customer.recipe.points * 0.2);
                Sound.coin();
                this.showFloatingText(`⚡ ¡SERVICIO RÁPIDO! +${tip}🪙`, window.innerWidth / 2, window.innerHeight - 280, '#feca57');
                this.createParticles(window.innerWidth / 2, window.innerHeight - 250, '🪙', 8);
            }

            // Incrementar multiplicador de combo
            this.combo = Math.min(5.0, this.combo + 0.25);

            // Subir de nivel automático cada 800 puntos
            if (Math.floor(this.score / 800) + 1 > this.level) {
                this.level++;
                this.maxLevelSaved = Math.max(this.maxLevelSaved, this.level);
                localStorage.setItem('burgerMaxLevel', this.maxLevelSaved);
                clearInterval(this.spawnInterval);
                this.startSpawning();
                Sound.levelup();
                this.showFloatingText(`🚀 ¡NIVEL ${this.level} ALCANZADO!`, window.innerWidth / 2, window.innerHeight / 2, '#70a1ff');
                this.createParticles(window.innerWidth / 2, window.innerHeight / 2, '⭐', 35);
            }

            Sound.ding();
            const rect = customer.element.getBoundingClientRect();
            this.createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '💵', 15);
            this.showFloatingText(`+${pointsEarned} pts (x${this.combo.toFixed(1)})`, rect.left, rect.top, '#2ed573');

            this.removeCustomer(customer);
            this.plate = [];
            this.renderPlate();

            this.updateHUD();

            console.log(`[Progreso] Pedidos completados: ${this.ordersCompleted} / 10`);

            // --- TRANSICIÓN AUTOMÁTICA AL MINIJUEGO DE LA MOTO AL LLEGAR A 10 PEDIDOS ---
            if (this.ordersCompleted >= 10) {
                clearInterval(this.spawnInterval);
                clearInterval(this.turnTimer);
                this.customers.forEach(c => clearInterval(c.timer));

                // Guardar puntaje temporal en LocalStorage para llevarlo a la moto
                localStorage.setItem('currentBurgerScore', this.score);

                alert("🔥 ¡IMPECABLE! Has completado los 10 pedidos del restaurante con éxito. ¡Prepara la moto, es hora de repartir por toda la ciudad! 🏍️💨");
                window.location.href = 'delivery.html';
                return;
            }

        } else {
            // PEDIDO ERRÓNEO O RECETA INCORRECTA
            this.plate = [];
            this.renderPlate();
            this.combo = 1.0;
            this.updateHUD();
            Sound.error();
            this.showFloatingText("❌ ¡Receta Incorrecta!", window.innerWidth / 2, window.innerHeight - 250, '#ff4757');
            this.createParticles(window.innerWidth / 2, window.innerHeight / 2, '💥', 10);
        }
    }

    loseLife() {
        this.lives--;
        this.updateHUD();
        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    updateHUD() {
        if (this.DOM.score) this.DOM.score.innerText = this.score;
        if (this.DOM.level) this.DOM.level.innerText = this.level;
        if (this.DOM.combo) this.DOM.combo.innerText = this.combo.toFixed(1);
        if (this.DOM.ordersProgress) this.DOM.ordersProgress.innerText = `${this.ordersCompleted}/10`;
        if (this.DOM.lives) this.DOM.lives.innerText = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives);
        if (this.DOM.timer) this.DOM.timer.innerText = this.timeLeft;
        if (this.DOM.coins) this.DOM.coins.innerText = this.coins;
    }

    // Sistema de textos flotantes informativos en pantalla
    showFloatingText(text, x, y, color = '#ffffff') {
        let container = document.getElementById('floating-text-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'floating-text-container';
            document.body.appendChild(container);
        }

        const el = document.createElement('div');
        el.className = 'floating-notification';
        el.innerText = text;
        el.style.left = `${Math.max(20, x - 50)}px`;
        el.style.top = `${Math.max(50, y - 30)}px`;
        el.style.color = color;

        container.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    // Sistema avanzado de partículas visuales por emojis
    createParticles(x, y, emoji, count = 10) {
        let container = document.getElementById('particles-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'particles-container';
            document.body.appendChild(container);
        }

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.innerText = emoji;
            p.style.left = `${x}px`;
            p.style.top = `${y}px`;

            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 120 + 40;
            p.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);

            container.appendChild(p);
            setTimeout(() => p.remove(), 1000);
        }
    }

    gameOver() {
        clearInterval(this.spawnInterval);
        clearInterval(this.turnTimer);
        this.customers.forEach(c => clearInterval(c.timer));

        // Guardar monedas y nivel máximo alcanzado
        localStorage.setItem('burgerCoins', this.coins);
        this.maxLevelSaved = Math.max(this.maxLevelSaved, this.level);
        localStorage.setItem('burgerMaxLevel', this.maxLevelSaved);

        const screen = document.getElementById('game-over-screen');
        const finalScoreDisplay = document.getElementById('final-score');
        const finalOrdersDisplay = document.getElementById('final-orders-count');
        const finalCoinsDisplay = document.getElementById('final-coins');
        const newRecordMsg = document.getElementById('new-record-msg');

        if (screen) screen.classList.remove('hidden');
        if (finalScoreDisplay) finalScoreDisplay.innerText = this.score;
        if (finalOrdersDisplay) finalOrdersDisplay.innerText = this.ordersCompleted;
        if (finalCoinsDisplay) finalCoinsDisplay.innerText = this.coins;

        // Gestión y persistencia del Récord Global en LocalStorage
        const currentHigh = localStorage.getItem('burgerMasterHighScore') || 0;
        if (this.score > currentHigh) {
            localStorage.setItem('burgerMasterHighScore', this.score);
            if (newRecordMsg) newRecordMsg.classList.remove('hidden');
        }

        // Limpiar puntaje temporal del turno actual
        localStorage.removeItem('currentBurgerScore');
    }
}

// Inicialización automática al cargar el DOM del navegador
let gameManager;
window.onload = () => {
    if (document.getElementById('customers-zone')) {
        gameManager = new GameManager();
        gameManager.init();
    }
};
