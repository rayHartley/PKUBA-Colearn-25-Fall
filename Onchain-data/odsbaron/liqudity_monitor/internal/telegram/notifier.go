package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Notifier struct {
	token      string
	chatID     string
	httpClient *http.Client
	mu         sync.Mutex
	lastSentAt time.Time
}

type sendMessageRequest struct {
	ChatID string `json:"chat_id"`
	Text   string `json:"text"`
}

func New(token, chatID string) *Notifier {
	return &Notifier{
		token:      token,
		chatID:     chatID,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (n *Notifier) Send(ctx context.Context, message string) error {
	if n.token == "" || n.chatID == "" {
		fmt.Println(message)
		return nil
	}

	for _, chunk := range splitMessage(message, 4096) {
		if err := n.sendChunk(ctx, chunk); err != nil {
			return err
		}
	}

	return nil
}

func (n *Notifier) sendChunk(ctx context.Context, message string) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if !n.lastSentAt.IsZero() {
		wait := time.Until(n.lastSentAt.Add(time.Second))
		if wait > 0 {
			timer := time.NewTimer(wait)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
	}

	body, err := json.Marshal(sendMessageRequest{
		ChatID: n.chatID,
		Text:   message,
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", n.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("telegram send failed: %s", resp.Status)
	}

	n.lastSentAt = time.Now()
	return nil
}

func splitMessage(message string, limit int) []string {
	if len(message) <= limit {
		return []string{message}
	}

	var parts []string
	var current strings.Builder

	for _, line := range strings.Split(message, "\n") {
		if current.Len() > 0 && current.Len()+1+len(line) > limit {
			parts = append(parts, current.String())
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteString("\n")
		}
		current.WriteString(line)
	}

	if current.Len() > 0 {
		parts = append(parts, current.String())
	}

	return parts
}
