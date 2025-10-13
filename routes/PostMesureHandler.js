// routes/objects.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Break into lines
let readings = [];
  if (Array.isArray(req.body)) {
    readings = req.body;
  } else if (req.body?.readings && Array.isArray(req.body.readings)) {
    readings = req.body.readings;
  } else if (req.body && typeof req.body === 'object') {
    readings = [req.body];
  }

  if (!readings.length) {
    return res.status(400).json({ error: 'no_readings' });
  }

// Get Id from Serial + Coo

// Add Measure
const client = await pool.connect();
  let ok = 0, ko = 0;
  try {
    await client.query('BEGIN');

    for (const r of readings) {
      try {
        await client.query(
          `INSERT INTO readings (reading_id, tag_id, device_id, payload, ts)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (reading_id) DO NOTHING`,
          [r.reading_id, r.tag_id, r.device_id, r.payload ?? null, r.ts]
        );
        ok++;
      } catch {
        ko++;
      }
    }}




// POST create new object
router.post("/", async (req, res) => {
  const { name, value } = req.body;
  try {
    await pool.query("INSERT INTO objects (name, value) VALUES ($1, $2)", [name, value]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
