sudo docker run --rm --user $(id -u csantana):$(id -g csantana) \
-e http_proxy=http://xxx.xxx.xxx.xxx:xxxx \
-e https_proxy=http://xxx.xxx.xxx.xxx:xxxx \
--net=host -v $(pwd):/app -w /app -it node:13 bash

npx @angular/cli new frontend
