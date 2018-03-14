# BUILD CONTAINER
FROM node:6.11-alpine as build

# Add dependencies and setup working directory
RUN apk update \
 && apk add git
RUN mkdir -p /code
WORKDIR /code

# Install and cache node_modules/
COPY package.json /code/package.json
RUN npm set progress=false && \
    npm install -g --no-progress grunt && \
    npm install -s --no-progress

COPY . /code
RUN grunt build && \
    npm prune -s --production

# RUNTIME CONTAINER
FROM devdocker.mulesoft.com:18078/base/ubuntu:trusty-1.5.0-31-g1dc737a

# Intall build dependencies
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python \
 && rm -rf /var/lib/apt/lists/*

# Add app user
RUN groupadd -r app && useradd -r -g app app

# Folder to deploy artifacts
RUN mkdir -p /usr/src/app && chown -R app:app /usr/src/app
WORKDIR /usr/src/app

# Copy built artifacts from build container
COPY --from=build /code/build /usr/src/app
COPY server.py /usr/src/app/

# Change to user with lower privileges
USER app

EXPOSE 3000
CMD python server.py '/' 3000
