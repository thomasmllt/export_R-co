import express from "express";

// Création de l’application Express
const app = express();

// Middleware pour parser le JSON --- Utile ?
app.use(express.json());

const baliseRouter = require("./routes/BalisesHandler");
const postMesureRouter = require("./routes/PostMesureHandler");
const typeRouter = require("./routes/TypeHandler"); 

// Route simple de test
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API R-co");
});

// Dispatch vers les handler correspondant
app.use("/balise", baliseRouter);
app.use("/postMesure", postMesureRouter);
app.use("/type", typeRouter);

// // Route pour recevoir les données de l'app
// app.post("/balises", (req, res) => {
//   const { id, valeur } = req.body;
//   console.log('Balise reçue : ${id} = ${valeur}');

//   // (Ici, on stockera plus tard en base)
//   res.json({ message: "Données reçues", balise: { id, valeur } });
// });

// Lancer le serveur
const PORT = 5000;
app.listen(PORT, () => console.log('✅ API en écoute sur http://localhost:${PORT}'));
