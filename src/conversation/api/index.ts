import { chatCompletionsRegistration } from "./chat-completions";
import { conversationDeleteRegistration } from "./conversation-delete";
import { generateRegistration } from "./generate";
import { projectDeleteRegistration } from "./project-delete";

export const conversationApiRoutes = [
  chatCompletionsRegistration,
  conversationDeleteRegistration,
  projectDeleteRegistration,
  generateRegistration,
];
