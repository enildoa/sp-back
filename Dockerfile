FROM node:20.17.0-alpine

RUN apk add --no-cache \
  python3 \
  build-base \
  pkgconfig \
  sqlite-dev

WORKDIR /usr/app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 80

CMD ["sh", "-c", "node --no-warnings --import tsx ./node_modules/.bin/knex migrate:latest && npm run dev"]