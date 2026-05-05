"""Telegram Bot for sending liquidation alerts."""

import asyncio
import logging
from telegram import Bot
from telegram.constants import ParseMode
from asyncio_throttle import Throttler

from .config import TG_BOT_TOKEN, TG_CHAT_ID, TG_RATE_LIMIT

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Handles sending liquidation digests to Telegram with rate limiting."""

    def __init__(self, bot_token: str | None = None, chat_id: str | None = None):
        self.bot_token = bot_token or TG_BOT_TOKEN
        self.chat_id = chat_id or TG_CHAT_ID
        self.bot = Bot(token=self.bot_token) if self.bot_token else None
        # Rate limiter: 1 message per second
        self.throttler = Throttler(rate_limit=TG_RATE_LIMIT, period=1.0)

    async def send_message(self, text: str) -> bool:
        """Send a message to the configured Telegram chat with rate limiting.

        Splits long messages (>4096 chars) into multiple parts.
        """
        if not self.bot or not self.chat_id:
            logger.warning("Telegram bot not configured, printing to stdout instead")
            print(text)
            return False

        # Telegram message limit is 4096 characters
        chunks = self._split_message(text, max_len=4096)

        for chunk in chunks:
            async with self.throttler:
                try:
                    await self.bot.send_message(
                        chat_id=self.chat_id,
                        text=chunk,
                        parse_mode=None,  # plain text for reliability
                    )
                except Exception as e:
                    logger.error(f"Failed to send Telegram message: {e}")
                    return False

        return True

    def _split_message(self, text: str, max_len: int = 4096) -> list[str]:
        """Split a message into chunks respecting line boundaries."""
        if len(text) <= max_len:
            return [text]

        chunks = []
        current = ""
        for line in text.split("\n"):
            if len(current) + len(line) + 1 > max_len:
                if current:
                    chunks.append(current)
                current = line
            else:
                current = current + "\n" + line if current else line

        if current:
            chunks.append(current)

        return chunks

    async def close(self):
        """Cleanup bot session."""
        if self.bot:
            try:
                await self.bot.shutdown()
            except Exception:
                pass  # Ignore errors on shutdown (e.g., flood control)
