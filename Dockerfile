FROM node:20-alpine

WORKDIR /app

# Copia i manifesti delle dipendenze
COPY package*.json tsconfig.json ./

# Installa tutte le dipendenze e compila TypeScript
RUN npm install
COPY src ./src
RUN npm run build

# Espone il punto d'ingresso MCP su Stdio
CMD ["node", "dist/index.js"]
