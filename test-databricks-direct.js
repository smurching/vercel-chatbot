// Direct test to see what Databricks responses API returns
const fetch = require('node-fetch');

async function testDatabricksResponse() {
  const url = `${process.env.DATABRICKS_HOST}/serving-endpoints/responses`;
  const endpointName = process.env.DATABRICKS_AGENT_ENDPOINT;

  console.log('Testing Databricks endpoint:', url);
  console.log('Using endpoint name:', endpointName);

  const requestBody = {
    model: endpointName,
    input: [{ role: "user", content: "Hello, say hi back!" }],
    stream: true
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DATABRICKS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response body type:', response.body?.constructor.name);

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunkIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        console.log(`Chunk ${chunkIndex++}:`, JSON.stringify(chunk));

        if (chunkIndex > 5) break; // Limit output
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testDatabricksResponse();