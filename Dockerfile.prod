FROM node:12

WORKDIR /root/app

COPY src ./src
COPY *.json ./
COPY *.ts ./
COPY *.js ./
COPY *.yaml ./
COPY package*.json ./
COPY tsconfig.json ./
RUN ls -la

RUN npm install
RUN npm ci --only=production
RUN npm run build

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["npm", "start"]
