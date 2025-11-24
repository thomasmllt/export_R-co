import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale, // 1. Import de TimeScale
} from "chart.js";
import "chartjs-adapter-date-fns"; // Adaptateur de date nécessaire
import { useParams, useNavigate } from "react-router-dom";
import { markers } from "../src/markers";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale // 1. Enregistrement de TimeScale
);

export default function DetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  // Vérification de l'existence du marker pour éviter les erreurs si l'ID n'est pas trouvé
  const marker = markers.find((m) => m.properties.id == id);
  const name = marker ? marker.name : "Unknown";
  
  const [beaconName, setBeaconName] = React.useState("Chargement...");
  
  // Les données sont maintenant stockées au format {x: Date, y: value}
  const [tempData, setTempData] = React.useState([]);
  const [pressData, setPressData] = React.useState([]);
  
  // Les labels ne sont plus nécessaires pour l'axe des x, mais on les garde s'ils sont utilisés ailleurs.
  const [labelsTemp, setLabelsTemp] = React.useState([]); 
  const [labelsPress, setLabelsPress] = React.useState([]);

  // --- Chargement du Nom de la Balise ---
  React.useEffect(() => {
    async function fetchBeaconName() {
      try {
        const response = await fetch(`http://localhost:3000/beacon/${id}/name`);
        const data = await response.json();
        setBeaconName(data.name);
      } catch (error) {
        console.error("Erreur backend :", error);
        setBeaconName("Erreur lors du chargement");
      }
    }

    fetchBeaconName();
  }, [id]);

  // --- Chargement des Mesures de Température et Pression ---
  React.useEffect(() => {
    async function fetchTemperature() {
      try {
        const response = await fetch(`http://localhost:3000/measurement/${id}/1`);
        const data = await response.json();

        // 2. Modification du format des données pour l'échelle de temps
        setTempData(
          data.map((d) => ({
            x: new Date(d.timestamp), // Utilisation de l'objet Date (horodatage) pour X
            y: d.value, // Valeur pour Y
          }))
        );
        // Les labels sont toujours extraits au cas où vous les utilisez dans des tooltips personnalisés, mais ils ne servent plus à l'axe X.
        setLabelsTemp(
          data.map((d) =>
            new Date(d.timestamp).toLocaleString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })
          )
        );
      } catch (err) {
        console.error("Erreur temp :", err);
      }
    }

    async function fetchPressure() {
      try {
        const response = await fetch(`http://localhost:3000/measurement/${id}/3`);
        const data = await response.json();

        // 2. Modification du format des données pour l'échelle de temps
        setPressData(
          data.map((d) => ({
            x: new Date(d.timestamp), // Utilisation de l'objet Date (horodatage) pour X
            y: d.value, // Valeur pour Y
          }))
        );

        setLabelsPress(
          data.map((d) =>
            new Date(d.timestamp).toLocaleString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })
          )
        );
      } catch (err) {
        console.error("Erreur pression :", err);
      }
    }

    fetchTemperature();
    fetchPressure();
  }, [id]);

  // --- Configuration des Données et Options ---

  // NOTE IMPORTANTE : L'échelle de temps ne prend plus en compte 'labels' pour l'axe des x.
  const dataT = {
    // labels: labelsTemp, <-- Inutile avec l'échelle de temps
    datasets: [
      {
        label: "Température",
        data: tempData, // Tableau d'objets {x, y}
        borderColor: "#3b82f6", // couleur bleu
        fill: false,
        tension: 0.0,
        pointRadius: 5,
      },
    ],
  };

  const optionsT = {
    responsive: false,
    plugins: {
      legend: { display: false, position: "top" },
      title: { display: true, text: "Courbe des mesures de température" },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "Température (°C)",
        },
      },
      x: {
        // 3. Configuration de l'échelle de temps
        type: "time", // Le type d'échelle qui permet l'espacement basé sur le temps
        time: {
          unit: "minute", // Unité par défaut
          tooltipFormat: 'dd/MM/yyyy HH:mm', // Format affiché dans le tooltip
          displayFormats: {
            minute: "HH:mm", // Format affiché sur l'axe X
            hour: "dd/MM HH:mm",
            day: "dd/MM/yyyy"
          },
        },
        title: {
          display: true,
          text: "Date et Heure de la Mesure",
        },
      },
    },
  };

  const dataP = {
    // labels: labelsPress, <-- Inutile avec l'échelle de temps
    datasets: [
      {
        label: "Pression",
        data: pressData, // Tableau d'objets {x, y}
        borderColor: "#f63b3bff", // couleur rouge
        fill: false,
        tension: 0.0,
        pointRadius: 5,
      },
    ],
  };

  const optionsP = {
    responsive: false,
    plugins: {
      legend: { display: false, position: "top" },
      title: { display: true, text: "Courbe des mesures de pression" },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "Pression (Pa)",
        },
      },
      x: {
        // 3. Configuration de l'échelle de temps
        type: "time", // Le type d'échelle qui permet l'espacement basé sur le temps
        time: {
          unit: "minute", // Unité par défaut
          tooltipFormat: 'dd/MM/yyyy HH:mm', // Format affiché dans le tooltip
          displayFormats: {
            minute: "HH:mm", // Format affiché sur l'axe X
            hour: "dd/MM HH:mm",
            day: "dd/MM/yyyy"
          },
        },
        title: {
          display: true,
          text: "Date et Heure de la Mesure",
        },
      },
    },
  };

  // --- Rendu ---
  return (
    <div>
      <title>{`Données balise ${name}`}</title>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          height: "100%",
          width: "100%",
          margin: 0,
          padding: 0,
        }}
      >
        <div style={{ height: "100%", width: "5%", padding: "20px" }}>
          <button
            onClick={() => navigate("/carte")}
            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            Retour à la carte
          </button>
        </div>
        <div style={{ height: "100%", width: "15%", padding: "20px" }}></div>
        <div style={{ height: "100%", width: "50%", padding: "0px" }}>
          <h1>Données de la balise {name}</h1>
          <h2>Données de test : {beaconName} </h2>
          <center>
            <Line data={dataT} options={optionsT} width={800} height={400} />
          </center>
          <br />
          <br />
          <br />
          <br />
          <br />
          <center>
            <Line data={dataP} options={optionsP} width={800} height={400} />
          </center>
        </div>
      </div>
    </div>
  );
}