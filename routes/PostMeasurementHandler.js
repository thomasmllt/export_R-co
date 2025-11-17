// routes/objects.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Middleware de debug : affiche ce que la route reçoit (headers, query, params, body)
router.use((req, res, next) => {
  try {
    console.log('--- postMeasurement DEBUG ---');
    console.log('Method:', req.method);
    console.log('Path:', req.originalUrl || req.path);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Params:', JSON.stringify(req.params, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('----------------------------');
  } catch (e) {
    console.log('postMeasurement debug error:', e);
  }
  next();
});

// reception des données depuis l'app mobile
router.post("/", async (req, res) => {
  const data = req.body;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return res.status(400).json({
      status: "error",
      message: "Aucune donnée reçue"
    });
  }

  
  if (!data[0]?.sensorType || !data[0]?.measurements) {
    return res.status(400).json({
      status: "error",
      message: "Format invalide"
    });
  }

 
  console.log("Données reçues depuis l'app mobile :", JSON.stringify(data, null, 2));

  return res.status(201).json({
    status: "ok",
    received: true,
    count: data[0].measurements.length,
  });
});



module.exports = router;

