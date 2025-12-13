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
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import { useParams, useNavigate } from "react-router-dom";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale
);

// --- Définitions ---
const TIME_RANGES = [
  { label: "1 Jour", key: "1D" },
  { label: "1 Semaine", key: "7D" },
  { label: "1 Mois", key: "1M" },
  { label: "Tout", key: "ALL" },
];

const GRAPH_TYPES = [
  { label: "Température", key: "temp", measurementId: 1, unit: "°C", color: "#3b82f6" },
  { label: "Humidité", key: "humidity", measurementId: 2, unit: "%", color: "#10b981" },
  { label: "Pression", key: "press", measurementId: 3, unit: "hPa", color: "#f63b3bff" },
  { label: "PM 1.0", key: "pm1", measurementId: 4, unit: "µg/m³", color: "#f59e0b" },
  { label: "PM 2.5", key: "pm25", measurementId: 5, unit: "µg/m³", color: "#f97316" },
  { label: "PM 10", key: "pm10", measurementId: 6, unit: "µg/m³", color: "#d97706" },
  { label: "CO2", key: "co2", measurementId: 8, unit: "ppm", color: "#ef4444" },
  // NOTE: GPS (measurementId: 9) est un cas spécial (lat/lng) et n'est pas pris en charge par Line chart
];

// Mappage des clés de type de graphique aux noms de l'état
const DATA_STATE_KEYS = {
    "temp": "tempData",
    "humidity": "humidityData",
    "press": "pressData",
    "pm1": "pm1Data",
    "pm25": "pm25Data",
    "pm10": "pm10Data",
    "co2": "co2Data",
};


export default function DetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [timeRange, setTimeRange] = React.useState("ALL");
  const [graphType, setGraphType] = React.useState("temp");
  const [openGraphMenu, setOpenGraphMenu] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const [beaconName, setBeaconName] = React.useState("Chargement...");
  // États pour les données
  const [tempData, setTempData] = React.useState([]);
  const [humidityData, setHumidityData] = React.useState([]);
  const [pressData, setPressData] = React.useState([]);
  const [pm1Data, setPM1Data] = React.useState([]);
  const [pm25Data, setPM25Data] = React.useState([]);
  const [pm10Data, setPM10Data] = React.useState([]);
  const [co2Data, setCO2Data] = React.useState([]);
  const [gpsData, setGPSData] = React.useState([]); // Non utilisé pour Line chart, mais gardé

  const [referenceDate, setReferenceDate] = React.useState(new Date());
  const [minDate, setMinDate] = React.useState(null);
  const [maxDate, setMaxDate] = React.useState(null);
  const graphMenuRef = React.useRef(null);
  const timeMenuRef = React.useRef(null);


  /* ---------------------------------------------------
        LIMITE TEMPS
  ---------------------------------------------------- */
  const getTimeRangeLimits = React.useCallback(
    (range, refDate) => {
      // ... (inchangé)
      if (range === "ALL") {
        return { min: undefined, max: undefined, label: "Tout" };
      }

      let minDate, maxDate;

      if (range === "1D") {
        minDate = startOfDay(refDate);
        maxDate = endOfDay(refDate);
      } else if (range === "7D") {
        const d = new Date(refDate);
        const day = d.getDay();
        const daysFromMonday = day === 0 ? 6 : day - 1;
        const monday = startOfDay(subDays(d, daysFromMonday));
        minDate = monday;
        maxDate = endOfDay(addDays(monday, 6));
      } else if (range === "1M") {
        const d = new Date(refDate);
        minDate = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
        maxDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const rangeLabel = TIME_RANGES.find((r) => r.key === range)?.label ?? range;
      return { min: minDate, max: maxDate, label: rangeLabel };
    },
    []
  );

  const computeOffsetFromRef = (range, refDate) => {
    // ... (inchangé)
    const now = new Date();
    if (range === "ALL") return 0;
    const diffMs = now.setHours(0, 0, 0, 0) - new Date(refDate).setHours(0, 0, 0, 0);
    if (range === "1D") return Math.max(0, Math.floor(diffMs / 86400000));
    if (range === "7D") return Math.max(0, Math.floor(diffMs / (86400000 * 7)));
    if (range === "1M") return Math.max(0, Math.floor(diffMs / (86400000 * 30)));
    return 0;
  };

  /* ---------------------------------------------------
        FETCH DATA
  ---------------------------------------------------- */
  React.useEffect(() => {
    async function fetchBeaconName() {
      // ... (inchangé)
      try {
        const response = await fetch(`https://r-co-api.onrender.com/beacon/${id}/name`);
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
    // Mappage de toutes les mesures à récupérer avec leur setter d'état correspondant
    const MEASUREMENT_MAPPINGS = [
        { id: 1, setter: setTempData, error: "Erreur temp" },
        { id: 2, setter: setHumidityData, error: "Erreur humidité" },
        { id: 3, setter: setPressData, error: "Erreur pression" },
        { id: 5, setter: setPM1Data, error: "Erreur PM 1.0" },
        { id: 6, setter: setPM25Data, error: "Erreur PM 2.5" },
        { id: 7, setter: setPM10Data, error: "Erreur PM 10" },
        { id: 9, setter: setCO2Data, error: "Erreur CO2" },
        { id: 10, setter: setGPSData, error: "Erreur GPS" }, // Non utilisé pour Line Chart
    ];

    async function fetchAllMeasurements() {
        // Exécution des requêtes en parallèle (ou séquentiellement si le backend est sensible)
        const fetchPromises = MEASUREMENT_MAPPINGS.map(async ({ id: measurementId, setter, error }) => {
            try {
                const response = await fetch(`https://r-co-api.onrender.com/measurement/${id}/${measurementId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                // Formate les données pour TimeScale: {x: Date, y: value}
                const formattedData = data.map((d) => {const date = new Date(d.timestamp);
                  date.setHours(date.getHours() - 1); // <-- décale d'une heure
                  return { x: date, y: d.value };});
                setter(formattedData);
            } catch (err) {
                console.error(error + " :", err);
                setter([]); // Vider les données en cas d'erreur
            }
        });
        
        await Promise.all(fetchPromises);
    }

    fetchAllMeasurements();
  }, [id]); // Dépendance à 'id' pour re-fetch si la balise change

  // Calcule les dates min/max à partir de toutes les mesures
  React.useEffect(() => {
    const allData = [tempData, humidityData, pressData, pm1Data, pm25Data, pm10Data, co2Data].flat();
    
    if (allData.length > 0) {
      const dates = allData.map(d => new Date(d.x));
      const minDt = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDt = new Date(Math.max(...dates.map(d => d.getTime())));
      
      setMinDate(minDt);
      setMaxDate(maxDt);
      
      // Si referenceDate n'est pas encore dans les limites, la réinitialise
      if (referenceDate < minDt || referenceDate > maxDt) {
        setReferenceDate(maxDt);
      }
    }
  }, [tempData, humidityData, pressData, pm1Data, pm25Data, pm10Data, co2Data]);

  /* ---------------------------------------------------
                NAVIGATION TEMPORELLE
  ---------------------------------------------------- */
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (graphMenuRef.current && !graphMenuRef.current.contains(event.target)) {
        setOpenGraphMenu(false);
      }
      if (timeMenuRef.current && !timeMenuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTimeShift = (direction) => {
    // ... (inchangé)
    let newRef = new Date(referenceDate);

    if (timeRange === "1D") newRef = addDays(referenceDate, direction);
    else if (timeRange === "7D") newRef = addWeeks(referenceDate, direction);
    else if (timeRange === "1M") newRef = addMonths(referenceDate, direction);

    setReferenceDate(newRef);
  };

  const handleTimeRangeChange = (newRange) => {
    // ... (inchangé)
    const oldRange = timeRange;
    const oldRef = new Date(referenceDate);

    let anchor = new Date(oldRef);

    if (oldRange === "7D") {
      const day = anchor.getDay();
      const diffToMonday = (day + 6) % 7;
      anchor.setDate(anchor.getDate() - diffToMonday);
    }

    if (oldRange === "1M") {
      anchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    }

    if (oldRange === "1D") {
      anchor = startOfDay(anchor);
    }

    let newRef = new Date(anchor);

    if (newRange === "7D") {
      const day = newRef.getDay();
      const diffToMonday = (day + 6) % 7;
      newRef.setDate(newRef.getDate() - diffToMonday);
    }

    if (newRange === "1M") {
      newRef = new Date(newRef.getFullYear(), newRef.getMonth(), 1);
    }

    if (newRange === "1D") {
      newRef = startOfDay(newRef);
    }

    setTimeRange(newRange);
    setReferenceDate(newRef);
    setOpen(false);
  };

  /* ---------------------------------------------------
        CALCUL DES LIMITES X
  ---------------------------------------------------- */
  /*const { min: minDate, max: maxDate, label: currentRangeLabel } =
    getTimeRangeLimits(timeRange, referenceDate);
  const unit = timeRange === "1D" ? "hour" : "day";*/

  /* ---------------------------------------------------
        FONCTIONS UTILITAIRES DE GRAPHIQUE
  ---------------------------------------------------- */

  // Fonction unifiée pour obtenir la configuration du graphique
  const getGraphConfig = React.useCallback(
  (type) => {
    const graphInfo = GRAPH_TYPES.find((t) => t.key === type);
    if (!graphInfo) return { data: { datasets: [] }, options: {} };

    const { label, unit: yUnit, color } = graphInfo;
    const dataStateKey = DATA_STATE_KEYS[type];

    const allData = { 
      tempData, humidityData, pressData, pm1Data, pm25Data, pm10Data, co2Data 
    };
    const currentData = allData[dataStateKey] || [];

    if (currentData.length === 0) {
      return {
        data: { datasets: [] },
        options: {},
      };
    }

    // --- TRI DES DONNÉES PAR DATE ---
    const sortedData = [...currentData].sort((a, b) => a.x - b.x);

    let dynamicAllUnit = "month";

    if (sortedData.length >= 2) {
      const start = sortedData[0].x.getTime();
      const end = sortedData[sortedData.length - 1].x.getTime();
      const spanDays = (end - start) / (1000 * 60 * 60 * 24);

      if(24*spanDays <= 1) dynamicAllUnit = "minute"
      else if (spanDays <= 1) dynamicAllUnit = "hour";
      else if (spanDays <= 30) dynamicAllUnit = "day";
      else if (spanDays <= 500) dynamicAllUnit = "month";
      else dynamicAllUnit = "year";
    }

    // --- CALCUL DES MIN/MAX SELON timeRange ---
    let minDate, maxDate;

    if (timeRange === "1D") {
      // On prend la référence pour 1 jour
      const ref = startOfDay(referenceDate);
      minDate = ref;
      maxDate = endOfDay(ref);
    } else if (timeRange === "7D") {
      const day = referenceDate.getDay();
      const diffToMonday = (day + 6) % 7; // lundi = 0
      const monday = startOfDay(subDays(referenceDate, diffToMonday));
      minDate = monday;
      maxDate = endOfDay(addDays(monday, 6));
    } else if (timeRange === "1M") {
      const d = referenceDate;
      minDate = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
      maxDate = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (timeRange === "ALL") {
      // --- POUR ALL, ON PREND LES DATES DES DONNÉES ---
      minDate = undefined/*sortedData[0].x*/;
      maxDate = undefined /*sortedData[sortedData.length - 1].x*/;
    }

    // --- FILTRAGE DES DONNÉES VISIBLES ---
    const visibleData = currentData.filter(
      (p) => p.x >= minDate && p.x <= maxDate
    );

    const data = {
      datasets: [{
        label,
        data: currentData,
        borderColor: color,
        fill: false,
        tension: 0.0,
        pointRadius: 5,
      }],
    };

    const currentRangeLabel = TIME_RANGES.find(r => r.key === timeRange)?.label ?? timeRange;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: `Courbe des mesures de ${label} (${currentRangeLabel})` },
      },
      scales: {
        y: {
          title: { display: true, text: `${label} (${yUnit})` },
          grace: "10%",
          ticks: { padding: 6 },
        },
        x: {
          type: "time",
          time: {
            unit:
              timeRange === "1D" ? "hour" :
              timeRange === "7D" ? "day" :
              timeRange === "1M" ? "day" :
              dynamicAllUnit,
            stepSize: 1,
            tooltipFormat: "dd/MM/yyyy HH:mm",
            displayFormats: { minute : "HH:mm", hour: "dd/MM HH:mm", day: "dd/MM", month: "MMM yyyy", year : "yyyy" },
          },
          ...(timeRange !== "ALL" && {
            min: minDate,
            max: maxDate,
          }),
          ticks: {
            display: true,
            autoSkip: true,       
            maxTicksLimit: 31,
            color: "#000",
            padding: 8,
          },

          grid: {
            display: true,         
            drawTicks: true,
          },
        },
      },
    };
    return { data, options };
  },
  [
    tempData, humidityData, pressData, pm1Data, pm25Data, pm10Data, co2Data,
    timeRange, referenceDate
  ]
);
  
  // Appel de la configuration dynamique pour le graphique sélectionné
  const { data: currentData, options: currentOptions } = getGraphConfig(graphType);
 

  const derivedOffset = computeOffsetFromRef(timeRange, referenceDate);

  function formatLocalDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  /* ---------------------------------------------------
        RENDER
  ---------------------------------------------------- */
  return (
    <div>
      <title>{`Données balise ${beaconName}`}</title>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div style={{ width: "5%", padding: "20px" }}>
          <button
            onClick={() => navigate("/")}
            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            Retour à la carte
          </button>
        </div>

        <div style={{ width: "15%", padding: "20px" }}></div>

        <div style={{ width: "50%" }}>
          <center>
            <h1>Données de la balise {beaconName}</h1>
            <br></br>
            <br></br>
          </center>

          {/* CONTRÔLES */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* MENU SEL. GRAPHIQUE */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={() => setOpenGraphMenu(!openGraphMenu)}
                className="py-2 px-4 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {GRAPH_TYPES.find((t) => t.key === graphType)?.label} ▼
              </button>

              {openGraphMenu && (
                <div
                  ref={graphMenuRef}
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
                    minWidth: "150px",
                  }}
                >
                  {GRAPH_TYPES.map((type) => (
                    <button
                      key={type.key}
                      onClick={() => {
                        setGraphType(type.key);
                        setOpenGraphMenu(false);
                      }}
                      className={`py-2 px-4 rounded-lg text-sm font-semibold text-left ${
                        graphType === type.key
                          ? "bg-blue-600 text-white shadow"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* MENU PÉRIODE */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={() => setOpen(!open)}
                className="py-2 px-4 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {TIME_RANGES.find((r) => r.key === timeRange)?.label ?? "Période"} ▼
              </button>

              {open && (
                <div
                  ref={timeMenuRef}
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
                    minWidth: "120px",
                  }}
                >
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.key}
                      onClick={() => handleTimeRangeChange(range.key)}
                      className={`py-2 px-4 rounded-lg text-sm font-semibold text-left ${
                        timeRange === range.key
                          ? "bg-blue-600 text-white shadow"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CALENDRIER */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <label htmlFor="datePicker" style={{ fontSize: "14px", fontWeight: "500" }}>
                📅
              </label>
              <input
                id="datePicker"
                type="date"
                value={formatLocalDate(referenceDate)}
                min={minDate ? formatLocalDate(minDate) : undefined}
                max={maxDate ? formatLocalDate(maxDate) : undefined}
                onChange={(e) => {
                  if (e.target.value) {
                    const selectedDate = new Date(e.target.value + 'T00:00:00');
                    setReferenceDate(selectedDate);
                  } else {
                    // Si l'input est vide (bouton Effacer), réinitialise à la dernière date disponible
                    if (maxDate) {
                      setReferenceDate(maxDate);
                    }
                  }
                }}
                className="py-1 px-2 rounded-lg border border-gray-300 text-sm"
                style={{ cursor: "pointer" }}
              />
            </div>

            {/* BOUTONS NAVIGATION (uniquement si pas "Tout") */}
            {timeRange !== "ALL" && (
              <>
                <button
                  onClick={() => handleTimeShift(-1)}
                  className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold"
                >
                  &lt; Précédent
                </button>

                <button
                  onClick={() => handleTimeShift(1)}
                  className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold"
                  disabled={derivedOffset === 0}
                >
                  Suivant &gt;
                </button>
              </>
            )}
          </div>

          {/* GRAPHIQUE */}
          <center>
            {/* Utilisation du graphique unique avec la configuration dynamique */}
            {currentData && currentData.datasets.length > 0 ? (
              <Line data={currentData} options={currentOptions} width={800} height={400} />
            ) : (
              <p>Chargement des données ou aucune donnée disponible pour cette période/type.</p>
            )}
          </center>
        </div>
      </div>
    </div>
  );
}