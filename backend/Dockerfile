FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 4000
CMD ["sh", "-c", "node migrations/migrate.js && node seed/seed.js && node src/server.js"]
