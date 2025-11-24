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
  TimeScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  subDays,
  subWeeks,
  subMonths,
  addDays, // NOUVEAU
  addWeeks, // NOUVEAU
  addMonths, // NOUVEAU
  startOfDay,
  endOfDay,
} from "date-fns";
import { useParams, useNavigate } from "react-router-dom";
import { markers } from "../src/markers";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale
);

const TIME_RANGES = [
  { label: "1 Jour", key: "1D" },
  { label: "1 Semaine", key: "7D" },
  { label: "1 Mois", key: "1M" },
  { label: "Tout", key: "ALL" },
];

export default function DetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const marker = markers.find((m) => m.properties.id == id);
  const name = marker ? marker.name : "Unknown";
  // On donne l'état d'affichage par défaut des valeurs
  const [timeRange, setTimeRange] = React.useState("ALL");
  // --- NOUVEL ÉTAT pour l'offset temporel ---
  // offset = 0 : Période la plus récente
  // offset = 1 : Période précédente
  const [offset, setOffset] = React.useState(0); 
  const [open, setOpen] = React.useState(false);

  const [beaconName, setBeaconName] = React.useState("Chargement...");
  const [tempData, setTempData] = React.useState([]);
  const [pressData, setPressData] = React.useState([]);
  const [labelsTemp, setLabelsTemp] = React.useState([]);
  const [labelsPress, setLabelsPress] = React.useState([]);

  // --- Fonction pour calculer les bornes temporelles (MISE À JOUR) ---
  const getTimeRangeLimits = React.useCallback(
    (range, currentOffset) => {
      // Date de référence (aujourd'hui)
      let now = new Date(); 

      // On décale la date de référence si l'offset n'est pas 0.
      // Si l'offset est 1, on calcule la période 1D/7D/1M avant la période actuelle.
      let offsetFunction = subDays;
      let offsetAmount = 0;

      switch (range) {
        case "1D":
          offsetFunction = subDays;
          offsetAmount = currentOffset;
          break;
        case "7D":
          offsetFunction = subWeeks;
          offsetAmount = currentOffset;
          break;
        case "1M":
          offsetFunction = subMonths;
          offsetAmount = currentOffset;
          break;
        case "ALL":
        default:
          return { min: undefined, max: undefined, label: "Tout" };
      }

      // La borne maximale est toujours la fin de la période actuelle (décalée)
      let maxDate = now;
      let minDate;

      if (currentOffset > 0) {
        // Décalage pour voir le passé : l'offset décale le point de départ de la période.
        // ex: pour offset=1 (période précédente), maxDate = now - 1 * période
        // On calcule la fin de la période (maxDate) et le début de la période (minDate)
        
        // 1. Calcul de la date de FIN de la période affichée (ex: fin de la semaine dernière)
        maxDate = offsetFunction(now, currentOffset); 

        // 2. Calcul de la date de DÉBUT de la période affichée (ex: début de la semaine dernière)
        minDate = offsetFunction(now, currentOffset + 1);
        
        // Ajustement pour le filtre 1 jour (pour coller à minuit)
        if (range === '1D') {
            minDate = startOfDay(offsetFunction(now, currentOffset + 1));
            maxDate = endOfDay(offsetFunction(now, currentOffset));
        }

      } else {
        // offset = 0 : Période actuelle (la plus récente)
        switch (range) {
            case '1D':
                minDate = startOfDay(now); // Commence à 00:00:00 du jour courant
                break;
            case '7D':
                minDate = subWeeks(now, 1);
                break;
            case '1M':
                minDate = subMonths(now, 1);
                break;
            default:
                break;
        }
        maxDate = now; // La borne max est "maintenant"
      }
      
      const rangeLabel = TIME_RANGES.find(r => r.key === range).label;
      const displayLabel = currentOffset === 0 ? rangeLabel : `${rangeLabel} (Passé: ${currentOffset})`;
      
      return { min: minDate, max: maxDate, label: displayLabel };
    },
    []
  );

  // --- Chargement des Mesures (code inchangé) ---
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

  React.useEffect(() => {
    // ... fetchTemperature et fetchPressure (code inchangé pour le chargement des données brutes)
    async function fetchTemperature() { 
        try {
            const response = await fetch(`http://localhost:3000/measurement/${id}/1`);
            const data = await response.json();
            setTempData(data.map((d) => ({ x: new Date(d.timestamp), y: d.value })));
            setLabelsTemp(data.map((d) => new Date(d.timestamp).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })));
        } catch (err) {
            console.error("Erreur temp :", err);
        }
    }

    async function fetchPressure() { 
        try {
            const response = await fetch(`http://localhost:3000/measurement/${id}/3`);
            const data = await response.json();
            setPressData(data.map((d) => ({ x: new Date(d.timestamp), y: d.value })));
            setLabelsPress(data.map((d) => new Date(d.timestamp).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })));
        } catch (err) {
            console.error("Erreur pression :", err);
        }
    }

    fetchTemperature();
    fetchPressure();
  }, [id]);

  // --- Calcul des limites en fonction du filtre et de l'offset ---
  const { min: minDate, max: maxDate, label: currentRangeLabel } = getTimeRangeLimits(timeRange, offset);
  const unit = timeRange === "1D" ? "hour" : "day";
  
  // --- Fonction pour changer la période (Avancer/Reculer) ---
  const handleTimeShift = (direction) => {
      // direction: +1 pour aller vers le passé (offset augmente), -1 pour aller vers le futur (offset diminue)
      // On empêche d'aller au-delà de l'offset 0 (le futur)
      setOffset((prevOffset) => Math.max(0, prevOffset + direction));
  };


  // --- Configuration des Données et Options (utilisation de minDate/maxDate) ---

  const dataT = {
    datasets: [
      {
        label: "Température",
        data: tempData,
        borderColor: "#3b82f6",
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
      // Utilisation du label pour indiquer la période
      title: { display: true, text: `Courbe des mesures de température (${currentRangeLabel})` }, 
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "Température (°C)",
        },
      },
      x: {
        type: "time",
        time: {
          unit: unit,
          tooltipFormat: "dd/MM/yyyy HH:mm",
          displayFormats: {
            hour: "HH:mm",
            day: "dd/MM",
            month: "MMM yyyy",
          },
        },
        min: minDate,
        max: maxDate,
        title: {
          display: true,
          text: "Date et Heure de la Mesure",
        },
      },
    },
  };

  // ... (optionsP similaires)

  const dataP = {
    datasets: [
      {
        label: "Pression",
        data: pressData,
        borderColor: "#f63b3bff",
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
      title: { display: true, text: `Courbe des mesures de pression (${currentRangeLabel})` },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: "Pression (Pa)",
        },
      },
      x: {
        type: "time",
        time: {
          unit: unit,
          tooltipFormat: "dd/MM/yyyy HH:mm",
          displayFormats: {
            hour: "HH:mm",
            day: "dd/MM",
            month: "MMM yyyy",
          },
        },
        min: minDate,
        max: maxDate,
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
          <center><h1>Données de la balise {name}</h1>
          <h2>Données de test : {beaconName} </h2>
          </center>

          {/* --- CONTRÔLES DE PÉRIODE --- */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            
            {/* Dropdown au lieu des boutons */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={() => setOpen(!open)}
                className="py-2 px-4 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {TIME_RANGES.find(r => r.key === timeRange)?.label ?? "Période"} ▼
              </button>

              {open && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    background: "white",
                    border: "1px solid #ccc",
                    padding: "8px",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    zIndex: 50,
                    minWidth: "120px"
                  }}
                >
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.key}
                      onClick={() => {
                        setTimeRange(range.key);
                        setOffset(0);
                        setOpen(false); // Refermer le menu après sélection
                      }}
                      className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors duration-150 text-left ${
                        timeRange === range.key
                          ? "bg-blue-600 text-white shadow"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                      disabled={range.key === 'ALL' && offset > 0}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>


            {/* Boutons de Navigation (< Précedent, Suivant >) */}
            {timeRange !== 'ALL' && (
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={() => handleTimeShift(1)} // Augmenter l'offset (aller dans le passé)
                        className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold transition-colors duration-150"
                    >
                        &lt; Précédent
                    </button>
                    <button
                        onClick={() => handleTimeShift(-1)} // Diminuer l'offset (aller dans le futur)
                        className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold transition-colors duration-150"
                        disabled={offset === 0} // Désactivé si on est déjà à la période la plus récente
                    >
                        Suivant &gt;
                    </button>
                </div>
            )}
            
          </div>
          {/* ----------------------------------- */}

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