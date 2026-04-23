// ═══════════════════════════════════════════════════════
//  server.js – Backend Express  |  Gestion des voitures
// ═══════════════════════════════════════════════════════
'use strict';

const express    = require('express');
const mongoose   = require('mongoose');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Connexion MongoDB ────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gestion_voitures';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connecté'))
    .catch(err => console.error('❌ Erreur MongoDB:', err));

// ── Schéma Voiture ───────────────────────────────────────
const carSchema = new mongoose.Schema({
    marque: { type: String, required: true, trim: true },
    modele: { type: String, required: true, trim: true },
    annee:  { type: Number, required: true, min: 1886, max: new Date().getFullYear() + 1 }
}, { timestamps: true });

const Car = mongoose.model('Car', carSchema);

// ── Routes CRUD ──────────────────────────────────────────
app.get('/api/cars',       async (req, res) => {
    const cars = await Car.find().sort({ createdAt: -1 });
    res.json(cars);
});

app.post('/api/cars',      async (req, res) => {
    const car = new Car(req.body);
    await car.save();
    res.status(201).json(car);
});

app.put('/api/cars/:id',   async (req, res) => {
    const car = await Car.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(car);
});

app.delete('/api/cars/:id', async (req, res) => {
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: 'Voiture supprimée' });
});

// ── Health Check ─────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'OK', uptime: process.uptime() }));

// ── Démarrage ────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚗 Serveur démarré sur le port ${PORT}`));

module.exports = app;
