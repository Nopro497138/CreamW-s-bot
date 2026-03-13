FROM node:20-slim

# Install Python + pip + Pillow dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-pillow \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package.json ./
RUN npm install

# Copy all project files
COPY . .

# Verify python3 and pillow are available
RUN python3 -c "from PIL import Image; print('✅ Pillow OK')"

CMD ["node", "bot.js"]
