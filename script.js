/**
 * BURGER MASTER PRO - Lógica Core Masiva y Avanzada
 * Este código usa Clases (POO) para mantener un control absoluto del juego,
 * gestionando recetas, clientes, temporizadores de paciencia, combos, partículas,
 * almacenamiento local y la transición al minijuego de reparto.
 */

// --- BASE DE DATOS DE RECETAS ---
const RECIPES = [
    { name: "Hamburguesa Clásica", ingredients: ['🍞', '🥩', '🧀', '🍞'], points: 100 },
    { name: "Doble Queso", ingredients: ['🍞', '🥩', '🧀', '🥩', '🧀', '🍞'], points: 150 },
    { name: "La Vegana", ingredients: ['🍞', '🥬', '🍅', '🧅', '🍞'], points: 120 },
    { name: "BLT Especial", ingredients: ['🍞', '🥩', '🥓', '🥬', '🍅', '🍞'], points: 180 },
    { name: "Monstruo", ingredients: ['🍞', '🥩', '🧀', '🥓', '🥩', '🥬', '🍅', '🥒', '🍞'], points: 300 }
];

const CUSTOMER_EMOJIS = ['👨', '👩', '👱‍♂️', '👩‍🦰', '👮‍♂️', '👷‍♀️', '🕵️‍♂️', '🧛‍♂️'];

// --- CLASE CLIENTE ---
// Maneja la información y la barra de tiempo individual de cada cliente.
class Customer {
    constructor(id, level) {
        this.id = id;
        this.recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
        this.emoji = CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)];
        
        // La paciencia disminuye más rápido en niveles altos
        this.maxPatience = Math.max(10, 30 - (level * 2)); 
        this.currentPatience = this.maxPatience;
        
        this.element = this.createHTML();
        this.timer = null;
    }

    createHTML() {
        const div = document.createElement('div');
        div.className = 'customer-card';
        div.id = `customer-${this.id}`;
        
        div.innerHTML = `
            <div class="customer-header">
                <span class="customer-emoji">${this.emoji}</span>
                <h4>${this.recipe.name}</h4>
            </div>
            <div class="order-recipe">${this.recipe.ingredients.join('')}</div>
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

                // Cambiar color de la barra según la paciencia
                if (percentage < 30) fillBar.style.backgroundColor = 'var(--danger)';
                else if (percentage < 60) fillBar.style.backgroundColor = 'var(--warning)';
            }

            if (this.currentPatience <= 0) {
                clearInterval(this.timer);
                onTimeout(this); // Llama a la función del GameManager cuando se acaba el tiempo
            }
        }, 1000); // Se actualiza cada segundo
    }

    destroy() {
        clearInterval(this.timer);
        if (this.element) {
            this.element.remove();
        }
    }
}

// --- CONTROLADOR PRINCIPAL DEL JUEGO ---
class GameManager {
    constructor() {
        this.score = 0;
        this.lives = 3;
        this.combo = 1.0;
        this.level = 1;
        this.ordersCompleted = 0; // CONTADOR CLAVE: Lleva la cuenta de los pedidos exitosos para el salto de página
        this.plate = [];
        this.customers = [];
        this.customerCount = 0;
        this.spawnInterval = null;
        
        this.DOM = {
            score: document.getElementById('score-display'),
            lives: document.getElementById('lives-display'),
            combo: document.getElementById('combo-display'),
            level: document.getElementById('level-display'),
            plate: document.getElementById('plate'),
            zone: document.getElementById('customers-zone')
        };
    }

    init() {
        this.updateHUD();
        this.startSpawning();
        // Generar primer cliente inmediato
        this.spawnCustomer();
    }

    // Lógica para crear clientes periódicamente
    startSpawning() {
        const spawnRate = Math.max(3000, 8000 - (this.level * 500)); // Más rápido cada nivel
        this.spawnInterval = setInterval(() => {
            if (this.customers.length < 4) { // Máximo 4 clientes a la vez
                this.spawnCustomer();
            }
        }, spawnRate);
    }

    spawnCustomer() {
        this.customerCount++;
        const customer = new Customer(this.customerCount, this.level);
        this.customers.push(customer);
        if (this.DOM.zone) {
            this.DOM.zone.appendChild(customer.element);
        }
        
        // Iniciar el temporizador del cliente. Si se acaba, perdemos vida.
        customer.startWaiting((c) => this.customerLeft(c));
    }

    customerLeft(customer) {
        this.removeCustomer(customer);
        this.combo = 1.0; // Pierdes el combo
        this.loseLife();
        this.createParticles(window.innerWidth/2, 100, '😡');
    }

    removeCustomer(customer) {
        customer.destroy();
        this.customers = this.customers.filter(c => c.id !== customer.id);
    }

    // Interacción con la cocina
    addIngredient(emoji, name) {
        this.plate.push(emoji);
        this.renderPlate();
        // Pequeña vibración en el celular si está disponible
        if(navigator.vibrate) navigator.vibrate(20);
    }

    renderPlate() {
        if (!this.DOM.plate) return;
        this.DOM.plate.innerHTML = '';
        this.plate.forEach(ing => {
            const div = document.createElement('div');
            div.className = 'plate-item';
            div.innerText = ing;
            this.DOM.plate.appendChild(div);
        });
    }

    trashPlate() {
        this.plate = [];
        this.renderPlate();
        this.combo = 1.0; // Tirar comida resetea el combo
        this.updateHUD();
    }

    servePlate() {
        if (this.plate.length === 0) return;

        const currentRecipeStr = JSON.stringify(this.plate);
        
        // Buscar si algún cliente pidió exactamente esto
        const matchedCustomerIndex = this.customers.findIndex(c => 
            JSON.stringify(c.recipe.ingredients) === currentRecipeStr
        );

        if (matchedCustomerIndex !== -1) {
            // ¡ÉXITO!
            const customer = this.customers[matchedCustomerIndex];
            
            // Calcular puntos base + multiplicador de combo
            const pointsEarned = Math.floor(customer.recipe.points * this.combo);
            this.score += pointsEarned;
            this.ordersCompleted++; // Incrementa el contador de pedidos
            
            // Subir combo
            this.combo = Math.min(4.0, this.combo + 0.2); 
            
            // Subir de nivel cada 1000 puntos
            if (Math.floor(this.score / 1000) + 1 > this.level) {
                this.level++;
                clearInterval(this.spawnInterval);
                this.startSpawning(); // Actualizar dificultad
                this.createParticles(window.innerWidth/2, window.innerHeight/2, '⭐', 30);
            }

            // Efectos visuales de dinero
            const rect = customer.element.getBoundingClientRect();
            this.createParticles(rect.left + rect.width/2, rect.top + rect.height/2, '💸');

            this.removeCustomer(customer);
            this.plate = [];
            this.renderPlate();

            console.log(`Pedidos completados en restaurante: ${this.ordersCompleted} / 10`);

            // --- SALTO DE PÁGINA AUTOMÁTICO AL MINIJUEGO DE LA MOTO AL LLEGAR A 10 PEDIDOS ---
            if (this.ordersCompleted >= 10) {
                alert("¡Excelente trabajo culinario! Has completado los 10 pedidos. ¡Es hora de entregar los domicilios en moto! 🏍️💨");
                window.location.href = 'delivery.html';
                return;
            }
            
        } else {
            // ERROR - Pedido equivocado
            this.plate = [];
            this.renderPlate();
            this.combo = 1.0;
            this.createParticles(window.innerWidth/2, window.innerHeight/2, '❌');
        }
        
        this.updateHUD();
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
        if (this.DOM.lives) this.DOM.lives.innerText = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives);
    }

    // Sistema avanzado de partículas visuales
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
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            
            // Dirección aleatoria
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
            p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
            
            container.appendChild(p);
            
            // Limpiar el DOM después de la animación
            setTimeout(() => p.remove(), 1000);
        }
    }

    gameOver() {
        clearInterval(this.spawnInterval);
        this.customers.forEach(c => clearInterval(c.timer));
        
        const screen = document.getElementById('game-over-screen');
        const finalScoreDisplay = document.getElementById('final-score');
        const newRecordMsg = document.getElementById('new-record-msg');
        
        if (screen) screen.classList.remove('hidden');
        if (finalScoreDisplay) finalScoreDisplay.innerText = this.score;

        // Lógica de LocalStorage para guardar el récord
        const currentHigh = localStorage.getItem('burgerMasterHighScore') || 0;
        if (this.score > currentHigh) {
            localStorage.setItem('burgerMasterHighScore', this.score);
            if (newRecordMsg) newRecordMsg.classList.remove('hidden');
        }
    }
}

// Instanciar e iniciar el juego automáticamente al cargar la página
let gameManager;
window.onload = () => {
    if (document.getElementById('customers-zone')) {
        gameManager = new GameManager();
        gameManager.init();
    }
};