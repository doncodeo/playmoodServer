package services

import (
	"nigeria-tax-api/internal/models"
	"testing"
	"math"
)

func TestTaxService_CalculateTax(t *testing.T) {
	service := NewTaxService()
	const tolerance = 1e-6

	// Add a new deduction strategy for testing purposes
	deductionStrategies["LifeInsurance"] = func(d models.Deduction, grossIncome float64) float64 {
		return d.Amount // No cap for this example
	}

	testCases := []struct {
		name     string
		req      models.TaxCalculationRequest
		expected models.TaxCalculationResponse
	}{
		{
			name: "Single employment income, no deductions",
			req: models.TaxCalculationRequest{
				Incomes: []models.IncomeSource{
					{Type: "Employment", Amount: 2000000},
				},
				Deductions: []models.Deduction{},
			},
			expected: models.TaxCalculationResponse{
				Breakdown: models.TaxBreakdown{
					TotalGrossIncome:   2000000,
					TotalDeductions:    600000,
					ConsolidatedRelief: 600000,
					TaxableIncome:      1400000,
					AnnualTax:          186000,
					MonthlyTax:         15500,
				},
				Message: "Tax calculated successfully.",
			},
		},
		{
			name: "Multiple incomes with a new deduction type",
			req: models.TaxCalculationRequest{
				Incomes: []models.IncomeSource{
					{Type: "Employment", Amount: 5000000},
				},
				Deductions: []models.Deduction{
					{Type: "Pension", Amount: 400000},
					{Type: "LifeInsurance", Amount: 100000},
				},
			},
			expected: models.TaxCalculationResponse{
				Breakdown: models.TaxBreakdown{
					TotalGrossIncome:   5000000,
					TotalDeductions:    1700000,
					ConsolidatedRelief: 1200000,
					TaxableIncome:      3300000,
					AnnualTax:          584000, // Corrected value
					MonthlyTax:         48666.666667, // Corrected value
				},
				Message: "Tax calculated successfully.",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := service.CalculateTax(tc.req)

			if math.Abs(got.Breakdown.AnnualTax-tc.expected.Breakdown.AnnualTax) > tolerance {
				t.Errorf("expected annual tax %f, got %f", tc.expected.Breakdown.AnnualTax, got.Breakdown.AnnualTax)
			}
			if math.Abs(got.Breakdown.MonthlyTax-tc.expected.Breakdown.MonthlyTax) > tolerance {
				t.Errorf("expected monthly tax %f, got %f", tc.expected.Breakdown.MonthlyTax, got.Breakdown.MonthlyTax)
			}
			if math.Abs(got.Breakdown.TaxableIncome-tc.expected.Breakdown.TaxableIncome) > tolerance {
				t.Errorf("expected taxable income %f, got %f", tc.expected.Breakdown.TaxableIncome, got.Breakdown.TaxableIncome)
			}
		})
	}
}
