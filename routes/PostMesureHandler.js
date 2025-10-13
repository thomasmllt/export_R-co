// routes/objects.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Pour récupérer les données envoyées par l'app Dart en CSV
// Code à mettre sur le terminal la premère fois : npm i js-yaml csv-parse

import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { parse } from 'csv-parse/sync';

export async function parseFrontMatterCsv(path) {
  const txt = await fs.readFile(path, 'utf8');

  // Séparation sur les délimiteurs --- en début/fin de front-matter
  const parts = txt.split(/^---\s*$/m).map(s => s.trim());
  // Expecté : ["", "yaml...", "csv..."] si le fichier commence par ---
  if (parts.length < 3) throw new Error('Front-matter manquant (délimiteurs ---)');

  const meta = yaml.load(parts[1]);          // { serial, position, type, ... }
  const csvText = parts.slice(2).join('\n'); // tout ce qui suit

  // Parse CSV (1ère ligne = entêtes)
  const rows = parse(csvText, { columns: true, skip_empty_lines: true });

  return { meta, rows };
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
