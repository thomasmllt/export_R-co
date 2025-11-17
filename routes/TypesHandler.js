// routes/TypeHandler.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ------------------- CRUD Types de Mesure -------------------


// ----------- GET -----------


// GET all types :OK
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Type_measurement ORDER BY id_type");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET type by id : OK 
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM Type_measurement WHERE id_type=$1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});






// ----------- PUT -----------

// PUT update type : Name
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name ) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      "UPDATE Type_measurement SET name=$1 WHERE id_type=$2 RETURNING *",
      [name, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update type : Unit
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { unit } = req.body;
  if (!unit ) {
    return res.status(400).json({ error: "unit is required" });
  }

  try {
    const result = await pool.query(
      "UPDATE Type_measurement SET unit=$1 WHERE id_type=$2 RETURNING *",
      [unit, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// PUT update type : Description
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  if (!description ) {
    return res.status(400).json({ error: "description is required" });
  }

  try {
    const result = await pool.query(
      "UPDATE Type_measurement SET description=$1 WHERE id_type=$2 RETURNING *",
      [description, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Type not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ----------- POST -----------


// POST create new type : OK
router.post("/", async (req, res) => {
  const { name, unit, description } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ error: "name and unit are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Type_measurement (name, unit, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, unit, description || null]
    );

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);

    //  Gestion de la contrainte UNIQUE du nom du type
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Type with this name already exists" });
    }

    return res.status(500).json({ error: err.message });
  }
});




// ----------- DELETE -----------




// DELETE type
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM Type_measurement WHERE id_type=$1 RETURNING *",
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
