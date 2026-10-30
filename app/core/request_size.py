from fastapi.responses import JSONResponse


class RequestSizeLimitMiddleware:
    """Buffers bounded request bodies before FastAPI parses them."""

    def __init__(self, app, max_bytes: int, upload_max_bytes: int) -> None:
        self.app, self.max_bytes, self.upload_max_bytes = app, max_bytes, upload_max_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = self.upload_max_bytes if scope["path"] == "/api/v1/scam/analyze/upload" else self.max_bytes
        content_length = next((value for key, value in scope["headers"] if key == b"content-length"), None)
        if content_length and content_length.isdigit() and int(content_length) > limit:
            await JSONResponse(status_code=413, content={"detail": "Request body too large"})(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                await JSONResponse(status_code=413, content={"detail": "Request body too large"})(scope, receive, send)
                return
            if not message.get("more_body", False):
                break
        sent = False

        async def replay_body():
            nonlocal sent
            if sent:
                return {"type": "http.disconnect"}
            sent = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay_body, send)
