/**
 * BURGER MASTER PRO - Servidor Web Backend (Node.js & Express)
 * Configurado para despliegue en la nube (Render) con gestión de rutas estáticas,
 * logs en tiempo real y manejo de errores avanzados.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES DE UTILIDAD Y LOGS ---
// Registra cada petición HTTP que entra al servidor con fecha y hora exacta
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} request received for: ${req.url}`);
    next();
});

// Configurar cabeceras de seguridad básicas y rendimiento para archivos estáticos
app.use(express.static(__dirname, {
    maxAge: '1d', // Cache para optimizar la carga de assets gráficos en el navegador
    etag: true
}));

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