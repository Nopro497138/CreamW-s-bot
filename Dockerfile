FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-pillow \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install

# Copy source files individually so each change busts only its own cache layer
COPY pvz_render.py ./
COPY collab.js ./
COPY bot.js ./
COPY video.gif ./

# Verify Pillow and pvz_render.py at build time — deploy fails early on syntax errors
RUN python3 -c "from PIL import Image, ImageDraw, ImageFont; print('✅ Pillow OK')"
RUN python3 -c "import ast; ast.parse(open('pvz_render.py').read()); print('✅ pvz_render.py syntax OK')"
RUN python3 -c "compile(open('pvz_render.py').read(),'pvz_render.py','exec'); print('✅ pvz_render.py compile OK')"

CMD ["node", "bot.js"]
