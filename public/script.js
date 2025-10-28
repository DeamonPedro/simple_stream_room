const resizer = document.getElementById('resizer');
const videoContainer = document.querySelector('.video-container');
const chatContainer = document.querySelector('.chat-container');

const player = videojs('video-player');
const socket = io();

let isResizing = false;
let currentSubtitle = null;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
    });
});

function handleMouseMove(e) {
    if (!isResizing) return;

    const totalWidth = document.body.clientWidth;
    const videoWidth = e.clientX;
    const chatWidth = totalWidth - e.clientX;

    videoContainer.style.flex = `0 0 ${videoWidth}px`;
    chatContainer.style.flex = `0 0 ${chatWidth}px`;
}

const chatMessagesContainer = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input input');
const sendButton = document.getElementById('send-button');
const setUrlButton = document.getElementById('set-url-button');
const subtitleFileInput = document.getElementById('subtitle-file-input');
const loadSubtitleButton = document.getElementById('load-subtitle-button');

let messages = [];
let currentAuthorId = 'Guest';

(function () {
    const storedNickname = localStorage.getItem('chatNickname');
    if (storedNickname) {
        currentAuthorId = storedNickname;
    } else {
        let nickname = prompt('Por favor, digite seu nickname para o chat:');
        if (nickname && nickname.trim() !== '') {
            currentAuthorId = nickname.trim();
            localStorage.setItem('chatNickname', currentAuthorId);
        } else {
            alert('Nenhum nickname fornecido. Você será identificado como "Guest".');
            localStorage.setItem('chatNickname', currentAuthorId);
        }
    }
    sendSystemMessage(`${currentAuthorId} entrou no chat.`);
})();

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-item');
    messageElement.classList.add('new-message');
    messageElement.dataset.id = message.id;

    if (message.type === 'system') {
        messageElement.classList.add('system-message');
        messageElement.textContent = message.text;
    } else {
        if (message.authorId === currentAuthorId) {
            messageElement.classList.add('my-message');
        }

        const lastMessage = messages[messages.length - 2];
        if (!lastMessage || lastMessage.authorId !== message.authorId || lastMessage.type === 'system') {
            const authorElement = document.createElement('div');
            authorElement.classList.add('message-author');
            authorElement.textContent = message.authorId;
            messageElement.appendChild(authorElement);
        }

        const textElement = document.createElement('div');
        textElement.classList.add('message-text');
        textElement.textContent = message.text;

        const timeElement = document.createElement('div');
        timeElement.classList.add('message-time');
        const date = new Date(message.createdAt);
        timeElement.textContent = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

        messageElement.appendChild(textElement);
        messageElement.appendChild(timeElement);
    }

    chatMessagesContainer.appendChild(messageElement);

    messageElement.addEventListener('animationend', () => {
        messageElement.classList.remove('new-message');
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        const newMessage = {
            id: generateUniqueId(),
            text: text,
            createdAt: new Date().toISOString(),
            authorId: currentAuthorId
        };
        socket.emit('chat message', newMessage);
        chatInput.value = '';
    }
}

function sendSystemMessage(text) {
    const systemMessage = {
        id: generateUniqueId(),
        text: text,
        createdAt: new Date().toISOString(),
        type: 'system'
    };
    messages.push(systemMessage);
    displayMessage(systemMessage);
}

sendButton.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

setUrlButton.addEventListener('click', () => {
    const newUrl = prompt('Digite a URL do novo vídeo:');
    if (newUrl && newUrl.trim() !== '') {
        socket.emit('video url', { url: newUrl.trim() });
    }
});

loadSubtitleButton.addEventListener('click', () => {
    subtitleFileInput.click();
});

subtitleFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const srtContent = srtToVtt(e.target.result);
            socket.emit('subtitle add', { srt: srtContent, name: file.name });
        };
        reader.readAsText(file);
    }
});

function srtToVtt(srtText) {
    const lines = srtText.split(/\r?\n/);
    const vtt = ["WEBVTT", ""];
    for (const line of lines) {
        if (/^\d+$/.test(line)) continue;
        vtt.push(line.replace(',', '.'));
    }
    return vtt.join('\n');
}

async function loadSubtitle(srtContent, fileName) {
    // if (currentSubtitle === fileName) return;
    const tracks = player.textTracks();
    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
            player.removeRemoteTextTrack(tracks[i]);
        }
    }

    const srtBlob = new Blob([srtContent], { type: 'text/plain' });
    const srtUrl = URL.createObjectURL(srtBlob);

    await player.addRemoteTextTrack({
        kind: 'subtitles',
        language: 'pt',
        label: fileName,
        src: srtUrl,
        default: true
    }, true);

    currentSubtitle = fileName;
    sendSystemMessage(`Legenda "${fileName}" carregada.`);
}


function togglePlayer() {
    if (player.paused()) {
        player.play();
    } else {
        player.pause();
    }
}

player.controlBar.playToggle.on('click', () => {
    socket.emit('video event', {
        type: player.paused() ? 'pause' : 'play',
        time: player.currentTime(),
        last_update: Math.floor(Date.now() / 1000)
    });
});

player.controlBar.progressControl.on('mouseup', () => {
    socket.emit('video event', {
        type: 'seek',
        time: player.currentTime(),
        last_update: Math.floor(Date.now() / 1000)
    });
});

socket.on('chat message', (msg) => {
    messages.push(msg);
    displayMessage(msg);
});

socket.on('video url', async (data) => {
    await player.show();
    await player.src(data.url);
    await player.load();
    sendSystemMessage(`O vídeo foi alterado para: ${data.url}`);
});

socket.on('video update', async (data) => {
    console.log(data);

    await updatePlayerState(data);
});

socket.on('subtitle add', async (data) => {
    console.log(data);

    await loadSubtitle(data.srt, data.name);
});

socket.on('initial state', async (data) => {
    console.log(data);

    data.messages.forEach(msg => {
        messages.push(msg);
        displayMessage(msg);
    });

    if (!data.url) {
        await player.hide();
    } else {
        console.log(data.url);

        await player.show();
        await player.src({ src: data.url, type: "video/mp4" });
        await player.load();
        await updatePlayerState(data.video)

        if (data.subtitle_content && data.subtitle_name) {
            await loadSubtitle(data.subtitle_content, data.subtitle_name);
        }
    }
});


async function updatePlayerState(video) {
    let currentTime = video.time;
    if (video.paused != player.paused()) {
        if (video.paused) {
            await player.pause();
        } else {
            await player.play();
        }
    } ''
    if (!video.paused) {
        const now = Math.floor(Date.now() / 1000);
        currentTime += now - video.last_update;
    }
    if (Math.abs(player.currentTime() - currentTime) > 0.5) {
        await player.currentTime(currentTime);
    }
}
