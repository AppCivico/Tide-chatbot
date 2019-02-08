FROM node:10.4.1
ENV NPM_CONFIG_LOGLEVEL warn

EXPOSE 1238

USER root
RUN mkdir src
RUN chown -R node:node /src
RUN apt-get update && apt-get install -y runit

USER node

WORKDIR /src
RUN npm install bottender dotenv

ADD package.json /src/
RUN npm install

USER root

COPY services/ /etc/service/
RUN chmod +x /etc/service/*/run

ENTRYPOINT ["runsvdir"]
CMD ["/etc/service/"]
