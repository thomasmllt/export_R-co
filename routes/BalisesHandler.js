// routes/BalisesHandler.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET id of all beacons in db
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id FROM Balises");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//GET serial of a beacon through its id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT serial FROM Balises WHERE id=$1", id);
    if (result.rows.length == 0) return res.status(404).json({ error: "Serial not found" });
    res.json(result);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET position of a beacon through its id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT position FROM Balises WHERE id=$1", id);
    if (result.rows.length == 0) return res.status(404).json({ error: "Position not found" });
    res.json(result);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET name of a beacon through its id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT name FROM Balises WHERE id=$1", id);
    if (result.rows.length == 0) return res.status(404).json({ error: "Name not found" });
    res.json(result);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//GET description of a beacon through its id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT description FROM Balises WHERE id=$1", id);
    if (result.rows.length == 0) return res.status(404).json({ error: "Description not found" });
    res.json(result);
  } catch (err){
    res.status(500).json({ error: err.message });
  }
  })

//PUT update name of a beacon through its id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const result = await pool.query(
      "UPDATE Balises SET name=$1 WHERE id=$2", [name, id]);
    res.json("Name updated");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//PUT update description of a beacon through its id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
    const result = await pool.query(
      "UPDATE Balises SET name=$1 WHERE id=$2", [description, id]);
    res.json("Name updated");
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//GET id from (Serial, Position) of a beacon
router.get("/", async(req, res) => {
  const {serial, position} = req.body;
  // approximation position ici ??
  try {
    const result = await pool.query("SELECT id FROM Balises WHERE serial = $1 AND position=$2", [serial, position]);
    if (result.rows.length > 1) return res.status(300).json({ error: "Error: Several beacons with same serial and position in DB" }); 
    if (result.rows.length == 0) return res.status(404).json({ error: "Beacon not found"});
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message });
}});







//// TEMPLATE A DELETE
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

// PUT update object
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, value } = req.body;
  try {
    const result = await pool.query(
      "UPDATE objects SET name=$1, value=$2 WHERE id=$3 RETURNING *",
      [name, value, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE object
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM objects WHERE id=$1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
