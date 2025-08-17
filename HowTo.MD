# 🚀 แนวทางการตั้งค่า CI/CD สำหรับโปรเจกต์ Node.js ด้วย GitHub Actions, Docker, และ Watchtower

เอกสารนี้จะแนะนำขั้นตอนการตั้งค่าระบบ CI/CD อัตโนมัติสำหรับโปรเจกต์ Node.js ของท่าน โดยมีเป้าหมายเพื่อให้ทุกครั้งที่มีการ Push โค้ดไปยัง Branch `main` ระบบจะทำการ Build Docker Image และ Deploy ขึ้น Server (Droplet) ให้โดยอัตโนมัติ

**Flow การทำงาน:**

1.  **Trigger:** เมื่อมีการ Push โค้ดขึ้น Branch `main`
2.  **CI (GitHub Actions):** Build Docker Image และ Push ขึ้นไปเก็บที่ Docker Hub
3.  **CD (Droplet):** Watchtower บน Server จะตรวจจับ Image ใหม่ และทำการ Pull มา Deploy ให้อัตโนมัติ

**ข้อดีของวิธีนี้:**

  * **🔒 ปลอดภัยสูง:** ไม่ต้องเก็บ SSH Key ของ Server ไว้ใน GitHub
  * **✨ ง่ายและยืดหยุ่น:** Workflow ไม่ซับซ้อน และย้าย Server ได้ง่ายมาก
  * **⚙️ อัตโนมัติเต็มรูปแบบ:** ตั้งค่าครั้งเดียว ใช้งานได้ตลอด

-----

## 📋 ส่วนที่ 1: การเตรียมตัว (Pre-requisites)

ก่อนเริ่มต้น ท่านต้องมีสิ่งเหล่านี้ให้พร้อม:

1.  **GitHub Repository:** สำหรับเก็บโค้ดโปรเจกต์ของท่าน
2.  **Docker Hub Account:** สร้างบัญชีที่ [hub.docker.com](https://hub.docker.com)
      * สร้าง **Access Token** สำหรับใช้ใน GitHub Actions (ไปที่ `Account Settings` \> `Security` \> `New Access Token`)
3.  **Server (DigitalOcean Droplet):** Server ที่ติดตั้ง Docker และ Docker Compose เรียบร้อยแล้ว
4.  **ไฟล์ `firebase-services.json`:** ไฟล์ Key สำหรับเชื่อมต่อกับ Firebase

-----

## 📦 ส่วนที่ 2: การเตรียมโปรเจกต์

### 1\. สร้าง `Dockerfile`

สร้างไฟล์ชื่อ `Dockerfile` ไว้ที่ Root ของโปรเจกต์ และใส่โค้ดตามที่ท่านใช้งาน:

```dockerfile
# Stage 1: Build the application
FROM node:20-alpine as builder
WORKDIR /usr/src/movemate-api

COPY package.json package-lock.json ./
# COPY ./patches ./patches ./ # Uncomment if you use patches

RUN npm install --frozen-lockfile --unsafe-perm

COPY . .

# RUN npx patch-package # Uncomment if you use patches
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine
WORKDIR /usr/src/movemate-api

# สร้างโฟลเดอร์สำหรับ uploads และ generated files
RUN mkdir -p uploads generated/invoice generated/receipt generated/whtcert generated/adjustmentnote generated/report/admin/booking generated/report/admin/customer generated/report/admin/driver generated/report/admin/debtor generated/report/admin/creditor generated/report/customer/booking

COPY package.json package-lock.json firebase-services.json ./
COPY --from=builder /usr/src/movemate-api/node_modules ./node_modules
COPY --from=builder /usr/src/movemate-api/dist ./dist

EXPOSE 4000
CMD ["node", "dist/app.js"]
```

### 2\. เพิ่มไฟล์ใน `.gitignore`

เพื่อให้แน่ใจว่าไฟล์ข้อมูลสำคัญจะไม่หลุดขึ้นไปบน GitHub ให้เพิ่มบรรทัดเหล่านี้เข้าไปในไฟล์ `.gitignore` ของท่าน:

```
# .gitignore

# Environment files
.env
.env.*
!.env.default

# Firebase
firebase-services.json

# Dependencies
node_modules
```

-----

## 🔐 ส่วนที่ 3: การจัดการข้อมูลสำคัญด้วย GitHub Secrets

เราจะเก็บข้อมูลที่ละเอียดอ่อนทั้งหมด (เช่น Key, Token, Password) ไว้ใน **GitHub Secrets**

### 1\. แปลง `firebase-services.json` เป็น Base64

เปิด Terminal/CMD ในตำแหน่งที่มีไฟล์ `firebase-services.json` แล้วรันคำสั่ง:

  * **macOS / Linux:** `base64 -w 0 --input firebase-services.json`
  * **Windows (CMD):** `certutil -encode -f firebase-services.json firebase-services.b64` (แล้วเปิดไฟล์ `firebase-services.b64` ขึ้นมา)

**คัดลอกข้อความยาวๆ หนึ่งบรรทัดที่ได้ทั้งหมดเก็บไว้**

### 2\. สร้าง GitHub Secrets

ไปที่ `Repository > Settings > Secrets and variables > Actions` แล้วคลิก `New repository secret` เพื่อสร้าง Secrets ต่อไปนี้:

  * **`DOCKERHUB_USERNAME`**: ชื่อผู้ใช้ Docker Hub ของท่าน
  * **`DOCKERHUB_TOKEN`**: Access Token ที่สร้างจาก Docker Hub
  * **`FIREBASE_SERVICES_JSON_B64`**: วางข้อความ Base64 ที่คัดลอกมาจากขั้นตอนที่แล้ว

-----

## 🤖 ส่วนที่ 4: สร้าง GitHub Actions Workflow

สร้างโฟลเดอร์ `.github/workflows/` ในโปรเจกต์ของท่าน และสร้างไฟล์ใหม่ชื่อ `deploy.yml`

**ไฟล์:** `.github/workflows/deploy.yml`

```yaml
name: Build and Push Docker Image

on:
  push:
    branches:
      - main # หรือ master

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - name: 🚚 Check out the repo
        uses: actions/checkout@v4

      - name: 🔐 Create Firebase service account file
        run: echo "${{ secrets.FIREBASE_SERVICES_JSON_B64 }}" | base64 --decode > firebase-services.json

      - name: 🐳 Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: 🏷️ Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ secrets.DOCKERHUB_USERNAME }}/movemate-api # ❗ เปลี่ยน 'movemate-api' เป็นชื่อ repo ของท่าน
          tags: |
            type=sha,prefix=,format=short
            type=raw,value=latest

      - name: 🐳 Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

-----

## 🖥️ ส่วนที่ 5: การตั้งค่า Server (Droplet) - *ทำเพียงครั้งเดียว*

### 1\. เชื่อมต่อไปยัง Server ของท่านผ่าน SSH

### 2\. สร้าง Directory สำหรับโปรเจกต์

```bash
mkdir -p /root/movemate-api/uploads
mkdir -p /root/movemate-api/generated
cd /root/movemate-api
```

### 3\. สร้างไฟล์ `.env` สำหรับ Production

ใช้ `nano` หรือ `vim` เพื่อสร้างไฟล์ `.env` และใส่ค่า Environment Variables ทั้งหมดที่จำเป็นสำหรับการรันโปรเจกต์ เช่น:

```env
# /root/movemate-api/.env

NODE_ENV=production
PORT=4000
MONGODB_URI="mongodb://your_connection_string"
# ... ตัวแปรอื่นๆ
```

### 4\. สร้างไฟล์ `docker-compose.yml`

ใช้ `nano` หรือ `vim` เพื่อสร้างไฟล์ `docker-compose.yml` และใส่โค้ดนี้:

```yaml
version: '3.8'

services:
  # บริการสำหรับ API ของเรา
  movemate-api:
    image: ${{ secrets.DOCKERHUB_USERNAME }}/movemate-api:latest # ❗❗ **สำคัญ:** แก้ไขเป็น Docker Hub Username ของท่าน
    container_name: movemate-api-container
    restart: always
    ports:
      - "4000:4000" # <Port บน Server>:<Port ใน Container>
    env_file:
      - ./.env # ดึงค่า env จากไฟล์ .env
    volumes:
      # เชื่อมโฟลเดอร์บน Server กับใน Container เพื่อเก็บข้อมูลถาวร
      - ./uploads:/usr/src/movemate-api/uploads
      - ./generated:/usr/src/movemate-api/generated
    labels:
      # Label นี้สำคัญมาก! เพื่อให้ Watchtower รู้ว่าต้องอัปเดต Container นี้
      - "com.centurylinklabs.watchtower.enable=true"

  # บริการสำหรับ Watchtower
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 60 # ตรวจสอบ Image ใหม่ทุกๆ 60 วินาที
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
```

**สำคัญ:** อย่าลืมแก้ไข `image:` ใน `docker-compose.yml` ให้เป็นชื่อ Docker Hub ของท่าน

### 5\. รันระบบ

รันคำสั่งนี้เพียงครั้งเดียว:

```bash
docker-compose up -d
```

คำสั่งนี้จะดึง Image และรันทั้ง `movemate-api` และ `watchtower` ขึ้นมาทำงานเบื้องหลัง

-----

## 🎉 เสร็จสิ้น\!

ตอนนี้ระบบ CI/CD ของท่านพร้อมทำงานแล้ว\!

  * ทุกครั้งที่ท่าน Push โค้ดไปยัง Branch `main`...
  * GitHub Actions จะ Build และ Push Image ใหม่ไปยัง Docker Hub
  * ภายใน 60 วินาที (หรือตามที่ตั้งค่า `interval`), Watchtower บน Server ของท่านจะตรวจพบ, ดึง Image ใหม่, และ Restart Container `movemate-api` ให้อัตโนมัติ

-----

## 🔧 การดูแลรักษา

### การย้าย Server

1.  ติดตั้ง Docker และ Docker Compose บน Server ใหม่
2.  คัดลอกโฟลเดอร์ `/root/movemate-api` ทั้งหมด (ที่มี `docker-compose.yml`, `.env`, `uploads`, `generated`) ไปยัง Server ใหม่
3.  รัน `docker-compose up -d`
4.  **จบ\! ไม่ต้องแก้ไขอะไรใน GitHub เลย**

### การเปลี่ยน Owner (เช่น เปลี่ยน Docker Hub Account)

1.  เข้าไปที่ `Repository > Settings > Secrets and variables > Actions`
2.  อัปเดตค่า `DOCKERHUB_USERNAME` และ `DOCKERHUB_TOKEN`
3.  แก้ไข `image:` ในไฟล์ `docker-compose.yml` บน Server ของท่าน
4.  รัน `docker-compose up -d` อีกครั้งบน Server
5.  **จบ\!**