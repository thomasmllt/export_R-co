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
     const result = await pool.query("SELECT MAX(timestamp) FROM measurements WHERE id_beacon=$1", [id]);
     if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
     res.json(result.rows[0]);
   } catch (err) {
     console.error(err);
     res.status(500).json({ error: err.message });
   }
 });
 
//PUT update name of a beacon through its id

//Test Fonctionnel OK
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
