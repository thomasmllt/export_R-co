const express = require("express");
const router = express.Router();
const pool = require("../db");
const https = require("https");

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
// Attend un objet { sensors: [ { sensorType, gps:{lat,lon}, measurements:[{currentValue, historyAcquisitionTime}, ...] }, ... ] }
// Pas de beacon_id : on crée/trouve une balise en fonction du GPS (±10m)
router.post("/", async (req, res) => {
  const { sensors } = req.body || {};
  if (!Array.isArray(sensors) || sensors.length === 0) {
    return res.status(400).json({ status: "error", message: "Champ 'sensors' manquant ou vide" });
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = [];
  let beaconsCreated = 0;
  let typesCreated = 0;
  const typeCache = new Map(); // sensorType -> id_type
  const createdBeaconIds = new Set();

  // Reverse-geocode lat/lon into a nearby city using Nominatim (OSM).
  const reverseGeocodeCity = (lat, lon) => new Promise((resolve) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    https.get(url, { headers: { "User-Agent": "r-co-backend/1.0" }, signal: controller.signal }, (resp) => {
      let data = "";
      resp.on("data", (chunk) => { data += chunk; });
      resp.on("end", () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          const addr = json && json.address ? json.address : {};
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.state;
          resolve(city || null);
        } catch (_e) {
          resolve(null);
        }
      });
    }).on("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });

  try {
    // Détection colonnes tables
    const colRes = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('measurements','type_measurement')"
    );
    const measurementCols = colRes.rows.filter(r => r.table_name === 'measurements').map(r => r.column_name);
    const typeCols = colRes.rows.filter(r => r.table_name === 'type_measurement').map(r => r.column_name);
    const hasIdType = measurementCols.includes('id_type');
    const hasLatLon = measurementCols.includes('lat') && measurementCols.includes('lon');
    const hasTypeDescription = typeCols.includes('description');
    const hasTypeUnit = typeCols.includes('unit');

    console.log('[postMeasurement] measurement columns:', measurementCols);
    console.log('[postMeasurement] hasLatLon:', hasLatLon, 'hasIdType:', hasIdType);

    // Traiter chaque sensor
    for (const sensor of sensors) {
      const { sensorType, gps, measurements } = sensor;
      if (!sensorType) {
        errors.push({ sensorType, error: "sensorType manquant" });
        continue;
      }

      // GPS obligatoire pour trouver/créer une balise
      if (!gps || gps.lat == null || gps.lon == null) {
        errors.push({ sensorType, error: "GPS manquant ou incomplet" });
        continue;
      }

      const lat = Number(gps.lat);
      const lon = Number(gps.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        errors.push({ sensorType, error: "GPS invalide (non-numérique)" });
        continue;
      }

      // Haversine distance en km
      const haversineKm = (lat1, lon1, lat2, lon2) => {
        const toRad = (d) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Chercher une balise existante à ±10m (0.01 km)
      let beaconId = null;
      try {
        // Récupérer tous les beacons et leurs GPS (moyenne des mesures)
        const allBeacons = await client.query(
          `SELECT DISTINCT b.id, 
             AVG(m.lat) as avg_lat, AVG(m.lon) as avg_lon
           FROM beacons b
           LEFT JOIN measurements m ON m.id_beacon = b.id
           WHERE m.lat IS NOT NULL AND m.lon IS NOT NULL
           GROUP BY b.id`
        );

        // Trouver celui le plus proche (Haversine < 0.01 km)
        let closestBeacon = null;
        let minDist = 0.01;
        for (const row of allBeacons.rows) {
          const dist = haversineKm(lat, lon, row.avg_lat, row.avg_lon);
          if (dist < minDist) {
            minDist = dist;
            closestBeacon = row.id;
          }
        }

        if (closestBeacon) {
          beaconId = closestBeacon;
          console.log(`[postMeasurement] Found nearby beacon ${beaconId} for GPS ${lat},${lon}`);
        }
      } catch (e) {
        console.log(`[postMeasurement] Error finding beacon: ${e.message}`);
      }

      // Créer une nouvelle balise si aucune trouvée
      if (!beaconId) {
        try {
          const geoName = await reverseGeocodeCity(lat, lon);
          const name = geoName || `Auto ${Date.now()}`;
          const serial = `AUTO_${Date.now()}`;

          const ins = await client.query(
            `INSERT INTO beacons (serial, name, description) VALUES ($1, $2, $3) RETURNING id`,
            [serial, name, null]
          );
          beaconId = ins.rows[0].id;
          createdBeaconIds.add(beaconId);
          beaconsCreated++;
          console.log(`[postMeasurement] Created beacon ${beaconId} at ${name} (${lat},${lon})`);
        } catch (e) {
          errors.push({ sensorType, error: "Création beacon échouée: " + e.message });
          continue;
        }
      }

      // Résoudre/créer le type de mesure
      let idType = null;
      if (hasIdType) {
        try {
          if (typeCache.has(sensorType)) {
            idType = typeCache.get(sensorType);
          } else {
            const r = await client.query("SELECT id_type FROM type_measurement WHERE name=$1 LIMIT 1", [sensorType]);
            if (r.rowCount === 0) {
              const cols = ['name'];
              const vals = [sensorType];
              const placeholders = ['$1'];
              let paramIndex = 2;
              if (hasTypeUnit) { cols.push('unit'); placeholders.push(`$${paramIndex++}`); vals.push(null); }
              if (hasTypeDescription) { cols.push('description'); placeholders.push(`$${paramIndex++}`); vals.push(null); }
              const insertSql = `INSERT INTO type_measurement (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING id_type`;
              const crt = await client.query(insertSql, vals);
              idType = crt.rows[0].id_type;
              typesCreated++;
            } else {
              idType = r.rows[0].id_type;
            }
            typeCache.set(sensorType, idType);
          }
        } catch (e) {
          errors.push({ sensorType, error: "Erreur lookup/creation type: " + e.message });
        }
      }

      // Insérer les mesures
      if (!Array.isArray(measurements) || measurements.length === 0) {
        continue;
      }

      for (const m of measurements) {
        const { currentValue, historyAcquisitionTime } = m;
        if (currentValue == null || !historyAcquisitionTime) {
          skipped++;
          continue;
        }

        try {
          // Vérifier doublon
          let existsQuery, existsParams;
          if (hasIdType) {
            existsQuery = `SELECT 1 FROM measurements WHERE id_beacon=$1 AND id_type=$2 AND timestamp=$3 LIMIT 1`;
            existsParams = [beaconId, idType, historyAcquisitionTime];
          } else {
            existsQuery = `SELECT 1 FROM measurements WHERE id_beacon=$1 AND timestamp=$2 LIMIT 1`;
            existsParams = [beaconId, historyAcquisitionTime];
          }

          const exists = await client.query(existsQuery, existsParams);
          if (exists.rowCount > 0) {
            skipped++;
            continue;
          }

          // Insérer la mesure avec lat/lon
          if (hasIdType && hasLatLon) {
            await client.query(
              `INSERT INTO measurements (id_beacon, id_type, timestamp, value, lat, lon) VALUES ($1,$2,$3,$4,$5,$6)`,
              [beaconId, idType, historyAcquisitionTime, currentValue, lat, lon]
            );
          } else if (hasIdType) {
            await client.query(
              `INSERT INTO measurements (id_beacon, id_type, timestamp, value) VALUES ($1,$2,$3,$4)`,
              [beaconId, idType, historyAcquisitionTime, currentValue]
            );
          } else if (hasLatLon) {
            await client.query(
              `INSERT INTO measurements (id_beacon, timestamp, value, lat, lon) VALUES ($1,$2,$3,$4,$5)`,
              [beaconId, historyAcquisitionTime, currentValue, lat, lon]
            );
          } else {
            await client.query(
              `INSERT INTO measurements (id_beacon, timestamp, value) VALUES ($1,$2,$3)`,
              [beaconId, historyAcquisitionTime, currentValue]
            );
          }
          inserted++;
        } catch (e) {
          errors.push({ sensorType, error: "Insertion échouée: " + e.message });
        }
      }
    }

    return res.status(201).json({
      status: 'ok',
      sensorsProcessed: sensors.length,
      measurementsInserted: inserted,
      measurementsSkipped: skipped,
      beaconsCreated,
      createdBeaconIds: Array.from(createdBeaconIds),
      typesCreated,
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

