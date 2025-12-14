// Scripts permettant de générer plusieurs mesures en France

const https = require('https');

// 10 villes en France (hors Nantes)
const cities = [
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "Marseille", lat: 43.2965, lon: 5.3698 },
  { name: "Lyon", lat: 45.7640, lon: 4.8357 },
  { name: "Toulouse", lat: 43.6047, lon: 1.4442 },
  { name: "Nice", lat: 43.7102, lon: 7.2620 },
  { name: "Strasbourg", lat: 48.5734, lon: 7.7521 },
  { name: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { name: "Lille", lat: 50.6292, lon: 3.0573 },
  { name: "Rennes", lat: 48.1173, lon: -1.6778 },
  { name: "Montpellier", lat: 43.6108, lon: 3.8767 }
];

// Générer des valeurs aléatoires dans une plage
const randomInRange = (min, max) => Math.random() * (max - min) + min;

// Générer des mesures réalistes pour une journée avec tendances horaires
const generateDayMeasurements = (baseDate, sensorType) => {
  const measurements = [];
  const measurementsPerDay = 48; // Une mesure toutes les 30 minutes
  
  // Valeurs de base par capteur avec variations horaires réalistes
  const sensorConfigs = {
    TEMP_S: {
      baseMin: 5,
      baseMax: 12,
      peakHour: 14,
      peakVariation: 3,
      decimals: 1
    },
    HUMIDITY_S: {
      baseMin: 70,
      baseMax: 85,
      peakHour: 6, // Plus humide le matin
      peakVariation: -15,
      decimals: 1
    },
    PRESSURE_S: {
      baseMin: 1010,
      baseMax: 1020,
      peakHour: 14,
      peakVariation: 5,
      decimals: 0
    },
    DUST_PM1_S: {
      baseMin: 8,
      baseMax: 25,
      peakHour: 18, // Plus de poussière en fin d'après-midi
      peakVariation: 15,
      decimals: 0
    },
    DUST_PM2_5_S: {
      baseMin: 15,
      baseMax: 35,
      peakHour: 18,
      peakVariation: 25,
      decimals: 0
    },
    DUST_PM10_S: {
      baseMin: 25,
      baseMax: 50,
      peakHour: 18,
      peakVariation: 35,
      decimals: 0
    },
    CO2_S: {
      baseMin: 380,
      baseMax: 450,
      peakHour: 10, // Plus élevé en milieu de journée
      peakVariation: 200,
      decimals: 0
    }
  };
  
  const config = sensorConfigs[sensorType];
  const baseValue = randomInRange(config.baseMin, config.baseMax);
  
  for (let i = 0; i < measurementsPerDay; i++) {
    const timestamp = new Date(baseDate);
    timestamp.setMinutes(timestamp.getMinutes() + i * 30);
    
    const hour = timestamp.getHours();
    
    // Variation sinusoïdale autour de l'heure de pic
    const hourDiff = Math.abs(hour - config.peakHour);
    const cycleVariation = Math.cos((hourDiff / 12) * Math.PI) * (config.peakVariation / 2);
    
    // Ajout de bruit réaliste
    const noise = randomInRange(-2, 2);
    
    let value = baseValue + cycleVariation + noise;
    
    // Variation aléatoire légère
    value += randomInRange(-config.baseMax * 0.05, config.baseMax * 0.05);
    
    // Clampages pour rester dans des limites réalistes
    value = Math.max(config.baseMin * 0.8, Math.min(config.baseMax * 1.5, value));
    
    value = Number(value.toFixed(config.decimals));
    
    measurements.push({
      currentValue: value,
      historyAcquisitionTime: timestamp.toISOString()
    });
  }
  
  return measurements;
};

// Générer un payload pour une ville et une journée
const generatePayload = (city, date) => {
  const sensors = [
    {
      sensorType: "TEMP_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "TEMP_S")
    },
    {
      sensorType: "HUMIDITY_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "HUMIDITY_S")
    },
    {
      sensorType: "PRESSURE_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "PRESSURE_S")
    },
    {
      sensorType: "DUST_PM1_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "DUST_PM1_S")
    },
    {
      sensorType: "DUST_PM2_5_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "DUST_PM2_5_S")
    },
    {
      sensorType: "DUST_PM10_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "DUST_PM10_S")
    },
    {
      sensorType: "CO2_S",
      gps: { lat: city.lat, lon: city.lon },
      measurements: generateDayMeasurements(date, "CO2_S")
    }
  ];
  
  return { sensors };
};

// Envoyer un payload à l'API
const sendPayload = (payload) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'r-co-api.onrender.com',
      port: 443,
      path: '/postMeasurement',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
};

// Fonction principale
async function main() {
  console.log("Debut de la generation de donnees pour la derniere semaine de novembre 2025...\n");
  
  let totalSent = 0;
  let totalMeasurements = 0;
  let totalBeaconsCreated = 0;
  
  // Pour chaque ville
  for (const city of cities) {
    console.log(`Traitement de ${city.name}...`);
    
    // Pour chaque jour de la dernière semaine (25-30 novembre = 6 jours)
    for (let day = 25; day <= 30; day++) {
      const date = new Date(2025, 10, day); // Mois 10 = novembre (0-indexed)
      const payload = generatePayload(city, date);
      
      try {
        const result = await sendPayload(payload);
        
        if (result.status === 'ok') {
          totalMeasurements += result.measurementsInserted || 0;
          totalBeaconsCreated += result.beaconsCreated || 0;
          totalSent++;
          
          process.stdout.write(`  25-30 nov: ${totalSent} payloads envoyes\r`);
        } else {
          console.log(`  Alerte ${day} nov: ${result.message || 'Erreur inconnue'}`);
        }
        
        // Pause de 300ms entre chaque requête
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.log(`  Erreur ${day} nov: ${error.message}`);
      }
    }
    
    console.log(`  ${city.name} termine (6 jours envoyes)\n`);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("RESUME FINAL");
  console.log("=".repeat(50));
  console.log(`Requetes envoyees: ${totalSent}`);
  console.log(`Mesures inserees: ${totalMeasurements}`);
  console.log(`Balises creees: ${totalBeaconsCreated}`);
  console.log(`Villes: ${cities.length}`);
  console.log(`Periode: 25-30 novembre 2025 (6 jours)`);
  console.log(`Mesures/jour: 48 mesures x 7 capteurs = 336 par jour`);
  console.log("=".repeat(50));
}

// Exécution
main().catch(console.error);
