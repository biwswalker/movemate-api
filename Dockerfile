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
RUN mkdir uploads
RUN mkdir generated
RUN mkdir generated/invoice
RUN mkdir generated/receipt
RUN mkdir generated/whtcert
RUN mkdir generated/adjustmentnote
RUN mkdir generated/report
RUN mkdir generated/report/admin
RUN mkdir generated/report/customer
RUN mkdir generated/report/admin/booking
RUN mkdir generated/report/admin/customer
RUN mkdir generated/report/admin/driver
RUN mkdir generated/report/admin/debtor
RUN mkdir generated/report/admin/creditor

COPY package.json package-lock.json firebase-services.json ./
COPY --from=builder /usr/src/movemate-api/node_modules /usr/src/movemate-api/node_modules
COPY --from=builder /usr/src/movemate-api/dist /usr/src/movemate-api/dist

EXPOSE 4000
CMD ["/usr/src/movemate-api/dist/app.js"]