package engine

import "math"

// TaxBracket defines a single tax bracket.
type TaxBracket struct {
	Threshold float64
	Rate      float64
}

// TaxEngine holds the rules for tax calculation.
type TaxEngine struct {
	Brackets []TaxBracket
}

// NewTaxEngine creates a new instance of the tax engine with Nigerian tax rules.
func NewTaxEngine() *TaxEngine {
	return &TaxEngine{
		Brackets: []TaxBracket{
			{Threshold: 300000, Rate: 0.07},
			{Threshold: 300000, Rate: 0.11},
			{Threshold: 500000, Rate: 0.15},
			{Threshold: 500000, Rate: 0.19},
			{Threshold: 1600000, Rate: 0.21},
			{Threshold: 3200000, Rate: 0.24},
		},
	}
}

// CalculateCRA calculates the Consolidated Relief Allowance.
func (e *TaxEngine) CalculateCRA(grossIncome float64) float64 {
	cra := math.Max(200000, 0.01*grossIncome) + (0.20 * grossIncome)
	return cra
}

// CalculateProgressiveTax calculates the tax based on the defined brackets.
func (e *TaxEngine) CalculateProgressiveTax(taxableIncome float64) float64 {
	var totalTax float64
	remainingIncome := taxableIncome

	for _, bracket := range e.Brackets {
		if remainingIncome <= 0 {
			break
		}

		taxableAtBracket := math.Min(remainingIncome, bracket.Threshold)
		totalTax += taxableAtBracket * bracket.Rate
		remainingIncome -= taxableAtBracket
	}

	// Any income remaining after the defined brackets is taxed at the highest rate.
	if remainingIncome > 0 {
		// This logic assumes the last bracket in the slice is the highest.
		// A more robust implementation might explicitly define a "highest" bracket.
		highestRate := e.Brackets[len(e.Brackets)-1].Rate
		totalTax += remainingIncome * highestRate
	}

	return totalTax
}
