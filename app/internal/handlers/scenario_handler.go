package handlers

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

// Scenario represents a single educational tax scenario.
type Scenario struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Example     string `json:"example"`
}

// GetScenarios returns a list of predefined tax scenarios.
func GetScenarios(c *gin.Context) {
	scenarios := []Scenario{
		{
			Title:       "Bola the Technician",
			Description: "A scenario for a self-employed individual.",
			Example:     "Bola is a phone technician who earns ₦1,200,000 annually. He has no pension but pays ₦300,000 in rent. Based on the tax laws, his monthly tax is calculated after considering his reliefs. Since he earns above the minimum threshold, he is not exempt from tax.",
		},
		{
			Title:       "Aisha the Doctor",
			Description: "A scenario for a salaried employee with full deductions.",
			Example:     "Aisha is a doctor at a private hospital with an annual salary of ₦5,000,000. She contributes 8% to her pension, 2.5% to the NHF, and 5% to the NHIS. Her tax is calculated on her income after these statutory deductions and her consolidated relief are considered.",
		},
	}

	c.JSON(http.StatusOK, scenarios)
}
