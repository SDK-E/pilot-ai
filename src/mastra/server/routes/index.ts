import { chatCompletionsRegistration } from "./chat-completions.js";
import { conversationDeleteRegistration } from "./conversation-delete.js";
import { conversationTruncateRegistration } from "./conversation-truncate.js";
import { projectDeleteRegistration } from "./project-delete.js";

export const conversationApiRoutes = [
  chatCompletionsRegistration,
  conversationDeleteRegistration,
  conversationTruncateRegistration,
  projectDeleteRegistration,
];
