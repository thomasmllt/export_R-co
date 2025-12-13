import './MyMap.css'
import React, { useMemo,useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker,Popup, useMap, useMapEvents} from 'react-leaflet';
import { useNavigate } from "react-router-dom";
import * as EL from 'esri-leaflet';
import L from "leaflet";
import supercluster from "supercluster";
import logo from "./assets/logo_def-07.png";
import locIcon from "./assets/loc.png";

async function loadBeacons() {
  try {
    // Fetch list of beacon IDs
    //const res = await fetch("http://localhost:3000/beacon");
    const res = await fetch("https://r-co-api.onrender.com/beacon");
    const idList = await res.json(); // -> [{id:1},{id:2}...]
    // Fetch details for each beacon in parallel
    const detailPromises = idList.map(async (b) => {
      //const r = await fetch(`http://localhost:3000/beacon/${b.id}`);
      const r = await fetch(`https://r-co-api.onrender.com/beacon/${b.id}`);
      const rjson = await r.json();
      if (rjson.position) {
        rjson.position = rjson.position.split(',').map(Number);
      }
      return rjson; // -> {id, serial, name, position, description, last_update...}
    });

    return await Promise.all(detailPromises);

  } catch (err) {
    console.error("Error fetching beacons:", err);
  }
}


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

  if (loading) return <p>Loading...</p>;
  if (beacons.length == 0) return <p>No beacon found.</p>;

  return <MyMap beacons={beacons} />;
}


const bounds = L.latLngBounds(
  [-85, -180], // Sud-Ouest
  [85, 180]    // Nord-Est
);

function EsriImageryLayer() {
  const map = useMap();
  useEffect(() => {
    // basemapLayer gère correctement la couche Esri
    const layer = EL.basemapLayer('Imagery', { minZoom : 3 ,maxZoom: 17, noWrap : true }).addTo(map);
    return () => map.removeLayer(layer);
  }, [map]);
  return null;
}

const customIcon = new L.Icon({
  iconUrl: locIcon, // chemin vers ton icône
  iconSize: [42, 42], // taille de l'icône
  iconAnchor: [16, 32], // point de l'icône qui correspond à la position du marker
  popupAnchor: [0, -32], // position du popup par rapport à l'icône
});


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




function ClusterLayer({points, setSelectedId}) {
  const navigate = useNavigate();
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());
  const [zoom, setZoom] = useState(map.getZoom() || 13); // Default to zoom 13
  
  console.log("ClusterLayer - points reçus:", points);
  
  const handleMarkerClick = (id) => {
    // Navigue vers la même page avec un paramètre
    navigate(`/details/${id}`);
  };

  // Mets à jour les bounds & zoom quand on bouge
  useEffect(() => {
    const update = () => {
      setBounds(map.getBounds());
      setZoom(map.getZoom());
    };
    map.on("moveend", update);
    return () => map.off("moveend", update);
  }, [map]);

  // Crée le cluster
  const cluster = useMemo(() => {
    console.log("Chargement des points dans supercluster:", points);
    if (points.length === 0) {
      console.warn("⚠️ Aucun point à charger!");
      return null;
    }
    
    // Transformer les points au format GeoJSON attendu par supercluster
    const geoJsonPoints = points.map(p => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: p.position ? [p.position[1], p.position[0]] : [0, 0]  // Swap: API [lat, lon] → GeoJSON [lon, lat]
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

    console.log("✓ Points transformés en GeoJSON:", geoJsonPoints.length);
    console.log("Sample point coordinates:", geoJsonPoints[0]?.geometry?.coordinates);
    
    const index = new supercluster({
      radius: 60, // distance de regroupement (en pixels)
      maxZoom: 18,
    });
    
    // Charger les points GeoJSON valides
    const validPoints = geoJsonPoints.filter(p => {
      if (!p.geometry || !p.geometry.coordinates || p.geometry.coordinates.length !== 2) {
        console.warn("❌ Point GeoJSON invalide:", p);
        return false;
      }
      return true;
    });
    
    console.log(`✓ ${validPoints.length}/${points.length} points valides`);
    console.log("Sample valid point:", validPoints[0]);
    
    if (validPoints.length === 0) {
      console.error("❌ Aucun point valide!");
      return null;
    }
    
    index.load(validPoints);
    
    // Test: récupérer les clusters à zoom 0
    const testClusters = index.getClusters([-180, -90, 180, 90], 0);
    console.log("✓ Test getClusters zoom 0:", testClusters.length, "clusters");
    
    console.log("Cluster créé avec", validPoints.length, "points");
    return index;
  }, [points]);

  // Convertit les bounds Leaflet en bbox
  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];

  // Récupère les clusters visibles
  // FIX: Vérifier que zoom et bbox sont valides
  if (zoom === undefined || zoom === null || !cluster) {
    console.log("⚠️ Cluster pas prêt, affichage des points bruts");
    return (
      <>
        {points.map((point) => {
          // Gérer les deux formats possibles
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


function WidgetItem({ feature, isSelected, onClick, setSelectedId }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const widgetRef = React.useRef(null);

  // Synchronise l'affichage des détails avec la sélection
  useEffect(() => {
    setShowDetails(isSelected);
  }, [isSelected]);

  // Scroll vers le widget quand il est sélectionné
  useEffect(() => {
    if (isSelected && widgetRef.current) {
      widgetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);


  // Calcul des moyennes et date
  const avgTemp = feature.avgTemp;
  const avgPressure = feature.avgPressure;
  const avgHumidity = feature.avgHumidity;
  const lastUpdate = feature.last_update ? new Date(new Date(feature.last_update).getTime() - 60 * 60 * 1000) : null;
  //console.log("last update = ", lastUpdate);

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

      {/* Flèche en bas à droite */}
      <span
        onClick={(e) => {
          e.stopPropagation(); // empêche le clic parent de naviguer
          const newState = !showDetails;
          setShowDetails(newState);
          // Si on ouvre les détails, on surligne aussi
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

function MyMap({ beacons }) {
  const [selectedId, setSelectedId] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Récupère les balises depuis la base de données
  useEffect(() => {
    // Définit le titre de la page
    document.title = "Carte Balises";

    const fetchBeacons = async () => {
      try {
        // Récupère la liste de toutes les balises
        const beaconsRes = await fetch("https://r-co-api.onrender.com/beacon");
        const beaconIds = await beaconsRes.json();

        // Pour chaque balise, récupère ses données complètes
        const markersData = await Promise.all(
          beaconIds.map(async (beacon) => {
            try {
              const res = await fetch(`https://r-co-api.onrender.com/beacon/${beacon.id}`);
              
              // Vérifie que la réponse est valide
              if (!res.ok) {
                console.warn(`Balise ${beacon.id} non disponible (HTTP ${res.status}), ignorée`);
                return null;
              }

              // Vérifie que la réponse est du JSON
              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                console.warn(`Réponse non-JSON pour la balise ${beacon.id}, ignorée`);
                return null;
              }

              const data = await res.json();

              // Parse la position (format: "lat,lon" ou format géométrique)
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

        // Filtre les balises null et met à jour l'état
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
      {/* ========== BANDEAU EN HAUT ========== */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "white",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 1000
      }}>
        {/* Logo + Nom */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logo} alt="Renardo" style={{ height: "40px", marginRight: "10px" }} />
        </div>

        {/* Lien externe */}
        <a href="https://www.renardo-tech.fr/" target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "#007BFF", fontWeight: "bold", fontSize: "1rem" }}>
          Notre site web
        </a>
      </div>

{/* ========== CONTENU PRINCIPAL : BANDEAU + CARTE ========== */}
<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
  
  {/* Bandeau widgets à gauche */}
  <div 
    style={{ width: "300px", overflowY: "auto", overflowX: "hidden", background: "#fff", padding: "10px", borderRight: "1px solid #ddd" }}
  >
    {beacons.map((feature) => (
      <WidgetItem
        key={feature.id}
        feature={feature}
        isSelected={selectedId === feature.id}
        setSelectedId={setSelectedId}
      />
    ))}
  </div>

  {/* Carte à droite */}
  <div style={{ flex: 1 }}>
    <MapContainer
      center={[47, 2.3522]}
      zoom={6}
      scrollWheelZoom={true}
      maxBounds={bounds}
      maxBoundsViscosity={1}
      style={{ height: "100%", width: "100%" }}
    >
      <EsriImageryLayer />
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