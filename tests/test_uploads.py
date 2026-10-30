from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import get_settings
from app.dependencies import get_chatbot_service, get_scam_service
from app.main import create_app
from app.schemas.scam import ScamAnalysisResponse
from app.services import upload_extraction
from app.services.upload_extraction import UploadTextExtractor


def text_pdf(text: str = "Recruiter requests an advance fee") -> bytes:
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(f'BT /F1 12 Tf 72 720 Td ({text}) Tj ET'.encode())} >>\nstream\nBT /F1 12 Tf 72 720 Td ({text}) Tj ET\nendstream".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body, offsets = bytearray(b"%PDF-1.4\n"), []
    for number, obj in enumerate(objects, 1):
        offsets.append(len(body))
        body.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(body)
    body.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    body.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets))
    body.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(body)


def png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (20, 20), "white").save(output, format="PNG")
    return output.getvalue()


def mocked_pdf_renderer() -> SimpleNamespace:
    class Page:
        rect = SimpleNamespace(width=20, height=20)

        @staticmethod
        def get_pixmap(**_kwargs):
            return SimpleNamespace(width=20, height=20, tobytes=lambda _format: png_bytes())

    class Document:
        page_count = 1

        @staticmethod
        def load_page(_number):
            return Page()

        @staticmethod
        def close():
            pass

    return SimpleNamespace(Matrix=lambda *_args: None, open=lambda **_kwargs: Document())


class FakeScamService:
    def __init__(self) -> None:
        self.analyze = Mock(return_value=ScamAnalysisResponse(
            analysis_id="123e4567-e89b-12d3-a456-426614174000", risk_level="high", risk_score=90, indicators=[], summary="Engine result", disclaimer="Test"
        ))

    async def analyze_with_enrichment(self, request):
        return self.analyze(request)


@pytest.fixture(autouse=True)
def clear_rule_engine_configuration(monkeypatch):
    from app.core.config import Settings
    isolated_settings = lambda: Settings(_env_file=None)
    monkeypatch.setattr("app.main.get_settings", isolated_settings)
    monkeypatch.setattr("app.dependencies.get_settings", isolated_settings)
    monkeypatch.setattr("app.api.v1.routes.get_settings", isolated_settings)
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()
    yield
    get_settings.cache_clear()
    get_scam_service.cache_clear()
    get_chatbot_service.cache_clear()


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_scam_service] = FakeScamService
    return TestClient(app)


def upload(client, name: str, data: bytes, content_type: str):
    return client.post("/api/v1/scam/analyze/upload", files={"file": (name, data, content_type)})


def test_valid_pdf_is_extracted_and_analyzed(client):
    response = upload(client, "offer.pdf", text_pdf(), "application/pdf")
    assert response.status_code == 200
    assert response.json()["media_type"] == "pdf"
    assert "advance fee" in response.json()["extracted_text"]
    assert response.json()["analysis"]["risk_score"] == 90


def test_scanned_pdf_falls_back_to_mocked_ocr(client, monkeypatch):
    monkeypatch.setattr(upload_extraction, "pymupdf", mocked_pdf_renderer())
    monkeypatch.setattr(upload_extraction.pytesseract, "image_to_string", lambda *_args, **_kwargs: "Recruiter asks for a fee")
    response = upload(client, "scan.pdf", text_pdf(""), "application/pdf")
    assert response.status_code == 200
    assert response.json()["extracted_text"] == "Recruiter asks for a fee"


def test_blank_pdf_without_ocr_text_is_rejected(monkeypatch):
    monkeypatch.setattr(upload_extraction, "pymupdf", mocked_pdf_renderer())
    monkeypatch.setattr(upload_extraction.pytesseract, "image_to_string", lambda *_args, **_kwargs: "")
    with pytest.raises(upload_extraction.UnprocessableUploadError):
        UploadTextExtractor().extract("blank.pdf", "application/pdf", text_pdf(""))


def test_scanned_pdf_ocr_failure_is_safe(monkeypatch):
    monkeypatch.setattr(upload_extraction, "pymupdf", mocked_pdf_renderer())
    monkeypatch.setattr(upload_extraction.pytesseract, "image_to_string", Mock(side_effect=RuntimeError("OCR failed")))
    with pytest.raises(upload_extraction.OCRUnavailableError):
        UploadTextExtractor().extract("scan.pdf", "application/pdf", text_pdf(""))


def test_image_ocr_uses_mocked_ocr(client, monkeypatch):
    monkeypatch.setattr(upload_extraction.pytesseract, "image_to_string", lambda *_args, **_kwargs: "WhatsApp recruiter asks for payment")
    response = upload(client, "chat.png", png_bytes(), "image/png")
    assert response.status_code == 200
    assert response.json()["media_type"] == "image"
    assert response.json()["extracted_text"] == "WhatsApp recruiter asks for payment"


@pytest.mark.parametrize(
    ("name", "data", "content_type"),
    [
        ("offer.txt", b"plain text", "text/plain"),
        ("offer.pdf", png_bytes(), "application/pdf"),
        ("chat.png", b"not a png", "image/png"),
    ],
)
def test_invalid_file_types_and_signatures_are_rejected(client, name, data, content_type):
    assert upload(client, name, data, content_type).status_code == 415


def test_oversized_and_empty_uploads_are_rejected(client):
    assert upload(client, "large.pdf", b"%PDF-" + b"x" * (10 * 1024 * 1024), "application/pdf").status_code == 413
    assert upload(client, "empty.pdf", b"", "application/pdf").status_code == 422


def test_corrupted_pdf_is_rejected(client):
    assert upload(client, "broken.pdf", b"%PDF-not-a-document", "application/pdf").status_code == 400


def test_pdf_page_limit_is_rejected(monkeypatch):
    class Reader:
        is_encrypted = False
        pages = [Mock(extract_text=lambda: "text") for _ in range(21)]

    monkeypatch.setattr(upload_extraction, "PdfReader", lambda *_args, **_kwargs: Reader())
    with pytest.raises(upload_extraction.UnprocessableUploadError):
        UploadTextExtractor().extract("offer.pdf", "application/pdf", b"%PDF-test")


def test_encrypted_pdf_is_rejected(monkeypatch):
    class Reader:
        is_encrypted = True
        pages = []

    monkeypatch.setattr(upload_extraction, "PdfReader", lambda *_args, **_kwargs: Reader())
    with pytest.raises(upload_extraction.UnprocessableUploadError):
        UploadTextExtractor().extract("offer.pdf", "application/pdf", b"%PDF-test")


def test_missing_ocr_dependency_is_safe(client, monkeypatch):
    monkeypatch.setattr(upload_extraction, "pytesseract", None)
    response = upload(client, "chat.png", png_bytes(), "image/png")
    assert response.status_code == 503
    assert response.json() == {"detail": "OCR service is unavailable"}


def test_tesseract_uses_configured_path(monkeypatch):
    monkeypatch.setattr(upload_extraction, "WINDOWS_TESSERACT_CMD", upload_extraction.Path("missing.exe"))
    assert upload_extraction.resolve_tesseract_cmd(r"D:\OCR\tesseract.exe") == r"D:\OCR\tesseract.exe"


def test_tesseract_uses_existing_windows_default(tmp_path, monkeypatch):
    executable = tmp_path / "tesseract.exe"
    executable.touch()
    monkeypatch.setattr(upload_extraction, "WINDOWS_TESSERACT_CMD", executable)
    assert upload_extraction.resolve_tesseract_cmd() == str(executable)


def test_tesseract_falls_back_to_path_when_no_windows_default(tmp_path, monkeypatch):
    monkeypatch.setattr(upload_extraction, "WINDOWS_TESSERACT_CMD", tmp_path / "missing.exe")
    assert upload_extraction.resolve_tesseract_cmd() == "tesseract"


def test_missing_rule_engine_returns_503():
    response = upload(TestClient(create_app()), "offer.pdf", text_pdf(), "application/pdf")
    assert response.status_code == 503
    assert response.json() == {"detail": "Scam analysis is unavailable"}


def test_scanned_pdf_ocr_completes_before_missing_rule_engine_503(monkeypatch):
    monkeypatch.setattr(upload_extraction, "pymupdf", mocked_pdf_renderer())
    ocr = Mock(return_value="Recruiter asks for an advance fee")
    monkeypatch.setattr(upload_extraction.pytesseract, "image_to_string", ocr)
    response = upload(TestClient(create_app()), "scan.pdf", text_pdf(""), "application/pdf")
    assert response.status_code == 503
    assert response.json() == {"detail": "Scam analysis is unavailable"}
    ocr.assert_called_once()


def test_upload_content_is_not_logged(client, caplog):
    private_text = "private recruiter message"
    with caplog.at_level("INFO"):
        response = upload(client, "offer.pdf", text_pdf(private_text), "application/pdf")
    assert response.status_code == 200
    assert private_text not in caplog.text
