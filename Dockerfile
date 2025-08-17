FROM node:20-alpine as builder
WORKDIR /usr/src/movemate-api

COPY package.json package-lock.json ./
COPY ./patches ./patches ./

RUN npm install --frozen-lockfile --unsafe-perm

COPY . .

RUN npx patch-package
RUN npm run build

FROM node:20-alpine
WORKDIR /usr/src/movemate-api
RUN mkdir -p uploads generated/invoice generated/receipt generated/whtcert generated/adjustmentnote generated/report/admin/booking generated/report/admin/customer generated/report/admin/driver generated/report/admin/debtor generated/report/admin/creditor generated/report/customer/booking

COPY package.json package-lock.json firebase-services.json ./
COPY --from=builder /usr/src/movemate-api/node_modules /usr/src/movemate-api/node_modules
COPY --from=builder /usr/src/movemate-api/dist /usr/src/movemate-api/dist

EXPOSE 4000
CMD ["/usr/src/movemate-api/dist/app.js"]