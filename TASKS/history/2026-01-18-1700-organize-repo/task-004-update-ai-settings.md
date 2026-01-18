# Task 004: Update AI Settings
 
## Objective
Update the AI service to use temperature=1.0 and max_tokens=16384.
 
## Requirements
- Set temperature to 1.0 for more creative responses
- Set max_tokens to 16384 for longer responses
- Keep streaming functionality intact
 
## Implementation
1. Edit `services/ai.ts`
2. Add temperature and max_tokens to API request body
 
## Acceptance Criteria
- [ ] API requests include temperature: 1.0
- [ ] API requests include max_tokens: 16384
- [ ] Streaming still works correctly
