FROM node:20-slim

# Install canvas native dependencies
RUN apt-get update && apt-get install -y \
    libcairo2-dev libpango1.0-dev libjpeg-dev \
    libgif-dev librsvg2-dev build-essential \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install

COPY pvz_render.js ./
COPY collab.js ./
COPY bot.js ./
COPY video.gif ./
COPY sprite_bg.png ./
COPY sprite_peashooter.png ./
COPY sprite_wallnut.png ./
COPY sprite_sunflower.png ./
COPY sprite_zombie.png ./

# Verify canvas loads correctly
RUN node -e "const {createCanvas}=require('canvas');const c=createCanvas(10,10);console.log('canvas OK',c.width)"

CMD ["node", "bot.js"]
