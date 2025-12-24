package routes

import (
	"github.com/gin-gonic/gin"
	"nigeria-tax-api/internal/handlers"
)

func RegisterRoutes(r *gin.Engine) {
	r.GET("/ping", handlers.PingHandler)

	api := r.Group("/api")
	{
		tax := api.Group("/tax")
		{
			tax.POST("/calculate", handlers.CalculateTax)
			tax.GET("/scenarios", handlers.GetScenarios)
		}
	}
}
