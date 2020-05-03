FROM node:12.16.1-alpine

RUN apk update
RUN apk upgrade
RUN apk add bash
RUN apk add ffmpeg
RUN apk add curl

WORKDIR /usr/src/app

COPY package.json package.json

COPY common/ common/
COPY storage/ storage/
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
