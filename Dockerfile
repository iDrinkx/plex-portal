FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

VOLUME ["/config"]

EXPOSE 3000

CMD ["node", "server.js"]
