package service

import (
	"crypto/rand"
	"encoding/hex"
)

func generatePublicID() (string, error) {
	const byteLen = 16
	buffer := make([]byte, byteLen)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}
