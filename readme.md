sudo docker run --rm --user $(id -u csantana):$(id -g csantana) \
-e http_proxy=http://172.30.7.50:3128 \
-e https_proxy=http://172.30.7.50:3128 \
--net=host -v $(pwd):/app -w /app -it node:13 bash

npx @angular/cli new frontend
