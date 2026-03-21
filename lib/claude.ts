export const getClaudeResponse = async (messages: {role: string, content: string}[]) => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EXPO_PUBLIC_CLAUDE_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 300,
        system: 'You are SafeHer, a compassionate AI safety companion for women. Give brief, practical safety advice. Be warm and empowering. Max 2 sentences. Use 1 emoji.',
        messages
      })
    });
    
    if (!res.ok) {
        console.error('Claude API Error:', await res.text());
        return null;
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Claude API Fetch error:', error);
    return null;
  }
};