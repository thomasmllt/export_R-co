// routes/objects.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Middleware de debug : affiche ce que la route reçoit (headers, query, params, body)
router.use((req, res, next) => {
  try {
    console.log('--- postMeasurement DEBUG ---');
    console.log('Method:', req.method);
    console.log('Path:', req.originalUrl || req.path);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Params:', JSON.stringify(req.params, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('----------------------------');
  } catch (e) {
    console.log('postMeasurement debug error:', e);
  }
  next();
});

// reception des données depuis l'app mobile
router.post("/", async (req, res) => {
  return res.status(201).json({ status: "ok" });
});

// @Pour récupérer les données envoyées par l'app Dart en CSV
// Code à mettre sur le terminal la premère fois : npm i js-yaml csv-parse

const fs = require('node:fs/promises');
const yaml = require('js-yaml');
const { parse } = require('csv-parse/sync');

async function parseFrontMatterCsv(path) {
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


// Get Id from Serial + Coo // Need to do that before sending data into table mesure





// Add Measure


// Il semblerait que la normalisation c'est pas mal 



// POST endpoint to handle mesure import
router.post("/import-mesure", async (req, res) => {
  const { filePath, id_balise } = req.body; // Expect filePath and id_balise in request body
  let client;
  let ok = 0, ko = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Parse the CSV/YAML file
    const { meta, rows } = await parseFrontMatterCsv(filePath);

    // 1) Type de mesure (issu du YAML)
    const id_type = meta.type;
    if (!id_type) throw new Error('meta.type manquant');

    // 2) Normalisation rapide des lignes CSV
    const mesures = rows.map((r, i) => {
      if (!r.ts || Number.isNaN(Date.parse(r.ts)))
        throw new Error(`Ligne ${i + 1}: ts invalide`);

      const valeur = Number(String(r.valeur ?? r.value).replace(',', '.')); // accepte "valeur" ou "value" dans le CSV
      if (Number.isNaN(valeur))
        throw new Error(`Ligne ${i + 1}: valeur non numérique`);

      return { ts: r.ts, valeur };
    });

    // 3) Requête SQL d’insertion / mise à jour
    const insertMesureSQL = `
      INSERT INTO measurement (id_beacon, timestamp, id_type, value)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id_balise, timestamp, id_type) DO UPDATE
        SET valeur = EXCLUDED.valeur;
    `;

    // 4) Boucle d’insertion
    for (const m of mesures) {
      try {
        await client.query(insertMesureSQL, [id_balise, m.ts, id_type, m.valeur]);
        ok++;
      } catch {
        ko++;
      }
    }

    // 5) Validation de la transaction et réponse
    await client.query('COMMIT');
    res.status(201).json({
      statut: 'ok',
      id_balise,
      typeMesure: id_type,
      recues: mesures.length,
      inserees_ou_mises_a_jour: ok,
      echec: ko
    });
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ erreur: 'import_impossible', message: e.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;

