import httpx

from app.core.config import Settings


class LLMUnavailable(Exception):
    pass


class LLMClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings, self.client = settings, client

    async def reply(self, message: str) -> str:
        if not self.settings.llm_configured:
            raise LLMUnavailable("AI service is not configured")
        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        try:
            response = await client.post(
                f"{str(self.settings.llm_base_url).rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.llm_api_key}"},
                json={"model": self.settings.llm_model, "messages": [{"role": "user", "content": message}]},
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise LLMUnavailable("AI service returned an invalid response")
            return content.strip()
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise LLMUnavailable("AI service is unavailable") from exc
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
                f"{str(self.settings.llm_base_url).rstrip('/')}/models",
                headers={"Authorization": f"Bearer {self.settings.llm_api_key}"},
            )
            return "ready" if response.is_success else "unavailable"
        except httpx.HTTPError:
            return "unavailable"
        finally:
            if owns_client:
                await client.aclose()
