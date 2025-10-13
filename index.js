import express from "express";

// Création de l’application Express
const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Route simple de test
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API R-co 🚀");
});

// Route pour recevoir les données de ton app Dart
app.post("/balises", (req, res) => {
  const { id, valeur } = req.body;
  console.log(`Balise reçue : ${id} = ${valeur}`);

  // (Ici, on stockera plus tard en base)
  res.json({ message: "Données reçues ✅", balise: { id, valeur } });
});

// Lancer le serveur
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ API en écoute sur http://localhost:${PORT}`));
