/**
 * BURGER MASTER PRO - Lógica Core Masiva y Avanzada (Ultimate Edition)
 * Este código usa Clases (POO) para mantener un control absoluto del juego,
 * gestionando recetas complejas, clientes con IA de paciencia, combos, partículas,
 * almacenamiento local persistente y la transición fluida al minijuego de reparto en moto.
 */

// --- BASE DE DATOS AMPLIADA DE RECETAS GOURMET ---
const RECIPES = [
    { name: "Hamburguesa Clásica", ingredients: ['🍞', '🥩', '🧀', '🍞'], points: 100 },
    { name: "Doble Queso", ingredients: ['🍞', '🥩', '🧀', '🥩', '🧀', '🍞'], points: 160 },
    { name: "La Vegana", ingredients: ['🍞', '🥬', '🍅', '🧅', '🍞'], points: 130 },
    { name: "BLT Especial", ingredients: ['🍞', '🥩', '🥓', '🥬', '🍅', '🍞'], points: 190 },
    { name: "Mega Tocino & Huevo", ingredients: ['🍞', '🥩', '🥓', '🍳', '🧀', '🍞'], points: 240 },
    { name: "Combo Fast Food (Papas + Gaseosa)", ingredients: ['🍞', '🥩', '🧀', '🍟', '🥤', '🍞'], points: 320 },
    { name: "Monstruo Supreme", ingredients: ['🍞', '🥩', '🧀', '🥓', '🥩', '🥬', '🍅', '🥒', '🍳', '🍟', '🥤', '🍞'], points: 500 }
];

const CUSTOMER_EMOJIS = ['👨', '👩', '👱‍♂️', '👩‍🦰', '👮‍♂️', '👷‍♀️', '🕵️‍♂️', '🧛‍♂️', '🤖', '🧑‍🎤'];

// --- CLASE CLIENTE AVANZADA ---
class Customer {
    constructor(id, level, difficultyMultiplier) {
        this.id = id;
        this.recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
        this.emoji = CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)];
        
        // La paciencia escala de forma agresiva según el nivel y la dificultad elegida
        this.basePatience = Math.max(8, 32 - (level * 2));
        this.maxPatience = Math.round(this.basePatience / difficultyMultiplier);
        this.currentPatience = this.maxPatience;
        
        this.element = this.createHTML();
        this.timer = null;
    }

    createHTML() {
        const div = document.createElement('div');
        div.className = 'customer-card glass-panel animate-pop';
        div.id = `customer-${this.id}`;
        
        div.innerHTML = `
            <div class="customer-header">
                <span class="customer-emoji">${this.emoji}</span>
                <div class="customer-info-text">
                    <h4>${this.recipe.name}</h4>
                    <span class="customer-reward">💰 +${this.recipe.points} pts</span>
                </div>
            </div>
            <div class="order-recipe">${this.recipe.ingredients.join(' ')}</div>
            <div class="patience-bar">
                <div class="patience-fill" id="patience-fill-${this.id}"></div>
            </div>
        `;
        return div;
    }

    startWaiting(onTimeout) {
        const fillBar = this.element.querySelector(`#patience-fill-${this.id}`);
        
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
        
        // Cargar dificultad guardada en el menú
        const savedDiff = localStorage.getItem('burgerDifficulty') || 'normal';
        this.difficulty = savedDiff;
        this.difficultyMultiplier = savedDiff === 'extreme' ? 1.6 : (savedDiff === 'hard' ? 1.3 : 1.0);
        // La velocidad de aparición de clientes también sube con la dificultad
        this.spawnSpeedFactor = savedDiff === 'extreme' ? 0.7 : (savedDiff === 'hard' ? 0.85 : 1.0);

        this.DOM = {
            score: document.getElementById('score-display'),
            lives: document.getElementById('lives-display'),
            combo: document.getElementById('combo-display'),
            level: document.getElementById('level-display'),
            ordersProgress: document.getElementById('orders-progress-display'),
            plate: document.getElementById('plate'),
            zone: document.getElementById('customers-zone')
        };
    }

    init() {
        this.updateHUD();
        this.startSpawning();
        this.spawnCustomer();
        this.spawnCustomer(); // Arrancamos con 2 clientes en cola para más dinamismo
        console.log(`[GameManager] Turno iniciado con dificultad: ${localStorage.getItem('burgerDifficulty') || 'normal'}`);
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

    // Interacción avanzada con la cocina
    addIngredient(emoji, name) {
        this.plate.push(emoji);
        this.renderPlate();
        
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
            
            // Incrementar multiplicador de combo
            this.combo = Math.min(5.0, this.combo + 0.25); 
            
            // Subir de nivel automático cada 800 puntos
            if (Math.floor(this.score / 800) + 1 > this.level) {
                this.level++;
                clearInterval(this.spawnInterval);
                this.startSpawning();
                this.showFloatingText(`🚀 ¡NIVEL ${this.level} ALCANZADO!`, window.innerWidth / 2, window.innerHeight / 2, '#70a1ff');
                this.createParticles(window.innerWidth / 2, window.innerHeight / 2, '⭐', 35);
            }

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
        this.customers.forEach(c => clearInterval(c.timer));
        
        const screen = document.getElementById('game-over-screen');
        const finalScoreDisplay = document.getElementById('final-score');
        const finalOrdersDisplay = document.getElementById('final-orders-count');
        const newRecordMsg = document.getElementById('new-record-msg');
        
        if (screen) screen.classList.remove('hidden');
        if (finalScoreDisplay) finalScoreDisplay.innerText = this.score;
        if (finalOrdersDisplay) finalOrdersDisplay.innerText = this.ordersCompleted;

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