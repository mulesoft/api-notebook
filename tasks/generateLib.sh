#!/usr/bin/env bash

node_modules/uglify-es/bin/uglifyjs build/scripts/bundle.js > build/scripts/_bundle.js
mv build/scripts/_bundle.js build/scripts/bundle.js

node_modules/uglify-es/bin/uglifyjs build/scripts/embed.js > build/scripts/_embed.js
mv build/scripts/_embed.js build/scripts/embed.js

node_modules/uglify-es/bin/uglifyjs build/test/scripts/bundle.js > build/test/scripts/_bundle.js
mv build/test/scripts/_bundle.js build/test/scripts/bundle.js

node_modules/uglify-es/bin/uglifyjs build/plugins/embed-hash-persistence.js > build/plugins/_embed-hash-persistence.js
mv build/plugins/_embed-hash-persistence.js build/plugins/embed-hash-persistence.js

node_modules/uglify-es/bin/uglifyjs build/plugins/filter-properties.js > build/plugins/_filter-properties.js
mv build/plugins/_filter-properties.js build/plugins/filter-properties.js

node_modules/uglify-es/bin/uglifyjs build/plugins/function-property-filter.js > build/plugins/_function-property-filter.js
mv build/plugins/_function-property-filter.js build/plugins/function-property-filter.js

node_modules/uglify-es/bin/uglifyjs build/plugins/gist-persistence.js > build/plugins/_gist-persistence.js
mv build/plugins/_gist-persistence.js build/plugins/gist-persistence.js

node_modules/uglify-es/bin/uglifyjs build/plugins/hash-persistence.js > build/plugins/_hash-persistence.js
mv build/plugins/_hash-persistence.js build/plugins/hash-persistence.js

node_modules/uglify-es/bin/uglifyjs build/plugins/proxy.js > build/plugins/_proxy.js
mv build/plugins/_proxy.js build/plugins/proxy.js

node_modules/uglify-es/bin/uglifyjs build/plugins/raml-client-generator.js > build/plugins/_raml-client-generator.js
mv build/plugins/_raml-client-generator.js build/plugins/raml-client-generator.js

rm -rf lib/
mkdir lib
cp -R build/* lib/
