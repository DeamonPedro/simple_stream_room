FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY . .

RUN uv sync

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]