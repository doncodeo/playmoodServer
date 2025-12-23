// This module checks for the presence of the AssemblyAI API key.
// It's crucial for the transcription service to function correctly.

if (!process.env.ASSEMBLYAI_API_KEY) {
    console.error('FATAL ERROR: ASSEMBLYAI_API_KEY is not defined.');
    console.error('The application cannot start without this environment variable.');
    console.error('Please set it in your .env file or as a system environment variable.');
    process.exit(1); // Exit the application with a failure code
}

console.log('AssemblyAI API key is configured.');

// We don't need to export anything; this module's purpose is to run the check on import.
