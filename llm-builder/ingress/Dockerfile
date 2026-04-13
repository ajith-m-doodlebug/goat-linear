FROM nginx:1.26-alpine
RUN apk add --no-cache gettext
COPY default.conf.template /templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
