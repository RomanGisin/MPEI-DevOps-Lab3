FROM nginx:alpine

# Копируем наш конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем файлы фронтенда (html, css, js)
COPY . /usr/share/nginx/html

EXPOSE 80
