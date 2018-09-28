#################
# BUILD CONTAINER
FROM devdocker.mulesoft.com:18078/mulesoft/core-paas-base-image-node-8.12:v2.0.7 as BUILD

USER root

# Add dependencies and setup working directory
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    git \
    phantomjs \
    bzip2 \
 && rm -rf /var/lib/apt/lists/*

# Install and cache node_modules/
COPY --chown=app:app package*.json /code/
WORKDIR /code
USER app
RUN npm set progress=false && \
    npm install -s --no-progress

# Build project
COPY . /code
RUN npm run build && \
    npm prune -s --production


###################
# RUNTIME CONTAINER
FROM devdocker.mulesoft.com:18078/mulesoft/core-paas-base-image-ubuntu:v2.2.149

# Intall build dependencies
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python \
 && rm -rf /var/lib/apt/lists/*

# Add app user
RUN groupadd -g 2020 app
RUN useradd -u 2020 -g 2020 -r -m -d /usr/src/app app

# Copy built artifacts from build container
COPY --from=BUILD /code/build /usr/src/app

# Copy python server file
COPY --chown=app:app server.py /usr/src/app/
WORKDIR /usr/src/app
USER app

EXPOSE 3000
CMD ["python", "server.py", "'/'", "3000"]
