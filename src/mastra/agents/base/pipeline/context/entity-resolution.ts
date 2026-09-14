import { pilotConfig } from "../../profiles/index.js";
import { createStepReminder } from "../reminders.js";

export const entityResolutionProcessor = createStepReminder({
  id: "entity-resolution",
  name: "Entity Resolution",
  startAt: 2,
  every: pilotConfig.pipeline.entityResolutionEvery,
  content: `
ENTITY RESOLUTION

Review entities discovered so far and resolve duplicate or ambiguous identities.

Apply this to any relevant entity type:
- people
- companies
- organizations
- products
- repositories
- technologies
- jobs
- documents
- websites
- events
- locations
- articles
- claims
- other real-world entities

NORMALIZATION

When useful normalize:
- canonical name
- aliases
- legal vs commercial names
- canonical website
- canonical URL
- repository owner/name
- current role
- company relationship
- location
- identifiers

DUPLICATES

Consider entities duplicates only when evidence supports the same real-world identity.

Useful evidence may include:
- canonical URL
- official domain
- repository identity
- matching organization
- matching role
- matching location
- official identifiers
- corroborating primary sources

Do not merge entities solely because their names are similar.

MERGING

When duplicate representations exist:
- keep one canonical entity
- merge useful unique information
- preserve strongest evidence
- preserve newest relevant evidence
- preserve unresolved contradictions
- preserve source provenance

AMBIGUITY

When identity is uncertain:
- keep entities separate
- lower confidence
- seek verification only when resolving the ambiguity materially affects the user's objective

STATE

If entity resolution changes accepted results:
- update collected results
- update working memory
- remove obsolete duplicate representations
- preserve useful evidence

Do not repeatedly resolve entities that have already been confidently canonicalized.
`,
});
