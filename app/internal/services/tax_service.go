package services

import (
	"nigeria-tax-api/internal/engine"
	"nigeria-tax-api/internal/models"
)

// TaxService provides the core tax calculation logic.
type TaxService struct {
	Engine *engine.TaxEngine
}

// NewTaxService creates a new instance of the TaxService.
func NewTaxService() *TaxService {
	return &TaxService{
		Engine: engine.NewTaxEngine(),
	}
}

// CalculateTax calculates the tax based on the provided income and deductions.
func (s *TaxService) CalculateTax(req models.TaxCalculationRequest) models.TaxCalculationResponse {
	var totalGrossIncome float64
	for _, income := range req.Incomes {
		totalGrossIncome += income.Amount
	}

	var totalStatutoryDeductions float64
	for _, deduction := range req.Deductions {
		if calculator, found := deductionStrategies[deduction.Type]; found {
			totalStatutoryDeductions += calculator(deduction, totalGrossIncome)
		}
	}

	consolidatedRelief := s.Engine.CalculateCRA(totalGrossIncome)
	totalDeductions := totalStatutoryDeductions + consolidatedRelief

	taxableIncome := totalGrossIncome - totalDeductions
	if taxableIncome < 0 {
		taxableIncome = 0
	}

	annualTax := s.Engine.CalculateProgressiveTax(taxableIncome)

	return models.TaxCalculationResponse{
		Breakdown: models.TaxBreakdown{
			TotalGrossIncome:   totalGrossIncome,
			TotalDeductions:    totalDeductions,
			ConsolidatedRelief: consolidatedRelief,
			TaxableIncome:      taxableIncome,
			AnnualTax:          annualTax,
			MonthlyTax:         annualTax / 12,
		},
		Message: "Tax calculated successfully.",
	}
}
