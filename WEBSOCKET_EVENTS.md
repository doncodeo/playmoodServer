# WebSocket Events

This document outlines the WebSocket events that are broadcast from the server to all connected clients. The frontend can listen for these events to provide real-time updates to the user interface.

## Connection

To receive events, the client must first establish a WebSocket connection with the server.

## Events

### Content (Videos)

#### `content_approved`
- **Description:** Broadcast when an admin approves a content item.
- **Payload:** The full content object, populated with user details.

#### `content_rejected`
- **Description:** Broadcast when an admin rejects a content item.
- **Payload:** The full content object, populated with user details.

#### `content_liked`
- **Description:** Broadcast when a user likes a content item.
- **Payload:**
  ```json
  {
    "event": "content_liked",
    "payload": {
      "contentId": "string",
      "likes": "number"
    }
  }
  ```

#### `content_unliked`
- **Description:** Broadcast when a user unlikes a content item.
- **Payload:**
  ```json
  {
    "event": "content_unliked",
    "payload": {
      "contentId": "string",
      "likes": "number"
    }
  }
  ```

#### `comment_added`
- **Description:** Broadcast when a user adds a comment to a content item.
- **Payload:**
  ```json
  {
    "event": "comment_added",
    "payload": {
      "contentId": "string",
      "comment": {
        "user": {
          "_id": "string",
          "name": "string",
          "profileImage": "string"
        },
        "text": "string",
        "createdAt": "string (ISO 8601)"
      }
    }
  }
  ```

### Community Posts

#### `community_post_liked`
- **Description:** Broadcast when a user likes a community post.
- **Payload:**
  ```json
  {
    "event": "community_post_liked",
    "payload": {
      "postId": "string",
      "likes": "number"
    }
  }
  ```

#### `community_post_unliked`
- **Description:** Broadcast when a user unlikes a community post.
- **Payload:**
  ```json
  {
    "event": "community_post_unliked",
    "payload": {
      "postId": "string",
      "likes": "number"
    }
  }
  ```

#### `community_post_comment_added`
- **Description:** Broadcast when a user adds a comment to a community post.
- **Payload:**
  ```json
  {
    "event": "community_post_comment_added",
    "payload": {
      "postId": "string",
      "comment": {
        "user": "string (ObjectId)",
        "content": "string",
        "timestamp": "string (ISO 8601)"
      }
    }
  }
  ```