import tempfile
import ffmpeg
import socketio
from fastapi import FastAPI
from os import path
from fastapi.staticfiles import StaticFiles

ROOM = 'videoparty_room'

temp_dir = tempfile.mkdtemp()

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

http_app = FastAPI()
http_app.mount('/hls', StaticFiles(directory=temp_dir, html=False), name='hls')
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
    print(path.isfile(data['url']))
    if path.isfile(data['url']):
        filename = path.basename(data['url'])
        basename, ext = filename.split('.')
        if ext in ['mp4', 'mkv']:
            output_filename = basename + '.m3u8'
            output_path = path.join(temp_dir, output_filename)
            ffmpeg.input(data['url']).output(
                output_path,
                format='hls',
                hls_time=10,
                hls_list_size=0,
                preset='fast',
                **{'c:v': 'copy', 'c:a': 'copy'}
            ).run()
            data['url'] = '/hls/' + output_filename
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