deploy:
	@grunt build
	@cd ./build && git init . && git add . && git commit -m \"Deploy\" && \
	git push "git@github.com:FormidableLabs/jsnotebook.git" master:gh-pages --force && rm -rf .git
