HEROKU_ENDPOINT := $(shell git config --get remote.heroku.url)
HEROKU_APP      := $(shell echo $(HEROKU_ENDPOINT) | sed -E "s/^git@heroku.com:(.+).git/\1/")
HEROKU_URL      := "http://$(HEROKU_APP).herokuapp.com"

deploy: check-endpoint
	@NODE_ENV="production" NOTEBOOK_URL=$(HEROKU_URL) GITHUB_CLIENT_ID=$(DEPLOY_GITHUB_CLIENT_ID) grunt build
	@rm -rf deploy
	@mkdir deploy
	@cp -r build        deploy/build
	@cp -r routes       deploy/routes
	@cp -r app.js       deploy/app.js
	@cp -r Procfile     deploy/Procfile
	@cp -r package.json deploy/package.json
	@cd deploy && git init . && git add . && git commit -m \"Deploy\" && \
	git push "$(HEROKU_ENDPOINT)" master:master --force
	@rm -rf deploy

check-endpoint:
	@if [ "$(HEROKU_ENDPOINT)" == "" ]; then \
		echo "Heroku remote endpoint is not set."; \
		exit 1; \
	fi

.PHONY: deploy check-endpoint
