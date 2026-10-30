import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int) -> None:
        super().__init__(app)
        self.limit, self.calls, self.lock = limit, defaultdict(deque), Lock()

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/v1/health":
            return await call_next(request)
        now = time.monotonic()
        client = request.client.host if request.client else "unknown"
        with self.lock:
            calls = self.calls[client]
            while calls and calls[0] <= now - 60:
                calls.popleft()
            if len(calls) >= self.limit:
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
            calls.append(now)
        return await call_next(request)
