const express = require("express");
const router = express.Router();
const pool = require("../db");

// Middleware de debug: logge les requêtes entrantes pour faciliter le diagnostic
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
// Entrée: { sensors: [ { sensorType, beacon_id, gps:{lat,lon}, measurements:[{currentValue, historyAcquisitionTime}, ...] }, ... ] }
// Rôle: crée/met à jour les balises, résout/ajoute les types de mesure, et insère les mesures en évitant les doublons.
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
  const gpsUpdatedThisPayload = new Set(); // évite plusieurs updates GPS pour la même balise dans un payload

  // Helpers
  // parsePosition: convertit une position stockée en base (string "lat,lon" ou tableau [lat, lon]) en objet {lat, lon}
  const parsePosition = (pos) => {
    if (!pos) return null;
    if (Array.isArray(pos) && pos.length === 2) return { lat: Number(pos[0]), lon: Number(pos[1]) };
    if (typeof pos === 'string') {
      const parts = pos.split(',').map(Number);
      if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) return { lat: parts[0], lon: parts[1] };
    }
    return null;
  };

  // haversineKm: calcule la distance en kilomètres entre deux points GPS (formule de Haversine)
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  try {
    // Détection dynamique des colonnes des tables (permet d'adapter le SQL à des schémas variables)
    const colRes = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('measurements','type_measurement')"
    );
    const measurementCols = colRes.rows.filter(r => r.table_name === 'measurements').map(r => r.column_name);
    const typeCols = colRes.rows.filter(r => r.table_name === 'type_measurement').map(r => r.column_name);
    const hasIdType = measurementCols.includes('id_type');
    const hasTypeDescription = typeCols.includes('description');
    const hasTypeUnit = typeCols.includes('unit');

    // Mappage dynamique des colonnes clés de measurements (id balise, timestamp, valeur)
    const beaconIdCol = ['id_beacon','beacon_id','balise_id'].find(c => measurementCols.includes(c)) || 'id_beacon';
    const tsCol = ['timestamp','ts','time','created_at'].find(c => measurementCols.includes(c)) || 'timestamp';
    const valueCol = ['value','valeur','val'].find(c => measurementCols.includes(c)) || 'value';

    console.log('[postMeasurement] measurement columns:', measurementCols);
    console.log('[postMeasurement] mapped columns => beacon:', beaconIdCol, ' timestamp:', tsCol, ' value:', valueCol, ' hasIdType:', hasIdType);

    const createdBeaconIds = new Set();

    // Map des beacon_id d'origine -> id réel créé (si auto-créé sans utiliser l'id fourni)
    // Objectif: garder la cohérence des mesures d'un même payload, même si la balise est nouvellement créée
    const beaconIdMap = new Map();

    for (const sensor of sensors) {
      const { sensorType, beacon_id, gps, measurements } = sensor;
      if (!sensorType || !beacon_id) {
        errors.push({ sensorType, beacon_id, error: "sensorType ou beacon_id manquant" });
        continue;
      }

      // Vérifier existence balise et création automatique si absente
      // Si la balise n'existe pas, on la crée avec des métadonnées minimales et une position GPS si connue
      try {
        // Utiliser id effectif si précédemment mappé
        const effectiveBeaconId = beaconIdMap.get(beacon_id) || beacon_id;
        const beaconCheck = await client.query("SELECT 1 FROM beacons WHERE id=$1", [effectiveBeaconId]);
        if (beaconCheck.rowCount === 0) {
          // Chercher GPS le plus pertinent pour cette balise (n'importe quel sensor qui a des coords GPS valides)
          let lat = null, lon = null;
          if (gps && gps.lat != null && gps.lon != null) {
            lat = gps.lat; lon = gps.lon;
          } else {
            // Fallback: chercher un autre sensor du même beacon avec GPS valides
            const gpsSensor = sensors.find(s => s.beacon_id === beacon_id && s.gps && s.gps.lat != null && s.gps.lon != null);
            if (gpsSensor) { lat = gpsSensor.gps.lat; lon = gpsSensor.gps.lon; }
          }
          if (lat == null || lon == null) { lat = 0; lon = 0; }

          try {
            // NOTE: on génère serial et name automatiquement (peut être personnalisé au besoin)
            const serial = `AUTO${beacon_id}`;
            const name = `AUTO${beacon_id}`;
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

      // Mise à jour GPS avec tolérance de 50m:
      // - si la position a bougé de plus de 50 mètres, on crée une nouvelle balise pour représenter ce déplacement significatif
      // - sinon, on met simplement à jour la position de la balise existante
      // On prend en compte le GPS fourni par n'importe quel sensor (pas seulement GPS_S) pour déclencher cette logique,
      // mais on ne l'applique qu'une seule fois par balise et par payload.
      const effectiveBeaconId = beaconIdMap.get(beacon_id) || beacon_id;
      if (gps && gps.lat != null && gps.lon != null && !gpsUpdatedThisPayload.has(effectiveBeaconId)) {
        try {
          // Get current beacon position
          const curRes = await client.query("SELECT position, serial, name FROM beacons WHERE id=$1 LIMIT 1", [effectiveBeaconId]);
          let shouldCreateNew = false;
          if (curRes.rowCount > 0) {
            const curPos = parsePosition(curRes.rows[0].position);
            if (curPos) {
              const distKm = haversineKm(curPos.lat, curPos.lon, Number(gps.lat), Number(gps.lon));
              // 50m tolerance
              if (distKm > 0.05) {
                shouldCreateNew = true;
              }
            }
          }

          if (shouldCreateNew) {
            // Crée une nouvelle balise pour ce déplacement significatif
            const newSerial = `AUTO_${beacon_id}_${Date.now()}`;
            const newName = `Auto ${beacon_id}`;
            const position = `${gps.lat},${gps.lon}`;
            const ins = await client.query(
              `INSERT INTO beacons (serial, position, name, description)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [newSerial, position, newName, null]
            );
            const newId = ins.rows[0].id;
            // Important: redirige les mesures suivantes du même payload vers cette nouvelle balise
            beaconIdMap.set(beacon_id, newId);
            createdBeaconIds.add(newId);
            gpsUpdates++;
            // Marquer l'ancienne et la nouvelle balise comme déjà traitées côté GPS pour ce payload
            gpsUpdatedThisPayload.add(effectiveBeaconId);
            gpsUpdatedThisPayload.add(newId);
          } else {
            // Tolérance respectée ou position actuelle inconnue: on met à jour la balise existante
            const position = `${gps.lat},${gps.lon}`;
            await client.query("UPDATE beacons SET position = $1 WHERE id=$2", [position, effectiveBeaconId]);
            gpsUpdates++;
            gpsUpdatedThisPayload.add(effectiveBeaconId);
          }
        } catch (e) {
          errors.push({ sensorType, beacon_id, error: "Échec mise à jour GPS: " + e.message });
        }
      }

      // Résolution / création du type de mesure (si la colonne id_type existe dans measurements)
      let idType = null;
      if (hasIdType) {
        try {
          if (typeCache.has(sensorType)) {
            idType = typeCache.get(sensorType);
          } else {
            const r = await client.query("SELECT id_type FROM type_measurement WHERE name=$1 LIMIT 1", [sensorType]);
            if (r.rowCount === 0) {
              // Construction dynamique de l'INSERT selon colonnes dispo (unit/description optionnelles)
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
          // Contrôle de doublon: évite les insertions multiples pour la même balise (+ type si présent) et le même timestamp
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

          // Insertion de la mesure (avec id_type si disponible)
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

