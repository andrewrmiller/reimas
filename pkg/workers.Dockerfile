FROM node:16.17.0-alpine

RUN apk update
RUN apk upgrade
RUN apk add bash
RUN apk add ffmpeg
RUN apk add exiftool
RUN apk add curl

WORKDIR /usr/src/app

COPY package.json package.json

COPY common/ common/
COPY storage/ storage/
COPY ffmpeg/ ffmpeg/
COPY workers/ workers/
RUN yarn --prod

RUN mkdir /var/lib/picstrata
RUN chown -R node /var/lib/picstrata
VOLUME /var/lib/picstrata

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD [ "npm", "run", "up", "--prefix", "workers"]
