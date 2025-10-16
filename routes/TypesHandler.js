// routes/TypeHandler.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ------------------- CRUD Types de Mesure -------------------

// GET all types
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM type_mesure ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET type by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM type_mesure WHERE id=$1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows[0]);
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
      "INSERT INTO type_mesure (name, unit, description) VALUES ($1, $2, $3) RETURNING *",
      [name, unit, description ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update type
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, unit, description } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ error: "name and unit are required" });
  }

  try {
    const result = await pool.query(
      "UPDATE type_mesure SET name=$1, unit=$2, description=$3 WHERE id=$4 RETURNING *",
      [name, unit, description ?? null, id]
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
      "DELETE FROM type_mesure WHERE id=$1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
