# SSTE-Tabule

This repositoray is a project for "Tabule" at SSTE school gate.

# The Board

## Dependencies

- Next.js

## Running

```bash
npm install && npm build
```

Then, run one of the Containers below.

---

# Containers

## Dependencies

- Docker
- X11 or Wayland (For running kiosk)

## Running kiosk without server

For kisok without server, you need to set the `URL` environment variable to the URL of the server.
For setting up the server, see [Running Server](#running-server).
If you don't want to run the server, see [Running Kiosk with Server](#running-kiosk-and-server).

### X11

```bash
URL=http://your-url-to-tabule-server.com && \
docker build -f Dockerfile.kiosk -t tabule . && \
xhost +local:docker && \
docker run -it --rm -e DISPLAY=$DISPLAY -e URL=$URL --volume /tmp/.X11-unix:/tmp/.X11-unix --device /dev/dri tabule
```

> [!NOTE]
> The `xhost +local:docker` command is used to allow the docker container to access the X11 server.
> For Revoking the access, use `xhost -local:docker`.

### Wayland

```bash
URL=http://your-url-to-tabule-server.com && \
docker build -f Dockerfile.kiosk -t tabule . && \
docker run -it --rm -e WAYLAND_DISPLAY=$WAYLAND_DISPLAY -e XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR -e URL=$URL --volume $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY:/run/user/$(id -u)/$WAYLAND_DISPLAY --device /dev/dri tabule
```

## Running kiosk and server

### X11

```bash
docker build -f Dockerfile.kiosk_and_server -t tabule . && \
xhost +local:docker && \
docker run --rm -e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix tabule
```

> [!NOTE]
> The `xhost +local:docker` command is used to allow the docker container to access the X11 server.
> For Revoking the access, use `xhost -local:docker`.

### Wayland

```bash
docker build -f Dockerfile.kiosk_and_server -t tabule . && \
docker run -it --rm --env WAYLAND_DISPLAY=$WAYLAND_DISPLAY --env XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR --volume $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY:/run/user/$(id -u)/$WAYLAND_DISPLAY --device /dev/dri tabule
```

## Running Server

To change the port, change the `MYPORT` variable in the command below.

```bash
MYPORT=80 && \
docker build -f Dockerfile.server -t tabule . && \
docker run -d -p $MYPORT:80 tabule
```
