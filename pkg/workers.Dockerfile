FROM node:10.15.0-alpine

RUN apk update
RUN apk upgrade
RUN apk add bash
RUN apk add git

WORKDIR /usr/src/app

COPY package.json package.json

COPY common/ common/
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
