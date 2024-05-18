FROM node:20-alpine as builder
WORKDIR /usr/src/movemate-api

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine

COPY package.json package-lock.json ./

COPY --from=builder /usr/src/movemate-api/node_modules /node_modules
COPY --from=builder /usr/src/movemate-api/dist /dist

EXPOSE 4000
CMD ["dist/app.js"]