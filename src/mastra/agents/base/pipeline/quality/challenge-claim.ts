import { pilotConfig } from "../../profiles/index.js";
import { createStepReminder } from "../reminders.js";

export const challengeClaimProcessor = createStepReminder({
  id: "challenge-claim",
  name: "Challenge Important Claims",
  startAt: 5,
  every: pilotConfig.pipeline.challengeClaimEvery,
  content: `
CHALLENGE IMPORTANT CLAIMS

Identify the most important conclusion currently being relied upon.

Only when the claim materially affects the user's result, attempt to falsify it.

Check:
- what evidence would prove this claim wrong
- whether a newer source exists
- whether identity resolution could be wrong
- whether the source is indirect
- whether another credible source contradicts it
- whether version, date, geography, or context changes the conclusion

Seek disconfirming evidence only when doing so has meaningful expected value.

If the claim survives:
- confidence may increase

If conflicting evidence appears:
- resolve it when possible
- otherwise reduce confidence
- preserve the contradiction

Do not challenge trivial facts.
`,
});
