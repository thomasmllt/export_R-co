import './MyMap.css'
import React, { useMemo,useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker,Popup, useMap, useMapEvents} from 'react-leaflet';
import { useNavigate } from "react-router-dom";
import * as EL from 'esri-leaflet';
import L from "leaflet";
import supercluster from "supercluster";
import { markers, puntos } from "./markers";
import logo from "./assets/logo_def-07.png";


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
  iconUrl: "../src/assets/loc.png", // chemin vers ton icône
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
  const [zoom, setZoom] = useState(map.getZoom());
  const handleMarkerClick = (id) => {
    // 🔹 Navigue vers la même page avec un paramètre
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
    const index =new supercluster({
      radius: 60, // distance de regroupement (en pixels)
      maxZoom: 18,
    });
    index.load(points);
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
  const clusters = cluster.getClusters(bbox, Math.round(zoom));
  return (
  <>
    {clusters.map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const { cluster: isCluster, point_count: pointCount } = feature.properties;

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
  key={`point-${feature.properties.id}`}
  position={[latitude, longitude]}
  icon={customIcon}
  eventHandlers={{
    click: () => {
      // Surbrillance du widget ET ouvre les détails
      setSelectedId(feature.properties.id);
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

  // Synchronise l'affichage des détails avec la sélection
  useEffect(() => {
    setShowDetails(isSelected);
  }, [isSelected]);


  // Calcul des moyennes et date
  const avgTemp = (feature.mesureT.reduce((sum, n) => sum + n, 0) / feature.mesureT.length).toFixed(2);
  const avgPressure = (feature.mesureP.reduce((sum, n) => sum + n, 0) / feature.mesureP.length).toFixed(2);
  const avgHumidity = (feature.mesureH.reduce((sum, n) => sum + n, 0) / feature.mesureH.length).toFixed(2);
  const lastMod = new Date(feature.times[feature.times.length - 1]);

  return (
    <div
      onClick={() => navigate(`/details/${feature.properties.id}`)} // redirige vers la page détaillée
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
          <p><strong>Température moyenne:</strong> {avgTemp} °C</p>
          <p><strong>Pression moyenne:</strong> {avgPressure} hPa</p>
          <p><strong>Humidité moyenne:</strong> {isNaN(avgHumidity) ? "N/A" : `${avgHumidity} %`}</p>
          <p><strong>Dernière modification:</strong> {lastMod.toLocaleDateString("fr-FR")}</p>
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
            setSelectedId(feature.properties.id);
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


export default function MyMap_test() {
  const [selectedId, setSelectedId] = useState(null);

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
<div style={{ flex: 1, display: "flex" }}>
  
  {/* Bandeau widgets à gauche */}
  <div style={{ width: "300px", overflowY: "auto", background: "#fff", padding: "10px", borderRight: "1px solid #ddd" }}>
    {markers.map((feature) => (
      <WidgetItem
        key={feature.properties.id}
        feature={feature}
        isSelected={selectedId === feature.properties.id}
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
        points={markers}
        setSelectedId={setSelectedId}
      />
    </MapContainer>
  </div>

</div>
    </div>
  );
}