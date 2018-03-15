DOCKER_REGISTRY ?= devdocker.mulesoft.com:18078

IMAGE_NAME = api-platform/api-notebook
PROD_IMAGE = $(IMAGE_NAME):$$(git describe)

SRC_VOLUME_PARAM = -v $$(pwd):/usr/src/app

#### BUILD the artifacts
.PHONY: build-artifacts
build-artifacts:
	echo "No artifacts."

#### BUILD docker image
.PHONY: build-image
build-image:
	docker build -t $(PROD_IMAGE) .

#### PUSH DOCKER IMAGE
.PHONY: push-image
push-image:
	docker tag $(PROD_IMAGE) $(DOCKER_REGISTRY)/$(PROD_IMAGE)
	docker push $(DOCKER_REGISTRY)/$(PROD_IMAGE)
