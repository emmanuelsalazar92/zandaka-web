FROM node:20-bookworm-slim

ARG API_INTERNAL_URL=http://backend:3000

ENV API_INTERNAL_URL=${API_INTERNAL_URL}

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
