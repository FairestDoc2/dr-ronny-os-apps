ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

RUN apk add --no-cache python3 py3-pip git

COPY requirements.txt /requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r /requirements.txt

COPY run.sh /run.sh
COPY app /app
COPY config.yaml /app/config.yaml
COPY manifest /app/manifest
COPY roadmap.json /app/roadmap.json
COPY .phoenix /app/.phoenix

RUN chmod +x /run.sh

CMD ["/run.sh"]
