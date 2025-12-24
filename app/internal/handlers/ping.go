package handlers

import "github.com/gin-gonic/gin"

// PingHandler is a simple health check handler.
func PingHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "pong",
	})
}
