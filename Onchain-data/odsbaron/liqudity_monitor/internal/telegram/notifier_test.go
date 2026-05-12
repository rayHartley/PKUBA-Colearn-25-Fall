package telegram

import "testing"

func TestSplitMessageNoSplit(t *testing.T) {
	message := "short message"
	parts := splitMessage(message, 4096)

	if len(parts) != 1 {
		t.Fatalf("len(parts) = %d, want 1", len(parts))
	}
	if parts[0] != message {
		t.Fatalf("parts[0] = %q, want %q", parts[0], message)
	}
}

func TestSplitMessageByLineBoundary(t *testing.T) {
	message := "line1\nline2\nline3"
	parts := splitMessage(message, 11)

	if len(parts) != 2 {
		t.Fatalf("len(parts) = %d, want 2", len(parts))
	}
	if parts[0] != "line1\nline2" {
		t.Fatalf("parts[0] = %q", parts[0])
	}
	if parts[1] != "line3" {
		t.Fatalf("parts[1] = %q", parts[1])
	}
}
