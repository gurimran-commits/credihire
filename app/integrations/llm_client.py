import httpx

from app.core.config import Settings


class LLMUnavailable(Exception):
    pass


class LLMRateLimited(LLMUnavailable):
    pass


class LLMInvalidResponse(LLMUnavailable):
    pass


class LLMClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings, self.client = settings, client

    async def reply(self, messages: list[dict[str, str]] | str, response_format: dict[str, str] | None = None) -> str:
        if not self.settings.llm_configured:
            raise LLMUnavailable("AI service is not configured")
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        try:
            response = await client.post(
                f"{self.settings.effective_llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.effective_llm_api_key}"},
                json={"model": self.settings.effective_llm_model, "messages": messages, **({"response_format": response_format} if response_format else {})},
            )
            if response.status_code == 429:
                raise LLMRateLimited("AI service is temporarily rate-limited")
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip() or len(content.strip()) > 8_000:
                raise LLMInvalidResponse("AI service returned an invalid response")
            return content.strip()
        except LLMRateLimited:
            raise
        except LLMInvalidResponse:
            raise
        except httpx.HTTPError as exc:
            raise LLMUnavailable("AI service is unavailable") from exc
        except (KeyError, TypeError, ValueError) as exc:
            raise LLMInvalidResponse("AI service returned an invalid response") from exc
        finally:
            if owns_client:
                await client.aclose()

    async def readiness_status(self) -> str:
        if not self.settings.llm_configured:
            return "unconfigured"
        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=httpx.Timeout(5.0))
        try:
            response = await client.get(
                f"{self.settings.effective_llm_base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {self.settings.effective_llm_api_key}"},
            )
            return "ready" if response.is_success else "unavailable"
        except httpx.HTTPError:
            return "unavailable"
        finally:
            if owns_client:
                await client.aclose()
