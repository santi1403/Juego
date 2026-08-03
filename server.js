/**
 * BURGER MASTER PRO - Servidor Web Backend (Node.js & Express)
 * Configurado para despliegue en la nube (Render) con gestión de rutas estáticas,
 * logs en tiempo real, manejo de errores avanzado y Leaderboard en línea.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// --- ARCHIVO DE PUNTUACIONES EN LÍNEA (LEADERBOARD) ---
const SCORES_FILE = path.join(__dirname, 'scores.json');

function readScores() {
    try {
        return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeScores(list) {
    try {
        fs.writeFileSync(SCORES_FILE, JSON.stringify(list, null, 2));
    } catch (e) {
        console.warn('[AVISO] No se pudo guardar scores.json:', e.message);
    }
}

// --- MIDDLEWARES DE UTILIDAD Y LOGS ---
// Registra cada petición HTTP que entra al servidor con fecha y hora exacta
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} request received for: ${req.url}`);
    next();
});

app.use(express.json());

// Configurar cabeceras de seguridad básicas y rendimiento para archivos estáticos
// maxAge: 0 → sin caché agresiva, así todos ven siempre la última versión del juego
app.use(express.static(__dirname, {
    maxAge: 0,
    etag: true
}));

// --- API DE LEADERBOARD EN LÍNEA ---

// Obtener las mejores puntuaciones (por defecto 10)
app.get('/api/scores', (req, res) => {
    const scores = readScores();
    res.json(scores.slice(0, 10));
});

// Guardar una nueva puntuación { name, score, mode }
app.post('/api/score', (req, res) => {
    const { name, score, mode } = req.body || {};
    if (typeof score !== 'number' || !name) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }
    const cleanName = String(name).trim().slice(0, 20) || 'Anónimo';
    const cleanMode = ['restaurante', 'moto'].includes(mode) ? mode : 'restaurante';
    const list = readScores();
    list.push({
        name: cleanName,
        score: Math.floor(score),
        mode: cleanMode,
        date: new Date().toISOString()
    });
    list.sort((a, b) => b.score - a.score);
    writeScores(list.slice(0, 10));
    res.json({ ok: true, top: list.slice(0, 10) });
});

// --- RUTAS EXPLÍCITAS DEL SITIO WEB ---

// Ruta Principal (Menú de Inicio)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta de la Cocina del Restaurante
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

// Ruta del Minijuego de Motocicleta (Delivery)
app.get('/delivery', (req, res) => {
    res.sendFile(path.join(__dirname, 'delivery.html'));
});

// --- MANEJO DE RUTAS NO ENCONTRADAS (404 FALLBACK) ---
// Si un usuario ingresa una URL inválida, lo redirige de vuelta al menú principal
app.use((req, res) => {
    console.warn(`[AVISO] Ruta no encontrada: ${req.url}. Redirigiendo al inicio.`);
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log('==================================================');
    console.log(`🚀 BURGER MASTER PRO SERVER CORRIENDO CHIMBA`);
    console.log(`🌐 Puerto asignado: ${PORT}`);
    console.log(`📂 Directorio raíz: ${__dirname}`);
    console.log('==================================================');
});
