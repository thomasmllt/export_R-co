                                                                         Projet RCo - Groupe 66

## Table des Matières
1. [À Propos]
2. [Principe de fonctionnement]


1. À propos :

Ce dépôt GitHub permet de faire tourner le site internet du projet RCo - 66. 
Ce site internet offre la possibilité de lire les données des balises du projet RCo sur une carte du monde entier. Le site internet est hébergé sur Render et est disponible à cette adresse : https://r-co.onrender.com/

Ce dépot est constituée de deux parties :
- La première est le backend qui permet la connexion entre la base de donnée et le site internet
- La seconde permet le fonctionnement du site web qui est basé sur React

2. Principe de fonctionnement :

--- BackEnd ---

Fichier index.js : Il permet de communiquer avec les routes du backend via les handler stockés dans le dossier routes

Dans le dossier routes :  
- BeaconHandler : Routes pour récupérer des informations sur les balises
- MeasurementHandler : Routes pour récupérer des informations sur les mesures
- PostMeasurement : Route pour upload 
- TypesHandler : Routes pour récupérer des informations sur les différentes types de mesures


--- FrontEnd ---
Aller dans le dossier Frontend

Dans src : 
-> Detail.jsx : Toutes les informations pour tracer les graphiques en fonction des données
-> Mymap.jsx : Permet d'afficher la page avec les balises 

