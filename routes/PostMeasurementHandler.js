const express = require("express");
const router = express.Router();
const pool = require("../db");

// Debug middleware
router.use((req, res, next) => {
  try {
    console.log("--- postMeasurement DEBUG ---");
    console.log("Method:", req.method);
    console.log("Path:", req.originalUrl || req.path);
    console.log("Body:", JSON.stringify(req.body, null, 2));
  } catch (e) {
    console.log("postMeasurement debug error:", e);
  }
  next();
});

// POST /postMeasurement
// Attend un objet { sensors: [ { sensorType, beacon_id, gps:{lat,lon}, measurements:[{currentValue, historyAcquisitionTime}, ...] }, ... ] }
router.post("/", async (req, res) => {
  const { sensors } = req.body || {};
  if (!Array.isArray(sensors) || sensors.length === 0) {
    return res.status(400).json({ status: "error", message: "Champ 'sensors' manquant ou vide" });
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = [];
  let gpsUpdates = 0;
  let typesCreated = 0;
  const typeCache = new Map(); // sensorType -> id_type

  try {
    // Détection colonnes tables
    const colRes = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('measurements','type_measurement')"
    );
    const measurementCols = colRes.rows.filter(r => r.table_name === 'measurements').map(r => r.column_name);
    const typeCols = colRes.rows.filter(r => r.table_name === 'type_measurement').map(r => r.column_name);
    const hasIdType = measurementCols.includes('id_type');
    const hasTypeDescription = typeCols.includes('description');
    const hasTypeUnit = typeCols.includes('unit');

    // Détection dynamique des noms de colonnes clés dans measurements
    const beaconIdCol = ['id_beacon','beacon_id','balise_id'].find(c => measurementCols.includes(c)) || 'id_beacon';
    const tsCol = ['timestamp','ts','time','created_at'].find(c => measurementCols.includes(c)) || 'timestamp';
    const valueCol = ['value','valeur','val'].find(c => measurementCols.includes(c)) || 'value';

    console.log('[postMeasurement] measurement columns:', measurementCols);
    console.log('[postMeasurement] mapped columns => beacon:', beaconIdCol, ' timestamp:', tsCol, ' value:', valueCol, ' hasIdType:', hasIdType);

    const createdBeaconIds = new Set();

    // Map des beacon_id d'origine -> id réel créé (si auto-créé sans utiliser l'id fourni)
    const beaconIdMap = new Map();

    for (const sensor of sensors) {
      const { sensorType, beacon_id, gps, measurements } = sensor;
      if (!sensorType || !beacon_id) {
        errors.push({ sensorType, beacon_id, error: "sensorType ou beacon_id manquant" });
        continue;
      }

      // Vérifier existence balise et création automatique si absente
      try {
        // Utiliser id effectif si précédemment mappé
        const effectiveBeaconId = beaconIdMap.get(beacon_id) || beacon_id;
        const beaconCheck = await client.query("SELECT 1 FROM beacons WHERE id=$1", [effectiveBeaconId]);
        if (beaconCheck.rowCount === 0) {
          // Chercher GPS le plus pertinent pour cette balise (priorité sensorType GPS_S)
          let lat = null, lon = null;
          if (sensorType === 'GPS_S' && gps && gps.lat != null && gps.lon != null) {
            lat = gps.lat; lon = gps.lon;
          } else {
            const gpsSensor = sensors.find(s => s.beacon_id === beacon_id && s.sensorType === 'GPS_S' && s.gps && s.gps.lat != null && s.gps.lon != null);
            if (gpsSensor) { lat = gpsSensor.gps.lat; lon = gpsSensor.gps.lon; }
          }
          if (lat == null || lon == null) { lat = 0; lon = 0; }

          try {
            const serial = `AUTO_${beacon_id}`;
            const name = `Auto ${beacon_id}`;
            const position = `${lat},${lon}`;
            // Ne pas forcer l'id si la colonne est identity; récupérer celui généré
            const ins = await client.query(
              `INSERT INTO beacons (serial, position, name, description)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [serial, position, name, null]
            );
            const newId = ins.rows[0].id;
            beaconIdMap.set(beacon_id, newId);
            createdBeaconIds.add(newId);
          } catch (e) {
            errors.push({ sensorType, beacon_id, error: "Création beacon échouée: " + e.message });
            // Si la création échoue, ne pas insérer les mesures
            continue;
          }
        }
      } catch (e) {
        errors.push({ sensorType, beacon_id, error: "Erreur vérification/creation beacon: " + e.message });
        continue;
      }

      // GPS update
      const effectiveBeaconId = beaconIdMap.get(beacon_id) || beacon_id;
      if (sensorType === 'GPS_S' && gps && gps.lat != null && gps.lon != null) {
        try {
          const position = `${gps.lat},${gps.lon}`;
          await client.query("UPDATE beacons SET position = $1 WHERE id=$2", [position, effectiveBeaconId]);
          gpsUpdates++;
        } catch (e) {
          errors.push({ sensorType, beacon_id, error: "Échec mise à jour GPS: " + e.message });
        }
      }

      // Type lookup / creation (si measurements a id_type)
      let idType = null;
      if (hasIdType) {
        try {
          if (typeCache.has(sensorType)) {
            idType = typeCache.get(sensorType);
          } else {
            const r = await client.query("SELECT id_type FROM type_measurement WHERE name=$1 LIMIT 1", [sensorType]);
            if (r.rowCount === 0) {
              // Construction dynamique de l'INSERT selon colonnes dispo
              const cols = ['name'];
              const vals = [sensorType];
              const placeholders = ['$1'];
              let paramIndex = 2;
              if (hasTypeUnit) { cols.push('unit'); placeholders.push(`$${paramIndex++}`); vals.push(null); }
              if (hasTypeDescription) { cols.push('description'); placeholders.push(`$${paramIndex++}`); vals.push(null); }
              const insertSql = `INSERT INTO type_measurement (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING id_type`;
              const crt = await client.query(insertSql, vals);
              idType = crt.rows[0].id_type; typesCreated++;
            } else {
              idType = r.rows[0].id_type;
            }
            typeCache.set(sensorType, idType);
          }
        } catch (e) {
          errors.push({ sensorType, beacon_id, error: "Erreur lookup/creation type: " + e.message });
        }
      }

      if (!Array.isArray(measurements)) continue;
      for (const m of measurements) {
        const { currentValue, historyAcquisitionTime } = m;
        if (currentValue == null || !historyAcquisitionTime) { skipped++; continue; }
        try {
          // Doublon
          let existsQuery, existsParams;
          if (hasIdType) {
            if (idType == null) { skipped++; continue; }
            existsQuery = `SELECT 1 FROM measurements WHERE ${beaconIdCol}=$1 AND id_type=$2 AND ${tsCol}=$3 LIMIT 1`;
            existsParams = [effectiveBeaconId, idType, historyAcquisitionTime];
          } else {
            existsQuery = `SELECT 1 FROM measurements WHERE ${beaconIdCol}=$1 AND ${tsCol}=$2 LIMIT 1`;
            existsParams = [effectiveBeaconId, historyAcquisitionTime];
          }
          const exists = await client.query(existsQuery, existsParams);
          if (exists.rowCount > 0) { skipped++; continue; }

          // Insert
          if (hasIdType) {
            await client.query(
              `INSERT INTO measurements (${valueCol}, ${tsCol}, ${beaconIdCol}, id_type) VALUES ($1,$2,$3,$4)`,
              [currentValue, historyAcquisitionTime, effectiveBeaconId, idType]
            );
          } else {
            await client.query(
              `INSERT INTO measurements (${valueCol}, ${tsCol}, ${beaconIdCol}) VALUES ($1,$2,$3)`,
              [currentValue, historyAcquisitionTime, effectiveBeaconId]
            );
          }
          inserted++;
        } catch (e) {
          errors.push({ sensorType, beacon_id, error: "Insertion échouée: " + e.message });
        }
      }
    }

    return res.status(201).json({
      status: 'ok',
      sensorsProcessed: sensors.length,
      measurementsInserted: inserted,
      measurementsSkipped: skipped,
      gpsUpdates,
      typesCreated,
      beaconsCreated: createdBeaconIds.size,
      createdBeaconIds: Array.from(createdBeaconIds),
      beaconIdMap: Array.from(beaconIdMap.entries()).map(([original, actual]) => ({ original, actual })),
      columnMapping: { beaconIdCol, tsCol, valueCol, hasIdType },
      errors
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: 'error', message: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;

