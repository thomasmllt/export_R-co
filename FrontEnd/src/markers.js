export const markers = [
  {name: "Paris", description : "Balise au coeur de Paris pour étudier la pollution de l'air", serial: "1234", properties : { cluster: false, id: 1 },geometry : {coordinates : [2.3522,48.8566,],}, times : ["2025-10-31T14:50:37","2025-11-01T14:50:37","2025-11-02T14:50:37","2025-11-03T14:50:37","2025-11-04T14:50:37"], mesureT: [10.1,10.5,10.3,11.4,9.8], mesureH : [], mesureCo : [], mesureP : [125,350,256,480,360] },
  {name: "Lyon", description : "Balise étudiant les variations de température à Lyon", serial: "2345", properties : { cluster: false, id: 2 }, geometry : {coordinates : [ 4.8357,45.7640,],}, times : ["2025-10-31T14:50:37","2025-11-01T14:50:37","2025-11-02T14:50:37","2025-11-03T14:50:37","2025-11-04T14:50:37"], mesureT: [10.1,10.5,10.3,15.4,12.3], mesureH : [], mesureCo : [], mesureP : [125,350,256,480,360]},
  {name: "Marseille", description : "Balise à Marseille", serial: "3456", properties : { cluster: false, id: 3 }, geometry : {coordinates : [ 5.3698,43.2965,],}, times : ["2025-10-31T14:50:37","2025-11-01T14:50:37","2025-11-02T14:50:37","2025-11-03T14:50:37","2025-11-04T14:50:37"], mesureT: [20.1,20.5,20.3,23.4,19.8], mesureH : [], mesureCo : [], mesureP : [125,350,256,480,360] },
  {name: "Test", description : "Balise à Marseille", serial: "4567", properties : { cluster: false, id: 4 }, geometry : {coordinates :[ 5.39,43.3,],}, times : ["2025-10-31T14:50:37","2025-11-01T14:50:37","2025-11-02T14:50:37","2025-11-03T14:50:37","2025-11-04T14:50:37"], mesureT: [20.1,20.5,20.3,23.4,19.8], mesureH : [], mesureCo : [], mesureP : [125,350,256,480,360]},
];

export const puntos = Array.from({ length: 3 }, (_, i) => ({
  name: `${i+1}`,
  properties: { cluster: false, id: i+1 },
  geometry: {
    coordinates: [
      2.3 + Math.random() * 0.2, // longitude
      48.8 + Math.random() * 0.2, // latitude
    ],
  },
}));