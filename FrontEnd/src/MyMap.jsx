import './MyMap.css'
import React, { useMemo,useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker,Popup, useMap, useMapEvents} from 'react-leaflet';
import { useNavigate } from "react-router-dom";
import * as EL from 'esri-leaflet';
import L from "leaflet";
import supercluster from "supercluster";
import { markers } from "../src/markers";
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
      background:#2e7d32;
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

export default function MyMap() {
  const navigate = useNavigate();
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const handleMarkerClick = (id) => {
    // 🔹 Navigue vers la même page avec un paramètre
    navigate(`/details/${id}`);
  };
  return (
    <div style={{display: "flex",justifyContent: "flex-end", alignItems: "flex-start", height: "100%",width: "100%",margin: 0, padding: 0,background: "#eee"}}>
      <div style={{ height : "100%",width: '20%', padding: '0px'}}>
        {hoveredInfo ? hoveredInfo : <p>Survolez un marker</p>}
      </div>
      <MapContainer
        center={[47, 2.3522]}
        zoom={6}
        scrollWheelZoom={true}
        maxBounds={bounds}  
        maxBoundsViscosity={1}
        style={{ height: "100vh", width: "80vw"}}
      >
        {/*<TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{x}/{y}.png"
          attribution="Tiles © Esri — Source: Esri, USGS, NOAA"
          maxNativeZoom={19}
          detectRetina={false}
        />*/}
        <EsriImageryLayer />
        {markers.map((m) => (
          <Marker key={m.id} position={m.position} icon={customIcon} eventHandlers={{
            click: () => handleMarkerClick(m.id),
            mouseover: () => setHoveredInfo(
              <div>
                <p>{m.name}</p>
                <p>Position GPS : {m.position.join(', ')}</p>
              </div>
            ),
            mouseout: () => setHoveredInfo(null),
          }}>
            <Popup>{m.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}


