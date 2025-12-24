package handlers

import (
	"nigeria-tax-api/internal/models"
	"nigeria-tax-api/internal/services"
	"net/http"
	"github.com/gin-gonic/gin"
)

// taxService is an instance of our tax calculation service.
var taxService = services.NewTaxService()

// CalculateTax handles the API request to calculate taxes.
func CalculateTax(c *gin.Context) {
	var req models.TaxCalculationRequest

	// Bind the incoming JSON to the request struct
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Perform the calculation
	resp := taxService.CalculateTax(req)

	// Return the response
	c.JSON(http.StatusOK, resp)
}
