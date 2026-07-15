const apiKey = "AQ.Ab8RN6LoKLwptpN8867462LX4pnXrCXhGmsvkp94Nnww5KbXXg";

const runTest = async () => {
  const model = "gemini-3.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  console.log(`Testing model: ${model} via: ${endpoint}`);
  try {
    const res = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 800)}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
};

runTest();
