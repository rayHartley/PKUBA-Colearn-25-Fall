import time
from dataclasses import dataclass
from typing import Iterable
import requests


@dataclass
class TelegramBot:
    token: str
    chat_id: str
    rate_limit_sec: float = 1.0
    timeout_sec: float = 10.0

    def __post_init__(self) -> None:
        self._last_sent = 0.0

    @property
    def enabled(self) -> bool:
        return bool(self.token and self.chat_id)

    def send_message(self, text: str) -> None:
        for chunk in self._split_message(text):
            self._wait_rate_limit()
            if self.enabled:
                self._post_message(chunk)
            else:
                print(chunk)

    def _post_message(self, text: str) -> None:
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        response = requests.post(url, json=payload, timeout=self.timeout_sec)
        response.raise_for_status()

    def _wait_rate_limit(self) -> None:
        elapsed = time.time() - self._last_sent
        sleep_for = self.rate_limit_sec - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)
        self._last_sent = time.time()

    def _split_message(self, text: str, max_len: int = 3500) -> Iterable[str]:
        if len(text) <= max_len:
            return [text]
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + max_len, len(text))
            chunks.append(text[start:end])
            start = end
        return chunks
