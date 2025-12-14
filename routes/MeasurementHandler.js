// routes/mesures.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const fs = require("fs/promises");
const yaml = require("js-yaml");
const { parse } = require("csv-parse/sync");

// Helper function to parse front-matter CSV
async function parseFrontMatterCsv(path) {
  const txt = await fs.readFile(path, "utf8");
  const parts = txt.split(/^---\s*$/m).map(s => s.trim());
  if (parts.length < 3) throw new Error("Front-matter manquant (délimiteurs ---)");

  const meta = yaml.load(parts[1]);
  const csvText = parts.slice(2).join("\n");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });
  return { meta, rows };
}


// ------------------------   GET   ------------------------


// GET all mesures
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM measurements");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

 // GET measurement by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM measurements WHERE id_beacon=$1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET all measurement timestamp+value+gps for beacon id and type of measurment
router.get("/:id/:type", async (req, res) => {
  const { id, type } = req.params;
  try {
    const result = await pool.query("SELECT timestamp, value, lat, lon FROM measurements WHERE id_beacon=$1 AND id_type=$2 ORDER BY timestamp ASC" , [id, type]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows);
  } catch (err) {
    console.error(err);     res.status(500).json({ error: err.message });
  }
});

// ------------------------   POST PUT DELETE   ------------------------
// Ces fonctions ont été crées mais n'ont pas été implémentées dans notre démonstration. Elles pourraient servir pour une future amélioration du service.


// POST create new mesure
router.post("/", async (req, res) => {
  const { valeur, date, balise_id } = req.body;
  if (valeur === undefined || !date || !balise_id)
    return res.status(400).json({ error: "value, timestamp, and id_beacon are required" });

  try {
    const result = await pool.query(
      "INSERT INTO measurements (value, timestamp, id_beacon) VALUES ($1, $2, $3) RETURNING *",
      [valeur, date, balise_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update mesure
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { valeur, date, balise_id } = req.body;
  if (valeur === undefined || !date || !balise_id)
    return res.status(400).json({ error: "valeur, date, and balise_id are required" });

  try {
    const result = await pool.query(
      "UPDATE mesures SET valeur=$1, date=$2, balise_id=$3 WHERE id=$4 RETURNING *",
      [valeur, date, balise_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE mesure
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM mesures WHERE id=$1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- CSV / Front-matter Upload -------------------

// POST /mesures/upload
router.post("/upload", async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: "path is required" });

  const client = await pool.connect();
  let ok = 0, ko = 0;

  try {
    const { meta, rows } = await parseFrontMatterCsv(path);
    await client.query("BEGIN");

    for (const r of rows) {
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
    }

    await client.query("COMMIT");
    res.json({ success: true, inserted: ok, failed: ko, meta });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
