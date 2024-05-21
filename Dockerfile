FROM node:20-alpine as builder
WORKDIR /usr/src/movemate-api

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine
WORKDIR /usr/src/movemate-api

COPY package.json package-lock.json ./

COPY --from=builder /usr/src/movemate-api/node_modules /usr/src/movemate-api/node_modules
COPY --from=builder /usr/src/movemate-api/dist /usr/src/movemate-api/dist

EXPOSE 4000
CMD ["/usr/src/movemate-api/dist/app.js"]