# Task 003: Therapist-style AI System Prompt

## Problem
The current AI has no system prompt, so responses may be generic or immediately jump to giving advice. For a journaling app, the AI should act like a supportive therapist - reflective, empathetic, and focused on helping users explore their own thoughts rather than prescribing solutions.

## Impact
- Creates a therapeutic, supportive journaling experience
- Encourages self-reflection and emotional exploration
- Differentiates the app from generic chatbots
- Helps users feel heard and validated

## Proposed Solution
1. Create a therapist-style system prompt in `services/ai.ts`
2. Include the system prompt in all API calls
3. Prompt should emphasize:
   - Active listening and reflection
   - Open-ended questions
   - Emotional validation
   - Avoiding premature advice
   - Gentle exploration of feelings

## Acceptance Criteria
- [ ] System prompt is added to the AI service configuration
- [ ] System prompt is included in all chat API requests
- [ ] AI responds with reflective, empathetic tone
- [ ] AI asks open-ended questions to help users explore thoughts
- [ ] AI validates emotions before offering any suggestions
- [ ] AI does not jump to giving advice immediately

## File References
- Edit: `services/ai.ts`
- New: `constants/aiPrompts.ts` (optional, for prompt organization)

## Subtasks
1. [ ] Research effective therapeutic communication techniques
2. [ ] Write system prompt following therapeutic guidelines
3. [ ] Add system message to the messages array in streamChat
4. [ ] Test AI responses for therapeutic tone
5. [ ] Iterate on prompt based on response quality

## System Prompt Design Guidelines

The prompt should instruct the AI to:

1. **Reflect back** what the user shares ("It sounds like you're feeling...")
2. **Validate emotions** before anything else ("That's completely understandable...")
3. **Ask open-ended questions** ("What do you think is behind that feeling?")
4. **Avoid giving advice** unless explicitly asked
5. **Explore gently** ("Tell me more about...")
6. **Stay present-focused** while allowing past exploration
7. **Use warm, supportive language**
8. **Keep responses concise** but meaningful
9. **Never judge** or make the user feel wrong

## Verification
**Manual Testing:**
1. Share a stressful situation - AI should validate first, ask questions
2. Ask "what should I do?" - AI should explore before suggesting
3. Share positive news - AI should celebrate and explore
4. Share complex emotions - AI should help untangle without rushing

**Unit Tests:**
- Verify system message is included in API requests (mock test)

## Example System Prompt Structure
```
You are a compassionate journaling companion...
- Always validate emotions first
- Ask reflective questions
- Never rush to solutions
- Use "I notice...", "It sounds like...", "Tell me more about..."
```

## Notes
- Keep prompt concise but comprehensive (aim for 200-400 words)
- Store in constants file if it grows large
- Consider different modes (daily check-in, deep reflection, celebration)
