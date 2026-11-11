FROM node:20-slim

# Pasang ffmpeg untuk pengolahan stiker dan audio WhatsApp
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin package json dan install dependensi
COPY package*.json ./
RUN npm install --omit=dev

# Salin kode aplikasi
COPY . .

# Buat folder auth_info_baileys
RUN mkdir -p auth_info_baileys

CMD ["npm", "start"]
