# Application Description: Playmood Backend

This application is the backend server for a video-sharing platform called **Playmood**. It provides a complete set of APIs to support a rich, interactive user experience for content creators and viewers. The platform is designed to be a full-featured alternative to other video-sharing sites, with a focus on creator tools and community engagement.

### Core Features and Services

*   **User Management:**
    *   Standard user registration and login with email and password.
    *   Google OAuth 2.0 for seamless, secure authentication.
    *   User roles, including "creator" and "admin" with different levels of access.
    *   User profiles, channels, and subscription management.

*   **Content Management:**
    *   Uploading, processing, and streaming of video content.
    *   APIs for creating, reading, updating, and deleting content.
    *   Content categories, playlists, and highlights.
    *   Liking, commenting, and viewing content.

*   **Creator Tools:**
    *   A dedicated creator feed to showcase a creator's content.
    *   Community posts for creators to engage with their audience.
    *   Analytics to track content performance.

*   **AI-Powered Services:**
    *   **Automatic Video Transcription:** Utilizes AssemblyAI to generate captions for videos.
    *   **AI-Generated Content:** The `@xenova/transformers` and `onnxruntime-node` libraries are used for running AI models, likely for tasks like content recommendations, and other machine learning features.

*   **Real-time Communication:**
    *   WebSockets are used to provide real-time updates for notifications, likes, comments, and other interactive features.

*   **API Documentation:**
    *   A Swagger/OpenAPI documentation is available at the `/api-docs` endpoint, providing a clear and interactive way to explore the API.

### Technology Stack and Tools

*   **Backend Framework:** **Node.js** with the **Express.js** web framework.
*   **Database:** **MongoDB** with the **Mongoose** ODM for data modeling.
*   **Authentication:** **Passport.js** for handling Google OAuth 2.0, and **JSON Web Tokens (JWT)** for session management.
*   **Real-time Communication:** **`ws`** library for WebSocket communication.
*   **AI and Machine Learning:**
    *   **`@xenova/transformers`**: A library for running state-of-the-art machine learning models in Node.js.
    *   **`onnxruntime-node`**: A runtime for ONNX (Open Neural Network Exchange) models, used by `@xenova/transformers`.
    *   **`assemblyai`**: A third-party API for speech-to-text transcription.
*   **Video and Media Processing:**
    *   **`fluent-ffmpeg`**: A library for programmatically controlling FFmpeg.
    *   **`@ffmpeg-installer/ffmpeg`**: A package that provides the FFmpeg binary.
*   **Cloud Services:** **Cloudinary** for cloud-based image and video management (storage, transformation, and delivery).
*   **Background Job Processing:** **BullMQ** with **Redis** for managing and processing background jobs, such as video transcoding and AI tasks.
*   **Security:**
    *   **Helmet**: For setting various HTTP headers to secure the application.
    *   **`express-rate-limit`**: For rate-limiting requests to prevent abuse.
    *   **`express-mongo-sanitize`**: For sanitizing user input to prevent NoSQL injection attacks.
*   **Testing:**
    *   **Mocha**: A feature-rich JavaScript test framework.
    *   **Chai**: An assertion library for Node.js.
    *   **Sinon**: A library for spies, stubs, and mocks.
    *   **Supertest**: For testing HTTP assertions.
*   **Deployment:** The `Procfile` and `heroku-prebuild` script in `package.json` suggest that the application is designed to be deployed on **Heroku**.
