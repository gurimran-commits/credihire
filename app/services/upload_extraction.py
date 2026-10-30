from io import BytesIO
from pathlib import Path
import warnings

from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader

try:
    import pymupdf
except ImportError:  # Optional at runtime so text PDFs still work without OCR rendering.
    pymupdf = None

try:
    import pytesseract
except ImportError:  # Optional at runtime so missing OCR support returns a safe 503.
    pytesseract = None


MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_EXTRACTED_TEXT = 12_000
MAX_IMAGE_PIXELS = 20_000_000
OCR_TIMEOUT_SECONDS = 10
PDF_RENDER_SCALE = 2
WINDOWS_TESSERACT_CMD = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
ALLOWED_FILES = {
    ".pdf": ("application/pdf", "pdf"),
    ".png": ("image/png", "image"),
    ".jpg": ("image/jpeg", "image"),
    ".jpeg": ("image/jpeg", "image"),
}


class UploadExtractionError(Exception):
    status_code = 400
    detail = "Unable to process uploaded file"


class UnsupportedUploadError(UploadExtractionError):
    status_code = 415
    detail = "Unsupported file type"


class OversizedUploadError(UploadExtractionError):
    status_code = 413
    detail = "Uploaded file too large"


class InvalidUploadError(UploadExtractionError):
    detail = "Invalid or corrupted uploaded file"


class UnprocessableUploadError(UploadExtractionError):
    status_code = 422
    detail = "Uploaded file has no usable text"


class OCRUnavailableError(UploadExtractionError):
    status_code = 503
    detail = "OCR service is unavailable"


class ExtractedUpload:
    def __init__(self, media_type: str, text: str) -> None:
        self.media_type, self.text = media_type, text


def resolve_tesseract_cmd(configured_cmd: str | None = None) -> str:
    if configured_cmd:
        return configured_cmd
    if WINDOWS_TESSERACT_CMD.exists():
        return str(WINDOWS_TESSERACT_CMD)
    return "tesseract"


class UploadTextExtractor:
    def __init__(self, tesseract_cmd: str | None = None) -> None:
        self.tesseract_cmd = resolve_tesseract_cmd(tesseract_cmd)

    def extract(self, filename: str | None, content_type: str | None, data: bytes) -> ExtractedUpload:
        suffix = Path(filename or "").suffix.lower()
        allowed = ALLOWED_FILES.get(suffix)
        if not allowed or content_type != allowed[0]:
            raise UnsupportedUploadError()
        if not data:
            raise UnprocessableUploadError()
        if len(data) > MAX_UPLOAD_BYTES:
            raise OversizedUploadError()
        media_type = allowed[1]
        if suffix == ".pdf":
            if not data.startswith(b"%PDF-"):
                raise UnsupportedUploadError()
            return ExtractedUpload(media_type, self._extract_pdf(data))
        if suffix == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise UnsupportedUploadError()
        if suffix in {".jpg", ".jpeg"} and not data.startswith(b"\xff\xd8\xff"):
            raise UnsupportedUploadError()
        return ExtractedUpload(media_type, self._extract_image(data, suffix))

    def _extract_pdf(self, data: bytes) -> str:
        try:
            reader = PdfReader(BytesIO(data), strict=True)
            if reader.is_encrypted:
                raise UnprocessableUploadError("Encrypted PDF")
            if len(reader.pages) > MAX_PDF_PAGES:
                raise UnprocessableUploadError("PDF page limit exceeded")
            text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
            if text:
                return self._validate_text(text)
        except UnprocessableUploadError:
            raise
        except Exception as exc:
            raise InvalidUploadError() from exc
        return self._extract_scanned_pdf(data)

    def _extract_scanned_pdf(self, data: bytes) -> str:
        if pymupdf is None or pytesseract is None:
            raise OCRUnavailableError()
        try:
            document = pymupdf.open(stream=data, filetype="pdf")
            try:
                if document.page_count > MAX_PDF_PAGES:
                    raise UnprocessableUploadError("PDF page limit exceeded")
                text = "\n".join(
                    page_text
                    for page_number in range(document.page_count)
                    if (page_text := self._ocr_pdf_page(document.load_page(page_number)))
                )
            finally:
                document.close()
            return self._validate_text(text)
        except UploadExtractionError:
            raise
        except Exception as exc:
            raise InvalidUploadError() from exc

    def _ocr_pdf_page(self, page) -> str:
        try:
            rect = page.rect
            if rect.width * rect.height * PDF_RENDER_SCALE**2 > MAX_IMAGE_PIXELS:
                raise InvalidUploadError()
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(PDF_RENDER_SCALE, PDF_RENDER_SCALE), alpha=False)
            if pixmap.width * pixmap.height > MAX_IMAGE_PIXELS:
                raise InvalidUploadError()
            with Image.open(BytesIO(pixmap.tobytes("png"))) as image:
                image.load()
                return self._run_ocr(image.convert("RGB")).strip()
        except UploadExtractionError:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning, UnidentifiedImageError, OSError, ValueError) as exc:
            raise InvalidUploadError() from exc

    def _extract_image(self, data: bytes, suffix: str) -> str:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(data)) as image:
                    expected_format = "PNG" if suffix == ".png" else "JPEG"
                    if image.format != expected_format:
                        raise UnsupportedUploadError()
                    if image.width * image.height > MAX_IMAGE_PIXELS:
                        raise InvalidUploadError()
                    image.verify()
                with Image.open(BytesIO(data)) as image:
                    if image.width * image.height > MAX_IMAGE_PIXELS:
                        raise InvalidUploadError()
                    image.load()
                    prepared = image.convert("RGB")
        except UnsupportedUploadError:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning, UnidentifiedImageError, OSError, ValueError) as exc:
            raise InvalidUploadError() from exc
        if pytesseract is None:
            raise OCRUnavailableError()
        return self._validate_text(self._run_ocr(prepared))

    def _run_ocr(self, image: Image.Image) -> str:
        try:
            pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
            return pytesseract.image_to_string(image, lang="eng", timeout=OCR_TIMEOUT_SECONDS)
        except Exception as exc:
            raise OCRUnavailableError() from exc

    @staticmethod
    def _validate_text(text: str) -> str:
        text = text.strip()
        if not text:
            raise UnprocessableUploadError()
        if len(text) > MAX_EXTRACTED_TEXT:
            raise UnprocessableUploadError("Extracted text limit exceeded")
        return text
