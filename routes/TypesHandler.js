// routes/TypeHandler.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ------------------- CRUD Types de Mesure -------------------

// GET all types
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Type_measurement ORDER BY id_type");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET type by id
router.get("/:id", async (req, res) => {
  const { id_type } = req.params;
  try {
    const result = await pool.query("SELECT * FROM Type_measurement WHERE id_type=$1", [id_type]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new type
router.post("/", async (req, res) => {
  const { name, unit, description } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: "name and unit are required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO Type_measurement (name, unit) VALUES ($1, $2) RETURNING *",
      [name, unit]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update type
router.put("/:id", async (req, res) => {
  const { id_type } = req.params;
  const { name, unit } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: "name and unit are required" });
  }

  try {
    const result = await pool.query(
      "UPDATE type_mesure SET name=$1, unit=$2 WHERE id_type=$3 RETURNING *",
      [name, unit, id_type]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE type
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM Type_measurement WHERE id_type=$1 RETURNING *",
      [id_type]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
