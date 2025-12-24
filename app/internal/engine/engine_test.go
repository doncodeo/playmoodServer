package engine

import (
	"testing"
	"math"
)

func TestCalculateCRA(t *testing.T) {
	engine := NewTaxEngine()

	testCases := []struct {
		name        string
		grossIncome float64
		expected    float64
	}{
		{"Income at 1M", 1000000, 400000}, // 200k + 20% of 1M
		{"Income at 5M", 5000000, 1200000},// 200k + 20% of 5M
		{"Income at 30M", 30000000, 6300000},// 300k + 20% of 30M
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := engine.CalculateCRA(tc.grossIncome)
			if got != tc.expected {
				t.Errorf("expected %f, got %f", tc.expected, got)
			}
		})
	}
}

func TestCalculateProgressiveTax(t *testing.T) {
	engine := NewTaxEngine()

	testCases := []struct {
		name          string
		taxableIncome float64
		expected      float64
	}{
		{"Zero Income", 0, 0},
		{"Income within first bracket", 300000, 21000},
		{"Income spanning multiple brackets", 1000000, 114000},
		{"High Income", 5000000, 992000},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := engine.CalculateProgressiveTax(tc.taxableIncome)
			if math.Abs(got-tc.expected) > 1e-9 {
				t.Errorf("expected %f, got %f", tc.expected, got)
			}
		})
	}
}
