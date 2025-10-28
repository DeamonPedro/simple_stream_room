import socketio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn

ROOM = "videoparty_room"

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI()
app.mount("/", StaticFiles(directory="public", html=True), name="public")
app.state = {
    ROOM: {
        "url": None,
        "messages": [],
        "video": {
            "time": 0,
            "paused": False,
            "last_update": 0,
        },
        "subtitle_content": None,
        "subtitle_name": None,
    }
}

@sio.event
async def connect(sid, environ):
    await sio.enter_room(sid, ROOM)
    room_state = app.state[ROOM]
    print(room_state)
    print(f"connect {sid}")
    await sio.emit("initial state", room_state, to=sid)

@sio.event
async def disconnect(sid):
    await sio.leave_room(sid, ROOM)
    print(f"disconnect {sid}")

@sio.on('chat message')
async def chat_message(sid, data):
    room_state = app.state[ROOM]
    room_state["messages"].append(data)
    await sio.emit('chat message', data)

@sio.on('video url')
async def video_set_url(sid, data):
    room_state = app.state[ROOM]
    room_state["url"] = data["url"]
    await sio.emit('video url', data)

@sio.on('video event')
async def video_event(sid, data):
    room_state = app.state[ROOM]
    if data["type"] == "play":
        room_state["video"]["paused"] = False
    if data["type"] == "pause":
        room_state["video"]["paused"] = True
    room_state["video"]["time"] = data["time"]
    room_state["video"]["last_update"] = data["last_update"]
    await sio.emit('video update', room_state["video"])

@sio.on('subtitle add')
async def subtitle_event(sid, data):
    room_state = app.state[ROOM]
    room_state["subtitle_content"] = data["srt"]
    room_state["subtitle_name"] = data["name"]
    await sio.emit('subtitle add', data)


asgi_app = socketio.ASGIApp(sio, app)

if __name__=="__main__":
    uvicorn.run("main:asgi_app", host="127.0.0.1", port=8080, lifespan="on", reload=True)