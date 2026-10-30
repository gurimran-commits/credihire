import logging


def configure_logging(level: str) -> logging.Logger:
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logger = logging.getLogger("credihire")
    logger.setLevel(level)
    return logger
