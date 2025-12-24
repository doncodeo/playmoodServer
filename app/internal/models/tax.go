package models

// IncomeSource represents a single source of income.
type IncomeSource struct {
	Type   string  `json:"type"`   // e.g., "Employment", "Freelance", "Rental"
	Amount float64 `json:"amount"` // Annual amount
}

// Deduction represents a single deduction or relief.
type Deduction struct {
	Type   string  `json:"type"`   // e.g., "Pension", "NHF", "LifeInsurance"
	Amount float64 `json:"amount"` // Annual amount
}

// TaxCalculationRequest is the main request body for the tax calculation API.
type TaxCalculationRequest struct {
	Incomes    []IncomeSource `json:"incomes"`
	Deductions []Deduction    `json:"deductions"`
}

// TaxBreakdown provides a detailed breakdown of the tax calculation.
type TaxBreakdown struct {
	TotalGrossIncome    float64 `json:"totalGrossIncome"`
	TotalDeductions     float64 `json:"totalDeductions"`
	ConsolidatedRelief  float64 `json:"consolidatedRelief"`
	TaxableIncome       float64 `json:"taxableIncome"`
	AnnualTax           float64 `json:"annualTax"`
	MonthlyTax          float64 `json:"monthlyTax"`
}

// TaxCalculationResponse is the main response body for the tax calculation API.
type TaxCalculationResponse struct {
	Breakdown TaxBreakdown `json:"breakdown"`
	Message   string       `json:"message"`
}
