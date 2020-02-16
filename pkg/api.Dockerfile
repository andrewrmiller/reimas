FROM node:10.15.0-alpine

RUN apk update
RUN apk upgrade
RUN apk add bash

WORKDIR /usr/src/app

COPY package.json package.json

COPY common/ common/
COPY ffmpeg/ ffmpeg/
COPY api/ api/
RUN yarn --prod

RUN mkdir -p api/uploads
RUN chown -R node api/uploads

RUN mkdir /var/lib/picstrata
RUN chown -R node /var/lib/picstrata
VOLUME /var/lib/picstrata

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD [ "npm", "run", "up", "--prefix", "api"]
