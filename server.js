const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Esto le dice al servidor que comparta todos tus archivos (HTML, CSS, JS)
app.use(express.static(__dirname));

// Cuando alguien abra la página, le manda el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`El servidor está corriendo chimba en el puerto ${PORT}`);
});