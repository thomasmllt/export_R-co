import React from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";
import { useParams, useNavigate } from "react-router-dom";
import { markers } from "../src/markers";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function DetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const marker = markers.find((m) => m.properties.id == id);
  const nbMesures = marker.mesureT.length;
  const name = marker ? marker.name : "Unknown";
  const labels = marker.mesureT.map((_, i) => `Mesure ${i + 1}`);
  const [beaconName, setBeaconName] = React.useState("Chargement..."); //Test Julien

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



  const dataT = {
    labels,
    datasets: [
      {
        label: "",
        data: marker.mesureT,
        borderColor: "#3b82f6", // couleur bleu
        fill: false,
        tension: 0.0, // courbe lissée
        pointRadius: 5,
      },
    ],
  };

  const optionsT = {
    responsive: false,
    plugins: {
      legend: { display : false, position: "top" },
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
        title: {
          display: true,
          text: "Mesures",
        },
      },
    },
  };

  const dataP = {
    labels,
    datasets: [
      {
        label: "",
        data: marker.mesureP,
        borderColor: "#f63b3bff", // couleur bleu
        fill: false,
        tension: 0.0, // courbe lissée
        pointRadius: 5,
      },
    ],
  };

  const optionsP = {
    responsive: false,
    plugins: {
      legend: { display : false, position: "top" },
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
        title: {
          display: true,
          text: "Mesures",
        },
      },
    },
  };

  return (
    <div>
      <title>{`Données balise ${name}`}</title>
      <div style={{display: "flex",justifyContent: "flex-start", alignItems: "flex-start", height: "100%",width: "100%",margin: 0, padding: 0}}>
        <div  style={{ height : "100%",width: '5%', padding: '20px'}}>
          <button
            onClick={() => navigate("/carte")}
            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            Retour à la carte
          </button>
        </div>
        <div  style={{ height : "100%",width: '15%', padding: '20px'}}></div>
        <div style={{ height : "100%",width: '50%', padding: '0px'}}>
          <h1>Données de la balise {name}</h1>
          <h2>Données de test : {beaconName} </h2>
          <center><Line data={dataT} options={optionsT} width={800} height={400}/></center><br/><br/><br/><br/><br/>
          <center><Line data={dataP} options={optionsP} width={800} height={400}/></center>
        </div>
      </div>
    </div>
  );
}