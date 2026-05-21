const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://virtual-vogue-ai.onrender.com";

export async function generateTryOn({
  humanImage,
  garmentImage,
  garmentDescription,
  category,
  onProgress
}) {
  onProgress?.("processing", 0);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true"
      },
      body: JSON.stringify({
        humanImage,
        garmentImage,
        garmentDescription,
        category
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw createApiError(body.message || `Server error: ${response.status}`, body.code, response.status);
    }

    const body = await response.json();

    if (body.error) {
      throw createApiError(body.message || "Generation failed.", body.code);
    }

    return body;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === "AbortError") {
      throw createApiError("Generation timed out after 4 minutes. Please try again.", "TIMEOUT");
    }

    throw error;
  }
}

function createApiError(message, code = "GENERATION_FAILED", status) {
  const error = new Error(message);
  error.code = code || "GENERATION_FAILED";
  error.status = status;
  return error;
}
