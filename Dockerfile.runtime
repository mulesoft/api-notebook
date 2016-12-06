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
COPY ./artifacts /usr/src/app/
COPY Dockerfile.d/server.py /usr/src/app/

EXPOSE 3000

# Change to user with lower privileges
USER app

CMD python server.py '/' 3000
