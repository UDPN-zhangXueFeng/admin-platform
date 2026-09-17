# nginx 镜像：构建期把 LP 后端地址注入 default.conf
FROM nginx:alpine

ARG NEXT_SERVICE_SERVER_URL

RUN rm /etc/nginx/conf.d/*
COPY ./default.conf /tmp/default.conf

RUN if [ -n "$NEXT_SERVICE_SERVER_URL" ]; then \
        sed -i "s|\\\${NEXT_SERVICE_SERVER_URL}|${NEXT_SERVICE_SERVER_URL}|g" /tmp/default.conf; \
    else \
        sed -i "s|\\\${NEXT_SERVICE_SERVER_URL}|http://10.0.7.87:8090|g" /tmp/default.conf; \
    fi && \
    mv /tmp/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
