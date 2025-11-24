import './MyMap.css'
import React, { useMemo,useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker,Popup, useMap, useMapEvents} from 'react-leaflet';
import { useNavigate } from "react-router-dom";
import * as EL from 'esri-leaflet';
import L from "leaflet";
import supercluster from "supercluster";
import { markers, puntos } from "./markers";
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




function ClusterLayer({ points, setHoveredInfo }) {
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
                },
              }}
            />
          );
        }
        const lastmod = new Date(feature.times[feature.times.length-1]);
        return (
          <Marker
            key={`point-${feature.properties.id}`}
            position={[latitude, longitude]}
            icon={customIcon}  
            eventHandlers={{
            click: () => handleMarkerClick(feature.properties.id),
            mouseover: () => setHoveredInfo(
              <div class="container">
                <p style={{ fontSize: "25px" }}>{feature.name}</p>
                <p>Position GPS : {feature.geometry.coordinates.join(', ')}</p>
                <p>{feature.description}</p>
                <p>__________________________________________</p>
                <p>Température moyenne : {(feature.mesureT.reduce((sum, num) => sum + num, 0)*100 / feature.mesureT.length).toFixed(0)/100}</p>
                <p>Humidité moyenne : {(feature.mesureH.reduce((sum, num) => sum + num, 0)*100 / feature.mesureH.length).toFixed(0)/100}</p>
                <p>Pression moyenne : {(feature.mesureP.reduce((sum, num) => sum + num, 0)*100 / feature.mesureP.length).toFixed(0)/100}</p>
                <p>Concentration de poussière PM1 moyenne : {(feature.mesureP.reduce((sum, num) => sum + num, 0)*100 / feature.mesureP.length).toFixed(0)/100}</p>
                <p>Concentration de poussière PM2.5 moyenne : {(feature.mesureP.reduce((sum, num) => sum + num, 0)*100 / feature.mesureP.length).toFixed(0)/100}</p>
                <p>Concentration de poussière PM10 moyenne : {(feature.mesureP.reduce((sum, num) => sum + num, 0)*100 / feature.mesureP.length).toFixed(0)/100}</p>
                <p>Concentration de CO2 moyenne : {(feature.mesureP.reduce((sum, num) => sum + num, 0)*100 / feature.mesureP.length).toFixed(0)/100}</p>
                
                <span class="footer-info">Dernière modification : {lastmod.toLocaleDateString("fr-FR")}</span>
              </div>
            ),
            mouseout: () => setHoveredInfo(null),
          }}
          >
          </Marker>
        );
      })}
    </>
  );
}







export default function MyMap_test() {
  const [hoveredInfo, setHoveredInfo] = useState(null);
  return (
    <div style={{display: "flex",justifyContent: "flex-end", alignItems: "flex-start", height: "100%",width: "100%",margin: 0, padding: 0,background: "#eee"}}>
      <title>Carte</title>
      <div style={{ height : "100%",width: '25%', padding: '0px'}}>
        {hoveredInfo ? hoveredInfo : <p>Survolez un marker</p>}
      </div>
      <MapContainer
        center={[47, 2.3522]}
        zoom={6}
        scrollWheelZoom={true}
        maxBounds={bounds}  
        maxBoundsViscosity={1}
        style={{ height: "100vh", width: "75vw"}}
      >
        {/*<TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{x}/{y}.png"
          attribution="Tiles © Esri — Source: Esri, USGS, NOAA"
          maxNativeZoom={19}
          detectRetina={false}
        />*/}
        <EsriImageryLayer />
        <ClusterLayer points={markers} setHoveredInfo={setHoveredInfo} />
      </MapContainer>
    </div>
  );
}


