// Import necessary modules

// Define the URL of your backend server
const backendUrl = Deno.env.get("BACKEND_URL") || "http://localhost:3000/v1/assistant";

// Function to fetch and process the streaming response
async function fetchStream() {
    try {
        // Make a POST request to the backend server
        const response = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Co to weeia?" }),
        });

        // Check if the response body is available
        if (!response.body) {
            console.error("No response body available.");
            return;
        }

        // Create a stream reader
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

        console.log("Reading stream...");

        // Read the stream in chunks
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log("Stream complete.");
                break;
            }
            console.log("Received chunk:", value);
        }
    } catch (error) {
        console.error("Error fetching stream:", error);
    }
}

// Execute the function
fetchStream();
