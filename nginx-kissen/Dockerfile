# nginx 镜像：构建期把 kissen 后端地址注入 default.conf
# 参照 nginx/Dockerfile，仅默认后端地址不同。
FROM nginx:alpine

ARG NEXT_SERVICE_SERVER_URL

RUN rm /etc/nginx/conf.d/*
COPY ./default.conf /tmp/default.conf

# 占位符替换：传了就用传入值，没传用默认 kissen 测试后端
RUN if [ -n "$NEXT_SERVICE_SERVER_URL" ]; then \
        sed -i "s|\\\${NEXT_SERVICE_SERVER_URL}|${NEXT_SERVICE_SERVER_URL}|g" /tmp/default.conf && \
        echo "✅ Nginx 后端地址: ${NEXT_SERVICE_SERVER_URL}"; \
    else \
        sed -i "s|\\\${NEXT_SERVICE_SERVER_URL}|http://10.0.7.103:9000|g" /tmp/default.conf && \
        echo "⚠️  NEXT_SERVICE_SERVER_URL 未设置，使用默认: http://10.0.7.103:9000"; \
    fi && \
    mv /tmp/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
