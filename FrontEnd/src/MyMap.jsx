import './MyMap.css'
import React, { useMemo,useState, useEffect } from 'react';
import { MapContainer, Marker, useMap} from 'react-leaflet';
import { useNavigate } from "react-router-dom";
import * as EL from 'esri-leaflet';
import L from "leaflet";
import supercluster from "supercluster";
import logo from "./assets/logo_def-07.png";
import locIcon from "./assets/loc.png";


/*Chargement des balises*/
async function loadBeacons() {
  try {
    const res = await fetch("https://r-co-api.onrender.com/beacon");
    const idList = await res.json();
    const detailPromises = idList.map(async (b) => {
      const r = await fetch(`https://r-co-api.onrender.com/beacon/${b.id}`);
      const rjson = await r.json();
      if (rjson.position) {
        rjson.position = rjson.position.split(',').map(Number);
      }
      return rjson; // rjson est de la forme {id, serial, name, position, description, last_update...}
    });

    return await Promise.all(detailPromises);

  } catch (err) {
    console.error("Error fetching beacons:", err);
  }
}

/*Coordonnées limites de la carte*/
const bounds = L.latLngBounds(
  [-85, -180], // Sud-Ouest
  [85, 180]    // Nord-Est
);

/*Création du layout de la carte*/
function EsriImageryLayer() {
  const map = useMap();
  useEffect(() => {
    const layer = EL.basemapLayer('Imagery', { minZoom : 3 ,maxZoom: 17, noWrap : true }).addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

/*Création de l'icone des balises */
const customIcon = new L.Icon({
  iconUrl: locIcon,
  iconSize: [42, 42], 
  iconAnchor: [16, 32],
});

/*Création de l'icone des regroupements de balises */
const createClusterIcon = (count) =>
  L.divIcon({
    html: `<div style="
      background:#e66347;
      color:white;
      border-radius:50%;
      width:40px;
      height:40px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:bold;
      box-shadow:0 0 10px rgba(0,0,0,0.3);
    ">${count}</div>`,
    className: "cluster-marker",
    iconSize: [40, 40],
});

/*Créations des points sur la carte en considérant s'il y a des regroupements*/
function ClusterLayer({points, setSelectedId}) {
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());
  const [zoom, setZoom] = useState(map.getZoom() || 13);
  
  console.log("ClusterLayer - points reçus:", points);

  useEffect(() => {
    const update = () => {
      setBounds(map.getBounds());
      setZoom(map.getZoom());
    };
    map.on("moveend", update);
    return () => map.off("moveend", update);
  }, [map]);

  const cluster = useMemo(() => {
    console.log("Chargement des points dans le supercluster:", points);
    if (points.length === 0) {
      console.warn("Aucun point à charger!");
      return null;
    }
    
    const geoJsonPoints = points.map(p => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: p.position ? [p.position[1], p.position[0]] : [0, 0]
      },
      properties: {
        id: p.id,
        serial: p.serial,
        name: p.name,
        description: p.description,
        avgTemp: p.avgTemp,
        avgPressure: p.avgPressure,
        avgHumidity: p.avgHumidity,
        last_update: p.last_update
      }
    }));

    console.log("Points transformés en GeoJSON:", geoJsonPoints.length);
    
    const index = new supercluster({
      radius: 60,
      maxZoom: 18,
    });
    
    const validPoints = geoJsonPoints.filter(p => {
      if (!p.geometry || !p.geometry.coordinates || p.geometry.coordinates.length !== 2) {
        console.warn("Point GeoJSON invalide:", p);
        return false;
      }
      return true;
    });
    
    console.log(`${validPoints.length}/${points.length} points valides`);
    console.log("Sample valid point:", validPoints[0]);
    
    if (validPoints.length === 0) {
      console.error("Aucun point valide!");
      return null;
    }
    
    index.load(validPoints);
    
    console.log("Cluster créé avec", validPoints.length, "points");
    return index;
  }, [points]);

  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];

  if (zoom === undefined || zoom === null || !cluster) {
    console.log("Cluster pas prêt, affichage des points bruts");
    return (
      <>
        {points.map((point) => {
          let latitude, longitude, id;
          
          if (point.geometry && point.geometry.coordinates) {
            [longitude, latitude] = point.geometry.coordinates;
          } else if (point.position) {
            [longitude, latitude] = point.position;
          } else {
            console.warn("Point sans coordonnées:", point);
            return null;
          }
          
          id = point.id || point.properties?.id;
          
          return (
            <Marker
              key={`point-${id}`}
              position={[latitude, longitude]}
              icon={customIcon}
              eventHandlers={{
                click: () => {
                  setSelectedId(id);
                },
              }}
            />
          );
        })}
      </>
    );
  }

  const clusters = cluster.getClusters(bbox, Math.round(zoom));
  console.log("Query params - bbox:", bbox, "zoom:", Math.round(zoom));
  console.log("Clusters visibles:", clusters, "zoom:", Math.round(zoom), "bbox:", bbox);
  
  return (
  <>
    {clusters.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const isCluster = feature.properties?.cluster;
      const pointCount = feature.properties?.point_count;
      const id = feature.id || feature.properties?.id;

      if (isCluster) {
        return (
          <Marker
            key={`cluster-${feature.id}`}
            position={[latitude, longitude]}
            icon={createClusterIcon(pointCount)}
            eventHandlers={{
              click: () => {
                const expansionZoom = Math.min(
                  cluster.getClusterExpansionZoom(feature.id),
                  18
                );
                map.setView([latitude, longitude], expansionZoom, { animate: true });
              }
            }}
          />
        );
      }

      return (
        <Marker
          key={`point-${id}`}
          position={[latitude, longitude]}
          icon={customIcon}
          eventHandlers={{
            click: () => {
              // Surbrillance du widget ET ouvre les détails
              setSelectedId(id);
            },
          }}
        />
      );
    })}
  </>
  );
}

/*Création d'un bloc de description d'une balise */
function WidgetItem({ feature, isSelected, onClick, setSelectedId }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const widgetRef = React.useRef(null);

  useEffect(() => {
    setShowDetails(isSelected);
  }, [isSelected]);

  useEffect(() => {
    if (isSelected && widgetRef.current) {
      widgetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const avgTemp = feature.avgTemp;
  const avgPressure = feature.avgPressure;
  const avgHumidity = feature.avgHumidity;
  const lastUpdate = feature.last_update ? new Date(new Date(feature.last_update).getTime() - 60 * 60 * 1000) : null;

  const formatValue = (value, unit) =>
  value !== null && value !== undefined
    ? `${value} ${unit}`
    : "Aucune mesure";
  return (
    <div
      ref={widgetRef}
      onClick={() => navigate(`/details/${feature.id}`)} // redirige vers la page détaillée
      style={{
        position: "relative",
        border: isSelected ? "2px solid orange" : "1px solid #ddd",
        background: isSelected ? "#fff3e0" : "white",
        padding: "10px",
        borderRadius: "8px",
        marginBottom: "10px",
        cursor: "pointer"
      }}
    >
      <h3
        style={{
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {feature.name}
      </h3>
      <p style={{ margin: "5px 0", color: "#666" }}>
        {feature.description}
      </p>


      {showDetails && (
        <div style={{ marginTop: "10px", color: "#333" }}>
          <p><strong>Température moyenne :</strong> {formatValue(avgTemp, "°C")}</p>
          <p><strong>Pression moyenne :</strong> {formatValue(avgPressure, "hPa")}</p>
          <p><strong>Humidité moyenne :</strong> {formatValue(avgHumidity, "%")}</p>
          <p><strong>Dernière modification:</strong> {lastUpdate ? lastUpdate.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "Aucune mesure"}</p>
        </div>
      )}

      <span
        onClick={(e) => {
          e.stopPropagation();
          const newState = !showDetails;
          setShowDetails(newState);
          if (newState) {
            setSelectedId(feature.id);
          } else {
            setSelectedId(null);
          }
        }}
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          cursor: "pointer",
          fontSize: "1.2rem"
        }}
      >
        {showDetails ? "▲" : "▼"}
      </span>
    </div>
  );
}

/*Création de la page*/
function MyMap({ beacons }) {
  const [selectedId, setSelectedId] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Carte Balises";

    const fetchBeacons = async () => {
      try {
        const beaconsRes = await fetch("https://r-co-api.onrender.com/beacon");
        const beaconIds = await beaconsRes.json();
        const markersData = await Promise.all(
          beaconIds.map(async (beacon) => {
            try {
              const res = await fetch(`https://r-co-api.onrender.com/beacon/${beacon.id}`);
              if (!res.ok) {
                console.warn(`Balise ${beacon.id} non disponible (HTTP ${res.status}), ignorée`);
                return null;
              }
              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                console.warn(`Réponse non-JSON pour la balise ${beacon.id}, ignorée`);
                return null;
              }

              const data = await res.json();
              let latitude = 48.8566;
              let longitude = 2.3522;

              if (data.position) {
                const coords = data.position.split(",").map(c => parseFloat(c.trim()));
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                  latitude = coords[0];
                  longitude = coords[1];
                }
              }

              return {
                id: data.id,
                name: data.name || "Balise sans nom",
                serial: data.serial || "",
                description: data.description || "",
                position: [longitude, latitude],
                properties: { cluster: false },
                geometry: {
                  type: "Point",
                  coordinates: [longitude, latitude]
                }
              };
            } catch (err) {
              console.warn(`Erreur pour la balise ${beacon.id}:`, err.message);
              return null;
            }
          })
        );
        setMarkers(markersData.filter(m => m !== null));
      } catch (err) {
        console.error("Erreur lors de la récupération des balises:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBeacons();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "1.2rem"
      }}>
        Chargement des balises...
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100%",
      margin: 0,
      padding: 0,
      background: "#eee"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "white",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 1000
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logo} alt="Renardo" style={{ height: "40px", marginRight: "10px" }} />
        </div>
        <a href="https://www.renardo-tech.fr/" target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "#007BFF", fontWeight: "bold", fontSize: "1rem" }}>
          Notre site web
        </a>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: "300px", overflowY: "auto", overflowX: "hidden", background: "#fff", padding: "10px", borderRight: "1px solid #ddd" }}>
          {beacons.map((feature) => (
            <WidgetItem
              key={feature.id}
              feature={feature}
              isSelected={selectedId === feature.id}
              setSelectedId={setSelectedId}
            />
          ))}
        </div>

        <div style={{ flex: 1 }}>
          <MapContainer
            center={[47, 2.3522]}
            zoom={6}
            scrollWheelZoom={true}
            maxBounds={bounds}
            maxBoundsViscosity={1}
            style={{ height: "100%", width: "100%" }}
          >
            <EsriImageryLayer/>
            <ClusterLayer
              points={beacons}
              setSelectedId={setSelectedId}
            />
          </MapContainer>
        </div>

      </div>
    </div>
  );
}

/*Initialisation de la page (chargement des balises) puis appel à la fonction de création de la page*/
export default function MyMapInit() {

  const [loading, setLoading] = useState(true);
  const [beacons, setBeacons] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const data = await loadBeacons();
      setBeacons(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <p>Chargement...</p>;
  if (beacons.length == 0) return <p>Pas de balises.</p>;

  return <MyMap beacons={beacons} />;
}