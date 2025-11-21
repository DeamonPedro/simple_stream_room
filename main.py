import ffmpeg
import socketio
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

ROOM = 'videoparty_room'

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

http_app = FastAPI()

VIDEOS_DIR = Path('videos')
HLS_CACHE_DIR = Path('hls_cache')

@http_app.get("/videos/{file_path:path}/index.m3u8")
async def get_hls_playlist(file_path: str):
    source_video_path = VIDEOS_DIR / file_path
    output_playlist_path = HLS_CACHE_DIR / file_path / "index.m3u8"

    if not source_video_path.is_file():
        raise HTTPException(status_code=404, detail="Original video not found")

    if not output_playlist_path.is_file():
        output_playlist_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            (
                ffmpeg.input(str(source_video_path))
                .output(
                    str(output_playlist_path),
                    format='hls',
                    hls_time=10,
                    hls_list_size=0,
                    **{
                        'c:v': 'libx264',
                        'crf': 23,
                        'preset': 'fast',
                        'c:a': 'aac',
                        'b:a': '128k',
                        'pix_fmt': 'yuv420p'
                    }
                )
                .run(capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            print(e.stderr.decode())
            raise HTTPException(status_code=500, detail="FFmpeg conversion failed")
    return FileResponse(output_playlist_path, media_type="application/x-mpegURL")

http_app.mount('/videos', StaticFiles(directory=HLS_CACHE_DIR), name='video_cache')
http_app.mount('/', StaticFiles(directory='public', html=True), name='public')

http_app.state = {
    ROOM: {
        'url': None,
        'messages': [],
        'video': {
            'time': 0,
            'paused': False,
            'last_update': 0,
        },
        'subtitle_content': None,
        'subtitle_name': None,
    }
}

@sio.event
async def connect(sid, environ):
    await sio.enter_room(sid, ROOM)
    room_state = http_app.state[ROOM]
    await sio.emit('initial state', room_state, to=sid)

@sio.event
async def disconnect(sid):
    await sio.leave_room(sid, ROOM)

@sio.on('chat message')
async def chat_message(sid, data):
    room_state = http_app.state[ROOM]
    room_state['messages'].append(data)
    await sio.emit('chat message', data)

@sio.on('video url')
async def video_set_url(sid, data):
    room_state = http_app.state[ROOM]
    room_state['url'] = data['url']
    await sio.emit('video url', data)

@sio.on('video event')
async def video_event(sid, data):
    room_state = http_app.state[ROOM]
    if data['type'] == 'play':
        room_state['video']['paused'] = False
    if data['type'] == 'pause':
        room_state['video']['paused'] = True
    room_state['video']['time'] = data['time']
    room_state['video']['last_update'] = data['last_update']
    await sio.emit('video update', room_state['video'])

@sio.on('subtitle add')
async def subtitle_event(sid, data):
    room_state = http_app.state[ROOM]
    room_state['subtitle_content'] = data['srt']
    room_state['subtitle_name'] = data['name']
    await sio.emit('subtitle add', data)


app = socketio.ASGIApp(sio, http_app)
