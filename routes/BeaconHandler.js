// routes/BalisesHandler.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET id of all beacons in db
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id FROM Beacons");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//GET beacon data ({id,serial, name, position, description, last_update})
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const infoResult = await pool.query("SELECT * FROM Beacons WHERE id=$1", [id]);
    if (infoResult.rows.length == 0) return res.status(404).json({ error: "Beacon not found" });   
    const avgTemp = await pool.query("SELECT AVG(value) AS avgTemp FROM (SELECT value FROM measurements WHERE id_beacon = $1 AND id_type = 1 ORDER BY timestamp DESC LIMIT 10);", [id]);
    if (avgTemp.rows.length == 0) return res.status(404).json({ error: "avgTemp not found" });
    const avgPressure = await pool.query("SELECT AVG(value) AS avgPressure FROM (SELECT value FROM measurements WHERE id_beacon = $1 AND id_type = 3 ORDER BY timestamp DESC LIMIT 10);", [id]);
    if (avgPressure.rows.length == 0) return res.status(404).json({ error: "avgPressure not found" });
    const avgHumidity = await pool.query("SELECT AVG(value) AS avgHumidity FROM (SELECT value FROM measurements WHERE id_beacon = $1 AND id_type = 2 ORDER BY timestamp DESC LIMIT 10);", [id]);
    if (avgHumidity.rows.length == 0) return res.status(404).json({ error: "avgHumidity not found" });
    const lastUpdate = await pool.query("SELECT MAX(timestamp) as last_update FROM measurements WHERE id_beacon=$1", [id]);
    if (lastUpdate.rows.length == 0) return res.status(404).json({ error: "last update not found" });

    const result = {...infoResult.rows[0], 
      avgTemp: avgTemp.rows[0].avgtemp || null,
      avgPressure: avgPressure.rows[0].avgpressure || null,
      avgHumidity: avgHumidity.rows[0].avghumidity || null,
      last_update: lastUpdate.rows[0].last_update || null}; //Merge payload
    
    res.json(result)
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET serial of a beacon through its id
router.get("/:id/serial", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT serial FROM Beacons WHERE id=$1", [id]);
    if (result.rows.length == 0) return res.status(404).json({ error: "Serial not found" });
    res.json(result.rows[0])
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET position of a beacon through its id
router.get("/:id/position", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT position FROM Beacons WHERE id=$1", [id]);
    if (result.rows.length == 0) return res.status(404).json({ error: "Position not found" });
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET name of a beacon through its id
router.get("/:id/name", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT name FROM Beacons WHERE id=$1", [id]);
    if (result.rows.length == 0) return res.status(404).json({ error: "Name not found" });
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET description of a beacon through its id
router.get("/:id/description", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT description FROM Beacons WHERE id=$1", [id]);
    if (result.rows.length == 0) return res.status(404).json({ error: "Description not found" });
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

  // GET last_update from beacon id
 router.get("/:id/last_update", async (req, res) => {
   const { id } = req.params;
   try {
     const result = await pool.query("SELECT MAX(timestamp) as last_update FROM measurements WHERE id_beacon=$1", [id]);
     if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
     res.json(result.rows[0]);
   } catch (err) {
     console.error(err);
     res.status(500).json({ error: err.message });
   }
 });
 
//PUT update name of a beacon through its id : Test Fonctionnel OK
router.put("/:id/name", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await pool.query(
      "UPDATE Beacons SET name=$1 WHERE id=$2", [name, id]);
    res.json("Name updated");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//PUT update description of a beacon through its id
// Test OK
router.put("/:id/description", async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
    const result = await pool.query(
      "UPDATE Beacons SET description=$1 WHERE id=$2", [description, id]);
    res.json("Description updated");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST create a new beacon (position stored as POINT)
router.post("/", async (req, res) => {
  const { serial, lat, lon, name, description } = req.body;

  if (!serial || !lat || !lon) {
    return res.status(400).json({
      error: "Missing parameters. Required: serial, lat, lon",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Beacons (serial, position, name, description)
       VALUES ($1, POINT($2, $3), $4, $5)
       RETURNING id`,
      [serial, lat, lon, name || null, description || null]
    );

    return res.status(201).json({
      statut: "ok",
      id: result.rows[0].id,
      created: true
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});



// GET beacon ID with GPS tolerance (~50 meters)
router.get("/getId", async (req, res) => {
  const { serial, lat, lon } = req.query;

  if (!serial || !lat || !lon) {
    return res.status(400).json({
      error: "Missing parameters. Expected: serial, lat, lon"
    });
  }

  // Tolérance en degrés (≈ 50 m)
  const LAT_TOL = 0.00045; // ~ 50 m
  const LON_TOL = 0.00070; // ~ 50 m at latitude ~48°

  try {
    const result = await pool.query(
      `SELECT id
       FROM Beacons
       WHERE serial = $1
       AND ABS(position[0] - $2::float) < $4
       AND ABS(position[1] - $3::float) < $5`,
      [serial, lat, lon, LAT_TOL, LON_TOL]
    );

    if (result.rowCount > 1)
      return res.status(300).json({ error: "Multiple beacons in tolerance area" });

    if (result.rowCount === 0)
      return res.status(404).json({ error: "No beacon found in tolerance radius" });

    res.json({ statut: "ok", id: result.rows[0].id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});








module.exports = router;
