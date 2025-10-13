# Image officielle Node.js (Debian légère)
FROM node:20-slim

# Crée le dossier de travail
WORKDIR /workspace

# Copie package.json et installe les dépendances
COPY package*.json ./
RUN npm install

# Copie tout le projet
COPY . .

# Expose le port 3000 (API)
EXPOSE 3000

# Commande par défaut
CMD ["npm", "run", "dev"]
