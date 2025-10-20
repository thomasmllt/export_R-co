const express = require("express");

// Création de l’application Express
const app = express();

// Middleware pour parser le JSON --- Utile ?
app.use(express.json());

const beaconRouter = require("./routes/BeaconHandler");
const postMeasurementRouter = require("./routes/PostMeasurementHandler");
const typeRouter = require("./routes/TypesHandler"); 
const measurementRouter = require("./routes/MeasurementHandler")

// Route simple de test
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API R-co");
});

// Dispatch vers les handler correspondant
app.use("/beacon", beaconRouter);
app.use("/postMeasurement", postMeasurementRouter);
app.use("/type", typeRouter);
app.use("/measurement", measurementRouter);

// Lancer le serveur
const PORT = 3000;
app.listen(PORT, () => console.log("Server running at http://localhost:",PORT));
