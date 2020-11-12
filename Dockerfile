FROM node:latest

RUN npm install -g truffle
RUN npm install -g ganache-cli

RUN mkdir -p /usr/local/dfo-protocol

COPY . /usr/local/dfo-protocol/

WORKDIR /usr/local/dfo-protocol
RUN cp scripts/entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]