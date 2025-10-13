// routes/objects.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all objects
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM objects");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
