
'use server';

export async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    // For now, we'll assume the content is text-based.
    // A more robust solution would handle different content types (e.g., PDF).
    const textContent = await response.text();
    return textContent;
  } catch (error) {
    console.error(`Error extracting text from ${url}:`, error);
    throw new Error(`Could not extract text from URL: ${url}`);
  }
}
