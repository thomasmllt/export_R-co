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

const GRAPH_TYPES = [
  { label: "Température", key: "temp" },
  { label: "Pression", key: "press" },
];

export default function DetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const marker = markers.find((m) => m.properties.id == id);
  const name = marker ? marker.name : "Unknown";

  const [timeRange, setTimeRange] = React.useState("ALL");
  const [graphType, setGraphType] = React.useState("temp");
  const [openGraphMenu, setOpenGraphMenu] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const [beaconName, setBeaconName] = React.useState("Chargement...");
  const [tempData, setTempData] = React.useState([]);
  const [pressData, setPressData] = React.useState([]);
  const [humidityData, setHumidityData] = React.useState([]);
  const [pm1Data, setPM1Data] = React.useState([]);
  const [pm25Data, setPM25Data] = React.useState([]);
  const [pm10Data, setPM10Data] = React.useState([]);
  const [lightData, setLightData] = React.useState([]);
  const [co2Data, setCO2Data] = React.useState([]);
  const [gpsData, setGPSData] = React.useState([]);
  const [labelsTemp, setLabelsTemp] = React.useState([]);
  const [labelsPress, setLabelsPress] = React.useState([]);

  const [referenceDate, setReferenceDate] = React.useState(new Date());

  // --- Calcule les limites autour de referenceDate ---
  const getTimeRangeLimits = React.useCallback(
    (range, refDate) => {
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

  // --- Offset calculé
  const computeOffsetFromRef = (range, refDate) => {
    const now = new Date();
    if (range === "ALL") return 0;
    const diffMs = now.setHours(0, 0, 0, 0) - new Date(refDate).setHours(0, 0, 0, 0);
    if (range === "1D") return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (range === "7D") return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
    if (range === "1M") return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30)));
    return 0;
  };

  // --- Chargement des mesures ---
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

  // Structure pour définir les setters et l'URL pour chaque mesure
    const MEASUREMENT_MAPPINGS = [
        { id: 1, setter: setTempData, error: "Erreur temp" },
        { id: 2, setter: setHumidityData, error: "Erreur humidité" },
        { id: 3, setter: setPressData, error: "Erreur pression" },
        // NOTE: setPressData est écrasé ci-dessous si vous ne changez pas les IDs !
        { id: 5, setter: setPM1Data, error: "Erreur PM1" },
        { id: 6, setter: setPM25Data, error: "Erreur PM2.5" },
        { id: 7, setter: setPM10Data, error: "Erreur PM10" },
        { id: 8, setter: setLightData, error: "Erreur Lumière" },
        { id: 9, setter: setCO2Data, error: "Erreur CO2" },
        { id: 10, setter: setGPSData, error: "Erreur GPS" },
    ];

    async function fetchAllMeasurements() {
        for (const { id: measurementId, setter, error } of MEASUREMENT_MAPPINGS) {
            try {
                const response = await fetch(`http://localhost:3000/measurement/${id}/${measurementId}`);
                const data = await response.json();
                
                // Le format est { x: Date, y: Valeur } pour Chart.js avec TimeScale
                const formattedData = data.map((d) => ({ x: new Date(d.timestamp), y: d.value }));
                setter(formattedData);
            } catch (err) {
                console.error(error + " :", err);
            }
        }
    }

    fetchAllMeasurements();

    }, [id]); // Dépendance à 'id' correcte

  // --- NAVIGATION TEMPORELLE ---
  const handleTimeShift = (direction) => {
    let newRef = new Date(referenceDate);

    if (timeRange === "1D") newRef = addDays(referenceDate, direction * 1);
    else if (timeRange === "7D") newRef = addWeeks(referenceDate, direction * 1);
    else if (timeRange === "1M") newRef = addMonths(referenceDate, direction * 1);

    setReferenceDate(newRef);
  };

  // --- NOUVELLE FONCTION : changement d'échelle fiable ---
  const handleTimeRangeChange = (newRange) => {
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

  // --- Limites du graphique ---
  const { min: minDate, max: maxDate, label: currentRangeLabel } = getTimeRangeLimits(
    timeRange,
    referenceDate
  );
  const unit = timeRange === "1D" ? "hour" : "day";

  // --- Données graphiques ---
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
      title: { display: true, text: `Courbe des mesures de température (${currentRangeLabel})` },
    },
    scales: {
      y: { title: { display: true, text: "Température (°C)" } },
      x: {
        type: "time",
        time: {
          unit: unit,
          tooltipFormat: "dd/MM/yyyy HH:mm",
          displayFormats: { hour: "dd/MM HH:mm", day: "dd/MM", month: "MMM yyyy" },
        },
        min: minDate,
        max: maxDate,
        title: { display: true, text: "Date et Heure de la Mesure" },
      },
    },
  };

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
      y: { title: { display: true, text: "Pression (hPa)" } },
      x: {
        type: "time",
        time: {
          unit: unit,
          tooltipFormat: "dd/MM/yyyy HH:mm",
          displayFormats: { hour: "dd/MM HH:mm", day: "dd/MM", month: "MMM yyyy" },
        },
        min: minDate,
        max: maxDate,
        title: { display: true, text: "Date et Heure de la Mesure" },
      },
    },
  };

  const derivedOffset = computeOffsetFromRef(timeRange, referenceDate);

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
          <center>
            <h1>Données de la balise {name}</h1>
            <h2>Données de test : {beaconName} </h2>
          </center>

          {/* --- MENU TYPE DE GRAPHIQUE --- */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setOpenGraphMenu(!openGraphMenu)}
              className="py-2 px-4 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              {GRAPH_TYPES.find((t) => t.key === graphType)?.label} ▼
            </button>

            {openGraphMenu && (
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

          {/* --- CONTRÔLES DE PÉRIODE --- */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={() => setOpen(!open)}
                className="py-2 px-4 rounded-lg text-sm font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                {TIME_RANGES.find((r) => r.key === timeRange)?.label ?? "Période"} ▼
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
                    minWidth: "120px",
                  }}
                >
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range.key}
                      onClick={() => handleTimeRangeChange(range.key)}
                      className={`py-2 px-4 rounded-lg text-sm font-semibold transition-colors duration-150 text-left ${
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

            {timeRange !== "ALL" && (
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  onClick={() => handleTimeShift(-1)}
                  className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold transition-colors duration-150"
                >
                  &lt; Précédent
                </button>
                <button
                  onClick={() => handleTimeShift(1)}
                  className="py-2 px-3 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-bold transition-colors duration-150"
                  disabled={derivedOffset === 0}
                >
                  Suivant &gt;
                </button>
              </div>
            )}
          </div>

          <center>
            {graphType === "temp" && <Line data={dataT} options={optionsT} width={800} height={400} />}
            {graphType === "press" && <Line data={dataP} options={optionsP} width={800} height={400} />}
          </center>
        </div>
      </div>
    </div>
  );
}
