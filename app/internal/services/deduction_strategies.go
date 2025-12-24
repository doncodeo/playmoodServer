package services

import (
	"nigeria-tax-api/internal/models"
	"math"
)

// DeductionCalculator defines the interface for a deduction strategy.
type DeductionCalculator func(deduction models.Deduction, grossIncome float64) float64

// deductionStrategies maps deduction types to their calculation logic.
var deductionStrategies = map[string]DeductionCalculator{
	"Pension": func(d models.Deduction, grossIncome float64) float64 {
		// Capped at 8% of gross income
		return math.Min(d.Amount, 0.08*grossIncome)
	},
	"NHF": func(d models.Deduction, grossIncome float64) float64 {
		// Capped at 2.5% of gross income
		return math.Min(d.Amount, 0.025*grossIncome)
	},
	"NHIS": func(d models.Deduction, grossIncome float64) float64 {
		// Capped at 5% of gross income
		return math.Min(d.Amount, 0.05*grossIncome)
	},
	// New deduction types can be added here easily.
}
