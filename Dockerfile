FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-pillow \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install

# Copy source files AFTER npm install so source changes don't bust npm cache
COPY pvz_render.py ./
COPY collab.js ./
COPY test_bot.js ./
COPY video.gif ./

# Hard verify at build time — if pvz_render.py has a syntax error, deploy FAILS here
RUN python3 -c "from PIL import Image; print('Pillow OK')"
RUN python3 -c "import ast; ast.parse(open('pvz_render.py').read()); print('pvz_render.py syntax OK')"
RUN python3 -c "import sys; compile(open('pvz_render.py').read(),'pvz_render.py','exec'); print('pvz_render.py compile OK')"

CMD ["node", "test_bot.js"]
