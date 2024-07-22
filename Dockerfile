# Menggunakan Node.js versi 14 sebagai base image
FROM node:14

# Set direktori kerja di dalam container
WORKDIR /usr/src/app

# Menyalin file package.json dan package-lock.json
COPY package*.json ./

# Menginstal dependensi
RUN npm install

# Menyalin sisa file aplikasi
COPY . .

# Menyebutkan port yang digunakan
EXPOSE 3000

# Menjalankan aplikasi
CMD ["node", "bot.js"]
