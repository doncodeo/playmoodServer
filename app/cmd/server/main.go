package main

import (
	"github.com/gin-gonic/gin"
	"nigeria-tax-api/internal/routes"
)

func main() {
	r := gin.Default()

	routes.RegisterRoutes(r)

	r.Run(":8080") // listen and serve on
}