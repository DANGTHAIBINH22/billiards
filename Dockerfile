# Static site: Three.js app served by nginx (no build step, vendor/ already holds Three.js).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY lessons /usr/share/nginx/html/lessons
COPY vendor /usr/share/nginx/html/vendor
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
