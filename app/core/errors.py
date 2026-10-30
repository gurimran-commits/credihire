import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def install_error_handlers(app: FastAPI) -> None:
    logger = logging.getLogger("credihire")

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(part) for part in error["loc"] if part != "body"), "message": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        logger.warning("request_validation_failed path=%s issue_count=%s", _.url.path, len(errors))
        return JSONResponse(status_code=422, content={"detail": "Invalid request", "errors": errors})

