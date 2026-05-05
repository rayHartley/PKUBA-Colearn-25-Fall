package main

import (
	"math/big"
	"reflect"
	"strings"
	"testing"
)

func TestReadHashesDeduplicatesCSV(t *testing.T) {
	input := strings.NewReader(`hash,profit
0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730,1
duplicate,0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730
0xec373ee5117b251bde634a2f5e5efe24212af0b52e4fddcaf16a9212a59e01b1,2
`)
	got, err := readHashes(input)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730",
		"0xec373ee5117b251bde634a2f5e5efe24212af0b52e4fddcaf16a9212a59e01b1",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("hashes mismatch\ngot  %v\nwant %v", got, want)
	}
}

func TestTopicAddress(t *testing.T) {
	got, err := topicAddress("0x00000000000000000000000050bf20318ce9100ac4374ab4bed5fe4b1f8cc6b3")
	if err != nil {
		t.Fatal(err)
	}
	want := "0x50bf20318ce9100ac4374ab4bed5fe4b1f8cc6b3"
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestPercentString(t *testing.T) {
	got := percentString(mustBig("6563852117093206"), mustBig("7029283395661218"), 6)
	if got != "93.378680" {
		t.Fatalf("got %s", got)
	}
}

func mustBig(s string) *big.Int {
	n, ok := new(big.Int).SetString(s, 10)
	if !ok {
		panic("bad decimal integer: " + s)
	}
	return n
}
