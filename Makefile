upload:
	echo "/* Miyamoto-san https://github.com/upamune/miyamoto/ */" > main.gs
	echo "/* (c) upamune 2017- License: MIT */" >> main.gs
	echo "/* ------------------- */" >> main.gs
	cat scripts/*.js | sed -e "s/::VERSION::/`head VERSION`/g" >> main.gs
	./node_modules/gas-manager/bin/gas upload -c ./gas-config.json

test:
	node testrunner.js
